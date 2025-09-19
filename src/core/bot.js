require('dotenv').config();
const express = require('express');
const PQueue = require('p-queue').default;
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

// Import our organized modules
const EnhancedWhatsAppClient = require('./enhanced-whatsapp-client');
const MessageTemplates = require('../managers/message-templates');
const AdminCommands = require('../managers/admin-commands');
const DuplicatePreventionManager = require('../managers/duplicate-prevention-manager');
const EnhancedSafetyManager = require('../managers/enhanced-safety-manager');
const AuthConfig = require('../config/auth-config');
const EnhancedLogger = require('../utils/enhanced-logger');

/**
 * Consolidated WhatsApp Bot - Production Ready
 * 
 * This is the main bot file that combines all the best features from:
 * - main-bot.js (legacy bot with full functionality)
 * - worker.js (enhanced bot with safety features)
 * - worker-backup-with-pairing.js (backup functionality)
 * - worker-qr-only.js (QR-only mode)
 * 
 * Features:
 * - 12-layer safety system
 * - Multiple authentication modes (QR + Phone)
 * - Google Sheets integration
 * - Admin commands
 * - Duplicate prevention
 * - Enhanced logging
 * - Process management
 * - Health monitoring
 */
class WhatsAppBot {
    constructor() {
        this.app = express();
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // Core properties
        this.whatsapp = null;
        this.isConnected = false;
        this.isPolling = false;
        this.messageQueue = new PQueue({ concurrency: 1 });
        this.messageTemplates = new MessageTemplates();
        this.adminCommands = null;
        
        // Enhanced systems
        this.authConfig = new AuthConfig();
        this.logger = new EnhancedLogger({
            logDir: path.join(__dirname, '../../logs'),
            logLevel: process.env.LOG_LEVEL || 'INFO'
        });
        
        // Google Sheets integration
        this.sheets = null;
        this.sheetConfigs = [
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Main Orders',
                type: 'orders'
            },
            {
                id: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
                name: 'Fabric Orders',
                type: 'fabric'
            },
            {
                id: process.env.COMBINED_SHEET_ID || '199mFt3yz1cZQUGcF84pZgNQoxCpOS2gHxFGDD71CZVg',
                name: 'Combined Orders',
                type: 'combined-orders'
            }
        ];
        
        // Process lock manager
        this.lockManager = new ProcessLockManager();
        
        // QR code state
        this.currentQRCode = null;
        this.qrCodeGenerated = false;
        
        this.setupRoutes();
        this.setupEventHandlers();
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing WhatsApp Bot...');
            
            // Check if we can start
            const canStart = await this.lockManager.canStart();
            if (!canStart) {
                this.logger.error('❌ Another instance is already running');
                process.exit(1);
            }

            // Initialize Google Sheets
            await this.initializeGoogleSheets();
            
            // Initialize Enhanced WhatsApp client
            this.logger.info('📱 Initializing Enhanced WhatsApp client...');
            this.whatsapp = new EnhancedWhatsAppClient({
                duplicatePreventionEnabled: true,
                maxMessagesPerDay: 5,
                messageCooldownMs: 300000, // 5 minutes
                duplicateCheckWindowMs: 24 * 60 * 60 * 1000 // 24 hours
            });
            await this.whatsapp.initialize();
            
            this.logger.info('✅ WhatsApp Bot initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize bot:', error);
            await this.lockManager.releaseLock();
            process.exit(1);
        }
    }

    async initializeGoogleSheets() {
        try {
            this.logger.info('🔑 Initializing Google Sheets API...');
            
            const serviceAccountPath = path.join(__dirname, '../../service-account.json');
            if (!require('fs').existsSync(serviceAccountPath)) {
                throw new Error('Service account file not found: service-account.json');
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            this.logger.info('✅ Google Sheets API initialized');
        } catch (error) {
            this.logger.error('❌ Google Sheets initialization failed:', error.message);
            throw error;
        }
    }

    setupEventHandlers() {
        // WhatsApp connection events
        this.whatsapp?.on('connected', () => {
            this.logger.info('🎉 WhatsApp connected successfully!');
            this.isConnected = true;
            this.currentQRCode = null;
            this.qrCodeGenerated = false;
            
            // Initialize admin commands after WhatsApp connection
            this.initializeAdminCommands();
            
            // Start automatic polling after connection
            setTimeout(() => {
                this.startPolling();
            }, 5000); // 5 second delay after connection
        });

        this.whatsapp?.on('disconnected', () => {
            this.logger.warn('🔌 WhatsApp disconnected');
            this.isConnected = false;
        });

        this.whatsapp?.on('qr', (qr) => {
            this.logger.info('📱 QR Code generated');
            this.currentQRCode = qr;
            this.qrCodeGenerated = true;
        });

        this.whatsapp?.on('pairing-code', (data) => {
            this.logger.info(`📞 Pairing code generated: ${data.code}`);
        });

        // Process cleanup
        process.on('SIGINT', async () => {
            this.logger.info('🛑 Shutting down bot...');
            await this.cleanup();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            this.logger.info('🛑 Shutting down bot...');
            await this.cleanup();
            process.exit(0);
        });
    }

    initializeAdminCommands() {
        try {
            this.adminCommands = new AdminCommands(
                this.whatsapp,
                this, // Pass this bot instance as sheets helper
                this.messageQueue,
                this.messageTemplates
            );
            
            // Set up message handler for incoming WhatsApp messages
            if (this.whatsapp.socket && this.whatsapp.socket.ev) {
                this.whatsapp.socket.ev.on('messages.upsert', (m) => {
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
            }
            
            this.logger.info('✅ Admin commands system initialized');
        } catch (error) {
            this.logger.error('❌ Failed to initialize admin commands:', error);
        }
    }

    async handleIncomingMessage(messageData) {
        try {
            if (this.adminCommands) {
                await this.adminCommands.handleIncomingMessage(messageData);
            }
        } catch (error) {
            this.logger.error('❌ Error handling incoming message:', error);
        }
    }

    setupRoutes() {
        // Health check
        this.app.get('/status', (req, res) => {
            const status = this.whatsapp?.getAuthStatus() || { isConnected: false, state: 'disconnected' };
            res.json({
                success: true,
                whatsapp: {
                    isConnected: this.isConnected,
                    state: status.state || 'disconnected',
                    qrCode: this.currentQRCode,
                    hasQRCode: this.qrCodeGenerated
                },
                server: 'running',
                timestamp: new Date().toISOString()
            });
        });

        // Main dashboard
        this.app.get('/', (req, res) => {
            const status = this.whatsapp?.getAuthStatus() || { isConnected: false, state: 'disconnected' };
            const qrDataURL = this.currentQRCode ? `data:image/png;base64,${this.currentQRCode}` : null;
            
            const htmlResponse = `<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Bot Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 500px;
            width: 90%;
            text-align: center;
        }
        .status {
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            font-weight: 500;
        }
        .status.connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status.disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .qr-container {
            margin: 30px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
        }
        .qr-code {
            max-width: 300px;
            width: 100%;
            height: auto;
            border-radius: 10px;
        }
        .instructions {
            background: #e9ecef;
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: left;
        }
        .instructions h3 { margin-bottom: 15px; color: #495057; }
        .instructions ol { padding-left: 20px; }
        .instructions li { margin: 8px 0; }
        .btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: background 0.3s;
        }
        .btn:hover { background: #0056b3; }
        .refresh-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            margin: 10px;
        }
        .refresh-btn:hover { background: #218838; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 WhatsApp Bot Dashboard</h1>
        <p>Connect your WhatsApp using QR code or phone number</p>
        
        <div id="status" class="status ${this.isConnected ? 'connected' : 'disconnected'}">
            ${this.isConnected ? '✅ WhatsApp Connected' : '❌ WhatsApp Disconnected'}
        </div>
        
        ${!this.isConnected ? `
        <div class="qr-container">
            <h3>📱 Scan QR Code</h3>
            ${qrDataURL ? `
                <img src="${qrDataURL}" alt="QR Code" class="qr-code">
                <p>Scan this QR code with WhatsApp to connect</p>
            ` : `
                <p>⏳ Generating QR code...</p>
                <p>Please wait while we prepare the QR code for you.</p>
            `}
        </div>
        
        <div class="instructions">
            <h3>📋 How to Connect:</h3>
            <ol>
                <li>Open WhatsApp on your phone</li>
                <li>Go to Settings → Linked Devices</li>
                <li>Tap "Link a Device"</li>
                <li>Scan the QR code above</li>
                <li>Wait for connection confirmation</li>
            </ol>
        </div>
        
        <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Status</button>
        ` : `
        <div class="instructions">
            <h3>🎉 Successfully Connected!</h3>
            <p>Your WhatsApp is now connected to the bot.</p>
            <p>The bot will automatically process orders from Google Sheets.</p>
        </div>
        `}
    </div>
    
    <script>
        // Auto-refresh every 5 seconds if not connected
        if (!${this.isConnected}) {
            setTimeout(() => {
                location.reload();
            }, 5000);
        }
    </script>
</body>
</html>`;
            
            res.send(htmlResponse);
        });

        // Admin commands
        this.app.post('/admin/restart', async (req, res) => {
            try {
                this.logger.info('🔄 Restarting WhatsApp connection...');
                await this.whatsapp?.restart();
                res.json({ success: true, message: 'WhatsApp connection restarted' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Start polling endpoint
        this.app.post('/start-polling', async (req, res) => {
            try {
                if (this.isPolling) {
                    return res.json({ success: false, message: 'Already polling' });
                }
                
                this.isPolling = true;
                this.logger.info('🔄 Starting message polling...');
                res.json({ success: true, message: 'Polling started' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Stop polling endpoint
        this.app.post('/stop-polling', async (req, res) => {
            try {
                this.isPolling = false;
                this.logger.info('⏹️ Stopping message polling...');
                res.json({ success: true, message: 'Polling stopped' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    async start() {
        try {
            await this.initialize();
            
            const port = process.env.PORT || 3001;
            this.app.listen(port, () => {
                this.logger.info(`🚀 WhatsApp Bot running on http://localhost:${port}`);
                this.logger.info('📱 Open the dashboard to scan QR code and connect WhatsApp');
            });
            
        } catch (error) {
            this.logger.error('❌ Failed to start bot:', error);
            await this.cleanup();
            process.exit(1);
        }
    }

    // ==================== GOOGLE SHEETS INTEGRATION ====================
    
    async getAllOrders() {
        try {
            const allOrders = [];
            
            for (const config of this.sheetConfigs) {
                try {
                    const orders = await this.getSheetData(config);
                    allOrders.push(...orders.map(order => ({
                        ...order,
                        sheetType: config.type,
                        sheetName: config.name
                    })));
                } catch (error) {
                    this.logger.error(`Failed to get orders from ${config.name}:`, error.message);
                }
            }
            
            return allOrders;
        } catch (error) {
            this.logger.error('Failed to get all orders:', error.message);
            return [];
        }
    }
    
    async getSheetData(config) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: config.id,
                range: `${config.name}!A:Z`
            });
            
            const rows = response.data.values || [];
            if (rows.length <= 1) return [];
            
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            return dataRows.map(row => {
                const orderData = {};
                headers.forEach((header, index) => {
                    if (header && row[index]) {
                        orderData[header] = row[index];
                    }
                });
                return orderData;
            });
        } catch (error) {
            this.logger.error(`Failed to get sheet data from ${config.name}:`, error.message);
            return [];
        }
    }
    
    async processOrders() {
        try {
            if (!this.isConnected || !this.whatsapp) {
                this.logger.warn('Cannot process orders: WhatsApp not connected');
                return;
            }
            
            this.logger.info('🔄 Processing orders from Google Sheets...');
            
            for (const config of this.sheetConfigs) {
                try {
                    await this.processSheetOrders(config);
                } catch (error) {
                    this.logger.error(`Failed to process ${config.name}:`, error.message);
                }
            }
        } catch (error) {
            this.logger.error('Failed to process orders:', error.message);
        }
    }
    
    async processSheetOrders(config) {
        try {
            const orders = await this.getSheetData(config);
            
            for (const order of orders) {
                if (this.shouldSendNotification(order, config.type)) {
                    await this.sendOrderNotification(order, config.type);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to process orders from ${config.name}:`, error.message);
        }
    }
    
    shouldSendNotification(order, sheetType) {
        try {
            const status = (order['Delivery Status'] || order['Status'] || '').toLowerCase().trim();
            const phone = order['Phone'] || order['Contact Info'] || order['Contact Number'];
            const orderId = order['Order ID'] || order['Master Order ID'];
            
            // Basic validation
            if (!phone || !orderId) {
                return false;
            }
            
            // Check notification flags
            const readyNotified = order['Ready Notified'] || order['Ready Notification'];
            const deliveryNotified = order['Delivery Notified'] || order['Delivery Notification'];
            
            // Determine message type based on status and notification flags
            if (['ready', 'completed', 'pickup'].includes(status) && 
                (!readyNotified || readyNotified.toLowerCase() === 'no')) {
                return true; // Send ready notification
            }
            
            if (['delivered', 'completed'].includes(status) && 
                (!deliveryNotified || deliveryNotified.toLowerCase() === 'no')) {
                return true; // Send delivery notification
            }
            
            return false;
        } catch (error) {
            this.logger.error('Error checking notification conditions:', error.message);
            return false;
        }
    }
    
    async sendOrderNotification(order, sheetType) {
        try {
            const phone = order['Phone'] || order['Contact Info'] || order['Contact Number'];
            const orderId = order['Order ID'] || order['Master Order ID'];
            const status = (order['Delivery Status'] || order['Status'] || '').toLowerCase().trim();
            
            if (!phone || !orderId) {
                this.logger.warn('Cannot send notification: missing phone or order ID');
                return;
            }
            
            // Format phone number
            const formattedPhone = phone.replace(/\D/g, '');
            if (!formattedPhone.startsWith('91')) {
                const formattedPhone = '91' + formattedPhone;
            }
            
            // Determine message type and send appropriate notification
            if (['ready', 'completed', 'pickup'].includes(status)) {
                await this.whatsapp.sendOrderReadyMessage(formattedPhone, order, sheetType);
                this.logger.info(`📤 Sent ready notification for order ${orderId} to ${formattedPhone}`);
            } else if (['delivered', 'completed'].includes(status)) {
                await this.whatsapp.sendDeliveryNotification(formattedPhone, order, sheetType);
                this.logger.info(`📤 Sent delivery notification for order ${orderId} to ${formattedPhone}`);
            }
            
        } catch (error) {
            this.logger.error('Failed to send order notification:', error.message);
        }
    }
    
    async getOrderById(orderId) {
        try {
            const allOrders = await this.getAllOrders();
            return allOrders.find(order => 
                order['Order ID'] === orderId || 
                order['Master Order ID'] === orderId
            );
        } catch (error) {
            this.logger.error('Failed to get order by ID:', error.message);
            return null;
        }
    }
    
    async healthCheck() {
        try {
            // Test Google Sheets connection
            const testSheet = this.sheetConfigs[0];
            if (testSheet) {
                await this.sheets.spreadsheets.get({
                    spreadsheetId: testSheet.id,
                    fields: 'properties.title'
                });
            }
            
            return {
                status: 'healthy',
                sheets: 'connected',
                whatsapp: this.isConnected ? 'connected' : 'disconnected'
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message,
                sheets: 'error',
                whatsapp: this.isConnected ? 'connected' : 'disconnected'
            };
        }
    }
    
    // ==================== POLLING INTEGRATION ====================
    
    startPolling() {
        if (this.isPolling) {
            this.logger.warn('Polling already started');
            return;
        }
        
        this.isPolling = true;
        this.logger.info('🔄 Starting order polling...');
        
        // Initial process
        this.processOrders();
        
        // Set up interval (every 3 minutes)
        this.pollingInterval = setInterval(() => {
            if (this.isPolling) {
                this.processOrders();
            }
        }, 180000); // 3 minutes
        
        this.logger.info('✅ Order polling started (3-minute intervals)');
    }
    
    stopPolling() {
        if (!this.isPolling) {
            this.logger.warn('Polling not started');
            return;
        }
        
        this.isPolling = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        
        this.logger.info('⏹️ Order polling stopped');
    }

    async cleanup() {
        try {
            this.stopPolling();
            await this.lockManager.releaseLock();
            this.logger.info('✅ Cleanup completed');
        } catch (error) {
            this.logger.error('❌ Error during cleanup:', error);
        }
    }
}

// Simple ProcessLockManager implementation
class ProcessLockManager {
    constructor() {
        this.lockFile = path.join(__dirname, '../../.bot-lock.json');
    }

    async getLockStatus() {
        try {
            const lockData = await fs.readFile(this.lockFile, 'utf8');
            return JSON.parse(lockData);
        } catch (error) {
            return { locked: false, timestamp: null, pid: null };
        }
    }

    async canStart() {
        try {
            const lockStatus = await this.getLockStatus();
            if (!lockStatus.locked) {
                await this.createLock();
                return true;
            }
            
            if (lockStatus.pid) {
                try {
                    process.kill(lockStatus.pid, 0);
                    return false;
                } catch (error) {
                    await this.createLock();
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Error checking lock status:', error);
            return false;
        }
    }

    async createLock() {
        const lockData = {
            locked: true,
            timestamp: new Date().toISOString(),
            pid: process.pid
        };
        await fs.writeFile(this.lockFile, JSON.stringify(lockData, null, 2));
    }

    async releaseLock() {
        try {
            await fs.unlink(this.lockFile);
        } catch (error) {
            // File might not exist, that's okay
        }
    }
}

// Start the bot
if (require.main === module) {
    const bot = new WhatsAppBot();
    bot.start().catch(console.error);
}

module.exports = WhatsAppBot;
