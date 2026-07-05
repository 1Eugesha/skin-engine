@echo off
title SkinEngine Dev Server
cd /d "%~dp0"

set PORT=8010

echo ============================================
echo   SkinEngine - local server
echo ============================================
echo.
echo   Demo:     http://localhost:%PORT%/demo.html
echo   Autotest: http://localhost:%PORT%/skin-engine-test.html
echo   Diag:     http://localhost:%PORT%/skin-diag.html
echo.
echo   Close this window to stop the server.
echo ============================================
echo.

start "" "http://localhost:%PORT%/demo.html"

py -m http.server %PORT%
if errorlevel 1 (
    echo.
    echo Python failed, trying Node...
    npx --yes http-server -p %PORT% -c-1
)

pause
