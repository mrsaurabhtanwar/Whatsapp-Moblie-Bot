const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced Logging System for WhatsApp Bot Safety
 * 
 * Provides comprehensive logging with:
 * - Multiple log levels (ERROR, WARN, INFO, DEBUG)
 * - Structured JSON logging
 * - File rotation and cleanup
 * - Real-time monitoring capabilities
 * - Safety event tracking
 */
class EnhancedLogger {
    constructor(options = {}) {
        this.logDir = options.logDir || path.join(__dirname, 'logs');
        this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
        this.maxFiles = options.maxFiles || 10;
        this.logLevel = options.logLevel || 'INFO';
        
        // Log levels (higher number = more verbose)
        this.levels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        
        this.currentLogFile = null;
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            await this.rotateLogFile();
            console.log('📝 Enhanced Logger initialized');
        } catch (error) {
            console.error('❌ Failed to initialize logger:', error.message);
        }
    }

    async rotateLogFile() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentLogFile = path.join(this.logDir, `bot-${timestamp}.log`);
        
        // Clean up old log files
        await this.cleanupOldLogs();
    }

    async cleanupOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files
                .filter(file => file.startsWith('bot-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    stat: null
                }));

            // Get file stats
            for (const file of logFiles) {
                try {
                    file.stat = await fs.stat(file.path);
                } catch (error) {
                    // File might have been deleted
                    continue;
                }
            }

            // Sort by creation time (oldest first)
            logFiles.sort((a, b) => {
                if (!a.stat || !b.stat) return 0;
                return a.stat.birthtime - b.stat.birthtime;
            });

            // Remove excess files
            if (logFiles.length > this.maxFiles) {
                const filesToDelete = logFiles.slice(0, logFiles.length - this.maxFiles);
                for (const file of filesToDelete) {
                    try {
                        await fs.unlink(file.path);
                        console.log(`🗑️ Deleted old log file: ${file.name}`);
                    } catch (error) {
                        console.warn(`⚠️ Failed to delete log file ${file.name}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Log cleanup failed:', error.message);
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    async writeLog(level, message, data = null, context = {}) {
        if (!this.shouldLog(level)) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            context: {
                pid: process.pid,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                ...context
            }
        };

        const logLine = JSON.stringify(logEntry) + '\n';

        try {
            // Write to file
            if (this.currentLogFile) {
                await fs.appendFile(this.currentLogFile, logLine);
                
                // Check file size and rotate if needed
                const stats = await fs.stat(this.currentLogFile);
                if (stats.size > this.maxFileSize) {
                    await this.rotateLogFile();
                }
            }

            // Also log to console with formatting
            const consoleMessage = `[${new Date().toLocaleTimeString()}] ${level}: ${message}`;
            switch (level) {
                case 'ERROR':
                    console.error(`❌ ${consoleMessage}`, data ? data : '');
                    break;
                case 'WARN':
                    console.warn(`⚠️ ${consoleMessage}`, data ? data : '');
                    break;
                case 'INFO':
                    console.log(`ℹ️ ${consoleMessage}`, data ? data : '');
                    break;
                case 'DEBUG':
                    console.log(`🔍 ${consoleMessage}`, data ? data : '');
                    break;
                default:
                    console.log(consoleMessage, data ? data : '');
            }

        } catch (error) {
            console.error('❌ Failed to write log:', error.message);
        }
    }

    error(message, data = null, context = {}) {
        return this.writeLog('ERROR', message, data, context);
    }

    warn(message, data = null, context = {}) {
        return this.writeLog('WARN', message, data, context);
    }

    info(message, data = null, context = {}) {
        return this.writeLog('INFO', message, data, context);
    }

    debug(message, data = null, context = {}) {
        return this.writeLog('DEBUG', message, data, context);
    }

    // Specialized logging methods for safety events
    async logSafetyEvent(eventType, phone, orderId, messageType, result, details = {}) {
        const safetyData = {
            eventType,
            phone: phone ? phone.substring(0, 3) + '****' + phone.substring(phone.length - 3) : 'N/A', // Masked phone
            orderId,
            messageType,
            result,
            details,
            timestamp: Date.now()
        };

        await this.info(`Safety Event: ${eventType}`, safetyData, { category: 'SAFETY' });
    }

    async logMessageAttempt(phone, orderId, messageType, allowed, reason, duration = 0) {
        const messageData = {
            phone: phone ? phone.substring(0, 3) + '****' + phone.substring(phone.length - 3) : 'N/A',
            orderId,
            messageType,
            allowed,
            reason,
            duration,
            timestamp: Date.now()
        };

        const level = allowed ? 'INFO' : 'WARN';
        const status = allowed ? 'ALLOWED' : 'BLOCKED';
        
        await this.writeLog(level, `Message ${status}: ${messageType} for ${orderId}`, messageData, { 
            category: 'MESSAGE_ATTEMPT' 
        });
    }

    async logSystemEvent(eventType, description, data = {}) {
        const systemData = {
            eventType,
            description,
            data,
            timestamp: Date.now(),
            system: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };

        await this.info(`System Event: ${eventType}`, systemData, { category: 'SYSTEM' });
    }

    async logStartupEvent(phase, status, duration = 0, details = {}) {
        const startupData = {
            phase,
            status,
            duration,
            details,
            timestamp: Date.now()
        };

        const level = status === 'SUCCESS' ? 'INFO' : 'ERROR';
        await this.writeLog(level, `Startup ${phase}: ${status}`, startupData, { category: 'STARTUP' });
    }

    async logGracePeriodEvent(action, remainingMs = 0, details = {}) {
        const gracePeriodData = {
            action,
            remainingMs,
            remainingSeconds: Math.ceil(remainingMs / 1000),
            details,
            timestamp: Date.now()
        };

        await this.info(`Grace Period: ${action}`, gracePeriodData, { category: 'GRACE_PERIOD' });
    }

    async logSheetOperation(operation, sheetType, orderId, success, details = {}) {
        const sheetData = {
            operation,
            sheetType,
            orderId,
            success,
            details,
            timestamp: Date.now()
        };

        const level = success ? 'INFO' : 'ERROR';
        await this.writeLog(level, `Sheet ${operation}: ${sheetType}/${orderId}`, sheetData, { 
            category: 'SHEET_OPERATION' 
        });
    }

    // Get recent logs for dashboard/monitoring
    async getRecentLogs(count = 100, level = null, category = null) {
        try {
            if (!this.currentLogFile) {
                return [];
            }

            const content = await fs.readFile(this.currentLogFile, 'utf8');
            const lines = content.trim().split('\n').filter(line => line.trim());
            
            let logs = lines.map(line => {
                try {
                    return JSON.parse(line);
                } catch (error) {
                    return null;
                }
            }).filter(log => log !== null);

            // Filter by level if specified
            if (level) {
                logs = logs.filter(log => log.level === level);
            }

            // Filter by category if specified
            if (category) {
                logs = logs.filter(log => log.context && log.context.category === category);
            }

            // Return most recent logs
            return logs.slice(-count).reverse();

        } catch (error) {
            console.error('❌ Failed to get recent logs:', error.message);
            return [];
        }
    }

    // Get log statistics
    async getLogStatistics() {
        try {
            const recentLogs = await this.getRecentLogs(1000);
            
            const stats = {
                total: recentLogs.length,
                byLevel: {},
                byCategory: {},
                recentErrors: recentLogs.filter(log => log.level === 'ERROR').length,
                recentWarnings: recentLogs.filter(log => log.level === 'WARN').length,
                lastLogTime: recentLogs.length > 0 ? recentLogs[0].timestamp : null
            };

            // Count by level
            for (const log of recentLogs) {
                stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            }

            // Count by category
            for (const log of recentLogs) {
                const category = log.context?.category || 'UNKNOWN';
                stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
            }

            return stats;

        } catch (error) {
            console.error('❌ Failed to get log statistics:', error.message);
            return {
                total: 0,
                byLevel: {},
                byCategory: {},
                recentErrors: 0,
                recentWarnings: 0,
                lastLogTime: null
            };
        }
    }
}

module.exports = EnhancedLogger;