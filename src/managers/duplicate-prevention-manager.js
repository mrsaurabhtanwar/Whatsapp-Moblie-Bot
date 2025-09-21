const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const DeveloperConfig = require('../config/developer-config');

/**
 * Comprehensive Duplicate Prevention Manager
 * 
 * This class handles all aspects of duplicate message prevention across:
 * - Multiple bot instances (consolidated bot system)
 * - Different message types (welcome, confirmation, ready, delivery, reminders)
 * - Various order types (tailor, fabric, combined)
 * - Restart persistence and cross-instance synchronization
 * 
 * Features:
 * - File-based storage for persistence across restarts
 * - Message content hashing to detect identical messages
 * - Customer-based rate limiting and cooldowns
 * - Google Sheets integration for status tracking
 * - Cross-instance synchronization via shared files
 * - Comprehensive logging and debugging
 */
class DuplicatePreventionManager {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(__dirname, '../../data/duplicate-prevention-data');
        this.maxMessagesPerCustomerPerDay = options.maxMessagesPerDay || 5;
        this.messageCooldownMs = options.messageCooldownMs || 300000; // 5 minutes
        this.duplicateCheckWindowMs = options.duplicateCheckWindowMs || 24 * 60 * 60 * 1000; // 24 hours
        this.cleanupIntervalMs = options.cleanupIntervalMs || 60 * 60 * 1000; // 1 hour
        
        // Developer configuration
        this.developerConfig = new DeveloperConfig();
        
        // File paths for persistence
        this.sentMessagesFile = path.join(this.dataDir, 'sent-messages.json');
        this.customerHistoryFile = path.join(this.dataDir, 'customer-history.json');
        this.messageHashesFile = path.join(this.dataDir, 'message-hashes.json');
        this.statisticsFile = path.join(this.dataDir, 'statistics.json');
        
        // In-memory caches for performance
        this.sentMessages = new Map();
        this.customerHistory = new Map();
        this.messageHashes = new Map();
        this.statistics = {
            totalMessagesSent: 0,
            duplicatesBlocked: 0,
            rateLimitBlocked: 0,
            cooldownBlocked: 0,
            contentDuplicatesBlocked: 0,
            lastCleanup: Date.now()
        };
        
        // Initialize
        this.initializeAsync();
        
        // Setup periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, this.cleanupIntervalMs);
        
        // Setup periodic sync
        this.syncInterval = setInterval(() => {
            this.syncToFile();
        }, 30000); // Sync every 30 seconds
    }

    /**
     * Check if a phone number is in the developer whitelist
     * @param {string} phone - Phone number to check
     * @returns {boolean} - True if phone is whitelisted
     */
    isDeveloperPhone(phone) {
        return this.developerConfig.isDeveloperPhone(phone);
    }

    async initializeAsync() {
        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Load existing data
            await this.loadFromFiles();
            
            console.log('✅ Duplicate Prevention Manager initialized');
            console.log(`📊 Loaded: ${this.sentMessages.size} sent messages, ${this.customerHistory.size} customer histories, ${this.messageHashes.size} content hashes`);
        } catch (error) {
            console.error('❌ Failed to initialize Duplicate Prevention Manager:', error.message);
        }
    }

    /**
     * Main duplicate check function - checks all possible duplicate scenarios
     * 
     * @param {string} customerPhone - Customer phone number (normalized)
     * @param {string} orderId - Order ID
     * @param {string} messageType - Type of message (welcome, confirmation, ready, etc.)
     * @param {string} messageContent - Actual message content
     * @param {Object} orderData - Full order data for context
     * @param {string} sheetType - Sheet type (tailor, fabric, combined)
     * @returns {Object} - {allowed: boolean, reason: string, duplicateType: string}
     */
    async checkDuplicate(customerPhone, orderId, messageType, messageContent, orderData = {}, sheetType = 'tailor') {
        try {
            const now = Date.now();
            const normalizedPhone = this.normalizePhoneNumber(customerPhone);
            
            if (!normalizedPhone) {
                return { allowed: false, reason: 'Invalid phone number', duplicateType: 'INVALID_PHONE' };
            }

            // Check if this is a developer phone - bypass all duplicate checks
            if (this.isDeveloperPhone(normalizedPhone)) {
                console.log(`🔓 [DUPLICATE] Developer phone ${normalizedPhone} - bypassing all duplicate checks`);
                return { 
                    allowed: true, 
                    reason: 'Developer phone - duplicate checks bypassed', 
                    duplicateType: 'DEVELOPER_BYPASS' 
                };
            }

            // Generate unique identifiers
            const messageKey = this.generateMessageKey(normalizedPhone, orderId, messageType, sheetType);
            const contentHash = this.generateContentHash(messageContent);
            const customerKey = normalizedPhone;

            console.log(`🔍 Checking duplicate for: ${messageKey}`);

            // 1. Check if exact same message (phone + order + type) already sent
            if (this.sentMessages.has(messageKey)) {
                const sentData = this.sentMessages.get(messageKey);
                const timeSinceSent = now - sentData.timestamp;
                
                // Allow resend after 24 hours for reminders
                if (messageType.includes('reminder') && timeSinceSent > this.duplicateCheckWindowMs) {
                    console.log(`🔄 Allowing reminder resend after 24 hours: ${messageKey}`);
                } else {
                    this.statistics.duplicatesBlocked++;
                    return { 
                        allowed: false, 
                        reason: `Message already sent ${this.formatTimeAgo(timeSinceSent)} ago`, 
                        duplicateType: 'EXACT_MESSAGE_DUPLICATE',
                        lastSent: sentData.timestamp
                    };
                }
            }

            // 2. Check if identical content already sent to this customer (regardless of order/type)
            if (this.messageHashes.has(contentHash)) {
                const hashData = this.messageHashes.get(contentHash);
                if (hashData.customers.includes(normalizedPhone)) {
                    const lastSentToCustomer = hashData.customerTimestamps[normalizedPhone];
                    const timeSinceSent = now - lastSentToCustomer;
                    
                    if (timeSinceSent < this.duplicateCheckWindowMs) {
                        this.statistics.contentDuplicatesBlocked++;
                        return { 
                            allowed: false, 
                            reason: `Identical content already sent ${this.formatTimeAgo(timeSinceSent)} ago`, 
                            duplicateType: 'CONTENT_DUPLICATE',
                            lastSent: lastSentToCustomer
                        };
                    }
                }
            }

            // 3. Check customer message history for rate limiting
            if (this.customerHistory.has(customerKey)) {
                const history = this.customerHistory.get(customerKey);
                const recentMessages = history.filter(msg => (now - msg.timestamp) < this.duplicateCheckWindowMs);

                // Check daily message limit
                if (recentMessages.length >= this.maxMessagesPerCustomerPerDay) {
                    this.statistics.rateLimitBlocked++;
                    return { 
                        allowed: false, 
                        reason: `Daily message limit reached (${recentMessages.length}/${this.maxMessagesPerCustomerPerDay})`, 
                        duplicateType: 'RATE_LIMIT',
                        messagesInWindow: recentMessages.length
                    };
                }

                // Check cooldown period (last message)
                if (recentMessages.length > 0) {
                    const lastMessage = recentMessages[recentMessages.length - 1];
                    const timeSinceLastMessage = now - lastMessage.timestamp;
                    
                    if (timeSinceLastMessage < this.messageCooldownMs) {
                        this.statistics.cooldownBlocked++;
                        const remainingCooldown = this.messageCooldownMs - timeSinceLastMessage;
                        return { 
                            allowed: false, 
                            reason: `Cooldown active (${this.formatDuration(remainingCooldown)} remaining)`, 
                            duplicateType: 'COOLDOWN',
                            remainingCooldownMs: remainingCooldown
                        };
                    }
                }

                // Check for similar messages in recent history
                const similarMessage = recentMessages.find(msg => 
                    msg.orderId === orderId && 
                    msg.messageType === messageType &&
                    msg.sheetType === sheetType
                );
                
                if (similarMessage) {
                    const timeSinceSimilar = now - similarMessage.timestamp;
                    this.statistics.duplicatesBlocked++;
                    return { 
                        allowed: false, 
                        reason: `Similar message (${messageType}) already sent ${this.formatTimeAgo(timeSinceSimilar)} ago for order ${orderId}`, 
                        duplicateType: 'SIMILAR_MESSAGE',
                        lastSent: similarMessage.timestamp
                    };
                }
            }

            // 4. Check for conflicting message types (e.g., don't send ready if already delivered)
            const conflictCheck = this.checkMessageTypeConflicts(normalizedPhone, orderId, messageType, orderData);
            if (!conflictCheck.allowed) {
                return conflictCheck;
            }

            // All checks passed - message is allowed
            console.log(`✅ Message allowed: ${messageKey}`);
            return { 
                allowed: true, 
                reason: 'All duplicate checks passed', 
                duplicateType: 'NONE'
            };

        } catch (error) {
            console.error('❌ Error in duplicate check:', error.message);
            // On error, allow message but log the issue
            return { 
                allowed: true, 
                reason: `Duplicate check failed: ${error.message}`, 
                duplicateType: 'ERROR'
            };
        }
    }

    /**
     * Record that a message was successfully sent
     */
    async recordMessageSent(customerPhone, orderId, messageType, messageContent, orderData = {}, sheetType = 'tailor') {
        try {
            const now = Date.now();
            const normalizedPhone = this.normalizePhoneNumber(customerPhone);
            
            if (!normalizedPhone) {
                console.error('❌ Cannot record message: Invalid phone number');
                return;
            }

            const messageKey = this.generateMessageKey(normalizedPhone, orderId, messageType, sheetType);
            const contentHash = this.generateContentHash(messageContent);
            const customerKey = normalizedPhone;

            // Record in sent messages
            this.sentMessages.set(messageKey, {
                customerPhone: normalizedPhone,
                orderId,
                messageType,
                sheetType,
                contentHash,
                timestamp: now,
                orderData: this.sanitizeOrderData(orderData)
            });

            // Record content hash
            if (!this.messageHashes.has(contentHash)) {
                this.messageHashes.set(contentHash, {
                    content: messageContent.substring(0, 100) + '...', // Store preview only
                    customers: [],
                    customerTimestamps: {}
                });
            }
            const hashData = this.messageHashes.get(contentHash);
            if (!hashData.customers.includes(normalizedPhone)) {
                hashData.customers.push(normalizedPhone);
            }
            hashData.customerTimestamps[normalizedPhone] = now;

            // Record in customer history
            if (!this.customerHistory.has(customerKey)) {
                this.customerHistory.set(customerKey, []);
            }
            const history = this.customerHistory.get(customerKey);
            history.push({
                orderId,
                messageType,
                sheetType,
                contentHash,
                timestamp: now
            });

            // Keep only recent history
            const recentHistory = history.filter(msg => (now - msg.timestamp) < this.duplicateCheckWindowMs);
            this.customerHistory.set(customerKey, recentHistory);

            // Update statistics
            this.statistics.totalMessagesSent++;

            console.log(`📝 Recorded message sent: ${messageKey}`);

            // Async file sync (don't await to avoid blocking)
            this.syncToFile().catch(error => {
                console.error('❌ Failed to sync message record to file:', error.message);
            });

        } catch (error) {
            console.error('❌ Error recording message:', error.message);
        }
    }

    /**
     * Check for message type conflicts (business logic)
     */
    checkMessageTypeConflicts(customerPhone, orderId, messageType, orderData) {
        try {
            const customerHistory = this.customerHistory.get(customerPhone) || [];
            const orderHistory = customerHistory.filter(msg => msg.orderId === orderId);

            // Define message type hierarchy
            const messageHierarchy = {
                'welcome': 1,
                'confirmation': 2,
                'ready': 3,
                'pickup_reminder': 4,
                'delivered': 5,
                'delivery_notification': 5,
                'payment_reminder': 6
            };

            const currentLevel = messageHierarchy[messageType] || 0;

            // Check if a higher-level message has already been sent
            for (const historyMsg of orderHistory) {
                const historyLevel = messageHierarchy[historyMsg.messageType] || 0;
                
                // Don't send lower-level messages if higher-level already sent
                if (historyLevel > currentLevel) {
                    return {
                        allowed: false,
                        reason: `Cannot send ${messageType} after ${historyMsg.messageType} has been sent`,
                        duplicateType: 'MESSAGE_HIERARCHY_CONFLICT'
                    };
                }
            }

            return { allowed: true };

        } catch (error) {
            console.error('❌ Error in message conflict check:', error.message);
            return { allowed: true }; // Allow on error
        }
    }

    /**
     * Generate unique message key with improved collision resistance
     * IDEMPOTENCY FIX: Enhanced key generation using SHA-256 hash
     */
    generateMessageKey(customerPhone, orderId, messageType, sheetType, contentHash = '') {
        // Create a composite key with clear delimiters to prevent collisions
        // Using content hash instead of timestamp for true idempotency
        const compositeData = `${customerPhone}:${orderId}:${messageType}:${sheetType}:${contentHash}`;
        
        // Generate SHA-256 hash for collision resistance while maintaining idempotency
        const idempotencyKey = crypto.createHash('sha256')
            .update(compositeData)
            .digest('hex');
            
        return idempotencyKey;
    }

    /**
     * Generate content hash for duplicate content detection
     */
    generateContentHash(content) {
        return crypto.createHash('sha256').update(content.toLowerCase().trim()).digest('hex').substring(0, 16);
    }

    /**
     * Normalize phone number to consistent format
     */
    normalizePhoneNumber(phone) {
        if (!phone) return null;
        
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        
        // Validate length
        if (digits.length < 10 || digits.length > 15) {
            return null;
        }
        
        // Normalize to Indian format
        if (digits.length === 10) {
            return '91' + digits;
        } else if (digits.length === 11 && digits.startsWith('0')) {
            return '91' + digits.substring(1);
        } else if (digits.length === 13 && digits.startsWith('+91')) {
            return digits.substring(1);
        } else if (digits.startsWith('91') && digits.length === 12) {
            return digits;
        }
        
        return digits; // Return as-is if can't normalize
    }

    /**
     * Sanitize order data for storage (remove sensitive info, limit size)
     */
    sanitizeOrderData(orderData) {
        if (!orderData || typeof orderData !== 'object') return {};
        
        const sanitized = {};
        const allowedFields = [
            'order_id', 'customer_name', 'garment_type', 'fabric_type', 
            'total_amount', 'advance_amount', 'remaining_amount', 'delivery_date', 'status'
        ];
        
        for (const field of allowedFields) {
            if (orderData[field]) {
                sanitized[field] = String(orderData[field]).substring(0, 100); // Limit field length
            }
        }
        
        return sanitized;
    }

    /**
     * Load data from persistent files
     */
    async loadFromFiles() {
        try {
            // Load sent messages
            try {
                const sentData = await fs.readFile(this.sentMessagesFile, 'utf8');
                const sentArray = JSON.parse(sentData);
                this.sentMessages = new Map(sentArray);
                console.log(`📁 Loaded ${this.sentMessages.size} sent messages from file`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn('⚠️ Error loading sent messages:', error.message);
                }
            }

            // Load customer history
            try {
                const historyData = await fs.readFile(this.customerHistoryFile, 'utf8');
                const historyArray = JSON.parse(historyData);
                this.customerHistory = new Map(historyArray);
                console.log(`📁 Loaded ${this.customerHistory.size} customer histories from file`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn('⚠️ Error loading customer history:', error.message);
                }
            }

            // Load message hashes
            try {
                const hashData = await fs.readFile(this.messageHashesFile, 'utf8');
                const hashArray = JSON.parse(hashData);
                this.messageHashes = new Map(hashArray);
                console.log(`📁 Loaded ${this.messageHashes.size} message hashes from file`);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn('⚠️ Error loading message hashes:', error.message);
                }
            }

            // Load statistics
            try {
                const statsData = await fs.readFile(this.statisticsFile, 'utf8');
                this.statistics = { ...this.statistics, ...JSON.parse(statsData) };
                console.log('📁 Loaded statistics from file');
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.warn('⚠️ Error loading statistics:', error.message);
                }
            }

        } catch (error) {
            console.error('❌ Error loading from files:', error.message);
        }
    }

    /**
     * Sync data to persistent files
     */
    async syncToFile() {
        try {
            // Convert Maps to arrays for JSON serialization
            const sentArray = Array.from(this.sentMessages.entries());
            const historyArray = Array.from(this.customerHistory.entries());
            const hashArray = Array.from(this.messageHashes.entries());

            // Write files concurrently
            await Promise.all([
                fs.writeFile(this.sentMessagesFile, JSON.stringify(sentArray, null, 2)),
                fs.writeFile(this.customerHistoryFile, JSON.stringify(historyArray, null, 2)),
                fs.writeFile(this.messageHashesFile, JSON.stringify(hashArray, null, 2)),
                fs.writeFile(this.statisticsFile, JSON.stringify(this.statistics, null, 2))
            ]);

            console.log('💾 Data synced to files successfully');

        } catch (error) {
            console.error('❌ Error syncing to files:', error.message);
        }
    }

    /**
     * Perform cleanup of old data
     */
    async performCleanup() {
        try {
            const now = Date.now();
            let cleanedCount = 0;

            // Clean up old sent messages
            for (const [key, data] of this.sentMessages.entries()) {
                if ((now - data.timestamp) > this.duplicateCheckWindowMs * 7) { // Keep for 7 days
                    this.sentMessages.delete(key);
                    cleanedCount++;
                }
            }

            // Clean up old customer history
            for (const [customerKey, history] of this.customerHistory.entries()) {
                const recentHistory = history.filter(msg => (now - msg.timestamp) < this.duplicateCheckWindowMs * 2); // Keep for 2 days
                if (recentHistory.length === 0) {
                    this.customerHistory.delete(customerKey);
                    cleanedCount++;
                } else if (recentHistory.length < history.length) {
                    this.customerHistory.set(customerKey, recentHistory);
                    cleanedCount += (history.length - recentHistory.length);
                }
            }

            // Clean up old message hashes
            for (const [hash, data] of this.messageHashes.entries()) {
                const recentCustomers = {};
                let hasRecentCustomers = false;
                
                for (const [customer, timestamp] of Object.entries(data.customerTimestamps)) {
                    if ((now - timestamp) < this.duplicateCheckWindowMs * 2) { // Keep for 2 days
                        recentCustomers[customer] = timestamp;
                        hasRecentCustomers = true;
                    }
                }
                
                if (!hasRecentCustomers) {
                    this.messageHashes.delete(hash);
                    cleanedCount++;
                } else if (Object.keys(recentCustomers).length < Object.keys(data.customerTimestamps).length) {
                    data.customerTimestamps = recentCustomers;
                    data.customers = data.customers.filter(customer => recentCustomers[customer]);
                }
            }

            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} old records`);
                await this.syncToFile();
            }

            this.statistics.lastCleanup = now;

        } catch (error) {
            console.error('❌ Error during cleanup:', error.message);
        }
    }

    /**
     * Get current statistics
     */
    getStatistics() {
        return {
            ...this.statistics,
            currentCounts: {
                sentMessages: this.sentMessages.size,
                customerHistories: this.customerHistory.size,
                messageHashes: this.messageHashes.size
            }
        };
    }

    /**
     * Clear all data (for testing/reset)
     */
    async clearAllData() {
        this.sentMessages.clear();
        this.customerHistory.clear();
        this.messageHashes.clear();
        this.statistics = {
            totalMessagesSent: 0,
            duplicatesBlocked: 0,
            rateLimitBlocked: 0,
            cooldownBlocked: 0,
            contentDuplicatesBlocked: 0,
            lastCleanup: Date.now()
        };
        
        await this.syncToFile();
        console.log('🗑️ All duplicate prevention data cleared');
    }

    /**
     * Format time ago string
     */
    formatTimeAgo(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        return `${seconds} second${seconds > 1 ? 's' : ''}`;
    }

    /**
     * Format duration string
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        }
        return `${seconds}s`;
    }

    /**
     * Get message history for a customer
     */
    getCustomerHistory(customerPhone) {
        const normalizedPhone = this.normalizePhoneNumber(customerPhone);
        if (!normalizedPhone) return null;
        
        return this.customerHistory.get(normalizedPhone) || [];
    }

    /**
     * Check if message was recently sent
     */
    wasMessageRecentlySent(customerPhone, orderId, messageType, sheetType = 'tailor', withinMs = null) {
        const messageKey = this.generateMessageKey(
            this.normalizePhoneNumber(customerPhone), 
            orderId, 
            messageType, 
            sheetType
        );
        
        if (!this.sentMessages.has(messageKey)) return false;
        
        const sentData = this.sentMessages.get(messageKey);
        const timeSinceSent = Date.now() - sentData.timestamp;
        
        return withinMs ? (timeSinceSent < withinMs) : true;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        console.log('🔄 Duplicate Prevention Manager destroyed');
    }
}

module.exports = DuplicatePreventionManager;