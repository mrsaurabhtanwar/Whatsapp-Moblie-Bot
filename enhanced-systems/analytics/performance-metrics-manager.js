const fs = require('fs').promises;
const path = require('path');

/**
 * Performance Metrics & Analytics Manager
 * 
 * Features:
 * - Real-time performance tracking
 * - Message sending analytics
 * - System resource monitoring
 * - Business metrics calculation
 * - Performance trend analysis
 * - Automated reporting
 */
class PerformanceMetricsManager {
    constructor(options = {}) {
        this.dataDir = options.dataDir || './metrics-data';
        this.metricsFile = path.join(this.dataDir, 'performance-metrics.json');
        this.reportsDir = path.join(this.dataDir, 'reports');
        
        this.metrics = {
            messages: {
                sent: 0,
                failed: 0,
                blocked: 0,
                byType: {},
                byHour: {},
                byDay: {}
            },
            performance: {
                responseTimes: [],
                memoryUsage: [],
                cpuUsage: [],
                queueSizes: []
            },
            business: {
                customers: new Set(),
                orders: new Set(),
                revenue: 0,
                averageOrderValue: 0
            },
            system: {
                uptime: 0,
                restarts: 0,
                errors: 0,
                lastUpdate: new Date().toISOString()
            }
        };
        
        this.startTime = Date.now();
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(this.reportsDir, { recursive: true });
            
            // Load existing metrics
            await this.loadMetrics();
            
            // Start periodic collection
            this.startMetricsCollection();
            
            console.log('✅ Performance Metrics Manager initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize Performance Metrics Manager:', error.message);
        }
    }

    async loadMetrics() {
        try {
            const data = await fs.readFile(this.metricsFile, 'utf8');
            const loadedMetrics = JSON.parse(data);
            
            // Merge with current metrics
            this.metrics = {
                ...this.metrics,
                ...loadedMetrics,
                business: {
                    ...this.metrics.business,
                    ...loadedMetrics.business,
                    customers: new Set(loadedMetrics.business?.customers || []),
                    orders: new Set(loadedMetrics.business?.orders || [])
                }
            };
            
            console.log('📊 Loaded existing performance metrics');
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('⚠️ Failed to load metrics:', error.message);
            }
        }
    }

    async saveMetrics() {
        try {
            const dataToSave = {
                ...this.metrics,
                business: {
                    ...this.metrics.business,
                    customers: Array.from(this.metrics.business.customers),
                    orders: Array.from(this.metrics.business.orders)
                }
            };
            
            await fs.writeFile(this.metricsFile, JSON.stringify(dataToSave, null, 2));
            
        } catch (error) {
            console.error('❌ Failed to save metrics:', error.message);
        }
    }

    startMetricsCollection() {
        // Collect system metrics every 30 seconds
        setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);

        // Save metrics every 5 minutes
        setInterval(() => {
            this.saveMetrics();
        }, 300000);

        // Generate daily reports
        this.scheduleDailyReports();

        console.log('🔄 Performance metrics collection started');
    }

    // Message tracking methods
    trackMessageSent(messageType, customerPhone, orderId, duration, success = true) {
        const timestamp = new Date();
        const hour = timestamp.getHours();
        const day = timestamp.toISOString().split('T')[0];

        // Update counters
        if (success) {
            this.metrics.messages.sent++;
        } else {
            this.metrics.messages.failed++;
        }

        // Track by type
        if (!this.metrics.messages.byType[messageType]) {
            this.metrics.messages.byType[messageType] = { sent: 0, failed: 0 };
        }
        
        if (success) {
            this.metrics.messages.byType[messageType].sent++;
        } else {
            this.metrics.messages.byType[messageType].failed++;
        }

        // Track by hour
        if (!this.metrics.messages.byHour[hour]) {
            this.metrics.messages.byHour[hour] = 0;
        }
        this.metrics.messages.byHour[hour]++;

        // Track by day
        if (!this.metrics.messages.byDay[day]) {
            this.metrics.messages.byDay[day] = 0;
        }
        this.metrics.messages.byDay[day]++;

        // Track performance
        this.metrics.performance.responseTimes.push({
            timestamp: timestamp.toISOString(),
            duration: duration,
            messageType: messageType,
            success: success
        });

        // Keep only last 1000 response times
        if (this.metrics.performance.responseTimes.length > 1000) {
            this.metrics.performance.responseTimes = this.metrics.performance.responseTimes.slice(-1000);
        }

        // Track business metrics
        this.metrics.business.customers.add(customerPhone);
        this.metrics.business.orders.add(orderId);

        console.log(`📊 Message tracked: ${messageType} - ${success ? 'Success' : 'Failed'} (${duration}ms)`);
    }

    trackMessageBlocked(reason, messageType, customerPhone) {
        this.metrics.messages.blocked++;
        
        console.log(`📊 Message blocked: ${reason} - ${messageType} for ${customerPhone}`);
    }

    trackError(error, context = {}) {
        this.metrics.system.errors++;
        
        console.log(`📊 Error tracked: ${error.message} - ${JSON.stringify(context)}`);
    }

    trackSystemRestart() {
        this.metrics.system.restarts++;
        this.startTime = Date.now();
        
        console.log('📊 System restart tracked');
    }

    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        const timestamp = new Date().toISOString();

        // Memory usage
        this.metrics.performance.memoryUsage.push({
            timestamp: timestamp,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            usagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
        });

        // Keep only last 1000 memory readings
        if (this.metrics.performance.memoryUsage.length > 1000) {
            this.metrics.performance.memoryUsage = this.metrics.performance.memoryUsage.slice(-1000);
        }

        // Update uptime
        this.metrics.system.uptime = process.uptime();
        this.metrics.system.lastUpdate = timestamp;
    }

    // Analytics methods
    getMessageAnalytics(timeframe = '24h') {
        const now = new Date();
        const cutoff = this.getTimeframeCutoff(now, timeframe);

        const recentMessages = this.metrics.performance.responseTimes.filter(m => 
            new Date(m.timestamp) > cutoff
        );

        const successRate = recentMessages.length > 0 ? 
            (recentMessages.filter(m => m.success).length / recentMessages.length) * 100 : 0;

        const avgResponseTime = recentMessages.length > 0 ?
            recentMessages.reduce((sum, m) => sum + m.duration, 0) / recentMessages.length : 0;

        return {
            totalMessages: recentMessages.length,
            successRate: successRate.toFixed(2),
            averageResponseTime: avgResponseTime.toFixed(0),
            messagesByType: this.getMessagesByType(recentMessages),
            hourlyDistribution: this.getHourlyDistribution(recentMessages),
            performanceTrend: this.getPerformanceTrend(recentMessages)
        };
    }

    getSystemAnalytics() {
        const recentMemory = this.metrics.performance.memoryUsage.slice(-10);
        const avgMemoryUsage = recentMemory.length > 0 ?
            recentMemory.reduce((sum, m) => sum + m.usagePercent, 0) / recentMemory.length : 0;

        return {
            uptime: this.formatUptime(this.metrics.system.uptime),
            memoryUsage: avgMemoryUsage.toFixed(1),
            totalErrors: this.metrics.system.errors,
            totalRestarts: this.metrics.system.restarts,
            errorRate: this.calculateErrorRate(),
            systemHealth: this.calculateSystemHealth()
        };
    }

    getBusinessAnalytics() {
        const totalCustomers = this.metrics.business.customers.size;
        const totalOrders = this.metrics.business.orders.size;
        const avgOrderValue = totalOrders > 0 ? this.metrics.business.revenue / totalOrders : 0;

        return {
            totalCustomers: totalCustomers,
            totalOrders: totalOrders,
            totalRevenue: this.metrics.business.revenue,
            averageOrderValue: avgOrderValue.toFixed(2),
            customerGrowth: this.calculateCustomerGrowth(),
            orderTrend: this.calculateOrderTrend()
        };
    }

    getPerformanceTrend(messages) {
        // Group messages by hour and calculate average response time
        const hourlyData = {};
        
        messages.forEach(msg => {
            const hour = new Date(msg.timestamp).getHours();
            if (!hourlyData[hour]) {
                hourlyData[hour] = { total: 0, count: 0 };
            }
            hourlyData[hour].total += msg.duration;
            hourlyData[hour].count++;
        });

        return Object.keys(hourlyData).map(hour => ({
            hour: parseInt(hour),
            avgResponseTime: hourlyData[hour].total / hourlyData[hour].count
        })).sort((a, b) => a.hour - b.hour);
    }

    getMessagesByType(messages) {
        const typeCount = {};
        messages.forEach(msg => {
            typeCount[msg.messageType] = (typeCount[msg.messageType] || 0) + 1;
        });
        return typeCount;
    }

    getHourlyDistribution(messages) {
        const hourlyCount = {};
        messages.forEach(msg => {
            const hour = new Date(msg.timestamp).getHours();
            hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
        });
        return hourlyCount;
    }

    calculateErrorRate() {
        const totalMessages = this.metrics.messages.sent + this.metrics.messages.failed;
        return totalMessages > 0 ? (this.metrics.messages.failed / totalMessages) * 100 : 0;
    }

    calculateSystemHealth() {
        const errorRate = this.calculateErrorRate();
        const recentMemory = this.metrics.performance.memoryUsage.slice(-5);
        const avgMemory = recentMemory.length > 0 ?
            recentMemory.reduce((sum, m) => sum + m.usagePercent, 0) / recentMemory.length : 0;

        let healthScore = 100;
        
        if (errorRate > 10) healthScore -= 30;
        if (avgMemory > 80) healthScore -= 20;
        if (this.metrics.system.restarts > 3) healthScore -= 25;
        if (this.metrics.system.errors > 50) healthScore -= 25;

        return Math.max(0, healthScore);
    }

    calculateCustomerGrowth() {
        // This would calculate growth over time
        // For now, return a simple metric
        return {
            daily: this.metrics.business.customers.size,
            weekly: this.metrics.business.customers.size,
            monthly: this.metrics.business.customers.size
        };
    }

    calculateOrderTrend() {
        // This would calculate order trends over time
        return {
            daily: this.metrics.business.orders.size,
            weekly: this.metrics.business.orders.size,
            monthly: this.metrics.business.orders.size
        };
    }

    getTimeframeCutoff(now, timeframe) {
        const cutoff = new Date(now);
        
        switch (timeframe) {
            case '1h':
                cutoff.setHours(cutoff.getHours() - 1);
                break;
            case '24h':
                cutoff.setDate(cutoff.getDate() - 1);
                break;
            case '7d':
                cutoff.setDate(cutoff.getDate() - 7);
                break;
            case '30d':
                cutoff.setDate(cutoff.getDate() - 30);
                break;
            default:
                cutoff.setDate(cutoff.getDate() - 1);
        }
        
        return cutoff;
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }

    // Reporting methods
    scheduleDailyReports() {
        const cron = require('node-cron');
        
        // Generate daily report at 6 AM
        cron.schedule('0 6 * * *', async () => {
            await this.generateDailyReport();
        });

        console.log('📅 Daily reports scheduled for 6 AM');
    }

    async generateDailyReport() {
        try {
            const report = {
                date: new Date().toISOString().split('T')[0],
                messageAnalytics: this.getMessageAnalytics('24h'),
                systemAnalytics: this.getSystemAnalytics(),
                businessAnalytics: this.getBusinessAnalytics(),
                summary: this.generateReportSummary()
            };

            const reportFile = path.join(this.reportsDir, `daily-report-${report.date}.json`);
            await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

            console.log(`📊 Daily report generated: ${reportFile}`);

            // Also generate HTML report
            await this.generateHTMLReport(report);

        } catch (error) {
            console.error('❌ Failed to generate daily report:', error.message);
        }
    }

    generateReportSummary() {
        const messageAnalytics = this.getMessageAnalytics('24h');
        const systemAnalytics = this.getSystemAnalytics();
        const businessAnalytics = this.getBusinessAnalytics();

        return {
            keyMetrics: {
                messagesSent: messageAnalytics.totalMessages,
                successRate: messageAnalytics.successRate,
                systemHealth: systemAnalytics.systemHealth,
                totalCustomers: businessAnalytics.totalCustomers
            },
            alerts: this.generateAlerts(messageAnalytics, systemAnalytics),
            recommendations: this.generateRecommendations(messageAnalytics, systemAnalytics)
        };
    }

    generateAlerts(messageAnalytics, systemAnalytics) {
        const alerts = [];

        if (parseFloat(messageAnalytics.successRate) < 95) {
            alerts.push({
                type: 'WARNING',
                message: `Message success rate is low: ${messageAnalytics.successRate}%`
            });
        }

        if (parseFloat(systemAnalytics.memoryUsage) > 80) {
            alerts.push({
                type: 'WARNING',
                message: `High memory usage: ${systemAnalytics.memoryUsage}%`
            });
        }

        if (systemAnalytics.systemHealth < 70) {
            alerts.push({
                type: 'CRITICAL',
                message: `System health is poor: ${systemAnalytics.systemHealth}%`
            });
        }

        return alerts;
    }

    generateRecommendations(messageAnalytics, systemAnalytics) {
        const recommendations = [];

        if (parseFloat(messageAnalytics.averageResponseTime) > 3000) {
            recommendations.push('Consider optimizing message sending performance');
        }

        if (parseFloat(systemAnalytics.memoryUsage) > 70) {
            recommendations.push('Monitor memory usage and consider restarting if needed');
        }

        if (systemAnalytics.totalErrors > 10) {
            recommendations.push('Investigate and fix recurring errors');
        }

        return recommendations;
    }

    async generateHTMLReport(report) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Bot Performance Report - ${report.date}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #007bff; color: white; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #f8f9fa; border-radius: 3px; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .alert.WARNING { background: #fff3cd; border: 1px solid #ffeaa7; }
        .alert.CRITICAL { background: #f8d7da; border: 1px solid #f5c6cb; }
        .recommendation { padding: 10px; margin: 5px 0; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 WhatsApp Bot Performance Report</h1>
        <p>Date: ${report.date}</p>
    </div>

    <div class="section">
        <h2>📈 Key Metrics</h2>
        <div class="metric">
            <strong>Messages Sent:</strong> ${report.summary.keyMetrics.messagesSent}
        </div>
        <div class="metric">
            <strong>Success Rate:</strong> ${report.summary.keyMetrics.successRate}%
        </div>
        <div class="metric">
            <strong>System Health:</strong> ${report.summary.keyMetrics.systemHealth}%
        </div>
        <div class="metric">
            <strong>Total Customers:</strong> ${report.summary.keyMetrics.totalCustomers}
        </div>
    </div>

    <div class="section">
        <h2>📱 Message Analytics</h2>
        <p><strong>Total Messages:</strong> ${report.messageAnalytics.totalMessages}</p>
        <p><strong>Success Rate:</strong> ${report.messageAnalytics.successRate}%</p>
        <p><strong>Average Response Time:</strong> ${report.messageAnalytics.averageResponseTime}ms</p>
    </div>

    <div class="section">
        <h2>💻 System Analytics</h2>
        <p><strong>Uptime:</strong> ${report.systemAnalytics.uptime}</p>
        <p><strong>Memory Usage:</strong> ${report.systemAnalytics.memoryUsage}%</p>
        <p><strong>Total Errors:</strong> ${report.systemAnalytics.totalErrors}</p>
        <p><strong>System Health:</strong> ${report.systemAnalytics.systemHealth}%</p>
    </div>

    <div class="section">
        <h2>🏪 Business Analytics</h2>
        <p><strong>Total Customers:</strong> ${report.businessAnalytics.totalCustomers}</p>
        <p><strong>Total Orders:</strong> ${report.businessAnalytics.totalOrders}</p>
        <p><strong>Total Revenue:</strong> ₹${report.businessAnalytics.totalRevenue}</p>
        <p><strong>Average Order Value:</strong> ₹${report.businessAnalytics.averageOrderValue}</p>
    </div>

    ${report.summary.alerts.length > 0 ? `
    <div class="section">
        <h2>🚨 Alerts</h2>
        ${report.summary.alerts.map(alert => `
            <div class="alert ${alert.type}">
                <strong>${alert.type}:</strong> ${alert.message}
            </div>
        `).join('')}
    </div>
    ` : ''}

    ${report.summary.recommendations.length > 0 ? `
    <div class="section">
        <h2>💡 Recommendations</h2>
        ${report.summary.recommendations.map(rec => `
            <div class="recommendation">${rec}</div>
        `).join('')}
    </div>
    ` : ''}
</body>
</html>
        `;

        const htmlFile = path.join(this.reportsDir, `daily-report-${report.date}.html`);
        await fs.writeFile(htmlFile, html);
        
        console.log(`📊 HTML report generated: ${htmlFile}`);
    }

    // Public API methods
    getMetrics() {
        return {
            messages: this.metrics.messages,
            performance: this.metrics.performance,
            business: {
                ...this.metrics.business,
                customers: this.metrics.business.customers.size,
                orders: this.metrics.business.orders.size
            },
            system: this.metrics.system
        };
    }

    getDashboardData() {
        return {
            realTime: {
                messagesSent: this.metrics.messages.sent,
                messagesFailed: this.metrics.messages.failed,
                messagesBlocked: this.metrics.messages.blocked,
                systemUptime: this.formatUptime(this.metrics.system.uptime),
                memoryUsage: this.metrics.performance.memoryUsage.slice(-1)[0]?.usagePercent || 0,
                systemHealth: this.calculateSystemHealth()
            },
            analytics: {
                message: this.getMessageAnalytics('24h'),
                system: this.getSystemAnalytics(),
                business: this.getBusinessAnalytics()
            }
        };
    }
}

module.exports = PerformanceMetricsManager;
