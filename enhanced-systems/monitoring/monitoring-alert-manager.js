const nodemailer = require('nodemailer');
const axios = require('axios');

/**
 * Advanced Monitoring & Alerting Manager
 * 
 * Features:
 * - Real-time system monitoring
 * - Email alerts for critical issues
 * - WhatsApp admin notifications
 * - Slack/Discord webhook integration
 * - Performance threshold monitoring
 * - Automated incident response
 */
class MonitoringAlertManager {
    constructor(options = {}) {
        this.emailConfig = options.email || {
            enabled: false,
            smtp: {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            },
            to: process.env.ALERT_EMAIL
        };
        
        this.whatsappAlerts = options.whatsapp || {
            enabled: true,
            adminPhone: process.env.WHATSAPP_ADMIN_PHONE
        };
        
        this.slackWebhook = options.slack || {
            enabled: false,
            url: process.env.SLACK_WEBHOOK_URL
        };
        
        this.thresholds = {
            memoryUsage: 80, // 80%
            cpuUsage: 90,    // 90%
            diskUsage: 85,   // 85%
            errorRate: 10,   // 10 errors per hour
            responseTime: 5000, // 5 seconds
            queueSize: 100   // 100 messages
        };
        
        this.alertCooldowns = new Map(); // Prevent spam alerts
        this.metrics = {
            errors: [],
            performance: [],
            alerts: []
        };
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Initialize email transporter if enabled
            if (this.emailConfig.enabled) {
                this.emailTransporter = nodemailer.createTransporter(this.emailConfig.smtp);
                await this.emailTransporter.verify();
                console.log('✅ Email alerts configured');
            }
            
            // Start monitoring
            this.startMonitoring();
            
            console.log('✅ Monitoring & Alert Manager initialized');
            console.log(`📧 Email alerts: ${this.emailConfig.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`📱 WhatsApp alerts: ${this.whatsappAlerts.enabled ? 'Enabled' : 'Disabled'}`);
            console.log(`💬 Slack alerts: ${this.slackWebhook.enabled ? 'Enabled' : 'Disabled'}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Monitoring & Alert Manager:', error.message);
        }
    }

    startMonitoring() {
        // Monitor every 30 seconds
        setInterval(() => {
            this.performHealthCheck();
        }, 30000);

        // Monitor performance every 5 minutes
        setInterval(() => {
            this.collectPerformanceMetrics();
        }, 300000);

        // Clean up old metrics every hour
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 3600000);

        console.log('🔄 Monitoring started - Health checks every 30s, Performance every 5m');
    }

    async performHealthCheck() {
        try {
            const healthStatus = {
                timestamp: new Date().toISOString(),
                system: await this.checkSystemHealth(),
                database: await this.checkDatabaseHealth(),
                whatsapp: await this.checkWhatsAppHealth(),
                sheets: await this.checkGoogleSheetsHealth(),
                memory: await this.checkMemoryUsage(),
                disk: await this.checkDiskUsage()
            };

            // Check for critical issues
            const criticalIssues = this.identifyCriticalIssues(healthStatus);
            
            if (criticalIssues.length > 0) {
                await this.sendCriticalAlert(criticalIssues, healthStatus);
            }

            // Store metrics
            this.metrics.performance.push(healthStatus);

        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            await this.sendErrorAlert('Health check failed', error);
        }
    }

    async checkSystemHealth() {
        try {
            const os = require('os');
            const cpuUsage = await this.getCpuUsage();
            
            return {
                uptime: process.uptime(),
                cpuUsage: cpuUsage,
                memoryUsage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
                systemLoad: os.loadavg()[0],
                nodeVersion: process.version,
                platform: os.platform()
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async checkDatabaseHealth() {
        try {
            const sqlite3 = require('sqlite3');
            const dbPath = './safety-data/safety-database.db';
            
            return new Promise((resolve) => {
                const db = new sqlite3.Database(dbPath, (err) => {
                    if (err) {
                        resolve({ status: 'error', error: err.message });
                        return;
                    }
                    
                    db.get('SELECT COUNT(*) as count FROM message_log', (err, row) => {
                        if (err) {
                            resolve({ status: 'error', error: err.message });
                        } else {
                            resolve({ 
                                status: 'healthy', 
                                messageCount: row.count,
                                lastCheck: new Date().toISOString()
                            });
                        }
                        db.close();
                    });
                });
            });
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    async checkWhatsAppHealth() {
        try {
            // This would integrate with your WhatsApp client
            // For now, return a mock status
            return {
                status: 'connected', // or 'disconnected'
                lastMessage: new Date().toISOString(),
                connectionTime: process.uptime()
            };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    async checkGoogleSheetsHealth() {
        try {
            // This would test Google Sheets API connectivity
            return {
                status: 'connected',
                lastSync: new Date().toISOString(),
                apiQuota: 'available' // or 'limited'
            };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }

    async checkMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            return {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                usagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async checkDiskUsage() {
        try {
            const fs = require('fs').promises;
            const stats = await fs.stat('./');
            
            return {
                available: true, // Simplified for now
                lastCheck: new Date().toISOString()
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async getCpuUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const cpuPercent = (endUsage.user + endUsage.system) / 1000000; // Convert to percentage
                resolve(cpuPercent);
            }, 100);
        });
    }

    identifyCriticalIssues(healthStatus) {
        const issues = [];

        // Check memory usage
        if (healthStatus.memory && healthStatus.memory.usagePercent > this.thresholds.memoryUsage) {
            issues.push({
                type: 'MEMORY_HIGH',
                severity: 'CRITICAL',
                message: `Memory usage is ${healthStatus.memory.usagePercent.toFixed(1)}% (threshold: ${this.thresholds.memoryUsage}%)`,
                value: healthStatus.memory.usagePercent
            });
        }

        // Check CPU usage
        if (healthStatus.system && healthStatus.system.cpuUsage > this.thresholds.cpuUsage) {
            issues.push({
                type: 'CPU_HIGH',
                severity: 'WARNING',
                message: `CPU usage is ${healthStatus.system.cpuUsage.toFixed(1)}% (threshold: ${this.thresholds.cpuUsage}%)`,
                value: healthStatus.system.cpuUsage
            });
        }

        // Check database health
        if (healthStatus.database && healthStatus.database.status === 'error') {
            issues.push({
                type: 'DATABASE_ERROR',
                severity: 'CRITICAL',
                message: `Database error: ${healthStatus.database.error}`,
                value: healthStatus.database.error
            });
        }

        // Check WhatsApp connection
        if (healthStatus.whatsapp && healthStatus.whatsapp.status === 'disconnected') {
            issues.push({
                type: 'WHATSAPP_DISCONNECTED',
                severity: 'CRITICAL',
                message: 'WhatsApp connection lost',
                value: 'disconnected'
            });
        }

        return issues;
    }

    async sendCriticalAlert(issues, healthStatus) {
        const alertKey = issues.map(i => i.type).join(',');
        const now = Date.now();
        
        // Check cooldown (don't spam alerts)
        if (this.alertCooldowns.has(alertKey)) {
            const lastAlert = this.alertCooldowns.get(alertKey);
            if (now - lastAlert < 300000) { // 5 minutes cooldown
                return;
            }
        }
        
        this.alertCooldowns.set(alertKey, now);

        const alertData = {
            timestamp: new Date().toISOString(),
            issues: issues,
            healthStatus: healthStatus,
            severity: issues.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : 'WARNING'
        };

        // Send alerts through all channels
        const promises = [];

        if (this.emailConfig.enabled) {
            promises.push(this.sendEmailAlert(alertData));
        }

        if (this.whatsappAlerts.enabled) {
            promises.push(this.sendWhatsAppAlert(alertData));
        }

        if (this.slackWebhook.enabled) {
            promises.push(this.sendSlackAlert(alertData));
        }

        await Promise.allSettled(promises);

        // Log the alert
        this.metrics.alerts.push(alertData);
        console.log(`🚨 Critical alert sent: ${issues.length} issues detected`);
    }

    async sendEmailAlert(alertData) {
        try {
            const subject = `🚨 WhatsApp Bot Alert - ${alertData.severity}`;
            const html = this.generateEmailAlertHTML(alertData);

            await this.emailTransporter.sendMail({
                from: this.emailConfig.smtp.auth.user,
                to: this.emailConfig.to,
                subject: subject,
                html: html
            });

            console.log('📧 Email alert sent');
        } catch (error) {
            console.error('❌ Email alert failed:', error.message);
        }
    }

    async sendWhatsAppAlert(alertData) {
        try {
            // This would integrate with your WhatsApp client
            const message = this.generateWhatsAppAlertMessage(alertData);
            
            // For now, just log the message
            console.log('📱 WhatsApp alert would be sent:', message);
            
            // In real implementation:
            // await whatsappClient.sendMessage(adminPhone, message);
            
        } catch (error) {
            console.error('❌ WhatsApp alert failed:', error.message);
        }
    }

    async sendSlackAlert(alertData) {
        try {
            const payload = {
                text: `🚨 WhatsApp Bot Alert - ${alertData.severity}`,
                attachments: [{
                    color: alertData.severity === 'CRITICAL' ? 'danger' : 'warning',
                    fields: alertData.issues.map(issue => ({
                        title: issue.type,
                        value: issue.message,
                        short: true
                    })),
                    footer: 'WhatsApp Bot Monitor',
                    ts: Math.floor(Date.now() / 1000)
                }]
            };

            await axios.post(this.slackWebhook.url, payload);
            console.log('💬 Slack alert sent');
        } catch (error) {
            console.error('❌ Slack alert failed:', error.message);
        }
    }

    generateEmailAlertHTML(alertData) {
        const issuesHtml = alertData.issues.map(issue => `
            <div style="margin: 10px 0; padding: 10px; border-left: 4px solid ${issue.severity === 'CRITICAL' ? '#dc3545' : '#ffc107'}; background: #f8f9fa;">
                <strong>${issue.type}</strong> (${issue.severity})<br>
                ${issue.message}
            </div>
        `).join('');

        return `
            <html>
            <body style="font-family: Arial, sans-serif;">
                <h2 style="color: ${alertData.severity === 'CRITICAL' ? '#dc3545' : '#ffc107'};">🚨 WhatsApp Bot Alert</h2>
                <p><strong>Severity:</strong> ${alertData.severity}</p>
                <p><strong>Time:</strong> ${alertData.timestamp}</p>
                
                <h3>Issues Detected:</h3>
                ${issuesHtml}
                
                <h3>System Status:</h3>
                <ul>
                    <li>Memory Usage: ${alertData.healthStatus.memory?.usagePercent?.toFixed(1) || 'N/A'}%</li>
                    <li>CPU Usage: ${alertData.healthStatus.system?.cpuUsage?.toFixed(1) || 'N/A'}%</li>
                    <li>Database: ${alertData.healthStatus.database?.status || 'N/A'}</li>
                    <li>WhatsApp: ${alertData.healthStatus.whatsapp?.status || 'N/A'}</li>
                </ul>
                
                <p><em>This is an automated alert from your WhatsApp Bot monitoring system.</em></p>
            </body>
            </html>
        `;
    }

    generateWhatsAppAlertMessage(alertData) {
        const criticalIssues = alertData.issues.filter(i => i.severity === 'CRITICAL');
        const warningIssues = alertData.issues.filter(i => i.severity === 'WARNING');
        
        let message = `🚨 *WhatsApp Bot Alert*\n\n`;
        message += `*Severity:* ${alertData.severity}\n`;
        message += `*Time:* ${new Date(alertData.timestamp).toLocaleString()}\n\n`;
        
        if (criticalIssues.length > 0) {
            message += `*Critical Issues:*\n`;
            criticalIssues.forEach(issue => {
                message += `• ${issue.message}\n`;
            });
            message += `\n`;
        }
        
        if (warningIssues.length > 0) {
            message += `*Warnings:*\n`;
            warningIssues.forEach(issue => {
                message += `• ${issue.message}\n`;
            });
        }
        
        return message;
    }

    async sendErrorAlert(title, error) {
        const errorData = {
            timestamp: new Date().toISOString(),
            title: title,
            error: error.message,
            stack: error.stack
        };

        this.metrics.errors.push(errorData);

        // Send immediate alert for errors
        await this.sendCriticalAlert([{
            type: 'SYSTEM_ERROR',
            severity: 'CRITICAL',
            message: `${title}: ${error.message}`,
            value: error.message
        }], {});
    }

    async collectPerformanceMetrics() {
        try {
            const metrics = {
                timestamp: new Date().toISOString(),
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                cpuUsage: await this.getCpuUsage(),
                activeConnections: 0, // Would track actual connections
                queueSize: 0 // Would track actual queue size
            };

            this.metrics.performance.push(metrics);
            
            // Keep only last 24 hours of metrics
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            this.metrics.performance = this.metrics.performance.filter(m => 
                new Date(m.timestamp).getTime() > cutoff
            );

        } catch (error) {
            console.error('❌ Performance metrics collection failed:', error.message);
        }
    }

    cleanupOldMetrics() {
        const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
        
        this.metrics.errors = this.metrics.errors.filter(e => 
            new Date(e.timestamp).getTime() > cutoff
        );
        
        this.metrics.alerts = this.metrics.alerts.filter(a => 
            new Date(a.timestamp).getTime() > cutoff
        );
    }

    getMetrics() {
        return {
            current: {
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                errors: this.metrics.errors.length,
                alerts: this.metrics.alerts.length
            },
            recent: {
                errors: this.metrics.errors.slice(-10),
                alerts: this.metrics.alerts.slice(-10),
                performance: this.metrics.performance.slice(-10)
            },
            thresholds: this.thresholds
        };
    }

    updateThresholds(newThresholds) {
        this.thresholds = { ...this.thresholds, ...newThresholds };
        console.log('📊 Monitoring thresholds updated');
    }
}

module.exports = MonitoringAlertManager;
