const DuplicatePreventionManager = require('./duplicate-prevention-manager');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced Duplicate Prevention System
 * 
 * This module provides additional safeguards and fallback mechanisms
 * to ensure no duplicate messages are sent to customers under any circumstances.
 */
class EnhancedDuplicatePrevention {
    constructor(options = {}) {
        this.duplicateManager = new DuplicatePreventionManager(options);
        this.fallbackMessages = new Map();
        this.emergencyBlockList = new Set();
        this.lastMessageTimestamps = new Map();
        this.consecutiveFailures = new Map();
        
        // Enhanced settings
        this.maxConsecutiveFailures = 3;
        this.emergencyCooldownMs = 30 * 60 * 1000; // 30 minutes
        this.fallbackMessageDelayMs = 10000; // 10 seconds
        
        // Initialize fallback messages
        this.initializeFallbackMessages();
    }

    /**
     * Initialize fallback messages for different scenarios
     */
    initializeFallbackMessages() {
        this.fallbackMessages.set('duplicate_blocked', {
            hindi: `🙏 क्षमा करें! आपको पहले से ही message भेजा जा चुका है। अगर कोई समस्या है तो कृपया हमसे संपर्क करें।\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`,
            english: `Sorry! We've already sent you a message. If you have any issues, please contact us.\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`
        });

        this.fallbackMessages.set('rate_limit_exceeded', {
            hindi: `🙏 आपको आज कई messages भेजे जा चुके हैं। कृपया कल फिर से check करें या हमसे direct contact करें।\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`,
            english: `We've sent you several messages today. Please check tomorrow or contact us directly.\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`
        });

        this.fallbackMessages.set('cooldown_active', {
            hindi: `🙏 कृपया कुछ minutes wait करें। आपको जल्द ही update मिलेगा।\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`,
            english: `Please wait a few minutes. You'll receive an update soon.\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`
        });

        this.fallbackMessages.set('system_error', {
            hindi: `🙏 System में कुछ technical issue है। कृपया हमसे direct contact करें।\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`,
            english: `There's a technical issue with our system. Please contact us directly.\n\n📞 Contact: 8824781960\n🏪 RS Tailor & Fabric`
        });
    }

    /**
     * Enhanced duplicate check with additional safeguards
     */
    async checkDuplicateWithFallback(customerPhone, orderId, messageType, messageContent, orderData = {}, sheetType = 'tailor') {
        try {
            // Check if customer is in emergency block list
            if (this.emergencyBlockList.has(customerPhone)) {
                return {
                    allowed: false,
                    reason: 'Customer in emergency block list',
                    duplicateType: 'EMERGENCY_BLOCK',
                    fallbackMessage: this.getFallbackMessage('system_error', 'hindi')
                };
            }

            // Check for consecutive failures
            const failureCount = this.consecutiveFailures.get(customerPhone) || 0;
            if (failureCount >= this.maxConsecutiveFailures) {
                this.emergencyBlockList.add(customerPhone);
                return {
                    allowed: false,
                    reason: 'Too many consecutive failures',
                    duplicateType: 'CONSECUTIVE_FAILURES',
                    fallbackMessage: this.getFallbackMessage('system_error', 'hindi')
                };
            }

            // Check for rapid-fire messages (additional safety)
            const lastMessageTime = this.lastMessageTimestamps.get(customerPhone);
            const now = Date.now();
            if (lastMessageTime && (now - lastMessageTime) < 5000) { // 5 seconds minimum
                return {
                    allowed: false,
                    reason: 'Rapid-fire message prevention',
                    duplicateType: 'RAPID_FIRE',
                    fallbackMessage: this.getFallbackMessage('cooldown_active', 'hindi')
                };
            }

            // Use the main duplicate prevention manager
            const result = await this.duplicateManager.checkDuplicate(
                customerPhone, orderId, messageType, messageContent, orderData, sheetType
            );

            // Add fallback message based on duplicate type
            if (!result.allowed) {
                result.fallbackMessage = this.getFallbackMessageForDuplicateType(result.duplicateType);
            }

            return result;

        } catch (error) {
            console.error('❌ Error in enhanced duplicate check:', error.message);
            return {
                allowed: false,
                reason: `System error: ${error.message}`,
                duplicateType: 'SYSTEM_ERROR',
                fallbackMessage: this.getFallbackMessage('system_error', 'hindi')
            };
        }
    }

    /**
     * Get appropriate fallback message for duplicate type
     */
    getFallbackMessageForDuplicateType(duplicateType) {
        switch (duplicateType) {
            case 'EXACT_MESSAGE_DUPLICATE':
            case 'CONTENT_DUPLICATE':
            case 'SIMILAR_MESSAGE':
                return this.getFallbackMessage('duplicate_blocked', 'hindi');
            
            case 'RATE_LIMIT':
                return this.getFallbackMessage('rate_limit_exceeded', 'hindi');
            
            case 'COOLDOWN':
            case 'RAPID_FIRE':
                return this.getFallbackMessage('cooldown_active', 'hindi');
            
            default:
                return this.getFallbackMessage('system_error', 'hindi');
        }
    }

    /**
     * Get fallback message by key and language
     */
    getFallbackMessage(key, language = 'hindi') {
        const fallback = this.fallbackMessages.get(key);
        return fallback ? fallback[language] || fallback.hindi : this.getFallbackMessage('system_error', language);
    }

    /**
     * Record message sent with enhanced tracking
     */
    async recordMessageSent(customerPhone, orderId, messageType, messageContent, orderData = {}, sheetType = 'tailor') {
        try {
            // Record in main duplicate manager
            await this.duplicateManager.recordMessageSent(
                customerPhone, orderId, messageType, messageContent, orderData, sheetType
            );

            // Update last message timestamp
            this.lastMessageTimestamps.set(customerPhone, Date.now());

            // Reset consecutive failures on successful send
            this.consecutiveFailures.delete(customerPhone);

            // Remove from emergency block list if present
            this.emergencyBlockList.delete(customerPhone);

            console.log(`✅ Enhanced tracking: Message recorded for ${customerPhone}`);

        } catch (error) {
            console.error('❌ Error recording message in enhanced system:', error.message);
        }
    }

    /**
     * Record message failure for tracking
     */
    recordMessageFailure(customerPhone, error) {
        const currentFailures = this.consecutiveFailures.get(customerPhone) || 0;
        this.consecutiveFailures.set(customerPhone, currentFailures + 1);
        
        console.log(`⚠️ Message failure recorded for ${customerPhone}: ${currentFailures + 1}/${this.maxConsecutiveFailures}`);
    }

    /**
     * Send fallback message if original was blocked
     */
    async sendFallbackMessage(whatsappClient, customerPhone, fallbackMessage, originalContext = {}) {
        try {
            if (!fallbackMessage) {
                console.log('⚠️ No fallback message provided');
                return { success: false, error: 'No fallback message' };
            }

            // Add delay before sending fallback
            await new Promise(resolve => setTimeout(resolve, this.fallbackMessageDelayMs));

            const jid = this.formatPhoneToJid(customerPhone);
            const result = await whatsappClient.sendMessage(jid, fallbackMessage, {
                orderId: `FALLBACK-${Date.now()}`,
                messageType: 'fallback',
                orderData: { ...originalContext, isFallback: true }
            });

            if (result.success) {
                console.log(`✅ Fallback message sent to ${customerPhone}`);
                return { success: true, messageId: result.messageId };
            } else {
                console.log(`❌ Fallback message failed for ${customerPhone}: ${result.error}`);
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error(`❌ Error sending fallback message to ${customerPhone}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enhanced message sending with comprehensive duplicate prevention
     */
    async sendMessageWithEnhancedPrevention(whatsappClient, customerPhone, orderId, messageType, messageContent, orderData = {}, sheetType = 'tailor') {
        try {
            // Check for duplicates with enhanced system
            const duplicateCheck = await this.checkDuplicateWithFallback(
                customerPhone, orderId, messageType, messageContent, orderData, sheetType
            );

            if (!duplicateCheck.allowed) {
                console.log(`🚫 Message blocked: ${duplicateCheck.reason}`);
                
                // Send fallback message if available
                if (duplicateCheck.fallbackMessage) {
                    const fallbackResult = await this.sendFallbackMessage(
                        whatsappClient, 
                        customerPhone, 
                        duplicateCheck.fallbackMessage,
                        { orderId, messageType, originalMessage: messageContent }
                    );
                    
                    return {
                        success: false,
                        blocked: true,
                        blockReason: duplicateCheck.reason,
                        duplicateType: duplicateCheck.duplicateType,
                        fallbackSent: fallbackResult.success,
                        fallbackError: fallbackResult.error
                    };
                }

                return {
                    success: false,
                    blocked: true,
                    blockReason: duplicateCheck.reason,
                    duplicateType: duplicateCheck.duplicateType
                };
            }

            // Send original message
            const jid = this.formatPhoneToJid(customerPhone);
            const result = await whatsappClient.sendMessage(jid, messageContent, {
                orderId,
                messageType,
                orderData,
                sheetType
            });

            if (result.success) {
                // Record successful send
                await this.recordMessageSent(customerPhone, orderId, messageType, messageContent, orderData, sheetType);
                return {
                    success: true,
                    messageId: result.messageId,
                    blocked: false
                };
            } else {
                // Record failure
                this.recordMessageFailure(customerPhone, result.error);
                return {
                    success: false,
                    error: result.error,
                    blocked: false
                };
            }

        } catch (error) {
            console.error(`❌ Error in enhanced message sending:`, error.message);
            this.recordMessageFailure(customerPhone, error.message);
            return {
                success: false,
                error: error.message,
                blocked: false
            };
        }
    }

    /**
     * Format phone number to JID
     */
    formatPhoneToJid(phone) {
        const normalizedPhone = this.duplicateManager.normalizePhoneNumber(phone);
        if (!normalizedPhone) {
            throw new Error(`Invalid phone number: ${phone}`);
        }
        return `${normalizedPhone}@s.whatsapp.net`;
    }

    /**
     * Get enhanced statistics
     */
    getEnhancedStatistics() {
        const baseStats = this.duplicateManager.getStatistics();
        return {
            ...baseStats,
            enhanced: {
                emergencyBlockedCustomers: this.emergencyBlockList.size,
                customersWithFailures: this.consecutiveFailures.size,
                totalFallbackMessages: this.fallbackMessages.size,
                lastMessageTimestamps: this.lastMessageTimestamps.size
            }
        };
    }

    /**
     * Clear emergency block list (for admin use)
     */
    clearEmergencyBlockList() {
        this.emergencyBlockList.clear();
        this.consecutiveFailures.clear();
        console.log('🧹 Emergency block list cleared');
    }

    /**
     * Add customer to emergency block list (for admin use)
     */
    addToEmergencyBlockList(customerPhone) {
        this.emergencyBlockList.add(customerPhone);
        console.log(`🚫 Added ${customerPhone} to emergency block list`);
    }

    /**
     * Remove customer from emergency block list (for admin use)
     */
    removeFromEmergencyBlockList(customerPhone) {
        this.emergencyBlockList.delete(customerPhone);
        this.consecutiveFailures.delete(customerPhone);
        console.log(`✅ Removed ${customerPhone} from emergency block list`);
    }

    /**
     * Cleanup old data
     */
    async performCleanup() {
        try {
            const now = Date.now();
            let cleaned = 0;

            // Clean up old timestamps (older than 24 hours)
            for (const [phone, timestamp] of this.lastMessageTimestamps.entries()) {
                if ((now - timestamp) > 24 * 60 * 60 * 1000) {
                    this.lastMessageTimestamps.delete(phone);
                    cleaned++;
                }
            }

            // Clean up old consecutive failures (older than 1 hour)
            for (const [phone, failures] of this.consecutiveFailures.entries()) {
                // Reset failures after 1 hour
                this.consecutiveFailures.delete(phone);
                cleaned++;
            }

            if (cleaned > 0) {
                console.log(`🧹 Enhanced cleanup: Removed ${cleaned} old records`);
            }

            // Call base cleanup
            await this.duplicateManager.performCleanup();

        } catch (error) {
            console.error('❌ Error in enhanced cleanup:', error.message);
        }
    }

    /**
     * Destroy and cleanup resources
     */
    destroy() {
        this.duplicateManager.destroy();
        this.emergencyBlockList.clear();
        this.consecutiveFailures.clear();
        this.lastMessageTimestamps.clear();
        console.log('🔄 Enhanced Duplicate Prevention destroyed');
    }
}

module.exports = EnhancedDuplicatePrevention;
