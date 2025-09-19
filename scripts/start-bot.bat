@echo off
echo Starting Enhanced WhatsApp Bot (with 12-layer safety system) via PM2...
cd /d "C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot"
pm2 start src/core/bot.js --name "whatsapp-bot-enhanced"
echo Enhanced Bot started successfully!
echo Navigate to http://localhost:3001 for dashboard
pause