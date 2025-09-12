#!/bin/bash

# WhatsApp Bot Expose Script for Termux
# Exposes the bot to internet for QR code sharing

echo "🌐 Exposing WhatsApp Bot to Internet..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "📦 Installing ngrok..."
    
    # Download ngrok for Android
    wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.tgz
    
    # Extract ngrok
    tar -xzf ngrok-v3-stable-linux-arm64.tgz
    
    # Make executable
    chmod +x ngrok
    
    # Move to bin directory
    mv ngrok /data/data/com.termux/files/usr/bin/
    
    # Clean up
    rm ngrok-v3-stable-linux-arm64.tgz
    
    echo "✅ ngrok installed successfully"
fi

# Check if bot is running
if ! curl -s http://localhost:3000/ > /dev/null; then
    echo "❌ Bot is not running. Please start the bot first:"
    echo "   ./control.sh pm2-start"
    exit 1
fi

echo "🚀 Starting ngrok tunnel..."
echo "📱 Your bot will be accessible from anywhere!"
echo ""

# Start ngrok tunnel
ngrok http 3000 --log=stdout
