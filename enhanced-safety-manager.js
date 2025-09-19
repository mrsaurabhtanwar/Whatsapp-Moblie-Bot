const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3');
const { Database } = require('sqlite3');
const EnhancedLogger = require('./enhanced-logger');

/**
 * Enhanced Safety Manager - Comprehensive Message Sending Protection
 * 
 * This system provides multiple layers of protection to prevent accidental message sending:
 * - 4-minute startup delay with comprehensive validation
 * - Triple-layer duplicate prevention 
 * - Message-specific conditions and rules
 * - Circuit breaker with daily/hourly limits
 * - Kill switch mechanism
 * - Detailed logging and monitoring
 */
class EnhancedSafetyManager {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(__dirname, 'safety-data');
        this.startupTime = Date.now();
        this.isStartupGracePeriod = true;
        this.gracePeriodMs = options.gracePeriodMs || 240000; // 4 minutes
        this.isKillSwitchActive = false;
        this.dbPath = path.join(this.dataDir, 'safety-database.db');
        
        // Circuit breaker limits
        this.dailyLimit = options.dailyLimit || 10;
        this.hourlyLimit = options.hourlyLimit || 3;
        this.similarityThreshold = options.similarityThreshold || 0.8;
        
        // Process isolation
        this.lockFile = path.join(this.dataDir, 'process.lock');
        this.pidFile = path.join(this.dataDir, 'process.pid');
        
        // Enhanced logging system
        this.logger = new EnhancedLogger({
            logDir: path.join(this.dataDir, 'logs'),
            logLevel: options.logLevel || 'INFO'
        });
        
        // Message type specific rules
        this.messageRules = {
            welcome: {
                condition: 'phone + orderId unique AND Welcome Notified = No',
                maxPerDay: 2,
                cooldownMs: 0,
                requiredFields: ['customer_name', 'order_id', 'phone']
            },
            confirmation: {
                condition: 'phone + orderId unique AND Confirmation Notified = No AND Welcome already sent',
                maxPerDay: 2,
                cooldownMs: 180000, // 3 minutes after welcome
                requiredFields: ['customer_name', 'order_id', 'phone', 'garment_type', 'delivery_date']
            },
            ready: {
                condition: 'phone + orderId unique AND Ready Notified = No AND order status = ready',
                maxPerDay: 2,
                cooldownMs: 3600000, // 1 hour
                requiredFields: ['customer_name', 'order_id', 'phone']
            },
            delivery: {
                condition: 'phone + orderId unique AND Delivery Notified = No AND order status = delivered',
                maxPerDay: 1,
                cooldownMs: 0,
                requiredFields: ['customer_name', 'order_id', 'phone']
            },
            pickup_reminder: {
                condition: 'phone + orderId unique AND Ready sent AND days > 2 AND reminder_count < 3',
                maxPerDay: 1,
                cooldownMs: 86400000, // 24 hours between reminders
                requiredFields: ['customer_name', 'order_id', 'phone', 'ready_date']
            },
            payment_reminder: {
                condition: 'phone + orderId unique AND Delivered AND remaining_amount > 0 AND reminder_count < 5',
                maxPerDay: 1,
                cooldownMs: 172800000, // 48 hours between reminders
                requiredFields: ['customer_name', 'order_id', 'phone', 'remaining_amount']
            },
            fabric_welcome: {
                condition: 'phone unique (not in tailor sheet) AND Fabric Welcome Notified = No',
                maxPerDay: 1,
                cooldownMs: 0,
                requiredFields: ['customer_name', 'order_id', 'phone', 'fabric_type']
            },
            fabric_purchase: {
                condition: 'phone + orderId unique AND Fabric Purchase Notified = No',
                maxPerDay: 1,
                cooldownMs: 0,
                requiredFields: ['customer_name', 'order_id', 'phone', 'fabric_type', 'total_amount']
            }
        };
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Log initialization start
            await this.logger.info('Enhanced Safety Manager initialization started', {
                startupTime: this.startupTime,
                gracePeriodMs: this.gracePeriodMs,
                dataDir: this.dataDir,
                dbPath: this.dbPath,
                processId: process.pid,
                nodeVersion: process.version
            });
            
            // Create data directory
            await fs.mkdir(this.dataDir, { recursive: true });
            await this.logger.info('Data directory created/verified', { dataDir: this.dataDir });
            
            // Initialize SQLite database
            await this.initializeDatabase();
            await this.logger.info('SQLite database initialized', { dbPath: this.dbPath });
            
            // Check process isolation
            await this.enforceProcessIsolation();
            await this.logger.info('Process isolation enforced', { 
                lockFile: this.lockFile,
                pidFile: this.pidFile,
                processId: process.pid
            });
            
            // Start startup grace period
            this.startGracePeriod();
            await this.logger.logGracePeriodEvent('GRACE_PERIOD_STARTED', this.gracePeriodMs, {
                startupTime: this.startupTime,
                willExpireAt: this.startupTime + this.gracePeriodMs
            });
            
            console.log('🛡️ Enhanced Safety Manager initialized');
            console.log(`⏰ Startup grace period: ${this.gracePeriodMs / 1000} seconds`);
            console.log(`📋 Message rules loaded: ${Object.keys(this.messageRules).length} types`);
            
            // Log successful initialization with comprehensive details
            await this.logger.info('Enhanced Safety Manager initialization completed successfully', {
                initializationDuration: Date.now() - this.startupTime,
                gracePeriodActive: this.isStartupGracePeriod,
                messageRulesCount: Object.keys(this.messageRules).length,
                messageTypes: Object.keys(this.messageRules),
                circuitBreakerLimits: {
                    daily: this.dailyLimit,
                    hourly: this.hourlyLimit,
                    similarity: this.similarityThreshold
                },
                databaseReady: true,
                loggerReady: true,
                processIsolationActive: true
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced Safety Manager:', error.message);
            
            await this.logger.error('Enhanced Safety Manager initialization failed', {
                error: error.message,
                stack: error.stack,
                initializationAttemptTime: Date.now() - this.startupTime,
                dataDir: this.dataDir,
                dbPath: this.dbPath
            });
            
            throw error;
        }
    }

    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Create tables
                db.serialize(() => {
                    // Message log table
                    db.run(`CREATE TABLE IF NOT EXISTS message_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        phone TEXT NOT NULL,
                        order_id TEXT NOT NULL,
                        message_type TEXT NOT NULL,
                        content_hash TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        success BOOLEAN NOT NULL,
                        error_message TEXT,
                        sheet_updated BOOLEAN DEFAULT FALSE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);
                    
                    // Customer limits table
                    db.run(`CREATE TABLE IF NOT EXISTS customer_limits (
                        phone TEXT PRIMARY KEY,
                        daily_count INTEGER DEFAULT 0,
                        hourly_count INTEGER DEFAULT 0,
                        last_daily_reset INTEGER,
                        last_hourly_reset INTEGER,
                        total_messages INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);
                    
                    // System events table
                    db.run(`CREATE TABLE IF NOT EXISTS system_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_type TEXT NOT NULL,
                        description TEXT,
                        data TEXT,
                        timestamp INTEGER NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);
                    
                    // Create indexes
                    db.run(`CREATE INDEX IF NOT EXISTS idx_message_log_phone_order ON message_log(phone, order_id)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_message_log_timestamp ON message_log(timestamp)`);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_customer_limits_phone ON customer_limits(phone)`);
                });
                
                this.db = db;
                resolve();
            });
        });
    }

    async enforceProcessIsolation() {
        try {
            // Check if lock file exists and process is running
            if (fsSync.existsSync(this.lockFile)) {
                const lockData = JSON.parse(await fs.readFile(this.lockFile, 'utf8'));
                const lockPid = lockData.pid;
                
                try {
                    // Check if process is still running
                    process.kill(lockPid, 0);
                    throw new Error(`Another bot instance is already running (PID: ${lockPid})`);
                } catch (pidError) {
                    // Process not running, remove stale lock
                    await fs.unlink(this.lockFile);
                    console.log('🧹 Removed stale process lock');
                }
            }
            
            // Create new lock
            const lockData = {
                pid: process.pid,
                startTime: this.startupTime,
                hostname: require('os').hostname(),
                timestamp: new Date().toISOString()
            };
            
            await fs.writeFile(this.lockFile, JSON.stringify(lockData, null, 2));
            await fs.writeFile(this.pidFile, process.pid.toString());
            
            console.log(`🔒 Process lock acquired (PID: ${process.pid})`);
            
        } catch (error) {
            console.error('❌ Process isolation check failed:', error.message);
            throw error;
        }
    }

    startGracePeriod() {
        const gracePeriodSeconds = this.gracePeriodMs / 1000;
        console.log(`⏰ Starting ${gracePeriodSeconds} second startup grace period...`);
        console.log('🚫 All message sending is BLOCKED during grace period');
        
        // Log grace period start
        this.logger.logGracePeriodEvent('STARTED', this.gracePeriodMs, {
            startupTime: this.startupTime,
            processId: process.pid
        });
        
        // Check for immediate kill switch activation
        if (process.env.WHATSAPP_KILL_SWITCH === 'true') {
            console.log('🚨 Kill switch detected in environment - activating immediately');
            this.activateKillSwitch('Environment variable WHATSAPP_KILL_SWITCH=true detected');
        }
        
        setTimeout(() => {
            this.isStartupGracePeriod = false;
            console.log('✅ Startup grace period ended - message sending now allowed');
            
            // Log grace period end
            this.logger.logGracePeriodEvent('ENDED', 0, {
                totalDuration: this.gracePeriodMs,
                processId: process.pid
            });
            
            this.logSystemEvent('grace_period_ended', 'Startup grace period completed successfully');
        }, this.gracePeriodMs);
    }

    /**
     * MAIN SAFETY CHECK - All messages must pass through this function
     */
    async canSendMessage(phone, orderId, messageType, messageContent, orderData = {}, sheetData = {}) {
        const checkId = `${phone}_${orderId}_${messageType}_${Date.now()}`;
        const startTime = Date.now();
        
        try {
            console.log(`🛡️ [${checkId}] Starting comprehensive safety check...`);
            console.log(`📋 [${checkId}] Phone: ${phone}, Order: ${orderId}, Type: ${messageType}`);
            
            // Log the safety check attempt
            await this.logger.logSafetyEvent('SAFETY_CHECK_STARTED', phone, orderId, messageType, 'STARTED', {
                checkId,
                hasOrderData: Object.keys(orderData).length > 0,
                hasSheetData: Object.keys(sheetData).length > 0,
                messageLength: messageContent ? messageContent.length : 0
            });
            
            // 1. Kill Switch Check
            console.log(`🔍 [${checkId}] Step 1: Kill Switch Check`);
            if (await this.isKillSwitchActive()) {
                await this.logger.logSafetyEvent('KILL_SWITCH_CHECK', phone, orderId, messageType, 'BLOCKED', {
                    checkId,
                    reason: 'Kill switch is active'
                });
                return this.createResult(false, 'KILL_SWITCH_ACTIVE', 'Emergency kill switch is active', checkId);
            }
            
            // 2. Startup Grace Period Check
            console.log(`🔍 [${checkId}] Step 2: Grace Period Check`);
            if (this.isStartupGracePeriod) {
                const remainingMs = this.gracePeriodMs - (Date.now() - this.startupTime);
                await this.logger.logGracePeriodEvent('MESSAGE_BLOCKED_GRACE_PERIOD', remainingMs, {
                    checkId,
                    phone,
                    orderId,
                    messageType
                });
                return this.createResult(false, 'STARTUP_GRACE_PERIOD', `Startup grace period active (${Math.ceil(remainingMs / 1000)}s remaining)`, checkId);
            }
            
            // 3. Business Hours Check
            console.log(`🔍 [${checkId}] Step 3: Business Hours Check`);
            if (!this.isBusinessHours()) {
                const currentHour = new Date().getHours();
                await this.logger.logSafetyEvent('BUSINESS_HOURS_CHECK', phone, orderId, messageType, 'BLOCKED', {
                    checkId,
                    currentHour,
                    businessHours: '9 AM - 8 PM'
                });
                return this.createResult(false, 'OUTSIDE_BUSINESS_HOURS', 'Messages not allowed outside business hours (9 AM - 8 PM)', checkId);
            }
            
            // 4. Message Type Rule Check
            console.log(`🔍 [${checkId}] Step 4: Message Type Rules Check`);
            const ruleCheck = await this.checkMessageTypeRules(phone, orderId, messageType, orderData, sheetData);
            if (!ruleCheck.allowed) {
                await this.logger.logSafetyEvent('MESSAGE_RULES_CHECK', phone, orderId, messageType, 'BLOCKED', {
                    checkId,
                    ruleViolation: ruleCheck.reason,
                    details: ruleCheck.message
                });
                return this.createResult(false, ruleCheck.reason, ruleCheck.message, checkId);
            }
            
            // 5. Triple Layer Duplicate Prevention
            console.log(`🔍 [${checkId}] Step 5: Triple Layer Duplicate Check`);
            const duplicateCheck = await this.checkTripleLayerDuplicates(phone, orderId, messageType, messageContent, orderData);
            if (!duplicateCheck.allowed) {
                await this.logger.logSafetyEvent('DUPLICATE_CHECK', phone, orderId, messageType, 'BLOCKED', {
                    checkId,
                    duplicateType: duplicateCheck.reason,
                    details: duplicateCheck.message
                });
                return this.createResult(false, duplicateCheck.reason, duplicateCheck.message, checkId);
            }
            
            // 6. Circuit Breaker Limits
            console.log(`🔍 [${checkId}] Step 6: Circuit Breaker Limits Check`);
            const limitsCheck = await this.checkCircuitBreakerLimits(phone, messageType);
            if (!limitsCheck.allowed) {
                await this.logger.logSafetyEvent('CIRCUIT_BREAKER_CHECK', phone, orderId, messageType, 'BLOCKED', {
                    checkId,
                    limitType: limitsCheck.reason,
                    details: limitsCheck.message
                });
                return this.createResult(false, limitsCheck.reason, limitsCheck.message, checkId);
            }
            
            // 7. Content Similarity Check
            console.log(`🔍 [${checkId}] Step 7: Content Similarity Check`);
            const similarityCheck = await this.checkContentSimilarity(phone, messageContent);
            if (!similarityCheck.allowed) {
                await this.logger.logSafetyEvent('SIMILARITY_CHECK', phone, orderId, messageType, 'BLOCKED', {
                    checkId,
                    similarityIssue: similarityCheck.reason,
                    details: similarityCheck.message
                });
                return this.createResult(false, similarityCheck.reason, similarityCheck.message, checkId);
            }
            
            // All checks passed
            const duration = Date.now() - startTime;
            console.log(`✅ [${checkId}] All safety checks passed - message approved (${duration}ms)`);
            
            await this.logger.logSafetyEvent('SAFETY_CHECK_COMPLETED', phone, orderId, messageType, 'APPROVED', {
                checkId,
                duration,
                allChecksCount: 7,
                checksDetails: {
                    killSwitch: 'PASSED',
                    gracePeriod: 'PASSED',
                    businessHours: 'PASSED',
                    messageRules: 'PASSED',
                    duplicateCheck: 'PASSED',
                    circuitBreaker: 'PASSED',
                    contentSimilarity: 'PASSED'
                }
            });
            
            return this.createResult(true, 'APPROVED', 'All safety checks passed', checkId);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${checkId}] Safety check error (${duration}ms):`, error.message);
            
            await this.logger.error('Safety check error', {
                checkId,
                phone,
                orderId,
                messageType,
                error: error.message,
                stack: error.stack,
                duration
            });
            
            return this.createResult(false, 'SAFETY_CHECK_ERROR', `Safety check failed: ${error.message}`, checkId);
        }
    }

    async checkMessageTypeRules(phone, orderId, messageType, orderData, sheetData) {
        try {
            const rule = this.messageRules[messageType];
            if (!rule) {
                await this.logger.logSafetyEvent('MESSAGE_RULES_CHECK', phone, orderId, messageType, 'UNKNOWN_TYPE', {
                    availableTypes: Object.keys(this.messageRules)
                });
                return { allowed: false, reason: 'UNKNOWN_MESSAGE_TYPE', message: `Unknown message type: ${messageType}` };
            }
            
            console.log(`📋 Checking rules for ${messageType}: ${rule.condition}`);
            
            await this.logger.logSafetyEvent('MESSAGE_RULES_CHECK', phone, orderId, messageType, 'STARTED', {
                ruleCondition: rule.condition,
                requiredFields: rule.requiredFields,
                orderDataFields: Object.keys(orderData),
                sheetDataFields: Object.keys(sheetData)
            });
            
            // Check required fields
            for (const field of rule.requiredFields) {
                if (!orderData[field] && !sheetData[field]) {
                    await this.logger.logSafetyEvent('MESSAGE_RULES_CHECK', phone, orderId, messageType, 'MISSING_FIELD', {
                        missingField: field,
                        requiredFields: rule.requiredFields,
                        availableOrderFields: Object.keys(orderData),
                        availableSheetFields: Object.keys(sheetData)
                    });
                    return { 
                        allowed: false, 
                        reason: 'MISSING_REQUIRED_FIELD', 
                        message: `Missing required field: ${field}` 
                    };
                }
            }
            
            // Message-specific condition checks
            let conditionResult;
            switch (messageType) {
                case 'welcome':
                    conditionResult = await this.checkWelcomeConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'confirmation':
                    conditionResult = await this.checkConfirmationConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'ready':
                    conditionResult = await this.checkReadyConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'delivery':
                    conditionResult = await this.checkDeliveryConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'pickup_reminder':
                    conditionResult = await this.checkPickupReminderConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'payment_reminder':
                    conditionResult = await this.checkPaymentReminderConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'fabric_welcome':
                    conditionResult = await this.checkFabricWelcomeConditions(phone, orderId, orderData, sheetData);
                    break;
                
                case 'fabric_purchase':
                    conditionResult = await this.checkFabricPurchaseConditions(phone, orderId, orderData, sheetData);
                    break;
                
                default:
                    await this.logger.logSafetyEvent('MESSAGE_RULES_CHECK', phone, orderId, messageType, 'UNSUPPORTED_TYPE', {
                        supportedTypes: ['welcome', 'confirmation', 'ready', 'delivery', 'pickup_reminder', 'payment_reminder', 'fabric_welcome', 'fabric_purchase']
                    });
                    return { allowed: false, reason: 'UNSUPPORTED_MESSAGE_TYPE', message: `Unsupported message type: ${messageType}` };
            }
            
            // Log the condition check result
            await this.logger.logSafetyEvent('MESSAGE_RULES_CHECK', phone, orderId, messageType, 
                conditionResult.allowed ? 'CONDITIONS_PASSED' : 'CONDITIONS_FAILED', {
                conditionResult,
                ruleCondition: rule.condition
            });
            
            return conditionResult;
            
        } catch (error) {
            await this.logger.error('Message type rules check error', {
                phone,
                orderId,
                messageType,
                error: error.message,
                stack: error.stack
            });
            return { allowed: false, reason: 'RULE_CHECK_ERROR', message: `Rule check error: ${error.message}` };
        }
    }

    async checkWelcomeConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Welcome Notified = No
        
        // Check if welcome already sent for this phone + order combination
        const existingWelcome = await this.getMessageFromDB(phone, orderId, 'welcome');
        if (existingWelcome && existingWelcome.success) {
            return { 
                allowed: false, 
                reason: 'WELCOME_ALREADY_SENT', 
                message: `Welcome message already sent for phone ${phone} and order ${orderId}` 
            };
        }
        
        // Check Google Sheet flag
        if (sheetData.welcome_notified && sheetData.welcome_notified.toLowerCase() === 'yes') {
            return { 
                allowed: false, 
                reason: 'WELCOME_MARKED_SENT_IN_SHEET', 
                message: `Welcome Notified = Yes in Google Sheet for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkConfirmationConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Confirmation Notified = No AND Welcome already sent
        
        // Check if confirmation already sent
        const existingConfirmation = await this.getMessageFromDB(phone, orderId, 'confirmation');
        if (existingConfirmation && existingConfirmation.success) {
            return { 
                allowed: false, 
                reason: 'CONFIRMATION_ALREADY_SENT', 
                message: `Confirmation message already sent for phone ${phone} and order ${orderId}` 
            };
        }
        
        // Check if welcome was sent first
        const welcomeSent = await this.getMessageFromDB(phone, orderId, 'welcome');
        if (!welcomeSent || !welcomeSent.success) {
            return { 
                allowed: false, 
                reason: 'WELCOME_NOT_SENT_FIRST', 
                message: `Welcome message must be sent before confirmation for order ${orderId}` 
            };
        }
        
        // Check Google Sheet flag
        if (sheetData.confirmation_notified && sheetData.confirmation_notified.toLowerCase() === 'yes') {
            return { 
                allowed: false, 
                reason: 'CONFIRMATION_MARKED_SENT_IN_SHEET', 
                message: `Confirmation Notified = Yes in Google Sheet for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkReadyConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Ready Notified = No AND order status = ready
        
        const existingReady = await this.getMessageFromDB(phone, orderId, 'ready');
        if (existingReady && existingReady.success) {
            return { 
                allowed: false, 
                reason: 'READY_ALREADY_SENT', 
                message: `Ready message already sent for order ${orderId}` 
            };
        }
        
        // Check order status
        const status = (orderData.status || sheetData.status || '').toLowerCase();
        if (!['ready', 'completed', 'pickup'].includes(status)) {
            return { 
                allowed: false, 
                reason: 'ORDER_NOT_READY_STATUS', 
                message: `Order ${orderId} status is '${status}', not ready for pickup notification` 
            };
        }
        
        if (sheetData.ready_notified && sheetData.ready_notified.toLowerCase() === 'yes') {
            return { 
                allowed: false, 
                reason: 'READY_MARKED_SENT_IN_SHEET', 
                message: `Ready Notified = Yes in Google Sheet for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkDeliveryConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Delivery Notified = No AND order status = delivered
        
        const existingDelivery = await this.getMessageFromDB(phone, orderId, 'delivery');
        if (existingDelivery && existingDelivery.success) {
            return { 
                allowed: false, 
                reason: 'DELIVERY_ALREADY_SENT', 
                message: `Delivery message already sent for order ${orderId}` 
            };
        }
        
        const status = (orderData.status || sheetData.status || '').toLowerCase();
        if (!['delivered', 'completed'].includes(status)) {
            return { 
                allowed: false, 
                reason: 'ORDER_NOT_DELIVERED_STATUS', 
                message: `Order ${orderId} status is '${status}', not delivered` 
            };
        }
        
        if (sheetData.delivery_notified && sheetData.delivery_notified.toLowerCase() === 'yes') {
            return { 
                allowed: false, 
                reason: 'DELIVERY_MARKED_SENT_IN_SHEET', 
                message: `Delivery Notified = Yes in Google Sheet for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkPickupReminderConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Ready sent AND days > 2 AND reminder_count < 3
        
        const readySent = await this.getMessageFromDB(phone, orderId, 'ready');
        if (!readySent || !readySent.success) {
            return { 
                allowed: false, 
                reason: 'READY_NOT_SENT_FIRST', 
                message: `Ready message must be sent before pickup reminder for order ${orderId}` 
            };
        }
        
        // Check if enough time has passed since ready message
        const daysSinceReady = (Date.now() - readySent.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceReady < 2) {
            return { 
                allowed: false, 
                reason: 'TOO_SOON_FOR_REMINDER', 
                message: `Only ${daysSinceReady.toFixed(1)} days since ready message. Need 2+ days for pickup reminder.` 
            };
        }
        
        // Check reminder count
        const reminderCount = await this.getMessageCountFromDB(phone, orderId, 'pickup_reminder');
        if (reminderCount >= 3) {
            return { 
                allowed: false, 
                reason: 'MAX_PICKUP_REMINDERS_SENT', 
                message: `Maximum pickup reminders (3) already sent for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkPaymentReminderConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Delivered AND remaining_amount > 0 AND reminder_count < 5
        
        const deliverySent = await this.getMessageFromDB(phone, orderId, 'delivery');
        if (!deliverySent || !deliverySent.success) {
            return { 
                allowed: false, 
                reason: 'DELIVERY_NOT_SENT_FIRST', 
                message: `Delivery message must be sent before payment reminder for order ${orderId}` 
            };
        }
        
        const remainingAmount = parseFloat(orderData.remaining_amount || sheetData.remaining_amount || 0);
        if (remainingAmount <= 0) {
            return { 
                allowed: false, 
                reason: 'NO_REMAINING_AMOUNT', 
                message: `No remaining amount for order ${orderId}. Payment complete.` 
            };
        }
        
        const reminderCount = await this.getMessageCountFromDB(phone, orderId, 'payment_reminder');
        if (reminderCount >= 5) {
            return { 
                allowed: false, 
                reason: 'MAX_PAYMENT_REMINDERS_SENT', 
                message: `Maximum payment reminders (5) already sent for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkFabricWelcomeConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone unique (not in tailor sheet) AND Fabric Welcome Notified = No
        
        // This would require checking if phone exists in tailor sheet
        // For now, check if fabric welcome already sent
        const existingFabricWelcome = await this.getMessageFromDB(phone, orderId, 'fabric_welcome');
        if (existingFabricWelcome && existingFabricWelcome.success) {
            return { 
                allowed: false, 
                reason: 'FABRIC_WELCOME_ALREADY_SENT', 
                message: `Fabric welcome message already sent for phone ${phone} and order ${orderId}` 
            };
        }
        
        if (sheetData.fabric_welcome_notified && sheetData.fabric_welcome_notified.toLowerCase() === 'yes') {
            return { 
                allowed: false, 
                reason: 'FABRIC_WELCOME_MARKED_SENT_IN_SHEET', 
                message: `Fabric Welcome Notified = Yes in Google Sheet for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkFabricPurchaseConditions(phone, orderId, orderData, sheetData) {
        // Rule: phone + orderId unique AND Fabric Purchase Notified = No
        
        const existingPurchase = await this.getMessageFromDB(phone, orderId, 'fabric_purchase');
        if (existingPurchase && existingPurchase.success) {
            return { 
                allowed: false, 
                reason: 'FABRIC_PURCHASE_ALREADY_SENT', 
                message: `Fabric purchase message already sent for order ${orderId}` 
            };
        }
        
        if (sheetData.fabric_purchase_notified && sheetData.fabric_purchase_notified.toLowerCase() === 'yes') {
            return { 
                allowed: false, 
                reason: 'FABRIC_PURCHASE_MARKED_SENT_IN_SHEET', 
                message: `Fabric Purchase Notified = Yes in Google Sheet for order ${orderId}` 
            };
        }
        
        return { allowed: true };
    }

    async checkTripleLayerDuplicates(phone, orderId, messageType, messageContent, orderData) {
        // Layer 1: Database check (most reliable)
        const dbCheck = await this.getMessageFromDB(phone, orderId, messageType);
        if (dbCheck && dbCheck.success) {
            return { 
                allowed: false, 
                reason: 'DATABASE_DUPLICATE', 
                message: `Message already sent according to database (${new Date(dbCheck.timestamp).toLocaleString()})` 
            };
        }
        
        // Layer 2: Content hash check
        const contentHash = this.generateContentHash(messageContent);
        const recentSimilar = await this.getRecentMessagesByContentHash(phone, contentHash, 24 * 60 * 60 * 1000);
        if (recentSimilar.length > 0) {
            return { 
                allowed: false, 
                reason: 'CONTENT_DUPLICATE', 
                message: `Identical content already sent in last 24 hours` 
            };
        }
        
        // Layer 3: File-based backup check (if available)
        try {
            const backupFile = path.join(this.dataDir, `backup_${phone}_${orderId}_${messageType}.json`);
            if (fsSync.existsSync(backupFile)) {
                const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
                if (backupData.sent && backupData.timestamp > Date.now() - 86400000) { // 24 hours
                    return { 
                        allowed: false, 
                        reason: 'BACKUP_FILE_DUPLICATE', 
                        message: `Message marked as sent in backup file` 
                    };
                }
            }
        } catch (error) {
            console.warn('Backup file check failed:', error.message);
        }
        
        return { allowed: true };
    }

    async checkCircuitBreakerLimits(phone, messageType) {
        const now = Date.now();
        const limits = await this.getCustomerLimits(phone);
        
        // Reset counters if needed
        const hourMs = 60 * 60 * 1000;
        const dayMs = 24 * hourMs;
        
        if (!limits.last_hourly_reset || (now - limits.last_hourly_reset) > hourMs) {
            limits.hourly_count = 0;
            limits.last_hourly_reset = now;
        }
        
        if (!limits.last_daily_reset || (now - limits.last_daily_reset) > dayMs) {
            limits.daily_count = 0;
            limits.last_daily_reset = now;
        }
        
        // Check limits
        if (limits.hourly_count >= this.hourlyLimit) {
            return { 
                allowed: false, 
                reason: 'HOURLY_LIMIT_EXCEEDED', 
                message: `Hourly limit of ${this.hourlyLimit} messages exceeded for phone ${phone}` 
            };
        }
        
        if (limits.daily_count >= this.dailyLimit) {
            return { 
                allowed: false, 
                reason: 'DAILY_LIMIT_EXCEEDED', 
                message: `Daily limit of ${this.dailyLimit} messages exceeded for phone ${phone}` 
            };
        }
        
        return { allowed: true };
    }

    async checkContentSimilarity(phone, messageContent) {
        const recentMessages = await this.getRecentMessagesForPhone(phone, 24 * 60 * 60 * 1000); // 24 hours
        
        for (const msg of recentMessages) {
            if (msg.content_hash && messageContent) {
                const similarity = this.calculateSimilarity(messageContent, msg.content_hash);
                if (similarity > this.similarityThreshold) {
                    return { 
                        allowed: false, 
                        reason: 'CONTENT_TOO_SIMILAR', 
                        message: `Message content ${(similarity * 100).toFixed(1)}% similar to recent message` 
                    };
                }
            }
        }
        
        return { allowed: true };
    }

    isBusinessHours() {
        const now = new Date();
        const hour = now.getHours();
        // Business hours: 9 AM to 8 PM
        return hour >= 9 && hour < 20;
    }

    async isKillSwitchActive() {
        // Check environment variable
        if (process.env.WHATSAPP_KILL_SWITCH === 'true') {
            return true;
        }
        
        // Check kill switch file
        const killSwitchFile = path.join(this.dataDir, 'kill-switch.txt');
        try {
            if (fsSync.existsSync(killSwitchFile)) {
                const content = await fs.readFile(killSwitchFile, 'utf8');
                return content.trim().toLowerCase() === 'active';
            }
        } catch (error) {
            console.warn('Kill switch file check failed:', error.message);
        }
        
        return false;
    }

    /**
     * Record successful message sending
     */
    async recordMessageSent(phone, orderId, messageType, messageContent, success = true, errorMessage = null) {
        try {
            const contentHash = this.generateContentHash(messageContent);
            const timestamp = Date.now();
            
            // Insert into database
            await this.insertMessageLog(phone, orderId, messageType, contentHash, timestamp, success, errorMessage);
            
            // Update customer limits
            await this.updateCustomerLimits(phone);
            
            // Create backup file
            const backupFile = path.join(this.dataDir, `backup_${phone}_${orderId}_${messageType}.json`);
            const backupData = {
                phone,
                orderId,
                messageType,
                contentHash,
                timestamp,
                success,
                errorMessage,
                sent: success
            };
            await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            
            console.log(`📝 Message recorded: ${phone} | ${orderId} | ${messageType} | Success: ${success}`);
            
            // Log the message recording event
            await this.logger.logMessageAttempt(phone, orderId, messageType, 
                success ? 'RECORDED_SUCCESS' : 'RECORDED_FAILURE', {
                contentHash,
                timestamp,
                messageLength: messageContent ? messageContent.length : 0,
                errorMessage: errorMessage || null,
                backupFile: backupFile
            });
            
        } catch (error) {
            console.error('❌ Failed to record message:', error.message);
            
            await this.logger.error('Message recording failed', {
                phone,
                orderId,
                messageType,
                success,
                errorMessage,
                recordingError: error.message,
                stack: error.stack
            });
        }
    }

    // Database helper methods
    async insertMessageLog(phone, orderId, messageType, contentHash, timestamp, success, errorMessage) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT INTO message_log (phone, order_id, message_type, content_hash, timestamp, success, error_message) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [phone, orderId, messageType, contentHash, timestamp, success, errorMessage],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
    }

    async getMessageFromDB(phone, orderId, messageType) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM message_log WHERE phone = ? AND order_id = ? AND message_type = ? AND success = 1 ORDER BY timestamp DESC LIMIT 1`,
                [phone, orderId, messageType],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async getMessageCountFromDB(phone, orderId, messageType) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT COUNT(*) as count FROM message_log WHERE phone = ? AND order_id = ? AND message_type = ? AND success = 1`,
                [phone, orderId, messageType],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.count : 0);
                }
            );
        });
    }

    async getCustomerLimits(phone) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM customer_limits WHERE phone = ?`,
                [phone],
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve(row);
                    } else {
                        // Create new customer limits record
                        const now = Date.now();
                        const newLimits = {
                            phone,
                            daily_count: 0,
                            hourly_count: 0,
                            last_daily_reset: now,
                            last_hourly_reset: now,
                            total_messages: 0
                        };
                        
                        this.db.run(
                            `INSERT INTO customer_limits (phone, daily_count, hourly_count, last_daily_reset, last_hourly_reset, total_messages) 
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [phone, 0, 0, now, now, 0],
                            (err) => {
                                if (err) reject(err);
                                else resolve(newLimits);
                            }
                        );
                    }
                }
            );
        });
    }

    async updateCustomerLimits(phone) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE customer_limits SET 
                 daily_count = daily_count + 1, 
                 hourly_count = hourly_count + 1, 
                 total_messages = total_messages + 1 
                 WHERE phone = ?`,
                [phone],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async getRecentMessagesForPhone(phone, withinMs) {
        const sinceTimestamp = Date.now() - withinMs;
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM message_log WHERE phone = ? AND timestamp > ? ORDER BY timestamp DESC`,
                [phone, sinceTimestamp],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    async getRecentMessagesByContentHash(phone, contentHash, withinMs) {
        const sinceTimestamp = Date.now() - withinMs;
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT * FROM message_log WHERE phone = ? AND content_hash = ? AND timestamp > ? AND success = 1`,
                [phone, contentHash, sinceTimestamp],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    generateContentHash(content) {
        return crypto.createHash('sha256').update(content.toLowerCase().trim()).digest('hex').substring(0, 16);
    }

    calculateSimilarity(text1, text2) {
        // Simple similarity calculation (can be enhanced)
        const len1 = text1.length;
        const len2 = text2.length;
        const maxLen = Math.max(len1, len2);
        if (maxLen === 0) return 1;
        
        const distance = this.levenshteinDistance(text1, text2);
        return 1 - (distance / maxLen);
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    async logSystemEvent(eventType, description, data = null) {
        try {
            const timestamp = Date.now();
            const dataStr = data ? JSON.stringify(data) : null;
            
            await new Promise((resolve, reject) => {
                this.db.run(
                    `INSERT INTO system_events (event_type, description, data, timestamp) VALUES (?, ?, ?, ?)`,
                    [eventType, description, dataStr, timestamp],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            console.log(`📋 System Event: ${eventType} - ${description}`);
        } catch (error) {
            console.error('❌ Failed to log system event:', error.message);
        }
    }

    createResult(allowed, reason, message, checkId) {
        const result = {
            allowed,
            reason,
            message,
            checkId,
            timestamp: Date.now()
        };
        
        console.log(`${allowed ? '✅' : '❌'} [${checkId}] ${message}`);
        return result;
    }

    /**
     * Emergency kill switch activation
     */
    async activateKillSwitch(reason = 'Manual activation') {
        try {
            // Set environment variable
            process.env.WHATSAPP_KILL_SWITCH = 'true';
            
            // Create kill switch file
            const killSwitchFile = path.join(this.dataDir, 'kill-switch.txt');
            await fs.writeFile(killSwitchFile, 'ACTIVE');
            
            // Log the event
            await this.logSystemEvent('kill_switch_activated', reason);
            
            console.log('🚨 KILL SWITCH ACTIVATED - All message sending stopped');
            console.log(`🚨 Reason: ${reason}`);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to activate kill switch:', error.message);
            return false;
        }
    }

    async deactivateKillSwitch() {
        try {
            // Remove environment variable
            delete process.env.WHATSAPP_KILL_SWITCH;
            
            // Remove kill switch file
            const killSwitchFile = path.join(this.dataDir, 'kill-switch.txt');
            if (fsSync.existsSync(killSwitchFile)) {
                await fs.unlink(killSwitchFile);
            }
            
            // Log the event
            await this.logSystemEvent('kill_switch_deactivated', 'Manual deactivation');
            
            console.log('✅ Kill switch deactivated - Message sending allowed');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to deactivate kill switch:', error.message);
            return false;
        }
    }

    /**
     * Get comprehensive safety status
     */
    async getSafetyStatus() {
        const now = Date.now();
        const gracePeriodRemaining = this.isStartupGracePeriod ? 
            Math.max(0, this.gracePeriodMs - (now - this.startupTime)) : 0;
        
        return {
            startupTime: this.startupTime,
            isStartupGracePeriod: this.isStartupGracePeriod,
            gracePeriodRemainingMs: gracePeriodRemaining,
            gracePeriodRemainingSeconds: Math.ceil(gracePeriodRemaining / 1000),
            isBusinessHours: this.isBusinessHours(),
            isKillSwitchActive: await this.isKillSwitchActive(),
            processId: process.pid,
            messageRuleCount: Object.keys(this.messageRules).length,
            dailyLimit: this.dailyLimit,
            hourlyLimit: this.hourlyLimit,
            similarityThreshold: this.similarityThreshold
        };
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        try {
            console.log('🔄 Shutting down Enhanced Safety Manager...');
            
            // Close database connection
            if (this.db) {
                await new Promise((resolve) => {
                    this.db.close((err) => {
                        if (err) console.error('Database close error:', err);
                        resolve();
                    });
                });
            }
            
            // Remove process lock
            try {
                if (fsSync.existsSync(this.lockFile)) {
                    await fs.unlink(this.lockFile);
                }
                if (fsSync.existsSync(this.pidFile)) {
                    await fs.unlink(this.pidFile);
                }
            } catch (error) {
                console.warn('Lock file cleanup error:', error.message);
            }
            
            console.log('✅ Enhanced Safety Manager shutdown complete');
            
        } catch (error) {
            console.error('❌ Safety Manager shutdown error:', error.message);
        }
    }
}

module.exports = EnhancedSafetyManager;