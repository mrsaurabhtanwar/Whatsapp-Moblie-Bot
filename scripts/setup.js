/**
 * Setup Script for WhatsApp Tailor Bot V2.0
 * This script initializes the bot environment and database
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('pino')({ level: 'info' });

class BotSetup {
    constructor() {
        this.rootDir = path.resolve(__dirname, '..');
        logger.info('🔧 Bot Setup Utility V2.0');
    }
    
    async run() {
        try {
            logger.info('🚀 Starting bot setup...');
            
            await this.checkEnvironment();
            await this.createDirectories();
            await this.validateConfig();
            await this.initializeDatabase();
            await this.setupLogging();
            
            logger.info('✅ Setup completed successfully!');
            logger.info('🎯 You can now run: npm start');
            
        } catch (error) {
            logger.error('❌ Setup failed:', error);
            process.exit(1);
        }
    }
    
    async checkEnvironment() {
        logger.info('🔍 Checking environment...');
        
        // Check Node.js version
        const nodeVersion = process.version;
        logger.info(`   Node.js: ${nodeVersion}`);
        
        // Check for .env file
        const envPath = path.join(this.rootDir, '.env');
        try {
            await fs.access(envPath);
            logger.info('   ✅ .env file found');
        } catch {
            logger.warn('   ⚠️ .env file not found - using .env.example');
            await fs.copyFile(
                path.join(this.rootDir, '.env.example'),
                envPath
            );
        }
        
        // Check service account
        const serviceAccountPath = path.join(this.rootDir, 'service-account.json');
        try {
            await fs.access(serviceAccountPath);
            logger.info('   ✅ service-account.json found');
        } catch {
            logger.warn('   ⚠️ service-account.json not found - please add it');
        }
    }
    
    async createDirectories() {
        logger.info('📁 Creating directories...');
        
        const directories = [
            'logs',
            'data/sessions',
            'data/backups',
            'data/temp',
            'data/exports'
        ];
        
        for (const dir of directories) {
            const fullPath = path.join(this.rootDir, dir);
            try {
                await fs.mkdir(fullPath, { recursive: true });
                logger.info(`   📂 Created: ${dir}`);
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }
    
    async validateConfig() {
        logger.info('⚙️ Validating configuration...');
        
        require('dotenv').config({ path: path.join(this.rootDir, '.env') });
        
        const requiredVars = [
            'GOOGLE_SHEET_ID',
            'WHATSAPP_ADMIN_PHONE',
            'SHOP_NAME',
            'SHOP_PHONE',
            'API_SECRET_KEY',
            'JWT_SECRET',
            'DATABASE_ENCRYPTION_KEY'
        ];
        
        const missingVars = [];
        
        for (const varName of requiredVars) {
            if (!process.env[varName]) {
                missingVars.push(varName);
            } else {
                logger.info(`   ✅ ${varName}: Set`);
            }
        }
        
        if (missingVars.length > 0) {
            logger.error('   ❌ Missing environment variables:', missingVars);
            logger.error('   Please update your .env file');
            throw new Error('Missing required environment variables');
        }
    }
    
    async initializeDatabase() {
        logger.info('💾 Initializing database...');
        
        // TODO: Create SQLite database schema
        logger.info('   📊 Database schema - TODO');
        
        // TODO: Create tables for orders, customers, messages
        logger.info('   📋 Tables creation - TODO');
        
        // TODO: Migrate existing data if needed
        logger.info('   🔄 Data migration - TODO');
        
        logger.info('   ✅ Database initialization placeholder completed');
    }
    
    async setupLogging() {
        logger.info('📝 Setting up logging...');
        
        const logDir = path.join(this.rootDir, 'logs');
        const logFiles = [
            'app.log',
            'error.log',
            'whatsapp.log',
            'sheets.log'
        ];
        
        for (const logFile of logFiles) {
            const logPath = path.join(logDir, logFile);
            try {
                await fs.writeFile(logPath, '', { flag: 'a' });
                logger.info(`   📄 Log file ready: ${logFile}`);
            } catch (error) {
                logger.warn(`   ⚠️ Could not create log file: ${logFile}`);
            }
        }
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    const setup = new BotSetup();
    setup.run();
}

module.exports = BotSetup;