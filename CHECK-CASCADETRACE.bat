@echo off
setlocal
cd /d "%~dp0"

echo Checking CascadeTrace environment...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0doctor.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Resolve the failed checks above, then run this file again.
)
pause
exit /b %EXIT_CODE%
