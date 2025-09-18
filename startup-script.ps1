# WhatsApp Bot Auto-Start Script
# This script will start the WhatsApp bot with PM2

Write-Host "Starting WhatsApp Bot..." -ForegroundColor Green

# Change to the bot directory
Set-Location "C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot"

# Start the bot with PM2
pm2 start ecosystem.config.js

Write-Host "WhatsApp Bot started successfully!" -ForegroundColor Green
Write-Host "Bot is now running in the background." -ForegroundColor Yellow
