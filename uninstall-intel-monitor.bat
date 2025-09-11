@echo off
setlocal

echo ========================================
echo    EVE Intel Monitor - Uninstaller
echo ========================================
echo.
echo This will remove all Intel Monitor files and data.
echo.

REM Check if we're in the right directory
if not exist "simple-intel-monitor.js" (
    echo ERROR: This script must be run from the Intel Monitor directory
    echo containing simple-intel-monitor.js
    echo.
    pause
    exit /b 1
)

echo Current directory: %CD%
echo.
echo The following will be removed:
echo - All Intel Monitor files
echo - Node.js dependencies (node_modules)
echo - Configuration files
echo - Log files (if any)
echo.

CHOICE /C YN /M "Are you sure you want to uninstall the Intel Monitor? (Y/N)"
if errorlevel 2 goto :cancelled
if errorlevel 1 goto :uninstall

:uninstall
echo.
echo ==========================================
echo    Uninstalling EVE Intel Monitor...
echo ==========================================
echo.

REM Stop any running Node.js processes (Intel Monitor)
echo [1/6] Stopping any running Intel Monitor processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq EVE*Intel*Monitor*" >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq simple-intel-monitor*" >nul 2>&1
echo Intel Monitor processes stopped.
echo.

REM Remove node_modules directory
echo [2/6] Removing Node.js dependencies...
if exist "node_modules" (
    echo Removing node_modules directory...
    rmdir /S /Q "node_modules" >nul 2>&1
    if exist "node_modules" (
        echo Warning: Some files in node_modules could not be removed.
        echo You may need to delete them manually.
    ) else (
        echo node_modules directory removed.
    )
) else (
    echo No node_modules directory found.
)
echo.

REM Remove package-lock.json
echo [3/6] Removing package lock file...
if exist "package-lock.json" (
    del "package-lock.json" >nul 2>&1
    echo package-lock.json removed.
) else (
    echo No package-lock.json found.
)
echo.

REM Backup configuration before removal (optional)
echo [4/6] Backing up configuration...
if exist "simple-intel-config.json" (
    copy "simple-intel-config.json" "simple-intel-config.json.backup" >nul 2>&1
    echo Configuration backed up to simple-intel-config.json.backup
) else (
    echo No configuration file found.
)
echo.

REM List files to be removed
echo [5/6] Preparing to remove Intel Monitor files...
echo.
echo Files that will be removed:
if exist "simple-intel-monitor.js" echo   - simple-intel-monitor.js
if exist "package.json" echo   - package.json
if exist "simple-intel-config.json" echo   - simple-intel-config.json
if exist "start-intel-monitor.bat" echo   - start-intel-monitor.bat
if exist "uninstall-intel-monitor.bat" echo   - uninstall-intel-monitor.bat
if exist "README.md" echo   - README.md
if exist "SETUP.md" echo   - SETUP.md
if exist "FIXES_SUMMARY.md" echo   - FIXES_SUMMARY.md
if exist "archive" echo   - archive/ directory
if exist "Discordinteltoolwindows-main" echo   - Discordinteltoolwindows-main/ directory
echo.

CHOICE /C YN /M "Proceed with file removal? (Y/N)"
if errorlevel 2 goto :cleanup_cancelled
if errorlevel 1 goto :remove_files

:remove_files
echo [6/6] Removing Intel Monitor files...

REM Remove main files
if exist "simple-intel-monitor.js" (
    del "simple-intel-monitor.js" >nul 2>&1
    echo Removed simple-intel-monitor.js
)

if exist "package.json" (
    del "package.json" >nul 2>&1
    echo Removed package.json
)

if exist "simple-intel-config.json" (
    del "simple-intel-config.json" >nul 2>&1
    echo Removed simple-intel-config.json
)

if exist "start-intel-monitor.bat" (
    del "start-intel-monitor.bat" >nul 2>&1
    echo Removed start-intel-monitor.bat
)

if exist "README.md" (
    del "README.md" >nul 2>&1
    echo Removed README.md
)

if exist "SETUP.md" (
    del "SETUP.md" >nul 2>&1
    echo Removed SETUP.md
)

if exist "FIXES_SUMMARY.md" (
    del "FIXES_SUMMARY.md" >nul 2>&1
    echo Removed FIXES_SUMMARY.md
)

REM Remove directories
if exist "archive" (
    rmdir /S /Q "archive" >nul 2>&1
    echo Removed archive directory
)

if exist "Discordinteltoolwindows-main" (
    rmdir /S /Q "Discordinteltoolwindows-main" >nul 2>&1
    echo Removed Discordinteltoolwindows-main directory
)

echo.
echo ==========================================
echo    Uninstallation Complete!
echo ==========================================
echo.
echo The EVE Intel Monitor has been successfully removed.
echo.
echo What was removed:
echo - All Intel Monitor application files
echo - Node.js dependencies
echo - Configuration files
echo.
echo What was preserved:
echo - simple-intel-config.json.backup (if it existed)
echo - This uninstall script (for reference)
echo.
echo To completely remove all traces, you can:
echo 1. Delete this entire directory
echo 2. Remove the backup configuration file
echo.
echo Thank you for using the EVE Intel Monitor!
echo.
goto :finish

:cleanup_cancelled
echo.
echo File removal cancelled. Only dependencies were cleaned up.
echo The Intel Monitor files remain intact.
echo.
goto :finish

:cancelled
echo.
echo Uninstallation cancelled. No changes were made.
echo.
goto :finish

:finish
echo Press any key to exit...
pause >nul

REM Self-destruct this uninstall script (optional)
echo.
CHOICE /C YN /M "Remove this uninstall script as well? (Y/N)"
if errorlevel 1 (
    echo Removing uninstaller...
    start "" cmd /c "timeout /t 2 >nul & del "%~f0""
)

exit /b 0
