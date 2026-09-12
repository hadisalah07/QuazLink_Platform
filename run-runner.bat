@echo off
title QuazLink Desktop Automation Runner - v26.9.0
echo =====================================================
echo    🚀 QuazLink Local Desktop Automation Runner
echo    Version: v.26.9.0 • Zero-Ban Node Engine
echo =====================================================
echo.
cd /d "%~dp0apps\desktop-agent"
npx tsx src/cli.ts
pause
