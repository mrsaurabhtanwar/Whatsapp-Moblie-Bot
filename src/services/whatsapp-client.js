/**
 * WhatsApp Client Implementation with QR Code Support
 * Handles WhatsApp Web connection, QR code generation, and message sending
 */

const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

// Create logger instance
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname'
        }
    }
});

class WhatsAppClient {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.qrGenerated = false;
        this.connectionRetries = 0;
        this.maxRetries = 5;
        this.authDir = path.join(__dirname, '../../auth_info_baileys');
        this.qrCodePath = path.join(__dirname, '../core/qr-code.png');
    }

    /**
     * Initialize WhatsApp connection
     */
    async initialize() {
        try {
            logger.info('🔄 Initializing WhatsApp client...');
            
            // Create auth directory if it doesn't exist
            if (!fs.existsSync(this.authDir)) {
                fs.mkdirSync(this.authDir, { recursive: true });
                logger.info('📁 Created auth directory');
            }

            // Load auth state
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            // Create WhatsApp socket
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false, // We'll handle QR display ourselves
                logger: logger.child({ level: 'warn' }), // Reduce Baileys logging
                browser: ['WhatsApp Tailor Bot', 'Chrome', '3.0'],
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 0,
                keepAliveIntervalMs: 10000,
                markOnlineOnConnect: true
            });

            // Set up event handlers
            this.setupEventHandlers(saveCreds);
            
            logger.info('✅ WhatsApp client initialized');
            return true;

        } catch (error) {
            logger.error('❌ Failed to initialize WhatsApp client:', error);
            throw error;
        }
    }

    /**
     * Set up WhatsApp event handlers
     */
    setupEventHandlers(saveCreds) {
        // Connection updates
        this.sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                this.displayQRCode(qr);
            }
            
            if (connection === 'close') {
                this.handleDisconnection(lastDisconnect);
            } else if (connection === 'open') {
                this.handleConnection();
            }
        });

        // Credentials update
        this.sock.ev.on('creds.update', saveCreds);

        // Messages (for future message handling)
        this.sock.ev.on('messages.upsert', ({ messages }) => {
            // Handle incoming messages if needed
            logger.debug('📨 Received messages:', messages.length);
        });
    }

    /**
     * Display QR code for WhatsApp Web connection
     */
    displayQRCode(qr) {
        if (!this.qrGenerated) {
            logger.info('');
            logger.info('📱 WHATSAPP QR CODE GENERATED!');
            logger.info('');
            logger.info('🔍 To connect your WhatsApp:');
            logger.info('   1. Open WhatsApp on your phone');
            logger.info('   2. Go to Settings → Linked Devices');
            logger.info('   3. Tap "Link a Device"');
            logger.info('   4. Scan the QR code below:');
            logger.info('');
            
            // Display QR in terminal
            qrcode.generate(qr, { small: true }, (qrString) => {
                console.log(qrString);
                logger.info('');
                logger.info('⏰ QR code will refresh automatically in 60 seconds if not scanned');
                logger.info('🔄 Keep this terminal window open and scan the QR code');
                logger.info('');
            });
            
            // Save QR code as image file (optional)
            this.saveQRCodeImage(qr);
            this.qrGenerated = true;
        }
    }

    /**
     * Save QR code as PNG image file
     */
    async saveQRCodeImage(qr) {
        try {
            const QRCode = require('qrcode');
            const fs = require('fs').promises;
            
            // Generate QR code as PNG buffer
            const qrBuffer = await QRCode.toBuffer(qr, {
                type: 'png',
                width: 256,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            // Save to file
            await fs.writeFile(this.qrCodePath, qrBuffer);
            logger.info(`💾 QR code saved as image: ${this.qrCodePath}`);
            
        } catch (error) {
            logger.warn('⚠️ Failed to save QR code image:', error.message);
        }
    }

    /**
     * Handle successful WhatsApp connection
     */
    handleConnection() {
        this.isConnected = true;
        this.connectionRetries = 0;
        this.qrGenerated = false;
        
        logger.info('');
        logger.info('🎉 WHATSAPP CONNECTED SUCCESSFULLY!');
        logger.info('');
        logger.info('✅ Your WhatsApp is now connected to the bot');
        logger.info('📱 Phone number:', this.sock.user?.id || 'Unknown');
        logger.info('👤 User name:', this.sock.user?.name || 'Unknown');
        logger.info('');
        logger.info('🚀 Bot is ready to send messages!');
        logger.info('');
        
        // Delete QR code image after successful connection
        this.cleanupQRCode();
    }

    /**
     * Handle WhatsApp disconnection
     */
    handleDisconnection(lastDisconnect) {
        this.isConnected = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (lastDisconnect?.error) {
            const errorCode = lastDisconnect.error?.output?.statusCode;
            const errorMessage = this.getDisconnectionMessage(errorCode);
            
            logger.warn('⚠️ WhatsApp disconnected:', errorMessage);
            
            if (shouldReconnect && this.connectionRetries < this.maxRetries) {
                this.connectionRetries++;
                logger.info(`🔄 Attempting to reconnect... (${this.connectionRetries}/${this.maxRetries})`);
                setTimeout(() => this.initialize(), 5000);
            } else if (errorCode === DisconnectReason.loggedOut) {
                logger.warn('🚪 WhatsApp logged out - please scan QR code again');
                this.cleanupAuthSession();
            } else {
                logger.error('❌ Max reconnection attempts reached');
            }
        }
    }

    /**
     * Get human-readable disconnection message
     */
    getDisconnectionMessage(errorCode) {
        const messages = {
            [DisconnectReason.badSession]: 'Bad session file, please delete and scan QR again',
            [DisconnectReason.connectionClosed]: 'Connection closed',
            [DisconnectReason.connectionLost]: 'Connection lost',
            [DisconnectReason.connectionReplaced]: 'Connection replaced by another session',
            [DisconnectReason.loggedOut]: 'Logged out from WhatsApp',
            [DisconnectReason.restartRequired]: 'Restart required',
            [DisconnectReason.timedOut]: 'Connection timed out'
        };
        return messages[errorCode] || `Unknown error (${errorCode})`;
    }

    /**
     * Send text message to WhatsApp number
     */
    async sendMessage(phoneNumber, message) {
        if (!this.isConnected || !this.sock) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            // Format phone number (add country code if missing)
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;
            
            logger.info(`📤 Sending message to ${phoneNumber}...`);
            
            const result = await this.sock.sendMessage(jid, { text: message });
            
            logger.info(`✅ Message sent successfully to ${phoneNumber}`);
            return result;
            
        } catch (error) {
            logger.error(`❌ Failed to send message to ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Send image message to WhatsApp number
     * @param {string} phoneNumber - Phone number to send to
     * @param {string|Buffer|Object} image - Image path, buffer, or {url: string} object
     * @param {string} caption - Optional caption for the image
     * @param {boolean} viewOnce - Optional: send as view-once message
     */
    async sendImageMessage(phoneNumber, image, caption = '', viewOnce = false) {
        if (!this.isConnected || !this.sock) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            // Format phone number (add country code if missing)
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;
            
            logger.info(`📤 Sending image message to ${phoneNumber}...`);
            
            // Prepare image object
            let imageObj;
            if (typeof image === 'string') {
                // If string, assume it's a file path or URL
                if (image.startsWith('http://') || image.startsWith('https://')) {
                    imageObj = { url: image };
                } else {
                    // Local file path
                    if (!fs.existsSync(image)) {
                        throw new Error(`Image file not found: ${image}`);
                    }
                    imageObj = fs.readFileSync(image);
                }
            } else if (Buffer.isBuffer(image)) {
                imageObj = image;
            } else if (typeof image === 'object' && image.url) {
                imageObj = image;
            } else {
                throw new Error('Invalid image format. Use file path, URL, Buffer, or {url: string} object');
            }

            // Prepare message content
            const messageContent = {
                image: imageObj,
                caption: caption
            };

            // Add view once if specified
            if (viewOnce) {
                messageContent.viewOnce = true;
            }

            const result = await this.sock.sendMessage(jid, messageContent);
            
            logger.info(`✅ Image message sent successfully to ${phoneNumber}`);
            return result;
            
        } catch (error) {
            logger.error(`❌ Failed to send image message to ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Send video message to WhatsApp number
     * @param {string} phoneNumber - Phone number to send to
     * @param {string|Buffer|Object} video - Video path, buffer, or {url: string} object
     * @param {string} caption - Optional caption for the video
     * @param {boolean} gifPlayback - Optional: send as GIF (for MP4 files)
     * @param {boolean} viewOnce - Optional: send as view-once message
     * @param {boolean} ptv - Optional: send as video note (PTV)
     */
    async sendVideoMessage(phoneNumber, video, caption = '', options = {}) {
        if (!this.isConnected || !this.sock) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            // Format phone number (add country code if missing)
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;
            
            logger.info(`📤 Sending video message to ${phoneNumber}...`);
            
            // Prepare video object
            let videoObj;
            if (typeof video === 'string') {
                // If string, assume it's a file path or URL
                if (video.startsWith('http://') || video.startsWith('https://')) {
                    videoObj = { url: video };
                } else {
                    // Local file path
                    if (!fs.existsSync(video)) {
                        throw new Error(`Video file not found: ${video}`);
                    }
                    videoObj = fs.readFileSync(video);
                }
            } else if (Buffer.isBuffer(video)) {
                videoObj = video;
            } else if (typeof video === 'object' && video.url) {
                videoObj = video;
            } else {
                throw new Error('Invalid video format. Use file path, URL, Buffer, or {url: string} object');
            }

            // Prepare message content
            const messageContent = {
                video: videoObj,
                caption: caption
            };

            // Add optional parameters
            if (options.gifPlayback) {
                messageContent.gifPlayback = true;
            }
            if (options.viewOnce) {
                messageContent.viewOnce = true;
            }
            if (options.ptv) {
                messageContent.ptv = true;
            }

            const result = await this.sock.sendMessage(jid, messageContent);
            
            logger.info(`✅ Video message sent successfully to ${phoneNumber}`);
            return result;
            
        } catch (error) {
            logger.error(`❌ Failed to send video message to ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Send audio message to WhatsApp number
     * @param {string} phoneNumber - Phone number to send to
     * @param {string|Buffer|Object} audio - Audio path, buffer, or {url: string} object
     * @param {string} mimetype - Audio mimetype (e.g., 'audio/mp4', 'audio/ogg')
     * @param {boolean} ptt - Optional: send as voice note (push-to-talk)
     */
    async sendAudioMessage(phoneNumber, audio, mimetype = 'audio/mp4', ptt = false) {
        if (!this.isConnected || !this.sock) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            // Format phone number (add country code if missing)
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;
            
            logger.info(`📤 Sending audio message to ${phoneNumber}...`);
            
            // Prepare audio object
            let audioObj;
            if (typeof audio === 'string') {
                // If string, assume it's a file path or URL
                if (audio.startsWith('http://') || audio.startsWith('https://')) {
                    audioObj = { url: audio };
                } else {
                    // Local file path
                    if (!fs.existsSync(audio)) {
                        throw new Error(`Audio file not found: ${audio}`);
                    }
                    audioObj = fs.readFileSync(audio);
                }
            } else if (Buffer.isBuffer(audio)) {
                audioObj = audio;
            } else if (typeof audio === 'object' && audio.url) {
                audioObj = audio;
            } else {
                throw new Error('Invalid audio format. Use file path, URL, Buffer, or {url: string} object');
            }

            // Prepare message content
            const messageContent = {
                audio: audioObj,
                mimetype: mimetype
            };

            // Add PTT flag for voice notes
            if (ptt) {
                messageContent.ptt = true;
            }

            const result = await this.sock.sendMessage(jid, messageContent);
            
            logger.info(`✅ Audio message sent successfully to ${phoneNumber}`);
            return result;
            
        } catch (error) {
            logger.error(`❌ Failed to send audio message to ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Send document message to WhatsApp number
     * @param {string} phoneNumber - Phone number to send to
     * @param {string|Buffer|Object} document - Document path, buffer, or {url: string} object
     * @param {string} filename - Document filename
     * @param {string} mimetype - Document mimetype
     * @param {string} caption - Optional caption for the document
     */
    async sendDocumentMessage(phoneNumber, document, filename, mimetype, caption = '') {
        if (!this.isConnected || !this.sock) {
            throw new Error('WhatsApp is not connected');
        }

        try {
            // Format phone number (add country code if missing)
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            const jid = `${formattedNumber}@s.whatsapp.net`;
            
            logger.info(`📤 Sending document message to ${phoneNumber}...`);
            
            // Prepare document object
            let documentObj;
            if (typeof document === 'string') {
                // If string, assume it's a file path or URL
                if (document.startsWith('http://') || document.startsWith('https://')) {
                    documentObj = { url: document };
                } else {
                    // Local file path
                    if (!fs.existsSync(document)) {
                        throw new Error(`Document file not found: ${document}`);
                    }
                    documentObj = fs.readFileSync(document);
                }
            } else if (Buffer.isBuffer(document)) {
                documentObj = document;
            } else if (typeof document === 'object' && document.url) {
                documentObj = document;
            } else {
                throw new Error('Invalid document format. Use file path, URL, Buffer, or {url: string} object');
            }

            const result = await this.sock.sendMessage(jid, {
                document: documentObj,
                fileName: filename,
                mimetype: mimetype,
                caption: caption
            });
            
            logger.info(`✅ Document message sent successfully to ${phoneNumber}`);
            return result;
            
        } catch (error) {
            logger.error(`❌ Failed to send document message to ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Format phone number for WhatsApp
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-numeric characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if missing (assuming India +91)
        if (cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }
        
        return cleaned;
    }

    /**
     * Check if WhatsApp is connected
     */
    isWhatsAppConnected() {
        return this.isConnected && this.sock;
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            user: this.sock?.user || null,
            retries: this.connectionRetries,
            maxRetries: this.maxRetries
        };
    }

    /**
     * Clean up QR code image
     */
    cleanupQRCode() {
        try {
            if (fs.existsSync(this.qrCodePath)) {
                fs.unlinkSync(this.qrCodePath);
                logger.debug('🗑️ QR code image cleaned up');
            }
        } catch (error) {
            logger.warn('⚠️ Failed to cleanup QR code image:', error.message);
        }
    }

    /**
     * Clean up auth session (for logout)
     */
    cleanupAuthSession() {
        try {
            if (fs.existsSync(this.authDir)) {
                fs.rmSync(this.authDir, { recursive: true, force: true });
                logger.info('🗑️ Auth session cleaned up');
            }
        } catch (error) {
            logger.warn('⚠️ Failed to cleanup auth session:', error.message);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        logger.info('🛑 Shutting down WhatsApp client...');
        
        if (this.sock) {
            try {
                await this.sock.logout();
            } catch (error) {
                logger.warn('⚠️ Error during WhatsApp logout:', error.message);
            }
        }
        
        this.cleanupQRCode();
        this.isConnected = false;
        this.sock = null;
        
        logger.info('✅ WhatsApp client shutdown complete');
    }
}

module.exports = WhatsAppClient;