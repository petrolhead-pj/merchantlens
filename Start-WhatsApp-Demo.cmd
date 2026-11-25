@echo off
cd /d "%~dp0"
echo Connecting WhatsApp Web. Keep this window open.
echo Open http://127.0.0.1:4180/whatsapp-connect.html to scan the QR.
call Start-Latest-MerchantLens.cmd --whatsapp-web
