const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const schedule = require('node-schedule');

class WhatsAppBot {
    constructor() {
        this.app = express();
        this.app.use(express.json({ limit: '10mb' }));
        
        this.sock = null;
        this.isReady = false;
        this.connectionState = 'disconnected';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.keepAliveInterval = null;
        this.port = process.env.PORT || 3000;
        
        // Statistics
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            lastActivity: null,
            uptime: Date.now()
        };
        
        // Shop hours (10 AM to 9 PM)
        this.shopHours = {
            start: 10,
            end: 21,
            timezone: 'Asia/Kolkata'
        };
        
        this.force24_7 = process.env.FORCE_24_7 === '1' || process.env.FORCE_24_7 === 'true';
        
        console.log('🚀 Initializing Robust WhatsApp Bot...');
        this.initialize();
    }
    
    async initialize() {
        try {
            // Setup WhatsApp connection
            await this.setupWhatsApp();
            
            // Setup Express routes
            this.setupRoutes();
            
            // Setup scheduled tasks
            this.setupScheduler();
            
            // Start server
            this.startServer();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            process.exit(1);
        }
    }
    
    async setupWhatsApp() {
        try {
            console.log('📱 Setting up WhatsApp connection...');
            
            // Use multi-file auth state for session persistence
            const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-sessions');
            
            // Create logger (silent for better performance)
            const logger = pino({ level: 'silent' });
            
            // Create WhatsApp socket
            this.sock = makeWASocket({
                auth: state,
                logger,
                browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 1000,
                maxMsgRetryCount: 3,
                getMessage: async (key) => {
                    return { conversation: 'Bot message' };
                }
            });
            
            // Handle connection updates
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;
                
                if (qr) {
                    await this.handleQR(qr);
                }
                
                if (connection === 'close') {
                    await this.handleDisconnection(lastDisconnect);
                } else if (connection === 'open') {
                    await this.handleConnection();
                } else if (connection === 'connecting') {
                    this.connectionState = 'connecting';
                    console.log('🔄 Connecting to WhatsApp...');
                }
            });
            
            // Save credentials when updated
            this.sock.ev.on('creds.update', saveCreds);
            
            // Handle incoming messages
            this.sock.ev.on('messages.upsert', (m) => {
                const messages = m.messages;
                if (messages && messages.length > 0) {
                    this.stats.messagesReceived += messages.length;
                    this.stats.lastActivity = new Date();
                    
                    messages.forEach(msg => {
                        if (!msg.key.fromMe) {
                            console.log(`📩 Message from: ${msg.key.remoteJid}`);
                            this.handleIncomingMessage(msg);
                        }
                    });
                }
            });
            
            // Start keep-alive
            this.startKeepAlive();
            
        } catch (error) {
            console.error('❌ WhatsApp setup failed:', error.message);
            this.scheduleReconnect();
        }
    }
    
    async handleQR(qr) {
        try {
            this.isReady = false;
            this.connectionState = 'qr_required';
            console.log('📱 QR Code received!');
            
            // Save QR as PNG
            await qrcode.toFile('./qr-code.png', qr, {
                type: 'png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            console.log('📷 QR Code saved as qr-code.png');
            console.log('🔗 View QR Code: http://localhost:' + this.port + '/qr');
            
            // Display QR in terminal
            console.log('\n📱 Scan this QR code with WhatsApp:');
            qrcodeTerminal.generate(qr, { small: true });
            console.log('\n⏳ Waiting for QR scan...');
            
        } catch (error) {
            console.error('❌ QR Code generation failed:', error.message);
        }
    }
    
    async handleConnection() {
        this.connectionState = 'connected';
        this.isReady = true;
        this.reconnectAttempts = 0;
        this.stats.lastActivity = new Date();
        
        console.log('✅ WhatsApp connected successfully!');
        console.log(`🕐 Connected at: ${new Date().toLocaleString()}`);
        
        // Clear QR code
        if (fs.existsSync('./qr-code.png')) {
            fs.unlinkSync('./qr-code.png');
        }
    }
    
    async handleDisconnection(lastDisconnect) {
        this.connectionState = 'disconnected';
        this.isReady = false;
        
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.status;
        const reasonStr = String(lastDisconnect?.error || lastDisconnect || '').toLowerCase();
        
        console.log('🔌 Connection closed:', lastDisconnect?.error || lastDisconnect);
        
        // Handle different disconnect reasons
        if (reason === DisconnectReason.loggedOut || reasonStr.includes('logged out')) {
            console.log('❌ Session logged out. Starting fresh authentication...');
            this.reconnectAttempts = 0;
            this.clearSession();
            setTimeout(() => this.setupWhatsApp(), 3000);
            return;
        }
        
        if (reason === 408 || reasonStr.includes('timeout')) {
            console.warn('⚠️ Connection timeout. Retrying...');
            this.reconnectAttempts = 0;
            setTimeout(() => this.setupWhatsApp(), 5000);
            return;
        }
        
        if (reason === DisconnectReason.restartRequired) {
            console.log('🔄 Restart required. Reconnecting...');
            this.reconnectAttempts = 0;
            setTimeout(() => this.setupWhatsApp(), 8000);
            return;
        }
        
        // Handle other disconnections
        this.reconnectAttempts++;
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            const backoff = Math.min(30000, 3000 * Math.pow(1.5, this.reconnectAttempts));
            console.log(`🔄 Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${Math.round(backoff/1000)}s...`);
            setTimeout(() => this.setupWhatsApp(), backoff);
        } else {
            console.warn('⚠️ Max reconnect attempts reached. Will retry in 5 minutes...');
            setTimeout(() => {
                this.reconnectAttempts = 0;
                this.setupWhatsApp();
            }, 300000);
        }
    }
    
    async handleIncomingMessage(msg) {
        try {
            const message = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;
            
            console.log(`📩 Received: ${message.substring(0, 50)}...`);
            
            // Auto-reply for common queries
            if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
                await this.sendMessage(from, 'Hello! Welcome to our tailor shop. How can I help you today?');
            } else if (message.toLowerCase().includes('order') || message.toLowerCase().includes('booking')) {
                await this.sendMessage(from, 'Thank you for your interest! Please visit our shop or call us for order details.');
            } else if (message.toLowerCase().includes('price') || message.toLowerCase().includes('cost')) {
                await this.sendMessage(from, 'For pricing information, please visit our shop or call us. We offer competitive rates!');
            }
            
        } catch (error) {
            console.error('❌ Error handling incoming message:', error.message);
        }
    }
    
    startKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
        }
        
        this.keepAliveInterval = setInterval(async () => {
            try {
                if (this.sock && this.connectionState === 'connected' && this.sock.user) {
                    await Promise.race([
                        this.sock.sendPresenceUpdate('available'),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Keep-alive timeout')), 10000)
                        )
                    ]);
                    console.log('💓 Keep-alive ping sent');
                }
            } catch (err) {
                console.warn('⚠️ Keep-alive failed:', err.message);
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }
    
    clearSession() {
        try {
            if (fs.existsSync('./whatsapp-sessions')) {
                fs.rmSync('./whatsapp-sessions', { recursive: true, force: true });
                console.log('🧹 Session cleared for fresh authentication');
            }
        } catch (error) {
            console.warn('⚠️ Failed to clear session:', error.message);
        }
    }
    
    scheduleReconnect() {
        const delay = Math.min(20000, 2000 * Math.pow(2, this.reconnectAttempts));
        console.log(`🔄 Scheduling reconnect in ${Math.round(delay/1000)}s`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.setupWhatsApp();
        }, delay);
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/', (req, res) => {
            res.json({
                status: 'WhatsApp Bot Running',
                timestamp: new Date().toISOString(),
                whatsapp: {
                    ready: this.isReady,
                    status: this.connectionState,
                    reconnectAttempts: this.reconnectAttempts
                },
                stats: this.stats,
                shopHours: {
                    start: this.shopHours.start,
                    end: this.shopHours.end,
                    isOpen: this.isShopOpen(),
                    currentTime: new Date().toTimeString().slice(0, 5)
                },
                endpoints: {
                    'GET /': 'Health check',
                    'GET /qr': 'QR code for WhatsApp login',
                    'POST /send': 'Send message',
                    'GET /stats': 'Bot statistics',
                    'POST /webhook/order-ready': 'Order ready webhook'
                }
            });
        });
        
        // QR code endpoint
        this.app.get('/qr', (req, res) => {
            try {
                if (fs.existsSync('./qr-code.png')) {
                    res.sendFile(path.join(__dirname, './qr-code.png'));
                } else {
                    res.status(404).json({
                        error: 'QR code not available',
                        whatsappReady: this.isReady
                    });
                }
            } catch (error) {
                res.status(500).json({ error: 'Failed to serve QR code' });
            }
        });
        
        // Statistics endpoint
        this.app.get('/stats', (req, res) => {
            res.json({
                stats: this.stats,
                uptime: Math.round((Date.now() - this.stats.uptime) / 1000 / 60) + ' minutes',
                whatsapp: {
                    ready: this.isReady,
                    status: this.connectionState,
                    reconnectAttempts: this.reconnectAttempts
                },
                shopHours: this.shopHours,
                isShopOpen: this.isShopOpen()
            });
        });
        
        // Send message endpoint
        this.app.post('/send', async (req, res) => {
            try {
                const { phone, message } = req.body;
                
                if (!phone || !message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Phone and message are required'
                    });
                }
                
                if (!this.isReady) {
                    return res.status(503).json({
                        success: false,
                        error: 'WhatsApp client not ready. Please scan QR code first.',
                        qrCodeUrl: `http://localhost:${this.port}/qr`
                    });
                }
                
                if (!this.isShopOpen()) {
                    return res.status(503).json({
                        success: false,
                        error: `Shop is closed. Messages are only sent between ${String(this.shopHours.start).padStart(2, '0')}:00 and ${String(this.shopHours.end).padStart(2, '0')}:00.`
                    });
                }
                
                const result = await this.sendMessage(phone, message);
                this.stats.messagesSent++;
                
                res.json({
                    success: true,
                    message: 'Message sent successfully',
                    messageId: result.key.id,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('❌ Error sending message:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
        
        // Webhook endpoint for order-ready notifications
        this.app.post('/webhook/order-ready', async (req, res) => {
            try {
                console.log('📨 Webhook received:', req.body);
                
                const { customerPhone, message, orderId } = req.body;
                
                if (!customerPhone || !message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Missing required fields: customerPhone and message'
                    });
                }
                
                if (!this.isReady) {
                    return res.status(503).json({
                        success: false,
                        error: 'WhatsApp client not ready. Please scan QR code first.',
                        qrCodeUrl: `http://localhost:${this.port}/qr`
                    });
                }
                
                const result = await this.sendMessage(customerPhone, message);
                this.stats.messagesSent++;
                
                console.log(`✅ Order notification sent to ${customerPhone}`);
                
                res.json({
                    success: true,
                    message: 'Order notification sent successfully',
                    orderId: orderId || 'unknown',
                    messageId: result.key.id,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('❌ Webhook error:', error.message);
                res.status(500).json({
                    success: false,
                    error: 'Failed to send WhatsApp message',
                    details: error.message
                });
            }
        });
    }
    
    setupScheduler() {
        if (!this.force24_7) {
            // Schedule shop opening at 10:00 AM
            schedule.scheduleJob('0 10 * * *', () => {
                console.log('🏪 Shop Opening - System ready for business (10:00)');
                this.stats.messagesSent = 0; // Reset daily counter
            });
            
            // Schedule shop closing at 9:00 PM
            schedule.scheduleJob('0 21 * * *', () => {
                console.log('🏪 Shop Closing - End of business day (21:00)');
                console.log(`📊 Today's Summary: ${this.stats.messagesSent} messages sent`);
            });
        } else {
            console.log('⚠️ FORCE_24_7 enabled - running 24/7');
        }
    }
    
    startServer() {
        this.app.listen(this.port, '0.0.0.0', () => {
            console.log(`🚀 WhatsApp Bot Server running on port ${this.port}`);
            console.log(`📱 WhatsApp Status: ${this.isReady ? 'Ready' : 'Initializing...'}`);
            console.log(`🏪 Shop Hours: ${this.shopHours.start} - ${this.shopHours.end} (${this.shopHours.timezone})`);
            console.log(`🕐 Current Status: ${this.isShopOpen() ? 'OPEN' : 'CLOSED'}`);
            console.log(`🔗 Health check: http://0.0.0.0:${this.port}/`);
            console.log(`📷 QR Code: http://0.0.0.0:${this.port}/qr`);
            console.log(`🤖 Bot optimized for Termux (Robust & Stable)`);
        });
    }
    
    setupGracefulShutdown() {
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    }
    
    async gracefulShutdown(signal) {
        console.log(`🛑 ${signal} received, shutting down gracefully...`);
        
        try {
            // Clear intervals
            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
            }
            
            // Cancel scheduled jobs
            const jobs = schedule.scheduledJobs || {};
            Object.keys(jobs).forEach((name) => {
                try {
                    schedule.cancelJob(name);
                } catch (e) {
                    console.warn('⚠️ Could not cancel job:', name);
                }
            });
            
            // Logout from WhatsApp
            if (this.sock) {
                await this.sock.logout();
            }
            
            console.log('✅ Graceful shutdown complete');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during graceful shutdown:', error.message);
            process.exit(1);
        }
    }
    
    isShopOpen() {
        if (this.force24_7) return true;
        
        const now = new Date();
        const hour = now.getHours();
        const start = this.shopHours.start;
        const end = this.shopHours.end;
        
        return hour >= start && hour < end;
    }
    
    async sendMessage(phone, message, retries = 3) {
        if (!this.isReady) {
            throw new Error('WhatsApp client not ready. Please scan QR code first.');
        }
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Format phone number
                let formattedPhone = phone.toString().replace(/\D/g, '');
                if (!formattedPhone.startsWith('91')) {
                    formattedPhone = `91${formattedPhone}`;
                }
                const chatId = `${formattedPhone}@s.whatsapp.net`;
                
                console.log(`📤 Sending message to ${chatId}: ${message.substring(0, 50)}...`);
                
                // Verify phone number exists on WhatsApp
                const phoneCheck = formattedPhone;
                const verifyResult = await Promise.race([
                    this.sock.onWhatsApp(phoneCheck),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Phone verification timeout')), 10000)
                    )
                ]);
                
                if (!verifyResult || !verifyResult[0] || !verifyResult[0].exists) {
                    throw new Error(`Phone number ${chatId} is not registered on WhatsApp`);
                }
                
                // Send message
                const result = await Promise.race([
                    this.sock.sendMessage(chatId, { text: message }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Send timeout')), 15000)
                    )
                ]);
                
                console.log(`✅ Message sent successfully to ${chatId}`);
                return result;
                
            } catch (error) {
                console.log(`❌ Attempt ${attempt} failed:`, error.message);
                
                if (attempt === retries) {
                    throw new Error(`Failed to send message after ${retries} attempts: ${error.message}`);
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
}

// Start the bot
const bot = new WhatsAppBot();
