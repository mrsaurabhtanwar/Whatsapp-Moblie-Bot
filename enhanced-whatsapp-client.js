const WhatsAppClient = require('./whatsapp-client');
const DuplicatePreventionManager = require('./duplicate-prevention-manager');

/**
 * Enhanced WhatsApp Client with Comprehensive Duplicate Prevention
 * 
 * This wrapper extends the basic WhatsApp client with intelligent duplicate prevention
 * that works across multiple bot instances and handles all message types.
 */
class EnhancedWhatsAppClient extends WhatsAppClient {
    constructor(options = {}) {
        super();
        
        // Initialize duplicate prevention manager
        this.duplicateManager = new DuplicatePreventionManager({
            dataDir: options.duplicateDataDir || './duplicate-prevention-data',
            maxMessagesPerDay: options.maxMessagesPerDay || 5,
            messageCooldownMs: options.messageCooldownMs || 300000, // 5 minutes
            duplicateCheckWindowMs: options.duplicateCheckWindowMs || 24 * 60 * 60 * 1000 // 24 hours
        });
        
        // Enable/disable duplicate prevention (for testing)
        this.duplicatePreventionEnabled = options.duplicatePreventionEnabled !== false;
        
        // Override sendMessage to include duplicate prevention
        this.originalSendMessage = super.sendMessage.bind(this);
    }

    /**
     * Enhanced sendMessage with duplicate prevention
     * 
     * @param {string} jid - WhatsApp JID (phone@s.whatsapp.net)
     * @param {string} message - Message content
     * @param {Object} context - Message context for duplicate prevention
     * @returns {Object} - {success: boolean, messageId?: string, error?: string, blocked?: boolean, blockReason?: string}
     */
    async sendMessage(jid, message, context = {}) {
        try {
            // Extract phone number from JID
            const phone = this.extractPhoneFromJid(jid);
            
            // If duplicate prevention is disabled, send directly
            if (!this.duplicatePreventionEnabled) {
                console.log('⚠️ Duplicate prevention disabled - sending message directly');
                const result = await this.originalSendMessage(jid, message);
                return {
                    success: true,
                    messageId: result?.key?.id,
                    blocked: false
                };
            }

            // Check for duplicates if context is provided
            if (context.orderId && context.messageType) {
                const duplicateCheck = await this.duplicateManager.checkDuplicate(
                    phone,
                    context.orderId,
                    context.messageType,
                    message,
                    context.orderData,
                    context.sheetType
                );

                if (!duplicateCheck.allowed) {
                    console.log(`🚫 Message blocked: ${duplicateCheck.reason}`);
                    return {
                        success: false,
                        blocked: true,
                        blockReason: duplicateCheck.reason,
                        duplicateType: duplicateCheck.duplicateType,
                        error: `Duplicate prevented: ${duplicateCheck.reason}`
                    };
                }
            }

            // Send message using original method
            const result = await this.originalSendMessage(jid, message);
            
            // Record successful send in duplicate prevention system
            if (context.orderId && context.messageType) {
                await this.duplicateManager.recordMessageSent(
                    phone,
                    context.orderId,
                    context.messageType,
                    message,
                    context.orderData,
                    context.sheetType
                );
            }

            console.log(`✅ Message sent successfully to ${phone}`);
            return {
                success: true,
                messageId: result?.key?.id,
                blocked: false
            };

        } catch (error) {
            console.error(`❌ Failed to send message: ${error.message}`);
            return {
                success: false,
                error: error.message,
                blocked: false
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
     * Send welcome message
     */
    async sendWelcomeMessage(phone, orderData, sheetType = 'tailor') {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const welcomeMessage = templates.getWelcomeMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'welcome',
            welcomeMessage,
            orderData,
            sheetType
        );
    }

    /**
     * Send order confirmation message
     */
    async sendConfirmationMessage(phone, orderData, sheetType = 'tailor') {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const confirmationMessage = templates.getOrderConfirmationMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'confirmation',
            confirmationMessage,
            orderData,
            sheetType
        );
    }

    /**
     * Send order ready message
     */
    async sendOrderReadyMessage(phone, orderData, sheetType = 'tailor') {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const readyMessage = templates.getOrderReadyMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'ready',
            readyMessage,
            orderData,
            sheetType
        );
    }

    /**
     * Send delivery notification
     */
    async sendDeliveryNotification(phone, orderData, sheetType = 'tailor') {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const deliveryMessage = templates.getDeliveryNotificationMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'delivery_notification',
            deliveryMessage,
            orderData,
            sheetType
        );
    }

    /**
     * Send pickup reminder
     */
    async sendPickupReminder(phone, orderData, reminderNumber = 1, sheetType = 'tailor') {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const reminderData = {
            ...orderData,
            reminder_number: reminderNumber
        };
        
        const reminderMessage = templates.getPickupReminderMessage(reminderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'pickup_reminder',
            reminderMessage,
            reminderData,
            sheetType
        );
    }

    /**
     * Send payment reminder
     */
    async sendPaymentReminder(phone, orderData, reminderNumber = 1, sheetType = 'tailor') {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const reminderData = {
            ...orderData,
            reminder_number: reminderNumber
        };
        
        const reminderMessage = templates.getPaymentReminderMessage(reminderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'payment_reminder',
            reminderMessage,
            reminderData,
            sheetType
        );
    }

    /**
     * Send fabric welcome message
     */
    async sendFabricWelcomeMessage(phone, orderData) {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const welcomeMessage = templates.getFabricWelcomeMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'fabric_welcome',
            welcomeMessage,
            orderData,
            'fabric'
        );
    }

    /**
     * Send fabric purchase confirmation
     */
    async sendFabricConfirmationMessage(phone, orderData) {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const purchaseMessage = templates.getFabricPurchaseMessage(orderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'fabric_purchase',
            purchaseMessage,
            orderData,
            'fabric'
        );
    }

    /**
     * Send fabric payment reminder
     */
    async sendFabricPaymentReminder(phone, orderData, reminderNumber = 1) {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const reminderData = {
            ...orderData,
            reminder_number: reminderNumber
        };
        
        const reminderMessage = templates.getFabricPaymentReminderMessage(reminderData);
        
        return await this.sendOrderNotification(
            phone,
            orderData.order_id || orderData.orderId,
            'fabric_payment_reminder',
            reminderMessage,
            reminderData,
            'fabric'
        );
    }

    /**
     * Send combined order message
     */
    async sendCombinedOrderMessage(phone, orderData) {
        const messageTemplates = require('./message-templates');
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
     * Send worker daily data message
     */
    async sendWorkerDailyDataMessage(phone, workerData) {
        const messageTemplates = require('./message-templates');
        const templates = new messageTemplates();
        
        const dailyDataMessage = templates.getWorkerDailyDataMessage(workerData);
        
        return await this.sendOrderNotification(
            phone,
            `WORKER-${workerData.worker_name}-${workerData.date}`,
            'worker_daily_data',
            dailyDataMessage,
            workerData,
            'worker'
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
     * Override the original health check to include duplicate prevention status
     */
    isHealthy() {
        const baseHealth = super.isHealthy();
        const dupStats = this.getDuplicatePreventionStats();
        
        return {
            ...baseHealth,
            duplicatePrevention: {
                enabled: this.duplicatePreventionEnabled,
                totalMessagesSent: dupStats.totalMessagesSent,
                duplicatesBlocked: dupStats.duplicatesBlocked,
                rateLimitBlocked: dupStats.rateLimitBlocked,
                cooldownBlocked: dupStats.cooldownBlocked,
                contentDuplicatesBlocked: dupStats.contentDuplicatesBlocked
            }
        };
    }

    /**
     * Cleanup resources
     */
    async disconnect() {
        // Cleanup duplicate prevention manager
        if (this.duplicateManager) {
            this.duplicateManager.destroy();
        }
        
        // Call parent disconnect
        await super.disconnect();
    }
}

module.exports = EnhancedWhatsAppClient;