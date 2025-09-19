# 🤖 WhatsApp Sheet Bot - Organized & Enhanced

A self-hosted WhatsApp notification bot that polls Google Sheets for orders and sends messages via Baileys (WhatsApp Web). This version has been completely reorganized for better maintainability and includes enhanced safety features.

## ✨ Features

### 🎯 Core Functionality
- **Google Sheets Integration**: Polls multiple sheets for orders with various statuses
- **WhatsApp Notifications**: Sends messages via Baileys (WhatsApp Web API)
- **Persistent Authentication**: Saves WhatsApp session to disk (QR scan once)
- **Queue Management**: In-memory job queue with retry logic
- **Multiple Authentication Modes**: QR Code + Phone Number pairing
- **Admin Commands**: Manage bot via WhatsApp messages

### 🛡️ Enhanced Safety Features
- **12-Layer Safety System**: Comprehensive duplicate prevention
- **4-Minute Startup Delay**: Prevents accidental message sending
- **Circuit Breaker**: Daily/hourly message limits
- **Kill Switch**: Emergency stop functionality
- **Business Hours Validation**: Only send during configured hours
- **Phone Number Authentication**: Secure pairing code system

### 🔄 Operation Modes
- **AUTO**: Automatically sends notifications when orders are marked "Ready"
- **APPROVAL**: Sends approval request to admin before sending notifications
- **MANUAL**: Only sends when manually triggered by admin commands

## 📁 Project Structure

```
WhatsApp-Bot-Organized/
├── 📁 src/                          # Main source code
│   ├── 📁 core/                     # Core bot functionality
│   │   ├── bot.js                   # Main bot (consolidated)
│   │   ├── whatsapp-client.js       # WhatsApp client
│   │   └── enhanced-whatsapp-client.js
│   ├── 📁 managers/                 # System managers
│   │   ├── duplicate-prevention-manager.js
│   │   ├── enhanced-safety-manager.js
│   │   ├── admin-commands.js
│   │   └── message-templates.js
│   ├── 📁 config/                   # Configuration files
│   │   └── auth-config.js
│   └── 📁 utils/                    # Utility functions
│       └── enhanced-logger.js
├── 📁 scripts/                      # Startup and utility scripts
│   ├── start-bot.bat
│   ├── start-production.bat
│   ├── monitor-bot.bat
│   ├── test-bot.js
│   └── cleanup.js
├── 📁 config/                       # Configuration files
│   ├── ecosystem.config.js
│   └── package.json
├── 📁 data/                         # Data storage
│   ├── 📁 duplicate-prevention-data/
│   ├── 📁 safety-data/
│   └── 📁 baileys_auth/
├── 📁 logs/                         # All log files
├── 📁 docs/                         # Documentation
│   ├── STARTUP-GUIDE.md
│   ├── PHONE_AUTH_IMPLEMENTATION.md
│   └── SAFE-APPROACH-SUMMARY.md
└── 📁 enhanced-systems/             # Enhanced features
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** installed
- **Google Service Account** JSON file
- **Google Sheet** shared with service account email

### 1. Installation

```bash
# Clone or download the project
cd whatsapp-sheet-bot

# Install dependencies
npm install

# Copy environment template
copy .env.example .env
```

### 2. Configuration

Edit `.env` file with your settings:

```env
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_google_sheet_id_here
FABRIC_SHEET_ID=your_fabric_sheet_id_here
COMBINED_SHEET_ID=your_combined_sheet_id_here

# WhatsApp Configuration
WHATSAPP_ADMIN_PHONE=1234567890
WHATSAPP_BROTHER_PHONE=1234567890

# Bot Operation Mode (AUTO, APPROVAL, MANUAL)
BOT_MODE=AUTO

# Safety Configuration
SAFETY_STARTUP_DELAY=240000
SAFETY_DAILY_LIMIT=10
SAFETY_HOURLY_LIMIT=3
```

### 3. Google Sheets Setup

1. Create a Google Service Account:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable Google Sheets API
   - Create Service Account credentials
   - Download the JSON key file

2. Place the service account JSON file as `service-account.json` in the project root

3. Share your Google Sheets with the service account email

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
# Start with PM2
scripts\start-production.bat

# Monitor bot
scripts\monitor-bot.bat
```

### 5. WhatsApp Authentication

1. **Access Dashboard**: `http://localhost:3001`
2. **Scan QR Code** with WhatsApp mobile app
3. **Or Use Phone Authentication**: Enter your phone number for pairing code
4. **Wait for Connection**: Bot will show "WhatsApp connected successfully!"

## 📱 Admin Commands

Send these commands via WhatsApp to the admin number:

| Command | Description | Example |
|---------|-------------|---------|
| `APPROVE #ORDER_ID` | Approve a pending order | `APPROVE #12345` |
| `SEND #ORDER_ID` | Manually send notification | `SEND #12345` |
| `STATUS` | Show bot status | `STATUS` |
| `ORDERS` | Show recent orders | `ORDERS` |
| `QUEUE` | Show queue statistics | `QUEUE` |
| `RESTART` | Restart WhatsApp connection | `RESTART` |
| `HELP` | Show all commands | `HELP` |

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

### Safety Configuration

```env
# Safety System Configuration
SAFETY_STARTUP_DELAY=240000          # 4 minutes startup delay
SAFETY_DAILY_LIMIT=10                # Max messages per day
SAFETY_HOURLY_LIMIT=3                # Max messages per hour
SAFETY_SIMILARITY_THRESHOLD=0.8      # Message similarity threshold
SAFETY_KILL_SWITCH_ENABLED=true      # Enable kill switch
```

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main dashboard |
| `/status` | GET | Bot status and health |
| `/admin/restart` | POST | Restart WhatsApp connection |
| `/start-polling` | POST | Start message polling |
| `/stop-polling` | POST | Stop message polling |

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

## 🛠️ Maintenance

### Cleanup
```bash
# Remove unused files
npm run clean

# Organize project structure
npm run organize
```

### Health Monitoring
```bash
# Check if bot is running
curl http://localhost:3001/status

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
- Authentication is stored in `./data/baileys_auth/` directory
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
rmdir /s /q data\baileys_auth
npm run pm2:restart
```

#### Google Sheets Access Denied
1. Verify service account JSON file is in project root
2. Check that sheet is shared with service account email
3. Ensure Google Sheets API is enabled

#### Queue Jobs Not Processing
```bash
# Check logs for errors
npm run pm2:logs

# Check health endpoint
curl http://localhost:3001/status
```

### Debug Mode
```bash
# Enable debug logging
set LOG_LEVEL=debug
npm start
```

### Reset Everything
```bash
# Stop bot
npm run pm2:stop

# Clean authentication
rmdir /s /q data\baileys_auth

# Clean logs
rmdir /s /q logs

# Reinstall dependencies
rmdir /s /q node_modules
npm install

# Restart
npm run pm2:start
```

## 🚀 Production Deployment

### Automated Deployment Scripts

```bash
# For production deployment
npm run deploy

# For monitoring and maintenance
npm run monitor
```

### Long-Term Reliability

#### Auto-Start Configuration
```bash
# Save PM2 processes
pm2 save

# Generate startup script
pm2 startup

# Follow instructions (run as Administrator)
```

#### Maintenance Schedule
- **Daily**: Check bot status with `npm run pm2:status`
- **Weekly**: Restart bot with `npm run pm2:restart`
- **Monthly**: Update dependencies and clean logs

## 📚 Additional Resources

- **docs/STARTUP-GUIDE.md** - Detailed startup instructions
- **docs/PHONE_AUTH_IMPLEMENTATION.md** - Phone authentication guide
- **docs/SAFE-APPROACH-SUMMARY.md** - Safety features overview
- **enhanced-systems/** - Advanced features and integrations

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

- ✅ Poll Google Sheets every 3 minutes (configurable)
- ✅ Detect orders with various statuses
- ✅ Queue notification jobs with retry logic
- ✅ Send WhatsApp messages via Baileys
- ✅ Update sheet with notification status
- ✅ Handle admin commands via WhatsApp
- ✅ Provide health monitoring endpoints
- ✅ Persist authentication across restarts
- ✅ Run 24/7 with PM2 process management
- ✅ Use 12-layer safety system to prevent duplicates

**Happy Botting! 🤖📱📊**
