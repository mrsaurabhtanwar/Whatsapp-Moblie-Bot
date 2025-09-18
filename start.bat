@echo off
setlocal enabledelayedexpansion

REM WhatsApp Bot Startup Script for Windows
REM Simple and robust startup script

echo 🚀 Starting WhatsApp Bot...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed successfully
)

REM Create necessary directories
if not exist "whatsapp-sessions" mkdir whatsapp-sessions
if not exist "logs" mkdir logs
if not exist "pending-messages" mkdir pending-messages

REM Set environment variables
set FORCE_24_7=true
set PORT=3001
set NODE_ENV=production

echo 🔧 Environment configured:
echo    - FORCE_24_7: %FORCE_24_7%
echo    - PORT: %PORT%
echo    - NODE_ENV: %NODE_ENV%

REM Check for pending messages
if exist "pending-messages\queue.json" (
    echo 📨 Found pending messages to send...
    echo    Processing pending messages on startup...
)

REM Start the bot
echo 🤖 Starting WhatsApp Bot...
echo 📱 Scan QR code when it appears
echo 🔗 Health check: http://localhost:3001/
echo 📷 QR Code: http://localhost:3001/qr
echo.
echo Press Ctrl+C to stop the bot
echo.

REM Start with PM2 if available, otherwise use node directly
where pm2 >nul 2>nul
if %errorlevel% equ 0 (
    echo 🚀 Starting with PM2 for better stability...
    pm2 start ecosystem.config.js
    pm2 logs whatsapp-sheet-bot
) else (
    echo 🚀 Starting with Node.js directly...
    node worker.js
)

endlocal

