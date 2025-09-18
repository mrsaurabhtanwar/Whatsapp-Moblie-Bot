require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const PQueue = require('p-queue').default;
const WhatsAppClient = require('./whatsapp-client');
const MessageTemplates = require('./message-templates');

class TailorSheetBot {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.whatsappClient = null;
        this.sheets = null;
        this.messageTemplates = new MessageTemplates();
        this.queue = new PQueue({ concurrency: 1, interval: 2000, intervalCap: 1 });
        this.processedMessages = new Set();
        this.isPolling = false;
        this.pollingInterval = null;
        
        // Sheet configurations
        this.sheetConfigs = [
            {
                id: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Main Sheet',
                type: 'orders'
            },
            {
                id: '1-7Xzxx2_uPQSCMkIhXO5qkEXo1mA_RFLh-ZLr7QdZTw',
                name: 'Fabric Orders',
                type: 'fabric-orders'
            },
            {
                id: '1YPmFLY4Fn_UtHQ3o6Fkz2HKHNTsXqMPnqtOyGUy02ic',
                name: 'Combined Orders',
                type: 'combined-orders'
            }
        ];

        this.setupExpress();
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
    </style>
</head>
<body>
    <div class="container">
        <h1>🧵 Tailor Shop Bot Dashboard</h1>
        
        <div id="status" class="status disconnected">
            📱 WhatsApp Status: Checking...
        </div>

        <div class="grid">
            <div class="card">
                <h2>📊 Bot Controls</h2>
                <button class="btn success" onclick="startPolling()">▶️ Start Polling</button>
                <button class="btn danger" onclick="stopPolling()">⏹️ Stop Polling</button>
                <button class="btn" onclick="checkStatus()">🔄 Refresh Status</button>
            </div>

            <div class="card">
                <h2>📋 Google Sheets</h2>
                <p><strong>Main Orders:</strong> 128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y</p>
                <p><strong>Fabric Orders:</strong> 1-7Xzxx2_uPQSCMkIhXO5qkEXo1mA_RFLh-ZLr7QdZTw</p>
                <p><strong>Combined Orders:</strong> 1YPmFLY4Fn_UtHQ3o6Fkz2HKHNTsXqMPnqtOyGUy02ic</p>
            </div>
        </div>

        <div class="qr-section" id="qrSection" style="display: none;">
            <h2>📱 Scan QR Code to Connect WhatsApp</h2>
            <img id="qrImage" class="qr-code" alt="QR Code will appear here">
        </div>

        <div class="test-form">
            <h2>🧪 Test WhatsApp Message</h2>
            <input type="text" id="testPhone" placeholder="Phone number (e.g., 9123456789)" value="7375938371">
            <textarea id="testMessage" placeholder="Enter test message...">🙏 नमस्ते! 
यह टेस्ट मैसेज है। 
आपका ऑर्डर टेस्ट हो रहा है।</textarea>
            <button class="btn" onclick="sendTestMessage()">📤 Send Test Message</button>
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

        // Check status every 10 seconds
        setInterval(checkStatus, 10000);
        
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
                }
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
                res.json({ success: true, message: 'Test message sent' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Start/stop polling
        this.app.post('/polling/start', (req, res) => {
            this.startPolling();
            res.json({ success: true, message: 'Polling started' });
        });

        this.app.post('/polling/stop', (req, res) => {
            this.stopPolling();
            res.json({ success: true, message: 'Polling stopped' });
        });

        // Error handling
        this.app.use((err, req, res, next) => {
            console.error('Express error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
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
            console.log('🔑 Initializing Google Sheets API...');
            
            const serviceAccountPath = path.join(__dirname, 'service-account.json');
            if (!fs.existsSync(serviceAccountPath)) {
                throw new Error('Service account file not found: service-account.json');
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets API initialized');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error.message);
            throw error;
        }
    }

    async start() {
        try {
            console.log('🚀 Starting Tailor Shop Bot...');

            // Initialize Google Sheets
            await this.initializeGoogleSheets();

            // Initialize WhatsApp client
            console.log('📱 Initializing WhatsApp client...');
            this.whatsappClient = new WhatsAppClient();
            await this.whatsappClient.initialize();

            // Start Express server
            this.app.listen(this.port, () => {
                console.log(`🌐 Dashboard running at http://localhost:${this.port}`);
                console.log('📊 Open the dashboard to view status and test messages');
            });

            // Wait for WhatsApp connection
            console.log('⏳ Waiting for WhatsApp connection...');
            await this.waitForWhatsAppConnection();

            // Start polling
            console.log('🔄 Starting automatic polling...');
            this.startPolling();

            console.log('✅ Tailor Shop Bot is ready!');
            console.log(`📊 Dashboard: http://localhost:${this.port}`);
            
        } catch (error) {
            console.error('❌ Failed to start bot:', error.message);
            process.exit(1);
        }
    }

    async waitForWhatsAppConnection(maxRetries = 60) { // 10 minutes
        let attempts = 0;
        
        while (attempts < maxRetries) {
            const state = this.whatsappClient.getConnectionState();
            
            if (state.isConnected) {
                console.log('✅ WhatsApp connected successfully!');
                return true;
            }
            
            if (state.qrCode) {
                console.log('📱 QR Code available - check dashboard to scan');
            }
            
            console.log(`⏳ Waiting for WhatsApp connection... (${attempts + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            attempts++;
        }
        
        throw new Error('WhatsApp connection timeout');
    }

    startPolling() {
        if (this.isPolling) {
            console.log('⚠️ Polling already active');
            return;
        }

        this.isPolling = true;
        console.log('🔄 Starting sheet polling...');

        // Poll immediately
        this.pollAllSheets();

        // Set up interval (every 3 minutes)
        this.pollingInterval = setInterval(() => {
            this.pollAllSheets();
        }, 180000);

        console.log('✅ Polling started - checking sheets every 3 minutes');
    }

    stopPolling() {
        if (!this.isPolling) {
            console.log('⚠️ Polling not active');
            return;
        }

        this.isPolling = false;
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        console.log('⏹️ Polling stopped');
    }

    async pollAllSheets() {
        if (!this.whatsappClient?.getConnectionState().isConnected) {
            console.log('⚠️ WhatsApp not connected, skipping poll');
            return;
        }

        console.log('🔍 Polling all sheets...');
        this.lastPollTime = new Date().toISOString();

        for (const config of this.sheetConfigs) {
            try {
                await this.pollSheet(config.id, config.name, config.type);
                await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between sheets
            } catch (error) {
                console.error(`❌ Error polling ${config.name}:`, error.message);
            }
        }
    }

    async pollSheet(sheetId, sheetName, sheetType) {
        try {
            console.log(`📊 Checking ${sheetName}...`);
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'A:Z'
            });

            const rows = response.data.values || [];
            if (rows.length <= 1) {
                console.log(`📝 ${sheetName}: No data rows found`);
                return;
            }

            const headers = rows[0];
            const dataRows = rows.slice(1);

            console.log(`📋 ${sheetName}: Found ${dataRows.length} data rows`);

            for (let i = 0; i < dataRows.length; i++) {
                const rowData = dataRows[i];
                const rowIndex = i + 2; // Accounting for header row
                
                // Extract data (adjust column indexes as needed)
                const phone = rowData[3] || ''; // Column D
                const status = rowData[8] || ''; // Column I
                
                if (phone && status) {
                    console.log(`📋 Row ${rowIndex}: Phone=${phone}, Status=${status}, Should send=${this.shouldSendNotification(status, rowIndex, sheetType)}`);
                }

                if (phone && this.shouldSendNotification(status, rowIndex, sheetType)) {
                    await this.processOrder(rowData, headers, rowIndex, sheetType);
                }
            }

        } catch (error) {
            console.error(`❌ Error processing ${sheetName}:`, error.message);
        }
    }

    shouldSendNotification(status, rowIndex, sheetType) {
        const messageKey = `${sheetType}-${rowIndex}-${status}`;
        
        console.log(`🔍 Checking notification for: ${messageKey}`);
        
        if (this.processedMessages.has(messageKey)) {
            console.log(`⚠️ Already processed: ${messageKey}`);
            return false;
        }

        // Enhanced trigger statuses including new orders and confirmations
        const triggerStatuses = [
            'ready',           // Order ready for pickup
            'completed',       // Order completed
            'delivered',       // Order delivered
            'pickup',          // Ready for pickup
            'confirmed',       // Order confirmed (sends welcome + confirmation)
            'new',            // New order (sends welcome + confirmation)
            'pending',        // Order pending (sends welcome + confirmation)
            'processing',     // Order started processing (confirmation)
            'cutting',        // Cutting started processing (confirmation)
            'stitching',      // Stitching started (confirmation)
            'fitting',        // Fitting stage (confirmation)
            'order_confirmed', // Order confirmation
            'welcome'         // Welcome message for new customer
        ];
        
        const shouldSend = triggerStatuses.includes(status?.toLowerCase());
        
        console.log(`🎯 Status '${status}' ${shouldSend ? 'MATCHES' : 'does not match'} trigger statuses`);
        console.log(`📝 Would trigger notification: ${shouldSend ? 'YES' : 'NO'}`);
        
        return shouldSend;
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

            console.log(`🎯 Processing order: ${orderData.order_id} for ${orderData.customer_name}`);

            const jid = this.formatPhoneNumber(orderData.phone);
            const status = orderData.status?.toLowerCase();

            // Mark as processed first to avoid duplicates
            const messageKey = `${sheetType}-${rowIndex}-${orderData.status}`;
            this.processedMessages.add(messageKey);

            // Determine message type based on status
            let message = '';
            let messageType = '';

            if (['confirmed', 'new', 'pending'].includes(status)) {
                // Send welcome message first
                messageType = 'welcome + confirmation';
                const welcomeMessage = this.messageTemplates.getWelcomeMessage(orderData);
                await this.queue.add(() => this.whatsappClient.sendMessage(jid, welcomeMessage));
                
                console.log(`✅ Welcome message queued for ${orderData.customer_name}`);
                
                // Wait 3 seconds, then send confirmation
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                message = this.messageTemplates.getOrderConfirmationMessage(orderData);
                messageType = 'order confirmation';
                
            } else if (['ready', 'completed', 'pickup'].includes(status)) {
                message = this.messageTemplates.getOrderReadyMessage(orderData);
                messageType = 'order ready';
                
            } else if (['processing', 'cutting', 'stitching', 'fitting'].includes(status)) {
                message = this.messageTemplates.getStatusUpdateMessage(orderData);
                messageType = 'status update';
                
            } else if (status === 'delivered') {
                message = this.messageTemplates.getOrderDeliveredMessage(orderData);
                messageType = 'delivery confirmation';
            }

            if (message) {
                await this.queue.add(() => this.whatsappClient.sendMessage(jid, message));
                console.log(`✅ ${messageType} message queued for ${orderData.customer_name} (${orderData.order_id})`);
            }

        } catch (error) {
            console.error('❌ Error processing order:', error.message);
        }
    }
}

// Start the bot
if (require.main === module) {
    const bot = new TailorSheetBot();
    bot.start().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = TailorSheetBot;