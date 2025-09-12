#!/bin/bash

# WhatsApp Bot Startup Script for Termux
# Simple and robust startup script

echo "🚀 Starting WhatsApp Bot..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Run: pkg install nodejs"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    echo "Run: pkg install npm"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
fi

# Create necessary directories
mkdir -p whatsapp-sessions
mkdir -p logs

# Set environment variables
export FORCE_24_7=true
export PORT=3000

echo "🔧 Environment configured:"
echo "   - FORCE_24_7: $FORCE_24_7"
echo "   - PORT: $PORT"

# Start the bot
echo "🤖 Starting WhatsApp Bot..."
echo "📱 Scan QR code when it appears"
echo "🔗 Health check: http://localhost:3000/"
echo "📷 QR Code: http://localhost:3000/qr"
echo ""
echo "Press Ctrl+C to stop the bot"
echo ""

node bot.js
