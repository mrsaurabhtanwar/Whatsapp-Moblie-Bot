@echo off
echo ========================================
echo   WhatsApp Tailor Bot - Monitor
echo ========================================
echo.

echo Checking bot status...
pm2 status

echo.
echo Recent logs (last 50 lines):
echo ========================================
pm2 logs whatsapp-sheet-bot --lines 50

echo.
echo Dashboard: http://localhost:3001
echo.
echo Commands:
echo   pm2 restart whatsapp-sheet-bot - Restart bot
echo   pm2 stop whatsapp-sheet-bot    - Stop bot
echo   pm2 logs whatsapp-sheet-bot    - View all logs
echo   pm2 monit                      - Open monitoring dashboard
echo.

pause
