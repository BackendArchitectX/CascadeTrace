@echo off
setlocal
cd /d "%~dp0"

echo Stopping CascadeTrace...
docker compose down
set EXIT_CODE=%ERRORLEVEL%

if "%EXIT_CODE%"=="0" (
  echo CascadeTrace stopped. PostgreSQL data was preserved.
) else (
  echo Failed to stop CascadeTrace.
  pause
)

exit /b %EXIT_CODE%
