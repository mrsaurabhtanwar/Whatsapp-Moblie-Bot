const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced Configuration Manager
 * 
 * Features:
 * - Environment-based configuration
 * - Runtime configuration updates
 * - Feature flags
 * - Configuration validation
 * - Hot reloading
 * - Configuration backup
 */
class ConfigManager {
    constructor(options = {}) {
        this.configDir = options.configDir || './config';
        this.configFile = path.join(this.configDir, 'bot-config.json');
        this.envFile = path.join(this.configDir, '.env');
        this.backupDir = path.join(this.configDir, 'backups');
        
        this.config = {};
        this.featureFlags = {};
        this.validationRules = {};
        this.watchers = new Map();
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Create config directory
            await fs.mkdir(this.configDir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
            
            // Load configuration
            await this.loadConfiguration();
            
            // Setup validation rules
            this.setupValidationRules();
            
            // Setup feature flags
            this.setupFeatureFlags();
            
            console.log('✅ Configuration Manager initialized');
            console.log(`📁 Config directory: ${this.configDir}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Configuration Manager:', error.message);
        }
    }

    async loadConfiguration() {
        try {
            // Load from environment variables first
            this.loadFromEnvironment();
            
            // Load from config file if exists
            if (await this.fileExists(this.configFile)) {
                await this.loadFromFile();
            } else {
                // Create default config
                await this.createDefaultConfig();
            }
            
            // Validate configuration
            this.validateConfiguration();
            
            console.log('📋 Configuration loaded successfully');
            
        } catch (error) {
            console.error('❌ Failed to load configuration:', error.message);
            throw error;
        }
    }

    loadFromEnvironment() {
        this.config = {
            // Bot Configuration
            bot: {
                mode: process.env.BOT_MODE || 'AUTO',
                pollingInterval: parseInt(process.env.POLL_INTERVAL_SECONDS) || 180,
                batchSize: parseInt(process.env.BATCH_SIZE) || 10,
                maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
                retryDelay: parseInt(process.env.RETRY_DELAY_SECONDS) || 30
            },
            
            // WhatsApp Configuration
            whatsapp: {
                adminPhone: process.env.WHATSAPP_ADMIN_PHONE || '',
                adminName: process.env.WHATSAPP_ADMIN_NAME || 'Admin',
                killSwitch: process.env.WHATSAPP_KILL_SWITCH === 'true'
            },
            
            // Google Sheets Configuration
            sheets: {
                mainSheetId: process.env.GOOGLE_SHEET_ID || '',
                fabricSheetId: process.env.FABRIC_SHEET_ID || '',
                combinedSheetId: process.env.COMBINED_SHEET_ID || '',
                sheetName: process.env.GOOGLE_SHEET_NAME || 'Sheet1',
                range: process.env.GOOGLE_SHEET_RANGE || 'A:Z'
            },
            
            // Database Configuration
            database: {
                backupEnabled: process.env.DATABASE_BACKUP_ENABLED !== 'false',
                backupInterval: parseInt(process.env.BACKUP_INTERVAL_HOURS) || 24,
                retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
                googleDriveBackup: process.env.GOOGLE_DRIVE_BACKUP === 'true'
            },
            
            // Monitoring Configuration
            monitoring: {
                enabled: process.env.MONITORING_ENABLED !== 'false',
                alertEmail: process.env.ALERT_EMAIL || '',
                smtpHost: process.env.SMTP_HOST || '',
                smtpPort: parseInt(process.env.SMTP_PORT) || 587,
                smtpUser: process.env.SMTP_USER || '',
                smtpPass: process.env.SMTP_PASS || '',
                slackWebhook: process.env.SLACK_WEBHOOK_URL || ''
            },
            
            // Performance Configuration
            performance: {
                metricsEnabled: process.env.METRICS_ENABLED !== 'false',
                metricsPort: parseInt(process.env.METRICS_PORT) || 9090,
                memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD) || 80,
                gcThreshold: parseInt(process.env.GC_THRESHOLD) || 80
            },
            
            // Security Configuration
            security: {
                encryptionEnabled: process.env.ENCRYPTION_ENABLED === 'true',
                rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== 'false',
                dailyLimit: parseInt(process.env.DAILY_MESSAGE_LIMIT) || 10,
                hourlyLimit: parseInt(process.env.HOURLY_MESSAGE_LIMIT) || 3
            },
            
            // Shop Configuration
            shop: {
                name: process.env.SHOP_NAME || 'RS Tailor & Fabric',
                phone: process.env.SHOP_PHONE || '8824781960',
                address: process.env.SHOP_ADDRESS || 'Main Market, Kumher',
                businessHours: process.env.BUSINESS_HOURS || '10:00 AM - 7:00 PM',
                timezone: process.env.TIMEZONE || 'Asia/Kolkata'
            }
        };
    }

    async loadFromFile() {
        try {
            const data = await fs.readFile(this.configFile, 'utf8');
            const fileConfig = JSON.parse(data);
            
            // Merge with environment config
            this.config = this.mergeConfigs(this.config, fileConfig);
            
            console.log('📁 Configuration loaded from file');
            
        } catch (error) {
            console.error('❌ Failed to load config file:', error.message);
        }
    }

    async createDefaultConfig() {
        try {
            await this.saveConfiguration();
            console.log('📝 Default configuration created');
        } catch (error) {
            console.error('❌ Failed to create default config:', error.message);
        }
    }

    mergeConfigs(baseConfig, overrideConfig) {
        const merged = { ...baseConfig };
        
        for (const [key, value] of Object.entries(overrideConfig)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }

    setupValidationRules() {
        this.validationRules = {
            bot: {
                mode: { type: 'string', values: ['AUTO', 'APPROVAL', 'MANUAL'] },
                pollingInterval: { type: 'number', min: 30, max: 3600 },
                batchSize: { type: 'number', min: 1, max: 100 },
                maxRetries: { type: 'number', min: 1, max: 10 },
                retryDelay: { type: 'number', min: 5, max: 300 }
            },
            whatsapp: {
                adminPhone: { type: 'string', pattern: /^\d{10,15}$/ },
                adminName: { type: 'string', minLength: 1, maxLength: 50 }
            },
            sheets: {
                mainSheetId: { type: 'string', required: true },
                sheetName: { type: 'string', required: true }
            },
            monitoring: {
                smtpPort: { type: 'number', min: 1, max: 65535 },
                metricsPort: { type: 'number', min: 1000, max: 65535 }
            },
            performance: {
                memoryThreshold: { type: 'number', min: 50, max: 95 },
                gcThreshold: { type: 'number', min: 50, max: 95 }
            },
            security: {
                dailyLimit: { type: 'number', min: 1, max: 100 },
                hourlyLimit: { type: 'number', min: 1, max: 20 }
            }
        };
    }

    setupFeatureFlags() {
        this.featureFlags = {
            // Core Features
            duplicatePrevention: true,
            safetyManager: true,
            performanceMetrics: true,
            monitoring: true,
            
            // Advanced Features
            smartPolling: false,
            advancedAnalytics: false,
            dataEncryption: false,
            autoScaling: false,
            
            // Experimental Features
            aiInsights: false,
            predictiveAnalytics: false,
            voiceNotifications: false,
            multiLanguage: false
        };
    }

    validateConfiguration() {
        const errors = [];
        
        for (const [section, rules] of Object.entries(this.validationRules)) {
            if (!this.config[section]) {
                errors.push(`Missing configuration section: ${section}`);
                continue;
            }
            
            for (const [key, rule] of Object.entries(rules)) {
                const value = this.config[section][key];
                
                if (rule.required && (value === undefined || value === null || value === '')) {
                    errors.push(`Required field missing: ${section}.${key}`);
                    continue;
                }
                
                if (value !== undefined && value !== null) {
                    // Type validation
                    if (rule.type === 'number' && typeof value !== 'number') {
                        errors.push(`Invalid type for ${section}.${key}: expected number, got ${typeof value}`);
                    } else if (rule.type === 'string' && typeof value !== 'string') {
                        errors.push(`Invalid type for ${section}.${key}: expected string, got ${typeof value}`);
                    }
                    
                    // Range validation
                    if (rule.min !== undefined && value < rule.min) {
                        errors.push(`${section}.${key} must be at least ${rule.min}`);
                    }
                    if (rule.max !== undefined && value > rule.max) {
                        errors.push(`${section}.${key} must be at most ${rule.max}`);
                    }
                    
                    // Length validation
                    if (rule.minLength !== undefined && value.length < rule.minLength) {
                        errors.push(`${section}.${key} must be at least ${rule.minLength} characters`);
                    }
                    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                        errors.push(`${section}.${key} must be at most ${rule.maxLength} characters`);
                    }
                    
                    // Pattern validation
                    if (rule.pattern && !rule.pattern.test(value)) {
                        errors.push(`${section}.${key} format is invalid`);
                    }
                    
                    // Values validation
                    if (rule.values && !rule.values.includes(value)) {
                        errors.push(`${section}.${key} must be one of: ${rule.values.join(', ')}`);
                    }
                }
            }
        }
        
        if (errors.length > 0) {
            console.error('❌ Configuration validation failed:');
            errors.forEach(error => console.error(`  - ${error}`));
            throw new Error('Configuration validation failed');
        }
        
        console.log('✅ Configuration validation passed');
    }

    async saveConfiguration() {
        try {
            // Create backup
            await this.createBackup();
            
            // Save current config
            await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2));
            
            console.log('💾 Configuration saved successfully');
            
        } catch (error) {
            console.error('❌ Failed to save configuration:', error.message);
            throw error;
        }
    }

    async createBackup() {
        try {
            if (await this.fileExists(this.configFile)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupFile = path.join(this.backupDir, `config-backup-${timestamp}.json`);
                
                const data = await fs.readFile(this.configFile, 'utf8');
                await fs.writeFile(backupFile, data);
                
                console.log(`📁 Configuration backup created: ${backupFile}`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to create configuration backup:', error.message);
        }
    }

    async updateConfiguration(section, key, value) {
        try {
            // Validate the update
            if (this.validationRules[section] && this.validationRules[section][key]) {
                const rule = this.validationRules[section][key];
                this.validateValue(value, rule, `${section}.${key}`);
            }
            
            // Update configuration
            if (!this.config[section]) {
                this.config[section] = {};
            }
            
            this.config[section][key] = value;
            
            // Save configuration
            await this.saveConfiguration();
            
            // Notify watchers
            this.notifyWatchers(section, key, value);
            
            console.log(`✅ Configuration updated: ${section}.${key} = ${value}`);
            
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to update configuration ${section}.${key}:`, error.message);
            return false;
        }
    }

    validateValue(value, rule, path) {
        if (rule.required && (value === undefined || value === null || value === '')) {
            throw new Error(`Required field missing: ${path}`);
        }
        
        if (value !== undefined && value !== null) {
            if (rule.type === 'number' && typeof value !== 'number') {
                throw new Error(`Invalid type for ${path}: expected number, got ${typeof value}`);
            }
            if (rule.type === 'string' && typeof value !== 'string') {
                throw new Error(`Invalid type for ${path}: expected string, got ${typeof value}`);
            }
            
            if (rule.min !== undefined && value < rule.min) {
                throw new Error(`${path} must be at least ${rule.min}`);
            }
            if (rule.max !== undefined && value > rule.max) {
                throw new Error(`${path} must be at most ${rule.max}`);
            }
            
            if (rule.pattern && !rule.pattern.test(value)) {
                throw new Error(`${path} format is invalid`);
            }
            
            if (rule.values && !rule.values.includes(value)) {
                throw new Error(`${path} must be one of: ${rule.values.join(', ')}`);
            }
        }
    }

    notifyWatchers(section, key, value) {
        const watcherKey = `${section}.${key}`;
        if (this.watchers.has(watcherKey)) {
            const watchers = this.watchers.get(watcherKey);
            watchers.forEach(callback => {
                try {
                    callback(value, section, key);
                } catch (error) {
                    console.error('❌ Configuration watcher error:', error.message);
                }
            });
        }
    }

    // Feature Flag Methods
    isFeatureEnabled(featureName) {
        return this.featureFlags[featureName] === true;
    }

    enableFeature(featureName) {
        this.featureFlags[featureName] = true;
        console.log(`✅ Feature enabled: ${featureName}`);
    }

    disableFeature(featureName) {
        this.featureFlags[featureName] = false;
        console.log(`❌ Feature disabled: ${featureName}`);
    }

    getFeatureFlags() {
        return { ...this.featureFlags };
    }

    // Configuration Watchers
    watchConfiguration(section, key, callback) {
        const watcherKey = `${section}.${key}`;
        if (!this.watchers.has(watcherKey)) {
            this.watchers.set(watcherKey, []);
        }
        this.watchers.get(watcherKey).push(callback);
        
        console.log(`👀 Watching configuration: ${watcherKey}`);
    }

    unwatchConfiguration(section, key, callback) {
        const watcherKey = `${section}.${key}`;
        if (this.watchers.has(watcherKey)) {
            const watchers = this.watchers.get(watcherKey);
            const index = watchers.indexOf(callback);
            if (index > -1) {
                watchers.splice(index, 1);
            }
        }
    }

    // Public API Methods
    get(section, key = null) {
        if (key === null) {
            return this.config[section] || {};
        }
        return this.config[section]?.[key];
    }

    set(section, key, value) {
        return this.updateConfiguration(section, key, value);
    }

    getAll() {
        return { ...this.config };
    }

    getBotConfig() {
        return this.config.bot || {};
    }

    getWhatsAppConfig() {
        return this.config.whatsapp || {};
    }

    getSheetsConfig() {
        return this.config.sheets || {};
    }

    getMonitoringConfig() {
        return this.config.monitoring || {};
    }

    getPerformanceConfig() {
        return this.config.performance || {};
    }

    getSecurityConfig() {
        return this.config.security || {};
    }

    getShopConfig() {
        return this.config.shop || {};
    }

    // Utility Methods
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async reloadConfiguration() {
        try {
            await this.loadConfiguration();
            console.log('🔄 Configuration reloaded');
        } catch (error) {
            console.error('❌ Failed to reload configuration:', error.message);
        }
    }

    getConfigurationStatus() {
        return {
            configFile: this.configFile,
            configExists: this.fileExists(this.configFile),
            sections: Object.keys(this.config),
            featureFlags: Object.keys(this.featureFlags).filter(flag => this.featureFlags[flag]),
            watchers: Array.from(this.watchers.keys())
        };
    }
}

module.exports = ConfigManager;
