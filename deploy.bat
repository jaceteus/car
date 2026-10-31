@echo off
setlocal EnableExtensions
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
    echo Deployment failed. Check the message above.
) else (
    echo Deployment complete. GitHub Pages will update shortly.
)
echo.
pause
exit /b %EXIT_CODE%
