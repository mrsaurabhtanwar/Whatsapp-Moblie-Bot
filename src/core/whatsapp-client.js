const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    isJidBroadcast,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    makeInMemoryStore,
    PHONENUMBER_MCC
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const AuthConfig = require('../config/auth-config');

class WhatsAppClient extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Initialize configuration
        this.authConfig = new AuthConfig();
        this.authConfig.displayConfig();
        
        // Core properties
        this.socket = null;
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.qrCode = null;
        // Determine Baileys auth directory (prefer env/.session-lock if provided)
        const defaultAuthDir = path.join(__dirname, 'baileys_auth');
        let resolvedAuthDir = options.authDir || defaultAuthDir;
        try {
            const tryPaths = [];
            if (process.env.BAILEYS_AUTH_PATH) {
                const envPath = process.env.BAILEYS_AUTH_PATH;
                // Resolve relative to CWD if not absolute
                const absEnvPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
                tryPaths.push(absEnvPath);
            }
            // .session-lock.json support
            const lockFile = path.resolve(process.cwd(), '.session-lock.json');
            if (fs.existsSync(lockFile)) {
                try {
                    const raw = fs.readFileSync(lockFile, 'utf8');
                    const lock = JSON.parse(raw);
                    if (lock && lock.authPath) {
                        const lockAuthPath = path.isAbsolute(lock.authPath) ? lock.authPath : path.resolve(process.cwd(), lock.authPath);
                        tryPaths.push(lockAuthPath);
                    }
                } catch (e) {
                    console.log('ℹ️ Failed to read .session-lock.json:', e?.message || e);
                }
            }
            // Always include default at end as fallback
            tryPaths.push(defaultAuthDir);

            // Pick the first path that exists and has creds.json
            for (const p of tryPaths) {
                try {
                    const creds = path.join(p, 'creds.json');
                    if (fs.existsSync(p) && fs.existsSync(creds)) {
                        resolvedAuthDir = p;
                        break;
                    }
                } catch {
                    // ignore env path errors
                }
            }
        } catch {
            // ignore auth dir resolution errors
        }
        this.authDir = resolvedAuthDir;
        // Reentrancy/connection guards
        this.isInitializing = false;
        this.reconnectTimer = null;
        this.manualDisconnect = false;
        
        // Logger configuration
        const logLevel = options.logLevel || this.authConfig.get('logLevel');
        this.logger = pino({ level: logLevel });
        
        // Connection management
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = options.maxReconnectAttempts || this.authConfig.get('maxReconnectAttempts');
        
        // Session management
        this.sessionValid = false;
        this.lastSessionCheck = null;
        this.sessionCheckInterval = options.sessionCheckInterval || this.authConfig.get('sessionCheckInterval');
        
        // Enhanced auth properties
        this.pairingCode = null;
        this.pairingPhoneNumber = null;
        this.pairingExpiresAt = null;
        this.authMode = options.authMode || this.authConfig.get('authMode');
        
        // Ensure auth directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
        
        // Setup session validation if enabled
        if (this.authConfig.get('sessionPersistence')) {
            this.setupSessionValidation();
        }
        
        console.log(`🔧 WhatsApp client initialized with auth mode: ${this.authMode}`);
    }

    setupSessionValidation() {
        // Periodically check session validity - but only if connected
        setInterval(() => {
            if (this.isConnected && this.socket) {
                this.validateSession();
            }
        }, this.sessionCheckInterval);
        
        console.log(`🔒 Session validation enabled (check every ${this.sessionCheckInterval/1000}s)`);
    }

    async validateSession() {
        try {
            if (!this.isConnected || !this.socket) {
                this.sessionValid = false;
                return false;
            }

            // Basic connectivity test - just check if socket exists and is connected
            // Don't make aggressive API calls that might cause disconnections
            this.sessionValid = this.isConnected && !!this.socket;
            this.lastSessionCheck = new Date();
            
            if (!this.sessionValid) {
                console.log('⚠️ Session validation failed, may need to reconnect');
            }
            
            return this.sessionValid;
        } catch (error) {
            console.error('❌ Session validation error:', error.message);
            this.sessionValid = false;
            return false;
        }
    }

    async initialize() {
        // Prevent re-entrancy and duplicate connections
        if (this.isInitializing) {
            console.log('⏭️ Initialize already in progress, skipping');
            return this.socket;
        }
        if (this.isConnected || this.connectionState === 'connecting') {
            console.log('✅ Already connected or connecting, skipping initialize');
            return this.socket;
        }
        this.isInitializing = true;
        try {
            console.log('🔄 Initializing WhatsApp client...');
            
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            this.socket = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, this.logger)
                },
                logger: this.logger,
                printQRInTerminal: false,
                browser: ['WhatsApp Bot', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                getMessage: async (_key) => {
                    return { conversation: '' };
                }
            });

            this.setupEventHandlers(saveCreds);
            
            return this.socket;
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp client:', error.message);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    setupEventHandlers(saveCreds) {
        this.socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnected, qr, receivedPendingNotifications } = update;
            
            // Handle QR code generation
            if (qr) {
                console.log('📱 QR Code received. Please scan with WhatsApp:');
                this.qrCode = qr;
                try {
                    const qrString = await QRCode.toString(qr, { type: 'terminal', small: true });
                    console.log(qrString);
                    
                    // Also save QR as image for easier scanning
                    const qrPath = path.join(__dirname, 'qr-code.png');
                    await QRCode.toFile(qrPath, qr);
                    console.log(`📷 QR Code saved as: ${qrPath}`);
                } catch (qrError) {
                    console.error('❌ Error generating QR code:', qrError.message);
                }
            }

            // Handle pairing code request (when no existing session)
            if (receivedPendingNotifications === false && !this.isConnected && !this.qrCode) {
                try {
                    console.log('📞 Attempting to request pairing code...');
                    // Note: This will work if phone number was provided via environment or other means
                    // For now, we'll show instructions for manual pairing
                    console.log('💡 To use phone authentication:');
                    console.log('   1. Use the dashboard at http://localhost:3001');
                    console.log('   2. Select "Phone Number Authentication"');
                    console.log('   3. Enter your phone number');
                    console.log('   4. Get the pairing code and enter it in WhatsApp');
                } catch {
                    console.log('🔄 Using QR code authentication instead');
                }
            }

            if (connection === 'close') {
                const disconnectReason = lastDisconnected?.error?.output?.statusCode;
                const shouldReconnect = disconnectReason !== DisconnectReason.loggedOut;
                
                console.log('🔌 Connection closed. Reason:', disconnectReason);
                this.isConnected = false;
                this.connectionState = 'disconnected';
                this.sessionValid = false;
                // Ensure socket reference is cleared to avoid reuse of a stale instance
                this.socket = null;
                this.emit('disconnected');
                
                // If user explicitly requested disconnect/restart, don't auto-reconnect here
                if (this.manualDisconnect) {
                    console.log('🛑 Manual disconnect; suppressing auto-reconnect');
                    this.reconnectAttempts = 0;
                    return;
                }

                // Clear any pending reconnect timers before scheduling a new one
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }

                if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const retryDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000); // Exponential backoff, max 30s
                    console.log(`🔄 Reconnecting in ${retryDelay/1000}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    this.reconnectTimer = setTimeout(() => {
                        this.reconnectTimer = null;
                        // Avoid reconnect if already connecting/connected
                        if (this.isConnected || this.connectionState === 'connecting') {
                            console.log('✅ Already connecting/connected. Skipping scheduled reconnect');
                            return;
                        }
                        this.initialize();
                    }, retryDelay);
                } else if (disconnectReason === DisconnectReason.loggedOut) {
                    console.log('📱 Logged out. Authentication required again.');
                    // Don't auto-clear auth immediately, let user decide
                    this.reconnectAttempts = 0;
                    console.log('💡 Restart the bot or refresh the dashboard to authenticate again.');
                } else if (disconnectReason === DisconnectReason.restartRequired) {
                    console.log('🔄 WhatsApp server requires restart. Attempting reconnection...');
                    this.reconnectAttempts = 0; // Reset for restart scenarios
                    if (this.reconnectTimer) {
                        clearTimeout(this.reconnectTimer);
                        this.reconnectTimer = null;
                    }
                    this.reconnectTimer = setTimeout(() => {
                        this.reconnectTimer = null;
                        if (this.isConnected || this.connectionState === 'connecting') {
                            console.log('✅ Already connecting/connected. Skipping scheduled restart reconnect');
                            return;
                        }
                        this.initialize();
                    }, 5000);
                } else {
                    console.log('❌ Max reconnection attempts reached. Please restart the bot or check your internet connection.');
                    console.log('💡 You can visit http://localhost:3001 to see the status and authenticate again.');
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                this.isConnected = true;
                this.connectionState = 'connected';
                this.sessionValid = true;
                this.reconnectAttempts = 0;
                this.lastSessionCheck = new Date();
                this.qrCode = null;
                this.pairingCode = null;
                this.pairingPhoneNumber = null;
                this.pairingExpiresAt = null;
                this.emit('connected');
                
                // Log session info for debugging
                console.log('📱 Session established successfully');
                console.log('🔒 Session will be monitored for stability');
                // Clear any pending reconnect timers
                if (this.reconnectTimer) {
                    clearTimeout(this.reconnectTimer);
                    this.reconnectTimer = null;
                }
            } else if (connection === 'connecting') {
                console.log('🔄 Connecting to WhatsApp...');
                this.connectionState = 'connecting';
            }
        });

        this.socket.ev.on('creds.update', saveCreds);
        
        this.socket.ev.on('messages.upsert', (m) => {
            // Handle incoming messages if needed
            // For now, just log
            if (m.type === 'notify') {
                for (const msg of m.messages) {
                    if (!msg.key.fromMe) {
                        console.log('📨 Received message from:', msg.key.remoteJid);
                    }
                }
            }
        });
    }

    async sendMessage(jid, message) {
        // Mock mode: don't actually send messages
        if (process.env.MOCK_WHATSAPP === 'true') {
            const mockId = `mock-${Date.now()}`;
            console.log(`🤖 [MOCK] Would send to ${jid}: ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}`);
            return { key: { id: mockId }, mock: true };
        }

        if (!this.isConnected || !this.socket) {
            throw new Error('WhatsApp not connected');
        }

        try {
            const result = await this.socket.sendMessage(jid, { text: message });
            console.log(`✅ Message sent to ${jid}`);
            return result;
        } catch (error) {
            console.error(`❌ Failed to send message to ${jid}:`, error.message);
            throw error;
        }
    }

    getConnectionState() {
        return {
            isConnected: this.isConnected,
            state: this.connectionState,
            qrCode: this.qrCode,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    getQRCode() {
        return this.qrCode;
    }

    async getQRCodeDataURL() {
        if (!this.qrCode) {
            return null;
        }
        try {
            const QRCode = require('qrcode');
            return await QRCode.toDataURL(this.qrCode);
        } catch (error) {
            console.error('Error generating QR code data URL:', error);
            return null;
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            connectionAttempts: this.reconnectAttempts,
            maxAttempts: 60,
            state: this.connectionState
        };
    }

    async startPhoneAuth(phoneNumber) {
        try {
            console.log(`📞 Starting phone authentication for: ${phoneNumber}`);
            
            // Clean and format phone number (remove all non-digits)
            const cleanPhone = phoneNumber.replace(/\D/g, '');
            let formattedPhone = cleanPhone;
            
            // Add country code if not present
            if (cleanPhone.length === 10) {
                formattedPhone = '91' + cleanPhone; // India country code
            } else if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
                formattedPhone = cleanPhone;
            } else if (cleanPhone.length === 13 && cleanPhone.startsWith('+91')) {
                formattedPhone = cleanPhone.slice(1); // Remove the + sign
            }
            
            console.log(`📞 Formatted phone number: ${formattedPhone}`);
            
            // Check if socket exists and is in the right state for pairing code
            if (!this.socket) {
                throw new Error('WhatsApp socket not initialized. Please wait for the bot to start first.');
            }
            
            // If we already have credentials and are connected, we can't do pairing
            if (this.isConnected) {
                throw new Error('WhatsApp is already connected. Pairing code can only be used for initial setup.');
            }
            
            // Request pairing code using the existing socket
            try {
                console.log(`📱 Requesting pairing code for ${formattedPhone}...`);
                const code = await this.socket.requestPairingCode(formattedPhone);
                
                if (code) {
                    this.pairingCode = code;
                    this.pairingPhoneNumber = formattedPhone;
                    this.pairingExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
                    
                    console.log(`📱 PAIRING CODE GENERATED: ${code}`);
                    console.log(`📞 Phone: ${formattedPhone}`);
                    console.log(`⏰ Expires in 10 minutes`);
                    console.log(`💡 Enter this code in WhatsApp: Settings → Linked devices → Link a device → "Link with phone number instead"`);
                    
                    // Emit pairing code event for UI
                    this.emit('pairing-code', {
                        code: code,
                        phoneNumber: formattedPhone,
                        expiresAt: this.pairingExpiresAt
                    });
                    
                    return {
                        success: true,
                        phoneNumber: formattedPhone,
                        code: code,
                        expiresAt: this.pairingExpiresAt,
                        message: `Pairing code: ${code}. Enter this code in WhatsApp on your phone.`
                    };
                } else {
                    throw new Error('Failed to generate pairing code');
                }
            } catch (pairingError) {
                console.error('❌ Failed to request pairing code:', pairingError);
                this.emit('pairing-error', pairingError);
                throw pairingError;
            }
            
        } catch (error) {
            console.error('❌ Phone authentication error:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to generate pairing code. Please try again or use QR code method.'
            };
        }
    }





    getAuthStatus() {
        return {
            isConnected: this.isConnected,
            pairingCode: this.pairingCode || null,
            pairingPhoneNumber: this.pairingPhoneNumber || null,
            pairingExpiresAt: this.pairingExpiresAt || null,
            isExpired: this.pairingExpiresAt ? new Date() > this.pairingExpiresAt : true,
            hasQRCode: !!this.qrCode,
            connectionState: this.connectionState,
            isWaitingForPairing: !!this.pairingCode && !this.isConnected
        };
    }

    async verifyPairingCode(_code) {
        try {
            const authStatus = this.getAuthStatus();
            
            if (authStatus.isExpired) {
                throw new Error('Pairing code has expired. Please generate a new one.');
            }
            
            // For Baileys, the pairing code is automatically handled by the library
            // This method is mainly for status checking
            if (this.isConnected) {
                return { success: true, message: 'WhatsApp is already connected!' };
            }
            
            if (this.pairingCode) {
                return { 
                    success: true, 
                    message: 'Pairing code is active. Please enter it in WhatsApp on your phone.',
                    waitingForConnection: true 
                };
            }
            
            throw new Error('No active pairing code. Please start phone authentication first.');
        } catch (error) {
            console.error('❌ Pairing code verification error:', error);
            throw error;
        }
    }

    // Add method to switch authentication modes
    switchToPhoneMode() {
        console.log('📞 Switching to phone number authentication mode');
        this.authMode = 'phone';
    }

    switchToQRMode() {
        console.log('📱 Switching to QR code authentication mode');
        this.authMode = 'qr';
    }





    async disconnect() {
        // Prevent auto-reconnect during an intentional disconnect/restart
        this.manualDisconnect = true;
        try {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.socket) {
                // Prefer closing the socket without logging out to preserve session
                if (typeof this.socket.end === 'function') {
                    try {
                        await this.socket.end(new Error('manual disconnect'));
                    } catch (e) {
                        console.log('ℹ️ Socket end error ignored:', e?.message || e);
                    }
                } else if (this.socket.ws && typeof this.socket.ws.close === 'function') {
                    try {
                        this.socket.ws.close();
                    } catch (e) {
                        console.log('ℹ️ Socket close error ignored:', e?.message || e);
                    }
                }
                this.socket = null;
                this.isConnected = false;
                this.connectionState = 'disconnected';
                console.log('🔌 WhatsApp client disconnected (session preserved)');
            }
        } finally {
            // Allow future reconnects
            this.manualDisconnect = false;
        }
    }

    // Admin commands helper methods
    formatPhoneNumber(phone) {
        if (!phone) return null;
        
        // Remove all non-digit characters
        const cleaned = phone.replace(/\D/g, '');
        
        // Add country code if not present
        if (cleaned.length === 10) {
            return '91' + cleaned;
        } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
            return cleaned;
        } else if (cleaned.length === 11 && cleaned.startsWith('91')) {
            return cleaned;
        }
        
        return cleaned;
    }

    async sendMessageToAdmin(message) {
        try {
            const adminPhones = [
                process.env.WHATSAPP_ADMIN_PHONE,
                process.env.WHATSAPP_BROTHER_PHONE,
                process.env.WHATSAPP_ADMIN_PHONE_2
            ].filter(phone => phone);

            if (adminPhones.length === 0) {
                return { success: false, error: 'No admin phones configured' };
            }

            const results = [];
            for (const phone of adminPhones) {
                const formattedPhone = this.formatPhoneNumber(phone);
                if (formattedPhone) {
                    const jid = `${formattedPhone}@s.whatsapp.net`;
                    const result = await this.sendMessage(jid, message);
                    results.push({ phone: formattedPhone, success: result.success });
                }
            }

            return { success: true, results };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    isHealthy() {
        return {
            connected: this.isConnected,
            socket: !!this.socket,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    async restart() {
        try {
            await this.disconnect();
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            await this.initialize();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = WhatsAppClient;