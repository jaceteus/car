@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "PORT=8123"
set "URL=http://127.0.0.1:%PORT%/index.html"
title Slicks and Slides - Launcher

echo.
echo  ============================================
echo   SLICKS ^& SLIDES - local launcher
echo  ============================================
echo.
echo  Starting local server on port %PORT% ...
echo  A minimised server window will stay open while you play.
echo  Close that window when you are finished.
echo.

start "Slicks and Slides server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port %PORT%
timeout /t 2 /nobreak >nul

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%PORT%/index.html' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1" >nul 2>nul
if errorlevel 1 (
    echo  Server did not start. Opening the game file directly instead...
    start "" "%~dp0index.html"
) else (
    start "" "%URL%"
)

timeout /t 3 /nobreak >nul
exit /b 0
