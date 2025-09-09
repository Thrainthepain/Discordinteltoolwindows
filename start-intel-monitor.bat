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

REM First try the standard node command
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js found: 
    node --version
    echo.
    goto :nodejs_found
)

REM If node command failed, try common installation paths
echo Node.js not found in PATH, checking common installation locations...

REM Check Program Files
if exist "C:\Program Files\nodejs\node.exe" (
    echo Found Node.js in Program Files, adding to PATH for this session...
    set "PATH=%PATH%;C:\Program Files\nodejs"
    goto :test_nodejs_again
)

REM Check Program Files (x86)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    echo Found Node.js in Program Files ^(x86^), adding to PATH for this session...
    set "PATH=%PATH%;C:\Program Files (x86)\nodejs"
    goto :test_nodejs_again
)

REM Check AppData (user installation)
if exist "%APPDATA%\npm\node.exe" (
    echo Found Node.js in AppData, adding to PATH for this session...
    set "PATH=%PATH%;%APPDATA%\npm"
    goto :test_nodejs_again
)

REM Check user's local AppData
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    echo Found Node.js in Local Programs, adding to PATH for this session...
    set "PATH=%PATH%;%LOCALAPPDATA%\Programs\nodejs"
    goto :test_nodejs_again
)

echo Node.js installation not found in common locations.
goto :nodejs_not_found

:test_nodejs_again
echo Testing Node.js after adding to PATH...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js is now working: 
    node --version
    echo.
    goto :nodejs_found
)

:nodejs_not_found
echo.
echo ============================================
echo   Node.js needs to be installed
echo ============================================
echo.
echo The EVE Intel Monitor requires Node.js to run.
echo Don't worry - this is a one-time setup!
echo.
echo What happens next:
echo 1. We'll open the Node.js download page
echo 2. Download the LTS version (left button)
echo 3. Install with default settings
echo 4. Run this script again
echo.
echo Press any key to open the download page automatically...
pause >nul
start https://nodejs.org/
echo.
echo ================================================================
echo  After installing Node.js, just run this script again!
echo  No additional configuration needed.
echo ================================================================
pause
exit /b 1

:nodejs_found

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
    echo 'node_modules' directory not found. Installing required packages...
    echo This may take a few moments on first run...
    echo.
    echo Checking npm...
    npm --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo ERROR: npm is not working properly.
        echo This usually means Node.js installation is incomplete.
        echo Please reinstall Node.js from https://nodejs.org/
        pause
        exit /b 1
    )
    echo Installing packages with npm...
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ============================================
        echo   ERROR: Failed to install dependencies
        echo ============================================
        echo.
        echo Possible solutions:
        echo 1. Check your internet connection
        echo 2. Try running as Administrator
        echo 3. Clear npm cache: npm cache clean --force
        echo 4. Delete node_modules and try again
        echo.
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