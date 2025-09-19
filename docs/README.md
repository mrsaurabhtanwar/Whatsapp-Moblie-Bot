# 🤖 WhatsApp Sheet Bot

A self-hosted WhatsApp notification bot that polls Google Sheets for orders marked "Ready" and sends messages via Baileys (WhatsApp Web). The bot runs on your PC, persists authentication to disk (so QR scan is done only once), queues work, retries on failures, updates the sheet after send, and allows your brother to approve or manually trigger sends via WhatsApp messages.

## ✨ Features

### 🎯 Core Functionality
- **Google Sheets Integration**: Polls sheets for orders with "Ready" status
- **WhatsApp Notifications**: Sends messages via Baileys (WhatsApp Web API)
- **Persistent Authentication**: Saves WhatsApp session to disk (QR scan once)
- **Queue Management**: Redis or in-memory job queue with retry logic
- **Multiple Modes**: AUTO, APPROVAL, and MANUAL operation modes
- **Admin Commands**: Brother can approve/manage via WhatsApp messages

### 🔄 Operation Modes
- **AUTO**: Automatically sends notifications when orders are marked "Ready"
- **APPROVAL**: Sends approval request to admin before sending notifications
- **MANUAL**: Only sends when manually triggered by admin commands

### 🛡️ Reliability Features
- **Auto-Reconnect**: Handles WhatsApp disconnections gracefully
- **Retry Logic**: Configurable retries with exponential backoff
- **Queue Persistence**: Jobs survive bot restarts (with Redis)
- **Error Handling**: Comprehensive logging and error recovery
- **Health Monitoring**: Built-in health checks and status endpoints

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** installed
- **Google Service Account** JSON file
- **Google Sheet** shared with service account email
- **Redis** (optional, but recommended for production)

### 1. Installation

```bash
# Clone or download the project
cd whatsapp-sheet-bot

# Quick setup (automated)
npm run setup

# Or manual setup
npm install
copy .env.example .env
```

### 2. One-Click Deployment

```bash
# For production deployment
npm run deploy

# For monitoring and maintenance
npm run monitor
```

### 3. Configuration

#### Google Sheets Setup
1. Create a Google Service Account:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Sheets API
   - Create Service Account credentials
   - Download the JSON key file

2. Place the service account JSON file as `service-account.json` in the project root

3. Share your Google Sheet with the service account email

#### Environment Configuration
Edit `.env` file with your settings:

```env
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_SHEET_NAME=Sheet1
GOOGLE_SHEET_RANGE=A:Z

# WhatsApp Configuration
WHATSAPP_ADMIN_PHONE=1234567890
WHATSAPP_ADMIN_NAME=Admin

# Bot Operation Mode (AUTO, APPROVAL, MANUAL)
BOT_MODE=AUTO

# Queue Configuration (optional)
REDIS_URL=redis://localhost:6379

# Polling Configuration
POLL_INTERVAL_SECONDS=30
BATCH_SIZE=10

# Notification Settings
SEND_ADMIN_CONFIRMATION=true
ADMIN_CONFIRMATION_DELAY_SECONDS=5

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_SECONDS=30
```

### 3. Google Sheet Format

Your Google Sheet should have these columns:
- `id` or `orderId`: Unique order identifier
- `status`: Order status (bot looks for "Ready")
- `notifiedFlag`: Notification status (bot sets to "Yes" after sending)
- `phone` or `customerPhone`: Customer WhatsApp number
- `customerName` or `name`: Customer name (optional)
- `garment_type` or `item`: Type of garment/item
- `total_amount` or `total`: Total order amount
- `advance_amount` or `advance`: Advance payment received
- `remaining_amount` or `remaining`: Remaining payment
- `delivery_date` or `expected_delivery`: Expected delivery date
- `ready_date`: When order was completed
- `notifiedAt`: Timestamp when notified (auto-filled)
- `notifiedBy`: Who sent the notification (auto-filled)

Example sheet structure:
| id | customerName | phone | garment_type | total_amount | advance_amount | remaining_amount | status | notifiedFlag | notifiedAt | notifiedBy |
|----|--------------|-------|--------------|--------------|----------------|------------------|--------|--------------|------------|------------|
| 12345 | John Doe | 1234567890 | Shirt | 1500 | 500 | 1000 | Ready | | | |

### 4. Running the Bot

#### Development Mode
```bash
npm start
```

#### Production Mode (with PM2)
```bash
npm run pm2:start
```

#### Windows (using batch scripts)
```batch
# Install dependencies
control.bat install

# Start with PM2
control.bat pm2-start

# Share QR code online
control.bat expose
```

### 5. WhatsApp Authentication

1. **Access QR Code**:
   - Local: `http://localhost:3000/qr`
   - Online: Run `control.bat expose` and use the provided URL

2. **Scan QR Code** with WhatsApp mobile app

3. **Wait for Connection**: Bot will show "WhatsApp connected successfully!"

## 📱 Admin Commands

Your brother can send these commands via WhatsApp to the admin number:

| Command | Description | Example |
|---------|-------------|---------|
| `APPROVE #ORDER_ID` | Approve a pending order | `APPROVE #12345` |
| `SEND #ORDER_ID` | Manually send notification | `SEND #12345` |
| `STATUS` | Show bot status | `STATUS` |
| `ORDERS` | Show recent orders | `ORDERS` |
| `QUEUE` | Show queue statistics | `QUEUE` |
| `RESTART` | Restart WhatsApp connection | `RESTART` |
| `HELP` | Show all commands | `HELP` |

## 📝 Message Templates

The bot uses professional message templates in both Hindi and English for different types of notifications:

### Template Types
- **Order Ready**: Notifies customers when their order is ready for pickup
- **Payment Reminder**: Reminds customers about pending payments
- **Welcome Message**: Sent to new customers
- **Pickup Reminder**: Follow-up reminder for uncollected orders
- **Order Confirmation**: Confirms order placement
- **Pickup Complete**: Confirmation when order is collected

### Template Configuration
Configure templates in your `.env` file:

```env
# Message Templates Configuration
DEFAULT_LANGUAGE=hindi
SHOP_NAME=RS Tailor & Fabric
SHOP_PHONE=9876543210
SHOP_ADDRESS=Main Street, City
BUSINESS_HOURS=10:00 AM - 7:00 PM
```

### Template Variables
Templates support dynamic variables that are replaced with actual data:
- `{customer_name}` - Customer's name
- `{order_id}` - Order identifier
- `{garment_type}` - Type of garment
- `{total_amount}` - Total order amount
- `{advance_amount}` - Advance payment
- `{remaining_amount}` - Remaining payment
- `{ready_date}` - Order completion date
- `{shop_name}` - Your shop name
- `{shop_phone}` - Shop contact number
- `{business_hours}` - Operating hours

### Example Templates

**Order Ready (Hindi):**
```
🎉 आपका Order तैयार है ! 🎉

नमस्ते *John Doe* जी 🙏

आपका Shirt बिल्कुल ready है ! ✨
📋 Order ID: 12345
📅 तैयार हुआ: 15 January 2024

💰 Payment Details:
- कुल Amount: ₹1500
- Advance जमा: ₹500
- बाकी Amount: ₹1000

🏪 Pickup Your Order:
- Shop time: 10:00 AM - 7:00 PM
- आज ही आकर ले जाएं !

RS Tailor & Fabric 😊
Phone: 9876543210

⭐ आपका भरोसा हमारे लिए सबकुछ है ! Thank You !
```

**Order Ready (English):**
```
✅ *Your Order is Ready!*

Hello *John Doe*,

Great news! Your order *12345* is ready for pickup! 

📦 *Ready Items:*
• Order ID: 12345
• Garment Type: Shirt
• Ready Date: 15 January 2024

🏪 *Pickup Details:*
• Shop: RS Tailor & Fabric
• Address: Main Street, City
• Contact: 9876543210

Please visit us during business hours to collect your order. We look forward to seeing you! 😊

Best regards,
RS Tailor & Fabric
```

### Customizing Templates

You can customize message templates by modifying the `message-templates.js` file:

1. **Add New Template Types:**
```javascript
// Add to templates object in MessageTemplates class
custom_notification_hindi: `Your custom message in Hindi with {variables}`,
custom_notification_english: `Your custom message in English with {variables}`
```

2. **Update Existing Templates:**
```javascript
// Modify existing templates in the templates object
order_ready_hindi: `Your updated template with {customer_name} and {order_id}`
```

3. **Add New Template Methods:**
```javascript
// Add new methods to MessageTemplates class
getCustomNotificationMessage(data, language = null) {
    return this.formatTemplate('custom_notification', data, language);
}
```

4. **Use Custom Templates in WhatsApp Client:**
```javascript
// Add new methods to WhatsAppClient class
async sendCustomNotification(customerPhone, orderData) {
    const templateData = { /* your data */ };
    const message = this.templates.getCustomNotificationMessage(templateData);
    return await this.sendMessage(customerPhone, message);
}
```

### Template Testing

Use the API endpoints to test your templates:

```bash
# Test template preview
curl -X POST http://localhost:3000/templates/preview \
  -H "Content-Type: application/json" \
  -d '{
    "templateType": "your_template_type",
    "language": "hindi",
    "data": { /* test data */ }
  }'

# Send test message
curl -X POST http://localhost:3000/templates/test \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "test_phone",
    "templateType": "your_template_type",
    "data": { /* test data */ }
  }'
```

## 🔧 Configuration Details

### Bot Modes

#### AUTO Mode
- Automatically sends notifications when orders are marked "Ready"
- No manual intervention required
- Best for high-volume, automated operations

#### APPROVAL Mode
- Sends approval request to admin for each "Ready" order
- Admin must reply with `APPROVE #ORDER_ID` to send notification
- Good for quality control and manual oversight

#### MANUAL Mode
- Only sends notifications when manually triggered
- Admin sends `SEND #ORDER_ID` to trigger specific orders
- Perfect for low-volume or on-demand operations

### Queue Configuration

#### With Redis (Recommended)
```env
REDIS_URL=redis://localhost:6379
```
- Jobs persist across bot restarts
- Better performance for high volume
- Multiple bot instances support

#### Without Redis (In-Memory)
- Remove or comment out `REDIS_URL`
- Jobs are lost on bot restart
- Simpler setup, good for testing

### Polling Configuration
```env
POLL_INTERVAL_SECONDS=30  # How often to check for new orders
BATCH_SIZE=10             # Process orders in batches
```

### Retry Configuration
```env
MAX_RETRIES=3              # Maximum retry attempts
RETRY_DELAY_SECONDS=30     # Delay between retries
BACKOFF_MULTIPLIER=2       # Exponential backoff multiplier
```

## 🌐 API Endpoints

The bot provides several HTTP endpoints for monitoring and control:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check and status |
| `/qr` | GET | WhatsApp QR code |
| `/trigger` | POST | Manually trigger polling |
| `/queue` | GET | Queue statistics |
| `/templates` | GET | List available templates |
| `/templates/preview` | POST | Preview template with data |
| `/templates/test` | POST | Send test template message |

### Example API Usage

```bash
# Check bot status
curl http://localhost:3000/

# Get QR code
curl http://localhost:3000/qr

# Trigger manual polling
curl -X POST http://localhost:3000/trigger

# Get queue stats
curl http://localhost:3000/queue

# List available templates
curl http://localhost:3000/templates

# Preview template with sample data
curl -X POST http://localhost:3000/templates/preview \
  -H "Content-Type: application/json" \
  -d '{
    "templateType": "order_ready",
    "language": "hindi",
    "data": {
      "customer_name": "John Doe",
      "order_id": "12345",
      "garment_type": "Shirt",
      "total_amount": "1500",
      "advance_amount": "500",
      "remaining_amount": "1000"
    }
  }'

# Send test template message
curl -X POST http://localhost:3000/templates/test \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "1234567890",
    "templateType": "order_ready",
    "language": "hindi",
    "data": {
      "customer_name": "John Doe",
      "order_id": "12345",
      "garment_type": "Shirt"
    }
  }'
```

## 📊 Monitoring & Logs

### Log Files
- `./logs/bot.log` - Application logs
- `./logs/out.log` - PM2 output logs
- `./logs/err.log` - PM2 error logs
- `./logs/combined.log` - Combined PM2 logs

### PM2 Commands
```bash
# View logs
npm run pm2:logs

# Check status
npm run pm2:status

# Restart bot
npm run pm2:restart

# Stop bot
npm run pm2:stop
```

### Health Monitoring
```bash
# Check if bot is running
curl http://localhost:3000/

# Response includes:
# - WhatsApp connection status
# - Google Sheets connection status
# - Queue statistics
# - Polling status
# - Current bot mode
```

## 🔒 Security Considerations

### Service Account Security
- Keep `service-account.json` secure and never commit to version control
- Use environment variables for sensitive configuration
- Regularly rotate service account keys

### WhatsApp Security
- Authentication is stored in `./baileys_auth/` directory
- Keep this directory secure and backed up
- The bot uses official WhatsApp Web protocol

### Network Security
- Bot runs on localhost by default
- Use reverse proxy (nginx) for external access
- Consider VPN for remote administration

## 🛠️ Troubleshooting

### Common Issues

#### Bot Not Connecting to WhatsApp
```bash
# Clean authentication and restart
rm -rf ./baileys_auth
npm run pm2:restart
```

#### Google Sheets Access Denied
1. Verify service account JSON file is in project root
2. Check that sheet is shared with service account email
3. Ensure Google Sheets API is enabled

#### Queue Jobs Not Processing
```bash
# Check Redis connection
redis-cli ping

# View queue statistics
curl http://localhost:3000/queue

# Check logs for errors
npm run pm2:logs
```

#### Orders Not Being Detected
1. Verify sheet column names match configuration
2. Check that orders have `status = "Ready"`
3. Ensure `notifiedFlag` is not "Yes"
4. Test with manual trigger: `curl -X POST http://localhost:3000/trigger`

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm start
```

### Reset Everything
```bash
# Stop bot
npm run pm2:stop

# Clean authentication
rm -rf ./baileys_auth

# Clean logs
rm -rf ./logs

# Reinstall dependencies
rm -rf node_modules
npm install

# Restart
npm run pm2:start
```

## 📁 Project Structure

```
whatsapp-sheet-bot/
├── worker.js                 # Main application file
├── sheets.js                 # Google Sheets helper
├── whatsapp-client-baileys.js # WhatsApp client wrapper
├── admin-commands.js         # Admin command handlers
├── package.json              # Dependencies and scripts
├── ecosystem.config.js       # PM2 configuration
├── .env.example             # Environment configuration template
├── service-account.json     # Google service account (user-provided)
├── README.md                # This file
├── logs/                    # Log files
├── baileys_auth/           # WhatsApp authentication data
└── control.bat             # Windows control script
```

## 🚀 Deployment Options

### Local Development
```bash
npm start
```

### Production with PM2
```bash
npm run pm2:start
```

### Docker (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Systemd Service (Linux)
```ini
[Unit]
Description=WhatsApp Sheet Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/whatsapp-sheet-bot
ExecStart=/usr/bin/node worker.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

If you encounter issues:

1. Check the logs: `npm run pm2:logs`
2. Verify configuration in `.env`
3. Test Google Sheets access manually
4. Check WhatsApp connection status
5. Review troubleshooting section above

## 🎉 Success!

Once everything is set up, your bot will:

- ✅ Poll Google Sheets every 30 seconds (configurable)
- ✅ Detect orders marked "Ready" with `notifiedFlag ≠ "Yes"`
- ✅ Queue notification jobs with retry logic
- ✅ Send WhatsApp messages via Baileys
- ✅ Update sheet with notification status
- ✅ Handle admin commands via WhatsApp
- ✅ Provide health monitoring endpoints
- ✅ Persist authentication across restarts
- ✅ Run 24/7 with PM2 process management

## 🚀 Production Deployment

### Automated Deployment Scripts

We've created several scripts to make deployment easy:

#### 1. Quick Setup
```bash
# Automated setup and dependency installation
npm run setup
```

#### 2. Production Deployment
```bash
# Deploy with PM2 for production
npm run deploy
```

#### 3. Monitoring & Maintenance
```bash
# Interactive monitoring dashboard
npm run monitor
```

### Manual Deployment Steps

#### Step 1: Environment Setup
1. **Install Node.js 18+** from [nodejs.org](https://nodejs.org/)
2. **Install dependencies**: `npm install`
3. **Configure environment**: Edit `.env` file
4. **Add service account**: Place `service-account.json` in project root

#### Step 2: Google Sheets Setup
1. **Create Google Cloud Project**
2. **Enable Google Sheets API**
3. **Create Service Account** and download JSON key
4. **Create Google Sheet** with required columns
5. **Share sheet** with service account email

#### Step 3: WhatsApp Authentication
1. **Start bot**: `npm start`
2. **Scan QR code**: Visit `http://localhost:3000/qr`
3. **Wait for connection**: "WhatsApp connected successfully!"

#### Step 4: Production Setup
1. **Install PM2**: `npm install -g pm2`
2. **Start with PM2**: `npm run pm2:start`
3. **Save configuration**: `pm2 save`
4. **Enable auto-start**: `pm2 startup`

### Long-Term Reliability

#### Auto-Start Configuration
```bash
# Save PM2 processes
pm2 save

# Generate startup script
pm2 startup

# Follow instructions (run as Administrator)
```

#### Monitoring Commands
```bash
# Check bot status
npm run pm2:status

# View logs
npm run pm2:logs

# Check health
npm run health

# Check queue
npm run queue

# View templates
npm run templates
```

#### Maintenance Schedule
- **Daily**: Check bot status with `npm run pm2:status`
- **Weekly**: Restart bot with `npm run pm2:restart`
- **Monthly**: Update dependencies and clean logs

### Troubleshooting

#### Common Issues
1. **Bot not connecting**: Clean auth with `rmdir /s /q baileys_auth`
2. **Google Sheets access denied**: Verify service account and sheet sharing
3. **Bot stops working**: Check logs with `npm run pm2:logs`
4. **Memory issues**: Restart with `npm run pm2:restart`

#### Emergency Commands
```bash
# Stop bot
npm run pm2:stop

# Clean restart
npm run pm2:stop
rmdir /s /q baileys_auth
npm run pm2:start

# View error logs only
pm2 logs whatsapp-sheet-bot --err
```

### Performance Optimization

#### For High Volume (100+ orders/day)
- Enable Redis: Set `REDIS_URL=redis://localhost:6379`
- Increase batch size: `BATCH_SIZE=20`
- Reduce polling: `POLL_INTERVAL_SECONDS=15`

#### For Low Volume (< 50 orders/day)
- Use in-memory queue: Remove `REDIS_URL`
- Increase polling: `POLL_INTERVAL_SECONDS=60`
- Smaller batches: `BATCH_SIZE=5`

---

## 📚 Additional Resources

- **DEPLOYMENT-GUIDE.md** - Detailed deployment instructions
- **Quick Setup**: `npm run setup`
- **Production Deploy**: `npm run deploy`
- **Monitor Bot**: `npm run monitor`

**Happy Botting! 🤖📱📊**