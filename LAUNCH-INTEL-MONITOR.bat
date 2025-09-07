@echo off
title EVE Intel Monitor - Automatic Launcher
color 0A
cd /d "%~dp0"

echo.
echo ===============================================
echo    EVE INTEL MONITOR - AUTOMATIC LAUNCHER
echo ===============================================
echo.
echo NOTE: If this launcher has issues, try the PowerShell version:
echo       LAUNCH-INTEL-MONITOR.ps1
echo.
echo Starting automatic setup and launch...
echo.

REM Refresh environment variables to get latest PATH
call refreshenv >nul 2>&1

REM Add common Node.js paths to current session PATH
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%LOCALAPPDATA%\Programs\node"

REM Check if Node.js is installed
echo Checking for Node.js installation...
echo Searching for node.exe in system PATH...

REM First try direct node command
call node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo SUCCESS: Node.js found in PATH!
    goto :node_ready
)

REM If not found in PATH, try common installation locations
echo Node.js not found in PATH, checking common locations...

if exist "C:\Program Files\nodejs\node.exe" (
    echo Found Node.js at: C:\Program Files\nodejs\
    set "PATH=C:\Program Files\nodejs;%PATH%"
    goto :test_node
)

if exist "C:\Program Files (x86)\nodejs\node.exe" (
    echo Found Node.js at: C:\Program Files (x86)\nodejs\
    set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
    goto :test_node
)

if exist "%LOCALAPPDATA%\Programs\node\node.exe" (
    echo Found Node.js at: %LOCALAPPDATA%\Programs\node\
    set "PATH=%LOCALAPPDATA%\Programs\node;%PATH%"
    goto :test_node
)

REM If still not found, download Node.js
echo.
echo ERROR: Node.js is not installed or not found!
echo.
echo DOWNLOADING Node.js installer...
echo Opening Node.js download page in your browser...
echo.
start https://nodejs.org/
echo.
echo INSTALLATION STEPS:
echo    1. Download the "LTS" version (recommended)
echo    2. Run the downloaded installer
echo    3. Follow the installation wizard (click Next/Install)
echo    4. Restart this launcher after installation
echo.
echo Press any key to exit and install Node.js...
pause >nul
exit /b 1

:test_node
REM Test if Node.js works now
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Cannot run Node.js! Please reinstall Node.js.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version 2^>nul') do set NODE_VERSION=%%i
echo SUCCESS: Node.js is working!

:node_ready

echo.
echo Checking and installing required packages...

REM Check if npm is available (comes with Node.js)
echo Checking for npm (Node Package Manager)...
for /f "tokens=*" %%i in ('call npm --version 2^>nul') do set NPM_VERSION=%%i
if "%NPM_VERSION%"=="" (
    echo.
    echo ERROR: npm is not available!
    echo npm should be installed with Node.js. Please reinstall Node.js.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
) else (
    echo SUCCESS: npm is available! Version: %NPM_VERSION%
)

REM Check if package.json exists
if not exist "package.json" (
    echo.
    echo ERROR: package.json not found!
    echo Make sure you're running this from the Eve-Intel-Client folder.
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo.
echo Installing required Node.js packages...
echo This may take a moment...

REM Install packages (remove --silent to see what's happening)
call npm install

echo.
echo DEBUG: npm install completed with exit code: %errorlevel%

if %errorlevel% neq 0 (
    echo.
    echo ERROR: installing packages!
    echo Please check your internet connection and try again.
    echo You can also try running: npm install manually
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b 1
)

echo SUCCESS: All packages ready!
echo.
echo LAUNCHING EVE INTEL MONITOR...
echo.
echo ================================================
echo    INTEL MONITOR IS NOW RUNNING
echo ================================================
echo.
echo The monitor will:
echo    - Watch your EVE chat logs automatically  
echo    - Submit intel to Discord within 1 second
echo    - Show status updates every 5 minutes
echo.
echo To stop the monitor: Press Ctrl+C or close this window
echo.
echo ================================================
echo.

REM Launch the monitor
call node simple-intel-monitor.js

REM If we get here, the monitor stopped (either normally or with an error)
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Intel monitor stopped with an error (exit code: %errorlevel%)
    echo Check the messages above for details.
    echo.
) else (
    echo.
    echo SUCCESS: Intel monitor stopped normally.
    echo.
)

echo Intel monitor has stopped.
echo.
echo Press any key to exit...
pause >nul
