@echo off
setlocal
cd /d "%~dp0"
echo Finding a private Wi-Fi address for phone checkout...
echo The phone must use the same Wi-Fi or hotspot as this laptop.
node -e "const os=require('os');const fs=require('fs');const list=Object.entries(os.networkInterfaces()).flatMap(([name,items])=>(items||[]).map(x=>({...x,name}))).filter(x=>x.family==='IPv4'&&!x.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address));const picked=list.find(x=>x.address==='192.168.137.1'&&/Local Area Connection|Wi-Fi Direct/i.test(x.name))||list.find(x=>/wi-?fi|wireless|wlan/i.test(x.name))||list.find(x=>!/virtual|vEthernet|wsl|docker|tailscale/i.test(x.name));if(!picked){console.error('No private Wi-Fi address found. Connect to Wi-Fi or a hotspot.');process.exit(1)};fs.mkdirSync('.demo-tools',{recursive:true});fs.writeFileSync('.demo-tools/phone-host.txt',picked.address);console.log('Phone checkout host: '+picked.address)"
if errorlevel 1 (
  pause
  exit /b 1
)
call Start-Latest-MerchantLens.cmd %*
