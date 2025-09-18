# 🔄 How to Switch WhatsApp Accounts

## ✅ **Current Status:**
- ✅ **Your session cleared** - Bot is ready for new login
- ✅ **Fresh QR code generated** - Ready for your brother to scan
- ✅ **Bot is running** and waiting for connection

## 📱 **For Your Brother to Login:**

### **Step 1: Get the QR Code**
Your brother can get the QR code in **3 ways**:

1. **Dashboard (Easiest)**:
   - Open: http://localhost:3001
   - Click "QR Code" button
   - Scan the QR code with his WhatsApp

2. **QR Code File**:
   - File saved as: `qr-code.png` in the bot folder
   - Open the image file and scan it

3. **Terminal QR Code**:
   - The QR code is displayed in the terminal logs
   - Can be scanned directly from the terminal

### **Step 2: Scan with WhatsApp**
1. **Open WhatsApp** on your brother's phone
2. **Tap Menu** (3 dots) → **Linked Devices**
3. **Tap "Link a Device"**
4. **Scan the QR code** from the dashboard/file/terminal
5. **Wait for connection** - Bot will show "WhatsApp connected successfully!"

## 🔄 **To Switch Back to Your Account Later:**

### **Method 1: Quick Switch**
```bash
pm2 restart whatsapp-bot
```
Then clear session and restart:
```bash
pm2 stop whatsapp-bot
Remove-Item -Path "baileys_auth" -Recurse -Force
pm2 start ecosystem.config.js
```

### **Method 2: Complete Reset**
```bash
pm2 stop whatsapp-bot
Remove-Item -Path "baileys_auth" -Recurse -Force
Remove-Item -Path "qr-code.png" -Force
pm2 start ecosystem.config.js
```

## 📊 **Current Bot Status:**
- ✅ **Running**: PM2 process active
- ✅ **Waiting**: For WhatsApp connection
- ✅ **QR Code**: Available and ready to scan
- ✅ **Dashboard**: http://localhost:3001

## 🎯 **Next Steps:**
1. **Tell your brother** to scan the QR code
2. **Wait for connection** (usually takes 30-60 seconds)
3. **Bot will start working** with his WhatsApp account
4. **All features work** - messages, Google Sheets, reminders

---

**🎉 Your brother can now scan the QR code and take over the bot!**
