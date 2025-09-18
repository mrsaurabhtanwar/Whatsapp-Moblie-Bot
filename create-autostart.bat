@echo off
echo Creating WhatsApp Bot Auto-Start Task...
echo.

REM Create the scheduled task
schtasks /create /tn "WhatsApp Bot Auto Start" /tr "C:\Users\gssai\OneDrive\Desktop\Whatsapp-Moblie-Bot\pm2-startup.bat" /sc onstart /f

if %errorlevel% equ 0 (
    echo ✅ Auto-start task created successfully!
    echo.
    echo Your WhatsApp bot will now start automatically when Windows boots.
    echo.
    echo To test: Restart your computer and check if the bot starts.
    echo To check status: pm2 status
    echo To disable: schtasks /delete /tn "WhatsApp Bot Auto Start" /f
) else (
    echo ❌ Failed to create auto-start task.
    echo Please run this script as Administrator.
    echo.
    echo Right-click on this file and select "Run as administrator"
)

pause
