@echo off
echo ========================================
echo    WhatsApp Tailor Bot - Auto Start
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
echo Starting WhatsApp Bot...
echo Dashboard will be available at: http://localhost:3001
echo.
echo Press Ctrl+C to stop the bot
echo.

node main-bot.js

echo.
echo Bot stopped.
pause
