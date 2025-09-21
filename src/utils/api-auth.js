/**
 * API Authentication Middleware
 * 
 * Provides authentication and rate limiting for admin endpoints
 * while preserving WhatsApp authentication
 */
class APIAuth {
    constructor() {
        this.apiSecretKey = process.env.API_SECRET_KEY;
        this.jwtSecret = process.env.JWT_SECRET;
        this.rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'); // 15 minutes
        this.rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
        
        // Simple in-memory rate limiting (for production, use Redis)
        this.rateLimitStore = new Map();
        
        // Clean up rate limit store periodically
        setInterval(() => {
            this.cleanupRateLimitStore();
        }, this.rateLimitWindow);
    }

    /**
     * Verify API key from request headers
     */
    verifyAPIKey(req, res, next) {
        // Skip authentication if no API secret is configured (development mode)
        if (!this.apiSecretKey) {
            console.log('⚠️ API authentication disabled - no API_SECRET_KEY configured');
            return next();
        }

        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            return res.status(401).json({ 
                success: false, 
                error: 'API key required',
                message: 'Include X-API-Key header or Authorization Bearer token'
            });
        }

        if (apiKey !== this.apiSecretKey) {
            console.log(`❌ Invalid API key attempt from ${req.ip}`);
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid API key' 
            });
        }

        console.log(`✅ Valid API key from ${req.ip}`);
        next();
    }

    /**
     * Rate limiting middleware
     */
    rateLimiter(req, res, next) {
        const clientId = req.ip || 'unknown';
        const now = Date.now();
        const windowStart = now - this.rateLimitWindow;

        // Get or create client record
        if (!this.rateLimitStore.has(clientId)) {
            this.rateLimitStore.set(clientId, { requests: [], firstRequest: now });
        }

        const clientData = this.rateLimitStore.get(clientId);
        
        // Remove old requests outside the window
        clientData.requests = clientData.requests.filter(timestamp => timestamp > windowStart);
        
        // Check if client exceeded limit
        if (clientData.requests.length >= this.rateLimitMaxRequests) {
            console.log(`🚫 Rate limit exceeded for ${clientId}`);
            return res.status(429).json({
                success: false,
                error: 'Rate limit exceeded',
                message: `Maximum ${this.rateLimitMaxRequests} requests per ${this.rateLimitWindow / 1000} seconds`,
                retryAfter: Math.ceil((clientData.requests[0] + this.rateLimitWindow - now) / 1000)
            });
        }

        // Add current request
        clientData.requests.push(now);
        this.rateLimitStore.set(clientId, clientData);

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': this.rateLimitMaxRequests,
            'X-RateLimit-Remaining': Math.max(0, this.rateLimitMaxRequests - clientData.requests.length),
            'X-RateLimit-Reset': new Date(windowStart + this.rateLimitWindow).toISOString()
        });

        next();
    }

    /**
     * Admin-only endpoint protection
     */
    requireAdmin(req, res, next) {
        // Check if request is from admin phone (for WhatsApp commands)
        const adminPhones = [
            process.env.WHATSAPP_ADMIN_PHONE,
            process.env.WHATSAPP_BROTHER_PHONE,
            process.env.WHATSAPP_ADMIN_PHONE_2
        ].filter(phone => phone);

        // For API requests, require API key
        if (req.headers['content-type']?.includes('application/json')) {
            return this.verifyAPIKey(req, res, next);
        }

        // For WhatsApp messages, check if from admin phone
        const senderPhone = req.body?.sender || req.query?.sender;
        if (senderPhone && adminPhones.includes(senderPhone.replace('@s.whatsapp.net', ''))) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'Admin access required',
            message: 'This endpoint requires admin privileges'
        });
    }

    /**
     * Clean up old rate limit entries
     */
    cleanupRateLimitStore() {
        const now = Date.now();
        const windowStart = now - this.rateLimitWindow;

        for (const [clientId, clientData] of this.rateLimitStore.entries()) {
            clientData.requests = clientData.requests.filter(timestamp => timestamp > windowStart);
            
            if (clientData.requests.length === 0) {
                this.rateLimitStore.delete(clientId);
            }
        }
    }

    /**
     * Get rate limit status for a client
     */
    getRateLimitStatus(clientId) {
        if (!this.rateLimitStore.has(clientId)) {
            return {
                remaining: this.rateLimitMaxRequests,
                resetTime: new Date(Date.now() + this.rateLimitWindow).toISOString(),
                limit: this.rateLimitMaxRequests
            };
        }

        const clientData = this.rateLimitStore.get(clientId);
        const now = Date.now();
        const windowStart = now - this.rateLimitWindow;
        const validRequests = clientData.requests.filter(timestamp => timestamp > windowStart);

        return {
            remaining: Math.max(0, this.rateLimitMaxRequests - validRequests.length),
            resetTime: new Date(windowStart + this.rateLimitWindow).toISOString(),
            limit: this.rateLimitMaxRequests,
            used: validRequests.length
        };
    }

    /**
     * Generate a secure API key (for setup)
     */
    static generateAPIKey() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Validate API key format
     */
    static validateAPIKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return false;
        }
        
        // API key should be 64 characters (32 bytes in hex)
        return apiKey.length === 64 && /^[a-f0-9]+$/i.test(apiKey);
    }

    /**
     * Setup instructions for API authentication
     */
    getSetupInstructions() {
        return {
            message: 'To enable API authentication:',
            steps: [
                '1. Generate an API key:',
                `   API_KEY="${APIAuth.generateAPIKey()}"`,
                '2. Add to your .env file:',
                '   API_SECRET_KEY=your-generated-key-here',
                '3. Restart the bot',
                '4. Use the key in API requests:',
                '   X-API-Key: your-generated-key-here',
                '   OR',
                '   Authorization: Bearer your-generated-key-here'
            ],
            security_note: 'Keep your API key secure and never commit it to version control.'
        };
    }
}

module.exports = APIAuth;
