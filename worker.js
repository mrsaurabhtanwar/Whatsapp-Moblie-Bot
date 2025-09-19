
require('dotenv').config();
const express = require('express');
const PQueue = require('p-queue').default;
const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const EnhancedWhatsAppClient = require('./enhanced-whatsapp-client');
const MessageTemplates = require('./message-templates');
const WhatsAppTailorBot = require('./main-bot');
const AdminCommands = require('./admin-commands');

// Simple ProcessLockManager implementation
class ProcessLockManager {
    constructor() {
        this.lockFile = path.join(__dirname, '.bot-lock.json');
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
                // Create lock
                await this.createLock();
                return true;
            }
            
            // Check if the process is still running
            if (lockStatus.pid) {
                try {
                    process.kill(lockStatus.pid, 0); // Check if process exists
                    return false; // Process still running
                } catch (error) {
                    // Process not running, we can take over
                    await this.createLock();
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.warn('Lock check failed:', error.message);
            return true; // Assume we can start if check fails
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
            // Lock file might not exist, which is fine
        }
    }
}

// Initialize logger
const logger = {
    info: (msg, ...args) => console.log('[INFO]', msg, ...args),
    warn: (msg, ...args) => console.warn('[WARN]', msg, ...args),
    error: (msg, ...args) => console.error('[ERROR]', msg, ...args),
    debug: (msg, ...args) => console.log('[DEBUG]', msg, ...args)
};

class WhatsAppSheetBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.host = process.env.HOST || 'localhost';
        
        // Initialize process lock manager first
        this.lockManager = new ProcessLockManager();
        
        // Log effective environment values for Google Sheets (diagnostics)
        try {
            logger.info('Effective Google Sheets IDs', {
                GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || null,
                FABRIC_SHEET_ID: process.env.FABRIC_SHEET_ID || null,
                COMBINED_SHEET_ID: process.env.COMBINED_SHEET_ID || null,
                WORKER_SHEET_ID: process.env.WORKER_SHEET_ID || null,
                GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME || null,
                WORKER_SHEET_NAME: process.env.WORKER_SHEET_NAME || null
            });
        } catch (e) {
            // no-op
        }

        // Initialize components
        this.sheets = new WhatsAppTailorBot();
        this.whatsapp = new EnhancedWhatsAppClient({
            duplicatePreventionEnabled: true,
            maxMessagesPerDay: 5,
            messageCooldownMs: 300000, // 5 minutes
            duplicateCheckWindowMs: 24 * 60 * 60 * 1000 // 24 hours
        });
        this.jobQueue = null;
        this.adminCommands = null;
        
        // Configuration
        this.pollInterval = parseInt(process.env.POLL_INTERVAL_SECONDS || '180') * 1000; // 3 minutes default to avoid API limits
        this.batchSize = parseInt(process.env.BATCH_SIZE || '10');
        this.botMode = process.env.BOT_MODE || 'AUTO';
        this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
        this.retryDelay = parseInt(process.env.RETRY_DELAY_SECONDS || '30') * 1000;
        
        // State
        this.isPolling = false;
        this.pollingJob = null;
        this.processedOrders = new Set();
        
        // Memory management
        this.maxProcessedOrders = 10000;
        this.processedOrdersCleanupInterval = 3600000; // 1 hour
        this.lastCleanup = Date.now();
        
        this.setupQueue();
        this.setupExpress();
        this.setupEventHandlers();
        this.setupErrorHandlers();

        // Bind helpers
        this.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        this.formatPhoneForWhatsApp = (raw) => {
            if (!raw) {
                logger.warn('Phone number is empty or null');
                return null;
            }
            
            try {
                // Enhanced validation
                let digits = String(raw).replace(/\D/g, '');
                
                // Validate length and format
                if (digits.length < 10 || digits.length > 15) {
                    logger.warn(`Invalid phone number length: ${digits.length} for ${raw}`);
                    return null;
                }
                
                // Normalize to Indian format
                if (digits.length === 10) digits = '91' + digits;
                if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1);
                if (digits.length === 13 && digits.startsWith('+91')) digits = digits.slice(1);
                
                // Final validation
                if (!(digits.length === 12 && digits.startsWith('91'))) {
                    logger.warn(`Invalid phone format after normalization: ${digits} for ${raw}`);
                    return null;
                }
                
                return digits;
            } catch (error) {
                logger.error('Phone formatting error:', error.message, 'for input:', raw);
                return null;
            }
        };
    }

    async setupQueue() {
        try {
            // Use PQueue for simple in-memory job processing
            this.jobQueue = new PQueue({ 
                concurrency: 1, 
                interval: 2000, 
                intervalCap: 1 
            });

            // Initialize admin commands after queue is ready
            this.adminCommands = new AdminCommands(this.whatsapp, this.sheets, this.jobQueue);
            
            logger.info('Using PQueue for job processing');
            
        } catch (error) {
            logger.warn('PQueue setup failed, creating simple queue interface');
            // Create minimal queue interface for compatibility
            this.jobQueue = {
                getStats: async () => ({ active: 0, waiting: 0, completed: 0, failed: 0 }),
                close: async () => { logger.info('Queue closed'); }
            };
            this.adminCommands = new AdminCommands(this.whatsapp, this.sheets, this.jobQueue);
        }
    }



    setupExpress() {
        this.app.use(express.json());
        // Quiet favicon requests
        this.app.get('/favicon.ico', (req, res) => res.status(204).end());
        
        // Health check endpoint (root)
        const healthHandler = async (req, res) => {
            try {
                const whatsappHealth = await this.whatsapp.isHealthy();
                const sheetsHealth = await this.sheets.healthCheck();
                
                let queueStats = { active: 0, waiting: 0, completed: 0, failed: 0 };
                try {
                    queueStats = await this.jobQueue.getStats();
                } catch (queueError) {
                    logger.warn('Queue stats not available:', queueError.message);
                }
                
                // Get lock status
                const lockStatus = await this.lockManager.getLockStatus();
                
                res.json({
                    status: 'running',
                    timestamp: new Date().toISOString(),
                    whatsapp: whatsappHealth,
                    sheets: sheetsHealth,
                    queue: queueStats,
                    polling: this.isPolling,
                    mode: this.botMode,
                    locks: lockStatus,
                    env: {
                        PORT: this.port,
                        HOST: this.host,
                        GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || null,
                        FABRIC_SHEET_ID: process.env.FABRIC_SHEET_ID || null,
                        COMBINED_SHEET_ID: process.env.COMBINED_SHEET_ID || null,
                        WORKER_SHEET_ID: process.env.WORKER_SHEET_ID || null
                    },
                    version: '2.1.0-enhanced',
                    enhancements: {
                        processLocking: true,
                        enhancedWhatsApp: true,
                        improvedErrorHandling: true
                    }
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    error: error.message
                });
            }
        };

        // QR code endpoint (default route)
        this.app.get('/', async (req, res) => {
            try {
                const qrCode = this.whatsapp.getQRCode();
                const qrDataURL = await this.whatsapp.getQRCodeDataURL();
                const connectionStatus = this.whatsapp.getConnectionStatus();
                
                logger.info('Dashboard accessed', { 
                    hasQRCode: !!qrCode, 
                    hasQRDataURL: !!qrDataURL,
                    qrCodeType: typeof qrCode,
                    qrCodeLength: qrCode ? qrCode.length : 0,
                    connectionStatus 
                });
                
                if (qrDataURL) {
                    // Ensure QR data URL is properly formatted without line breaks
                    const cleanQRDataURL = qrDataURL.replace(/\s+/g, '');
                    
                    // Create complete HTML response with phone authentication
                    const htmlResponse = `<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Bot Dashboard</title>
    <style>
        body { text-align: center; padding: 20px; font-family: Arial, sans-serif; background-color: #f0f0f0; }
        .container { max-width: 1000px; margin: 0 auto; }
        .auth-section { display: inline-block; vertical-align: top; margin: 10px; }
        .qr-container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 400px; }
        .phone-container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 400px; }
        img { max-width: 300px; border: 2px solid #ddd; border-radius: 8px; }
        .status { margin-top: 20px; padding: 10px; background: #e8f5e8; border-radius: 5px; }
        .debug { margin-top: 20px; font-size: 12px; color: #666; background: #f9f9f9; padding: 10px; border-radius: 5px; }
        .instructions { margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 5px; text-align: left; }
        .phone-form { margin: 15px 0; }
        .phone-form input { padding: 10px; margin: 5px; border: 1px solid #ddd; border-radius: 5px; width: 200px; }
        .phone-form button { padding: 10px 20px; background: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        .phone-form button:hover { background: #128C7E; }
        .pair-section { margin-top: 15px; padding: 15px; background: #f0f8ff; border-radius: 5px; }
        .hidden { display: none; }
        .success { color: #25D366; font-weight: bold; }
        .error { color: #ff4444; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <h2>📱 WhatsApp Bot Dashboard</h2>
        
        <div class="auth-section">
            <div class="qr-container">
                <h3>📷 QR Code Authentication</h3>
                <img src="${cleanQRDataURL}" alt="WhatsApp QR Code">
                <div class="instructions">
                    <h4>How to scan QR Code:</h4>
                    <ol>
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to Settings → Linked Devices</li>
                        <li>Tap "Link a Device"</li>
                        <li>Scan this QR code</li>
                    </ol>
                </div>
            </div>
        </div>
        
        <div class="auth-section">
            <div class="phone-container">
                <h3>📞 Phone Number Authentication</h3>
                <div class="phone-form">
                    <input type="tel" id="phoneInput" placeholder="+91XXXXXXXXXX" maxlength="15">
                    <br>
                    <button onclick="startPhoneAuth()">Generate Pairing Code</button>
                </div>
                
                <div id="pair-section" class="pair-section hidden">
                    <h4>Enter Pairing Code:</h4>
                    <input type="text" id="pairCodeInput" placeholder="123456" maxlength="6">
                    <br>
                    <button onclick="verifyPairCode()">Verify Code</button>
                    <div id="pairStatus"></div>
                </div>
                
                <div class="instructions">
                    <h4>How to use Phone Authentication:</h4>
                    <ol>
                        <li>Enter your phone number with country code</li>
                        <li>Click "Generate Pairing Code"</li>
                        <li>Open WhatsApp on your phone</li>
                        <li>Go to Settings → Linked Devices</li>
                        <li>Tap "Link a Device"</li>
                        <li>Select "Link with Phone Number Instead"</li>
                        <li>Enter the 6-digit pairing code</li>
                    </ol>
                </div>
            </div>
        </div>
        
        <div class="status">
            <p><strong>Status:</strong> ${connectionStatus.connected ? '✅ Connected' : '⏳ Waiting for authentication'}</p>
            <p><strong>Connection Attempts:</strong> ${connectionStatus.connectionAttempts}/${connectionStatus.maxAttempts}</p>
            <p><strong>State:</strong> ${connectionStatus.state}</p>
        </div>
        
        <div class="debug">
            <h4>Debug Info:</h4>
            <p>Has QR Code: ${!!qrCode}</p>
            <p>QR Code Length: ${qrCode ? qrCode.length : 0}</p>
            <p>Connection Status: ${JSON.stringify(connectionStatus)}</p>
        </div>
    </div>
    
    <script>
        let isWaitingForPairing = false;
        
        async function startPhoneAuth() {
            const phoneNumber = document.getElementById('phoneInput').value.trim();
            if (!phoneNumber) {
                alert('Please enter phone number');
                return;
            }
            
            try {
                const response = await fetch('/auth/phone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phoneNumber })
                });
                
                const result = await response.json();
                if (result.success) {
                    isWaitingForPairing = true;
                    document.getElementById('pair-section').classList.remove('hidden');
                    if (result.code) {
                        document.getElementById('pairStatus').innerHTML = '<div class="success">Pairing code: ' + result.code + '</div>';
                    }
                } else {
                    document.getElementById('pairStatus').innerHTML = '<div class="error">Error: ' + result.message + '</div>';
                }
            } catch (error) {
                document.getElementById('pairStatus').innerHTML = '<div class="error">Error: ' + error.message + '</div>';
            }
        }
        
        async function verifyPairCode() {
            const code = document.getElementById('pairCodeInput').value.trim();
            if (!code) {
                alert('Please enter pairing code');
                return;
            }
            
            try {
                const response = await fetch('/auth/pair-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                
                const result = await response.json();
                if (result.success) {
                    document.getElementById('pairStatus').innerHTML = '<div class="success">✅ Pairing successful! Please check WhatsApp.</div>';
                    setTimeout(() => location.reload(), 2000);
                } else {
                    document.getElementById('pairStatus').innerHTML = '<div class="error">Error: ' + result.message + '</div>';
                }
            } catch (error) {
                document.getElementById('pairStatus').innerHTML = '<div class="error">Error: ' + error.message + '</div>';
            }
        }
        
        // Auto-refresh every 10 seconds
        setInterval(() => {
            if (!isWaitingForPairing) {
                location.reload();
            }
        }, 10000);
    </script>
</body>
</html>`;
                    
                    res.send(htmlResponse);
                } else {
                    res.status(404).send(`
                        <html>
                            <head><title>QR Code Not Available</title></head>
                            <body style="text-align: center; padding: 50px;">
                                <h2>❌ QR Code Not Available</h2>
                                <p>WhatsApp client is not generating QR codes yet.</p>
                                <p><strong>Debug Info:</strong></p>
                                <p>Has QR Code: ${!!qrCode}</p>
                                <p>Connection Status: ${JSON.stringify(connectionStatus)}</p>
                                <p>Please wait a moment and refresh this page.</p>
                            </body>
                        </html>
                    `);
                }
            } catch (error) {
                logger.error('Dashboard error:', error);
                res.status(500).send(`
                    <html>
                        <head><title>Dashboard Error</title></head>
                        <body style="text-align: center; padding: 50px;">
                            <h2>❌ Dashboard Error</h2>
                            <p>Error: ${error.message}</p>
                        </body>
                    </html>
                `);
            }
        });
        
        // Health check endpoint (JSON)
        this.app.get('/health', healthHandler);

        // QR code endpoint
        this.app.get('/qr', async (req, res) => {
            try {
                const qrCode = this.whatsapp.getQRCode();
                const qrDataURL = await this.whatsapp.getQRCodeDataURL();
                const connectionStatus = this.whatsapp.getConnectionStatus();
                
                logger.info('QR endpoint called', { 
                    hasQRCode: !!qrCode, 
                    hasQRDataURL: !!qrDataURL,
                    qrCodeType: typeof qrCode,
                    qrCodeLength: qrCode ? qrCode.length : 0,
                    connectionStatus 
                });
                
                if (qrDataURL) {
                    // Ensure QR data URL is properly formatted without line breaks
                    const cleanQRDataURL = qrDataURL.replace(/\s+/g, '');
                    
                    // Create HTML response with proper formatting - no line breaks in img src
                    const htmlResponse = '<!DOCTYPE html><html><head><title>WhatsApp QR Code</title><style>body{text-align:center;padding:50px;font-family:Arial,sans-serif;background-color:#f0f0f0}.qr-container{background:white;padding:20px;border-radius:10px;display:inline-block;box-shadow:0 4px 6px rgba(0,0,0,0.1)}img{max-width:400px;border:2px solid #ddd;border-radius:8px}.status{margin-top:20px;padding:10px;background:#e8f5e8;border-radius:5px}.debug{margin-top:20px;font-size:12px;color:#666;background:#f9f9f9;padding:10px;border-radius:5px}</style></head><body><h2>📱 WhatsApp Bot QR Code</h2><div class="qr-container"><img src="' + cleanQRDataURL + '" alt="WhatsApp QR Code"></div><div class="status"><p><strong>Status:</strong> ' + (connectionStatus.connected ? '✅ Connected' : '⏳ Waiting for QR scan') + '</p><p><strong>Connection Attempts:</strong> ' + connectionStatus.connectionAttempts + '/' + connectionStatus.maxAttempts + '</p></div><div class="debug"><p><strong>Debug Info:</strong></p><p>QR Code Type: ' + typeof qrCode + '</p><p>QR Code Length: ' + (qrCode ? qrCode.length : 'N/A') + '</p><p>Data URL Available: ' + (qrDataURL ? 'Yes' : 'No') + '</p></div><p><small>If QR code doesn\'t appear, refresh this page</small></p></body></html>';
                    
                    res.send(htmlResponse);
                } else {
                    res.status(404).send(`
                        <html>
                            <head><title>QR Code Not Available</title></head>
                            <body style="text-align: center; padding: 50px;">
                                <h2>❌ QR Code Not Available</h2>
                                <p>WhatsApp client is not generating QR codes yet.</p>
                                <p><strong>Debug Info:</strong></p>
                                <p>Has QR Code: ${!!qrCode}</p>
                                <p>Connection Status: ${JSON.stringify(connectionStatus)}</p>
                                <p>Please wait a moment and refresh this page.</p>
                            </body>
                        </html>
                    `);
                }
            } catch (error) {
                logger.error('QR endpoint error:', error);
                res.status(500).send(`
                    <html>
                        <head><title>QR Code Error</title></head>
                        <body style="text-align: center; padding: 50px;">
                            <h2>❌ Error Loading QR Code</h2>
                            <p>Error: ${error.message}</p>
                            <p>Please check the bot logs and try again.</p>
                        </body>
                    </html>
                `);
            }
        });

        // Manual trigger endpoint
        this.app.post('/trigger', async (req, res) => {
            try {
                await this.pollForReadyOrders();
                res.json({ message: 'Polling triggered successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Phone authentication page
        this.app.get('/auth', (req, res) => {
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot Authentication</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 20px;
                        background: linear-gradient(135deg, #25D366, #128C7E);
                        color: white;
                        min-height: 100vh;
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                    }
                    .container {
                        background: rgba(255,255,255,0.1);
                        padding: 30px;
                        border-radius: 15px;
                        backdrop-filter: blur(10px);
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    h1 { margin-bottom: 30px; }
                    .auth-method {
                        margin: 20px 0;
                        padding: 20px;
                        background: rgba(255,255,255,0.1);
                        border-radius: 10px;
                        border: 2px solid transparent;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    }
                    .auth-method:hover {
                        background: rgba(255,255,255,0.2);
                        border-color: rgba(255,255,255,0.3);
                    }
                    .auth-method h3 {
                        margin: 0 0 10px 0;
                        font-size: 20px;
                    }
                    .auth-method p {
                        margin: 5px 0;
                        opacity: 0.9;
                    }
                    .form-group {
                        margin: 15px 0;
                        text-align: left;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    .form-group input {
                        width: 100%;
                        padding: 12px;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        box-sizing: border-box;
                    }
                    .btn {
                        background: #25D366;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        cursor: pointer;
                        margin: 10px 5px;
                        transition: background 0.3s ease;
                    }
                    .btn:hover {
                        background: #128C7E;
                    }
                    .btn:disabled {
                        background: #666;
                        cursor: not-allowed;
                    }
                    .status {
                        margin-top: 20px;
                        padding: 15px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 8px;
                        font-weight: bold;
                    }
                    .hidden { display: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🔐 WhatsApp Bot Authentication</h1>
                    
                    <div class="auth-method" onclick="showQR()">
                        <h3>📱 QR Code Login</h3>
                        <p>Scan QR code with your WhatsApp mobile app</p>
                        <p>Most common method</p>
                    </div>
                    
                    <div class="auth-method" onclick="showPhone()">
                        <h3>📞 Phone Number Login (Pairing Code)</h3>
                        <p>Login using your phone number and a WhatsApp pairing code</p>
                        <p>Open WhatsApp → Linked devices → Link a device → Link with phone number</p>
                    </div>
                    
                    <div id="qr-section" class="hidden">
                        <h3>QR Code Authentication</h3>
                        <p>Click the button below to generate QR code</p>
                        <button class="btn" onclick="generateQR()">Generate QR Code</button>
                        <div id="qr-container"></div>
                    </div>
                    
                        <div id="phone-section" class="hidden">
                        <h3>Phone Number Authentication</h3>
                        <div class="form-group">
                            <label for="phoneNumber">Phone Number (with country code):</label>
                            <input type="tel" id="phoneNumber" placeholder="+919876543210" value="+917375938371">
                        </div>
                        <button class="btn" onclick="startPhoneAuth()">Generate Pairing Code</button>
                        
                        <div id="pair-section" class="hidden">
                            <div class="form-group">
                                <label>Pairing Code:</label>
                                <div id="pairCode" style="font-size: 28px; letter-spacing: 4px; font-weight: bold; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px;">
                                </div>
                                <small style="color: #ccc; font-size: 12px; margin-top: 5px; display: block;">
                                    On your phone: WhatsApp → Linked devices → Link a device → Link with phone number → Enter this code
                                </small>
                            </div>
                            <button class="btn" onclick="refreshPairingCode()">Refresh Code</button>
                        </div>
                        
                        <div style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 14px;">
                            <h4 style="margin: 0 0 10px 0;">📋 Instructions:</h4>
                            <ol style="margin: 0; padding-left: 20px;">
                                <li>Enter your phone number with country code (e.g., +917375938371)</li>
                                <li>Click "Generate Pairing Code"</li>
                                <li>Open WhatsApp on your phone → Linked devices → Link a device → Link with phone number</li>
                                <li>Enter the pairing code shown here</li>
                                <li>Wait for connection to be established</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div id="status" class="status">
                        Status: Checking connection...
                    </div>
                </div>

                <script>
                    let isWaitingForPairing = false;
                    
                    // Check initial status
                    checkStatus();
                    
                    function showQR() {
                        document.getElementById('qr-section').classList.remove('hidden');
                        document.getElementById('phone-section').classList.add('hidden');
                    }
                    
                    function showPhone() {
                        document.getElementById('phone-section').classList.remove('hidden');
                        document.getElementById('qr-section').classList.add('hidden');
                    }
                    
                    async function generateQR() {
                        try {
                            const response = await fetch('/qr');
                            if (response.ok) {
                                const qrWindow = window.open('/qr', '_blank', 'width=500,height=600');
                                checkStatus();
                            } else {
                                alert('Error generating QR code');
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }
                    
                    async function startPhoneAuth() {
                        const phoneNumber = document.getElementById('phoneNumber').value;
                        if (!phoneNumber) {
                            alert('Please enter phone number');
                            return;
                        }
                        
                        try {
                            const response = await fetch('/auth/phone', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ phoneNumber })
                            });
                            
                            const result = await response.json();
                            if (result.success) {
                                isWaitingForPairing = true;
                                document.getElementById('pair-section').classList.remove('hidden');
                                if (result.code) {
                                    document.getElementById('pairCode').textContent = result.code;
                                } else {
                                    // fetch code from status if not returned
                                    await fetchPairingCode();
                                }
                                updateStatus('Pairing code generated. Enter it on your phone to link.');
                            } else {
                                alert('Error: ' + result.error);
                            }
                        } catch (error) {
                            alert('Error: ' + error.message);
                        }
                    }

                    async function fetchPairingCode() {
                        try {
                            const res = await fetch('/auth/pair-code');
                            const data = await res.json();
                            if (data.code) {
                                document.getElementById('pairCode').textContent = data.code;
                            }
                        } catch (e) {
                            // ignore
                        }
                    }

                    async function refreshPairingCode() {
                        await startPhoneAuth();
                    }
                    
                    async function checkStatus() {
                        try {
                            const response = await fetch('/auth/status');
                            const status = await response.json();
                            
                            if (status.isConnected) {
                                updateStatus('✅ Connected successfully!');
                            } else if (status.isWaitingForPairing) {
                                updateStatus('⏳ Waiting for you to enter the pairing code on your phone...');
                            } else if (status.hasQRCode) {
                                updateStatus('⏳ QR code generated. Please scan with WhatsApp...');
                            } else {
                                updateStatus('⏳ Not connected. Choose authentication method above.');
                            }
                        } catch (error) {
                            updateStatus('❌ Error checking status');
                        }
                    }
                    
                    function updateStatus(message) {
                        document.getElementById('status').textContent = 'Status: ' + message;
                    }
                    
                    // Check status every 3 seconds
                    setInterval(checkStatus, 3000);
                </script>
            </body>
            </html>
            `;
            
            res.send(html);
        });

        // Debug endpoint to check sheet data
        this.app.get('/debug/sheet', async (req, res) => {
            try {
                const allData = await this.sheets.readSheet();
                const readyOrders = await this.sheets.findReadyOrders();
                const welcomeOrders = await this.sheets.findOrdersNeedingWelcome();
                const confirmationOrders = await this.sheets.findOrdersNeedingConfirmation();
                const deliveryOrders = await this.sheets.findOrdersNeedingDeliveryNotification();
                const pickupReminderOrders = await this.sheets.findOrdersNeedingPickupReminders();
                const paymentReminderOrders = await this.sheets.findOrdersNeedingPaymentReminders();
                
                // Fabric orders
                const fabricWelcomeOrders = await this.sheets.findFabricOrdersNeedingWelcome();
                const fabricPurchaseOrders = await this.sheets.findFabricOrdersNeedingPurchaseNotification();
                const fabricPaymentReminderOrders = await this.sheets.findFabricOrdersNeedingPaymentReminders();
                
                // Combined orders
                const combinedOrders = await this.sheets.findCombinedOrdersNeedingNotification();
                
                res.json({
                    totalRows: allData.length,
                    readyOrdersCount: readyOrders.length,
                    welcomeOrdersCount: welcomeOrders.length,
                    confirmationOrdersCount: confirmationOrders.length,
                    deliveryOrdersCount: deliveryOrders.length,
                    pickupReminderOrdersCount: pickupReminderOrders.length,
                    paymentReminderOrdersCount: paymentReminderOrders.length,
                    fabricWelcomeOrdersCount: fabricWelcomeOrders.length,
                    fabricPurchaseOrdersCount: fabricPurchaseOrders.length,
                    fabricPaymentReminderOrdersCount: fabricPaymentReminderOrders.length,
                    combinedOrdersCount: combinedOrders.length,
                    sampleData: allData.slice(0, 2), // First 2 rows
                    readyOrders: readyOrders,
                    welcomeOrders: welcomeOrders,
                    confirmationOrders: confirmationOrders,
                    deliveryOrders: deliveryOrders,
                    pickupReminderOrders: pickupReminderOrders,
                    paymentReminderOrders: paymentReminderOrders,
                    fabricWelcomeOrders: fabricWelcomeOrders,
                    fabricPurchaseOrders: fabricPurchaseOrders,
                    fabricPaymentReminderOrders: fabricPaymentReminderOrders,
                    combinedOrders: combinedOrders
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Test endpoint to manually send a message
        this.app.post('/test/send', async (req, res) => {
            try {
                const { phone, message } = req.body;
                if (!phone || !message) {
                    return res.status(400).json({ error: 'Phone and message are required' });
                }
                // Send test message using enhanced method (bypasses duplicate prevention)
                const result = await this.whatsapp.sendTestMessage(phone, message);
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Phone number pairing-code authentication endpoints
        this.app.post('/auth/phone', async (req, res) => {
            try {
                const { phoneNumber } = req.body;
                if (!phoneNumber) {
                    return res.status(400).json({ error: 'Phone number is required' });
                }

                const result = await this.whatsapp.startPhoneAuth(phoneNumber);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Expose current pairing code
        this.app.get('/auth/pair-code', async (req, res) => {
            try {
                const status = this.whatsapp.getAuthStatus();
                res.json({ code: status.pairingCode, expiresAt: status.pairingExpiresAt });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/auth/status', async (req, res) => {
            try {
                const status = this.whatsapp.getAuthStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/auth/switch-mode', async (req, res) => {
            try {
                const { mode } = req.body;
                if (!mode || !['qr', 'phone'].includes(mode)) {
                    return res.status(400).json({ error: 'Mode must be "qr" or "phone"' });
                }

                if (mode === 'qr') {
                    this.whatsapp.switchToQRMode();
                } else {
                    this.whatsapp.switchToPhoneMode();
                }

                res.json({ success: true, mode });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Test endpoint to send a sample order notification
        this.app.post('/test/order', async (req, res) => {
            try {
                const { phone = '7375938371' } = req.body;
                
                // Create sample order data
                const sampleOrder = {
                    'Order ID': 'TEST-001',
                    'Customer Name': 'Test Customer',
                    'Contact Info': phone,
                    'Garment Types': 'Shirt and Pants',
                    'Price': '2500',
                    'Advance Payment': '1000',
                    'Remaining Amount': '1500',
                    'Delivery Date': 'Tomorrow',
                    'Order Date': 'Today'
                };
                
                // Send order notification
                const result = await this.sendOrderNotification('TEST-001', sampleOrder);
                res.json({ success: true, message: 'Test order notification sent', result });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Clear processed orders (for testing)
        this.app.post('/clear-processed', async (req, res) => {
            try {
                this.processedOrders.clear();
                res.json({ message: 'Processed orders cleared', count: this.processedOrders.size });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Manually mark order as notified
        this.app.post('/mark-notified', async (req, res) => {
            try {
                const { orderId } = req.body;
                if (!orderId) {
                    return res.status(400).json({ error: 'Order ID is required' });
                }
                
                const allData = await this.sheets.readSheet();
                const order = allData.find(row => 
                    (row['Order ID'] === orderId) || (row['Master Order ID'] === orderId)
                );
                
                if (!order) {
                    return res.status(404).json({ error: 'Order not found' });
                }
                
                await this.sheets.markOrderAsNotified(order, 'MANUAL');
                res.json({ message: `Order ${orderId} marked as notified` });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Queue stats endpoint
        this.app.get('/queue', async (req, res) => {
            try {
                let stats = { active: 0, waiting: 0, completed: 0, failed: 0 };
                try {
                    stats = await this.jobQueue.getStats();
                } catch (queueError) {
                    logger.warn('Queue stats not available:', queueError.message);
                }
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Template management endpoints
        this.app.get('/templates', async (req, res) => {
            try {
                const templates = this.whatsapp.templates.getAvailableTemplates();
                res.json(templates);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/templates/preview', async (req, res) => {
            try {
                const { templateType, data, language } = req.body;
                const preview = this.whatsapp.templates.formatTemplate(templateType, data, language);
                res.json({ preview });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/templates/test', async (req, res) => {
            try {
                const { customerPhone, templateType, data, language } = req.body;
                // Normalize phone into proper WhatsApp JID
                let jid = customerPhone;
                if (!String(jid).includes('@s.whatsapp.net')) {
                    const formatted = this.formatPhoneForWhatsApp(jid);
                    if (!formatted) {
                        return res.status(400).json({ error: 'Invalid phone format' });
                    }
                    jid = `${formatted}@s.whatsapp.net`;
                }
                const msg = this.whatsapp.templates.formatTemplate(templateType, data, language);
                const result = await this.whatsapp.sendTestMessage(customerPhone, msg);
                res.json({ success: result.success, messageId: result.messageId });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Comprehensive test endpoint
        this.app.post('/test/comprehensive', async (req, res) => {
            try {
                const { testPhone = '7375938371', testType = 'all' } = req.body;
                const testResults = {
                    timestamp: new Date().toISOString(),
                    testPhone: testPhone,
                    testType: testType,
                    results: [],
                    summary: {
                        total: 0,
                        passed: 0,
                        failed: 0,
                        errors: []
                    }
                };

                // Test data for all templates
                const testData = {
                    orderData: {
                        order_id: 'TEST-001',
                        customer_name: 'Test Customer',
                        customer_phone: testPhone,
                        garment_type: 'Shirt',
                        delivery_date: 'Tomorrow',
                        ready_date: 'Today',
                        total_amount: '1500',
                        advance_amount: '500',
                        remaining_amount: '1000',
                        outstanding_amount: '1000',
                        business_hours: '10:00 AM - 7:00 PM'
                    },
                    workerData: {
                        worker_name: 'Test Worker',
                        date: 'Today',
                        paint_count: '5',
                        shirt_count: '3',
                        total_work_amount: '2000',
                        advance_taken: '500',
                        remaining_payment: '1500',
                        notes: 'Test notes',
                        grand_total_amount: '5000',
                        grand_total_advance: '1000',
                        grand_total_remaining: '4000'
                    }
                };

                // Test functions
                const runTest = async (testName, testFunction) => {
                    try {
                        testResults.summary.total++;
                        const result = await testFunction();
                        testResults.results.push({
                            test: testName,
                            status: 'PASSED',
                            result: result,
                            timestamp: new Date().toISOString()
                        });
                        testResults.summary.passed++;
                        return result;
                    } catch (error) {
                        testResults.results.push({
                            test: testName,
                            status: 'FAILED',
                            error: error.message,
                            timestamp: new Date().toISOString()
                        });
                        testResults.summary.failed++;
                        testResults.summary.errors.push(`${testName}: ${error.message}`);
                        return null;
                    }
                };

                // Run basic tests
                await runTest('WhatsApp Connection', async () => {
                    const isConnected = (await this.whatsapp.isHealthy()).connected;
                    if (!isConnected) throw new Error('WhatsApp not connected');
                    return { connected: isConnected };
                });

                await runTest('Phone Number Formatting', async () => {
                    const testNumbers = ['7375938371', '07375938371', '+917375938371'];
                    const results = {};
                    for (const num of testNumbers) {
                        results[num] = this.whatsapp.formatPhoneNumber(num);
                    }
                    return results;
                });

                await runTest('Order Confirmation Template', async () => {
                    const result = await this.whatsapp.sendTestMessage(testPhone, 'Test Order Confirmation Message');
                    if (!result.success) throw new Error(result.error);
                    return { messageId: result.messageId };
                });

                await runTest('Worker Daily Data Template', async () => {
                    const result = await this.whatsapp.sendTestMessage(testPhone, 'Test Worker Daily Data Message');
                    if (!result.success) throw new Error(result.error);
                    return { messageId: result.messageId };
                });

                // Calculate success rate
                testResults.summary.successRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(2);

                res.json(testResults);

            } catch (error) {
                res.status(500).json({ 
                    error: error.message, 
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Add error handling middleware at the end
        this.app.use((error, req, res, next) => {
            logger.error('Express error:', error);
            res.status(500).json({
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        });
        
        // Add unhandled route handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Route not found',
                path: req.originalUrl
            });
        });
    }

    setupEventHandlers() {
        this.whatsapp.on('connected', () => {
            if (String(process.env.DISABLE_POLLING || 'false').toLowerCase() === 'true') {
                logger.warn('WhatsApp connected, but polling is disabled via DISABLE_POLLING');
                return;
            }
            logger.info('WhatsApp connected, starting polling...');
            this.startPolling();
        });

        this.whatsapp.on('disconnected', () => {
            logger.warn('WhatsApp disconnected, stopping polling...');
            this.stopPolling();
        });
        
        // Setup memory management
        this.setupMemoryManagement();
    }

    setupMemoryManagement() {
        // Clean processed orders periodically
        setInterval(() => {
            this.cleanupProcessedOrders();
        }, this.processedOrdersCleanupInterval);

        // Memory monitoring
        setInterval(() => {
            this.monitorMemoryUsage();
        }, 300000); // Check every 5 minutes

        // Force garbage collection periodically (if available)
        if (global.gc) {
            setInterval(() => {
                logger.info('Running garbage collection...');
                global.gc();
                this.logMemoryUsage();
            }, 1800000); // Every 30 minutes
        }

        logger.info('Memory management setup completed');
    }

    cleanupProcessedOrders() {
        const currentSize = this.processedOrders.size;
        
        if (currentSize > this.maxProcessedOrders) {
            logger.info(`Cleaning up processed orders. Current size: ${currentSize}, Max: ${this.maxProcessedOrders}`);
            
            // Convert to array, sort by timestamp, keep only recent half
            const orders = Array.from(this.processedOrders);
            const keepCount = Math.floor(this.maxProcessedOrders / 2);
            const ordersToKeep = orders.slice(-keepCount);
            
            this.processedOrders.clear();
            ordersToKeep.forEach(order => this.processedOrders.add(order));
            
            logger.info(`Processed orders cleaned up. New size: ${this.processedOrders.size}`);
        }
        
        this.lastCleanup = Date.now();
    }

    monitorMemoryUsage() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const rssMB = Math.round(memUsage.rss / 1024 / 1024);
        
        logger.info('Memory usage', {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            rss: `${rssMB}MB`,
            processedOrdersCount: this.processedOrders.size
        });

        // Alert if memory usage is high
        if (heapUsedMB > 200) {
            logger.warn(`High memory usage detected: ${heapUsedMB}MB heap used`);
            this.cleanupProcessedOrders();
        }
    }

    logMemoryUsage() {
        const memUsage = process.memoryUsage();
        logger.info('Detailed memory usage after GC', {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
            uptime: `${Math.round(process.uptime())}s`
        });
    }

    async start() {
        try {
            logger.info('Starting WhatsApp Bot...');
            
            // Check if bot can start (acquire locks)
            if (this.lockManager) {
                logger.info('Checking process locks...');
                const canStart = await this.lockManager.canStart();
                if (!canStart) {
                    logger.error('Bot cannot start due to lock conflicts. Another instance may be running.');
                    process.exit(1);
                }
                logger.info('Process locks acquired successfully');
            }
            
            // Create logs directory
            await fs.mkdir('./logs', { recursive: true });
            logger.info('Logs directory created');
            
            // Initialize Google Sheets helper
            logger.info('Initializing Google Sheets helper...');
            await this.sheets.initializeGoogleSheets();
            logger.info('Google Sheets helper initialized');
            // Diagnostic: confirm sheet health immediately after init
            try {
                const health = await this.sheets.healthCheck();
                logger.info('Sheets health after init', health);
            } catch (diagErr) {
                logger.warn({ err: diagErr, stack: diagErr?.stack }, 'Sheets health check failed after init');
            }
            
            // Initialize WhatsApp client
            logger.info('Initializing WhatsApp client...');
            try {
                await this.whatsapp.initialize();
                logger.info('WhatsApp client initialized');
            } catch (error) {
                logger.error({ err: error, stack: error?.stack }, 'Failed to initialize WhatsApp client');
                throw error;
            }
            
            // Start Express server
            logger.info('Starting Express server...');
            const server = this.app.listen(this.port, this.host, () => {
                logger.info(`WhatsApp Sheet Bot server running on http://${this.host}:${this.port}`);
                logger.info(`QR Code available at: http://${this.host}:${this.port}/qr`);
                // Notify PM2 when wait_ready is enabled
                if (process.send) {
                    try { process.send('ready'); } catch (_) {}
                }
            });
            // Capture server errors (e.g., EADDRINUSE)
            server.on('error', (err) => {
                logger.error({ err, stack: err?.stack }, 'Express server error');
            });
            logger.info('Express server started');

            // Start polling if already connected
            if ((await this.whatsapp.isHealthy()).connected && String(process.env.DISABLE_POLLING || 'false').toLowerCase() !== 'true') {
                this.startPolling();
            } else if (String(process.env.DISABLE_POLLING || 'false').toLowerCase() === 'true') {
                logger.warn('Polling disabled via DISABLE_POLLING environment variable');
            }

        } catch (error) {
            logger.error('Failed to start bot:', error.message, error.stack);
            process.exit(1);
        }
    }

    startPolling() {
        if (this.isPolling) {
            logger.info('Polling already active');
            return;
        }

        this.isPolling = true;
        
        // Immediate poll
        this.pollForReadyOrders();
        
        // Schedule regular polling using setInterval
        this.pollingJob = setInterval(() => {
            this.pollForReadyOrders();
        }, this.pollInterval);

        logger.info(`Started polling every ${this.pollInterval / 1000} seconds`);
    }

    stopPolling() {
        if (this.pollingJob) {
            clearInterval(this.pollingJob);
            this.pollingJob = null;
        }
        this.isPolling = false;
        logger.info('Stopped polling');
    }

    async pollForReadyOrders() {
        try {
            logger.debug('Polling for ready orders...');
            
            const readyOrders = await this.sheets.findReadyOrders();
            
            if (readyOrders.length === 0) {
                logger.debug('No ready orders found');
            } else {
                logger.info(`Found ${readyOrders.length} ready orders`);
                
                // Debug: Log the first ready order to see its structure
                if (readyOrders.length > 0) {
                    logger.info('Sample ready order data:', JSON.stringify(readyOrders[0], null, 2));
                }

                // Process orders directly instead of using complex queue
                for (const order of readyOrders) {
                    const orderId = order['Order ID'] || order['Master Order ID'];
                    
                    logger.info(`Processing order directly: ${orderId}`);
                    
                    // Check if order has required data
                    const customerPhoneRaw = order['Contact Info'] || order['Contact Number'];
                    const customerPhone = this.formatPhoneForWhatsApp(customerPhoneRaw);
                    if (!customerPhone) {
                        logger.error(`Order ${orderId} missing customer phone number`);
                        continue;
                    }

                    // Avoid processing the same order multiple times
                    if (this.processedOrders.has(orderId)) {
                        logger.debug(`Order ${orderId} already processed, skipping`);
                        continue;
                    }

                    try {
                        // Send notification directly
                        await this.sendOrderNotification(orderId, order);
                        
                        // Mark as processed
                        this.processedOrders.add(orderId);
                        
                        logger.info(`Successfully processed order: ${orderId}`);
                        // Small delay between sends to avoid rate limits
                        await this.sleep(800);
                    } catch (error) {
                        logger.error(`Failed to process order ${orderId}:`, error.message);
                    }
                }
            }

            // Also process welcome messages for new customers
            await this.processWelcomeMessages();
            
            // Process worker daily data
            await this.processWorkerDailyData();
            
            // Process individual order confirmations (Master ID = 0)
            await this.processIndividualOrderConfirmations();
            
            // Also process confirmation messages for new orders
            await this.processConfirmationMessages();
            
            // Also process delivery notifications for delivered orders
            await this.processDeliveryNotifications();
            
            // Also process pickup reminders for overdue orders
            await this.processPickupReminders();
            
            // Also process payment reminders for delivered orders with pending payments
            await this.processPaymentReminders();
            
            // Process fabric orders: welcome, purchase, and payment reminders
            await this.processFabricWelcomeMessages();
            await this.processFabricPurchaseNotifications();
            await this.processFabricPaymentReminders();
            
            // Process combined orders
            await this.processCombinedOrders();

        } catch (error) {
            logger.error('Error polling for ready orders:', error.message);
        }
    }

    async processWelcomeMessages() {
        try {
            logger.debug('Processing welcome messages...');
            
            const ordersNeedingWelcome = await this.sheets.findOrdersNeedingWelcome();
            
            if (ordersNeedingWelcome.length === 0) {
                logger.debug('No orders need welcome messages');
                return;
            }

            logger.info(`Found ${ordersNeedingWelcome.length} orders needing welcome messages`);

            for (const order of ordersNeedingWelcome) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
                if (!customerPhone) {
                    logger.error(`Order ${orderId} missing customer phone number for welcome message`);
                    continue;
                }

                try {
                    logger.info(`Processing welcome message for order ${orderId}, phone: ${customerPhone}`);
                    
                    // Send welcome message directly
                    logger.info(`Sending welcome message to ${customerPhone}`);
                    
                    // Try multiple possible field names for customer name
                    const customerName = order['Customer Name'] || 
                                       order['Name'] || 
                                       order['Customer'] || 
                                       order['Client Name'] || 
                                       order['Client'] || 
                                       'Customer';

                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: customerName,  // Fixed: use underscore to match template
                        customerName: customerName,   // Keep both for compatibility
                        customer_phone: customerPhone.slice(-10),
                        garment_type: order['Garment Types'],
                        total_amount: order['Price'] || order['Total Amount'],
                        advance_amount: order['Advance Payment'],
                        remaining_amount: order['Remaining Amount'],
                        order_date: order['Order Date'] || order['Created At']
                    };

                    logger.info(`Using customer name: "${customerName}" for order ${orderId}`);
                    logger.info(`Mapped order data:`, JSON.stringify(mappedOrderData, null, 2));

                    // Send welcome message using enhanced method with duplicate prevention
                    logger.info(`Sending welcome message with duplicate prevention...`);
                    
                    const result = await this.whatsapp.sendWelcomeMessage(customerPhone, mappedOrderData, 'tailor');
                    
                    if (result.success && !result.blocked) {
                        // Mark welcome as notified
                        await this.sheets.markWelcomeAsNotified(order, 'BOT');
                        logger.info(`Welcome message sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Welcome message blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        // Still mark as notified since duplicate prevention handled it
                        await this.sheets.markWelcomeAsNotified(order, 'BOT');
                    } else {
                        logger.error(`Failed to send welcome message for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing welcome message for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing welcome messages:', error.message);
        }
    }

    async processConfirmationMessages() {
        try {
            logger.debug('Processing confirmation messages...');
            
            const ordersNeedingConfirmation = await this.sheets.findOrdersNeedingConfirmation();
            
            if (ordersNeedingConfirmation.length === 0) {
                logger.debug('No orders need confirmation messages');
                return;
            }

            logger.info(`Found ${ordersNeedingConfirmation.length} orders needing confirmation messages`);

            for (const order of ordersNeedingConfirmation) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Order ${orderId} missing customer phone number for confirmation message`);
                    continue;
                }

                try {
                    // Send confirmation message
                    logger.info(`Sending confirmation message for order: ${orderId}`);
                    
                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                        customerName: order['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        garment_type: order['Garment Types'],
                        total_amount: order['Price'] || order['Total Amount'],
                        advance_amount: order['Advance Payment'],
                        remaining_amount: order['Remaining Amount'],
                        order_date: order['Order Date'] || order['Created At'],
                        delivery_date: order['Delivery Date']
                    };

                    // Send confirmation message using enhanced method with duplicate prevention
                    const result = await this.whatsapp.sendConfirmationMessage(formattedPhone, mappedOrderData, 'tailor');
                    
                    if (result.success && !result.blocked) {
                        // Mark confirmation as notified
                        await this.sheets.markConfirmationAsNotified(order, 'BOT');
                        logger.info(`Confirmation message sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Confirmation message blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        // Still mark as notified since duplicate prevention handled it
                        await this.sheets.markConfirmationAsNotified(order, 'BOT');
                    } else {
                        logger.error(`Failed to send confirmation message for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing confirmation message for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing confirmation messages:', error.message);
        }
    }

    async processIndividualOrderConfirmations() {
        try {
            logger.debug('Processing individual order confirmations...');
            
            // Get all tailor orders with Master ID = 0 (individual orders)
            const tailorOrders = await this.sheets.readSheet();
            const individualTailorOrders = tailorOrders.filter(order => 
                order['Master Order ID'] === '0' || order['Master Order ID'] === 0 || !order['Master Order ID']
            );
            
            // Get all fabric orders with Master ID = 0 (individual orders)
            const fabricOrders = await this.sheets.readFabricSheet();
            const individualFabricOrders = fabricOrders.filter(order => 
                order['Master Order ID'] === '0' || order['Master Order ID'] === 0 || !order['Master Order ID']
            );
            
            // Process individual tailor orders
            for (const order of individualTailorOrders) {
                const orderId = order['Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Individual tailor order ${orderId} missing customer phone number`);
                    continue;
                }

                // Check if confirmation already sent
                if (order['Confirmation Notified'] === 'Yes') {
                    continue;
                }

                try {
                    logger.info(`Sending individual tailor order confirmation for: ${orderId}`);
                    
                    const formattedPhone = customerPhone;
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                        customerName: order['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        garment_type: order['Garment Types'],
                        total_amount: order['Price'] || order['Total Amount'],
                        advance_amount: order['Advance Payment'],
                        remaining_amount: order['Remaining Amount'],
                        order_date: order['Order Date'] || order['Created At'],
                        delivery_date: order['Delivery Date']
                    };

                    const result = await this.whatsapp.sendConfirmationMessage(formattedPhone, mappedOrderData, 'tailor');
                    
                    if (result.success && !result.blocked) {
                        await this.sheets.markConfirmationAsNotified(order, 'BOT');
                        logger.info(`Individual tailor order confirmation sent successfully for: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Individual tailor order confirmation blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markConfirmationAsNotified(order, 'BOT');
                    } else {
                        logger.error(`Failed to send individual tailor order confirmation for ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing individual tailor order confirmation for ${orderId}:`, error.message);
                }
            }
            
            // Process individual fabric orders
            for (const order of individualFabricOrders) {
                const orderId = order['Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Individual fabric order ${orderId} missing customer phone number`);
                    continue;
                }

                // Check if confirmation already sent
                if (order['Confirmation Notified'] === 'Yes') {
                    continue;
                }

                try {
                    logger.info(`Sending individual fabric order confirmation for: ${orderId}`);
                    
                    const formattedPhone = customerPhone;
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                        customerName: order['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        fabric_type: order['Fabric Type'],
                        fabric_color: order['Fabric Color'],
                        quantity: order['Quantity (meters)'],
                        total_amount: order['Fabric Total'],
                        price_per_meter: order['Price per Meter'],
                        advance_payment: order['Advance/Partial Payment'] || 0,
                        remaining_amount: order['Remaining Amount'] || order['Fabric Total'],
                        order_date: order['Purchase Date'] || new Date().toLocaleDateString('en-IN')
                    };

                    const result = await this.whatsapp.sendFabricConfirmationMessage(formattedPhone, mappedOrderData);
                    
                    if (result.success && !result.blocked) {
                        await this.sheets.markFabricConfirmationAsNotified(order, 'BOT');
                        logger.info(`Individual fabric order confirmation sent successfully for: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Individual fabric order confirmation blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markFabricConfirmationAsNotified(order, 'BOT');
                    } else {
                        logger.error(`Failed to send individual fabric order confirmation for ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing individual fabric order confirmation for ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing individual order confirmations:', error.message);
        }
    }

    async processDeliveryNotifications() {
        try {
            logger.debug('Processing delivery notifications...');
            
            const ordersNeedingDelivery = await this.sheets.findOrdersNeedingDeliveryNotification();
            
            if (ordersNeedingDelivery.length === 0) {
                logger.debug('No orders need delivery notifications');
                return;
            }

            logger.info(`Found ${ordersNeedingDelivery.length} orders needing delivery notifications`);

            for (const order of ordersNeedingDelivery) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Order ${orderId} missing customer phone number for delivery notification`);
                    continue;
                }

                try {
                    // Send delivery notification
                    logger.info(`Sending delivery notification for order: ${orderId}`);
                    
                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                            customer_name: order['Customer Name'],
                            customerName: order['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        garment_type: order['Garment Types'],
                        total_amount: order['Price'] || order['Total Amount'],
                        advance_amount: order['Advance Payment'],
                        remaining_amount: order['Remaining Amount'],
                        delivery_date: order['Delivery Date'] || new Date().toISOString().slice(0, 10)
                    };

                    // Send delivery notification using enhanced method with duplicate prevention
                    const result = await this.whatsapp.sendDeliveryNotification(formattedPhone, mappedOrderData, 'tailor');
                    
                    if (result.success && !result.blocked) {
                        // Mark delivery as notified
                        await this.sheets.markDeliveryAsNotified(order, 'BOT');
                        logger.info(`Delivery notification sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Delivery notification blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markDeliveryAsNotified(order, 'BOT');
                    } else {
                        logger.error(`Failed to send delivery notification for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing delivery notification for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing delivery notifications:', error.message);
        }
    }

    async processPickupReminders() {
        try {
            logger.debug('Processing pickup reminders...');
            
            const ordersNeedingPickupReminders = await this.sheets.findOrdersNeedingPickupReminders();
            
            if (ordersNeedingPickupReminders.length === 0) {
                logger.debug('No orders need pickup reminders');
                return;
            }

            logger.info(`Found ${ordersNeedingPickupReminders.length} orders needing pickup reminders`);

            for (const order of ordersNeedingPickupReminders) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Order ${orderId} missing customer phone number for pickup reminder`);
                    continue;
                }

                try {
                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Calculate days since ready
                    const readyDate = new Date(order['Ready Notified Date'] || order['Created At']);
                    const today = new Date();
                    const daysPending = Math.floor((today - readyDate) / (1000 * 60 * 60 * 24));
                    
                    // Get current reminder count
                    const currentReminderCount = parseInt(order['Pickup Reminder Count'] || '0');
                    const nextReminderCount = currentReminderCount + 1;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                            customer_name: order['Customer Name'],
                            customerName: order['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        garment_type: order['Garment Types'],
                        total_amount: order['Price'] || order['Total Amount'],
                        advance_amount: order['Advance Payment'],
                        remaining_amount: order['Remaining Amount'],
                        ready_date: order['Ready Notified Date'] || order['Created At'],
                        ready_notified_date: order['Ready Notified Date'] || order['Created At']
                    };

                    logger.info(`Sending pickup reminder ${nextReminderCount} for order: ${orderId} (${daysPending} days pending)`);

                    // Send pickup reminder using enhanced method with duplicate prevention
                    const pickupReminderData = {
                        ...mappedOrderData,
                        reminder_number: nextReminderCount,
                        days_pending: daysPending
                    };
                    const result = await this.whatsapp.sendPickupReminder(formattedPhone, pickupReminderData, nextReminderCount, 'tailor');
                    
                    if (result.success && !result.blocked) {
                        // Mark pickup reminder as sent
                        await this.sheets.markPickupReminderSent(order, nextReminderCount, 'BOT');
                        logger.info(`Pickup reminder ${nextReminderCount} sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Pickup reminder ${nextReminderCount} blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markPickupReminderSent(order, nextReminderCount, 'BOT');
                    } else {
                        logger.error(`Failed to send pickup reminder for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing pickup reminder for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing pickup reminders:', error.message);
        }
    }

    async processPaymentReminders() {
        try {
            logger.debug('Processing payment reminders...');
            
            const ordersNeedingPaymentReminders = await this.sheets.findOrdersNeedingPaymentReminders();
            
            if (ordersNeedingPaymentReminders.length === 0) {
                logger.debug('No orders need payment reminders');
                return;
            }

            logger.info(`Found ${ordersNeedingPaymentReminders.length} orders needing payment reminders`);

            for (const order of ordersNeedingPaymentReminders) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Order ${orderId} missing customer phone number for payment reminder`);
                    continue;
                }

                try {
                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Calculate days since delivery
                    const deliveryDate = new Date(order['Delivery Date']);
                    const today = new Date();
                    const daysPending = Math.floor((today - deliveryDate) / (1000 * 60 * 60 * 24));
                    
                    // Get current reminder count
                    const currentReminderCount = parseInt(order['Payment Reminder Count'] || '0');
                    const nextReminderCount = currentReminderCount + 1;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                            customer_name: order['Customer Name'],
                            customerName: order['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        garment_type: order['Garment Types'],
                        total_amount: order['Price'] || order['Total Amount'],
                        advance_amount: order['Advance Payment'],
                        remaining_amount: order['Remaining Amount'],
                        delivery_date: order['Delivery Date']
                    };

                    logger.info(`Sending payment reminder ${nextReminderCount} for order: ${orderId} (${daysPending} days since delivery)`);

                    // Send payment reminder using enhanced method with duplicate prevention
                    const paymentReminderData = {
                        ...mappedOrderData,
                        reminder_number: nextReminderCount,
                        days_pending: daysPending,
                        outstanding_amount: mappedOrderData.remaining_amount
                    };
                    const result = await this.whatsapp.sendPaymentReminder(formattedPhone, paymentReminderData, nextReminderCount, 'tailor');
                    
                    if (result.success && !result.blocked) {
                        // Mark payment reminder as sent
                        await this.sheets.markPaymentReminderSent(order, nextReminderCount, 'BOT');
                        logger.info(`Payment reminder ${nextReminderCount} sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Payment reminder ${nextReminderCount} blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markPaymentReminderSent(order, nextReminderCount, 'BOT');
                    } else {
                        logger.error(`Failed to send payment reminder for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing payment reminder for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing payment reminders:', error.message);
        }
    }

    // ==================== FABRIC ORDERS PROCESSING ====================

    async processFabricWelcomeMessages() {
        try {
            logger.debug('Processing fabric welcome messages...');
            
            const fabricOrdersNeedingWelcome = await this.sheets.findFabricOrdersNeedingWelcome();
            
            if (fabricOrdersNeedingWelcome.length === 0) {
                logger.debug('No fabric orders need welcome messages');
                return;
            }

            logger.info(`Found ${fabricOrdersNeedingWelcome.length} fabric orders needing welcome messages`);

            for (const order of fabricOrdersNeedingWelcome) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Fabric order ${orderId} missing customer phone number for welcome message`);
                    continue;
                }

                try {
                    // Check if phone number exists in both tailor and fabric sheets
                    const phoneExists = await this.sheets.checkPhoneNumberExistsInBothSheets(customerPhone, orderId);
                    
                    if (phoneExists.exists) {
                        logger.info(`Phone ${customerPhone} exists in ${phoneExists.source} orders, marking fabric welcome as notified`);
                        await this.sheets.markFabricWelcomeAsNotified(order, 'BOT');
                    } else {
                        // New phone number, send fabric welcome message
                        logger.info(`New phone number ${customerPhone}, sending fabric welcome message`);

                        // Fix phone number format
                        const formattedPhone = customerPhone;
                        
                        // Create mapped order data for templates
                        const mappedOrderData = {
                            id: orderId,
                            orderId: orderId,
                            customer_name: order['Customer Name'],
                            customerName: order['Customer Name'],
                            fabric_type: order['Fabric Type'],
                            fabric_color: order['Fabric Color'],
                            quantity: order['Quantity (meters)'],
                            total_amount: order['Fabric Total'],
                            price_per_meter: order['Price per Meter'],
                            order_date: order['Purchase Date'] || new Date().toLocaleDateString('en-IN')
                        };

                        // Send fabric welcome message using enhanced method with duplicate prevention
                        const result = await this.whatsapp.sendFabricWelcomeMessage(formattedPhone, mappedOrderData);
                        
                        if (result.success && !result.blocked) {
                            // Mark welcome as notified
                            await this.sheets.markFabricWelcomeAsNotified(order, 'BOT');
                            logger.info(`Fabric welcome message sent successfully for order: ${orderId}`);
                        } else if (result.blocked) {
                            logger.info(`Fabric welcome message blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                            await this.sheets.markFabricWelcomeAsNotified(order, 'BOT');
                        } else {
                            logger.error(`Failed to send fabric welcome message for order ${orderId}: ${result.error}`);
                        }
                    }
                } catch (error) {
                    logger.error(`Error processing fabric welcome message for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing fabric welcome messages:', error.message);
        }
    }

    async processFabricPurchaseNotifications() {
        try {
            logger.debug('Processing fabric purchase notifications...');
            
            const fabricOrdersNeedingPurchaseNotification = await this.sheets.findFabricOrdersNeedingPurchaseNotification();
            
            if (fabricOrdersNeedingPurchaseNotification.length === 0) {
                logger.debug('No fabric orders need purchase notifications');
                return;
            }

            logger.info(`Found ${fabricOrdersNeedingPurchaseNotification.length} fabric orders needing purchase notifications`);

            for (const order of fabricOrdersNeedingPurchaseNotification) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Fabric order ${orderId} missing customer phone number for purchase notification`);
                    continue;
                }

                try {
                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                        customerName: order['Customer Name'],
                        fabric_type: order['Fabric Type'],
                        fabric_color: order['Fabric Color'],
                        quantity: order['Quantity (meters)'],
                        total_amount: order['Fabric Total'],
                        advance_payment: order['Advance/Partial Payment'] || 0,
                        remaining_amount: order['Remaining Amount'] || order['Fabric Total'],
                        price_per_meter: order['Price per Meter'],
                        purchase_date: order['Purchase Date'] || new Date().toLocaleDateString('en-IN')
                    };

                    logger.info(`Sending fabric purchase notification for order: ${orderId}`);

                    // Send fabric purchase notification using enhanced method with duplicate prevention
                    const result = await this.whatsapp.sendFabricConfirmationMessage(formattedPhone, mappedOrderData);
                    
                    if (result.success && !result.blocked) {
                        // Mark purchase as notified
                        await this.sheets.markFabricPurchaseAsNotified(order, 'BOT');
                        logger.info(`Fabric purchase notification sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Fabric purchase notification blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markFabricPurchaseAsNotified(order, 'BOT');
                    } else {
                        logger.error(`Failed to send fabric purchase notification for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing fabric purchase notification for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing fabric purchase notifications:', error.message);
        }
    }

    async processFabricPaymentReminders() {
        try {
            logger.debug('Processing fabric payment reminders...');
            
            const fabricOrdersNeedingPaymentReminders = await this.sheets.findFabricOrdersNeedingPaymentReminders();
            
            if (fabricOrdersNeedingPaymentReminders.length === 0) {
                logger.debug('No fabric orders need payment reminders');
                return;
            }

            logger.info(`Found ${fabricOrdersNeedingPaymentReminders.length} fabric orders needing payment reminders`);

            for (const order of fabricOrdersNeedingPaymentReminders) {
                const orderId = order['Order ID'] || order['Master Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(order['Contact Number']);
                
                if (!customerPhone) {
                    logger.error(`Fabric order ${orderId} missing customer phone number for payment reminder`);
                    continue;
                }

                try {
                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Calculate days since purchase
                    const purchaseDate = new Date(order['Purchase Date']);
                    const today = new Date();
                    const daysPending = Math.floor((today - purchaseDate) / (1000 * 60 * 60 * 24));
                    
                    // Get current reminder count
                    const currentReminderCount = parseInt(order['Payment Reminder Count'] || '0');
                    const nextReminderCount = currentReminderCount + 1;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        id: orderId,
                        orderId: orderId,
                        customer_name: order['Customer Name'],
                        customerName: order['Customer Name'],
                        fabric_type: order['Fabric Type'],
                        fabric_color: order['Fabric Color'],
                        quantity: order['Quantity (meters)'],
                        total_amount: order['Fabric Total'],
                        advance_payment: order['Advance/Partial Payment'] || 0,
                        remaining_amount: order['Remaining Amount'] || order['Fabric Total'],
                        price_per_meter: order['Price per Meter'],
                        purchase_date: order['Purchase Date'],
                        pending_amount: order['Remaining Amount'] || order['Fabric Total']
                    };

                    logger.info(`Sending fabric payment reminder ${nextReminderCount} for order: ${orderId} (${daysPending} days pending)`);

                    // Send fabric payment reminder using enhanced method with duplicate prevention
                    const fabricPaymentReminderData = {
                        ...mappedOrderData,
                        reminder_number: nextReminderCount,
                        days_pending: daysPending,
                        outstanding_amount: mappedOrderData.remaining_amount
                    };
                    const result = await this.whatsapp.sendFabricPaymentReminder(formattedPhone, fabricPaymentReminderData, nextReminderCount);
                    
                    if (result.success && !result.blocked) {
                        // Mark payment reminder as sent
                        await this.sheets.markFabricPaymentReminderSent(order, nextReminderCount, 'BOT');
                        logger.info(`Fabric payment reminder ${nextReminderCount} sent successfully for order: ${orderId}`);
                    } else if (result.blocked) {
                        logger.info(`Fabric payment reminder ${nextReminderCount} blocked (duplicate prevention): ${result.blockReason} for order ${orderId}`);
                        await this.sheets.markFabricPaymentReminderSent(order, nextReminderCount, 'BOT');
                    } else {
                        logger.error(`Failed to send fabric payment reminder for order ${orderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing fabric payment reminder for order ${orderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing fabric payment reminders:', error.message);
        }
    }

    // ==================== COMBINED ORDERS PROCESSING ====================

    async processCombinedOrders() {
        try {
            logger.debug('Processing combined orders...');
            
            const combinedOrdersNeedingNotification = await this.sheets.findCombinedOrdersNeedingNotification();
            
            if (combinedOrdersNeedingNotification.length === 0) {
                logger.debug('No combined orders need notifications');
                return;
            }

            // Filter only orders with Master ID ≠ 0 (combined orders)
            const actualCombinedOrders = combinedOrdersNeedingNotification.filter(order => 
                order['Master Order ID'] && order['Master Order ID'] !== '0' && order['Master Order ID'] !== 0
            );
            
            if (actualCombinedOrders.length === 0) {
                logger.debug('No combined orders with Master ID ≠ 0 found');
                return;
            }

            logger.info(`Found ${actualCombinedOrders.length} combined orders needing notifications`);

            for (const combinedOrder of actualCombinedOrders) {
                const combinedOrderId = combinedOrder['Combined Order ID'];
                const customerPhone = this.formatPhoneForWhatsApp(combinedOrder['Contact Number']);
                const masterOrderId = combinedOrder['Master Order ID'];
                
                logger.info(`Processing combined order: ${combinedOrderId} with Master Order ID: ${masterOrderId}`);
                
                if (!customerPhone || !masterOrderId) {
                    logger.error(`Combined order ${combinedOrderId} missing required data (phone: ${customerPhone}, masterOrderId: ${masterOrderId})`);
                    continue;
                }

                try {
                    // Get fabric order details by Master Order ID
                    logger.info(`Looking for fabric order with Master Order ID: ${masterOrderId}`);
                    const fabricOrder = await this.sheets.getFabricOrderById(masterOrderId);
                    if (!fabricOrder) {
                        logger.error(`Fabric order not found for Master Order ID: ${masterOrderId}`);
                        continue;
                    }
                    logger.info(`Found fabric order: ${fabricOrder['Order ID']}`);

                    // Get tailoring order details by Master Order ID
                    logger.info(`Looking for tailoring order with Master Order ID: ${masterOrderId}`);
                    const tailoringOrder = await this.sheets.getTailoringOrderById(masterOrderId);
                    if (!tailoringOrder) {
                        logger.error(`Tailoring order not found for Master Order ID: ${masterOrderId}`);
                        continue;
                    }
                    logger.info(`Found tailoring order: ${tailoringOrder['Order ID']}`);

                    // Fix phone number format
                    const formattedPhone = customerPhone;
                    
                    // Create mapped order data for templates
                    const mappedOrderData = {
                        customer_name: combinedOrder['Customer Name'],
                        customerName: combinedOrder['Customer Name'],
                        customer_phone: formattedPhone.slice(-10),
                        
                        // Fabric order details
                        fabric_order_id: fabricOrder['Order ID'],
                        fabric_type: fabricOrder['Fabric Type'],
                        fabric_color: fabricOrder['Fabric Color'],
                        fabric_quantity: fabricOrder['Quantity (meters)'],
                        fabric_purchase_date: fabricOrder['Purchase Date'],
                        fabric_total_amount: fabricOrder['Fabric Total'],
                        fabric_advance_payment: fabricOrder['Advance/Partial Payment'] || 0,
                        fabric_remaining_amount: fabricOrder['Remaining Amount'] || fabricOrder['Fabric Total'],
                        
                        // Tailoring order details
                        tailoring_order_id: tailoringOrder['Order ID'],
                        tailoring_garment_type: tailoringOrder['Garment Types'],
                        tailoring_delivery_date: tailoringOrder['Delivery Date'],
                        tailoring_total_amount: tailoringOrder['Price'] || tailoringOrder['Total Amount'],
                        tailoring_advance_payment: tailoringOrder['Advance Payment'],
                        tailoring_remaining_amount: tailoringOrder['Remaining Amount']
                    };

                    logger.info(`Sending combined order message for order: ${combinedOrderId}`);

                    // Send combined order message using enhanced method with duplicate prevention
                    const result = await this.whatsapp.sendCombinedOrderMessage(formattedPhone, mappedOrderData);
                    
                    if (result.success && !result.blocked) {
                        // Mark combined order as notified
                        await this.sheets.markCombinedOrderAsNotified(combinedOrder, 'BOT');
                        
                        // Mark individual orders as confirmed
                        await this.sheets.markConfirmationAsNotified(tailoringOrder, 'BOT');
                        await this.sheets.markFabricConfirmationAsNotified(fabricOrder, 'BOT');
                        
                        logger.info(`Combined order message sent successfully for order: ${combinedOrderId}`);
                        logger.info(`Marked individual orders as confirmed: ${tailoringOrder['Order ID']} and ${fabricOrder['Order ID']}`);
                    } else if (result.blocked) {
                        logger.info(`Combined order message blocked (duplicate prevention): ${result.blockReason} for order ${combinedOrderId}`);
                        await this.sheets.markCombinedOrderAsNotified(combinedOrder, 'BOT');
                        await this.sheets.markConfirmationAsNotified(tailoringOrder, 'BOT');
                        await this.sheets.markFabricConfirmationAsNotified(fabricOrder, 'BOT');
                    } else {
                        logger.error(`Failed to send combined order message for order ${combinedOrderId}: ${result.error}`);
                    }
                } catch (error) {
                    logger.error(`Error processing combined order ${combinedOrderId}:`, error.message);
                }
            }

        } catch (error) {
            logger.error('Error processing combined orders:', error.message);
        }
    }

    async processBatchOrders(batchData) {
        const { orders } = batchData;
        
        logger.info(`Processing batch with ${orders.length} orders`);
        
        for (const order of orders) {
            const orderId = order['Order ID'] || order['Master Order ID'] || order.id || order.orderId;
            
            logger.info(`Processing order: ${orderId}`);
            
            // Avoid processing the same order multiple times
            if (this.processedOrders.has(orderId)) {
                logger.debug(`Order ${orderId} already processed, skipping`);
                continue;
            }

            // Check if order has required data
            const customerPhone = this.formatPhoneForWhatsApp(order['Contact Info'] || order['Contact Number']);
            if (!customerPhone) {
                logger.error(`Order ${orderId} missing customer phone number`);
                continue;
            }

            logger.info(`Adding order ${orderId} to processing queue for phone: ${customerPhone}`);
            
            await this.jobQueue.add('process-order', {
                orderId: orderId,
                orderData: order
            });
        }
    }

    async processOrderNotification(jobData) {
        const { orderId, orderData, approved = false, manualTrigger = false } = jobData;
        
        try {
            logger.info(`Processing order notification: #${orderId}`);
            
            // Mark as being processed
            this.processedOrders.add(orderId);

            // Determine if we should send notification
            let shouldSend = false;
            
            switch (this.botMode) {
                case 'AUTO':
                    shouldSend = true;
                    break;
                case 'APPROVAL':
                    if (approved || manualTrigger) {
                        shouldSend = true;
                    } else {
                        // Request approval from admin
                        await this.requestApproval(orderId, orderData);
                        this.adminCommands.removeApprovalRequest(orderId);
                        return;
                    }
                    break;
                case 'MANUAL':
                    if (manualTrigger) {
                        shouldSend = true;
                    } else {
                        logger.info(`Order #${orderId} requires manual trigger (MANUAL mode)`);
                        return;
                    }
                    break;
                default:
                    logger.warn(`Unknown bot mode: ${this.botMode}`);
                    return;
            }

            if (shouldSend) {
                await this.sendOrderNotification(orderId, orderData);
            }

        } catch (error) {
            logger.error(`Error processing order ${orderId}:`, error.message);
            
            // Remove from processed set on error so it can be retried
            this.processedOrders.delete(orderId);
            
            throw error;
        }
    }

    async requestApproval(orderId, orderData) {
        try {
            const customerInfo = {
                name: orderData.customerName || orderData.name || 'N/A',
                phone: orderData.phone || orderData.customerPhone || 'N/A'
            };

            await this.whatsapp.sendApprovalRequest(orderId, customerInfo);
            this.adminCommands.addApprovalRequest(orderId, orderData);
            
            logger.info(`Approval request sent for order #${orderId}`);
        } catch (error) {
            logger.error(`Error sending approval request for order ${orderId}:`, error.message);
            throw error;
        }
    }

    async sendOrderNotification(orderId, orderData) {
        try {
            logger.info(`Attempting to send notification for order: ${orderId}`);
            
            // Map your column names to the expected format
            const phoneFormatted = this.formatPhoneForWhatsApp(orderData['Contact Info'] || orderData['Contact Number']);
            
            logger.info(`Customer phone: ${phoneFormatted || 'N/A'}`);
            
            if (!phoneFormatted) {
                throw new Error('Customer phone not found in order data');
            }

            // Create mapped order data for templates
            const mappedOrderData = {
                id: orderData['Order ID'] || orderData['Master Order ID'],
                orderId: orderData['Order ID'] || orderData['Master Order ID'],
                customer_name: orderData['Customer Name'],
                customerName: orderData['Customer Name'],
                customer_phone: phoneFormatted.slice(-10),
                garment_type: orderData['Garment Types'],
                total_amount: orderData['Price'] || orderData['Total Amount'],
                advance_amount: orderData['Advance Payment'],
                remaining_amount: orderData['Remaining Amount'],
                ready_date: new Date().toISOString(),
                delivery_date: orderData['Delivery Date'],
                order_date: orderData['Order Date'],
                address: orderData['Address'],
                customer_type: orderData['Customer Type'],
                notes: orderData['Notes']
            };

            logger.info(`Mapped order data:`, JSON.stringify(mappedOrderData, null, 2));

            // Send notification using template
            const result = await this.whatsapp.sendOrderNotification(phoneFormatted, mappedOrderData);
            
            if (result.success) {
                logger.info(`WhatsApp message sent successfully for order: ${orderId}`);
                
                // Update sheet to mark as notified
                try {
                    await this.sheets.markOrderAsNotified(orderData, 'BOT');
                    logger.info(`Successfully updated sheet for order: ${orderId}`);
                } catch (updateError) {
                    logger.error(`Failed to update sheet for order ${orderId}:`, updateError.message);
                    // Don't throw here - message was sent successfully
                }
                
                // Send admin confirmation
                try {
                    const adminConfirmPhone = phoneFormatted || (orderData['Contact Info'] || orderData['Contact Number'] || 'Unknown');
                    await this.whatsapp.sendAdminConfirmation(orderId, adminConfirmPhone, true);
                } catch (adminError) {
                    logger.error(`Failed to send admin confirmation for order ${orderId}:`, adminError.message);
                    // Don't throw here - main message was sent successfully
                }
                
                logger.info(`Order notification sent successfully: #${orderId}`);
            } else {
                throw new Error(`Failed to send message: ${result.error}`);
            }

        } catch (error) {
            logger.error(`Error sending order notification ${orderId}:`, error.message);
            
            // Send admin confirmation about failure
            await this.whatsapp.sendAdminConfirmation(orderId, 'Unknown', false);
            
            throw error;
        }
    }

    cleanupProcessedOrders() {
        if (this.processedOrders.size > this.maxProcessedOrders) {
            const entries = Array.from(this.processedOrders);
            const toRemove = entries.slice(0, entries.length - this.maxProcessedOrders);
            toRemove.forEach(id => this.processedOrders.delete(id));
            logger.info(`Cleaned up ${toRemove.length} old processed orders`);
        }
    }

    setupHealthMonitoring() {
        setInterval(() => {
            this.monitorHealth();
        }, 60000); // Every minute
        
        // Also add cleanup interval
        setInterval(() => {
            this.cleanupProcessedOrders();
        }, this.processedOrdersCleanupInterval);
    }

    monitorHealth() {
        const memUsage = process.memoryUsage();
        const processedCount = this.processedOrders.size;
        
        if (memUsage.heapUsed > 200 * 1024 * 1024) {
            logger.warn(`High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
            this.cleanupProcessedOrders();
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
                logger.info('Forced garbage collection');
            }
        }
        
        if (processedCount > this.maxProcessedOrders) {
            logger.warn(`Too many processed orders: ${processedCount}`);
            this.cleanupProcessedOrders();
        }
    }

    setupErrorHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error({ err: error, stack: error?.stack }, 'CRITICAL: Uncaught Exception');
            // Don't exit immediately, try to recover
            this.emergencyRecovery();
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error({ err: reason, stack: reason?.stack }, 'CRITICAL: Unhandled Rejection');
            // Don't exit immediately, try to recover
            this.emergencyRecovery();
        });
    }

    async emergencyRecovery() {
        logger.warn('🚨 Emergency recovery initiated...');
        
        try {
            // Clean up memory
            this.cleanupProcessedOrders();
            
            // Stop polling
            this.stopPolling();
            
            // Clear processed orders
            this.processedOrders.clear();
            
            // Restart WhatsApp connection
            if (this.whatsapp) {
                await this.whatsapp.restart();
            }
            
            // Restart polling if WhatsApp is connected
            if (this.whatsapp && (await this.whatsapp.isHealthy()).connected) {
                this.startPolling();
            }
            
            logger.info('✅ Emergency recovery completed');
            
        } catch (error) {
            logger.error('❌ Emergency recovery failed:', error.message);
        }
    }

    async shutdown() {
        logger.info('Shutting down bot...');
        
        try {
            // Remove all event listeners to prevent memory leaks
            this.whatsapp.removeAllListeners();
            if (this.sheets && this.sheets.removeAllListeners) {
                this.sheets.removeAllListeners();
            }
            if (this.jobQueue && this.jobQueue.removeAllListeners) {
                this.jobQueue.removeAllListeners();
            }
            
            this.stopPolling();
            
            if (this.jobQueue && this.jobQueue.close) {
                await this.jobQueue.close();
            }
            
            await this.whatsapp.disconnect();
            
            // Release process lock
            if (this.lockManager) {
                await this.lockManager.releaseLock();
            }
            
            // Clear processed orders
            this.processedOrders.clear();
            
            logger.info('Bot shutdown complete');
            
        } catch (error) {
            logger.error('Error during shutdown:', error.message);
        }
    }

    /**
     * Process worker daily data and send notifications
     */
    async processWorkerDailyData() {
        try {
            logger.debug('Processing worker daily data...');
            
            const newWorkerEntries = await this.sheets.findNewWorkerDataEntries();
            
            if (newWorkerEntries.length === 0) {
                logger.debug('No new worker data entries found');
                return;
            }

            logger.info(`Found ${newWorkerEntries.length} new worker data entries`);

            for (const entry of newWorkerEntries) {
                try {
                    const workerName = entry['Worker Name'];
                    const workerPhone = await this.sheets.getWorkerPhoneNumber(workerName);
                    
                    if (!workerPhone) {
                        logger.warn(`Phone number not found for worker: ${workerName}`);
                        continue;
                    }

                    // Format phone number for WhatsApp (let the client handle formatting)
                    const formattedPhone = workerPhone;

                    // Get all worker data for grand totals calculation
                    const allWorkerData = await this.sheets.readWorkerData();
                    const grandTotals = this.sheets.calculateWorkerTotals(allWorkerData);

                    // Prepare worker data for template
                    const workerData = {
                        worker_name: workerName,
                        date: entry['Date'],
                        paint_count: entry['Paint Count'],
                        shirt_count: entry['Shirt Count'],
                        total_work_amount: entry['Total Work Amount'],
                        advance_taken: entry['Advance Taken'],
                        remaining_payment: entry['Remaining Payment'],
                        notes: entry['Notes'] || '',
                        ...grandTotals
                    };

                    // Send worker daily data message using enhanced method with duplicate prevention
                    const result = await this.whatsapp.sendWorkerDailyDataMessage(formattedPhone, workerData);
                    
                    if (result.success && !result.blocked) {
                        // Mark as notified
                        await this.sheets.markWorkerDataAsNotified(entry);
                        logger.info(`Worker daily data sent successfully to ${workerName}`);
                    } else if (result.blocked) {
                        logger.info(`Worker daily data blocked (duplicate prevention): ${result.blockReason} for ${workerName}`);
                        await this.sheets.markWorkerDataAsNotified(entry);
                    } else {
                        logger.error(`Failed to send worker data to ${workerName}: ${result.error}`);
                    }

                } catch (error) {
                    logger.error(`Failed to process worker data for ${entry['Worker Name']}: ${error.message}`);
                }
            }

        } catch (error) {
            logger.error(`Failed to process worker daily data: ${error.message}`);
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
        if (global.bot.lockManager) {
            await global.bot.lockManager.releaseLock();
        }
    }
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
        if (global.bot.lockManager) {
            await global.bot.lockManager.releaseLock();
        }
    }
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error);
    if (global.bot && global.bot.lockManager) {
        await global.bot.lockManager.releaseLock();
    }
    process.exit(1);
});

// Start the bot
if (require.main === module) {
    const bot = new WhatsAppSheetBot();
    global.bot = bot;
    bot.start().catch(error => {
        logger.error('Failed to start bot:', error.message);
        process.exit(1);
    });
}

module.exports = WhatsAppSheetBot;
