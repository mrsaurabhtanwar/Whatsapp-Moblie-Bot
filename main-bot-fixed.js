require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const PQueue = require('p-queue').default;
const WhatsAppClient = require('./whatsapp-client');
const MessageTemplates = require('./message-templates');

class WhatsAppTailorBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.whatsappClient = null;
        this.sheets = null;
        this.messageTemplates = new MessageTemplates();
        this.queue = new PQueue({ concurrency: 1, interval: 2000, intervalCap: 1 });
        
        // Enhanced duplicate prevention system
        this.processedMessages = new Set();
        this.sentMessages = new Map(); // Track sent messages with timestamps
        this.customerMessageHistory = new Map(); // Track per-customer message history
        this.isPolling = false;
        this.pollingInterval = null;
        this.isConnected = false;
        
        // Message sending limits and cooldowns
        this.maxMessagesPerCustomer = 3; // Max messages per customer per day
        this.messageCooldown = 300000; // 5 minutes between messages to same customer
        this.duplicateCheckWindow = 24 * 60 * 60 * 1000; // 24 hours
        
        // Sheet configurations from environment
        this.sheetConfigs = [
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Main Orders',
                type: 'orders'
            },
            {
                id: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
                name: 'Fabric Orders',
                type: 'fabric-orders'
            },
            {
                id: process.env.COMBINED_SHEET_ID || '199mFt3yz1cZQUGcF84pZgNQoxCpOS2gHxFGDD71CZVg',
                name: 'Combined Orders',
                type: 'combined-orders'
            }
        ];

        this.setupExpress();
        this.setupErrorHandlers();
        this.setupCleanupTasks();
    }

    setupExpress() {
        // Static files
        this.app.use(express.static('public'));
        this.app.use(express.json());

        // Dashboard route
        this.app.get('/', (req, res) => {
            const dashboardHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>🧵 Tailor Shop WhatsApp Bot Dashboard</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status { padding: 15px; margin: 10px 0; border-radius: 8px; font-weight: bold; }
        .connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .btn { background: #007bff; color: white; padding: 12px 25px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; font-size: 16px; }
        .btn:hover { background: #0056b3; }
        .btn.danger { background: #dc3545; }
        .btn.danger:hover { background: #c82333; }
        .btn.success { background: #28a745; }
        .btn.success:hover { background: #218838; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .card { background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        h2 { color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
        .qr-section { text-align: center; margin: 20px 0; }
        .qr-code { max-width: 256px; margin: 10px auto; }
        textarea { width: 100%; min-height: 100px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
        input[type="text"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin: 5px 0; }
        .test-form { background: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .log-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; max-height: 300px; overflow-y: auto; }
        .log-entry { padding: 5px; margin: 2px 0; border-left: 3px solid #007bff; background: white; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 24px; font-weight: bold; color: #1976d2; }
        .stat-label { font-size: 14px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧵 Tailor Shop Bot Dashboard</h1>
        
        <div id="status" class="status disconnected">
            📱 WhatsApp Status: Checking...
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number" id="totalProcessed">0</div>
                <div class="stat-label">Messages Processed</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="totalSent">0</div>
                <div class="stat-label">Messages Sent</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="duplicatesBlocked">0</div>
                <div class="stat-label">Duplicates Blocked</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="activeCustomers">0</div>
                <div class="stat-label">Active Customers</div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h2>📊 Bot Controls</h2>
                <button class="btn success" onclick="startPolling()">▶️ Start Polling</button>
                <button class="btn danger" onclick="stopPolling()">⏹️ Stop Polling</button>
                <button class="btn" onclick="checkStatus()">🔄 Refresh Status</button>
                <button class="btn" onclick="restartBot()">🔄 Restart Bot</button>
                <button class="btn danger" onclick="clearHistory()">🗑️ Clear Message History</button>
            </div>

            <div class="card">
                <h2>📋 Google Sheets</h2>
                <p><strong>Main Orders:</strong> ${this.sheetConfigs[0].id}</p>
                <p><strong>Fabric Orders:</strong> ${this.sheetConfigs[1].id}</p>
                <p><strong>Combined Orders:</strong> ${this.sheetConfigs[2].id}</p>
            </div>
        </div>

        <div class="qr-section" id="qrSection" style="display: none;">
            <h2>📱 Scan QR Code to Connect WhatsApp</h2>
            <img id="qrImage" class="qr-code" alt="QR Code will appear here">
            <p>Open WhatsApp on your phone → Settings → Linked Devices → Link a Device → Scan this QR code</p>
        </div>

        <div class="test-form">
            <h2>🧪 Test WhatsApp Message</h2>
            <input type="text" id="testPhone" placeholder="Phone number (e.g., 7375938371)" value="7375938371">
            <textarea id="testMessage" placeholder="Enter test message...">🙏 नमस्ते! 
यह टेस्ट मैसेज है। 
आपका ऑर्डर टेस्ट हो रहा है।</textarea>
            <button class="btn" onclick="sendTestMessage()">📤 Send Test Message</button>
        </div>

        <div class="log-section">
            <h2>📝 Recent Activity</h2>
            <div id="logs">
                <div class="log-entry">Bot starting up...</div>
            </div>
        </div>
    </div>

    <script>
        async function checkStatus() {
            try {
                const response = await fetch('/status');
                const data = await response.json();
                
                const statusDiv = document.getElementById('status');
                if (data.whatsapp.isConnected) {
                    statusDiv.className = 'status connected';
                    statusDiv.innerHTML = '✅ WhatsApp Connected • Polling: ' + (data.polling.isActive ? 'Active' : 'Inactive');
                    document.getElementById('qrSection').style.display = 'none';
                } else {
                    statusDiv.className = 'status disconnected';
                    statusDiv.innerHTML = '❌ WhatsApp Disconnected • Polling: ' + (data.polling.isActive ? 'Active' : 'Inactive');
                    
                    if (data.whatsapp.qrCode) {
                        document.getElementById('qrSection').style.display = 'block';
                        document.getElementById('qrImage').src = 'data:image/png;base64,' + data.whatsapp.qrCode;
                    }
                }
                
                // Update stats
                document.getElementById('totalProcessed').textContent = data.stats.totalProcessed || 0;
                document.getElementById('totalSent').textContent = data.stats.totalSent || 0;
                document.getElementById('duplicatesBlocked').textContent = data.stats.duplicatesBlocked || 0;
                document.getElementById('activeCustomers').textContent = data.stats.activeCustomers || 0;
                
                // Update logs
                if (data.logs) {
                    const logsDiv = document.getElementById('logs');
                    logsDiv.innerHTML = data.logs.map(log => 
                        '<div class="log-entry">' + log + '</div>'
                    ).join('');
                }
            } catch (error) {
                console.error('Status check failed:', error);
                document.getElementById('status').innerHTML = '❌ Bot Status: Error checking status';
            }
        }

        async function startPolling() {
            try {
                const response = await fetch('/polling/start', { method: 'POST' });
                const data = await response.json();
                alert(data.message);
                checkStatus();
            } catch (error) {
                alert('Failed to start polling: ' + error.message);
            }
        }

        async function stopPolling() {
            try {
                const response = await fetch('/polling/stop', { method: 'POST' });
                const data = await response.json();
                alert(data.message);
                checkStatus();
            } catch (error) {
                alert('Failed to stop polling: ' + error.message);
            }
        }

        async function restartBot() {
            try {
                const response = await fetch('/restart', { method: 'POST' });
                const data = await response.json();
                alert(data.message);
                setTimeout(checkStatus, 2000);
            } catch (error) {
                alert('Failed to restart bot: ' + error.message);
            }
        }

        async function clearHistory() {
            if (confirm('Are you sure you want to clear all message history? This will allow messages to be sent again to customers who have already received them.')) {
                try {
                    const response = await fetch('/clear-history', { method: 'POST' });
                    const data = await response.json();
                    alert(data.message);
                    checkStatus();
                } catch (error) {
                    alert('Failed to clear history: ' + error.message);
                }
            }
        }

        async function sendTestMessage() {
            const phone = document.getElementById('testPhone').value;
            const message = document.getElementById('testMessage').value;
            
            if (!phone || !message) {
                alert('Please enter phone number and message');
                return;
            }

            try {
                const response = await fetch('/send-test', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, message })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('✅ Test message sent successfully!');
                } else {
                    alert('❌ Failed: ' + data.error);
                }
            } catch (error) {
                alert('❌ Error: ' + error.message);
            }
        }

        // Check status every 5 seconds
        setInterval(checkStatus, 5000);
        
        // Initial status check
        checkStatus();
    </script>
</body>
</html>`;
            res.send(dashboardHtml);
        });

        // Status endpoint
        this.app.get('/status', (req, res) => {
            const whatsappState = this.whatsappClient?.getConnectionState() || { isConnected: false };
            
            res.json({
                whatsapp: whatsappState,
                polling: {
                    isActive: this.isPolling,
                    lastPoll: this.lastPollTime || null
                },
                server: {
                    port: this.port,
                    uptime: process.uptime()
                },
                stats: {
                    totalProcessed: this.processedMessages.size,
                    totalSent: this.sentMessages.size,
                    duplicatesBlocked: this.duplicatesBlocked || 0,
                    activeCustomers: this.customerMessageHistory.size
                },
                logs: this.getRecentLogs()
            });
        });

        // Send test message
        this.app.post('/send-test', async (req, res) => {
            try {
                const { phone, message } = req.body;
                if (!phone || !message) {
                    return res.status(400).json({ error: 'Phone and message required' });
                }

                if (!this.whatsappClient?.getConnectionState().isConnected) {
                    return res.status(503).json({ error: 'WhatsApp not connected' });
                }

                const jid = this.formatPhoneNumber(phone);
                await this.whatsappClient.sendMessage(jid, message);
                this.addLog(`Test message sent to ${phone}`);
                res.json({ success: true, message: 'Test message sent' });
            } catch (error) {
                this.addLog(`Test message failed: ${error.message}`);
                res.status(500).json({ error: error.message });
            }
        });

        // Start/stop polling
        this.app.post('/polling/start', (req, res) => {
            this.startPolling();
            this.addLog('Polling started manually');
            res.json({ success: true, message: 'Polling started' });
        });

        this.app.post('/polling/stop', (req, res) => {
            this.stopPolling();
            this.addLog('Polling stopped manually');
            res.json({ success: true, message: 'Polling stopped' });
        });

        // Restart bot
        this.app.post('/restart', (req, res) => {
            this.addLog('Bot restart requested');
            res.json({ success: true, message: 'Bot restart initiated' });
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        });

        // Clear message history
        this.app.post('/clear-history', (req, res) => {
            this.clearMessageHistory();
            this.addLog('Message history cleared manually');
            res.json({ success: true, message: 'Message history cleared' });
        });

        // Error handling
        this.app.use((err, req, res, next) => {
            console.error('Express error:', err);
            this.addLog(`Express error: ${err.message}`);
            res.status(500).json({ error: 'Internal server error' });
        });
    }

    setupErrorHandlers() {
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            this.addLog(`Uncaught Exception: ${error.message}`);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            this.addLog(`Unhandled Rejection: ${reason}`);
        });
    }

    setupCleanupTasks() {
        // Clean up old message history every hour
        setInterval(() => {
            this.cleanupOldMessages();
        }, 3600000); // 1 hour

        // Clean up processed messages every 6 hours
        setInterval(() => {
            this.cleanupProcessedMessages();
        }, 21600000); // 6 hours
    }

    // Enhanced duplicate prevention
    duplicatesBlocked = 0;

    isDuplicateMessage(phone, orderId, status, sheetType) {
        const now = Date.now();
        const customerKey = phone;
        const messageKey = `${sheetType}-${orderId}-${status}`;
        
        // Check if we've already processed this exact message
        if (this.processedMessages.has(messageKey)) {
            this.duplicatesBlocked++;
            this.addLog(`🚫 Duplicate blocked: ${messageKey}`);
            return true;
        }

        // Check customer message history
        if (this.customerMessageHistory.has(customerKey)) {
            const history = this.customerMessageHistory.get(customerKey);
            const recentMessages = history.filter(msg => 
                (now - msg.timestamp) < this.duplicateCheckWindow
            );

            // Check if we've sent too many messages to this customer
            if (recentMessages.length >= this.maxMessagesPerCustomer) {
                this.duplicatesBlocked++;
                this.addLog(`🚫 Rate limit exceeded for customer ${phone} (${recentMessages.length} messages)`);
                return true;
            }

            // Check cooldown period
            const lastMessage = recentMessages[recentMessages.length - 1];
            if (lastMessage && (now - lastMessage.timestamp) < this.messageCooldown) {
                this.duplicatesBlocked++;
                this.addLog(`🚫 Cooldown active for customer ${phone} (${Math.round((this.messageCooldown - (now - lastMessage.timestamp)) / 1000)}s remaining)`);
                return true;
            }

            // Check for similar recent messages
            const similarMessage = recentMessages.find(msg => 
                msg.orderId === orderId && msg.status === status
            );
            if (similarMessage) {
                this.duplicatesBlocked++;
                this.addLog(`🚫 Similar message already sent to ${phone} for order ${orderId}`);
                return true;
            }
        }

        return false;
    }

    recordMessageSent(phone, orderId, status, messageType) {
        const now = Date.now();
        const customerKey = phone;
        const messageKey = `${orderId}-${status}`;
        
        // Add to processed messages
        this.processedMessages.add(messageKey);
        
        // Add to sent messages with timestamp
        this.sentMessages.set(messageKey, {
            phone,
            orderId,
            status,
            messageType,
            timestamp: now
        });

        // Update customer history
        if (!this.customerMessageHistory.has(customerKey)) {
            this.customerMessageHistory.set(customerKey, []);
        }
        
        const history = this.customerMessageHistory.get(customerKey);
        history.push({
            orderId,
            status,
            messageType,
            timestamp: now
        });

        // Keep only recent messages in history
        this.customerMessageHistory.set(customerKey, 
            history.filter(msg => (now - msg.timestamp) < this.duplicateCheckWindow)
        );
    }

    clearMessageHistory() {
        this.processedMessages.clear();
        this.sentMessages.clear();
        this.customerMessageHistory.clear();
        this.duplicatesBlocked = 0;
        this.addLog('🗑️ All message history cleared');
    }

    cleanupOldMessages() {
        const now = Date.now();
        let cleaned = 0;

        // Clean up sent messages older than 24 hours
        for (const [key, message] of this.sentMessages.entries()) {
            if ((now - message.timestamp) > this.duplicateCheckWindow) {
                this.sentMessages.delete(key);
                cleaned++;
            }
        }

        // Clean up customer history
        for (const [customerKey, history] of this.customerMessageHistory.entries()) {
            const recentHistory = history.filter(msg => 
                (now - msg.timestamp) < this.duplicateCheckWindow
            );
            
            if (recentHistory.length === 0) {
                this.customerMessageHistory.delete(customerKey);
                cleaned++;
            } else {
                this.customerMessageHistory.set(customerKey, recentHistory);
            }
        }

        if (cleaned > 0) {
            this.addLog(`🧹 Cleaned up ${cleaned} old message records`);
        }
    }

    cleanupProcessedMessages() {
        // Keep processed messages for 7 days to prevent duplicates
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        const now = Date.now();
        
        // Since processedMessages is a Set, we'll clear it periodically
        // In a production system, you'd want to use a more sophisticated approach
        if (this.processedMessages.size > 10000) {
            this.processedMessages.clear();
            this.addLog('🧹 Cleared processed messages cache (size limit reached)');
        }
    }

    // Logging system
    logs = [];
    addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        this.logs.unshift(logEntry);
        if (this.logs.length > 50) {
            this.logs = this.logs.slice(0, 50);
        }
        console.log(logEntry);
    }

    getRecentLogs() {
        return this.logs.slice(0, 20);
    }

    formatPhoneNumber(phone) {
        // Remove any non-digit characters
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Add country code if not present
        if (!cleanPhone.startsWith('91')) {
            return '91' + cleanPhone + '@s.whatsapp.net';
        }
        return cleanPhone + '@s.whatsapp.net';
    }

    async initializeGoogleSheets() {
        try {
            this.addLog('🔑 Initializing Google Sheets API...');
            
            const serviceAccountPath = path.join(__dirname, 'service-account.json');
            if (!fs.existsSync(serviceAccountPath)) {
                throw new Error('Service account file not found: service-account.json');
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            this.addLog('✅ Google Sheets API initialized');
        } catch (error) {
            this.addLog(`❌ Google Sheets initialization failed: ${error.message}`);
            throw error;
        }
    }

    async start() {
        try {
            this.addLog('🚀 Starting Tailor Shop Bot...');

            // Initialize Google Sheets
            await this.initializeGoogleSheets();

            // Initialize WhatsApp client
            this.addLog('📱 Initializing WhatsApp client...');
            this.whatsappClient = new WhatsAppClient();
            await this.whatsappClient.initialize();

            // Start Express server
            this.app.listen(this.port, () => {
                this.addLog(`🌐 Dashboard running at http://localhost:${this.port}`);
                this.addLog('📊 Open the dashboard to view status and test messages');
            });

            // Wait for WhatsApp connection
            this.addLog('⏳ Waiting for WhatsApp connection...');
            await this.waitForWhatsAppConnection();

            // Start polling
            this.addLog('🔄 Starting automatic polling...');
            this.startPolling();

            this.addLog('✅ Tailor Shop Bot is ready!');
            this.addLog(`📊 Dashboard: http://localhost:${this.port}`);
            
        } catch (error) {
            this.addLog(`❌ Failed to start bot: ${error.message}`);
            process.exit(1);
        }
    }

    async waitForWhatsAppConnection(maxRetries = 60) { // 10 minutes
        let attempts = 0;
        
        while (attempts < maxRetries) {
            const state = this.whatsappClient.getConnectionState();
            
            if (state.isConnected) {
                this.addLog('✅ WhatsApp connected successfully!');
                this.isConnected = true;
                return true;
            }
            
            if (state.qrCode) {
                this.addLog('📱 QR Code available - check dashboard to scan');
            }
            
            this.addLog(`⏳ Waiting for WhatsApp connection... (${attempts + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            attempts++;
        }
        
        throw new Error('WhatsApp connection timeout');
    }

    startPolling() {
        if (this.isPolling) {
            this.addLog('⚠️ Polling already active');
            return;
        }

        this.isPolling = true;
        this.addLog('🔄 Starting sheet polling...');

        // Poll immediately
        this.pollAllSheets();

        // Set up interval (every 3 minutes)
        this.pollingInterval = setInterval(() => {
            this.pollAllSheets();
        }, 180000);

        this.addLog('✅ Polling started - checking sheets every 3 minutes');
    }

    stopPolling() {
        if (!this.isPolling) {
            this.addLog('⚠️ Polling not active');
            return;
        }

        this.isPolling = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        this.addLog('⏹️ Polling stopped');
    }

    async pollAllSheets() {
        if (!this.whatsappClient?.getConnectionState().isConnected) {
            this.addLog('⚠️ WhatsApp not connected, skipping poll');
            return;
        }

        this.addLog('🔍 Polling all sheets...');
        this.lastPollTime = new Date().toISOString();

        for (const config of this.sheetConfigs) {
            try {
                await this.pollSheet(config.id, config.name, config.type);
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between sheets
            } catch (error) {
                this.addLog(`❌ Error polling ${config.name}: ${error.message}`);
            }
        }
    }

    async pollSheet(sheetId, sheetName, sheetType) {
        try {
            this.addLog(`📊 Checking ${sheetName}...`);
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'A:Z'
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) {
                this.addLog(`📝 ${sheetName}: No data rows found`);
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);

            this.addLog(`📋 ${sheetName}: Found ${dataRows.length} data rows`);

            for (let i = 0; i < dataRows.length; i++) {
                const rowData = dataRows[i];
                const rowIndex = i + 2; // Accounting for header row
                
                // Extract data (adjust column indexes as needed)
                const phone = rowData[3] || ''; // Column D
                const status = rowData[8] || ''; // Column I
                const orderId = rowData[0] || ''; // Column A
                
                if (phone && status && orderId) {
                    const shouldSend = this.shouldSendNotification(status, orderId, phone, sheetType);
                    this.addLog(`📋 Row ${rowIndex}: Order=${orderId}, Phone=${phone}, Status=${status}, Should send=${shouldSend}`);
                    
                    if (shouldSend) {
                        await this.processOrder(rowData, headers, rowIndex, sheetType);
                    }
                }
            }

        } catch (error) {
            this.addLog(`❌ Error processing ${sheetName}: ${error.message}`);
        }
    }

    shouldSendNotification(status, orderId, phone, sheetType) {
        // Enhanced validation
        if (!status || !orderId || !phone) {
            return false;
        }

        // Check for duplicates using enhanced system
        if (this.isDuplicateMessage(phone, orderId, status, sheetType)) {
            return false;
        }

        // Only send messages for specific statuses
        const triggerStatuses = [
            'ready',           // Order ready for pickup
            'completed',       // Order completed
            'delivered',       // Order delivered
            'pickup',          // Ready for pickup
            'confirmed',       // Order confirmed (sends welcome + confirmation)
            'new',            // New order (sends welcome + confirmation)
            'pending'         // Order pending (sends welcome + confirmation)
        ];
        
        return triggerStatuses.includes(status.toLowerCase());
    }

    async processOrder(rowData, headers, rowIndex, sheetType) {
        try {
            // Extract order details
            const orderData = {
                order_id: rowData[0] || 'N/A',
                customer_name: rowData[1] || 'N/A',
                phone: rowData[3] || '',
                garment_type: rowData[4] || 'N/A',
                status: rowData[8] || 'N/A',
                delivery_date: rowData[6] || 'N/A',
                total_amount: rowData[9] || 'N/A',
                advance_amount: rowData[10] || 'N/A',
                remaining_amount: rowData[11] || 'N/A'
            };

            this.addLog(`🎯 Processing order: ${orderData.order_id} for ${orderData.customer_name}`);

            const jid = this.formatPhoneNumber(orderData.phone);
            const status = orderData.status?.toLowerCase();

            // Record that we're processing this message
            this.recordMessageSent(orderData.phone, orderData.order_id, orderData.status, 'processing');

            // Determine message type based on status - SIMPLIFIED LOGIC
            let message = '';
            let messageType = '';

            if (['confirmed', 'new', 'pending'].includes(status)) {
                // Send ONLY confirmation message (no welcome message to prevent spam)
                message = this.messageTemplates.getOrderConfirmationMessage(orderData);
                messageType = 'order confirmation';
                
            } else if (['ready', 'completed', 'pickup'].includes(status)) {
                message = this.messageTemplates.getOrderReadyMessage(orderData);
                messageType = 'order ready';
                
            } else if (status === 'delivered') {
                message = this.messageTemplates.getOrderDeliveredMessage(orderData);
                messageType = 'delivery confirmation';
            }

            if (message) {
                try {
                    await this.queue.add(() => this.whatsappClient.sendMessage(jid, message));
                    this.addLog(`✅ ${messageType} message sent to ${orderData.customer_name} (${orderData.order_id})`);
                    
                    // Record successful message
                    this.recordMessageSent(orderData.phone, orderData.order_id, orderData.status, messageType);
                    
                } catch (error) {
                    this.addLog(`❌ Failed to send ${messageType} to ${orderData.customer_name}: ${error.message}`);
                    // Remove from processed messages so it can be retried
                    const messageKey = `${orderData.order_id}-${orderData.status}`;
                    this.processedMessages.delete(messageKey);
                }
            } else {
                this.addLog(`⚠️ No message template found for status: ${status}`);
            }

        } catch (error) {
            this.addLog(`❌ Error processing order: ${error.message}`);
        }
    }
}

// Start the bot
if (require.main === module) {
    const bot = new WhatsAppTailorBot();
    bot.start().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = WhatsAppTailorBot;
