/**
 * WhatsApp Tailor Bot - Main Application Entry Point
 * Version: 2.0.0
 * Description: Fresh start with clean architecture
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const WhatsAppClient = require('./services/whatsapp-client');
const GoogleSheetsService = require('./services/google-sheets-service');
const MessageProcessor = require('./services/message-processor');
const MediaUtils = require('./utils/media-utils');

// Basic logging setup
const logger = require('pino')({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    }
});

class WhatsAppTailorBot {
    constructor() {
        this.config = this.loadConfiguration();
        this.isRunning = false;
        this.app = express();
        this.server = null;
        this.whatsappClient = new WhatsAppClient();
        this.googleSheetsService = new GoogleSheetsService();
        this.messageProcessor = null; // Will be initialized after WhatsApp client
        this.mediaUtils = new MediaUtils();
        
        logger.info('🤖 WhatsApp Tailor Bot V2.0 - Initializing...');
        logger.info('📍 Shop: RS Tailor & Fabric, Kumher');
        
        // Setup Express app
        this.setupExpressApp();
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }
    
    /**
     * Load and validate configuration
     */
    loadConfiguration() {
        const requiredEnvVars = [
            'GOOGLE_SHEET_ID',
            'WHATSAPP_ADMIN_PHONE',
            'SHOP_NAME',
            'SHOP_PHONE'
        ];
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            logger.error('❌ Missing required environment variables:', missingVars);
            process.exit(1);
        }
        
        return {
            // Google Sheets
            googleSheetId: process.env.GOOGLE_SHEET_ID,
            
            // WhatsApp Configuration  
            adminPhone: process.env.WHATSAPP_ADMIN_PHONE,
            brotherPhone: process.env.WHATSAPP_BROTHER_PHONE,
            authMode: process.env.WHATSAPP_AUTH_MODE || 'both',
            
            // Shop Information
            shopName: process.env.SHOP_NAME,
            shopPhone: process.env.SHOP_PHONE,
            businessHours: process.env.BUSINESS_HOURS || '10:00 AM - 8:00 PM',
            
            // Bot Configuration
            botMode: process.env.BOT_MODE || 'AUTO',
            logLevel: process.env.LOG_LEVEL || 'info',
            
            // Security
            apiSecretKey: process.env.API_SECRET_KEY,
            jwtSecret: process.env.JWT_SECRET,
            databaseEncryptionKey: process.env.DATABASE_ENCRYPTION_KEY,
            
            // Development flags
            mockWhatsApp: process.env.MOCK_WHATSAPP === 'true',
            disablePolling: process.env.DISABLE_POLLING === 'true',
            
            // Server configuration
            port: process.env.PORT || 3001,
            webhookSecret: process.env.WEBHOOK_SECRET || process.env.API_SECRET_KEY
        };
    }
    
    /**
     * Setup Express application with middleware and routes
     */
    setupExpressApp() {
        // Basic middleware
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging middleware
        this.app.use((req, res, next) => {
            logger.info(`📨 ${req.method} ${req.path} - ${req.ip}`);
            next();
        });
        
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '2.0.0',
                service: 'WhatsApp Tailor Bot',
                shop: this.config.shopName,
                uptime: process.uptime()
            });
        });
        
        // Webhook endpoint for Google Apps Script
        this.app.post('/api/webhook/google-sheets', this.handleWebhook.bind(this));
        
        // Test endpoint for sending WhatsApp messages
        this.app.post('/api/test-send', async (req, res) => {
            try {
                logger.info('🧪 Test send request received');
                const { phone, message, messageType } = req.body;
                
                if (!phone) {
                    return res.status(400).json({
                        error: 'Missing phone number in request body',
                        example: { phone: '7375938371', message: 'Hello, this is a test message from your WhatsApp bot!' }
                    });
                }
                
                if (!this.whatsappClient || !this.whatsappClient.isWhatsAppConnected()) {
                    return res.status(503).json({
                        error: 'WhatsApp is not connected',
                        status: this.whatsappClient?.getConnectionStatus() || 'No WhatsApp client'
                    });
                }
                
                let result;
                if (messageType && this.messageProcessor) {
                    // Send template-based message
                    logger.info(`📤 Sending ${messageType} template message to ${phone}`);
                    result = await this.messageProcessor.testMessage(phone, messageType);
                } else if (message) {
                    // Send custom message
                    logger.info(`📤 Sending custom message to ${phone}`);
                    result = await this.whatsappClient.sendMessage(phone, message);
                } else {
                    return res.status(400).json({
                        error: 'Either message or messageType is required',
                        example: { 
                            phone: '7375938371', 
                            message: 'Hello, this is a test message!',
                            messageType: 'welcome'
                        }
                    });
                }
                
                res.json({
                    success: true,
                    message: 'Test message sent successfully',
                    phone: phone,
                    messageType: messageType || 'custom',
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('❌ Test send failed:', error);
                res.status(500).json({
                    error: 'Failed to send message',
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Test endpoint for sending image messages
        this.app.post('/api/test-send-image', async (req, res) => {
            try {
                logger.info('🧪 Test image send request received');
                const { phone, imagePath, caption, viewOnce } = req.body;
                
                if (!phone) {
                    return res.status(400).json({
                        error: 'Missing phone number in request body',
                        example: { 
                            phone: '7375938371', 
                            imagePath: './media/images/welcome-image.jpg', 
                            caption: 'Welcome to RS Tailor & Fabric!' 
                        }
                    });
                }
                
                if (!imagePath) {
                    return res.status(400).json({
                        error: 'Missing imagePath in request body',
                        example: { 
                            phone: '7375938371', 
                            imagePath: './media/images/welcome-image.jpg', 
                            caption: 'Welcome to RS Tailor & Fabric!' 
                        }
                    });
                }
                
                if (!this.whatsappClient || !this.whatsappClient.isWhatsAppConnected()) {
                    return res.status(503).json({
                        error: 'WhatsApp is not connected',
                        status: this.whatsappClient?.getConnectionStatus() || 'No WhatsApp client'
                    });
                }
                
                logger.info(`📤 Sending image message to ${phone}`);
                const result = await this.whatsappClient.sendImageMessage(
                    phone, 
                    imagePath, 
                    caption || 'Image from RS Tailor & Fabric',
                    viewOnce || false
                );
                
                res.json({
                    success: true,
                    message: 'Test image sent successfully',
                    phone: phone,
                    imagePath: imagePath,
                    caption: caption,
                    viewOnce: viewOnce,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('❌ Test image send failed:', error);
                res.status(500).json({
                    error: 'Failed to send image',
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Test endpoint for sending video messages
        this.app.post('/api/test-send-video', async (req, res) => {
            try {
                logger.info('🧪 Test video send request received');
                const { phone, videoPath, caption, gifPlayback, viewOnce, ptv } = req.body;
                
                if (!phone) {
                    return res.status(400).json({
                        error: 'Missing phone number in request body',
                        example: { 
                            phone: '7375938371', 
                            videoPath: './media/videos/shop-tour.mp4', 
                            caption: 'Virtual tour of RS Tailor & Fabric!' 
                        }
                    });
                }
                
                if (!videoPath) {
                    return res.status(400).json({
                        error: 'Missing videoPath in request body',
                        example: { 
                            phone: '7375938371', 
                            videoPath: './media/videos/shop-tour.mp4', 
                            caption: 'Virtual tour of RS Tailor & Fabric!' 
                        }
                    });
                }
                
                if (!this.whatsappClient || !this.whatsappClient.isWhatsAppConnected()) {
                    return res.status(503).json({
                        error: 'WhatsApp is not connected',
                        status: this.whatsappClient?.getConnectionStatus() || 'No WhatsApp client'
                    });
                }
                
                logger.info(`📤 Sending video message to ${phone}`);
                const result = await this.whatsappClient.sendVideoMessage(
                    phone, 
                    videoPath, 
                    caption || 'Video from RS Tailor & Fabric',
                    {
                        gifPlayback: gifPlayback || false,
                        viewOnce: viewOnce || false,
                        ptv: ptv || false
                    }
                );
                
                res.json({
                    success: true,
                    message: 'Test video sent successfully',
                    phone: phone,
                    videoPath: videoPath,
                    caption: caption,
                    options: {
                        gifPlayback: gifPlayback,
                        viewOnce: viewOnce,
                        ptv: ptv
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('❌ Test video send failed:', error);
                res.status(500).json({
                    error: 'Failed to send video',
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Test endpoint for sending audio messages
        this.app.post('/api/test-send-audio', async (req, res) => {
            try {
                logger.info('🧪 Test audio send request received');
                const { phone, audioPath, mimetype, ptt } = req.body;
                
                if (!phone) {
                    return res.status(400).json({
                        error: 'Missing phone number in request body',
                        example: { 
                            phone: '7375938371', 
                            audioPath: './media/audio/welcome-message.mp3' 
                        }
                    });
                }
                
                if (!audioPath) {
                    return res.status(400).json({
                        error: 'Missing audioPath in request body',
                        example: { 
                            phone: '7375938371', 
                            audioPath: './media/audio/welcome-message.mp3' 
                        }
                    });
                }
                
                if (!this.whatsappClient || !this.whatsappClient.isWhatsAppConnected()) {
                    return res.status(503).json({
                        error: 'WhatsApp is not connected',
                        status: this.whatsappClient?.getConnectionStatus() || 'No WhatsApp client'
                    });
                }
                
                logger.info(`📤 Sending audio message to ${phone}`);
                const result = await this.whatsappClient.sendAudioMessage(
                    phone, 
                    audioPath, 
                    mimetype || 'audio/mp4',
                    ptt || false
                );
                
                res.json({
                    success: true,
                    message: 'Test audio sent successfully',
                    phone: phone,
                    audioPath: audioPath,
                    mimetype: mimetype,
                    ptt: ptt,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('❌ Test audio send failed:', error);
                res.status(500).json({
                    error: 'Failed to send audio',
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Media status and management endpoint
        this.app.get('/api/media/status', (req, res) => {
            try {
                // Create media directories if they don't exist
                this.mediaUtils.createMediaDirectories();
                
                // Get media directory info
                const mediaDir = path.join(__dirname, '../media');
                
                const getDirectoryInfo = (dirPath) => {
                    if (!fs.existsSync(dirPath)) return { exists: false, files: 0, size: 0 };
                    
                    const files = fs.readdirSync(dirPath);
                    let totalSize = 0;
                    
                    files.forEach(file => {
                        const filePath = path.join(dirPath, file);
                        if (fs.statSync(filePath).isFile()) {
                            totalSize += fs.statSync(filePath).size;
                        }
                    });
                    
                    return {
                        exists: true,
                        files: files.filter(f => fs.statSync(path.join(dirPath, f)).isFile()).length,
                        size: totalSize,
                        sizeFormatted: this.mediaUtils.formatFileSize(totalSize)
                    };
                };
                
                const mediaStatus = {
                    mediaDirectory: mediaDir,
                    directories: {
                        images: getDirectoryInfo(path.join(mediaDir, 'images')),
                        videos: getDirectoryInfo(path.join(mediaDir, 'videos')),
                        audio: getDirectoryInfo(path.join(mediaDir, 'audio')),
                        documents: getDirectoryInfo(path.join(mediaDir, 'documents'))
                    },
                    supportedFormats: {
                        images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                        videos: ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
                        audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
                        documents: ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls']
                    },
                    sizeLimits: {
                        images: '16MB',
                        videos: '64MB',
                        audio: '16MB',
                        documents: '100MB'
                    },
                    endpoints: {
                        testImage: 'POST /api/test-send-image',
                        testVideo: 'POST /api/test-send-video',
                        testAudio: 'POST /api/test-send-audio',
                        mediaStatus: 'GET /api/media/status'
                    }
                };
                
                res.json({
                    success: true,
                    mediaCapabilities: 'Fully Supported',
                    status: mediaStatus,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('❌ Media status check failed:', error);
                res.status(500).json({
                    error: 'Failed to get media status',
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Media cleanup endpoint
        this.app.post('/api/media/cleanup', (req, res) => {
            try {
                const { maxAgeHours = 24 } = req.body;
                const deletedCount = this.mediaUtils.cleanupOldFiles(maxAgeHours);
                
                res.json({
                    success: true,
                    message: `Cleaned up ${deletedCount} old media files`,
                    deletedFiles: deletedCount,
                    maxAgeHours: maxAgeHours,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                logger.error('❌ Media cleanup failed:', error);
                res.status(500).json({
                    error: 'Failed to cleanup media files',
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                path: req.originalUrl,
                availableEndpoints: [
                    'GET /api/health',
                    'POST /api/webhook/google-sheets',
                    'POST /api/test-send',
                    'POST /api/test-send-image',
                    'POST /api/test-send-video',
                    'POST /api/test-send-audio',
                    'GET /api/media/status',
                    'POST /api/media/cleanup'
                ],
                timestamp: new Date().toISOString()
            });
        });
        
        // Error handler
        this.app.use((error, req, res, next) => {
            logger.error('💥 Express error:', error);
            res.status(500).json({
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        });
    }
    
    /**
     * Handle incoming webhook from Google Apps Script
     */
    async handleWebhook(req, res) {
        try {
            logger.info('🔗 Webhook received from Google Apps Script');
            
            // Verify webhook secret
            const providedSecret = req.headers['x-webhook-secret'];
            if (providedSecret !== this.config.webhookSecret) {
                logger.warn('🔒 Invalid webhook secret');
                return res.status(401).json({ error: 'Unauthorized' });
            }
            
            const { event, message_type, order_data, sheet_name, sheet_row } = req.body;
            
            logger.info('📋 Webhook details:', {
                event,
                message_type,
                sheet_name,
                sheet_row,
                customer: order_data?.customer_name,
                phone: order_data?.phone_number
            });
            
            // Handle different message types
            if (event === 'connectivity_test') {
                logger.info('🔍 Connectivity test received');
                return res.json({
                    status: 'success',
                    message: 'Webhook connectivity confirmed',
                    timestamp: new Date().toISOString(),
                    bot_status: 'ready'
                });
            }
            
            if (event === 'order_update' && message_type && order_data) {
                logger.info(`💬 Processing ${message_type} message for ${order_data.customer_name}`);
                
                // Acknowledge receipt immediately
                res.json({
                    status: 'success',
                    message: 'Webhook processed successfully',
                    message_type,
                    customer: order_data.customer_name,
                    timestamp: new Date().toISOString()
                });
                
                // Process the order and send WhatsApp message
                this.processOrderMessage(message_type, order_data, sheet_name, sheet_row);
            } else {
                logger.warn('⚠️ Invalid webhook payload');
                res.status(400).json({ error: 'Invalid webhook payload' });
            }
            
        } catch (error) {
            logger.error('💥 Webhook processing error:', error);
            res.status(500).json({
                error: 'Webhook processing failed',
                timestamp: new Date().toISOString()
            });
        }
    }
    
    /**
     * Process order message and send WhatsApp notification
     */
    async processOrderMessage(messageType, orderData, sheetName, sheetRow) {
        try {
            logger.info(`🔄 Processing ${messageType} for ${orderData.customer_name}`);
            
            if (!this.messageProcessor) {
                logger.error('❌ Message processor not initialized');
                return;
            }
            
            // Process the order and send WhatsApp message
            const result = await this.messageProcessor.processOrderMessage(
                messageType, 
                orderData, 
                sheetName, 
                sheetRow
            );
            
            logger.info('✅ Message processing completed successfully', result);
            
        } catch (error) {
            logger.error('💥 Message processing error:', error);
        }
    }
    
    /**
     * Initialize all bot components
     */
    async initialize() {
        try {
            logger.info('🔧 Initializing bot components...');
            
            // Start Express server
            logger.info('🌐 Starting Express server...');
            await this.startServer();
            logger.info('✅ Express server started successfully');
            
            // Initialize Google Sheets service
            logger.info('📊 Initializing Google Sheets service...');
            try {
                await this.googleSheetsService.initialize();
            } catch (error) {
                logger.error('❌ Google Sheets service initialization failed:', error.message);
                throw error;
            }
            
            // Initialize WhatsApp client
            logger.info('📱 Initializing WhatsApp client...');
            try {
                await this.whatsappClient.initialize();
            } catch (error) {
                logger.error('❌ WhatsApp client initialization failed:', error.message);
                logger.error('Stack:', error.stack);
                throw error;
            }
            
            // Initialize message processor
            logger.info('💬 Initializing message processor...');
            try {
                this.messageProcessor = new MessageProcessor(this.whatsappClient, this.googleSheetsService);
                await this.messageProcessor.initialize();
            } catch (error) {
                logger.error('❌ Message processor initialization failed:', error.message);
                throw error;
            }
            
            logger.info('✅ Bot initialization complete!');
            
        } catch (error) {
            logger.error('❌ Bot initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Start Express server
     */
    async startServer() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.config.port, (error) => {
                if (error) {
                    logger.error(`❌ Failed to start server on port ${this.config.port}:`, error);
                    reject(error);
                } else {
                    logger.info(`🌐 Express server running on port ${this.config.port}`);
                    logger.info(`🔗 Webhook endpoint: http://localhost:${this.config.port}/api/webhook/google-sheets`);
                    logger.info(`🏥 Health check: http://localhost:${this.config.port}/api/health`);
                    resolve();
                }
            });
        });
    }
    
    /**
     * Start the bot
     */
    async start() {
        try {
            if (this.isRunning) {
                logger.warn('⚠️ Bot is already running');
                return;
            }
            
            logger.info('🚀 Starting WhatsApp Tailor Bot...');
            
            await this.initialize();
            
            this.isRunning = true;
            
            logger.info('🎉 Bot started successfully!');
            logger.info('📱 Waiting for WhatsApp connection...');
            
            // Keep the process running
            this.keepAlive();
            
        } catch (error) {
            logger.error('❌ Failed to start bot:', error);
            process.exit(1);
        }
    }
    
    /**
     * Stop the bot gracefully
     */
    async stop() {
        try {
            if (!this.isRunning) {
                logger.warn('⚠️ Bot is not running');
                return;
            }
            
            logger.info('🛑 Stopping WhatsApp Tailor Bot...');
            
            this.isRunning = false;
            
            // Close Express server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close(() => {
                        logger.info('🌐 Express server closed');
                        resolve();
                    });
                });
            }
            
            // Close WhatsApp client
            if (this.whatsappClient) {
                await this.whatsappClient.shutdown();
            }
            
            // Close Google Sheets service
            if (this.googleSheetsService) {
                // Google Sheets service doesn't need explicit shutdown
                logger.info('📊 Google Sheets service closed');
            }
            
            logger.info('✅ Bot stopped successfully');
            
        } catch (error) {
            logger.error('❌ Error stopping bot:', error);
        }
    }
    
    /**
     * Keep the process alive
     */
    keepAlive() {
        setInterval(() => {
            if (this.isRunning) {
                logger.debug('💓 Bot heartbeat - Still running...');
            }
        }, 60000); // Every minute
    }
    
    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        
        signals.forEach(signal => {
            process.on(signal, async () => {
                logger.info(`📥 Received ${signal} - Shutting down gracefully...`);
                await this.stop();
                process.exit(0);
            });
        });
        
        process.on('uncaughtException', (error) => {
            logger.error('💥 Uncaught Exception:', error.message);
            logger.error('💥 Stack trace:', error.stack);
            process.exit(1);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }
    
    /**
     * Display configuration summary
     */
    displayConfig() {
        logger.info('📋 Bot Configuration:');
        logger.info(`   Shop: ${this.config.shopName}`);
        logger.info(`   Phone: ${this.config.shopPhone}`);
        logger.info(`   Hours: ${this.config.businessHours}`);
        logger.info(`   Admin: ${this.config.adminPhone}`);
        logger.info(`   Mode: ${this.config.botMode}`);
        logger.info(`   Auth: ${this.config.authMode}`);
        logger.info(`   Mock: ${this.config.mockWhatsApp}`);
    }
}

// Start the bot if this file is run directly
if (require.main === module) {
    const bot = new WhatsAppTailorBot();
    
    // Display configuration
    bot.displayConfig();
    
    // Start the bot
    bot.start().catch(error => {
        logger.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

module.exports = WhatsAppTailorBot;