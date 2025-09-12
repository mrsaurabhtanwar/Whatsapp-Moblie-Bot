const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json({ limit: '10mb' }));

// Bot state
let sock = null;
let isReady = false;
let connectionState = 'disconnected';
let port = 3000;

// Statistics
let stats = {
    messagesSent: 0,
    messagesReceived: 0,
    lastActivity: null,
    uptime: Date.now()
};

// Shop hours
const shopHours = {
    start: 10,
    end: 21,
    timezone: 'Asia/Kolkata'
};

const force24_7 = process.env.FORCE_24_7 === '1' || process.env.FORCE_24_7 === 'true';

console.log('🚀 Starting Simple WhatsApp Bot...');

// Find available port
function findAvailablePort() {
    const tryPorts = [3000, 3001, 3002, 3003, 3004, 3005];
    
    for (const testPort of tryPorts) {
        try {
            const server = app.listen(testPort, '0.0.0.0', () => {
                port = testPort;
                console.log(`🚀 WhatsApp Bot Server running on port ${port}`);
                console.log(`📱 WhatsApp Status: ${isReady ? 'Ready' : 'Initializing...'}`);
                console.log(`🏪 Shop Hours: ${shopHours.start} - ${shopHours.end} (${shopHours.timezone})`);
                console.log(`🕐 Current Status: ${isShopOpen() ? 'OPEN' : 'CLOSED'}`);
                console.log(`🔗 Health check: http://0.0.0.0:${port}/`);
                console.log(`📷 QR Code: http://0.0.0.0:${port}/qr`);
                console.log(`🤖 Bot optimized for Termux (Simple & Stable)`);
            });
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`⚠️ Port ${testPort} is in use, trying next port...`);
                    server.close();
                }
            });
            
            return server;
        } catch (error) {
            if (error.code === 'EADDRINUSE') {
                continue;
            }
            throw error;
        }
    }
    
    throw new Error(`❌ Could not start server. All ports ${tryPorts.join(', ')} are in use.`);
}

// Check if shop is open
function isShopOpen() {
    if (force24_7) return true;
    
    const now = new Date();
    const hour = now.getHours();
    const start = shopHours.start;
    const end = shopHours.end;
    
    return hour >= start && hour < end;
}

// Setup WhatsApp connection
async function setupWhatsApp() {
    try {
        console.log('📱 Setting up WhatsApp connection...');
        
        // Use multi-file auth state
        const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-sessions');
        
        // Create logger (silent for better performance)
        const logger = pino({ level: 'silent' });
        
        // Create WhatsApp socket
        sock = makeWASocket({
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
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                await handleQR(qr);
            }
            
            if (connection === 'close') {
                await handleDisconnection(lastDisconnect);
            } else if (connection === 'open') {
                await handleConnection();
            } else if (connection === 'connecting') {
                connectionState = 'connecting';
                console.log('🔄 Connecting to WhatsApp...');
            }
        });
        
        // Save credentials when updated
        sock.ev.on('creds.update', saveCreds);
        
        // Handle incoming messages
        sock.ev.on('messages.upsert', (m) => {
            const messages = m.messages;
            if (messages && messages.length > 0) {
                stats.messagesReceived += messages.length;
                stats.lastActivity = new Date();
                
                messages.forEach(msg => {
                    if (!msg.key.fromMe) {
                        console.log(`📩 Message from: ${msg.key.remoteJid}`);
                        handleIncomingMessage(msg);
                    }
                });
            }
        });
        
        console.log('✅ WhatsApp setup complete');
        
    } catch (error) {
        console.error('❌ WhatsApp setup failed:', error.message);
    }
}

// Handle QR code
async function handleQR(qr) {
    try {
        isReady = false;
        connectionState = 'qr_required';
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
        console.log(`🔗 View QR Code: http://localhost:${port}/qr`);
        
        // Display QR in terminal
        console.log('\n📱 Scan this QR code with WhatsApp:');
        qrcodeTerminal.generate(qr, { small: true });
        console.log('\n⏳ Waiting for QR scan...');
        
    } catch (error) {
        console.error('❌ QR Code generation failed:', error.message);
    }
}

// Handle connection
async function handleConnection() {
    connectionState = 'connected';
    isReady = true;
    stats.lastActivity = new Date();
    
    console.log('✅ WhatsApp connected successfully!');
    console.log(`🕐 Connected at: ${new Date().toLocaleString()}`);
    
    // Clear QR code
    if (fs.existsSync('./qr-code.png')) {
        fs.unlinkSync('./qr-code.png');
    }
}

// Handle disconnection
async function handleDisconnection(lastDisconnect) {
    connectionState = 'disconnected';
    isReady = false;
    
    const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.status;
    const reasonStr = String(lastDisconnect?.error || lastDisconnect || '').toLowerCase();
    
    console.log('🔌 Connection closed:', lastDisconnect?.error || lastDisconnect);
    
    // Handle different disconnect reasons
    if (reason === DisconnectReason.loggedOut || reasonStr.includes('logged out')) {
        console.log('❌ Session logged out. Starting fresh authentication...');
        if (fs.existsSync('./whatsapp-sessions')) {
            fs.rmSync('./whatsapp-sessions', { recursive: true, force: true });
            console.log('🧹 Session cleared for fresh authentication');
        }
        setTimeout(() => setupWhatsApp(), 3000);
        return;
    }
    
    if (reason === 408 || reasonStr.includes('timeout')) {
        console.warn('⚠️ Connection timeout. Retrying...');
        setTimeout(() => setupWhatsApp(), 5000);
        return;
    }
    
    if (reason === DisconnectReason.restartRequired) {
        console.log('🔄 Restart required. Reconnecting...');
        setTimeout(() => setupWhatsApp(), 8000);
        return;
    }
    
    // Handle other disconnections
    console.log('🔄 Reconnecting in 10 seconds...');
    setTimeout(() => setupWhatsApp(), 10000);
}

// Handle incoming messages
async function handleIncomingMessage(msg) {
    try {
        const message = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        const from = msg.key.remoteJid;
        
        console.log(`📩 Received: ${message.substring(0, 50)}...`);
        
        // Auto-reply for common queries
        if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
            await sendMessage(from, 'Hello! Welcome to our tailor shop. How can I help you today?');
        } else if (message.toLowerCase().includes('order') || message.toLowerCase().includes('booking')) {
            await sendMessage(from, 'Thank you for your interest! Please visit our shop or call us for order details.');
        } else if (message.toLowerCase().includes('price') || message.toLowerCase().includes('cost')) {
            await sendMessage(from, 'For pricing information, please visit our shop or call us. We offer competitive rates!');
        }
        
    } catch (error) {
        console.error('❌ Error handling incoming message:', error.message);
    }
}

// Send message
async function sendMessage(phone, message, retries = 3) {
    if (!isReady) {
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
                sock.onWhatsApp(phoneCheck),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Phone verification timeout')), 10000)
                )
            ]);
            
            if (!verifyResult || !verifyResult[0] || !verifyResult[0].exists) {
                throw new Error(`Phone number ${chatId} is not registered on WhatsApp`);
            }
            
            // Send message
            const result = await Promise.race([
                sock.sendMessage(chatId, { text: message }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Send timeout')), 15000)
                )
            ]);
            
            console.log(`✅ Message sent successfully to ${chatId}`);
            stats.messagesSent++;
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

// Setup routes
app.get('/', (req, res) => {
    res.json({
        status: 'WhatsApp Bot Running',
        timestamp: new Date().toISOString(),
        whatsapp: {
            ready: isReady,
            status: connectionState
        },
        stats: stats,
        shopHours: {
            start: shopHours.start,
            end: shopHours.end,
            isOpen: isShopOpen(),
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
app.get('/qr', (req, res) => {
    try {
        if (fs.existsSync('./qr-code.png')) {
            res.sendFile(path.join(__dirname, './qr-code.png'));
        } else {
            res.status(404).json({
                error: 'QR code not available',
                whatsappReady: isReady
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to serve QR code' });
    }
});

// Statistics endpoint
app.get('/stats', (req, res) => {
    res.json({
        stats: stats,
        uptime: Math.round((Date.now() - stats.uptime) / 1000 / 60) + ' minutes',
        whatsapp: {
            ready: isReady,
            status: connectionState
        },
        shopHours: shopHours,
        isShopOpen: isShopOpen()
    });
});

// Send message endpoint
app.post('/send', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone and message are required'
            });
        }
        
        if (!isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready. Please scan QR code first.',
                qrCodeUrl: `http://localhost:${port}/qr`
            });
        }
        
        if (!isShopOpen()) {
            return res.status(503).json({
                success: false,
                error: `Shop is closed. Messages are only sent between ${String(shopHours.start).padStart(2, '0')}:00 and ${String(shopHours.end).padStart(2, '0')}:00.`
            });
        }
        
        const result = await sendMessage(phone, message);
        
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
app.post('/webhook/order-ready', async (req, res) => {
    try {
        console.log('📨 Webhook received:', req.body);
        
        const { customerPhone, message, orderId } = req.body;
        
        if (!customerPhone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customerPhone and message'
            });
        }
        
        if (!isReady) {
            return res.status(503).json({
                success: false,
                error: 'WhatsApp client not ready. Please scan QR code first.',
                qrCodeUrl: `http://localhost:${port}/qr`
            });
        }
        
        const result = await sendMessage(customerPhone, message);
        
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

// Graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

async function gracefulShutdown(signal) {
    console.log(`🛑 ${signal} received, shutting down gracefully...`);
    
    try {
        // Logout from WhatsApp
        if (sock) {
            await sock.logout();
        }
        
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during graceful shutdown:', error.message);
        process.exit(1);
    }
}

// Start the bot
async function startBot() {
    try {
        // Find available port and start server
        findAvailablePort();
        
        // Setup WhatsApp connection
        await setupWhatsApp();
        
        if (force24_7) {
            console.log('⚠️ FORCE_24_7 enabled - running 24/7');
        }
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        process.exit(1);
    }
}

// Start the bot
startBot();
