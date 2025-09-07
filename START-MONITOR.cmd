@echo off
title EVE Intel Monitor
echo.
echo ===============================================
echo        EVE INTEL MONITOR LAUNCHER
echo ===============================================
echo.

REM Change to script directory
cd /d "%~dp0"

REM Check for Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found! Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo Node.js: OK

REM Check for npm
echo Checking npm...
call npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found! Please reinstall Node.js.
    echo.
    pause
    exit /b 1
)
echo npm: OK

REM Install dependencies
echo.
echo Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo ERROR: Failed to install dependencies!
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   STARTING EVE INTEL MONITOR
echo ================================================
echo.

REM Start the monitor
node simple-intel-monitor.js

REM Handle exit
echo.
echo Monitor stopped.
pause
