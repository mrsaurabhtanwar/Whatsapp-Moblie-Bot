/**
 * WhatsApp Authentication Configuration
 * 
 * This file contains configuration options for WhatsApp authentication methods
 */

class AuthConfig {
    constructor() {
        // Default configuration
        this.config = {
            // Authentication mode: 'auto', 'qr', 'phone', 'both'
            authMode: process.env.WHATSAPP_AUTH_MODE || 'both',
            
            // Default phone number for phone authentication (optional)
            defaultPhoneNumber: process.env.WHATSAPP_DEFAULT_PHONE || '',
            
            // Session management
            sessionPersistence: process.env.WHATSAPP_SESSION_PERSISTENCE !== 'false',
            sessionCheckInterval: parseInt(process.env.WHATSAPP_SESSION_CHECK_INTERVAL || '300000'), // 5 minutes
            maxReconnectAttempts: parseInt(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || '10'),
            
            // Pairing code settings
            pairingCodeExpiry: parseInt(process.env.WHATSAPP_PAIRING_CODE_EXPIRY || '600000'), // 10 minutes
            autoRefreshPairingCode: process.env.WHATSAPP_AUTO_REFRESH_PAIRING !== 'false',
            
            // QR code settings
            qrCodeRefreshInterval: parseInt(process.env.WHATSAPP_QR_REFRESH_INTERVAL || '60000'), // 1 minute
            saveQRCodeImage: process.env.WHATSAPP_SAVE_QR_IMAGE !== 'false',
            
            // Connection settings
            connectionTimeout: parseInt(process.env.WHATSAPP_CONNECTION_TIMEOUT || '60000'), // 1 minute
            retryBackoffMultiplier: parseFloat(process.env.WHATSAPP_RETRY_BACKOFF || '2.0'),
            maxRetryDelay: parseInt(process.env.WHATSAPP_MAX_RETRY_DELAY || '30000'), // 30 seconds
            
            // Browser settings for Baileys
            browserName: process.env.WHATSAPP_BROWSER_NAME || 'WhatsApp Bot',
            browserVersion: process.env.WHATSAPP_BROWSER_VERSION || 'Chrome',
            browserRelease: process.env.WHATSAPP_BROWSER_RELEASE || '1.0.0',
            
            // Advanced settings
            syncFullHistory: process.env.WHATSAPP_SYNC_FULL_HISTORY === 'true',
            markOnlineOnConnect: process.env.WHATSAPP_MARK_ONLINE === 'true',
            enableMultiDevice: process.env.WHATSAPP_MULTI_DEVICE !== 'false',
            
            // Logging settings
            logLevel: process.env.WHATSAPP_LOG_LEVEL || 'warn',
            enableDebugLogs: process.env.WHATSAPP_DEBUG_LOGS === 'true'
        };
        
        this.validateConfig();
    }
    
    validateConfig() {
        // Validate auth mode
        const validAuthModes = ['auto', 'qr', 'phone', 'both'];
        if (!validAuthModes.includes(this.config.authMode)) {
            console.warn(`⚠️ Invalid auth mode: ${this.config.authMode}. Using 'both' as default.`);
            this.config.authMode = 'both';
        }
        
        // Validate numeric values
        if (this.config.sessionCheckInterval < 30000) {
            console.warn('⚠️ Session check interval too low, setting to 30 seconds minimum');
            this.config.sessionCheckInterval = 30000;
        }
        
        if (this.config.maxReconnectAttempts < 1) {
            console.warn('⚠️ Max reconnect attempts too low, setting to 5 minimum');
            this.config.maxReconnectAttempts = 5;
        }
        
        // Validate phone number format if provided
        if (this.config.defaultPhoneNumber) {
            const cleanPhone = this.config.defaultPhoneNumber.replace(/\D/g, '');
            if (cleanPhone.length < 10 || cleanPhone.length > 15) {
                console.warn('⚠️ Invalid default phone number format, ignoring');
                this.config.defaultPhoneNumber = '';
            }
        }
    }
    
    get(key) {
        return this.config[key];
    }
    
    set(key, value) {
        if (key in this.config) {
            this.config[key] = value;
            this.validateConfig();
            return true;
        }
        return false;
    }
    
    getAll() {
        return { ...this.config };
    }
    
    // Authentication mode helpers
    isQREnabled() {
        return ['auto', 'qr', 'both'].includes(this.config.authMode);
    }
    
    isPhoneEnabled() {
        return ['auto', 'phone', 'both'].includes(this.config.authMode);
    }
    
    shouldAutoDetect() {
        return this.config.authMode === 'auto';
    }
    
    // Environment configuration display
    displayConfig() {
        console.log('🔧 WhatsApp Authentication Configuration:');
        console.log(`   Auth Mode: ${this.config.authMode}`);
        console.log(`   QR Enabled: ${this.isQREnabled()}`);
        console.log(`   Phone Enabled: ${this.isPhoneEnabled()}`);
        console.log(`   Session Persistence: ${this.config.sessionPersistence}`);
        console.log(`   Max Reconnect Attempts: ${this.config.maxReconnectAttempts}`);
        console.log(`   Default Phone: ${this.config.defaultPhoneNumber || 'None'}`);
        if (this.config.enableDebugLogs) {
            console.log('🔍 Debug Configuration:', this.config);
        }
    }
    
    // Export config for .env file
    generateEnvConfig() {
        const envLines = [
            '# WhatsApp Authentication Configuration',
            '# Generated by AuthConfig',
            '',
            '# Authentication mode: auto, qr, phone, both',
            `WHATSAPP_AUTH_MODE=${this.config.authMode}`,
            '',
            '# Default phone number (optional)',
            `WHATSAPP_DEFAULT_PHONE=${this.config.defaultPhoneNumber}`,
            '',
            '# Session management',
            `WHATSAPP_SESSION_PERSISTENCE=${this.config.sessionPersistence}`,
            `WHATSAPP_SESSION_CHECK_INTERVAL=${this.config.sessionCheckInterval}`,
            `WHATSAPP_MAX_RECONNECT_ATTEMPTS=${this.config.maxReconnectAttempts}`,
            '',
            '# Pairing code settings',
            `WHATSAPP_PAIRING_CODE_EXPIRY=${this.config.pairingCodeExpiry}`,
            `WHATSAPP_AUTO_REFRESH_PAIRING=${this.config.autoRefreshPairingCode}`,
            '',
            '# QR code settings',
            `WHATSAPP_QR_REFRESH_INTERVAL=${this.config.qrCodeRefreshInterval}`,
            `WHATSAPP_SAVE_QR_IMAGE=${this.config.saveQRCodeImage}`,
            '',
            '# Connection settings',
            `WHATSAPP_CONNECTION_TIMEOUT=${this.config.connectionTimeout}`,
            `WHATSAPP_RETRY_BACKOFF=${this.config.retryBackoffMultiplier}`,
            `WHATSAPP_MAX_RETRY_DELAY=${this.config.maxRetryDelay}`,
            '',
            '# Advanced settings',
            `WHATSAPP_SYNC_FULL_HISTORY=${this.config.syncFullHistory}`,
            `WHATSAPP_MARK_ONLINE=${this.config.markOnlineOnConnect}`,
            `WHATSAPP_MULTI_DEVICE=${this.config.enableMultiDevice}`,
            '',
            '# Logging',
            `WHATSAPP_LOG_LEVEL=${this.config.logLevel}`,
            `WHATSAPP_DEBUG_LOGS=${this.config.enableDebugLogs}`,
            ''
        ];
        
        return envLines.join('\n');
    }
    
    // Save configuration to file
    async saveToFile(filePath) {
        const fs = require('fs').promises;
        const envConfig = this.generateEnvConfig();
        await fs.writeFile(filePath, envConfig, 'utf8');
        console.log(`✅ Configuration saved to ${filePath}`);
    }
}

module.exports = AuthConfig;