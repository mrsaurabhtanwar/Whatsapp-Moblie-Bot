@echo off
echo Starting WhatsApp Bot with PM2...
cd /d "C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot"
pm2 start ecosystem.config.js
echo Bot started successfully!
echo Bot will now run in the background.
pause
