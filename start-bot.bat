@echo off
echo Starting WhatsApp Bot with PM2...
cd /d "C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot"
pm2 start main-bot.js --name "whatsapp-bot"
echo Bot started successfully!
pause