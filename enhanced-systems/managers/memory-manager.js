const fs = require('fs').promises;
const path = require('path');

/**
 * Advanced Memory Manager
 * 
 * Features:
 * - Real-time memory monitoring
 * - Automatic garbage collection triggers
 * - Memory leak detection
 * - Performance optimization
 * - Memory usage analytics
 * - Automatic cleanup of old data
 */
class MemoryManager {
    constructor(options = {}) {
        this.monitoringInterval = options.monitoringInterval || 30000; // 30 seconds
        this.gcThreshold = options.gcThreshold || 80; // 80% memory usage
        this.leakDetectionThreshold = options.leakThreshold || 100; // 100MB increase
        this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
        
        this.memoryHistory = [];
        this.leakDetection = {
            enabled: true,
            baseline: 0,
            lastCheck: Date.now(),
            increaseCount: 0
        };
        
        this.cleanupTasks = [];
        this.performanceMetrics = {
            gcCount: 0,
            cleanupCount: 0,
            memorySaved: 0,
            lastOptimization: null
        };
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Get initial memory baseline
            this.leakDetection.baseline = this.getCurrentMemoryUsage();
            
            // Start monitoring
            this.startMonitoring();
            this.startCleanupTasks();
            
            console.log('✅ Memory Manager initialized');
            console.log(`📊 Memory baseline: ${this.formatBytes(this.leakDetection.baseline)}`);
            console.log(`🧹 GC threshold: ${this.gcThreshold}%`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Memory Manager:', error.message);
        }
    }

    startMonitoring() {
        // Monitor memory every 30 seconds
        setInterval(() => {
            this.monitorMemory();
        }, this.monitoringInterval);

        console.log('🔄 Memory monitoring started');
    }

    startCleanupTasks() {
        // Run cleanup every 5 minutes
        setInterval(() => {
            this.performCleanup();
        }, this.cleanupInterval);

        console.log('🧹 Cleanup tasks scheduled');
    }

    monitorMemory() {
        try {
            const memUsage = process.memoryUsage();
            const timestamp = Date.now();
            
            const memoryData = {
                timestamp: timestamp,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                usagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
            };
            
            // Store in history
            this.memoryHistory.push(memoryData);
            
            // Keep only last 100 readings
            if (this.memoryHistory.length > 100) {
                this.memoryHistory = this.memoryHistory.slice(-100);
            }
            
            // Check for memory leaks
            this.detectMemoryLeaks(memoryData);
            
            // Check if garbage collection is needed
            if (memoryData.usagePercent > this.gcThreshold) {
                this.triggerGarbageCollection();
            }
            
            // Log memory status
            if (memoryData.usagePercent > 70) {
                console.log(`⚠️ High memory usage: ${memoryData.usagePercent.toFixed(1)}% (${this.formatBytes(memoryData.heapUsed)})`);
            }
            
        } catch (error) {
            console.error('❌ Memory monitoring failed:', error.message);
        }
    }

    detectMemoryLeaks(memoryData) {
        if (!this.leakDetection.enabled) return;
        
        const currentUsage = memoryData.heapUsed;
        const timeSinceLastCheck = Date.now() - this.leakDetection.lastCheck;
        
        // Check every 5 minutes
        if (timeSinceLastCheck < 300000) return;
        
        const increase = currentUsage - this.leakDetection.baseline;
        
        if (increase > this.leakDetectionThreshold * 1024 * 1024) { // Convert MB to bytes
            this.leakDetection.increaseCount++;
            
            console.log(`🚨 Potential memory leak detected!`);
            console.log(`📊 Memory increased by ${this.formatBytes(increase)} since baseline`);
            console.log(`📈 Current usage: ${this.formatBytes(currentUsage)}`);
            
            if (this.leakDetection.increaseCount >= 3) {
                console.log(`🔴 Memory leak confirmed! Taking action...`);
                this.handleMemoryLeak();
            }
        } else {
            // Reset counter if memory usage is stable
            this.leakDetection.increaseCount = 0;
        }
        
        this.leakDetection.lastCheck = Date.now();
    }

    handleMemoryLeak() {
        console.log('🛠️ Handling memory leak...');
        
        // Force garbage collection
        this.triggerGarbageCollection();
        
        // Clear caches
        this.clearCaches();
        
        // Reset baseline
        this.leakDetection.baseline = this.getCurrentMemoryUsage();
        this.leakDetection.increaseCount = 0;
        
        console.log('✅ Memory leak handling completed');
    }

    triggerGarbageCollection() {
        try {
            if (global.gc) {
                const beforeGC = this.getCurrentMemoryUsage();
                global.gc();
                const afterGC = this.getCurrentMemoryUsage();
                const saved = beforeGC - afterGC;
                
                this.performanceMetrics.gcCount++;
                this.performanceMetrics.memorySaved += saved;
                this.performanceMetrics.lastOptimization = new Date().toISOString();
                
                console.log(`🧹 Garbage collection completed - saved ${this.formatBytes(saved)}`);
            } else {
                console.log('⚠️ Garbage collection not available (run with --expose-gc flag)');
            }
        } catch (error) {
            console.error('❌ Garbage collection failed:', error.message);
        }
    }

    clearCaches() {
        try {
            // Clear template cache
            if (global.messageTemplates && global.messageTemplates.clearTemplateCache) {
                global.messageTemplates.clearTemplateCache();
            }
            
            // Clear duplicate prevention cache
            if (global.duplicateManager && global.duplicateManager.clearCache) {
                global.duplicateManager.clearCache();
            }
            
            // Clear any other caches
            this.clearCustomCaches();
            
            console.log('🧹 Caches cleared');
            
        } catch (error) {
            console.error('❌ Cache clearing failed:', error.message);
        }
    }

    clearCustomCaches() {
        // Clear any custom caches you might have
        // This is where you'd add your specific cache clearing logic
    }

    performCleanup() {
        try {
            console.log('🧹 Performing memory cleanup...');
            
            // Clean up old memory history
            this.cleanupMemoryHistory();
            
            // Clean up old logs
            this.cleanupOldLogs();
            
            // Clean up temporary files
            this.cleanupTempFiles();
            
            // Clean up old data
            this.cleanupOldData();
            
            this.performanceMetrics.cleanupCount++;
            
            console.log('✅ Memory cleanup completed');
            
        } catch (error) {
            console.error('❌ Memory cleanup failed:', error.message);
        }
    }

    cleanupMemoryHistory() {
        // Keep only last 50 readings
        if (this.memoryHistory.length > 50) {
            this.memoryHistory = this.memoryHistory.slice(-50);
        }
    }

    async cleanupOldLogs() {
        try {
            const logDir = path.join(__dirname, 'logs');
            const files = await fs.readdir(logDir);
            
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep logs for 7 days
            
            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(logDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.birthtime < cutoffDate) {
                        await fs.unlink(filePath);
                        console.log(`🗑️ Deleted old log file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Log cleanup failed:', error.message);
        }
    }

    async cleanupTempFiles() {
        try {
            const tempDir = path.join(__dirname, 'temp');
            
            if (await fs.access(tempDir).then(() => true).catch(() => false)) {
                const files = await fs.readdir(tempDir);
                
                for (const file of files) {
                    const filePath = path.join(tempDir, file);
                    const stats = await fs.stat(filePath);
                    
                    // Delete files older than 1 hour
                    if (Date.now() - stats.birthtime.getTime() > 3600000) {
                        await fs.unlink(filePath);
                        console.log(`🗑️ Deleted temp file: ${file}`);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Temp file cleanup failed:', error.message);
        }
    }

    cleanupOldData() {
        // Clean up old data from various managers
        // This would integrate with your existing cleanup methods
        
        // Example: Clean up old duplicate prevention data
        if (global.duplicateManager && global.duplicateManager.performCleanup) {
            global.duplicateManager.performCleanup();
        }
        
        // Example: Clean up old safety manager data
        if (global.safetyManager && global.safetyManager.cleanupOldData) {
            global.safetyManager.cleanupOldData();
        }
    }

    getCurrentMemoryUsage() {
        return process.memoryUsage().heapUsed;
    }

    getMemoryStats() {
        const memUsage = process.memoryUsage();
        const currentUsage = this.getCurrentMemoryUsage();
        
        return {
            current: {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                usagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
            },
            history: {
                readings: this.memoryHistory.length,
                averageUsage: this.calculateAverageUsage(),
                peakUsage: this.getPeakUsage(),
                trend: this.calculateMemoryTrend()
            },
            leakDetection: {
                enabled: this.leakDetection.enabled,
                baseline: this.leakDetection.baseline,
                increaseCount: this.leakDetection.increaseCount,
                currentIncrease: currentUsage - this.leakDetection.baseline
            },
            performance: this.performanceMetrics
        };
    }

    calculateAverageUsage() {
        if (this.memoryHistory.length === 0) return 0;
        
        const sum = this.memoryHistory.reduce((acc, reading) => acc + reading.heapUsed, 0);
        return sum / this.memoryHistory.length;
    }

    getPeakUsage() {
        if (this.memoryHistory.length === 0) return 0;
        
        return Math.max(...this.memoryHistory.map(reading => reading.heapUsed));
    }

    calculateMemoryTrend() {
        if (this.memoryHistory.length < 10) return 'insufficient_data';
        
        const recent = this.memoryHistory.slice(-10);
        const older = this.memoryHistory.slice(-20, -10);
        
        if (recent.length === 0 || older.length === 0) return 'insufficient_data';
        
        const recentAvg = recent.reduce((sum, r) => sum + r.heapUsed, 0) / recent.length;
        const olderAvg = older.reduce((sum, r) => sum + r.heapUsed, 0) / older.length;
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Public API methods
    addCleanupTask(task) {
        this.cleanupTasks.push(task);
        console.log('✅ Cleanup task added');
    }

    removeCleanupTask(taskId) {
        this.cleanupTasks = this.cleanupTasks.filter(task => task.id !== taskId);
        console.log('✅ Cleanup task removed');
    }

    updateThresholds(newThresholds) {
        if (newThresholds.gcThreshold) {
            this.gcThreshold = newThresholds.gcThreshold;
        }
        if (newThresholds.leakThreshold) {
            this.leakDetectionThreshold = newThresholds.leakThreshold;
        }
        
        console.log('📊 Memory thresholds updated');
    }

    enableLeakDetection() {
        this.leakDetection.enabled = true;
        this.leakDetection.baseline = this.getCurrentMemoryUsage();
        console.log('🔍 Memory leak detection enabled');
    }

    disableLeakDetection() {
        this.leakDetection.enabled = false;
        console.log('🔍 Memory leak detection disabled');
    }

    forceCleanup() {
        console.log('🧹 Forcing memory cleanup...');
        this.performCleanup();
        this.triggerGarbageCollection();
        console.log('✅ Forced cleanup completed');
    }

    getOptimizationRecommendations() {
        const stats = this.getMemoryStats();
        const recommendations = [];
        
        if (stats.current.usagePercent > 80) {
            recommendations.push('High memory usage detected - consider restarting the application');
        }
        
        if (stats.leakDetection.increaseCount > 0) {
            recommendations.push('Memory leak detected - investigate and fix memory leaks');
        }
        
        if (stats.history.trend === 'increasing') {
            recommendations.push('Memory usage is increasing - monitor for potential issues');
        }
        
        if (stats.performance.gcCount === 0) {
            recommendations.push('Garbage collection not running - consider enabling --expose-gc flag');
        }
        
        return recommendations;
    }
}

module.exports = MemoryManager;
