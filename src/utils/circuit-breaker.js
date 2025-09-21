/**
 * Circuit Breaker Pattern Implementation
 * Provides failure handling for external API calls like WhatsApp
 * 
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing)
 */
class CircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = options.failureThreshold || 5;
        this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
        this.monitoringPeriod = options.monitoringPeriod || 120000; // 2 minutes
        
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.lastFailureTime = null;
        this.successCount = 0;
        
        // Statistics
        this.stats = {
            totalRequests: 0,
            totalFailures: 0,
            circuitOpenEvents: 0
        };
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute(fn) {
        this.stats.totalRequests++;
        
        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.state = 'HALF_OPEN';
                console.log('🔄 Circuit breaker moving to HALF_OPEN state');
            } else {
                throw new Error('Circuit breaker is OPEN - rejecting request');
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure(error);
            throw error;
        }
    }

    /**
     * Handle successful execution
     */
    onSuccess() {
        this.failureCount = 0;
        this.successCount++;
        
        if (this.state === 'HALF_OPEN') {
            this.state = 'CLOSED';
            console.log('✅ Circuit breaker reset to CLOSED state');
        }
    }

    /**
     * Handle failed execution
     */
    onFailure(error) {
        this.failureCount++;
        this.stats.totalFailures++;
        this.lastFailureTime = Date.now();
        
        console.log(`⚠️ Circuit breaker failure ${this.failureCount}/${this.failureThreshold}: ${error.message}`);
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.stats.circuitOpenEvents++;
            console.log(`🚨 Circuit breaker OPENED after ${this.failureCount} failures`);
        }
    }

    /**
     * Check if we should attempt to reset the circuit
     */
    shouldAttemptReset() {
        return Date.now() - this.lastFailureTime > this.recoveryTimeout;
    }

    /**
     * Get current circuit breaker status
     */
    getStatus() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            stats: this.stats,
            lastFailureTime: this.lastFailureTime
        };
    }

    /**
     * Manually reset the circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        console.log('🔄 Circuit breaker manually reset');
    }

    /**
     * Check if a specific error should trip the circuit
     */
    isRetriableError(error) {
        // WhatsApp specific error classification
        const retriableErrors = [
            'Connection timeout',
            'Network error', 
            'Temporary failure',
            'Rate limit exceeded',
            'Server error'
        ];
        
        return retriableErrors.some(retriable => 
            error.message.toLowerCase().includes(retriable.toLowerCase())
        );
    }
}

module.exports = CircuitBreaker;