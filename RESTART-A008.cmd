@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart-a008.ps1" %*
echo.
pause
