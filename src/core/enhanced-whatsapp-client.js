const WhatsAppClient = require('./whatsapp-client');
const DuplicatePreventionManager = require('../managers/duplicate-prevention-manager');
const EnhancedSafetyManager = require('../managers/enhanced-safety-manager');
const CircuitBreaker = require('../utils/circuit-breaker');
const { google } = require('googleapis');
const path = require('path');

/**
 * Enhanced WhatsApp Client with Comprehensive Safety and Duplicate Prevention
 * 
 * This wrapper extends the basic WhatsApp client with:
 * - 4-minute startup delay
 * - Triple-layer duplicate prevention
 * - Message-specific conditions
 * - Circuit breaker limits
 * - Kill switch functionality
 * - Comprehensive logging
 */
class EnhancedWhatsAppClient extends WhatsAppClient {
    constructor(options = {}) {
        super();
        
        // Initialize enhanced safety manager (primary protection system)
        this.safetyManager = new EnhancedSafetyManager({
            dataDir: options.safetyDataDir || './safety-data',
            gracePeriodMs: options.startupDelayMs || 240000, // 4 minutes
            dailyLimit: options.dailyLimit || 10,
            hourlyLimit: options.hourlyLimit || 3,
            similarityThreshold: options.similarityThreshold || 0.8
        });
        
        // Initialize duplicate prevention manager (backup system)
        this.duplicateManager = new DuplicatePreventionManager({
            dataDir: options.duplicateDataDir || './duplicate-prevention-data',
            maxMessagesPerDay: options.maxMessagesPerDay || 5,
            messageCooldownMs: options.messageCooldownMs || 300000, // 5 minutes
            duplicateCheckWindowMs: options.duplicateCheckWindowMs || 24 * 60 * 60 * 1000 // 24 hours
        });
        
        // Enable/disable duplicate prevention (for testing)
        this.duplicatePreventionEnabled = options.duplicatePreventionEnabled !== false;
        
        // Webhook properties
        this.isProcessingOrders = false; // Mutex to prevent concurrent processing
        
        // Circuit breaker for WhatsApp API calls
        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: 5,      // Open circuit after 5 failures
            recoveryTimeout: 60000,   // Try to recover after 1 minute
            monitoringPeriod: 120000  // Monitor over 2 minute periods
        });
        
        // Google Sheets integration (for message sending only)
        this.sheets = null;
        
        // Override sendMessage to include comprehensive safety checks
        this.originalSendMessage = super.sendMessage.bind(this);
        
        // Create circuit breaker protected version
        this.protectedSendMessage = async (jid, message) => {
            return await this.circuitBreaker.execute(async () => {
                return await this.originalSendMessage(jid, message);
            });
        };
        
        // Forward all events from parent class
        this.setupEventForwarding();
        
        console.log('🛡️ Enhanced WhatsApp Client with comprehensive safety initialized');
        console.log('⏰ 4-minute startup delay active');
        console.log('🔒 Triple-layer duplicate prevention enabled');
        console.log('⚡ Circuit breaker limits: Daily=10, Hourly=3');
    }

    /**
     * Setup event forwarding from parent WhatsAppClient
     */
    setupEventForwarding() {
        // Forward connection events
        this.on('connected', () => {
            console.log('🔄 Enhanced client: Connected event received, forwarding...');
        });
        
        this.on('disconnected', () => {
            console.log('🔄 Enhanced client: Disconnected event received, forwarding...');
        });
        
        this.on('qr', (_qr) => {
            console.log('🔄 Enhanced client: QR event received, forwarding...');
        });
        
        this.on('pairing-code', (_data) => {
            console.log('🔄 Enhanced client: Pairing code event received, forwarding...');
        });
        
        this.on('pairing-error', (_error) => {
            console.log('🔄 Enhanced client: Pairing error event received, forwarding...');
        });
    }

    /**
     * Enhanced sendMessage with comprehensive safety checks
     * 
     * @param {string} jid - WhatsApp JID (phone@s.whatsapp.net)
     * @param {string} message - Message content
     * @param {Object} context - Message context for safety checks
     * @returns {Object} - {success: boolean, messageId?: string, error?: string, blocked?: boolean, blockReason?: string}
     */
    async sendMessage(jid, message, context = {}) {
        const startTime = Date.now();
        let phone = '';
        
        try {
            // Extract phone number from JID
            phone = this.extractPhoneFromJid(jid);
            
            console.log(`🔍 [${phone}] Starting comprehensive message safety check...`);
            console.log(`📋 [${phone}] Order: ${context.orderId || 'N/A'}, Type: ${context.messageType || 'N/A'}`);
            
            // If safety checks are completely disabled (for emergency testing only)
            if (!this.duplicatePreventionEnabled) {
                console.log('⚠️ ALL SAFETY CHECKS DISABLED - SENDING MESSAGE DIRECTLY (EMERGENCY MODE)');
                const result = await this.protectedSendMessage(jid, message);
                return {
                    success: true,
                    messageId: result?.key?.id,
                    blocked: false,
                    safetyStatus: 'BYPASSED'
                };
            }

            // PRIMARY SAFETY CHECK - Enhanced Safety Manager
            if (context.orderId && context.messageType) {
                console.log(`🛡️ [${phone}] Running primary safety check...`);
                
                const safetyCheck = await this.safetyManager.canSendMessage(
                    phone,
                    context.orderId,
                    context.messageType,
                    message,
                    context.orderData || {},
                    context.sheetData || {}
                );

                if (!safetyCheck.allowed) {
                    console.log(`🚫 [${phone}] PRIMARY SAFETY CHECK FAILED: ${safetyCheck.message}`);
                    
                    // Record the blocked attempt
                    await this.safetyManager.recordMessageSent(
                        phone,
                        context.orderId,
                        context.messageType,
                        message,
                        false, // success = false
                        safetyCheck.message
                    );
                    
                    return {
                        success: false,
                        blocked: true,
                        blockReason: safetyCheck.reason,
                        blockMessage: safetyCheck.message,
                        checkId: safetyCheck.checkId,
                        error: `Safety check failed: ${safetyCheck.message}`,
                        safetyStatus: 'BLOCKED_PRIMARY'
                    };
                }
                
                console.log(`✅ [${phone}] Primary safety check passed`);
            }

            // SECONDARY SAFETY CHECK - Legacy Duplicate Prevention (backup)
            if (context.orderId && context.messageType) {
                console.log(`🛡️ [${phone}] Running secondary duplicate check...`);
                
                const duplicateCheck = await this.duplicateManager.checkDuplicate(
                    phone,
                    context.orderId,
                    context.messageType,
                    message,
                    context.orderData,
                    context.sheetType
                );

                if (!duplicateCheck.allowed) {
                    console.log(`🚫 [${phone}] SECONDARY DUPLICATE CHECK FAILED: ${duplicateCheck.reason}`);
                    
                    // Record the blocked attempt in safety manager too
                    await this.safetyManager.recordMessageSent(
                        phone,
                        context.orderId,
                        context.messageType,
                        message,
                        false,
                        `Secondary duplicate check: ${duplicateCheck.reason}`
                    );
                    
                    return {
                        success: false,
                        blocked: true,
                        blockReason: duplicateCheck.reason,
                        duplicateType: duplicateCheck.duplicateType,
                        error: `Secondary duplicate check failed: ${duplicateCheck.reason}`,
                        safetyStatus: 'BLOCKED_SECONDARY'
                    };
                }
                
                console.log(`✅ [${phone}] Secondary duplicate check passed`);
            }

            // ALL SAFETY CHECKS PASSED - SEND MESSAGE
            console.log(`📤 [${phone}] All safety checks passed - sending message...`);
            
            const result = await this.protectedSendMessage(jid, message);
            const messageId = result?.key?.id;
            
            // Record successful send in both systems
            if (context.orderId && context.messageType) {
                // Primary system
                await this.safetyManager.recordMessageSent(
                    phone,
                    context.orderId,
                    context.messageType,
                    message,
                    true, // success = true
                    null
                );
                
                // Secondary system (backup)
                await this.duplicateManager.recordMessageSent(
                    phone,
                    context.orderId,
                    context.messageType,
                    message,
                    context.orderData,
                    context.sheetType
                );
            }

            const duration = Date.now() - startTime;
            console.log(`✅ [${phone}] Message sent successfully (${duration}ms)`);
            console.log(`📧 [${phone}] Message ID: ${messageId}`);
            
            return {
                success: true,
                messageId: messageId,
                blocked: false,
                duration: duration,
                safetyStatus: 'APPROVED_AND_SENT'
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ [${phone}] Message sending failed (${duration}ms):`, error.message);
            
            // Record the failed attempt
            if (context.orderId && context.messageType) {
                try {
                    await this.safetyManager.recordMessageSent(
                        phone,
                        context.orderId,
                        context.messageType,
                        message,
                        false,
                        error.message
                    );
                } catch (recordError) {
                    console.error(`❌ [${phone}] Failed to record error:`, recordError.message);
                }
            }
            
            return {
                success: false,
                error: error.message,
                blocked: false,
                duration: duration,
                safetyStatus: 'ERROR'
            };
        }
    }

    /**
     * Send order notification with comprehensive duplicate prevention
     */
    async sendOrderNotification(phone, orderId, messageType, messageContent, orderData = {}, sheetType = 'tailor') {
        const jid = this.formatPhoneToJid(phone);
        
        return await this.sendMessage(jid, messageContent, {
            orderId,
            messageType,
            orderData,
            sheetType
        });
    }

    /**
     * Send welcome message with enhanced safety checks
     */
    async sendWelcomeMessage(phone, orderData, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        // Select appropriate template based on sheet type
        let welcomeMessage;
        if (sheetType === 'fabric') {
            welcomeMessage = templates.getFabricWelcomeMessage(orderData);
        } else {
            welcomeMessage = templates.getWelcomeMessage(orderData);
        }
        
        const jid = this.formatPhoneToJid(phone);
        
        const result = await this.sendMessage(jid, welcomeMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'welcome',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
        
        // Update Google Sheets if message was sent successfully
        if (result.success) {
            await this.updateGoogleSheetsColumn(orderData.order_id || orderData.orderId, phone, 'welcome_notified', 'Yes', sheetType);
        }
        
        return result;
    }

    /**
     * Send order confirmation message with enhanced safety checks
     */
    async sendConfirmationMessage(phone, orderData, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const confirmationMessage = templates.getOrderConfirmationMessage(orderData);
        const jid = this.formatPhoneToJid(phone);
        
        const result = await this.sendMessage(jid, confirmationMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'confirmation',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
        
        // Update Google Sheets if message was sent successfully
        if (result.success) {
            await this.updateGoogleSheetsColumn(orderData.order_id || orderData.orderId, phone, 'confirmation_notified', 'Yes', sheetType);
        }
        
        return result;
    }

    /**
     * Send order ready message with enhanced safety checks
     */
    async sendOrderReadyMessage(phone, orderData, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const readyMessage = templates.getOrderReadyMessage(orderData);
        const jid = this.formatPhoneToJid(phone);
        
        const result = await this.sendMessage(jid, readyMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'ready',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
        
        // Update Google Sheets if message was sent successfully
        if (result.success) {
            await this.updateGoogleSheetsColumn(orderData.order_id || orderData.orderId, phone, 'ready_notified', 'Yes', sheetType);
        }
        
        return result;
    }

    /**
     * Send order confirmation message with enhanced safety checks
     */
    async sendOrderConfirmationMessage(phone, orderData, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const confirmationMessage = templates.getOrderConfirmationMessage(orderData);
        const jid = this.formatPhoneToJid(phone);
        
        const result = await this.sendMessage(jid, confirmationMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'confirmation',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
        
        // Update Google Sheets if message was sent successfully
        if (result.success) {
            await this.updateGoogleSheetsColumn(orderData.order_id || orderData.orderId, phone, 'confirmation_sent', 'Yes', sheetType);
        }
        
        return result;
    }

    /**
     * Send delivery notification with enhanced safety checks
     */
    async sendDeliveryNotification(phone, orderData, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const deliveryMessage = templates.getDeliveryNotificationMessage(orderData);
        const jid = this.formatPhoneToJid(phone);
        
        const result = await this.sendMessage(jid, deliveryMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'delivery',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
        
        // Update Google Sheets if message was sent successfully
        if (result.success) {
            await this.updateGoogleSheetsColumn(orderData.order_id || orderData.orderId, phone, 'delivery_notified', 'Yes', sheetType);
        }
        
        return result;
    }

    /**
     * Send pickup reminder with enhanced safety checks
     */
    async sendPickupReminder(phone, orderData, reminderNumber = 1, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const reminderData = {
            ...orderData,
            reminder_number: reminderNumber
        };
        
        const reminderMessage = templates.getPickupReminderMessage(reminderData);
        const jid = this.formatPhoneToJid(phone);
        
        return await this.sendMessage(jid, reminderMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'pickup_reminder',
            orderData: reminderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
    }

    /**
     * Send payment reminder with enhanced safety checks
     */
    async sendPaymentReminder(phone, orderData, reminderNumber = 1, sheetType = 'tailor', sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const reminderData = {
            ...orderData,
            reminder_number: reminderNumber
        };
        
        const reminderMessage = templates.getPaymentReminderMessage(reminderData);
        const jid = this.formatPhoneToJid(phone);
        
        return await this.sendMessage(jid, reminderMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'payment_reminder',
            orderData: reminderData,
            sheetData: sheetData,
            sheetType: sheetType
        });
    }

    /**
     * Send fabric welcome message with enhanced safety checks
     */
    async sendFabricWelcomeMessage(phone, orderData, sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const welcomeMessage = templates.getFabricWelcomeMessage(orderData);
        const jid = this.formatPhoneToJid(phone);
        
        return await this.sendMessage(jid, welcomeMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'fabric_welcome',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: 'fabric'
        });
    }

    /**
     * Send fabric purchase confirmation with enhanced safety checks
     */
    async sendFabricConfirmationMessage(phone, orderData, sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const purchaseMessage = templates.getFabricPurchaseMessage(orderData);
        const jid = this.formatPhoneToJid(phone);
        
        return await this.sendMessage(jid, purchaseMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'fabric_purchase',
            orderData: orderData,
            sheetData: sheetData,
            sheetType: 'fabric'
        });
    }

    /**
     * Send fabric payment reminder with enhanced safety checks
     */
    async sendFabricPaymentReminder(phone, orderData, reminderNumber = 1, sheetData = {}) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const reminderData = {
            ...orderData,
            reminder_number: reminderNumber
        };
        
        const reminderMessage = templates.getFabricPaymentReminderMessage(reminderData);
        const jid = this.formatPhoneToJid(phone);
        
        return await this.sendMessage(jid, reminderMessage, {
            orderId: orderData.order_id || orderData.orderId,
            messageType: 'fabric_payment_reminder',
            orderData: reminderData,
            sheetData: sheetData,
            sheetType: 'fabric'
        });
    }

    /**
     * Send combined order message
     */
    async sendCombinedOrderMessage(phone, orderData) {
        const messageTemplates = require('../managers/message-templates');
        const templates = new messageTemplates();
        
        const combinedMessage = templates.getCombinedOrderMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'combined_order',
            combinedMessage,
            orderData,
            'combined'
        );
    }



    /**
     * Send test message (bypasses duplicate prevention)
     */
    async sendTestMessage(phone, message) {
        const jid = this.formatPhoneToJid(phone);
        
        // Bypass duplicate prevention for test messages
        const originalEnabled = this.duplicatePreventionEnabled;
        this.duplicatePreventionEnabled = false;
        
        try {
            const result = await this.sendMessage(jid, message, {
                orderId: `TEST-${Date.now()}`,
                messageType: 'test',
                orderData: { test: true }
            });
            return result;
        } finally {
            this.duplicatePreventionEnabled = originalEnabled;
        }
    }

    /**
     * Extract phone number from WhatsApp JID
     */
    extractPhoneFromJid(jid) {
        if (!jid) return null;
        return jid.split('@')[0];
    }

    /**
     * Format phone number to WhatsApp JID
     */
    formatPhoneToJid(phone) {
        const normalizedPhone = this.duplicateManager.normalizePhoneNumber(phone);
        if (!normalizedPhone) {
            throw new Error(`Invalid phone number: ${phone}`);
        }
        return `${normalizedPhone}@s.whatsapp.net`;
    }

    /**
     * Get duplicate prevention statistics
     */
    getDuplicatePreventionStats() {
        return this.duplicateManager.getStatistics();
    }

    /**
     * Get customer message history
     */
    getCustomerHistory(phone) {
        return this.duplicateManager.getCustomerHistory(phone);
    }

    /**
     * Check if a specific message was recently sent
     */
    wasMessageRecentlySent(phone, orderId, messageType, sheetType = 'tailor', withinMs = null) {
        return this.duplicateManager.wasMessageRecentlySent(phone, orderId, messageType, sheetType, withinMs);
    }

    /**
     * Clear all duplicate prevention data (for testing/reset)
     */
    async clearDuplicatePreventionData() {
        await this.duplicateManager.clearAllData();
    }

    /**
     * Enable/disable duplicate prevention
     */
    setDuplicatePreventionEnabled(enabled) {
        this.duplicatePreventionEnabled = enabled;
        console.log(`🔄 Duplicate prevention ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Initialize the Enhanced WhatsApp Client asynchronously
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Enhanced WhatsApp Client...');
            
            // Google Sheets API will be initialized by the main bot instance
            
            // Initialize safety manager first
            await this.safetyManager.initializeAsync();
            console.log('✅ Safety Manager initialized');
            
            // Initialize duplicate prevention manager
            await this.duplicateManager.initializeAsync();
            console.log('✅ Duplicate Prevention Manager initialized');
            
            // Check if WhatsApp is already connected to prevent double connection
            if (this.isConnected && this.socket) {
                console.log('✅ WhatsApp already connected, skipping initialization');
            } else {
                // Initialize the base WhatsApp client (this starts the connection)
                console.log('🔄 Starting WhatsApp connection...');
                await super.initialize();
                console.log('✅ WhatsApp connection started');
            }
            
            // Initialize admin commands after WhatsApp connection
            this.initializeAdminCommands();
            
            // Initialize webhook functionality
            this.initializeWebhook();
            
            console.log('🛡️ Enhanced WhatsApp Client fully initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced WhatsApp Client:', error.message);
            throw error;
        }
    }

    /**
     * Initialize admin commands system
     */
    initializeAdminCommands() {
        try {
            console.log('🔧 Initializing admin commands...');
            
            // Import admin commands
            const AdminCommands = require('../managers/admin-commands');
            
            // Initialize admin commands
            this.adminCommands = new AdminCommands(
                this,
                this, // Pass this client as sheets helper
                null, // No job queue needed
                null  // No message templates needed
            );
            
            // Set up message handler for incoming WhatsApp messages
            if (this.socket && this.socket.ev) {
                this.socket.ev.on('messages.upsert', (m) => {
                    if (m.type === 'notify' || m.type === 'append') {
                        for (const msg of m.messages) {
                            if (!msg.key.fromMe) {
                                let messageText = '';
                                if (msg.message?.conversation) {
                                    messageText = msg.message.conversation;
                                } else if (msg.message?.extendedTextMessage?.text) {
                                    messageText = msg.message.extendedTextMessage.text;
                                }
                                
                                if (messageText && messageText.trim()) {
                                    const messageData = {
                                        text: messageText.trim(),
                                        sender: msg.key.remoteJid
                                    };
                                    this.handleIncomingMessage(messageData);
                                }
                            }
                        }
                    }
                });
                console.log('📨 Message handler attached to WhatsApp socket');
            } else {
                console.log('⚠️ WhatsApp socket not available for message handling');
            }
            
            console.log('✅ Admin commands system initialized');
        } catch (error) {
            console.error('❌ Failed to initialize admin commands:', error);
        }
    }

    /**
     * Handle incoming messages for admin commands
     */
    async handleIncomingMessage(messageData) {
        try {
            if (this.adminCommands) {
                await this.adminCommands.handleIncomingMessage(messageData);
            }
        } catch (error) {
            console.error('❌ Error handling incoming message:', error);
        }
    }

    /**
     * Override the original health check to include comprehensive safety status
     */
    async isHealthy() {
        try {
            const baseHealth = super.isHealthy();
            const dupStats = this.getDuplicatePreventionStats();
            
            // Ensure safety manager is initialized before calling getSafetyStatus
            if (!this.safetyManager || typeof this.safetyManager.getSafetyStatus !== 'function') {
                return {
                    ...baseHealth,
                    safetyManager: {
                        enabled: false,
                        error: 'Safety manager not properly initialized'
                    }
                };
            }
            
            const safetyStatus = await this.safetyManager.getSafetyStatus();
        
            return {
                ...baseHealth,
                safetyManager: {
                    ...safetyStatus,
                    enabled: true
                },
                duplicatePrevention: {
                    enabled: this.duplicatePreventionEnabled,
                    totalMessagesSent: dupStats.totalMessagesSent,
                    duplicatesBlocked: dupStats.duplicatesBlocked,
                    rateLimitBlocked: dupStats.rateLimitBlocked,
                    cooldownBlocked: dupStats.cooldownBlocked,
                    contentDuplicatesBlocked: dupStats.contentDuplicatesBlocked
                }
            };
        } catch (error) {
            console.error('❌ Health check error:', error.message);
            const baseHealth = super.isHealthy();
            return {
                ...baseHealth,
                safetyManager: {
                    enabled: false,
                    error: error.message
                },
                duplicatePrevention: {
                    enabled: false,
                    error: 'Could not get duplicate prevention stats'
                }
            };
        }
    }

    /**
     * Get comprehensive safety statistics
     */
    async getSafetyStatistics() {
        return {
            safetyManager: await this.safetyManager.getSafetyStatus(),
            duplicatePrevention: this.getDuplicatePreventionStats(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Activate emergency kill switch
     */
    async activateKillSwitch(reason = 'Manual activation') {
        return await this.safetyManager.activateKillSwitch(reason);
    }

    /**
     * Deactivate emergency kill switch
     */
    async deactivateKillSwitch() {
        return await this.safetyManager.deactivateKillSwitch();
    }

    /**
     * Check if kill switch is active
     */
    async isKillSwitchActive() {
        return await this.safetyManager.isKillSwitchActive();
    }



    /**
     * Initialize webhook functionality (replaces polling)
     */
    initializeWebhook() {
        console.log('🔗 Initializing webhook functionality...');
        console.log('✅ WhatsApp connected. Webhook system ready for real-time notifications.');
        console.log('💡 Configure Google Apps Script webhook for instant sheet change notifications.');
    }
    
    







    /**
     * Update a specific column in Google Sheets after successful message sending
     */
    async updateGoogleSheetsColumn(orderId, phone, columnName, value, sheetType = 'tailor') {
        try {
            console.log(`📝 Updating Google Sheets: ${columnName} = ${value} for order ${orderId}`);
            
            if (!this.sheets) {
                console.warn('⚠️ Google Sheets API not initialized, cannot update column');
                return false;
            }
            
            // Find the appropriate sheet configuration
            const config = this.sheetConfigs.find(c => c.type === sheetType || c.type === 'orders');
            if (!config) {
                console.warn(`⚠️ No sheet configuration found for type: ${sheetType}`);
                return false;
            }
            
            // First, get the sheet data to find the row with this order ID
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: config.id,
                range: `${config.tabName || config.name}!A:Z`
            });
            
            const rows = response.data.values;
            if (!rows || rows.length <= 1) {
                console.warn('⚠️ No data found in sheet or only headers present');
                return false;
            }
            
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            // Find the target column index
            const targetColumnIndex = headers.findIndex(header => 
                header && header.toLowerCase().includes(columnName.toLowerCase())
            );
            
            if (targetColumnIndex === -1) {
                console.warn(`⚠️ Column "${columnName}" not found in sheet`);
                return false;
            }
            
            // Find the row with this order ID
            const orderIdIndex = headers.findIndex(header => 
                header && (header.toLowerCase().includes('order') && header.toLowerCase().includes('id'))
            );
            
            if (orderIdIndex === -1) {
                console.warn('⚠️ Order ID column not found in sheet');
                return false;
            }
            
            // Find the row index (1-based for Google Sheets API)
            let targetRowIndex = -1;
            for (let i = 0; i < dataRows.length; i++) {
                if (dataRows[i][orderIdIndex] === orderId) {
                    targetRowIndex = i + 2; // +2 because we skip header row and Google Sheets is 1-based
                    break;
                }
            }
            
            if (targetRowIndex === -1) {
                console.warn(`⚠️ Order ID ${orderId} not found in sheet`);
                return false;
            }
            
            // Update the target cell
            const cellRange = `${config.tabName || config.name}!${this.getColumnLetter(targetColumnIndex + 1)}${targetRowIndex}`;
            
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: config.id,
                range: cellRange,
                valueInputOption: 'RAW',
                resource: {
                    values: [[value]]
                }
            });
            
            console.log(`✅ Updated ${cellRange} to "${value}" for order ${orderId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to update Google Sheets ${columnName} for order ${orderId}:`, error.message);
            return false;
        }
    }
    
    /**
     * Helper function to convert column index to letter (A, B, C, etc.)
     */
    getColumnLetter(columnIndex) {
        let result = '';
        while (columnIndex > 0) {
            columnIndex--;
            result = String.fromCharCode(65 + (columnIndex % 26)) + result;
            columnIndex = Math.floor(columnIndex / 26);
        }
        return result;
    }

    /**
     * Cleanup resources and shutdown safety systems
     */
    async disconnect() {
        console.log('🔄 Shutting down Enhanced WhatsApp Client...');
        
        // Cleanup enhanced safety manager
        if (this.safetyManager) {
            await this.safetyManager.shutdown();
        }
        
        // Cleanup duplicate prevention manager
        if (this.duplicateManager) {
            this.duplicateManager.destroy();
        }
        
        // Call parent disconnect
        await super.disconnect();
        
        console.log('✅ Enhanced WhatsApp Client shutdown complete');
    }
}

module.exports = EnhancedWhatsAppClient;