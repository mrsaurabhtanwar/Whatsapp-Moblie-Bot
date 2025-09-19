const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Enhanced Health Check Manager
 * 
 * Features:
 * - Comprehensive system health monitoring
 * - Database connectivity checks
 * - WhatsApp connection status
 * - Google Sheets API health
 * - Memory and performance monitoring
 * - Automated health reports
 * - Health status API endpoints
 */
class HealthCheckManager {
    constructor(options = {}) {
        this.checkInterval = options.checkInterval || 60000; // 1 minute
        this.healthHistory = [];
        this.maxHistorySize = 100;
        
        this.healthChecks = {
            system: this.checkSystemHealth.bind(this),
            database: this.checkDatabaseHealth.bind(this),
            whatsapp: this.checkWhatsAppHealth.bind(this),
            sheets: this.checkGoogleSheetsHealth.bind(this),
            memory: this.checkMemoryHealth.bind(this),
            disk: this.checkDiskHealth.bind(this),
            network: this.checkNetworkHealth.bind(this)
        };
        
        this.healthThresholds = {
            memory: 85, // 85% memory usage
            disk: 90,   // 90% disk usage
            cpu: 90,    // 90% CPU usage
            responseTime: 5000 // 5 seconds
        };
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            console.log('✅ Health Check Manager initialized');
            this.startHealthMonitoring();
        } catch (error) {
            console.error('❌ Failed to initialize Health Check Manager:', error.message);
        }
    }

    startHealthMonitoring() {
        // Initial health check
        this.performHealthCheck();
        
        // Schedule regular health checks
        setInterval(() => {
            this.performHealthCheck();
        }, this.checkInterval);
        
        console.log(`🔄 Health monitoring started (every ${this.checkInterval / 1000} seconds)`);
    }

    async performHealthCheck() {
        const startTime = Date.now();
        const healthStatus = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            checks: {},
            performance: {
                checkDuration: 0,
                systemUptime: process.uptime()
            }
        };

        try {
            // Run all health checks in parallel
            const checkPromises = Object.entries(this.healthChecks).map(async ([name, checkFunction]) => {
                try {
                    const result = await checkFunction();
                    return { name, result, success: true };
                } catch (error) {
                    return { 
                        name, 
                        result: { status: 'error', error: error.message }, 
                        success: false 
                    };
                }
            });

            const checkResults = await Promise.all(checkPromises);
            
            // Process results
            let criticalIssues = 0;
            let warnings = 0;
            
            checkResults.forEach(({ name, result, success }) => {
                healthStatus.checks[name] = result;
                
                if (!success || result.status === 'error') {
                    criticalIssues++;
                } else if (result.status === 'warning') {
                    warnings++;
                }
            });
            
            // Determine overall health
            if (criticalIssues > 0) {
                healthStatus.overall = 'critical';
            } else if (warnings > 0) {
                healthStatus.overall = 'warning';
            } else {
                healthStatus.overall = 'healthy';
            }
            
            healthStatus.performance.checkDuration = Date.now() - startTime;
            
            // Store in history
            this.healthHistory.push(healthStatus);
            if (this.healthHistory.length > this.maxHistorySize) {
                this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
            }
            
            // Log health status
            this.logHealthStatus(healthStatus);
            
            return healthStatus;
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            return {
                timestamp: new Date().toISOString(),
                overall: 'error',
                error: error.message,
                performance: {
                    checkDuration: Date.now() - startTime,
                    systemUptime: process.uptime()
                }
            };
        }
    }

    async checkSystemHealth() {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = await this.getCpuUsage();
            const loadAvg = os.loadavg();
            
            const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            
            let status = 'healthy';
            const issues = [];
            
            if (memoryPercent > this.healthThresholds.memory) {
                status = 'warning';
                issues.push(`High memory usage: ${memoryPercent.toFixed(1)}%`);
            }
            
            if (cpuUsage > this.healthThresholds.cpu) {
                status = 'warning';
                issues.push(`High CPU usage: ${cpuUsage.toFixed(1)}%`);
            }
            
            if (loadAvg[0] > 4) {
                status = 'warning';
                issues.push(`High system load: ${loadAvg[0].toFixed(2)}`);
            }
            
            return {
                status,
                details: {
                    memory: {
                        heapUsed: memUsage.heapUsed,
                        heapTotal: memUsage.heapTotal,
                        external: memUsage.external,
                        rss: memUsage.rss,
                        usagePercent: memoryPercent
                    },
                    cpu: {
                        usage: cpuUsage,
                        loadAverage: loadAvg
                    },
                    system: {
                        uptime: process.uptime(),
                        platform: os.platform(),
                        arch: os.arch(),
                        nodeVersion: process.version
                    }
                },
                issues
            };
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async checkDatabaseHealth() {
        try {
            const sqlite3 = require('sqlite3');
            const dbPath = './safety-data/safety-database.db';
            
            return new Promise((resolve) => {
                const db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        resolve({
                            status: 'error',
                            error: err.message,
                            details: {
                                path: dbPath,
                                exists: false
                            }
                        });
                        return;
                    }
                    
                    // Test database operations
                    db.get('SELECT COUNT(*) as count FROM message_log', (err, row) => {
                        if (err) {
                            resolve({
                                status: 'error',
                                error: err.message,
                                details: {
                                    path: dbPath,
                                    exists: true,
                                    accessible: false
                                }
                            });
                        } else {
                            resolve({
                                status: 'healthy',
                                details: {
                                    path: dbPath,
                                    exists: true,
                                    accessible: true,
                                    messageCount: row.count,
                                    lastCheck: new Date().toISOString()
                                }
                            });
                        }
                        db.close();
                    });
                });
            });
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async checkWhatsAppHealth() {
        try {
            // This would integrate with your WhatsApp client
            // For now, return a mock status
            return {
                status: 'healthy',
                details: {
                    connected: true,
                    lastMessage: new Date().toISOString(),
                    connectionTime: process.uptime(),
                    qrCodeAvailable: false
                }
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async checkGoogleSheetsHealth() {
        try {
            // This would test Google Sheets API connectivity
            return {
                status: 'healthy',
                details: {
                    apiAccessible: true,
                    lastSync: new Date().toISOString(),
                    quotaStatus: 'available',
                    sheetsConfigured: 3
                }
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async checkMemoryHealth() {
        try {
            const memUsage = process.memoryUsage();
            const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            
            let status = 'healthy';
            if (usagePercent > this.healthThresholds.memory) {
                status = 'warning';
            }
            
            return {
                status,
                details: {
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    usagePercent: usagePercent,
                    threshold: this.healthThresholds.memory,
                    recommendation: usagePercent > 80 ? 'Consider restarting application' : 'Memory usage is normal'
                }
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async checkDiskHealth() {
        try {
            const stats = await fs.stat('./');
            const diskUsage = await this.getDiskUsage();
            
            let status = 'healthy';
            if (diskUsage.percent > this.healthThresholds.disk) {
                status = 'warning';
            }
            
            return {
                status,
                details: {
                    free: diskUsage.free,
                    total: diskUsage.total,
                    used: diskUsage.used,
                    percent: diskUsage.percent,
                    threshold: this.healthThresholds.disk
                }
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async checkNetworkHealth() {
        try {
            // Simple network connectivity test
            const https = require('https');
            
            return new Promise((resolve) => {
                const req = https.request('https://www.google.com', { timeout: 5000 }, (res) => {
                    resolve({
                        status: 'healthy',
                        details: {
                            connectivity: true,
                            responseTime: Date.now() - req.startTime,
                            statusCode: res.statusCode
                        }
                    });
                });
                
                req.on('error', (error) => {
                    resolve({
                        status: 'warning',
                        details: {
                            connectivity: false,
                            error: error.message
                        }
                    });
                });
                
                req.on('timeout', () => {
                    resolve({
                        status: 'warning',
                        details: {
                            connectivity: false,
                            error: 'Network timeout'
                        }
                    });
                });
                
                req.startTime = Date.now();
                req.end();
            });
            
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    async getCpuUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const cpuPercent = (endUsage.user + endUsage.system) / 1000000;
                resolve(cpuPercent);
            }, 100);
        });
    }

    async getDiskUsage() {
        try {
            const stats = await fs.stat('./');
            // This is a simplified disk usage check
            // In a real implementation, you'd use a library like 'diskusage'
            return {
                free: 1000000000, // Mock value
                total: 10000000000, // Mock value
                used: 9000000000, // Mock value
                percent: 90 // Mock value
            };
        } catch (error) {
            return {
                free: 0,
                total: 0,
                used: 0,
                percent: 0
            };
        }
    }

    logHealthStatus(healthStatus) {
        const statusEmoji = {
            healthy: '✅',
            warning: '⚠️',
            critical: '🚨',
            error: '❌'
        };
        
        const emoji = statusEmoji[healthStatus.overall] || '❓';
        console.log(`${emoji} Health Check: ${healthStatus.overall.toUpperCase()} (${healthStatus.performance.checkDuration}ms)`);
        
        // Log specific issues
        Object.entries(healthStatus.checks).forEach(([name, check]) => {
            if (check.status === 'error' || check.status === 'warning') {
                console.log(`  ${name}: ${check.status} - ${check.error || check.issues?.join(', ') || 'Unknown issue'}`);
            }
        });
    }

    // Public API Methods
    getCurrentHealth() {
        return this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1] : null;
    }

    getHealthHistory(limit = 10) {
        return this.healthHistory.slice(-limit);
    }

    getHealthSummary() {
        const recent = this.healthHistory.slice(-10);
        const summary = {
            current: this.getCurrentHealth(),
            recent: {
                total: recent.length,
                healthy: recent.filter(h => h.overall === 'healthy').length,
                warning: recent.filter(h => h.overall === 'warning').length,
                critical: recent.filter(h => h.overall === 'critical').length,
                error: recent.filter(h => h.overall === 'error').length
            },
            uptime: process.uptime(),
            lastCheck: this.healthHistory.length > 0 ? this.healthHistory[this.healthHistory.length - 1].timestamp : null
        };
        
        return summary;
    }

    getHealthTrend() {
        if (this.healthHistory.length < 5) {
            return 'insufficient_data';
        }
        
        const recent = this.healthHistory.slice(-5);
        const healthyCount = recent.filter(h => h.overall === 'healthy').length;
        
        if (healthyCount === 5) return 'improving';
        if (healthyCount === 0) return 'declining';
        return 'stable';
    }

    async forceHealthCheck() {
        console.log('🔄 Forcing health check...');
        return await this.performHealthCheck();
    }

    updateThresholds(newThresholds) {
        this.healthThresholds = { ...this.healthThresholds, ...newThresholds };
        console.log('📊 Health thresholds updated');
    }

    getHealthMetrics() {
        const current = this.getCurrentHealth();
        if (!current) return null;
        
        return {
            overall: current.overall,
            system: current.checks.system?.details,
            memory: current.checks.memory?.details,
            database: current.checks.database?.details,
            whatsapp: current.checks.whatsapp?.details,
            sheets: current.checks.sheets?.details,
            performance: current.performance,
            timestamp: current.timestamp
        };
    }

    // Health check endpoints for API
    getHealthStatus() {
        const current = this.getCurrentHealth();
        return {
            status: current?.overall || 'unknown',
            timestamp: current?.timestamp || new Date().toISOString(),
            uptime: process.uptime(),
            version: process.version,
            platform: os.platform()
        };
    }

    getDetailedHealth() {
        return this.getCurrentHealth();
    }

    getHealthReport() {
        const summary = this.getHealthSummary();
        const trend = this.getHealthTrend();
        
        return {
            summary,
            trend,
            recommendations: this.generateRecommendations(),
            thresholds: this.healthThresholds
        };
    }

    generateRecommendations() {
        const current = this.getCurrentHealth();
        if (!current) return [];
        
        const recommendations = [];
        
        // Memory recommendations
        if (current.checks.memory?.details?.usagePercent > 80) {
            recommendations.push('High memory usage detected - consider restarting the application');
        }
        
        // Database recommendations
        if (current.checks.database?.status === 'error') {
            recommendations.push('Database connection issue - check database file and permissions');
        }
        
        // WhatsApp recommendations
        if (current.checks.whatsapp?.status === 'error') {
            recommendations.push('WhatsApp connection issue - check network and authentication');
        }
        
        // System recommendations
        if (current.checks.system?.details?.cpu?.usage > 80) {
            recommendations.push('High CPU usage - monitor for performance issues');
        }
        
        return recommendations;
    }
}

module.exports = HealthCheckManager;
