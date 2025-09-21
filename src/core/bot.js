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
const AuthConfig = require('../config/auth-config');
const EnhancedLogger = require('../utils/enhanced-logger');
const SecureCredentials = require('../utils/secure-credentials');
const PIIMasker = require('../utils/pii-masker');
const APIAuth = require('../utils/api-auth');
const AtomicStateManager = require('../utils/atomic-state-manager');

/**
 * Consolidated WhatsApp Bot - Production Ready
 * 
 * This is the main bot file with consolidated functionality
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
        this.isInitialized = false;
        this.messageQueue = new PQueue({ concurrency: 1 });
        this.messageTemplates = new MessageTemplates();
        this.adminCommands = null;
        
        // Configuration validation
        this.config = this.validateConfiguration();
        
        // Race condition prevention
        this.isProcessingOrders = false;
        this.processingMutex = false;
        
        // Enhanced systems
        this.authConfig = new AuthConfig();
        this.logger = new EnhancedLogger({
            logDir: path.join(__dirname, '../../logs'),
            logLevel: process.env.LOG_LEVEL || 'INFO'
        });
        
        // Secure credentials management
        this.secureCredentials = new SecureCredentials();
        
        // API authentication
        this.apiAuth = new APIAuth();
        
        // Atomic state management
        this.atomicStateManager = new AtomicStateManager();
        
        // Google Sheets integration
        this.sheets = null;
        // Consolidated Sheet with multiple tabs (Tailor Orders, Fabric Orders, Combine Orders)
        this.sheetConfigs = [
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Tailor Orders',
                type: 'tailor',
                description: 'Tailor Orders Tab',
                tabName: 'Tailor Orders'
            },
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Fabric Orders',
                type: 'fabric',
                description: 'Fabric Orders Tab',
                tabName: 'Fabric Orders'
            },
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Combine Orders',
                type: 'combine',
                description: 'Combine Orders Tab',
                tabName: 'Combine Orders'
            }
        ];
        
        // Process lock manager
        this.lockManager = new ProcessLockManager();
        
        // QR code state
        this.currentQRCode = null;
        this.qrCodeGenerated = false;
        
        this.setupRoutes();
        
        console.log('🔧 WhatsApp Bot initialized');
        console.log('📊 Configuration status:', this.config.status);
    }

    validateConfiguration() {
        const status = {
            hasGoogleSheets: false,
            hasWhatsAppPhones: false,
            hasMockMode: process.env.MOCK_WHATSAPP === 'true',
            webhookEnabled: process.env.WEBHOOK_SECRET ? true : false,
            errors: []
        };

        // Check Google Sheets configuration
        const googleSheetId = process.env.GOOGLE_SHEET_ID;
        if (!googleSheetId || googleSheetId === 'your_google_sheet_id_here') {
            status.errors.push('Google Sheet ID not configured');
        } else {
            status.hasGoogleSheets = true;
        }

        // Check WhatsApp phone configuration
        const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;
        if (!adminPhone || adminPhone === '1234567890') {
            status.errors.push('WhatsApp admin phone not configured');
        } else {
            status.hasWhatsAppPhones = true;
        }

        // Check service account file
        const serviceAccountPath = path.join(__dirname, '../../service-account.json');
        try {
            require('fs').statSync(serviceAccountPath);
            status.hasServiceAccount = true;
        } catch (error) {
            status.hasServiceAccount = false;
            status.errors.push('Service account file not found');
        }

        return status;
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
            
            // Setup event handlers after WhatsApp client is initialized
            this.setupEventHandlers();
            
            this.isInitialized = true;
            this.logger.info('✅ WhatsApp Bot initialized successfully');
            
        } catch (error) {
            this.logger.error('❌ Failed to initialize bot:', error);
            console.error('💡 Configuration issues found:', this.config.errors);
            await this.lockManager.releaseLock();
            
            // Don't exit if it's just configuration issues - let the web server run
            if (!error.message.includes('Google credentials found') && 
                !error.message.includes('Invalid credentials') &&
                this.config.errors.length > 0) {
                console.log('⚠️ Bot starting with limited functionality due to configuration issues');
                console.log('🌐 Web dashboard will be available at http://localhost:3001');
                this.isInitialized = false;
            } else {
                process.exit(1);
            }
        }
    }

    async initializeGoogleSheets() {
        try {
            this.logger.info('🔑 Initializing Google Sheets API...');
            
            // Initialize secure credentials (preserves WhatsApp auth)
            await this.secureCredentials.initializeCredentials();
            await this.secureCredentials.checkWhatsAppAuth();
            
            // Validate credentials
            const validation = this.secureCredentials.validateCredentials();
            if (!validation.valid) {
                throw new Error(`Invalid credentials: ${validation.error}`);
            }
            
            // Log credentials source (masked)
            const credentialsInfo = this.secureCredentials.maskCredentialsForLogging();
            this.logger.info('🔐 Credentials loaded securely', credentialsInfo);
            
            // Initialize Google Auth with secure credentials
            const credentials = this.secureCredentials.getCredentials();
            const auth = new google.auth.GoogleAuth({
                credentials: credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            this.logger.info('✅ Google Sheets API initialized securely');
        } catch (error) {
            this.logger.error('❌ Google Sheets initialization failed:', error.message);
            
            // Provide helpful setup instructions
            if (error.message.includes('No Google credentials found')) {
                const instructions = this.secureCredentials.getEnvironmentSetupInstructions();
                this.logger.info('💡 Setup instructions:', instructions);
            }
            
            throw error;
        }
    }

    setupEventHandlers() {
        this.logger.info('🔧 Setting up event handlers...');
        
        // WhatsApp connection events
        this.whatsapp?.on('connected', () => {
            this.logger.info('🎉 WhatsApp connected successfully!');
            this.isConnected = true;
            this.currentQRCode = null;
            this.qrCodeGenerated = false;
            
            // Initialize admin commands after WhatsApp connection
            this.logger.info('🔧 Initializing admin commands...');
            this.initializeAdminCommands();
            
            // Initialize both webhook and polling systems
            if (this.config.hasGoogleSheets) {
                this.logger.info('✅ Google Sheets configured - webhook system ready');
                this.logger.info('🔗 Webhook endpoint available at /webhook/google-sheets');
                
                // Start automatic order processing every 5 minutes
                this.startAutomaticOrderProcessing();
            } else {
                this.logger.info('⚠️ Google Sheets not configured - webhook system limited');
                this.logger.info('💡 Configure GOOGLE_SHEET_ID in .env file to enable full webhook functionality');
            }
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
            if (this.whatsapp && this.whatsapp.socket && this.whatsapp.socket.ev) {
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
                this.logger.info('📨 Message handler attached to WhatsApp socket');
            } else {
                this.logger.warn('⚠️ WhatsApp socket not available for message handling');
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
                status: 'running',
                whatsapp: {
                    isConnected: this.isConnected,
                    isInitialized: this.isInitialized,
                    state: status.state || 'disconnected',
                    qrCode: this.currentQRCode,
                    hasQRCode: this.qrCodeGenerated
                },
                webhook: {
                    enabled: !!process.env.WEBHOOK_SECRET,
                    endpoint: '/webhook/google-sheets'
                },
                config: this.config,
                server: 'running',
                timestamp: new Date().toISOString()
            });
        });
        
        // Programmatic health endpoint for tests/monitoring
        this.app.get('/api/health', async (req, res) => {
            try {
                const health = await this.healthCheck();
                res.json({ success: true, ...health });
            } catch (e) {
                res.status(500).json({ success: false, error: e.message });
            }
        });

        // Circuit breaker status endpoint for monitoring
        this.app.get('/api/circuit-breaker', (req, res) => {
            try {
                const status = this.whatsapp?.circuitBreaker?.getStatus() || { 
                    state: 'closed',
                    failureCount: 0,
                    lastFailureTime: null,
                    nextAttempt: Date.now()
                };
                res.json({ success: true, circuitBreaker: status });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Enhanced test-send endpoint
        this.app.post('/api/test-send', async (req, res) => {
            try {
                const result = await this.sendTestMessage();
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Manual order processing endpoint
        this.app.post('/api/process-orders', async (req, res) => {
            try {
                this.logger.info('🔄 Manual order processing triggered via API');
                await this.processOrders();
                res.json({ success: true, message: 'Order processing completed' });
            } catch (error) {
                this.logger.error('❌ Manual order processing failed:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Test order processing with detailed logging
        this.app.post('/api/test-order-processing', async (req, res) => {
            try {
                this.logger.info('🧪 Testing order processing with detailed logging...');
                
                const allOrders = await this.getAllOrders();
                this.logger.info(`📊 Found ${allOrders.length} orders total`);
                
                let processedCount = 0;
                for (const order of allOrders) {
                    const shouldSend = this.shouldSendNotification(order, order.sheetType);
                    this.logger.info(`🔍 Order ${order['Order ID']}: shouldSend=${shouldSend}, paymentStatus=${order['Payment Status']}, paymentNotified=${order['Payment Notified']}`);
                    
                    if (shouldSend) {
                        this.logger.info(`📤 Sending message for order ${order['Order ID']} to ${order['Contact Number']}`);
                        await this.sendOrderNotification(order, order.sheetType);
                        processedCount++;
                    }
                }
                
                res.json({ 
                    success: true, 
                    totalOrders: allOrders.length,
                    processedCount: processedCount,
                    message: `Processed ${processedCount} orders out of ${allOrders.length} total`
                });
            } catch (error) {
                this.logger.error('❌ Test order processing failed:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Test Google Sheets data retrieval
        this.app.get('/api/test-sheets', async (req, res) => {
            try {
                this.logger.info('🔍 Testing Google Sheets data retrieval...');
                const allOrders = await this.getAllOrders();
                res.json({ 
                    success: true, 
                    totalOrders: allOrders.length,
                    orders: allOrders.slice(0, 5), // Show first 5 orders
                    message: `Found ${allOrders.length} orders across all sheets`
                });
            } catch (error) {
                this.logger.error('❌ Google Sheets test failed:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Debug order processing logic
        this.app.get('/api/debug-order', async (req, res) => {
            try {
                const allOrders = await this.getAllOrders();
                const debugResults = [];
                
                for (const order of allOrders) {
                    const shouldSend = this.shouldSendNotification(order, order.sheetType);
                    debugResults.push({
                        orderId: order['Order ID'],
                        customerName: order['Customer Name'],
                        phone: order['Contact Number'],
                        paymentStatus: order['Payment Status'],
                        paymentNotified: order['Payment Notified'],
                        sheetType: order.sheetType,
                        shouldSendNotification: shouldSend,
                        isFabricOrder: !!(order['Fabric Order ID'] && !order['Tailoring Order ID']),
                        isTailoringOrder: !!(order['Tailoring Order ID'] && !order['Fabric Order ID']),
                        isCombinedOrder: !!(order['Combined Order ID'] && (order['Fabric Order ID'] || order['Tailoring Order ID']))
                    });
                }
                
                res.json({ 
                    success: true, 
                    debugResults,
                    message: `Debug analysis for ${allOrders.length} orders`
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Main dashboard
        this.app.get('/', (req, res) => {
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

        // Admin commands (with authentication)
        this.app.post('/admin/restart', this.apiAuth.rateLimiter.bind(this.apiAuth), this.apiAuth.verifyAPIKey.bind(this.apiAuth), async (req, res) => {
            try {
                this.logger.info('🔄 Restarting WhatsApp connection...');
                await this.whatsapp?.restart();
                res.json({ success: true, message: 'WhatsApp connection restarted' });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Webhook status endpoint (with authentication)
        this.app.get('/webhook/status', this.apiAuth.rateLimiter.bind(this.apiAuth), this.apiAuth.verifyAPIKey.bind(this.apiAuth), async (req, res) => {
            try {
                res.json({ 
                    success: true, 
                    webhook: {
                        enabled: !!process.env.WEBHOOK_SECRET,
                        endpoint: '/webhook/google-sheets',
                        secretConfigured: !!process.env.WEBHOOK_SECRET
                    },
                    message: 'Webhook system is active' 
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // API key setup endpoint (no auth required for setup)
        this.app.get('/admin/setup-api', (req, res) => {
            const instructions = this.apiAuth.getSetupInstructions();
            res.json({ success: true, setup: instructions });
        });

        // Configuration help endpoint
        this.app.get('/api/config-help', (req, res) => {
            const help = {
                issues: this.config.errors,
                solutions: [
                    {
                        issue: 'Google Sheet ID not configured',
                        solution: 'Set GOOGLE_SHEET_ID in your .env file with your actual Google Sheet ID'
                    },
                    {
                        issue: 'WhatsApp admin phone not configured', 
                        solution: 'Set WHATSAPP_ADMIN_PHONE in your .env file with your phone number (without +91)'
                    },
                    {
                        issue: 'Service account file not found',
                        solution: 'Ensure service-account.json is in the root directory with valid Google credentials'
                    }
                ],
                currentConfig: this.config
            };
            res.json(help);
        });

        // ==================== WEBHOOK ENDPOINTS ====================
        
        // Google Sheets webhook endpoint
        this.app.post('/webhook/google-sheets', async (req, res) => {
            try {
                this.logger.info('🔗 Received webhook from Google Sheets');
                
                // Verify webhook secret if configured
                const webhookSecret = process.env.WEBHOOK_SECRET;
                if (webhookSecret) {
                    const providedSecret = req.headers['x-webhook-secret'] || req.body.secret;
                    if (providedSecret !== webhookSecret) {
                        this.logger.warn('❌ Invalid webhook secret');
                        return res.status(401).json({ success: false, error: 'Invalid webhook secret' });
                    }
                }
                
                // Process the webhook data
                const result = await this.processWebhookData(req.body);
                
                if (result.success) {
                    this.logger.info(`✅ Webhook processed successfully: ${result.processed} notifications sent`);
                    res.json({ 
                        success: true, 
                        message: 'Webhook processed successfully',
                        processed: result.processed,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    this.logger.error(`❌ Webhook processing failed: ${result.error}`);
                    res.status(400).json({ 
                        success: false, 
                        error: result.error,
                        timestamp: new Date().toISOString()
                    });
                }
                
            } catch (error) {
                this.logger.error('❌ Webhook endpoint error:', error.message);
                res.status(500).json({ 
                    success: false, 
                    error: 'Internal server error',
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Webhook test endpoint
        this.app.get('/webhook/test', (req, res) => {
            res.json({
                success: true,
                message: 'Webhook endpoint is active',
                endpoint: '/webhook/google-sheets',
                method: 'POST',
                timestamp: new Date().toISOString(),
                config: {
                    hasGoogleSheets: this.config.hasGoogleSheets,
                    webhookSecretConfigured: !!process.env.WEBHOOK_SECRET,
                    whatsappConnected: this.isConnected
                }
            });
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
            // Try different range formats to handle various sheet structures
            const ranges = [
                `${config.tabName}!A:Z`,  // Use tabName for specific tab
                `${config.name}!A:Z`,     // Fallback to name
                'Sheet1!A:Z',            // Default sheet name
                'Orders!A:Z',            // Alternative sheet name
                'Data!A:Z'               // Another common name
            ];

            let rows = [];
            let successfulRange = null;

            for (const range of ranges) {
                try {
                    this.logger.debug(`🔍 Trying range: ${range} for ${config.name}`);
                    const response = await this.sheets.spreadsheets.values.get({
                        spreadsheetId: config.id,
                        range: range
                    });
                    
                    rows = response.data.values || [];
                    if (rows.length > 0) {
                        successfulRange = range;
                        this.logger.info(`✅ Successfully retrieved ${rows.length} rows from ${config.description || config.name} using range: ${range}`);
                        break;
                    }
                } catch (rangeError) {
                    this.logger.debug(`❌ Range ${range} failed for ${config.name}: ${rangeError.message}`);
                    continue;
                }
            }

            if (!successfulRange || rows.length <= 1) {
                this.logger.warn(`⚠️ No valid data found for ${config.description || config.name}. Sheet might be empty or inaccessible.`);
                return [];
            }
            
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
            this.logger.error(`❌ Failed to get sheet data from ${config.name}:`, error.message);
            return [];
        }
    }
    
    async processOrders() {
        // Race condition prevention - ensure only one instance processes at a time
        if (this.isProcessingOrders) {
            this.logger.info('⏳ processOrders already running, skipping this invocation');
            return;
        }
        
        this.isProcessingOrders = true;
        
        try {
            this.logger.info('🔍 Starting automatic order processing check...');
            if (!this.isConnected || !this.whatsapp) {
                this.logger.warn('Cannot process orders: WhatsApp not connected');
                return;
            }
            
            this.logger.info('🔄 Processing orders from Google Sheets...');
            
            this.logger.info(`📊 Found ${this.sheetConfigs.length} sheet configurations to process`);
            let totalProcessed = 0;
            
            for (const config of this.sheetConfigs) {
                try {
                    this.logger.info(`🔍 Processing sheet: ${config.name} (${config.type})`);
                    const processed = await this.processSheetOrders(config);
                    totalProcessed += processed;
                } catch (error) {
                    this.logger.error(`Failed to process ${config.name}:`, error.message);
                }
            }
            
            if (totalProcessed > 0) {
                this.logger.info(`✅ Order processing complete: ${totalProcessed} messages sent`);
            } else {
                this.logger.info('ℹ️ No orders requiring messages found');
            }
        } catch (error) {
            this.logger.error('Failed to process orders:', error.message);
        } finally {
            // Always release the mutex
            this.isProcessingOrders = false;
        }
    }
    
    async processSheetOrders(config) {
        try {
            const orders = await this.getSheetData(config);
            
            // Skip payment sheets - no payment messages
            if (config.type === 'payment') {
                this.logger.info(`Skipping ${config.name} - payment messages disabled`);
                return 0;
            }
            
            let processedCount = 0;
            
            // Regular order processing
            for (const order of orders) {
                if (this.shouldSendNotification(order, config.type)) {
                    this.logger.info(`📤 Sending notification for order ${order['Order ID']} to ${order['Contact Number']}`);
                    await this.sendOrderNotification(order, config.type);
                    processedCount++;
                }
            }
            
            this.logger.info(`📊 Processed ${config.name}: ${processedCount} messages sent`);
            return processedCount;
        } catch (error) {
            this.logger.error(`Failed to process orders from ${config.name}:`, error.message);
            return 0;
        }
    }
    
    
    shouldSendNotification(order, sheetType) {
        try {
            // Handle unified sheet with all order types (fabric, tailoring, combined)
            // Updated to match your actual sheet headers
            const phone = order['Contact Number'] || order['Phone'] || order['Phone Number'] || order['Contact Info'] || order['phone'];
            const orderId = order['Combined Order ID'] || order['Master Order ID'] || order['Order ID'] || order['Fabric Order ID'] || order['Tailoring Order ID'];
            
            // Basic validation
            if (!phone || !orderId) {
                return false;
            }
            
            // Check if this is a combined order (has both fabric and tailoring)
            const isCombinedOrder = order['Combined Order ID'] && (order['Fabric Order ID'] || order['Tailoring Order ID']);
            // For fabric orders, check if it's from fabric sheet or has fabric-specific fields
            const isFabricOrder = sheetType === 'fabric' || (order['Fabric Order ID'] && !order['Tailoring Order ID']);
            const isTailoringOrder = order['Tailoring Order ID'] && !order['Fabric Order ID'];
            
            // Check notification flags - updated to match your actual headers
            const combinedNotified = order['Combined Order Notified'];
            const paymentStatus = order['Payment Status'];
            const welcomeNotified = order['Welcome Notified'];
            const readyNotified = order['Ready Notified'];
            const deliveryNotified = order['Delivery Notified'];
            const pickupNotified = order['Pickup Notified'];
            const paymentNotified = order['Payment Notified'];
            const purchaseNotified = order['Purchase Notified'];
            
            // For combined orders, check if notification is needed
            if (isCombinedOrder) {
                if (!combinedNotified || combinedNotified.toLowerCase() === 'no') {
                    return true; // Send combined order notification
                }
            }
            
            // For individual fabric orders
            if (isFabricOrder) {
                // Check if payment reminder is needed for fabric orders
                if (paymentStatus && (paymentStatus.toLowerCase() === 'partial' || paymentStatus.toLowerCase() === 'pending')) {
                    if (!paymentNotified || paymentNotified.toLowerCase() === 'no') {
                        return true; // Send payment reminder
                    }
                }
                return false; // No other notifications needed for fabric orders
            }
            
            // For individual tailoring orders
            if (isTailoringOrder) {
                // Check tailoring-specific notification logic here if needed
                return false; // Tailoring orders handled separately if needed
            }
            
            // Check payment status changes
            if (paymentStatus && paymentStatus.toLowerCase() === 'paid') {
                // Send payment confirmation if needed
                return false; // Payment notifications can be enabled here if needed
            }
            
            return false;
        } catch (error) {
            this.logger.error('Error checking notification conditions:', error.message);
            return false;
        }
    }
    
    
    isPaymentData(order) {
        // Check if this is payment data based on column structure
        const hasPaymentColumns = order['Payment Date'] || order['Payment Amount'] || 
                                 order['Daily Rate'] || order['Net Amount'];
        return hasPaymentColumns;
    }
    
    async sendOrderNotification(order, sheetType) {
        try {
            // Skip payment messages
            if (sheetType === 'payment' || this.isPaymentData(order)) {
                this.logger.info(`Skipping ${sheetType} message - payment messages disabled`);
                return;
            }

            // Handle unified sheet with all order types
            const phone = order['Contact Number'] || order['Phone'] || order['Phone Number'] || order['Contact Info'] || order['phone'];
            const orderId = order['Combined Order ID'] || order['Master Order ID'] || order['Order ID'] || order['Fabric Order ID'] || order['Tailoring Order ID'];
            const status = (order['Delivery Status'] || order['Status'] || order['status'] || '').toLowerCase().trim();

            if (!phone || !orderId) {
                this.logger.warn('Cannot send notification: missing phone or order ID');
                return;
            }

            // Format phone number
            let formattedPhone = String(phone).replace(/\D/g, '');
            if (!formattedPhone.startsWith('91')) {
                formattedPhone = '91' + formattedPhone;
            }

            // Normalize data for templates (map sheet columns to template keys)
            // Updated to match your actual sheet headers
            const normalized = {
                customer_name: order['Customer Name'] || order['customer_name'] || 'Customer',
                order_id: orderId,
                phone: formattedPhone, // Add the phone field that safety manager expects
                garment_type: order['Garment Types'] || order['Fabric Type'] || order['garment_type'] || 'Item',
                total_amount: order['Total Amount'] || order['Price'] || order['Fabric Total'] || '0',
                advance_amount: order['Advance/Partial Payment'] || order['Advance Payment'] || order['advance_amount'] || '0',
                remaining_amount: order['Remaining Amount'] || order['remaining_amount'] || '0',
                fabric_price: order['Fabric Price'] || order['Fabric Total'] || '0',
                tailoring_price: order['Tailoring Price'] || order['Price'] || '0',
                payment_status: order['Payment Status'] || 'Pending',
                ready_date: order['Ready Date'] || order['ready_date'] || new Date().toLocaleDateString(),
                delivery_date: order['Delivery Date'] || order['delivery_date'] || new Date().toLocaleDateString(),
                shop_name: process.env.SHOP_NAME || 'RS Tailor & Fabric',
                shop_phone: process.env.SHOP_PHONE || '8824781960',
                business_hours: process.env.BUSINESS_HOURS || '10:00 AM - 7:00 PM',
                // Additional fields from your sheets
                fabric_order_id: order['Fabric Order ID'] || '',
                tailor_order_id: order['Tailoring Order ID'] || '',
                combined_order_id: order['Combined Order ID'] || '',
                master_order_id: order['Master Order ID'] || '',
                fabric_type: order['Fabric Type'] || '',
                fabric_color: order['Fabric Color'] || '',
                brand_name: order['Brand Name'] || '',
                quantity: order['Quantity (meters)'] || '',
                price_per_meter: order['Price per Meter'] || ''
            };

            // Determine message type based on order type and send appropriate notification
            const isCombinedOrder = order['Combined Order ID'] && (order['Fabric Order ID'] || order['Tailoring Order ID']);
            const combinedNotified = order['Combined Order Notified'];
            
            if (isCombinedOrder && (!combinedNotified || combinedNotified.toLowerCase() === 'no')) {
                // Send combined order message
                const combinedResult = await this.whatsapp.sendCombinedOrderMessage(formattedPhone, normalized);
                if (combinedResult.success) {
                    this.logger.info(`📤 Sent combined order message for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
                    this.logger.info(`📝 Google Sheets will be updated automatically for order ${PIIMasker.maskOrderId(orderId)}`);
                } else {
                    this.logger.error(`❌ Failed to send combined order message for order ${PIIMasker.maskOrderId(orderId)}: ${combinedResult.error || combinedResult.blockMessage}`);
                }
            } else if (status === 'pending') {
                // Check notification status for new orders
                const welcomeNotified = order['Welcome Notified'];
                const confirmationNotified = order['Confirmation Notified'];
                
                // For new orders: Send BOTH welcome and confirmation messages automatically
                if (!welcomeNotified || welcomeNotified.toLowerCase() === 'no') {
                    // Step 1: Send welcome message first
                    const welcomeResult = await this.whatsapp.sendWelcomeMessage(formattedPhone, normalized, sheetType);
                    if (welcomeResult.success) {
                        this.logger.info(`📤 Sent welcome message for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
                        
                        // Step 2: Wait a moment, then send confirmation message
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                        
                        const confirmationResult = await this.whatsapp.sendOrderConfirmationMessage(formattedPhone, normalized, sheetType);
                        if (confirmationResult.success) {
                            this.logger.info(`📤 Sent order confirmation for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
                            this.logger.info(`📝 Google Sheets will be updated automatically for order ${PIIMasker.maskOrderId(orderId)}`);
                        } else {
                            this.logger.error(`❌ Failed to send confirmation message for order ${PIIMasker.maskOrderId(orderId)}: ${confirmationResult.error || confirmationResult.blockMessage}`);
                        }
                    } else {
                        this.logger.error(`❌ Failed to send welcome message for order ${PIIMasker.maskOrderId(orderId)}: ${welcomeResult.error || welcomeResult.blockMessage}`);
                    }
                } else if (!confirmationNotified || confirmationNotified.toLowerCase() === 'no') {
                    // Only send confirmation if welcome was already sent but confirmation wasn't
                    const confirmationResult = await this.whatsapp.sendOrderConfirmationMessage(formattedPhone, normalized, sheetType);
                    if (confirmationResult.success) {
                        this.logger.info(`📤 Sent order confirmation for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
                    } else {
                        this.logger.error(`❌ Failed to send confirmation message for order ${PIIMasker.maskOrderId(orderId)}: ${confirmationResult.error || confirmationResult.blockMessage}`);
                    }
                }
            } else if (['ready', 'completed', 'pickup'].includes(status)) {
                await this.whatsapp.sendOrderReadyMessage(formattedPhone, normalized, sheetType);
                this.logger.info(`📤 Sent ready notification for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
            } else if (['delivered', 'completed'].includes(status)) {
                await this.whatsapp.sendDeliveryNotification(formattedPhone, normalized, sheetType);
                this.logger.info(`📤 Sent delivery notification for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
            } else if (sheetType === 'fabric' && (status === 'partial' || status === 'pending')) {
                // Handle fabric payment reminders
                const paymentNotified = order['Payment Notified'];
                if (!paymentNotified || paymentNotified.toLowerCase() === 'no') {
                    const paymentResult = await this.whatsapp.sendFabricPaymentReminder(formattedPhone, normalized);
                    if (paymentResult.success) {
                        this.logger.info(`📤 Sent fabric payment reminder for order ${PIIMasker.maskOrderId(orderId)} to ${PIIMasker.maskPhone(formattedPhone)}`);
                    } else {
                        this.logger.error(`❌ Failed to send fabric payment reminder for order ${PIIMasker.maskOrderId(orderId)}: ${paymentResult.error || paymentResult.blockMessage}`);
                    }
                }
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
    
    // ==================== WEBHOOK INTEGRATION ====================
    
    /**
     * Process webhook data from Google Apps Script
     * This replaces the old polling system with real-time notifications
     */
    async processWebhookData(webhookData) {
        try {
            this.logger.info('🔗 Processing webhook data with enhanced detection...');
            
            if (!this.isConnected || !this.whatsapp) {
                this.logger.warn('Cannot process webhook: WhatsApp not connected');
                return { success: false, error: 'WhatsApp not connected' };
            }
            
            // Validate webhook data structure
            if (!webhookData.sheetId || !webhookData.rows) {
                this.logger.error('Invalid webhook data structure');
                return { success: false, error: 'Invalid webhook data' };
            }
            
            // Find the sheet configuration
            const config = this.sheetConfigs.find(c => c.id === webhookData.sheetId);
            if (!config) {
                this.logger.error(`Unknown sheet ID: ${webhookData.sheetId}`);
                return { success: false, error: 'Unknown sheet ID' };
            }
            
            this.logger.info(`📊 Processing ${webhookData.rows.length} changes from ${config.name}`);
            
            let processedCount = 0;
            for (const rowData of webhookData.rows) {
                try {
                    // Handle based on change type from enhanced Google Apps Script
                    if (rowData._changeType === 'new_order') {
                        // For new orders, send welcome + confirmation
                        await this.sendNewOrderNotifications(rowData, config.type);
                        processedCount++;
                    } 
                    else if (rowData._changeType === 'status_change') {
                        // For status changes, send appropriate notification
                        await this.sendStatusChangeNotification(rowData, config.type);
                        processedCount++;
                    }
                    else if (rowData._changeType === 'automation_trigger' && rowData._automationRule && rowData._messageType) {
                        // Handle automation rules from Google Apps Script
                        const phone = this.extractPhone(rowData);
                        const formattedPhone = this.formatPhoneNumber(phone);
                        const normalized = this.normalizeOrderData(rowData);
                        await this.handleAutomationMessage(rowData, formattedPhone, normalized, config.type);
                        processedCount++;
                    }
                    else {
                        // Fallback to original logic for compatibility
                        if (this.shouldSendNotification(rowData, config.type)) {
                            await this.sendOrderNotification(rowData, config.type);
                            processedCount++;
                        }
                    }
                } catch (error) {
                    this.logger.error(`Error processing row:`, error.message);
                }
            }
            
            this.logger.info(`✅ Webhook processing complete: ${processedCount} notifications sent`);
            return { 
                success: true, 
                processed: processedCount,
                total: webhookData.rows.length
            };
            
        } catch (error) {
            this.logger.error('Failed to process webhook data:', error.message);
            return { success: false, error: error.message };
        }
    }

    async sendNewOrderNotifications(order, sheetType) {
        try {
            const phone = this.extractPhone(order);
            const orderId = this.extractOrderId(order);
            
            if (!phone || !orderId) {
                this.logger.warn('Cannot send new order notification: missing phone or order ID');
                return;
            }
            
            const maskedPhone = this.piiMasker.maskPhone(phone);
            const maskedOrderId = this.piiMasker.maskOrderId(orderId);
            
            const formattedPhone = this.formatPhoneNumber(phone);
            const normalized = this.normalizeOrderData(order);
            
            this.logger.info(`🆕 Processing new order ${maskedOrderId} for ${maskedPhone}`);
            
            // Step 1: Check if this is a first-time customer (from Google Apps Script)
            const isNewCustomer = order._isNewPhone === true;
            
            if (isNewCustomer) {
                this.logger.info(`👋 Sending welcome message to new customer ${maskedPhone}`);
                const welcomeResult = await this.whatsapp.sendWelcomeMessage(formattedPhone, normalized, sheetType);
                this.logMessageResult('welcome', welcomeResult, orderId, formattedPhone);
                
                // Wait a moment to prevent message throttling
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            // Step 2: Always send order confirmation for new orders
            this.logger.info(`✅ Sending confirmation message for order ${maskedOrderId}`);
            const confirmResult = await this.whatsapp.sendConfirmationMessage(formattedPhone, normalized, sheetType);
            this.logMessageResult('confirmation', confirmResult, orderId, formattedPhone);
            
        } catch (error) {
            this.logger.error('Error sending new order notifications:', error.message);
        }
    }

    async sendStatusChangeNotification(order, sheetType) {
        try {
            const phone = this.extractPhone(order);
            const orderId = this.extractOrderId(order);
            
            if (!phone || !orderId) {
                this.logger.warn('Cannot send status change notification: missing phone or order ID');
                return;
            }
            
            const maskedPhone = this.piiMasker.maskPhone(phone);
            const maskedOrderId = this.piiMasker.maskOrderId(orderId);
            
            const formattedPhone = this.formatPhoneNumber(phone);
            const normalized = this.normalizeOrderData(order);
            
            // Handle automation rules from Google Apps Script
            if (order._automationRule && order._messageType) {
                await this.handleAutomationMessage(order, formattedPhone, normalized, sheetType);
                return;
            }
            
            // Handle regular status changes
            const statusChangeType = order._statusChangeType;
            const changedColumns = order._changedColumns || [];
            
            this.logger.info(`🔄 Processing status change for order ${maskedOrderId}: ${statusChangeType}`);
            
            if (statusChangeType === 'ready') {
                // Send ready notification
                this.logger.info(`🎉 Sending ready notification for order ${maskedOrderId}`);
                const readyResult = await this.whatsapp.sendOrderReadyMessage(formattedPhone, normalized, sheetType);
                this.logMessageResult('ready', readyResult, orderId, formattedPhone);
            } 
            else if (statusChangeType === 'delivered') {
                // Send delivery notification
                this.logger.info(`🚚 Sending delivery notification for order ${maskedOrderId}`);
                const deliveryResult = await this.whatsapp.sendDeliveryNotification(formattedPhone, normalized, sheetType);
                this.logMessageResult('delivery', deliveryResult, orderId, formattedPhone);
            }
            else {
                // Handle other status changes based on changed columns
                for (const change of changedColumns) {
                    if (change.column === 'Payment Status' && change.newValue === 'Pending') {
                        this.logger.info(`💳 Sending payment reminder for order ${maskedOrderId}`);
                        const paymentResult = await this.whatsapp.sendPaymentReminder(formattedPhone, normalized, sheetType);
                        this.logMessageResult('payment_reminder', paymentResult, orderId, formattedPhone);
                    }
                    // Add more status change handlers as needed
                }
            }
            
        } catch (error) {
            this.logger.error('Error sending status change notification:', error.message);
        }
    }

    async handleAutomationMessage(order, formattedPhone, normalized, sheetType) {
        try {
            const messageType = order._messageType;
            const phone = this.extractPhone(order);
            const orderId = this.extractOrderId(order);
            const maskedPhone = this.piiMasker.maskPhone(phone);
            const maskedOrderId = this.piiMasker.maskOrderId(orderId);
            
            this.logger.info(`🤖 Processing automation message: ${messageType} for order ${maskedOrderId}`);
            
            let result;
            
            switch (messageType) {
                case 'welcome':
                    this.logger.info(`👋 Sending welcome message to ${maskedPhone}`);
                    result = await this.whatsapp.sendWelcomeMessage(formattedPhone, normalized, sheetType);
                    this.logMessageResult('welcome', result, orderId, formattedPhone);
                    break;
                    
                case 'order_confirmation':
                    this.logger.info(`✅ Sending order confirmation for ${maskedOrderId}`);
                    result = await this.whatsapp.sendConfirmationMessage(formattedPhone, normalized, sheetType);
                    this.logMessageResult('confirmation', result, orderId, formattedPhone);
                    break;
                    
                case 'fabric_purchase':
                    this.logger.info(`🛍️ Sending fabric purchase confirmation for ${maskedOrderId}`);
                    result = await this.whatsapp.sendFabricConfirmationMessage(formattedPhone, normalized);
                    this.logMessageResult('fabric_purchase', result, orderId, formattedPhone);
                    break;
                    
                case 'order_ready':
                    this.logger.info(`🎉 Sending order ready notification for ${maskedOrderId}`);
                    result = await this.whatsapp.sendOrderReadyMessage(formattedPhone, normalized, sheetType);
                    this.logMessageResult('ready', result, orderId, formattedPhone);
                    break;
                    
                case 'delivery_complete':
                    this.logger.info(`🚚 Sending delivery complete notification for ${maskedOrderId}`);
                    result = await this.whatsapp.sendDeliveryNotification(formattedPhone, normalized, sheetType);
                    this.logMessageResult('delivery', result, orderId, formattedPhone);
                    break;
                    
                case 'combined_order':
                    this.logger.info(`🔗 Sending combined order notification for ${maskedOrderId}`);
                    result = await this.whatsapp.sendCombinedOrderMessage(formattedPhone, normalized);
                    this.logMessageResult('combined_order', result, orderId, formattedPhone);
                    break;
                    
                case 'pickup_reminder':
                    this.logger.info(`🔔 Sending pickup reminder for ${maskedOrderId}`);
                    result = await this.whatsapp.sendPickupReminderMessage(formattedPhone, normalized);
                    this.logMessageResult('pickup_reminder', result, orderId, formattedPhone);
                    break;
                    
                case 'payment_reminder':
                    this.logger.info(`💳 Sending payment reminder for ${maskedOrderId}`);
                    result = await this.whatsapp.sendPaymentReminderMessage(formattedPhone, normalized);
                    this.logMessageResult('payment_reminder', result, orderId, formattedPhone);
                    break;
                    
                case 'fabric_payment_reminder':
                    this.logger.info(`💳 Sending fabric payment reminder for ${maskedOrderId}`);
                    result = await this.whatsapp.sendFabricPaymentReminderMessage(formattedPhone, normalized);
                    this.logMessageResult('fabric_payment_reminder', result, orderId, formattedPhone);
                    break;
                    
                default:
                    this.logger.warn(`Unknown automation message type: ${messageType}`);
                    return;
            }
            
        } catch (error) {
            this.logger.error(`Error handling automation message: ${error.message}`);
        }
    }

    logMessageResult(type, result, orderId, phone) {
        const maskedPhone = this.piiMasker.maskPhone(phone);
        const maskedOrderId = this.piiMasker.maskOrderId(orderId);
        
        if (result.success) {
            this.logger.info(`✅ Sent ${type} message for order ${maskedOrderId} to ${maskedPhone}`);
        } else {
            this.logger.error(`❌ Failed to send ${type} message for order ${maskedOrderId} to ${maskedPhone}: ${result.error || result.blockMessage}`);
        }
    }

    extractPhone(order) {
        const phoneFields = ['Contact Number', 'Phone', 'Phone Number', 'Contact Info', 'phone'];
        for (const field of phoneFields) {
            const phone = order[field];
            if (phone) {
                return String(phone).replace(/\D/g, '');
            }
        }
        return null;
    }

    extractOrderId(order) {
        const orderIdFields = ['Combined Order ID', 'Master Order ID', 'Order ID', 'Fabric Order ID', 'Tailoring Order ID'];
        for (const field of orderIdFields) {
            const orderId = order[field];
            if (orderId) {
                return String(orderId);
            }
        }
        return null;
    }

    formatPhoneNumber(phone) {
        if (!phone) return null;
        
        let formattedPhone = String(phone).replace(/\D/g, '');
        if (!formattedPhone.startsWith('91')) {
            formattedPhone = '91' + formattedPhone;
        }
        return formattedPhone;
    }

    normalizeOrderData(order) {
        // Enhanced normalization that handles all sheet types and columns
        return {
            customer_name: order['Customer Name'] || order['customer_name'] || 'Customer',
            order_id: this.extractOrderId(order),
            phone: this.formatPhoneNumber(this.extractPhone(order)),
            garment_type: order['Garment Types'] || order['Fabric Type'] || order['garment_type'] || 'Item',
            total_amount: order['Total Amount'] || order['Price'] || order['Fabric Total'] || '0',
            advance_amount: order['Advance/Partial Payment'] || order['Advance Payment'] || order['advance_amount'] || '0',
            remaining_amount: order['Remaining Amount'] || order['remaining_amount'] || '0',
            fabric_price: order['Fabric Price'] || order['Fabric Total'] || '0',
            tailoring_price: order['Tailoring Price'] || order['Price'] || '0',
            payment_status: order['Payment Status'] || 'Pending',
            ready_date: order['Ready Date'] || order['ready_date'] || new Date().toLocaleDateString(),
            delivery_date: order['Delivery Date'] || order['delivery_date'] || new Date().toLocaleDateString(),
            shop_name: process.env.SHOP_NAME || 'RS Tailor & Fabric',
            shop_phone: process.env.SHOP_PHONE || '8824781960',
            business_hours: process.env.BUSINESS_HOURS || '10:00 AM - 7:00 PM',
            
            // Additional fields from different sheet types
            fabric_order_id: order['Fabric Order ID'] || '',
            tailor_order_id: order['Tailoring Order ID'] || '',
            combined_order_id: order['Combined Order ID'] || '',
            master_order_id: order['Master Order ID'] || '',
            fabric_type: order['Fabric Type'] || '',
            fabric_color: order['Fabric Color'] || '',
            brand_name: order['Brand Name'] || '',
            quantity: order['Quantity (meters)'] || '',
            price_per_meter: order['Price per Meter'] || '',
            
            // Additional template fields
            order_date: order['Order Date'] || order['Date'] || new Date().toLocaleDateString(),
            final_payment: order['Final Payment'] || '0',
            outstanding_amount: order['Outstanding Amount'] || order['Remaining Amount'] || '0'
        };
    }
    

    async sendTestMessage() {
        try {
            if (!this.isConnected || !this.whatsapp) {
                throw new Error('WhatsApp not connected');
            }

            const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;
            if (!adminPhone || adminPhone === '1234567890') {
                throw new Error('Admin phone not configured');
            }

            // Format phone number
            let formattedPhone = adminPhone.replace(/\D/g, '');
            if (!formattedPhone.startsWith('91')) {
                formattedPhone = '91' + formattedPhone;
            }

            const message = '🧪 Test message from WhatsApp Bot\n\nThis confirms that:\n✅ WhatsApp connection is working\n✅ Message sending is functional\n✅ Bot is operational';
            
            if (process.env.MOCK_WHATSAPP === 'true') {
                this.logger.info('🤖 [MOCK MODE] Would send test message to:', formattedPhone);
                this.logger.info('🤖 [MOCK MODE] Message:', message);
                return { success: true, mock: true };
            }

            const result = await this.whatsapp.sendTestMessage(formattedPhone, message);
            this.logger.info('✅ Test message sent successfully');
            return result;

        } catch (error) {
            this.logger.error('❌ Failed to send test message:', error.message);
            throw error;
        }
    }

    /**
     * Start automatic order processing
     */
    startAutomaticOrderProcessing() {
        this.logger.info('🔄 Starting automatic order processing...');
        
        // Process orders immediately on startup
        setTimeout(() => {
            this.processOrders().catch(error => {
                this.logger.error('❌ Initial order processing failed:', error.message);
            });
        }, 10000); // Wait 10 seconds after startup
        
        // Then process orders every 5 minutes
        this.orderProcessingInterval = setInterval(() => {
            this.processOrders().catch(error => {
                this.logger.error('❌ Automatic order processing failed:', error.message);
            });
        }, 5 * 60 * 1000); // 5 minutes
        
        this.logger.info('✅ Automatic order processing started (every 5 minutes)');
    }

    /**
     * Stop automatic order processing
     */
    stopAutomaticOrderProcessing() {
        if (this.orderProcessingInterval) {
            clearInterval(this.orderProcessingInterval);
            this.orderProcessingInterval = null;
            this.logger.info('🛑 Automatic order processing stopped');
        }
    }

    async cleanup() {
        try {
            // Stop automatic order processing
            this.stopAutomaticOrderProcessing();
            
            // Webhook system cleanup
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
        } catch {
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
                } catch {
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
        } catch {
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
