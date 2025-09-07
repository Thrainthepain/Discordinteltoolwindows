@echo off
setlocal

echo =====================================
echo    EVE Online Intel Monitor Client
echo =====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please download and install Node.js from: https://nodejs.org/
    echo Then restart this script.
    echo.
    pause
    exit /b 1
)

REM Display Node.js version
echo Node.js version:
node --version
echo.

REM Check if the monitor script exists
if not exist "simple-intel-monitor.js" (
    echo ERROR: simple-intel-monitor.js not found!
    echo Please make sure all files are in the same directory.
    echo.
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    echo.
    npm install chokidar
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
    echo.
)

REM Test connection first
echo Testing connection to server...
node simple-intel-monitor.js test
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Cannot connect to server
    echo Please check your internet connection and configuration.
    echo.
    pause
    exit /b 1
)

echo.
echo Starting EVE Intel Monitor...
echo.
echo Press Ctrl+C to stop the monitor
echo.

REM Start the monitor
node simple-intel-monitor.js

echo.
echo Intel Monitor stopped.
pause
