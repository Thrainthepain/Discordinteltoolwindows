@echo off
setlocal

echo =====================================
echo    EVE Online Intel Monitor Client
echo =====================================
echo.

REM --- Configuration ---
set "SCRIPT_NAME=simple-intel-monitor.js"
set "NODE_MODULES_DIR=node_modules"

REM 1. Check for Node.js
echo [1/5] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
echo ERROR: Node.js is not installed or not in your system's PATH.
echo Please install it from https://nodejs.org/ and restart this script.
echo.
pause
exit /b 1
)
node --version
echo.

REM 2. Check for the script file
echo [2/5] Looking for monitor script...
if not exist "%SCRIPT_NAME%" (
echo ERROR: %SCRIPT_NAME% not found!
echo Please make sure this batch file is in the same directory as the script.
echo.
pause
exit /b 1
)
echo Found %SCRIPT_NAME%.
echo.

REM 3. Install dependencies from package.json
echo [3/5] Checking for dependencies...
if not exist "%NODE_MODULES_DIR%" (
echo 'node_modules' directory not found. Installing required packages from package.json...
npm install
if %errorlevel% neq 0 (
echo ERROR: Failed to install dependencies. See errors above.
echo Please check your internet connection and try again.
echo.
pause
exit /b 1
)
echo Dependencies installed successfully.
echo.
) else (
echo Dependencies already installed.
echo.
)

REM 4. Test server connection
echo [4/5] Testing connection to the intel server...
node "%SCRIPT_NAME%" test
if %errorlevel% neq 0 (
echo.
echo ERROR: Connection test failed.
echo Please check your internet connection or firewall settings.
echo.
pause
exit /b 1
)
echo Connection test successful!
echo.

REM 5. Start the monitor
echo [5/5] Starting the EVE Intel Monitor...
echo Press CTRL+C in this window to stop the script.
echo =================================================
echo.

node "%SCRIPT_NAME%" start

echo.
echo =================================================
echo Intel Monitor has stopped.
echo.
pause