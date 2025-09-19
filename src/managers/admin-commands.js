const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class AdminCommands {
    constructor(whatsappClient, sheetsHelper, jobQueue, messageTemplates = null) {
        this.whatsapp = whatsappClient;
        this.sheets = sheetsHelper;
        this.jobQueue = jobQueue;
        this.messageTemplates = messageTemplates;
        this.adminPhone = process.env.WHATSAPP_ADMIN_PHONE || '7375938371';
        this.brotherPhone = process.env.WHATSAPP_BROTHER_PHONE || '7375938371';
        this.adminPhone2 = process.env.WHATSAPP_ADMIN_PHONE_2 || '7375938371';
        this.adminPhone3 = '917375938371';
        this.adminPhone4 = '919166758467';
        this.adminPhone5 = '916375623182';
        this.botMode = process.env.BOT_MODE || 'AUTO';
        this.pendingApprovals = new Map(); // orderId -> approval data
        
        // Message handlers are set up in main-bot.js, not here
    }

    async handleIncomingMessage(messageData) {
        try {
            const { text, sender } = messageData;
            
            logger.info(`Admin commands received message: "${text}" from ${sender}`);
            
            // Only process messages from admin
            if (!this.isAdminMessage(sender)) {
                logger.info(`Message not from admin, ignoring. Sender: ${sender}`);
                return;
            }

            const command = text.trim().toUpperCase();
            logger.info(`Admin command received: ${command} from ${sender}`);

            if (command.startsWith('APPROVE #')) {
                await this.handleApproveCommand(command);
            } else if (command.startsWith('SEND #')) {
                await this.handleSendCommand(command);
            } else if (command === 'STATUS') {
                await this.handleStatusCommand();
            } else if (command === 'HELP') {
                await this.handleHelpCommand();
            } else if (command === 'ORDERS') {
                await this.handleOrdersCommand();
            } else if (command === 'QUEUE') {
                await this.handleQueueCommand();
            } else if (command === 'RESTART') {
                await this.handleRestartCommand();
            } else if (command.startsWith('TEMPLATE ')) {
                await this.handleTemplateCommand(command);
            } else if (command === 'CLEAR') {
                await this.handleClearCommand();
            } else if (command === 'LOGS') {
                await this.handleLogsCommand();
            } else if (command === 'MODE') {
                await this.handleModeCommand();
            } else if (command.startsWith('MODE ')) {
                await this.handleSetModeCommand(command);
            } else if (command === 'TEST') {
                await this.handleTestCommand();
            } else if (command.startsWith('TEST ')) {
                await this.handleTestMessageCommand(command);
            } else if (command === 'KILLSWITCH') {
                await this.handleKillSwitchCommand();
            } else if (command === 'KILLSWITCH ON') {
                await this.handleKillSwitchOnCommand();
            } else if (command === 'KILLSWITCH OFF') {
                await this.handleKillSwitchOffCommand();
            } else if (command === 'STATS') {
                await this.handleStatsCommand();
            } else if (command === 'PING') {
                await this.handlePingCommand();
            } else if (command === 'BACKUP') {
                await this.handleBackupCommand();
            } else if (command === 'CLEANUP') {
                await this.handleCleanupCommand();
            } else {
                await this.handleUnknownCommand(command);
            }
        } catch (error) {
            logger.error('Error handling admin message:', error.message);
            await this.sendToAdmin(`Error processing command: ${error.message}`);
        }
    }

    isAdminMessage(sender) {
        const adminPhones = [
            this.adminPhone,
            this.brotherPhone, 
            this.adminPhone2,
            this.adminPhone3,
            this.adminPhone4,
            this.adminPhone5
        ].filter(phone => phone); // Remove null/undefined phones
        
        if (adminPhones.length === 0) {
            logger.info('No admin phones configured');
            return false;
        }
        
        const formattedSender = sender.replace('@s.whatsapp.net', '');
        
        logger.info(`Checking if sender ${formattedSender} is admin. Admin phones: ${adminPhones.join(', ')}`);
        
        // Check if sender matches any admin phone
        for (const adminPhone of adminPhones) {
            // Try different formats
            const formats = [
                adminPhone, // Original format
                adminPhone.replace(/\D/g, ''), // Digits only
                '91' + adminPhone.replace(/\D/g, ''), // With country code
                adminPhone.replace(/\D/g, '').replace(/^91/, ''), // Without country code
            ];
            
            for (const format of formats) {
                if (formattedSender === format || sender.includes(format)) {
                    logger.info(`Admin phone match found: ${format}`);
                    return true;
                }
            }
        }
        
        logger.info(`Sender ${formattedSender} is not an admin`);
        return false;
    }

    async handleApproveCommand(command) {
        try {
            const orderId = command.replace('APPROVE #', '').trim();
            
            if (!orderId) {
                await this.sendToAdmin('❌ Please provide a valid order ID. Format: APPROVE #ORDER_ID');
                return;
            }

            const approvalData = this.pendingApprovals.get(orderId);
            if (!approvalData) {
                await this.sendToAdmin(`❌ No pending approval found for order #${orderId}`);
                return;
            }

            // Remove from pending approvals
            this.pendingApprovals.delete(orderId);

            // Add job to queue for processing
            await this.jobQueue.add('process-order', {
                orderId: orderId,
                orderData: approvalData.orderData,
                approved: true
            });

            await this.sendToAdmin(`✅ Order #${orderId} approved! Notification will be sent shortly.`);
            
            logger.info(`Order #${orderId} approved by admin`);
        } catch (error) {
            logger.error('Error handling approve command:', error.message);
            await this.sendToAdmin(`❌ Error approving order: ${error.message}`);
        }
    }

    async handleSendCommand(command) {
        try {
            const orderId = command.replace('SEND #', '').trim();
            
            if (!orderId) {
                await this.sendToAdmin('❌ Please provide a valid order ID. Format: SEND #ORDER_ID');
                return;
            }

            // Get order from sheet
            const order = await this.sheets.getOrderById(orderId);
            if (!order) {
                await this.sendToAdmin(`❌ Order #${orderId} not found in sheet`);
                return;
            }

            // Add job to queue for processing
            await this.jobQueue.add('process-order', {
                orderId: orderId,
                orderData: order,
                manualTrigger: true
            });

            await this.sendToAdmin(`✅ Manual send triggered for order #${orderId}`);
            
            logger.info(`Manual send triggered for order #${orderId} by admin`);
        } catch (error) {
            logger.error('Error handling send command:', error.message);
            await this.sendToAdmin(`❌ Error sending order: ${error.message}`);
        }
    }

    async handleStatusCommand() {
        try {
            const whatsappHealth = this.whatsapp.isHealthy();
            const sheetsHealth = await this.sheets.healthCheck();
            
            let queueStats = { active: 0, waiting: 0, completed: 0, failed: 0 };
            try {
                if (this.jobQueue && typeof this.jobQueue.getStats === 'function') {
                    queueStats = await this.jobQueue.getStats();
                }
            } catch (queueError) {
                logger.warn('Queue stats not available:', queueError.message);
            }
            
            const statusMessage = `📊 BOT STATUS

🤖 WhatsApp: ${whatsappHealth.connected ? '✅ Connected' : '❌ Disconnected'}
📊 Queue: ${queueStats.active + queueStats.waiting} jobs (${queueStats.active} active, ${queueStats.waiting} waiting)
📋 Sheets: ${sheetsHealth.status === 'healthy' ? '✅ Connected' : '❌ Error'}
🔄 Mode: ${this.botMode}
⏰ Time: ${new Date().toLocaleString()}

Pending Approvals: ${this.pendingApprovals.size}`;

            await this.sendToAdmin(statusMessage);
        } catch (error) {
            logger.error('Error handling status command:', error.message);
            await this.sendToAdmin(`❌ Error getting status: ${error.message}`);
        }
    }

    async handleHelpCommand() {
        const helpMessage = `🤖 ADMIN COMMANDS

📋 Core Commands:
• APPROVE #ORDER_ID - Approve a pending order
• SEND #ORDER_ID - Manually send notification for order
• STATUS - Show bot status and health
• ORDERS - Show recent orders
• QUEUE - Show queue statistics
• RESTART - Restart WhatsApp connection

📝 Template Commands:
• TEMPLATE LIST - Show available templates
• TEMPLATE PREVIEW [TYPE] - Preview template

🔧 Control Commands:
• MODE - Show current bot mode
• MODE [AUTO/APPROVAL/MANUAL] - Change bot mode
• CLEAR - Clear pending approvals and queue
• KILLSWITCH - Show kill switch status
• KILLSWITCH ON - Activate emergency kill switch
• KILLSWITCH OFF - Deactivate kill switch

🧪 Testing Commands:
• TEST - Send test message to admin
• TEST [PHONE] [MESSAGE] - Send test message to specific phone

📊 Monitoring Commands:
• STATS - Show detailed statistics
• LOGS - Show recent log entries
• PING - Test bot responsiveness

🛠️ Maintenance Commands:
• BACKUP - Create data backup
• CLEANUP - Clean old data and logs

📝 Examples:
• APPROVE #12345
• SEND #12345
• STATUS
• MODE AUTO
• TEST 917375938371 Hello test
• KILLSWITCH ON
• STATS

🔄 Current Bot Mode: ${this.botMode}

👥 Admin Numbers:
• Admin 1: ${this.adminPhone || 'Not configured'}
• Admin 2: ${this.brotherPhone || 'Not configured'}
• Admin 3: ${this.adminPhone2 || 'Not configured'}`;

        await this.sendToAdmin(helpMessage);
    }

    async handleOrdersCommand() {
        try {
            const orders = await this.sheets.getAllOrders();
            const recentOrders = orders.slice(-5); // Last 5 orders
            
            let message = '📋 RECENT ORDERS\n\n';
            
            if (recentOrders.length === 0) {
                message += 'No orders found.';
            } else {
                recentOrders.forEach(order => {
                    const status = order['Delivery Status'] || 'Unknown';
                    const orderId = order['Order ID'] || order['Master Order ID'] || 'N/A';
                    const customerName = order['Customer Name'] || 'N/A';
                    const phone = order['Contact Info'] || order['Contact Number'] || 'N/A';
                    
                    message += `📦 #${orderId}\n`;
                    message += `   Customer: ${customerName}\n`;
                    message += `   Phone: ${phone}\n`;
                    message += `   Status: ${status}\n\n`;
                });
            }

            await this.sendToAdmin(message);
        } catch (error) {
            logger.error('Error handling orders command:', error.message);
            await this.sendToAdmin(`❌ Error getting orders: ${error.message}`);
        }
    }

    async handleQueueCommand() {
        try {
            let stats = { active: 0, waiting: 0, completed: 0, failed: 0 };
            let waiting = [];
            
            try {
                if (this.jobQueue && typeof this.jobQueue.getStats === 'function') {
                    stats = await this.jobQueue.getStats();
                }
                if (this.jobQueue && typeof this.jobQueue.getWaiting === 'function') {
                    waiting = await this.jobQueue.getWaiting();
                }
            } catch (queueError) {
                logger.warn('Queue stats not available:', queueError.message);
            }
            
            let message = `📊 QUEUE STATISTICS

Active Jobs: ${stats.active}
Waiting Jobs: ${stats.waiting}
Completed Jobs: ${stats.completed}
Failed Jobs: ${stats.failed}

Pending Approvals: ${this.pendingApprovals.size}`;

            if (waiting.length > 0) {
                message += '\n\n⏳ Waiting Jobs:';
                waiting.slice(0, 5).forEach(job => {
                    message += `\n• ${job.data.orderId || 'Unknown'} (${job.opts.delay ? 'delayed' : 'ready'})`;
                });
                
                if (waiting.length > 5) {
                    message += `\n... and ${waiting.length - 5} more`;
                }
            }

            await this.sendToAdmin(message);
        } catch (error) {
            logger.error('Error handling queue command:', error.message);
            await this.sendToAdmin(`❌ Error getting queue info: ${error.message}`);
        }
    }

    async handleRestartCommand() {
        try {
            await this.sendToAdmin('🔄 Restarting WhatsApp connection...');
            
            await this.whatsapp.restart();
            
            await this.sendToAdmin('✅ WhatsApp connection restarted successfully!');
            
            logger.info('WhatsApp connection restarted by admin command');
        } catch (error) {
            logger.error('Error handling restart command:', error.message);
            await this.sendToAdmin(`❌ Error restarting: ${error.message}`);
        }
    }

    async handleTemplateCommand(command) {
        try {
            const parts = command.split(' ');
            const subCommand = parts[1]?.toUpperCase();
            
            if (subCommand === 'LIST') {
                let message = '📝 AVAILABLE TEMPLATES\n\n';
                
                if (this.messageTemplates) {
                    const templates = this.messageTemplates.getAvailableTemplates();
                    if (templates.length === 0) {
                        message += 'No templates found.';
                    } else {
                        const groupedTemplates = templates.reduce((acc, template) => {
                            if (!acc[template.type]) {
                                acc[template.type] = [];
                            }
                            acc[template.type].push(template.language);
                            return acc;
                        }, {});
                        
                        Object.entries(groupedTemplates).forEach(([type, languages]) => {
                            message += `• ${type} (${languages.join(', ')})\n`;
                        });
                    }
                } else {
                    message += 'Template system not available.';
                }
                
                await this.sendToAdmin(message);
                
            } else if (subCommand === 'PREVIEW' && parts[2]) {
                const templateType = parts[2].toLowerCase();
                
                if (this.messageTemplates) {
                    // Sample data for preview
                    const sampleData = {
                        customer_name: 'John Doe',
                        order_id: '12345',
                        garment_type: 'Shirt',
                        total_amount: '1500',
                        advance_amount: '500',
                        remaining_amount: '1000',
                        ready_date: new Date().toISOString(),
                        shop_name: 'RS Tailor & Fabric',
                        shop_phone: '9876543210',
                        business_hours: '10:00 AM - 7:00 PM'
                    };
                    
                    const preview = this.messageTemplates.formatTemplate(templateType, sampleData);
                    
                    let message = `📝 TEMPLATE PREVIEW: ${templateType.toUpperCase()}\n\n`;
                    message += `"${preview.substring(0, 200)}${preview.length > 200 ? '...' : ''}"`;
                    
                    await this.sendToAdmin(message);
                } else {
                    await this.sendToAdmin('❌ Template system not available.');
                }
                
            } else {
                await this.sendToAdmin(`❌ Invalid template command. Use: TEMPLATE LIST or TEMPLATE PREVIEW [type]`);
            }
            
        } catch (error) {
            logger.error('Error handling template command:', error.message);
            await this.sendToAdmin(`❌ Error with template command: ${error.message}`);
        }
    }

    async handleUnknownCommand(command) {
        const unknownMessage = `❓ Unknown command: "${command}"

Type HELP to see available commands.`;
        
        await this.sendToAdmin(unknownMessage);
    }

    async sendToAdmin(message) {
        try {
            const result = await this.whatsapp.sendMessageToAdmin(message);
            if (!result.success) {
                logger.error('Failed to send message to admin:', result.error);
            }
        } catch (error) {
            logger.error('Error sending message to admin:', error.message);
        }
    }

    // Method to add approval request (called by worker)
    addApprovalRequest(orderId, orderData) {
        this.pendingApprovals.set(orderId, {
            orderData: orderData,
            timestamp: new Date().toISOString()
        });
        
        logger.info(`Added approval request for order #${orderId}`);
    }

    // Method to remove approval request (called when order is processed)
    removeApprovalRequest(orderId) {
        this.pendingApprovals.delete(orderId);
        logger.info(`Removed approval request for order #${orderId}`);
    }

    // Get pending approvals count
    getPendingApprovalsCount() {
        return this.pendingApprovals.size;
    }

    // Get all pending approvals
    getPendingApprovals() {
        return Array.from(this.pendingApprovals.entries()).map(([orderId, data]) => ({
            orderId,
            orderData: data.orderData,
            timestamp: data.timestamp
        }));
    }

    // ==================== NEW COMMAND HANDLERS ====================

    async handleClearCommand() {
        try {
            const clearedApprovals = this.pendingApprovals.size;
            this.pendingApprovals.clear();
            
            let message = `🧹 CLEARED DATA\n\n`;
            message += `✅ Cleared ${clearedApprovals} pending approvals\n`;
            
            // Clear queue if available
            if (this.jobQueue && typeof this.jobQueue.clear === 'function') {
                await this.jobQueue.clear();
                message += `✅ Cleared job queue\n`;
            }
            
            message += `\nAll pending data has been cleared.`;
            
            await this.sendToAdmin(message);
            logger.info('Admin cleared all pending data');
        } catch (error) {
            logger.error('Error handling clear command:', error.message);
            await this.sendToAdmin(`❌ Error clearing data: ${error.message}`);
        }
    }

    async handleLogsCommand() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Get recent logs from different log files
            const logFiles = [
                { name: 'Combined', path: path.join(__dirname, '../../logs/combined-0.log') },
                { name: 'Error', path: path.join(__dirname, '../../logs/err-0.log') },
                { name: 'Output', path: path.join(__dirname, '../../logs/out-0.log') }
            ];
            
            let message = `📋 RECENT LOGS\n\n`;
            
            for (const logFile of logFiles) {
                try {
                    if (fs.existsSync(logFile.path)) {
                        const content = fs.readFileSync(logFile.path, 'utf8');
                        const lines = content.split('\n').filter(line => line.trim());
                        const recentLines = lines.slice(-5); // Last 5 lines
                        
                        message += `📄 ${logFile.name} Logs:\n`;
                        recentLines.forEach(line => {
                            message += `   ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}\n`;
                        });
                        message += `\n`;
                    }
                } catch (fileError) {
                    message += `❌ Could not read ${logFile.name} logs\n`;
                }
            }
            
            await this.sendToAdmin(message);
        } catch (error) {
            logger.error('Error handling logs command:', error.message);
            await this.sendToAdmin(`❌ Error getting logs: ${error.message}`);
        }
    }

    async handleModeCommand() {
        try {
            const modeMessage = `🔄 BOT MODE STATUS

Current Mode: ${this.botMode}

📋 Mode Descriptions:
• AUTO - Bot automatically sends messages when orders are ready
• APPROVAL - Bot requests approval before sending messages
• MANUAL - Bot only sends when manually triggered

To change mode, use: MODE [AUTO/APPROVAL/MANUAL]`;

            await this.sendToAdmin(modeMessage);
        } catch (error) {
            logger.error('Error handling mode command:', error.message);
            await this.sendToAdmin(`❌ Error getting mode: ${error.message}`);
        }
    }

    async handleSetModeCommand(command) {
        try {
            const newMode = command.replace('MODE ', '').trim().toUpperCase();
            const validModes = ['AUTO', 'APPROVAL', 'MANUAL'];
            
            if (!validModes.includes(newMode)) {
                await this.sendToAdmin(`❌ Invalid mode. Use: AUTO, APPROVAL, or MANUAL`);
                return;
            }
            
            this.botMode = newMode;
            
            await this.sendToAdmin(`✅ Bot mode changed to: ${newMode}

📋 Mode Description:
${newMode === 'AUTO' ? '• Bot will automatically send messages when orders are ready' : ''}
${newMode === 'APPROVAL' ? '• Bot will request approval before sending messages' : ''}
${newMode === 'MANUAL' ? '• Bot will only send when manually triggered' : ''}

Mode change will take effect immediately.`);
            
            logger.info(`Bot mode changed to ${newMode} by admin`);
        } catch (error) {
            logger.error('Error handling set mode command:', error.message);
            await this.sendToAdmin(`❌ Error changing mode: ${error.message}`);
        }
    }

    async handleTestCommand() {
        try {
            const testMessage = `🧪 TEST MESSAGE

This is a test message from your WhatsApp bot!

✅ Bot is working correctly
✅ Admin commands are functional
✅ Message sending is working

Time: ${new Date().toLocaleString()}
Bot Mode: ${this.botMode}`;

            await this.sendToAdmin(testMessage);
            logger.info('Test message sent to admin');
        } catch (error) {
            logger.error('Error handling test command:', error.message);
            await this.sendToAdmin(`❌ Error sending test message: ${error.message}`);
        }
    }

    async handleTestMessageCommand(command) {
        try {
            const parts = command.split(' ');
            if (parts.length < 3) {
                await this.sendToAdmin('❌ Usage: TEST [PHONE] [MESSAGE]\nExample: TEST 917375938371 Hello test');
                return;
            }
            
            const phone = parts[1];
            const message = parts.slice(2).join(' ');
            
            // Format phone number
            const formattedPhone = phone.replace(/\D/g, '');
            const jid = formattedPhone + '@s.whatsapp.net';
            
            await this.whatsapp.sendMessage(jid, message);
            
            await this.sendToAdmin(`✅ Test message sent to ${phone}

Message: "${message}"
Time: ${new Date().toLocaleString()}`);
            
            logger.info(`Test message sent to ${phone} by admin`);
        } catch (error) {
            logger.error('Error handling test message command:', error.message);
            await this.sendToAdmin(`❌ Error sending test message: ${error.message}`);
        }
    }

    async handleKillSwitchCommand() {
        try {
            // Check if kill switch is available in safety manager
            let killSwitchStatus = 'Unknown';
            try {
                if (this.whatsapp && this.whatsapp.safetyManager) {
                    killSwitchStatus = await this.whatsapp.safetyManager.isKillSwitchActive() ? 'ACTIVE' : 'INACTIVE';
                }
            } catch (error) {
                killSwitchStatus = 'Not Available';
            }
            
            const statusMessage = `🚨 KILL SWITCH STATUS

Status: ${killSwitchStatus}

📋 Kill Switch Commands:
• KILLSWITCH ON - Activate emergency stop
• KILLSWITCH OFF - Deactivate emergency stop

⚠️ When active, ALL message sending is blocked.`;

            await this.sendToAdmin(statusMessage);
        } catch (error) {
            logger.error('Error handling kill switch command:', error.message);
            await this.sendToAdmin(`❌ Error getting kill switch status: ${error.message}`);
        }
    }

    async handleKillSwitchOnCommand() {
        try {
            if (this.whatsapp && this.whatsapp.safetyManager) {
                await this.whatsapp.safetyManager.activateKillSwitch('Activated by admin command');
                await this.sendToAdmin(`🚨 KILL SWITCH ACTIVATED

⚠️ ALL message sending is now BLOCKED
⚠️ This is an emergency stop for the bot
⚠️ Use KILLSWITCH OFF to deactivate

Time: ${new Date().toLocaleString()}`);
            } else {
                await this.sendToAdmin('❌ Kill switch not available in current configuration');
            }
        } catch (error) {
            logger.error('Error handling kill switch on command:', error.message);
            await this.sendToAdmin(`❌ Error activating kill switch: ${error.message}`);
        }
    }

    async handleKillSwitchOffCommand() {
        try {
            if (this.whatsapp && this.whatsapp.safetyManager) {
                await this.whatsapp.safetyManager.deactivateKillSwitch();
                await this.sendToAdmin(`✅ KILL SWITCH DEACTIVATED

✅ Message sending is now ENABLED
✅ Bot can resume normal operations

Time: ${new Date().toLocaleString()}`);
            } else {
                await this.sendToAdmin('❌ Kill switch not available in current configuration');
            }
        } catch (error) {
            logger.error('Error handling kill switch off command:', error.message);
            await this.sendToAdmin(`❌ Error deactivating kill switch: ${error.message}`);
        }
    }

    async handleStatsCommand() {
        try {
            const whatsappHealth = this.whatsapp.isHealthy();
            const sheetsHealth = await this.sheets.healthCheck();
            
            // Get detailed statistics
            let statsMessage = `📊 DETAILED STATISTICS

🤖 WhatsApp Status:
• Connected: ${whatsappHealth.connected ? '✅' : '❌'}
• Socket: ${whatsappHealth.socket ? '✅' : '❌'}
• Reconnect Attempts: ${whatsappHealth.reconnectAttempts || 0}

📋 Google Sheets:
• Status: ${sheetsHealth.status === 'healthy' ? '✅ Connected' : '❌ Error'}
${sheetsHealth.error ? `• Error: ${sheetsHealth.error}` : ''}

🔄 Bot Configuration:
• Mode: ${this.botMode}
• Pending Approvals: ${this.pendingApprovals.size}
• Admin Phones: ${[this.adminPhone, this.brotherPhone, this.adminPhone2].filter(p => p).length}

⏰ System Info:
• Uptime: ${Math.floor(process.uptime() / 60)} minutes
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB
• Time: ${new Date().toLocaleString()}`;

            await this.sendToAdmin(statsMessage);
        } catch (error) {
            logger.error('Error handling stats command:', error.message);
            await this.sendToAdmin(`❌ Error getting statistics: ${error.message}`);
        }
    }

    async handlePingCommand() {
        try {
            const startTime = Date.now();
            
            // Test WhatsApp connection
            const whatsappHealth = this.whatsapp.isHealthy();
            const responseTime = Date.now() - startTime;
            
            const pingMessage = `🏓 PONG!

Response Time: ${responseTime}ms
WhatsApp: ${whatsappHealth.connected ? '✅ Connected' : '❌ Disconnected'}
Time: ${new Date().toLocaleString()}

Bot is responsive and working! 🚀`;

            await this.sendToAdmin(pingMessage);
        } catch (error) {
            logger.error('Error handling ping command:', error.message);
            await this.sendToAdmin(`❌ Error with ping: ${error.message}`);
        }
    }

    async handleBackupCommand() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // Create backup of important data
            const backupDir = path.join(__dirname, '../../backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
            
            const backupData = {
                timestamp: new Date().toISOString(),
                pendingApprovals: Array.from(this.pendingApprovals.entries()),
                botMode: this.botMode,
                adminPhones: [this.adminPhone, this.brotherPhone, this.adminPhone2],
                systemInfo: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    nodeVersion: process.version
                }
            };
            
            fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
            
            await this.sendToAdmin(`💾 BACKUP CREATED

✅ Backup saved: backup-${timestamp}.json
📁 Location: backups/ directory
📊 Data included:
• Pending approvals
• Bot configuration
• System information

Time: ${new Date().toLocaleString()}`);
            
            logger.info(`Backup created: ${backupFile}`);
        } catch (error) {
            logger.error('Error handling backup command:', error.message);
            await this.sendToAdmin(`❌ Error creating backup: ${error.message}`);
        }
    }

    async handleCleanupCommand() {
        try {
            const fs = require('fs');
            const path = require('path');
            
            let cleanedItems = 0;
            let message = `🧹 CLEANUP COMPLETED\n\n`;
            
            // Clean old log files (keep last 5)
            const logDir = path.join(__dirname, '../../logs');
            if (fs.existsSync(logDir)) {
                const logFiles = fs.readdirSync(logDir)
                    .filter(file => file.endsWith('.log'))
                    .map(file => ({
                        name: file,
                        path: path.join(logDir, file),
                        time: fs.statSync(path.join(logDir, file)).mtime
                    }))
                    .sort((a, b) => b.time - a.time);
                
                // Keep only last 5 log files
                const filesToDelete = logFiles.slice(5);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        cleanedItems++;
                    } catch (error) {
                        // Ignore errors
                    }
                });
                
                message += `📄 Log files: Kept ${Math.min(5, logFiles.length)}, deleted ${filesToDelete.length}\n`;
            }
            
            // Clean old backups (keep last 10)
            const backupDir = path.join(__dirname, '../../backups');
            if (fs.existsSync(backupDir)) {
                const backupFiles = fs.readdirSync(backupDir)
                    .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
                    .map(file => ({
                        name: file,
                        path: path.join(backupDir, file),
                        time: fs.statSync(path.join(backupDir, file)).mtime
                    }))
                    .sort((a, b) => b.time - a.time);
                
                const backupsToDelete = backupFiles.slice(10);
                backupsToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                        cleanedItems++;
                    } catch (error) {
                        // Ignore errors
                    }
                });
                
                message += `💾 Backup files: Kept ${Math.min(10, backupFiles.length)}, deleted ${backupsToDelete.length}\n`;
            }
            
            message += `\n✅ Total items cleaned: ${cleanedItems}\n`;
            message += `⏰ Time: ${new Date().toLocaleString()}`;
            
            await this.sendToAdmin(message);
            logger.info(`Cleanup completed: ${cleanedItems} items cleaned`);
        } catch (error) {
            logger.error('Error handling cleanup command:', error.message);
            await this.sendToAdmin(`❌ Error during cleanup: ${error.message}`);
        }
    }
}

module.exports = AdminCommands;
