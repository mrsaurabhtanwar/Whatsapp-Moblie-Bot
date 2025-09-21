/**
 * PII (Personally Identifiable Information) Masking Utility
 * 
 * This utility masks sensitive data in logs to prevent PII exposure
 * while maintaining debugging capabilities
 */
class PIIMasker {
    constructor() {
        this.maskingEnabled = process.env.LOG_PII_MASKING !== 'false';
    }

    /**
     * Mask phone number - show only last 4 digits
     */
    static maskPhone(phone) {
        if (!phone || typeof phone !== 'string') return '****';
        
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        
        if (digits.length < 4) return '****';
        
        // Show last 4 digits, mask the rest
        const masked = '*'.repeat(Math.max(0, digits.length - 4)) + digits.slice(-4);
        
        // Add country code indicator if present
        if (digits.length > 10) {
            return `+${masked}`;
        }
        
        return masked;
    }

    /**
     * Mask order ID - show first 3 and last 3 characters
     */
    static maskOrderId(orderId) {
        if (!orderId || typeof orderId !== 'string') return '***';
        
        if (orderId.length <= 6) {
            return '*'.repeat(orderId.length);
        }
        
        return orderId.slice(0, 3) + '*'.repeat(orderId.length - 6) + orderId.slice(-3);
    }

    /**
     * Mask customer name - show first name only
     */
    static maskCustomerName(name) {
        if (!name || typeof name !== 'string') return 'Customer';
        
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].charAt(0) + '*'.repeat(Math.max(1, parts[0].length - 1));
        }
        
        // Show first name, mask last name
        return parts[0] + ' ' + '*'.repeat(parts[parts.length - 1].length);
    }

    /**
     * Mask email address - show domain only
     */
    static maskEmail(email) {
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return '***@***.***';
        }
        
        const [localPart, domain] = email.split('@');
        const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(1, localPart.length - 1));
        
        return `${maskedLocal}@${domain}`;
    }

    /**
     * Mask amount - show only first and last digit
     */
    static maskAmount(amount) {
        if (!amount) return '***';
        
        const amountStr = String(amount).replace(/[^\d.]/g, '');
        if (amountStr.length <= 2) return '***';
        
        return amountStr.charAt(0) + '*'.repeat(amountStr.length - 2) + amountStr.slice(-1);
    }

    /**
     * Sanitize object for logging - masks all PII fields
     */
    static sanitizeForLogging(data) {
        if (!data || typeof data !== 'object') return data;
        
        const sanitized = { ...data };
        
        // Common PII field mappings
        const piiFields = {
            phone: 'maskPhone',
            'contact_info': 'maskPhone',
            'contact_number': 'maskPhone',
            'customer_phone': 'maskPhone',
            'phone_number': 'maskPhone',
            'formatted_phone': 'maskPhone',
            
            'customer_name': 'maskCustomerName',
            'name': 'maskCustomerName',
            'client_name': 'maskCustomerName',
            
            'order_id': 'maskOrderId',
            'master_order_id': 'maskOrderId',
            'order_number': 'maskOrderId',
            
            'email': 'maskEmail',
            'customer_email': 'maskEmail',
            
            'total_amount': 'maskAmount',
            'advance_amount': 'maskAmount',
            'remaining_amount': 'maskAmount',
            'amount': 'maskAmount'
        };
        
        // Apply masking to PII fields
        for (const [field, maskFunction] of Object.entries(piiFields)) {
            if (sanitized[field]) {
                sanitized[field] = PIIMasker[maskFunction](sanitized[field]);
            }
        }
        
        // Recursively sanitize nested objects
        for (const [key, value] of Object.entries(sanitized)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                sanitized[key] = PIIMasker.sanitizeForLogging(value);
            }
        }
        
        return sanitized;
    }

    /**
     * Create a safe logger that automatically masks PII
     */
    static createSafeLogger(originalLogger) {
        return {
            info: (message, data = null) => {
                const sanitizedData = data ? PIIMasker.sanitizeForLogging(data) : null;
                return originalLogger.info(message, sanitizedData);
            },
            warn: (message, data = null) => {
                const sanitizedData = data ? PIIMasker.sanitizeForLogging(data) : null;
                return originalLogger.warn(message, sanitizedData);
            },
            error: (message, data = null) => {
                const sanitizedData = data ? PIIMasker.sanitizeForLogging(data) : null;
                return originalLogger.error(message, sanitizedData);
            },
            debug: (message, data = null) => {
                const sanitizedData = data ? PIIMasker.sanitizeForLogging(data) : null;
                return originalLogger.debug(message, sanitizedData);
            }
        };
    }

    /**
     * Mask phone number in console.log statements
     */
    static maskConsoleLog(phone) {
        if (!this.maskingEnabled) return phone;
        return PIIMasker.maskPhone(phone);
    }

    /**
     * Create a masked message for logging
     */
    static createMaskedMessage(originalMessage, replacements = {}) {
        let maskedMessage = originalMessage;
        
        // Replace phone numbers
        maskedMessage = maskedMessage.replace(/(\+?91)?[\d]{10,}/g, (match) => {
            return PIIMasker.maskPhone(match);
        });
        
        // Replace order IDs (common patterns)
        maskedMessage = maskedMessage.replace(/#[\w\d-]+/g, (match) => {
            return '#' + PIIMasker.maskOrderId(match.slice(1));
        });
        
        // Apply custom replacements
        for (const [original, replacement] of Object.entries(replacements)) {
            maskedMessage = maskedMessage.replace(new RegExp(original, 'g'), replacement);
        }
        
        return maskedMessage;
    }
}

module.exports = PIIMasker;
