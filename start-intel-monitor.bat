@echo off
setlocal

echo =====================================
echo     EVE Online Intel Monitor Client
echo =====================================
echo.

REM --- Check if running from zip file ---
echo %CD% | findstr /C:"AppData\Local\Temp" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ================================================================
    echo                        IMPORTANT NOTICE
    echo ================================================================
    echo.
    echo It looks like you're running this script from inside a ZIP file
    echo or temporary folder. This won't work properly!
    echo.
    echo Please follow these steps:
    echo 1. Right-click the ZIP file you downloaded
    echo 2. Select "Extract All..." or "Extract Here"
    echo 3. Choose a permanent folder ^(like Desktop or Documents^)
    echo 4. Run the script from the extracted folder
    echo.
    echo Current location: %CD%
    echo.
    echo ================================================================
    pause
    exit /b 1
)

REM --- Configuration ---
set "SCRIPT_NAME=simple-intel-monitor.js"
set "NODE_MODULES_DIR=node_modules"

:check_node
REM 1. Check for Node.js
echo [1/5] Checking Node.js installation...

REM First try the standard node command
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js found:
    node --version
    echo.
    goto :check_script_file
)

REM If node command failed, try common installation paths
echo Node.js not found in PATH, checking common installation locations...

REM Check Program Files
if exist "%ProgramFiles%\nodejs\node.exe" (
    echo Found Node.js in Program Files, adding to PATH for this session...
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    goto :test_nodejs_again
)

REM Check Program Files (x86)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    echo Found Node.js in Program Files (x86), adding to PATH for this session...
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
    goto :test_nodejs_again
)

REM Check AppData Local
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    echo Found Node.js in AppData Local, adding to PATH for this session...
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
    goto :test_nodejs_again
)

REM Check User Profile
if exist "%USERPROFILE%\AppData\Local\Programs\nodejs\node.exe" (
    echo Found Node.js in User Profile, adding to PATH for this session...
    set "PATH=%USERPROFILE%\AppData\Local\Programs\nodejs;%PATH%"
    goto :test_nodejs_again
)

REM Check NVM installations
if exist "%USERPROFILE%\AppData\Roaming\nvm" (
    echo Checking for NVM Node.js installations...
    for /d %%i in ("%USERPROFILE%\AppData\Roaming\nvm\v*") do (
        if exist "%%i\node.exe" (
            echo Found Node.js via NVM at %%i
            set "PATH=%%i;%PATH%"
            goto :test_nodejs_again
        )
    )
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
    goto :check_script_file
)
echo Failed to get Node.js working from the discovered path.
goto :nodejs_not_found


:nodejs_not_found
echo.
echo ============================================
echo      Node.js Installation Required
echo ============================================
echo.
echo The EVE Intel Monitor requires Node.js to run.
echo This script can attempt to download and install it for you automatically.
echo This requires an internet connection and may require Administrator permissions.
echo.

CHOICE /C YN /M "Do you want to attempt automatic installation of Node.js now? (Y/N)"
if errorlevel 2 goto :manual_install_instructions
if errorlevel 1 goto :install_node

:install_node
echo.
echo --- Starting Automatic Node.js Installation ---
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {
    $installerPath = Join-Path $env:TEMP 'node-v20-x64.msi';
    Write-Host 'Downloading Node.js LTS v20 installer...';
    try {
        $progressPreference = 'SilentlyContinue';
        Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi' -OutFile $installerPath;
        Write-Host 'Download complete. File size:' (Get-Item $installerPath).Length 'bytes';
    } catch {
        Write-Host 'ERROR: Download failed. Please check your internet connection.' -ForegroundColor Red;
        Write-Host 'Error details:' $_.Exception.Message -ForegroundColor Red;
        exit 1;
    }
    Write-Host 'Starting Node.js installation...';
    Write-Host 'Please approve any administrative prompts that appear.';
    try {
        $process = Start-Process msiexec.exe -ArgumentList \"/i `\"$installerPath`\" /quiet /norestart\" -Wait -PassThru;
        if ($process.ExitCode -eq 0) {
            Write-Host 'Node.js installation completed successfully.' -ForegroundColor Green;
        } else {
            Write-Host 'Installation may have failed. Exit code:' $process.ExitCode -ForegroundColor Yellow;
        }
    } catch {
        Write-Host 'ERROR: Installation failed.' -ForegroundColor Red;
        Write-Host 'Error details:' $_.Exception.Message -ForegroundColor Red;
        exit 1;
    }
    Remove-Item $installerPath -ErrorAction SilentlyContinue;
    Write-Host 'Installation process finished. Refreshing environment...';
    $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User');
}"

if %errorlevel% neq 0 (
    echo.
    echo =========================================================
    echo   ERROR: Automatic installation failed.
    echo =========================================================
    echo.
    echo Please try running this script as an Administrator.
    echo If that fails, follow the manual instructions below.
    goto :manual_install_instructions
)

echo.
echo --- Installation Complete ---
echo Refreshing environment and re-checking Node.js...
echo.

REM Refresh environment variables for this session
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYSTEM_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"
set "PATH=%SYSTEM_PATH%;%USER_PATH%"

echo Environment refreshed. Checking Node.js again...
goto :check_node


:manual_install_instructions
echo.
echo To install manually:
echo 1. We'll open the Node.js download page.
echo 2. Download the 'LTS' version (usually the left button).
echo 3. Run the installer with default settings.
echo 4. Once finished, please run this script again.
echo.
echo Press any key to open the download page...
pause >nul
start "" "https://nodejs.org/"
echo.
echo ================================================================
echo   After installing Node.js, just run this script again!
echo ================================================================
pause
exit /b 1

:check_script_file
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

:install_dependencies
REM 3. Install dependencies from package.json
echo [3/5] Checking for dependencies...
if not exist "%NODE_MODULES_DIR%" (
    echo 'node_modules' directory not found. Installing required packages...
    echo This may take a few moments on the first run...
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ============================================
        echo   ERROR: Failed to install dependencies
        echo ============================================
        echo.
        echo Possible solutions:
        echo 1. Check your internet connection.
        echo 2. Try running this script as an Administrator.
        echo 3. Clear the npm cache by running: npm cache clean --force
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

:test_connection
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

:start_monitor
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
