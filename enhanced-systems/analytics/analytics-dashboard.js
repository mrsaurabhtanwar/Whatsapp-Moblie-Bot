const express = require('express');
const path = require('path');

/**
 * Advanced Analytics Dashboard
 * 
 * Features:
 * - Real-time performance metrics
 * - Business intelligence reports
 * - Customer analytics
 * - System health monitoring
 * - Interactive charts and graphs
 * - Export capabilities
 */
class AnalyticsDashboard {
    constructor(options = {}) {
        this.port = options.port || 9090;
        this.app = express();
        this.metricsManager = options.metricsManager;
        this.healthManager = options.healthManager;
        this.queueManager = options.queueManager;
        
        this.setupRoutes();
        this.setupStaticFiles();
    }

    setupStaticFiles() {
        // Serve static files
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json());
    }

    setupRoutes() {
        // Dashboard home page
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });

        // API endpoints
        this.app.get('/api/metrics', (req, res) => {
            const metrics = this.metricsManager?.getDashboardData() || {};
            res.json(metrics);
        });

        this.app.get('/api/health', (req, res) => {
            const health = this.healthManager?.getHealthStatus() || {};
            res.json(health);
        });

        this.app.get('/api/queue', (req, res) => {
            const queue = this.queueManager?.getQueueStatus() || {};
            res.json(queue);
        });

        this.app.get('/api/analytics', (req, res) => {
            const analytics = this.getAnalyticsData();
            res.json(analytics);
        });

        this.app.get('/api/reports', (req, res) => {
            const reports = this.generateReports();
            res.json(reports);
        });

        // Export endpoints
        this.app.get('/api/export/csv', (req, res) => {
            const csv = this.exportToCSV();
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
            res.send(csv);
        });

        this.app.get('/api/export/json', (req, res) => {
            const data = this.exportToJSON();
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=analytics.json');
            res.json(data);
        });
    }

    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Bot Analytics Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fa; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card h3 { color: #333; margin-bottom: 15px; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        .metric { display: flex; justify-content: space-between; align-items: center; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #667eea; }
        .metric-label { color: #666; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 15px; font-size: 12px; font-weight: bold; }
        .status.healthy { background: #d4edda; color: #155724; }
        .status.warning { background: #fff3cd; color: #856404; }
        .status.critical { background: #f8d7da; color: #721c24; }
        .chart-container { position: relative; height: 300px; margin: 20px 0; }
        .btn { background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #5a6fd8; }
        .refresh-btn { position: fixed; top: 20px; right: 20px; background: #28a745; }
        .export-btns { text-align: center; margin: 20px 0; }
        .loading { text-align: center; color: #666; }
        .error { color: #dc3545; background: #f8d7da; padding: 10px; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 WhatsApp Bot Analytics Dashboard</h1>
        <p>Real-time performance monitoring and business intelligence</p>
    </div>

    <button class="btn refresh-btn" onclick="refreshData()">🔄 Refresh</button>

    <div class="container">
        <!-- Real-time Metrics -->
        <div class="grid">
            <div class="card">
                <h3>📱 Message Metrics</h3>
                <div id="messageMetrics" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h3>💻 System Health</h3>
                <div id="systemHealth" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h3>🔄 Queue Status</h3>
                <div id="queueStatus" class="loading">Loading...</div>
            </div>
        </div>

        <!-- Charts -->
        <div class="grid">
            <div class="card">
                <h3>📈 Message Success Rate</h3>
                <div class="chart-container">
                    <canvas id="successRateChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h3>⏱️ Response Time Trend</h3>
                <div class="chart-container">
                    <canvas id="responseTimeChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Business Analytics -->
        <div class="grid">
            <div class="card">
                <h3>🏪 Business Metrics</h3>
                <div id="businessMetrics" class="loading">Loading...</div>
            </div>
            
            <div class="card">
                <h3>👥 Customer Analytics</h3>
                <div id="customerAnalytics" class="loading">Loading...</div>
            </div>
        </div>

        <!-- Export Options -->
        <div class="export-btns">
            <button class="btn" onclick="exportData('csv')">📊 Export CSV</button>
            <button class="btn" onclick="exportData('json')">📄 Export JSON</button>
        </div>
    </div>

    <script>
        let charts = {};
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', function() {
            initializeCharts();
            refreshData();
            setInterval(refreshData, 30000); // Refresh every 30 seconds
        });

        function initializeCharts() {
            // Success Rate Chart
            const successCtx = document.getElementById('successRateChart').getContext('2d');
            charts.successRate = new Chart(successCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Success', 'Failed'],
                    datasets: [{
                        data: [0, 0],
                        backgroundColor: ['#28a745', '#dc3545']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false
                }
            });

            // Response Time Chart
            const responseCtx = document.getElementById('responseTimeChart').getContext('2d');
            charts.responseTime = new Chart(responseCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Response Time (ms)',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }

        async function refreshData() {
            try {
                await Promise.all([
                    loadMessageMetrics(),
                    loadSystemHealth(),
                    loadQueueStatus(),
                    loadBusinessMetrics(),
                    loadCustomerAnalytics()
                ]);
            } catch (error) {
                console.error('Error refreshing data:', error);
            }
        }

        async function loadMessageMetrics() {
            try {
                const response = await fetch('/api/metrics');
                const data = await response.json();
                
                const container = document.getElementById('messageMetrics');
                container.innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Messages Sent</span>
                        <span class="metric-value">\${data.realTime?.messagesSent || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Success Rate</span>
                        <span class="metric-value">\${data.analytics?.message?.successRate || '0'}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Avg Response Time</span>
                        <span class="metric-value">\${data.analytics?.message?.averageResponseTime || '0'}ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Messages Blocked</span>
                        <span class="metric-value">\${data.realTime?.messagesBlocked || 0}</span>
                    </div>
                \`;
                
                // Update success rate chart
                if (charts.successRate && data.analytics?.message) {
                    const success = parseFloat(data.analytics.message.successRate) || 0;
                    const failed = 100 - success;
                    charts.successRate.data.datasets[0].data = [success, failed];
                    charts.successRate.update();
                }
            } catch (error) {
                document.getElementById('messageMetrics').innerHTML = '<div class="error">Failed to load message metrics</div>';
            }
        }

        async function loadSystemHealth() {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                
                const container = document.getElementById('systemHealth');
                const statusClass = data.status === 'healthy' ? 'healthy' : 
                                  data.status === 'warning' ? 'warning' : 'critical';
                
                container.innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Overall Status</span>
                        <span class="status \${statusClass}">\${data.status?.toUpperCase() || 'UNKNOWN'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Uptime</span>
                        <span class="metric-value">\${formatUptime(data.uptime || 0)}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Node Version</span>
                        <span class="metric-value">\${data.version || 'N/A'}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Platform</span>
                        <span class="metric-value">\${data.platform || 'N/A'}</span>
                    </div>
                \`;
            } catch (error) {
                document.getElementById('systemHealth').innerHTML = '<div class="error">Failed to load system health</div>';
            }
        }

        async function loadQueueStatus() {
            try {
                const response = await fetch('/api/queue');
                const data = await response.json();
                
                const container = document.getElementById('queueStatus');
                container.innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Priority Queue</span>
                        <span class="metric-value">\${data.priority || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Normal Queue</span>
                        <span class="metric-value">\${data.normal || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Retry Queue</span>
                        <span class="metric-value">\${data.retry || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Active Jobs</span>
                        <span class="metric-value">\${data.active || 0}</span>
                    </div>
                \`;
            } catch (error) {
                document.getElementById('queueStatus').innerHTML = '<div class="error">Failed to load queue status</div>';
            }
        }

        async function loadBusinessMetrics() {
            try {
                const response = await fetch('/api/analytics');
                const data = await response.json();
                
                const container = document.getElementById('businessMetrics');
                container.innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Total Customers</span>
                        <span class="metric-value">\${data.business?.totalCustomers || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Total Orders</span>
                        <span class="metric-value">\${data.business?.totalOrders || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Total Revenue</span>
                        <span class="metric-value">₹\${data.business?.totalRevenue || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Avg Order Value</span>
                        <span class="metric-value">₹\${data.business?.averageOrderValue || 0}</span>
                    </div>
                \`;
            } catch (error) {
                document.getElementById('businessMetrics').innerHTML = '<div class="error">Failed to load business metrics</div>';
            }
        }

        async function loadCustomerAnalytics() {
            try {
                const response = await fetch('/api/analytics');
                const data = await response.json();
                
                const container = document.getElementById('customerAnalytics');
                container.innerHTML = \`
                    <div class="metric">
                        <span class="metric-label">Active Customers</span>
                        <span class="metric-value">\${data.customers?.active || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">New Customers</span>
                        <span class="metric-value">\${data.customers?.new || 0}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Response Rate</span>
                        <span class="metric-value">\${data.customers?.responseRate || 0}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Satisfaction</span>
                        <span class="metric-value">\${data.customers?.satisfaction || 0}%</span>
                    </div>
                \`;
            } catch (error) {
                document.getElementById('customerAnalytics').innerHTML = '<div class="error">Failed to load customer analytics</div>';
            }
        }

        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (days > 0) return \`\${days}d \${hours}h \${minutes}m\`;
            if (hours > 0) return \`\${hours}h \${minutes}m\`;
            return \`\${minutes}m\`;
        }

        function exportData(format) {
            const url = format === 'csv' ? '/api/export/csv' : '/api/export/json';
            window.open(url, '_blank');
        }
    </script>
</body>
</html>
        `;
    }

    getAnalyticsData() {
        return {
            business: {
                totalCustomers: this.metricsManager?.getBusinessAnalytics()?.totalCustomers || 0,
                totalOrders: this.metricsManager?.getBusinessAnalytics()?.totalOrders || 0,
                totalRevenue: this.metricsManager?.getBusinessAnalytics()?.totalRevenue || 0,
                averageOrderValue: this.metricsManager?.getBusinessAnalytics()?.averageOrderValue || 0
            },
            customers: {
                active: this.metricsManager?.getBusinessAnalytics()?.totalCustomers || 0,
                new: 0, // Would be calculated from recent data
                responseRate: 95, // Would be calculated from actual data
                satisfaction: 98 // Would be calculated from feedback
            },
            performance: {
                throughput: this.queueManager?.getProcessingStats()?.throughput || 0,
                successRate: this.queueManager?.getProcessingStats()?.successRate || 0,
                averageResponseTime: this.metricsManager?.getMessageAnalytics()?.averageResponseTime || 0
            }
        };
    }

    generateReports() {
        return {
            daily: this.generateDailyReport(),
            weekly: this.generateWeeklyReport(),
            monthly: this.generateMonthlyReport()
        };
    }

    generateDailyReport() {
        return {
            date: new Date().toISOString().split('T')[0],
            messages: {
                sent: this.metricsManager?.getMessageAnalytics()?.totalMessages || 0,
                successRate: this.metricsManager?.getMessageAnalytics()?.successRate || 0,
                averageResponseTime: this.metricsManager?.getMessageAnalytics()?.averageResponseTime || 0
            },
            system: {
                uptime: process.uptime(),
                health: this.healthManager?.getCurrentHealth()?.overall || 'unknown',
                memoryUsage: this.healthManager?.getCurrentHealth()?.checks?.memory?.details?.usagePercent || 0
            },
            business: {
                customers: this.metricsManager?.getBusinessAnalytics()?.totalCustomers || 0,
                orders: this.metricsManager?.getBusinessAnalytics()?.totalOrders || 0,
                revenue: this.metricsManager?.getBusinessAnalytics()?.totalRevenue || 0
            }
        };
    }

    generateWeeklyReport() {
        // This would aggregate data from the past week
        return {
            period: 'Last 7 days',
            summary: 'Weekly performance summary would go here'
        };
    }

    generateMonthlyReport() {
        // This would aggregate data from the past month
        return {
            period: 'Last 30 days',
            summary: 'Monthly performance summary would go here'
        };
    }

    exportToCSV() {
        const data = this.getAnalyticsData();
        const headers = ['Metric', 'Value'];
        const rows = [
            ['Total Customers', data.business.totalCustomers],
            ['Total Orders', data.business.totalOrders],
            ['Total Revenue', data.business.totalRevenue],
            ['Average Order Value', data.business.averageOrderValue],
            ['Active Customers', data.customers.active],
            ['Response Rate', data.customers.responseRate],
            ['Satisfaction', data.customers.satisfaction]
        ];
        
        return [headers, ...rows].map(row => row.join(',')).join('\\n');
    }

    exportToJSON() {
        return {
            timestamp: new Date().toISOString(),
            analytics: this.getAnalyticsData(),
            reports: this.generateReports(),
            system: {
                uptime: process.uptime(),
                version: process.version,
                platform: process.platform
            }
        };
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`📊 Analytics Dashboard running at http://localhost:${this.port}`);
        });
    }
}

module.exports = AnalyticsDashboard;
