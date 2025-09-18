# 🚀 WhatsApp Bot Auto-Start Setup Guide

## ✅ PM2 Setup Complete!

Your WhatsApp bot is now running with PM2 and will:
- ✅ **Auto-restart** if it crashes
- ✅ **Persist** across terminal sessions
- ✅ **Log** all activities to files
- ✅ **Monitor** performance and memory usage

## 📋 Current Status

**Bot Status**: ✅ Running with PM2
**Process Name**: `whatsapp-bot`
**Auto-restart**: ✅ Enabled
**Logging**: ✅ Enabled

## 🎯 PM2 Commands

```bash
# Check bot status
pm2 status

# View logs
pm2 logs whatsapp-bot

# Restart bot
pm2 restart whatsapp-bot

# Stop bot
pm2 stop whatsapp-bot

# Start bot
pm2 start whatsapp-bot

# Monitor performance
pm2 monit
```

## 🔄 Auto-Start After System Restart

Since PM2 startup doesn't work on Windows, here are 3 options:

### Option 1: Windows Startup Folder (Easiest - No Admin Required)

1. **Open Startup Folder**:
   - Press `Win + R`, type `shell:startup`, press Enter

2. **Copy the batch file**:
   - Copy `auto-start.bat` from your bot folder to the startup folder
   - The bot will start automatically when you log in

### Option 2: Windows Task Scheduler (Recommended for Always-On)

1. **Open Task Scheduler** (Run as Administrator):
   - Press `Win + R`, type `taskschd.msc`, press Enter

2. **Create Basic Task**:
   - Click "Create Basic Task"
   - Name: "WhatsApp Bot Auto-Start"
   - Description: "Auto-start WhatsApp bot on system boot"

3. **Set Trigger**:
   - Select "When the computer starts"
   - Click Next

4. **Set Action**:
   - Select "Start a program"
   - Program: `C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot\auto-start.bat`
   - Start in: `C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot`

5. **Finish**:
   - Check "Open the Properties dialog"
   - Click Finish
   - In Properties, check "Run with highest privileges"

### Option 3: PowerShell Script (Alternative)

1. **Copy PowerShell script**:
   - Copy `startup-script.ps1` to your startup folder
   - Right-click → "Run with PowerShell"

## 📊 Monitoring

**Dashboard**: http://localhost:3001
**Logs Location**: `./logs/` directory
**PM2 Logs**: `pm2 logs whatsapp-bot`

## 🎉 Production Ready!

Your bot is now **100% production-ready** with:
- ✅ **Auto-restart** on crashes
- ✅ **Persistent** across sessions
- ✅ **Comprehensive logging**
- ✅ **Performance monitoring**
- ✅ **Easy management** with PM2

## 🚨 Important Notes

1. **WhatsApp Connection**: Bot will auto-reconnect to WhatsApp
2. **Google Sheets**: Will continue polling every 3 minutes
3. **Duplicate Prevention**: All data is saved and persistent
4. **Dashboard**: Always available at http://localhost:3001

## 🔧 Troubleshooting

If bot stops:
```bash
pm2 restart whatsapp-bot
```

If PM2 stops:
```bash
pm2 resurrect
```

To check logs:
```bash
pm2 logs whatsapp-bot --lines 50
```

---

**🎯 Your WhatsApp bot is now fully production-ready!** 🚀
