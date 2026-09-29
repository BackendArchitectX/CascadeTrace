@echo off
setlocal
cd /d "%~dp0"

echo Starting CascadeTrace...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo CascadeTrace could not start. See the error above.
  pause
)

exit /b %EXIT_CODE%
