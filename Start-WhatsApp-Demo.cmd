@echo off
setlocal
cd /d "%~dp0"
if not defined PRODUCT_PORT set "PRODUCT_PORT=4194"
set "WHATSAPP_VISIBLE=1"
echo Open http://127.0.0.1:%PRODUCT_PORT%/whatsapp-connect.html to link the sending phone.
call Start-Phone-QR-Demo.cmd --whatsapp-web
