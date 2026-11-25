@echo off
setlocal
cd /d "%~dp0"
set "PRODUCT_PORT=4194"
call Start-Phone-QR-Demo.cmd
