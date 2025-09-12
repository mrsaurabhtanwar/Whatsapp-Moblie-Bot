# 🤖 WhatsApp Bot - Robust & Simple

A powerful, robust WhatsApp bot designed specifically for Termux/Android devices. Perfect for tailor shop management, order notifications, and customer communication.

## ✨ Features

- 📱 **Termux Optimized**: Built specifically for Android/Termux
- 🔄 **Auto-Reconnect**: Handles disconnections gracefully
- 🏪 **Shop Hours**: Configurable business hours (10 AM - 9 PM)
- 💬 **Auto-Reply**: Smart responses to common queries
- 📊 **Statistics**: Track messages sent/received
- 🛡️ **Robust**: Handles network issues and session management
- 🌐 **Web Interface**: Health checks, QR code, and statistics
- 📨 **Webhook Support**: Order-ready notifications

## 🚀 Quick Start for Termux

### 1. Install Dependencies
```bash
# Update Termux
pkg update && pkg upgrade

# Install Node.js and npm
pkg install nodejs npm

# Install git (if needed)
pkg install git
```

### 2. Setup Bot
```bash
# Make scripts executable
chmod +x control.sh start.sh

# Install bot dependencies
./control.sh install
```

### 3. Start Bot
```bash
# Start with PM2 (recommended for 24/7 operation)
./control.sh pm2-start

# OR start simple mode
./control.sh start
```

### 4. Login to WhatsApp
**Option A - Local Access:**
1. Open browser: `http://localhost:3000/qr`
2. Scan QR code with WhatsApp

**Option B - Share QR Code (Internet Access):**
1. Run: `./control.sh expose`
2. Choose option 1 (ngrok) or 2 (serveo)
3. Share the HTTPS URL with anyone
4. QR Code will be at: `https://your-url.ngrok.io/qr`

Wait for "✅ WhatsApp connected successfully!" message

## 📱 Simple Commands

| Command | Description |
|---------|-------------|
| `./control.sh install` | Install all dependencies |
| `./control.sh pm2-start` | Start bot with PM2 (24/7) |
| `./control.sh start` | Start bot in simple mode |
| `./control.sh stop` | Stop the bot |
| `./control.sh restart` | Restart the bot |
| `./control.sh status` | Check bot status |
| `./control.sh logs` | View bot logs |
| `./control.sh clean` | Clean session data |
| `./control.sh expose` | Expose bot to internet (for QR sharing) |
| `./control.sh help` | Show all commands |

## 🌐 Web Interface

Once the bot is running, access these URLs:

- **Health Check**: `http://localhost:3000/`
- **QR Code**: `http://localhost:3000/qr`
- **Statistics**: `http://localhost:3000/stats`

## 🌍 Expose Bot to Internet (QR Sharing)

To share the QR code with others or access it remotely:

### Quick Method:
```bash
./control.sh expose
```

### Available Options:
1. **ngrok** (Recommended) - Professional tunneling service
2. **serveo.net** - No installation needed, uses SSH
3. **localtunnel** - npm package for tunneling

### Example URLs:
- **ngrok**: `https://abc123.ngrok.io/qr`
- **serveo**: `https://abc123.serveo.net/qr`
- **localtunnel**: `https://abc123.loca.lt/qr`

### Setup ngrok (Optional):
```bash
# Install ngrok for better performance
chmod +x setup-ngrok.sh
./setup-ngrok.sh
```

## 📨 API Endpoints

### Send Message
```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "1234567890", "message": "Hello from bot!"}'
```

### Order Ready Webhook
```bash
curl -X POST http://localhost:3000/webhook/order-ready \
  -H "Content-Type: application/json" \
  -d '{
    "customerPhone": "1234567890",
    "message": "Your order is ready for pickup!",
    "orderId": "ORD-123"
  }'
```

## ⚙️ Configuration

### Environment Variables
```bash
# Enable 24/7 mode (bypass shop hours)
export FORCE_24_7=true

# Set custom port
export PORT=3000
```

### Shop Hours
The bot operates during shop hours (10 AM - 9 PM) by default. To run 24/7:
```bash
export FORCE_24_7=true
./control.sh restart
```

## 🔧 Troubleshooting

### Bot Not Connecting
```bash
# Clean session and restart
./control.sh clean
./control.sh restart
```

### Check Bot Status
```bash
# View status
./control.sh status

# View logs
./control.sh logs
```

### Reset Everything
```bash
# Stop bot
./control.sh stop

# Clean everything
./control.sh clean
rm -rf node_modules

# Reinstall and start
./control.sh install
./control.sh pm2-start
```

## 📊 Monitoring

### Check Statistics
```bash
curl http://localhost:3000/stats
```

### Health Check
```bash
curl http://localhost:3000/
```

## 🛡️ Security Features

- **Session Persistence**: Survives restarts and network issues
- **Auto-Reconnect**: Handles disconnections gracefully
- **Phone Verification**: Verifies numbers before sending messages
- **Rate Limiting**: Built-in protection against spam
- **Error Handling**: Comprehensive error handling and logging

## 📁 Project Structure

```
├── bot.js                 # Main bot application
├── package.json           # Dependencies
├── ecosystem.config.js    # PM2 configuration
├── control.sh            # Control script
├── start.sh              # Startup script
├── README.md             # This file
├── whatsapp-sessions/    # WhatsApp session data
└── logs/                 # Log files
```

## 🎯 Use Cases

- **Tailor Shop**: Order notifications, pickup reminders
- **Restaurant**: Order ready notifications
- **Service Business**: Appointment reminders
- **E-commerce**: Order status updates
- **Customer Support**: Automated responses

## 📱 Termux Tips

1. **Keep Termux Running**: Use `termux-wake-lock` to prevent sleep
2. **Background Operation**: Use PM2 for 24/7 operation
3. **Network**: Ensure stable internet connection
4. **Battery**: Keep device charged for continuous operation

## 🔄 Auto-Start on Boot

To start the bot automatically when Termux starts:

```bash
# Create startup script
echo 'cd /path/to/your/bot && ./control.sh pm2-start' > ~/.termux/boot/start-bot.sh
chmod +x ~/.termux/boot/start-bot.sh
```

## 📞 Support

If you encounter any issues:

1. Check the logs: `./control.sh logs`
2. Verify status: `./control.sh status`
3. Clean and restart: `./control.sh clean && ./control.sh restart`
4. Check network connection
5. Ensure WhatsApp is working on your phone

## 🎉 Success!

Your WhatsApp bot is now running! 

- ✅ **Connected**: Bot is connected to WhatsApp
- ✅ **24/7 Ready**: Can run continuously with PM2
- ✅ **Web Interface**: Access health checks and QR code
- ✅ **API Ready**: Send messages via webhook or API

**Happy Botting! 🤖📱**
