/**
 * Developer Configuration
 * 
 * This file contains developer-specific settings including phone number whitelist
 * for bypassing safety limits during testing and development.
 */

class DeveloperConfig {
    constructor() {
        // Developer phone numbers that bypass all safety limits
        this.developerWhitelist = [
            '917375938371',  // Developer phone 1
            '919166758467',  // Developer phone 2
            '916375623182'   // Developer phone 3
        ];
        
        // Developer settings
        this.settings = {
            // Bypass startup grace period for developer phones
            bypassStartupDelay: true,
            
            // Bypass business hours check for developer phones
            bypassBusinessHours: true,
            
            // Bypass daily/hourly limits for developer phones
            bypassRateLimits: true,
            
            // Bypass duplicate prevention for developer phones
            bypassDuplicatePrevention: true,
            
            // Bypass message type rules for developer phones
            bypassMessageRules: true,
            
            // Enable detailed logging for developer phones
            enableDetailedLogging: true
        };
        
        console.log('🔧 Developer Configuration initialized');
        console.log(`📱 Developer phones whitelisted: ${this.developerWhitelist.join(', ')}`);
    }
    
    /**
     * Check if a phone number is in the developer whitelist
     * @param {string} phone - Phone number to check
     * @returns {boolean} - True if phone is whitelisted
     */
    isDeveloperPhone(phone) {
        if (!phone) return false;
        
        // Normalize phone number (remove any formatting)
        const normalizedPhone = phone.replace(/\D/g, '');
        
        // Check if normalized phone is in whitelist
        const isWhitelisted = this.developerWhitelist.includes(normalizedPhone);
        
        if (isWhitelisted) {
            console.log(`🔓 Developer phone detected: ${normalizedPhone} - bypassing safety limits`);
        }
        
        return isWhitelisted;
    }
    
    /**
     * Get developer setting
     * @param {string} setting - Setting name
     * @returns {boolean} - Setting value
     */
    getSetting(setting) {
        return this.settings[setting] || false;
    }
    
    /**
     * Add a phone number to the developer whitelist
     * @param {string} phone - Phone number to add
     */
    addDeveloperPhone(phone) {
        const normalizedPhone = phone.replace(/\D/g, '');
        if (!this.developerWhitelist.includes(normalizedPhone)) {
            this.developerWhitelist.push(normalizedPhone);
            console.log(`📱 Added developer phone: ${normalizedPhone}`);
        }
    }
    
    /**
     * Remove a phone number from the developer whitelist
     * @param {string} phone - Phone number to remove
     */
    removeDeveloperPhone(phone) {
        const normalizedPhone = phone.replace(/\D/g, '');
        const index = this.developerWhitelist.indexOf(normalizedPhone);
        if (index > -1) {
            this.developerWhitelist.splice(index, 1);
            console.log(`📱 Removed developer phone: ${normalizedPhone}`);
        }
    }
    
    /**
     * Get all developer phone numbers
     * @returns {Array} - Array of developer phone numbers
     */
    getDeveloperPhones() {
        return [...this.developerWhitelist];
    }
    
    /**
     * Display current configuration
     */
    displayConfig() {
        console.log('\n🔧 Developer Configuration:');
        console.log('========================');
        console.log(`📱 Developer Phones: ${this.developerWhitelist.join(', ')}`);
        console.log(`⏰ Bypass Startup Delay: ${this.settings.bypassStartupDelay}`);
        console.log(`🕐 Bypass Business Hours: ${this.settings.bypassBusinessHours}`);
        console.log(`📊 Bypass Rate Limits: ${this.settings.bypassRateLimits}`);
        console.log(`🔄 Bypass Duplicate Prevention: ${this.settings.bypassDuplicatePrevention}`);
        console.log(`📝 Bypass Message Rules: ${this.settings.bypassMessageRules}`);
        console.log(`📋 Enable Detailed Logging: ${this.settings.enableDetailedLogging}`);
        console.log('========================\n');
    }
}

module.exports = DeveloperConfig;
