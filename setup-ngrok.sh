#!/bin/bash

# ngrok Setup Script for Termux
# Installs and configures ngrok for WhatsApp Bot

echo "🚀 Setting up ngrok for WhatsApp Bot..."

# Check if we're on Termux
if [ ! -d "/data/data/com.termux" ]; then
    echo "❌ This script is designed for Termux. Please run on Termux."
    exit 1
fi

# Update packages
echo "📦 Updating packages..."
pkg update -y

# Install required packages
echo "📦 Installing required packages..."
pkg install -y wget curl unzip

# Download ngrok for Android ARM64
echo "📥 Downloading ngrok..."
cd /data/data/com.termux/files/usr/bin

# Download the latest ngrok for ARM64
wget -O ngrok.zip https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-arm64.zip

# Extract ngrok
echo "📦 Extracting ngrok..."
unzip ngrok.zip

# Make executable
chmod +x ngrok

# Clean up
rm ngrok.zip

echo "✅ ngrok installed successfully!"

# Test ngrok
echo "🧪 Testing ngrok..."
ngrok version

echo ""
echo "🎉 ngrok setup complete!"
echo ""
echo "📱 How to use:"
echo "1. Start your bot: ./control.sh pm2-start"
echo "2. Expose bot: ./control.sh expose"
echo "3. Choose option 1 (ngrok)"
echo "4. Share the HTTPS URL with anyone"
echo ""
echo "🔗 The URL will look like: https://abc123.ngrok.io"
echo "📷 QR Code will be at: https://abc123.ngrok.io/qr"
echo ""
echo "⚠️  Note: Free ngrok URLs change each time you restart"
echo "💡 For permanent URLs, sign up at https://ngrok.com"
