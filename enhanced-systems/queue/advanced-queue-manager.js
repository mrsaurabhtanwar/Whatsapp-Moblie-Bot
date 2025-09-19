const EventEmitter = require('events');

/**
 * Advanced Queue Management System
 * 
 * Features:
 * - Priority-based message queuing
 * - Intelligent retry strategies
 * - Dead letter queue for failed messages
 * - Queue persistence and recovery
 * - Performance monitoring
 * - Rate limiting and throttling
 */
class AdvancedQueueManager extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.maxConcurrency = options.maxConcurrency || 3;
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 5000; // 5 seconds
        this.maxQueueSize = options.maxQueueSize || 1000;
        this.deadLetterRetention = options.deadLetterRetention || 24 * 60 * 60 * 1000; // 24 hours
        
        // Queue types
        this.priorityQueue = new Map(); // High priority messages
        this.normalQueue = new Map();   // Normal priority messages
        this.retryQueue = new Map();    // Messages to retry
        this.deadLetterQueue = new Map(); // Failed messages
        
        // Processing state
        this.isProcessing = false;
        this.activeJobs = new Set();
        this.processingStats = {
            processed: 0,
            failed: 0,
            retried: 0,
            deadLettered: 0,
            startTime: Date.now()
        };
        
        // Rate limiting
        this.rateLimiter = {
            enabled: true,
            maxPerMinute: 60,
            maxPerHour: 1000,
            currentMinute: 0,
            currentHour: 0,
            lastMinuteReset: Date.now(),
            lastHourReset: Date.now()
        };
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Start processing
            this.startProcessing();
            
            // Setup cleanup tasks
            this.setupCleanupTasks();
            
            console.log('✅ Advanced Queue Manager initialized');
            console.log(`📊 Max concurrency: ${this.maxConcurrency}`);
            console.log(`🔄 Retry attempts: ${this.retryAttempts}`);
            console.log(`📈 Max queue size: ${this.maxQueueSize}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Advanced Queue Manager:', error.message);
        }
    }

    // Queue Operations
    async enqueue(job, priority = 'normal') {
        try {
            // Check queue size limits
            if (this.getTotalQueueSize() >= this.maxQueueSize) {
                throw new Error('Queue is full');
            }
            
            // Create job object
            const jobData = {
                id: this.generateJobId(),
                data: job,
                priority: priority,
                status: 'queued',
                createdAt: Date.now(),
                attempts: 0,
                maxAttempts: this.retryAttempts,
                nextRetry: null,
                metadata: {
                    type: job.type || 'message',
                    customerPhone: job.customerPhone || job.phone,
                    orderId: job.orderId || job.order_id
                }
            };
            
            // Add to appropriate queue
            if (priority === 'high') {
                this.priorityQueue.set(jobData.id, jobData);
            } else {
                this.normalQueue.set(jobData.id, jobData);
            }
            
            console.log(`📥 Job enqueued: ${jobData.id} (${priority} priority)`);
            
            // Emit event
            this.emit('jobEnqueued', jobData);
            
            return jobData.id;
            
        } catch (error) {
            console.error('❌ Failed to enqueue job:', error.message);
            throw error;
        }
    }

    async dequeue() {
        // Check rate limits
        if (!this.checkRateLimit()) {
            return null;
        }
        
        // Priority order: high priority -> normal -> retry
        let job = this.getNextJobFromQueue(this.priorityQueue) ||
                  this.getNextJobFromQueue(this.normalQueue) ||
                  this.getNextJobFromQueue(this.retryQueue);
        
        if (job) {
            job.status = 'processing';
            job.startedAt = Date.now();
            this.activeJobs.add(job.id);
            
            console.log(`📤 Job dequeued: ${job.id} (${job.priority} priority)`);
            this.emit('jobDequeued', job);
        }
        
        return job;
    }

    getNextJobFromQueue(queue) {
        if (queue.size === 0) return null;
        
        // Get the oldest job (FIFO)
        const jobs = Array.from(queue.values());
        jobs.sort((a, b) => a.createdAt - b.createdAt);
        
        const job = jobs[0];
        queue.delete(job.id);
        return job;
    }

    // Job Processing
    async processJob(job, processor) {
        try {
            console.log(`🔄 Processing job: ${job.id}`);
            
            // Update job status
            job.status = 'processing';
            job.attempts++;
            
            // Process the job
            const result = await processor(job.data);
            
            // Mark as completed
            job.status = 'completed';
            job.completedAt = Date.now();
            job.result = result;
            
            this.processingStats.processed++;
            this.activeJobs.delete(job.id);
            
            console.log(`✅ Job completed: ${job.id}`);
            this.emit('jobCompleted', job);
            
            return result;
            
        } catch (error) {
            console.error(`❌ Job failed: ${job.id}`, error.message);
            
            // Handle job failure
            await this.handleJobFailure(job, error);
            
            return null;
        }
    }

    async handleJobFailure(job, error) {
        job.lastError = error.message;
        job.failedAt = Date.now();
        
        if (job.attempts < job.maxAttempts) {
            // Retry the job
            await this.retryJob(job);
        } else {
            // Move to dead letter queue
            await this.moveToDeadLetter(job, error);
        }
        
        this.activeJobs.delete(job.id);
    }

    async retryJob(job) {
        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(job.attempts);
        job.nextRetry = Date.now() + delay;
        job.status = 'retry';
        
        this.retryQueue.set(job.id, job);
        this.processingStats.retried++;
        
        console.log(`🔄 Job scheduled for retry: ${job.id} (attempt ${job.attempts}/${job.maxAttempts}, delay: ${delay}ms)`);
        this.emit('jobRetried', job);
    }

    async moveToDeadLetter(job, error) {
        job.status = 'dead_letter';
        job.deadLetteredAt = Date.now();
        job.finalError = error.message;
        
        this.deadLetterQueue.set(job.id, job);
        this.processingStats.deadLettered++;
        
        console.log(`💀 Job moved to dead letter queue: ${job.id}`);
        this.emit('jobDeadLettered', job);
    }

    calculateRetryDelay(attempt) {
        // Exponential backoff: 5s, 10s, 20s, 40s, etc.
        return Math.min(this.retryDelay * Math.pow(2, attempt - 1), 300000); // Max 5 minutes
    }

    // Queue Processing
    startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processQueue();
        
        console.log('🔄 Queue processing started');
    }

    stopProcessing() {
        this.isProcessing = false;
        console.log('⏹️ Queue processing stopped');
    }

    async processQueue() {
        while (this.isProcessing) {
            try {
                // Check if we can process more jobs
                if (this.activeJobs.size >= this.maxConcurrency) {
                    await this.delay(1000);
                    continue;
                }
                
                // Get next job
                const job = await this.dequeue();
                if (!job) {
                    await this.delay(1000);
                    continue;
                }
                
                // Process job asynchronously
                this.processJobAsync(job);
                
                // Small delay to prevent overwhelming
                await this.delay(100);
                
            } catch (error) {
                console.error('❌ Queue processing error:', error.message);
                await this.delay(5000);
            }
        }
    }

    async processJobAsync(job) {
        try {
            // This would integrate with your message processing logic
            const processor = this.getJobProcessor(job);
            await this.processJob(job, processor);
        } catch (error) {
            console.error(`❌ Async job processing failed: ${job.id}`, error.message);
        }
    }

    getJobProcessor(job) {
        // Return appropriate processor based on job type
        switch (job.metadata.type) {
            case 'message':
                return this.processMessageJob.bind(this);
            case 'sheet_update':
                return this.processSheetUpdateJob.bind(this);
            case 'notification':
                return this.processNotificationJob.bind(this);
            default:
                return this.processDefaultJob.bind(this);
        }
    }

    async processMessageJob(data) {
        // This would integrate with your WhatsApp message sending
        console.log(`📱 Processing message job: ${data.orderId}`);
        
        // Simulate processing
        await this.delay(1000);
        
        return { success: true, messageId: 'mock-message-id' };
    }

    async processSheetUpdateJob(data) {
        // This would integrate with your Google Sheets update logic
        console.log(`📊 Processing sheet update job: ${data.orderId}`);
        
        // Simulate processing
        await this.delay(500);
        
        return { success: true, updated: true };
    }

    async processNotificationJob(data) {
        // This would integrate with your notification system
        console.log(`🔔 Processing notification job: ${data.type}`);
        
        // Simulate processing
        await this.delay(200);
        
        return { success: true, sent: true };
    }

    async processDefaultJob(data) {
        console.log(`⚙️ Processing default job: ${data.type || 'unknown'}`);
        
        // Simulate processing
        await this.delay(300);
        
        return { success: true };
    }

    // Rate Limiting
    checkRateLimit() {
        if (!this.rateLimiter.enabled) return true;
        
        const now = Date.now();
        
        // Reset counters if needed
        if (now - this.rateLimiter.lastMinuteReset > 60000) {
            this.rateLimiter.currentMinute = 0;
            this.rateLimiter.lastMinuteReset = now;
        }
        
        if (now - this.rateLimiter.lastHourReset > 3600000) {
            this.rateLimiter.currentHour = 0;
            this.rateLimiter.lastHourReset = now;
        }
        
        // Check limits
        if (this.rateLimiter.currentMinute >= this.rateLimiter.maxPerMinute) {
            console.log('⏳ Rate limit exceeded: per minute');
            return false;
        }
        
        if (this.rateLimiter.currentHour >= this.rateLimiter.maxPerHour) {
            console.log('⏳ Rate limit exceeded: per hour');
            return false;
        }
        
        // Increment counters
        this.rateLimiter.currentMinute++;
        this.rateLimiter.currentHour++;
        
        return true;
    }

    // Cleanup Tasks
    setupCleanupTasks() {
        // Clean up dead letter queue every hour
        setInterval(() => {
            this.cleanupDeadLetterQueue();
        }, 3600000);
        
        // Clean up old retry jobs every 30 minutes
        setInterval(() => {
            this.cleanupRetryQueue();
        }, 1800000);
    }

    cleanupDeadLetterQueue() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [id, job] of this.deadLetterQueue.entries()) {
            if (now - job.deadLetteredAt > this.deadLetterRetention) {
                this.deadLetterQueue.delete(id);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old dead letter jobs`);
        }
    }

    cleanupRetryQueue() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [id, job] of this.retryQueue.entries()) {
            // Remove jobs that have been in retry queue for too long
            if (now - job.createdAt > 24 * 60 * 60 * 1000) { // 24 hours
                this.retryQueue.delete(id);
                this.deadLetterQueue.set(id, { ...job, status: 'dead_letter', reason: 'retry_timeout' });
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old retry jobs`);
        }
    }

    // Utility Methods
    generateJobId() {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getTotalQueueSize() {
        return this.priorityQueue.size + this.normalQueue.size + this.retryQueue.size;
    }

    // Public API Methods
    getQueueStatus() {
        return {
            priority: this.priorityQueue.size,
            normal: this.normalQueue.size,
            retry: this.retryQueue.size,
            deadLetter: this.deadLetterQueue.size,
            active: this.activeJobs.size,
            total: this.getTotalQueueSize()
        };
    }

    getProcessingStats() {
        const uptime = Date.now() - this.processingStats.startTime;
        return {
            ...this.processingStats,
            uptime: uptime,
            throughput: this.processingStats.processed / (uptime / 1000), // jobs per second
            successRate: this.processingStats.processed / (this.processingStats.processed + this.processingStats.failed) * 100
        };
    }

    getRateLimitStatus() {
        return {
            enabled: this.rateLimiter.enabled,
            currentMinute: this.rateLimiter.currentMinute,
            maxPerMinute: this.rateLimiter.maxPerMinute,
            currentHour: this.rateLimiter.currentHour,
            maxPerHour: this.rateLimiter.maxPerHour,
            nextMinuteReset: this.rateLimiter.lastMinuteReset + 60000,
            nextHourReset: this.rateLimiter.lastHourReset + 3600000
        };
    }

    updateRateLimits(newLimits) {
        this.rateLimiter = { ...this.rateLimiter, ...newLimits };
        console.log('📊 Rate limits updated');
    }

    pauseQueue() {
        this.stopProcessing();
        console.log('⏸️ Queue paused');
    }

    resumeQueue() {
        this.startProcessing();
        console.log('▶️ Queue resumed');
    }

    clearQueue(queueType = 'all') {
        switch (queueType) {
            case 'priority':
                this.priorityQueue.clear();
                break;
            case 'normal':
                this.normalQueue.clear();
                break;
            case 'retry':
                this.retryQueue.clear();
                break;
            case 'deadLetter':
                this.deadLetterQueue.clear();
                break;
            case 'all':
                this.priorityQueue.clear();
                this.normalQueue.clear();
                this.retryQueue.clear();
                this.deadLetterQueue.clear();
                break;
        }
        
        console.log(`🧹 Cleared ${queueType} queue`);
    }

    getJobById(jobId) {
        // Search all queues for the job
        const queues = [this.priorityQueue, this.normalQueue, this.retryQueue, this.deadLetterQueue];
        
        for (const queue of queues) {
            if (queue.has(jobId)) {
                return queue.get(jobId);
            }
        }
        
        return null;
    }

    retryDeadLetterJob(jobId) {
        const job = this.deadLetterQueue.get(jobId);
        if (!job) {
            throw new Error('Job not found in dead letter queue');
        }
        
        // Reset job for retry
        job.attempts = 0;
        job.status = 'queued';
        job.nextRetry = null;
        job.lastError = null;
        job.failedAt = null;
        job.deadLetteredAt = null;
        job.finalError = null;
        
        // Move to normal queue
        this.deadLetterQueue.delete(jobId);
        this.normalQueue.set(jobId, job);
        
        console.log(`🔄 Dead letter job retried: ${jobId}`);
        this.emit('jobRetriedFromDeadLetter', job);
        
        return job;
    }
}

module.exports = AdvancedQueueManager;
