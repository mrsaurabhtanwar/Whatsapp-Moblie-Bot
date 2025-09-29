/**
 * Message Processor Service
 * Handles processing orders and sending WhatsApp messages
 */

const fs = require('fs');
const MessageTemplates = require('../../templates/message-templates');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class MessageProcessor {
    constructor(whatsappClient, googleSheetsService) {
        this.whatsappClient = whatsappClient;
        this.googleSheetsService = googleSheetsService;
        this.messageTemplates = new MessageTemplates();
        this.isInitialized = false;
    }

    /**
     * Initialize the message processor
     */
    async initialize() {
        try {
            logger.info('🔄 Initializing message processor...');
            
            if (!this.whatsappClient) {
                throw new Error('WhatsApp client is required');
            }
            
            if (!this.googleSheetsService) {
                throw new Error('Google Sheets service is required');
            }

            this.isInitialized = true;
            logger.info('✅ Message processor initialized successfully');
            
        } catch (error) {
            logger.error('❌ Failed to initialize message processor:', error);
            throw error;
        }
    }

    /**
     * Process order message and send WhatsApp notification
     */
    async processOrderMessage(messageType, orderData, sheetName, sheetRow) {
        if (!this.isInitialized) {
            throw new Error('Message processor not initialized');
        }

        try {
            logger.info(`🔄 Processing ${messageType} message for ${orderData.customer_name}`);

            // Check if WhatsApp is connected
            if (!this.whatsappClient.isWhatsAppConnected()) {
                logger.error('❌ WhatsApp is not connected, cannot send message');
                throw new Error('WhatsApp is not connected');
            }

            // Generate message from template
            const message = this.generateMessage(messageType, orderData);
            
            if (!message) {
                logger.error(`❌ Failed to generate message for type: ${messageType}`);
                throw new Error(`Unknown message type: ${messageType}`);
            }

            // Check if there's media to send with the message
            const mediaData = this.getMediaForMessage(messageType, orderData);
            
            let result;
            if (mediaData) {
                // Send message with media
                result = await this.sendMessageWithMedia(orderData.phone_number, message, mediaData);
            } else {
                // Send text message only
                result = await this.whatsappClient.sendMessage(orderData.phone_number, message);
            }
            
            // Mark notification as sent in Google Sheet
            await this.googleSheetsService.markNotificationSent(sheetName, sheetRow, messageType);
            
            logger.info(`✅ Successfully sent ${messageType} message to ${orderData.customer_name}`);
            
            return {
                success: true,
                messageType,
                customer: orderData.customer_name,
                phone: orderData.phone_number,
                timestamp: new Date().toISOString(),
                hasMedia: !!mediaData
            };

        } catch (error) {
            logger.error(`❌ Failed to process ${messageType} message:`, error);
            throw error;
        }
    }

    /**
     * Send message with media attachment
     */
    async sendMessageWithMedia(phoneNumber, message, mediaData) {
        try {
            const { type, path, caption, options = {} } = mediaData;
            
            switch (type) {
                case 'image':
                    return await this.whatsappClient.sendImageMessage(
                        phoneNumber, 
                        path, 
                        caption || message, 
                        options.viewOnce
                    );
                    
                case 'video':
                    return await this.whatsappClient.sendVideoMessage(
                        phoneNumber, 
                        path, 
                        caption || message, 
                        options
                    );
                    
                case 'audio':
                    return await this.whatsappClient.sendAudioMessage(
                        phoneNumber, 
                        path, 
                        options.mimetype || 'audio/mp4', 
                        options.ptt
                    );
                    
                case 'document':
                    return await this.whatsappClient.sendDocumentMessage(
                        phoneNumber, 
                        path, 
                        options.filename, 
                        options.mimetype, 
                        caption || message
                    );
                    
                default:
                    logger.warn(`Unknown media type: ${type}, sending as text message`);
                    return await this.whatsappClient.sendMessage(phoneNumber, message);
            }
            
        } catch (error) {
            logger.error(`❌ Failed to send media message:`, error);
            // Fallback to text message if media fails
            logger.info(`📤 Falling back to text message for ${phoneNumber}`);
            return await this.whatsappClient.sendMessage(phoneNumber, message);
        }
    }

    /**
     * Get media data for a specific message type
     */
    getMediaForMessage(messageType, orderData) {
        // Define media configurations for different message types
        const mediaConfig = {
            'welcome': {
                type: 'image',
                path: './media/welcome-image.jpg', // You can add your shop image here
                caption: null, // Will use the generated message as caption
                options: {}
            },
            'order_confirmation': null, // Text only
            'order_ready': {
                type: 'video',
                path: './media/order-ready-video.mp4', // You can add a video showing completed order
                caption: null,
                options: {}
            },
            'delivery_notification': null, // Text only
            'pickup_reminder': null, // Text only
            'payment_reminder': null, // Text only
            'fabric_welcome': {
                type: 'image',
                path: './media/fabric-collection.jpg', // You can add fabric collection image
                caption: null,
                options: {}
            },
            'fabric_purchase': null, // Text only
            'combined_order': null, // Text only
            'pickup_complete': {
                type: 'image',
                path: './media/thank-you-image.jpg', // You can add a thank you image
                caption: null,
                options: {}
            }
        };

        const media = mediaConfig[messageType];
        
        // Check if media file exists before returning
        if (media && media.path) {
            if (!fs.existsSync(media.path)) {
                logger.warn(`Media file not found: ${media.path}, sending text only`);
                return null;
            }
        }
        
        return media;
    }

    /**
     * Generate message from template
     */
    generateMessage(messageType, orderData) {
        try {
            // Add default values for missing data
            const enrichedData = this.enrichOrderData(orderData);
            
            // Map message types to template methods
            const templateMap = {
                'welcome': 'getWelcomeMessage',
                'order_confirmation': 'getOrderConfirmationMessage',
                'order_ready': 'getOrderReadyMessage',
                'delivery_notification': 'getDeliveryNotificationMessage',
                'pickup_reminder': 'getPickupReminderMessage',
                'payment_reminder': 'getPaymentReminderMessage',
                'fabric_welcome': 'getFabricWelcomeMessage',
                'fabric_purchase': 'getFabricPurchaseMessage',
                'fabric_payment_reminder': 'getFabricPaymentReminderMessage',
                'combined_order': 'getCombinedOrderMessage',
                'pickup_complete': 'getPickupCompleteMessage'
            };

            const templateMethod = templateMap[messageType];
            if (!templateMethod) {
                logger.error(`❌ Unknown message type: ${messageType}`);
                return null;
            }

            // Generate message using template
            const message = this.messageTemplates[templateMethod](enrichedData);
            
            logger.info(`✅ Generated ${messageType} message (${message.length} characters)`);
            return message;

        } catch (error) {
            logger.error(`❌ Failed to generate message for ${messageType}:`, error);
            return null;
        }
    }

    /**
     * Enrich order data with default values
     */
    enrichOrderData(orderData) {
        const defaults = {
            shop_name: process.env.SHOP_NAME || 'RS Tailor & Fabric',
            shop_phone: process.env.SHOP_PHONE || '8824781960',
            business_hours: process.env.BUSINESS_HOURS || '10:00 AM - 8:00 PM',
            customer_name: orderData.customer_name || 'Customer',
            order_id: orderData.order_id || 'N/A',
            garment_type: orderData.garment_type || 'Item',
            total_amount: orderData.total_amount || 0,
            advance_payment: orderData.advance_payment || 0,
            remaining_amount: orderData.remaining_amount || 0,
            ready_date: orderData.ready_date || new Date().toLocaleDateString(),
            delivery_date: orderData.delivery_date || new Date().toLocaleDateString(),
            pickup_date: orderData.pickup_date || new Date().toLocaleDateString(),
            order_date: orderData.order_date || new Date().toLocaleDateString(),
            outstanding_amount: orderData.outstanding_amount || 0,
            paid_today: orderData.paid_today || 0,
            final_payment: orderData.final_payment || 0,
            fabric_type: orderData.fabric_type || 'Fabric',
            brand_name: orderData.brand_name || 'Brand',
            fabric_order_id: orderData.fabric_order_id || 'N/A',
            tailor_order_id: orderData.tailor_order_id || 'N/A',
            fabric_total: orderData.fabric_total || 0,
            fabric_advance: orderData.fabric_advance || 0,
            fabric_remaining: orderData.fabric_remaining || 0,
            fabric_quantity: orderData.fabric_quantity || 0,
            fabric_purchase_date: orderData.fabric_purchase_date || new Date().toLocaleDateString(),
            tailor_total: orderData.tailor_total || 0,
            tailor_advance: orderData.tailor_advance || 0,
            tailor_remaining: orderData.tailor_remaining || 0,
            quantity: orderData.quantity || 0,
            notes: orderData.notes || 'N/A',
            days_since_ready: orderData.days_since_ready || 0
        };

        return { ...defaults, ...orderData };
    }

    /**
     * Test message sending functionality
     */
    async testMessage(phoneNumber, messageType = 'welcome') {
        try {
            if (!this.whatsappClient.isWhatsAppConnected()) {
                throw new Error('WhatsApp is not connected');
            }

            const testData = {
                customer_name: 'Test Customer',
                phone_number: phoneNumber,
                order_id: 'TEST001',
                garment_type: 'Test Item',
                total_amount: 500,
                advance_payment: 200,
                remaining_amount: 300,
                order_date: new Date().toLocaleDateString(),
                notes: 'Test message'
            };

            const message = this.generateMessage(messageType, testData);
            if (!message) {
                throw new Error('Failed to generate test message');
            }

            // Check if there's media for this message type
            const mediaData = this.getMediaForMessage(messageType, testData);
            
            let result;
            if (mediaData) {
                result = await this.sendMessageWithMedia(phoneNumber, message, mediaData);
            } else {
                result = await this.whatsappClient.sendMessage(phoneNumber, message);
            }
            
            logger.info(`✅ Test message sent successfully to ${phoneNumber}`);
            return {
                success: true,
                messageType,
                phone: phoneNumber,
                messageLength: message.length,
                hasMedia: !!mediaData
            };

        } catch (error) {
            logger.error(`❌ Test message failed:`, error);
            throw error;
        }
    }

    /**
     * Test image message sending
     */
    async testImageMessage(phoneNumber, imagePath, caption = 'Test image message from RS Tailor & Fabric') {
        try {
            if (!this.whatsappClient.isWhatsAppConnected()) {
                throw new Error('WhatsApp is not connected');
            }

            const result = await this.whatsappClient.sendImageMessage(phoneNumber, imagePath, caption);
            
            logger.info(`✅ Test image message sent successfully to ${phoneNumber}`);
            return {
                success: true,
                messageType: 'image',
                phone: phoneNumber,
                imagePath: imagePath
            };

        } catch (error) {
            logger.error(`❌ Test image message failed:`, error);
            throw error;
        }
    }

    /**
     * Test video message sending
     */
    async testVideoMessage(phoneNumber, videoPath, caption = 'Test video message from RS Tailor & Fabric', options = {}) {
        try {
            if (!this.whatsappClient.isWhatsAppConnected()) {
                throw new Error('WhatsApp is not connected');
            }

            const result = await this.whatsappClient.sendVideoMessage(phoneNumber, videoPath, caption, options);
            
            logger.info(`✅ Test video message sent successfully to ${phoneNumber}`);
            return {
                success: true,
                messageType: 'video',
                phone: phoneNumber,
                videoPath: videoPath,
                options: options
            };

        } catch (error) {
            logger.error(`❌ Test video message failed:`, error);
            throw error;
        }
    }

    /**
     * Get processor status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            whatsappConnected: this.whatsappClient?.isWhatsAppConnected() || false,
            googleSheetsConnected: this.googleSheetsService?.isInitialized || false,
            availableTemplates: this.messageTemplates.getAvailableTemplates()
        };
    }
}

module.exports = MessageProcessor;
