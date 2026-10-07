@echo off
title QuazLink POS & ERP — Desktop Native App
echo =====================================================
echo    ⚡ QuazLink Enterprise POS & Retail Engine
echo    Desktop Native Application • Hardware Acceleration
echo =====================================================
echo.
cd /d "%~dp0apps\pos-client"
if not exist "dist\electron\main.js" (
    echo [*] Building POS client assets...
    call npm run build
)
echo [*] Launching Native Desktop Window...
npx electron dist/electron/main.js
