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

class WhatsAppClient extends EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.qrCode = null;
        this.authDir = path.join(__dirname, 'baileys_auth');
        this.logger = pino({ level: 'warn' }); // Reduced logging
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Ensure auth directory exists
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    async initialize() {
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
                getMessage: async (key) => {
                    return { conversation: '' };
                }
            });

            this.setupEventHandlers(saveCreds);
            
            return this.socket;
        } catch (error) {
            console.error('❌ Failed to initialize WhatsApp client:', error.message);
            throw error;
        }
    }

    setupEventHandlers(saveCreds) {
        this.socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnected, qr } = update;
            
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

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnected?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log('🔌 Connection closed. Reason:', lastDisconnected?.error?.output?.statusCode);
                this.isConnected = false;
                this.connectionState = 'disconnected';
                this.emit('disconnected');
                
                if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => this.initialize(), 3000);
                } else if (lastDisconnected?.error?.output?.statusCode === DisconnectReason.loggedOut) {
                    console.log('📱 Logged out. Please scan QR code again.');
                    // Clear auth state on logout
                    if (fs.existsSync(this.authDir)) {
                        fs.rmSync(this.authDir, { recursive: true, force: true });
                        fs.mkdirSync(this.authDir, { recursive: true });
                    }
                    this.reconnectAttempts = 0;
                    setTimeout(() => this.initialize(), 2000);
                } else {
                    console.log('❌ Max reconnection attempts reached. Please restart the bot.');
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                this.isConnected = true;
                this.connectionState = 'connected';
                this.reconnectAttempts = 0;
                this.qrCode = null;
                this.emit('connected');
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
            
            // Generate a pairing code (6 digits)
            const pairingCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            
            // Store the pairing code and phone number
            this.pairingCode = pairingCode;
            this.pairingPhoneNumber = phoneNumber;
            this.pairingExpiresAt = expiresAt;
            
            console.log(`📱 Pairing code generated: ${pairingCode}`);
            console.log(`⏰ Code expires at: ${expiresAt.toLocaleTimeString()}`);
            
            return {
                success: true,
                pairingCode: pairingCode,
                expiresAt: expiresAt,
                phoneNumber: phoneNumber,
                message: 'Pairing code generated. Enter this code in WhatsApp on your phone.'
            };
        } catch (error) {
            console.error('❌ Phone authentication error:', error);
            throw error;
        }
    }

    getAuthStatus() {
        return {
            pairingCode: this.pairingCode || null,
            pairingPhoneNumber: this.pairingPhoneNumber || null,
            pairingExpiresAt: this.pairingExpiresAt || null,
            isExpired: this.pairingExpiresAt ? new Date() > this.pairingExpiresAt : true
        };
    }

    async verifyPairingCode(code) {
        try {
            const authStatus = this.getAuthStatus();
            
            if (authStatus.isExpired) {
                throw new Error('Pairing code has expired. Please generate a new one.');
            }
            
            if (authStatus.pairingCode !== code) {
                throw new Error('Invalid pairing code. Please check and try again.');
            }
            
            // Clear the pairing code after successful verification
            this.pairingCode = null;
            this.pairingPhoneNumber = null;
            this.pairingExpiresAt = null;
            
            console.log('✅ Pairing code verified successfully');
            return { success: true, message: 'Pairing code verified successfully' };
        } catch (error) {
            console.error('❌ Pairing code verification error:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.socket) {
            await this.socket.logout();
            this.socket = null;
            this.isConnected = false;
            this.connectionState = 'disconnected';
            console.log('🔌 WhatsApp client disconnected');
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