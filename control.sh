#!/bin/bash

# WhatsApp Bot Control Script for Termux
# Simple commands to manage the bot

case "$1" in
    "start")
        echo "🚀 Starting WhatsApp Bot..."
        chmod +x start.sh
        ./start.sh
        ;;
    "pm2-start")
        echo "🚀 Starting WhatsApp Bot with PM2..."
        if ! command -v pm2 &> /dev/null; then
            echo "📦 Installing PM2..."
            npm install -g pm2
        fi
        pm2 start ecosystem.config.js
        pm2 save
        echo "✅ Bot started with PM2"
        echo "📊 Check status: ./control.sh status"
        ;;
    "stop")
        echo "🛑 Stopping WhatsApp Bot..."
        if command -v pm2 &> /dev/null; then
            pm2 stop whatsapp-bot
            echo "✅ Bot stopped"
        else
            echo "❌ PM2 not found. Kill the process manually with Ctrl+C"
        fi
        ;;
    "restart")
        echo "🔄 Restarting WhatsApp Bot..."
        if command -v pm2 &> /dev/null; then
            pm2 restart whatsapp-bot
            echo "✅ Bot restarted"
        else
            echo "❌ PM2 not found. Please restart manually"
        fi
        ;;
    "status")
        echo "📊 WhatsApp Bot Status:"
        if command -v pm2 &> /dev/null; then
            pm2 status
        else
            echo "❌ PM2 not installed. Install with: npm install -g pm2"
        fi
        ;;
    "logs")
        echo "📋 WhatsApp Bot Logs:"
        if command -v pm2 &> /dev/null; then
            pm2 logs whatsapp-bot --lines 50
        else
            echo "❌ PM2 not installed. Install with: npm install -g pm2"
        fi
        ;;
    "install")
        echo "📦 Installing dependencies..."
        npm install
        if ! command -v pm2 &> /dev/null; then
            echo "📦 Installing PM2..."
            npm install -g pm2
        fi
        echo "✅ Installation complete"
        ;;
    "clean")
        echo "🧹 Cleaning session data..."
        rm -rf whatsapp-sessions
        rm -f qr-code.png
        echo "✅ Session data cleaned"
        ;;
    "kill-port")
        echo "🔪 Killing processes on port 3000..."
        if command -v netstat &> /dev/null; then
            # Find and kill process using port 3000
            PID=$(netstat -ano | findstr :3000 | awk '{print $5}' | head -1)
            if [ ! -z "$PID" ]; then
                echo "🔪 Killing process $PID on port 3000..."
                taskkill /PID $PID /F
                echo "✅ Process killed"
            else
                echo "✅ No process found on port 3000"
            fi
        else
            echo "❌ netstat not available. Please kill processes manually."
        fi
        ;;
    "expose")
        echo "🌐 Exposing bot to internet for QR sharing..."
        chmod +x expose-simple.sh
        ./expose-simple.sh
        ;;
    "help"|"")
        echo "🤖 WhatsApp Bot Control Commands:"
        echo ""
        echo "  ./control.sh install     - Install dependencies"
        echo "  ./control.sh start       - Start bot (simple mode)"
        echo "  ./control.sh pm2-start   - Start bot with PM2 (recommended)"
        echo "  ./control.sh stop        - Stop bot"
        echo "  ./control.sh restart     - Restart bot"
        echo "  ./control.sh status      - Check bot status"
        echo "  ./control.sh logs        - View bot logs"
        echo "  ./control.sh clean       - Clean session data"
        echo "  ./control.sh kill-port   - Kill processes on port 3000"
        echo "  ./control.sh expose      - Expose bot to internet (for QR sharing)"
        echo "  ./control.sh help        - Show this help"
        echo ""
        echo "📱 Quick Start:"
        echo "  1. ./control.sh install"
        echo "  2. ./control.sh pm2-start"
        echo "  3. ./control.sh expose (to share QR code)"
        echo "  4. Scan QR code from the exposed URL"
        echo ""
        echo "🔗 Local URLs:"
        echo "  Health Check: http://localhost:3000/"
        echo "  QR Code: http://localhost:3000/qr"
        echo "  Statistics: http://localhost:3000/stats"
        echo ""
        echo "🌐 Internet Access:"
        echo "  Use './control.sh expose' to get a public URL for QR sharing"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run './control.sh help' for available commands"
        ;;
esac
