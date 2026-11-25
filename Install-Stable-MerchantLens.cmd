@echo off
setlocal
cd /d "%~dp0"
set "ML_TASK_ROOT=%~dp0"
if not exist .demo-tools\product mkdir .demo-tools\product
copy /y scripts\run-stable-merchantlens.cmd .demo-tools\run-stable-merchantlens.cmd >nul
if errorlevel 1 exit /b 1
echo Setting up MerchantLens to run when you sign in to Windows.
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $name='MerchantLens Local Demo'; $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name; $root=$env:ML_TASK_ROOT; $runner=Join-Path $root '.demo-tools\run-stable-merchantlens.cmd'; $action=New-ScheduledTaskAction -Execute $env:ComSpec -Argument ('/d /c ' + [char]34 + [char]34 + $runner + [char]34 + [char]34) -WorkingDirectory $root; $existing=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue; if ($existing) { if ($existing.Actions.Count -ne 1 -or $existing.Actions[0].Arguments -ne $action.Arguments) { throw 'A task with that name already exists for a different launcher.' } } else { $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user; $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited; $settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew; Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null }; Start-ScheduledTask -TaskName $name; $url='http://127.0.0.1:4180/api/app/analyst/state'; for ($i=0; $i -lt 12; $i++) { try { $state=Invoke-RestMethod -UseBasicParsing -Uri $url -TimeoutSec 2; if ($state.localDemo) { exit 0 } } catch {}; Start-Sleep -Seconds 1 }; throw 'The task started but the app did not respond. See .demo-tools\product\scheduled-server.log.'"
if errorlevel 1 (
  echo.
  echo MerchantLens is not yet running as a scheduled task.
  pause
  exit /b 1
)
echo MerchantLens is running on port 4180.
start "" "http://127.0.0.1:4180/analyst"
