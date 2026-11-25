@echo off
setlocal
cd /d "%~dp0.."
call Start-Latest-MerchantLens.cmd --background >> ".demo-tools\product\scheduled-server.log" 2>&1
exit /b %errorlevel%
