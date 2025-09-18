@echo off
REM PM2 Auto-Start Script for WhatsApp Bot
REM This script will be run by Windows Task Scheduler on startup

echo Starting WhatsApp Bot via PM2...

REM Change to the bot directory
cd /d "C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot"

REM Start PM2 and resurrect saved processes
pm2 resurrect

REM Log the startup
echo WhatsApp Bot started at %date% %time% >> startup.log

REM Keep the window open for a few seconds to see any errors
timeout /t 5 /nobreak >nul
