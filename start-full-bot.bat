@echo off
echo ================================================================
echo          🧵 TAILOR WHATSAPP BOT - COMPLETE VERSION 🧵
echo ================================================================
echo.
echo This bot will:
echo ✅ Connect to WhatsApp (scan QR code)
echo ✅ Monitor your Google Sheets for order updates
echo ✅ Send automatic notifications to customers
echo ✅ Handle multiple sheets (Orders, Fabric, Combined)
echo.
echo IMPORTANT:
echo 1. Make sure service-account.json is in this folder
echo 2. Check your .env file has correct Google Sheet IDs
echo 3. Keep WhatsApp Web logged out on your phone
echo 4. Scan QR code when prompted
echo.
echo Web Dashboard will be available at: http://localhost:3000
echo.
pause
echo Starting bot...
node tailor-bot.js
pause