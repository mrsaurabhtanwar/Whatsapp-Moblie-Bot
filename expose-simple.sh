#!/bin/bash

# Simple Bot Expose Script - Alternative methods

echo "🌐 Exposing WhatsApp Bot to Internet..."
echo "Choose your method:"
echo "1. ngrok (Recommended)"
echo "2. serveo.net (No installation needed)"
echo "3. localtunnel (npm package)"
echo ""

read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo "🚀 Using ngrok..."
        if ! command -v ngrok &> /dev/null; then
            echo "📦 Installing ngrok..."
            pkg install ngrok
        fi
        echo "🌐 Starting ngrok tunnel..."
        echo "📱 Share the HTTPS URL with anyone to access QR code"
        ngrok http 3000
        ;;
    2)
        echo "🚀 Using serveo.net..."
        echo "🌐 Starting serveo tunnel..."
        echo "📱 Share the HTTPS URL with anyone to access QR code"
        ssh -R 80:localhost:3000 serveo.net
        ;;
    3)
        echo "🚀 Using localtunnel..."
        if ! command -v lt &> /dev/null; then
            echo "📦 Installing localtunnel..."
            npm install -g localtunnel
        fi
        echo "🌐 Starting localtunnel..."
        echo "📱 Share the HTTPS URL with anyone to access QR code"
        lt --port 3000
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac
