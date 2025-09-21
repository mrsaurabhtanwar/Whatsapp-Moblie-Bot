const fs = require('fs').promises;
const path = require('path');

/**
 * Secure Credential Manager
 * 
 * This class handles Google Sheets credentials securely by:
 * 1. Preferring environment variables over files
 * 2. Masking sensitive data in logs
 * 3. Providing fallback to existing service-account.json
 * 4. Preserving WhatsApp authentication files
 */
class SecureCredentials {
    constructor() {
        this.serviceAccountPath = path.join(__dirname, '../../service-account.json');
        this.credentials = null;
        this.credentialsSource = null;
    }

    /**
     * Initialize credentials from environment variables or file
     * Preserves existing WhatsApp authentication
     */
    async initializeCredentials() {
        try {
            // Try environment variables first (more secure)
            if (process.env.GOOGLE_PROJECT_ID && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL) {
                this.credentials = {
                    type: 'service_account',
                    project_id: process.env.GOOGLE_PROJECT_ID,
                    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || '',
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    client_email: process.env.GOOGLE_CLIENT_EMAIL,
                    client_id: process.env.GOOGLE_CLIENT_ID || '',
                    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                    token_uri: 'https://oauth2.googleapis.com/token',
                    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
                    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL || ''
                };
                this.credentialsSource = 'environment';
                console.log('✅ Google credentials loaded from environment variables');
                return true;
            }
            
            // Fallback to existing service-account.json file
            try {
                const credentialsData = await fs.readFile(this.serviceAccountPath, 'utf8');
                this.credentials = JSON.parse(credentialsData);
                this.credentialsSource = 'file';
                console.log('✅ Google credentials loaded from service-account.json file');
                return true;
            } catch (fileError) {
                if (fileError.code === 'ENOENT') {
                    throw new Error('No Google credentials found. Please set environment variables or add service-account.json file.');
                }
                throw fileError;
            }
            
        } catch (error) {
            console.error('❌ Failed to initialize Google credentials:', error.message);
            throw error;
        }
    }

    /**
     * Get credentials for Google Sheets API
     */
    getCredentials() {
        if (!this.credentials) {
            throw new Error('Credentials not initialized. Call initializeCredentials() first.');
        }
        return this.credentials;
    }

    /**
     * Get credentials source for logging (masked)
     */
    getCredentialsSource() {
        return this.credentialsSource;
    }

    /**
     * Mask sensitive data for logging
     */
    maskCredentialsForLogging() {
        if (!this.credentials) {
            return { error: 'No credentials loaded' };
        }

        return {
            source: this.credentialsSource,
            project_id: this.credentials.project_id,
            client_email: this.credentials.client_email,
            private_key_masked: this.credentials.private_key ? 
                this.credentials.private_key.substring(0, 20) + '...' + this.credentials.private_key.substring(this.credentials.private_key.length - 20) : 
                'Not available'
        };
    }

    /**
     * Check if WhatsApp auth files are preserved
     */
    async checkWhatsAppAuth() {
        const baileysAuthDir = path.join(__dirname, '../../src/core/baileys_auth');
        try {
            const files = await fs.readdir(baileysAuthDir);
            const hasCredentials = files.includes('creds.json');
            const sessionFiles = files.filter(f => f.startsWith('session-')).length;
            
            console.log(`📱 WhatsApp auth status: ${hasCredentials ? '✅' : '❌'} credentials, ${sessionFiles} session files`);
            return { hasCredentials, sessionFiles, files: files.length };
        } catch (error) {
            console.log('📱 WhatsApp auth directory not found - will be created on first connection');
            return { hasCredentials: false, sessionFiles: 0, files: 0 };
        }
    }

    /**
     * Validate credentials without exposing sensitive data
     */
    validateCredentials() {
        if (!this.credentials) {
            return { valid: false, error: 'No credentials loaded' };
        }

        const requiredFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = requiredFields.filter(field => !this.credentials[field]);
        
        if (missingFields.length > 0) {
            return { valid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
        }

        if (this.credentials.type !== 'service_account') {
            return { valid: false, error: 'Invalid credential type' };
        }

        return { valid: true, source: this.credentialsSource };
    }

    /**
     * Get secure environment setup instructions
     */
    getEnvironmentSetupInstructions() {
        return {
            message: 'To use environment variables instead of service-account.json file:',
            instructions: [
                '1. Copy env.example to .env',
                '2. Fill in your Google Cloud service account details:',
                '   - GOOGLE_PROJECT_ID=your-project-id',
                '   - GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"',
                '   - GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com',
                '3. Restart the bot',
                '4. The bot will automatically use environment variables instead of the file'
            ],
            security_note: 'Environment variables are more secure than files and should be used in production.'
        };
    }
}

module.exports = SecureCredentials;
