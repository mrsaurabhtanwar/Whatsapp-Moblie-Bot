/**
 * Enhanced Bot Integration
 * 
 * This file integrates all the enhanced systems into your existing bot:
 * - Database Backup Manager
 * - Monitoring & Alert Manager
 * - Performance Metrics Manager
 * - Smart Sheets Poller
 * - Memory Manager
 * - Config Manager
 * - Health Check Manager
 * - Advanced Queue Manager
 * - Analytics Dashboard
 */

const DatabaseBackupManager = require('./database-backup-manager');
const MonitoringAlertManager = require('./monitoring-alert-manager');
const PerformanceMetricsManager = require('./performance-metrics-manager');
const SmartSheetsPoller = require('./smart-sheets-poller');
const MemoryManager = require('./memory-manager');
const ConfigManager = require('./config-manager');
const HealthCheckManager = require('./health-check-manager');
const AdvancedQueueManager = require('./advanced-queue-manager');
const AnalyticsDashboard = require('./analytics-dashboard');

class EnhancedBotIntegration {
    constructor(options = {}) {
        this.options = options;
        this.managers = {};
        this.isInitialized = false;
        
        console.log('🚀 Enhanced Bot Integration starting...');
    }

    async initialize() {
        try {
            console.log('🔧 Initializing enhanced systems...');
            
            // Initialize Configuration Manager first
            this.managers.config = new ConfigManager({
                configDir: './config'
            });
            
            // Wait for config to be ready
            await this.delay(1000);
            
            // Initialize other managers
            await this.initializeManagers();
            
            // Setup integrations
            await this.setupIntegrations();
            
            // Start services
            await this.startServices();
            
            this.isInitialized = true;
            console.log('✅ Enhanced Bot Integration initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Enhanced Bot Integration:', error.message);
            throw error;
        }
    }

    async initializeManagers() {
        // Database Backup Manager
        this.managers.databaseBackup = new DatabaseBackupManager({
            dbPath: './safety-data/safety-database.db',
            backupDir: './backups',
            googleDriveEnabled: this.managers.config.get('database', 'googleDriveBackup'),
            retentionDays: this.managers.config.get('database', 'retentionDays')
        });

        // Monitoring & Alert Manager
        this.managers.monitoring = new MonitoringAlertManager({
            email: {
                enabled: !!this.managers.config.get('monitoring', 'alertEmail'),
                smtp: {
                    host: this.managers.config.get('monitoring', 'smtpHost'),
                    port: this.managers.config.get('monitoring', 'smtpPort'),
                    secure: false,
                    auth: {
                        user: this.managers.config.get('monitoring', 'smtpUser'),
                        pass: this.managers.config.get('monitoring', 'smtpPass')
                    }
                },
                to: this.managers.config.get('monitoring', 'alertEmail')
            },
            whatsapp: {
                enabled: true,
                adminPhone: this.managers.config.get('whatsapp', 'adminPhone')
            },
            slack: {
                enabled: !!this.managers.config.get('monitoring', 'slackWebhook'),
                url: this.managers.config.get('monitoring', 'slackWebhook')
            }
        });

        // Performance Metrics Manager
        this.managers.performance = new PerformanceMetricsManager({
            dataDir: './metrics-data'
        });

        // Smart Sheets Poller
        this.managers.sheetsPoller = new SmartSheetsPoller({
            sheetConfigs: [
                {
                    id: this.managers.config.get('sheets', 'mainSheetId'),
                    name: this.managers.config.get('sheets', 'sheetName'),
                    type: 'main'
                },
                {
                    id: this.managers.config.get('sheets', 'fabricSheetId'),
                    name: 'Fabric Orders',
                    type: 'fabric'
                },
                {
                    id: this.managers.config.get('sheets', 'combinedSheetId'),
                    name: 'Combined Orders',
                    type: 'combined'
                }
            ],
            pollInterval: this.managers.config.get('bot', 'pollingInterval') * 1000
        });

        // Memory Manager
        this.managers.memory = new MemoryManager({
            gcThreshold: this.managers.config.get('performance', 'gcThreshold'),
            leakThreshold: 100
        });

        // Health Check Manager
        this.managers.health = new HealthCheckManager({
            checkInterval: 60000
        });

        // Advanced Queue Manager
        this.managers.queue = new AdvancedQueueManager({
            maxConcurrency: 3,
            retryAttempts: this.managers.config.get('bot', 'maxRetries'),
            retryDelay: this.managers.config.get('bot', 'retryDelay') * 1000
        });

        // Analytics Dashboard
        this.managers.dashboard = new AnalyticsDashboard({
            port: this.managers.config.get('performance', 'metricsPort'),
            metricsManager: this.managers.performance,
            healthManager: this.managers.health,
            queueManager: this.managers.queue
        });

        console.log('✅ All managers initialized');
    }

    async setupIntegrations() {
        // Setup configuration watchers
        this.setupConfigWatchers();
        
        // Setup cross-manager integrations
        this.setupCrossIntegrations();
        
        // Setup error handling
        this.setupErrorHandling();
        
        console.log('✅ Integrations setup completed');
    }

    setupConfigWatchers() {
        // Watch for configuration changes
        this.managers.config.watchConfiguration('bot', 'pollingInterval', (value) => {
            console.log(`📊 Bot polling interval updated to ${value} seconds`);
            // Update sheets poller interval
            if (this.managers.sheetsPoller) {
                this.managers.sheetsPoller.updateSmartSchedule({
                    businessHours: value * 1000
                });
            }
        });

        this.managers.config.watchConfiguration('performance', 'gcThreshold', (value) => {
            console.log(`🧠 GC threshold updated to ${value}%`);
            if (this.managers.memory) {
                this.managers.memory.updateThresholds({ gcThreshold: value });
            }
        });

        this.managers.config.watchConfiguration('monitoring', 'alertEmail', (value) => {
            console.log(`📧 Alert email updated to ${value}`);
            // Restart monitoring with new email config
        });
    }

    setupCrossIntegrations() {
        // Performance metrics integration
        if (this.managers.performance && this.managers.queue) {
            // Track queue metrics
            this.managers.queue.on('jobCompleted', (job) => {
                this.managers.performance.trackMessageSent(
                    job.metadata.type,
                    job.metadata.customerPhone,
                    job.metadata.orderId,
                    Date.now() - job.startedAt,
                    true
                );
            });

            this.managers.queue.on('jobDeadLettered', (job) => {
                this.managers.performance.trackMessageSent(
                    job.metadata.type,
                    job.metadata.customerPhone,
                    job.metadata.orderId,
                    Date.now() - job.startedAt,
                    false
                );
            });
        }

        // Health check integration
        if (this.managers.health && this.managers.monitoring) {
            // Monitor health status changes
            this.managers.health.on('healthStatusChanged', (status) => {
                if (status.overall === 'critical') {
                    this.managers.monitoring.sendCriticalAlert([{
                        type: 'SYSTEM_HEALTH_CRITICAL',
                        severity: 'CRITICAL',
                        message: 'System health is critical',
                        value: status.overall
                    }], status);
                }
            });
        }

        // Memory management integration
        if (this.managers.memory && this.managers.performance) {
            // Track memory usage in performance metrics
            setInterval(() => {
                const memStats = this.managers.memory.getMemoryStats();
                if (memStats && memStats.current) {
                    this.managers.performance.collectSystemMetrics();
                }
            }, 30000);
        }
    }

    setupErrorHandling() {
        // Global error handling
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            this.managers.monitoring?.sendErrorAlert('Uncaught Exception', error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection:', reason);
            this.managers.monitoring?.sendErrorAlert('Unhandled Rejection', reason);
        });

        // Manager-specific error handling
        Object.values(this.managers).forEach(manager => {
            if (manager && typeof manager.on === 'function') {
                manager.on('error', (error) => {
                    console.error('❌ Manager error:', error);
                    this.managers.monitoring?.sendErrorAlert('Manager Error', error);
                });
            }
        });
    }

    async startServices() {
        // Start analytics dashboard
        if (this.managers.dashboard) {
            this.managers.dashboard.start();
        }

        console.log('✅ All services started');
    }

    // Public API Methods
    getManager(name) {
        return this.managers[name];
    }

    getAllManagers() {
        return { ...this.managers };
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            managers: Object.keys(this.managers),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }

    async shutdown() {
        console.log('🔄 Shutting down enhanced systems...');
        
        try {
            // Shutdown managers in reverse order
            const shutdownOrder = [
                'dashboard',
                'queue',
                'health',
                'memory',
                'sheetsPoller',
                'performance',
                'monitoring',
                'databaseBackup',
                'config'
            ];

            for (const managerName of shutdownOrder) {
                const manager = this.managers[managerName];
                if (manager && typeof manager.shutdown === 'function') {
                    await manager.shutdown();
                }
            }

            console.log('✅ Enhanced systems shutdown completed');
        } catch (error) {
            console.error('❌ Error during shutdown:', error.message);
        }
    }

    // Utility Methods
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Integration with existing bot
    integrateWithBot(bot) {
        if (!this.isInitialized) {
            throw new Error('Enhanced Bot Integration not initialized');
        }

        // Replace bot's message sending with queue-based sending
        const originalSendMessage = bot.whatsappClient?.sendMessage?.bind(bot.whatsappClient);
        
        if (originalSendMessage) {
            bot.whatsappClient.sendMessage = async (jid, message, context = {}) => {
                // Add to queue instead of sending directly
                const job = {
                    type: 'message',
                    jid: jid,
                    message: message,
                    context: context,
                    customerPhone: context.customerPhone || context.phone,
                    orderId: context.orderId || context.order_id
                };

                const jobId = await this.managers.queue.enqueue(job, 'normal');
                
                // Track the message attempt
                this.managers.performance?.trackMessageSent(
                    'message',
                    job.customerPhone,
                    job.orderId,
                    0,
                    true
                );

                return { success: true, jobId: jobId };
            };
        }

        // Replace bot's sheet polling with smart polling
        if (bot.pollAllSheets) {
            const originalPollAllSheets = bot.pollAllSheets.bind(bot);
            bot.pollAllSheets = async () => {
                // Use smart poller instead
                await this.managers.sheetsPoller.pollAllSheets();
            };
        }

        // Add health check endpoint
        if (bot.app) {
            bot.app.get('/api/health', (req, res) => {
                const health = this.managers.health?.getHealthStatus() || {};
                res.json(health);
            });

            bot.app.get('/api/metrics', (req, res) => {
                const metrics = this.managers.performance?.getDashboardData() || {};
                res.json(metrics);
            });

            bot.app.get('/api/queue', (req, res) => {
                const queue = this.managers.queue?.getQueueStatus() || {};
                res.json(queue);
            });
        }

        console.log('✅ Enhanced systems integrated with bot');
    }
}

module.exports = EnhancedBotIntegration;
