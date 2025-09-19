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

📋 Available Commands:
• APPROVE #ORDER_ID - Approve a pending order
• SEND #ORDER_ID - Manually send notification for order
• STATUS - Show bot status
• ORDERS - Show recent orders
• QUEUE - Show queue statistics
• RESTART - Restart WhatsApp connection
• TEMPLATE LIST - Show available templates
• TEMPLATE PREVIEW [TYPE] - Preview template
• HELP - Show this help message

📝 Examples:
• APPROVE #12345
• SEND #12345
• STATUS
• TEMPLATE LIST
• TEMPLATE PREVIEW order_ready

🔄 Bot Mode: ${this.botMode}

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
}

module.exports = AdminCommands;
