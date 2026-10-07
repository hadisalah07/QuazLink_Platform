@echo off
title QuazLink POS & Retail Engine (Offline-First)
echo =====================================================
echo    ⚡ QuazLink Enterprise POS & Retail Engine
echo    Local-First • Thermal ESC/POS • Barcode Ready
echo =====================================================
echo.
cd /d "%~dp0apps\pos-client"
npx tsx src/main.ts
pause
