@echo off
setlocal
cd /d "%~dp0"
if not defined PRODUCT_PORT set "PRODUCT_PORT=4180"
set "PRODUCT_DEMO_HOST="
if exist ".demo-tools\phone-host.txt" set /p PRODUCT_DEMO_HOST=<".demo-tools\phone-host.txt"
set "PRODUCT_PUBLIC_ORIGIN="
set "MERCHANTLENS_DATA=.demo-tools\product"
set "MERCHANTLENS_TABLE="
set "MERCHANTLENS_LOCAL_DEMO=1"
set "MERCHANTLENS_WHATSAPP="
if /i "%~1"=="--whatsapp-web" set "MERCHANTLENS_WHATSAPP=web"
set "WHATSAPP_TOKEN="
set "WHATSAPP_PHONE_NUMBER_ID="
set "WHATSAPP_ADMIN="
set "WHATSAPP_GRAPH_VERSION="
set "PAYU_MODE="
set "STALL_DIST="
echo Customer: http://127.0.0.1:%PRODUCT_PORT%/customer
echo Merchant: http://127.0.0.1:%PRODUCT_PORT%/merchant
echo Analyst:  http://127.0.0.1:%PRODUCT_PORT%/analyst
echo Leave this window open while using MerchantLens.
powershell.exe -NoProfile -Command "$nodes = @(Get-Command node.exe -All -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source); if (Test-Path -LiteralPath '.demo-tools/node-path.txt') { $nodes += (Get-Content -LiteralPath '.demo-tools/node-path.txt' -Raw).Trim() }; foreach ($candidate in $nodes) { if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) { continue }; & $candidate -e 'require(''node:sqlite'')' 2>$null; if ($LASTEXITCODE -eq 0) { if (Test-Path -LiteralPath '.demo-tools/whatsapp-test.env') { & $candidate '--env-file=.demo-tools/whatsapp-test.env' scripts/product.mjs } else { & $candidate scripts/product.mjs }; exit $LASTEXITCODE } }; Write-Error 'Install Node.js 22.16 or newer, then reopen this launcher.'; exit 1"
if errorlevel 1 (
  if /i not "%~1"=="--background" pause
  exit /b 1
)
