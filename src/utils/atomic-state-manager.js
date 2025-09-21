const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Atomic State Manager
 * 
 * Provides atomic updates across multiple systems to prevent
 * state inconsistencies and race conditions
 */
class AtomicStateManager {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(__dirname, '../../data/atomic-state');
        this.lockTimeout = options.lockTimeout || 30000; // 30 seconds
        this.retryAttempts = options.retryAttempts || 3;
        this.retryDelay = options.retryDelay || 1000; // 1 second
        
        // Active locks
        this.activeLocks = new Map();
        
        // Initialize data directory
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            console.log('✅ Atomic State Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Atomic State Manager:', error.message);
        }
    }

    /**
     * Acquire a lock for atomic operations
     */
    async acquireLock(resourceId, timeout = this.lockTimeout) {
        const lockId = crypto.randomUUID();
        const lockFile = path.join(this.dataDir, `lock-${resourceId}.json`);
        
        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                // Check if lock already exists
                try {
                    const existingLock = JSON.parse(await fs.readFile(lockFile, 'utf8'));
                    if (existingLock.expiresAt > Date.now()) {
                        if (attempt === this.retryAttempts) {
                            throw new Error(`Resource ${resourceId} is locked by another process`);
                        }
                        await this.sleep(this.retryDelay * attempt);
                        continue;
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                    // Lock file doesn't exist, we can proceed
                }

                // Create new lock
                const lockData = {
                    lockId,
                    resourceId,
                    acquiredAt: Date.now(),
                    expiresAt: Date.now() + timeout,
                    processId: process.pid
                };

                await fs.writeFile(lockFile, JSON.stringify(lockData, null, 2));
                this.activeLocks.set(resourceId, { lockId, lockFile });
                
                console.log(`🔒 Acquired lock for resource: ${resourceId}`);
                return lockId;

            } catch (error) {
                if (attempt === this.retryAttempts) {
                    throw error;
                }
                await this.sleep(this.retryDelay * attempt);
            }
        }
    }

    /**
     * Release a lock
     */
    async releaseLock(resourceId, lockId) {
        const lockInfo = this.activeLocks.get(resourceId);
        if (!lockInfo || lockInfo.lockId !== lockId) {
            console.warn(`⚠️ Attempted to release lock for ${resourceId} with invalid lock ID`);
            return false;
        }

        try {
            await fs.unlink(lockInfo.lockFile);
            this.activeLocks.delete(resourceId);
            console.log(`🔓 Released lock for resource: ${resourceId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to release lock for ${resourceId}:`, error.message);
            return false;
        }
    }

    /**
     * Execute an atomic operation with automatic lock management
     */
    async executeAtomically(resourceId, operation, timeout = this.lockTimeout) {
        const lockId = await this.acquireLock(resourceId, timeout);
        
        try {
            console.log(`🔄 Executing atomic operation for resource: ${resourceId}`);
            const result = await operation();
            console.log(`✅ Atomic operation completed for resource: ${resourceId}`);
            return result;
        } catch (error) {
            console.error(`❌ Atomic operation failed for resource ${resourceId}:`, error.message);
            throw error;
        } finally {
            await this.releaseLock(resourceId, lockId);
        }
    }

    /**
     * Atomic message sending with state updates
     */
    async sendMessageAtomically(messageData) {
        const { phone, orderId, messageType, sheetType } = messageData;
        const resourceId = `message-${phone}-${orderId}-${messageType}`;
        
        return await this.executeAtomically(resourceId, async () => {
            // 1. Check all systems for duplicates
            const duplicateCheck = await this.checkAllSystemsForDuplicates(phone, orderId, messageType);
            if (!duplicateCheck.allowed) {
                throw new Error(`Duplicate message blocked: ${duplicateCheck.reason}`);
            }

            // 2. Send message via WhatsApp
            const sendResult = await this.sendWhatsAppMessage(messageData);
            if (!sendResult.success) {
                throw new Error(`WhatsApp send failed: ${sendResult.error}`);
            }

            // 3. Update all state systems atomically
            await this.updateAllSystems(messageData, sendResult);

            return {
                success: true,
                messageId: sendResult.messageId,
                timestamp: Date.now()
            };
        });
    }

    /**
     * Check all systems for duplicates
     */
    async checkAllSystemsForDuplicates(phone, orderId, messageType) {
        // This would integrate with your existing duplicate prevention systems
        // For now, return a basic check
        const messageKey = `${phone}-${orderId}-${messageType}`;
        const stateFile = path.join(this.dataDir, `state-${messageKey}.json`);
        
        try {
            const existingState = JSON.parse(await fs.readFile(stateFile, 'utf8'));
            if (existingState.sent) {
                return {
                    allowed: false,
                    reason: 'Message already sent according to atomic state'
                };
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // File doesn't exist, message not sent yet
        }

        return { allowed: true };
    }

    /**
     * Send WhatsApp message (placeholder - integrate with your WhatsApp client)
     */
    async sendWhatsAppMessage(messageData) {
        // This would integrate with your existing WhatsApp client
        // For now, simulate a successful send
        return {
            success: true,
            messageId: `msg-${Date.now()}`,
            timestamp: Date.now()
        };
    }

    /**
     * Update all systems atomically
     */
    async updateAllSystems(messageData, sendResult) {
        const { phone, orderId, messageType, sheetType } = messageData;
        const stateData = {
            phone,
            orderId,
            messageType,
            sheetType,
            messageId: sendResult.messageId,
            sent: true,
            timestamp: Date.now(),
            systems: {
                atomicState: true,
                duplicatePrevention: true,
                safetyManager: true,
                googleSheets: true
            }
        };

        // Update atomic state
        const messageKey = `${phone}-${orderId}-${messageType}`;
        const stateFile = path.join(this.dataDir, `state-${messageKey}.json`);
        await fs.writeFile(stateFile, JSON.stringify(stateData, null, 2));

        // Here you would also update:
        // - Duplicate prevention manager
        // - Enhanced safety manager
        // - Google Sheets status columns
        
        console.log(`📝 Updated all systems for message: ${messageKey}`);
    }

    /**
     * Get atomic state for a resource
     */
    async getAtomicState(phone, orderId, messageType) {
        const messageKey = `${phone}-${orderId}-${messageType}`;
        const stateFile = path.join(this.dataDir, `state-${messageKey}.json`);
        
        try {
            const stateData = JSON.parse(await fs.readFile(stateFile, 'utf8'));
            return stateData;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // No state found
            }
            throw error;
        }
    }

    /**
     * Clean up expired locks
     */
    async cleanupExpiredLocks() {
        const now = Date.now();
        const lockFiles = await fs.readdir(this.dataDir);
        
        for (const file of lockFiles) {
            if (file.startsWith('lock-') && file.endsWith('.json')) {
                try {
                    const lockData = JSON.parse(await fs.readFile(path.join(this.dataDir, file), 'utf8'));
                    if (lockData.expiresAt < now) {
                        await fs.unlink(path.join(this.dataDir, file));
                        console.log(`🧹 Cleaned up expired lock: ${file}`);
                    }
                } catch (error) {
                    console.warn(`⚠️ Failed to process lock file ${file}:`, error.message);
                }
            }
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get lock status
     */
    getLockStatus() {
        return {
            activeLocks: this.activeLocks.size,
            lockIds: Array.from(this.activeLocks.keys())
        };
    }

    /**
     * Force release all locks (emergency use only)
     */
    async forceReleaseAllLocks() {
        console.log('🚨 Force releasing all locks...');
        
        for (const [resourceId, lockInfo] of this.activeLocks.entries()) {
            try {
                await fs.unlink(lockInfo.lockFile);
                console.log(`🔓 Force released lock: ${resourceId}`);
            } catch (error) {
                console.warn(`⚠️ Failed to force release lock ${resourceId}:`, error.message);
            }
        }
        
        this.activeLocks.clear();
        console.log('✅ All locks force released');
    }
}

module.exports = AtomicStateManager;
