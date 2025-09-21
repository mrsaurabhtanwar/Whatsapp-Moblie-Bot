/**
 * WhatsApp Tailor Bot - Main Application Entry Point
 * Version: 2.0.0
 * Description: Fresh start with clean architecture
 */

require('dotenv').config();
const path = require('path');

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
        
        logger.info('🤖 WhatsApp Tailor Bot V2.0 - Initializing...');
        logger.info('📍 Shop: RS Tailor & Fabric, Kumher');
        
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
            disablePolling: process.env.DISABLE_POLLING === 'true'
        };
    }
    
    /**
     * Initialize all bot components
     */
    async initialize() {
        try {
            logger.info('🔧 Initializing bot components...');
            
            // TODO: Initialize WhatsApp client
            logger.info('📱 WhatsApp client initialization - TODO');
            
            // TODO: Initialize Google Sheets service
            logger.info('📊 Google Sheets service initialization - TODO');
            
            // TODO: Initialize message templates
            logger.info('💬 Message templates initialization - TODO');
            
            // TODO: Initialize database
            logger.info('💾 Database initialization - TODO');
            
            // TODO: Initialize web server (if needed)
            logger.info('🌐 Web server initialization - TODO');
            
            logger.info('✅ Bot initialization complete!');
            
        } catch (error) {
            logger.error('❌ Bot initialization failed:', error);
            throw error;
        }
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
            
            // TODO: Close WhatsApp client
            // TODO: Close database connections
            // TODO: Close web server
            
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
            logger.error('💥 Uncaught Exception:', error);
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