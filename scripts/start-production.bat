@echo off
echo ========================================
echo  WhatsApp Tailor Bot - Production Start
echo ========================================
echo.

echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found: 
node --version

echo.
echo Checking PM2 installation...
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing PM2 globally...
    npm install -g pm2
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install PM2
        pause
        exit /b 1
    )
)

echo PM2 found:
pm2 --version

echo.
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo.
echo Checking configuration files...
if not exist "service-account.json" (
    echo WARNING: service-account.json not found
    echo Please ensure your Google Service Account file is in the project directory
)

if not exist ".env" (
    echo WARNING: .env file not found
    echo Please ensure your environment configuration file exists
)

echo.
echo Starting WhatsApp Bot with PM2...
pm2 start config/ecosystem.config.js

echo.
echo Bot started successfully!
echo.
echo Useful commands:
echo   pm2 status          - Check bot status
echo   pm2 logs            - View logs
echo   pm2 restart whatsapp-sheet-bot - Restart bot
echo   pm2 stop whatsapp-sheet-bot    - Stop bot
echo   pm2 monit           - Monitor dashboard
echo.
echo Dashboard: http://localhost:3001
echo.

echo Setting up auto-start...
pm2 save
pm2 startup

echo.
echo Production setup complete!
echo The bot will now start automatically when Windows starts.
echo.
pause