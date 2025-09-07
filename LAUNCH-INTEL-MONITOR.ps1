# EVE Intel Monitor - PowerShell Launcher
# This launcher automatically checks requirements and starts the intel monitor

# Set window title and colors
$Host.UI.RawUI.WindowTitle = "EVE Intel Monitor - Automatic Launcher"
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "   EVE INTEL MONITOR - AUTOMATIC LAUNCHER" -ForegroundColor Green  
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "STARTING: automatic setup and launch..." -ForegroundColor Cyan
Write-Host ""

# Change to script directory
Set-Location $PSScriptRoot

# Check if Node.js is installed
Write-Host "CHECKING: Node.js installation..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version
    Write-Host "SUCCESS: Node.js is installed! Version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "DOWNLOADING: Node.js installer..." -ForegroundColor Yellow
    Write-Host "   Opening Node.js download page in your browser..." -ForegroundColor White
    Write-Host ""
    
    Start-Process "https://nodejs.org/"
    
    Write-Host "INSTALLATION STEPS:" -ForegroundColor Yellow
    Write-Host "   1. Download the 'LTS' version (recommended)" -ForegroundColor White
    Write-Host "   2. Run the downloaded installer" -ForegroundColor White
    Write-Host "   3. Follow the installation wizard (click Next/Install)" -ForegroundColor White
    Write-Host "   4. Restart this launcher after installation" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit and install Node.js..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if npm is available
Write-Host ""
Write-Host "CHECKING: npm package manager..." -ForegroundColor Yellow
Write-Host ""
Write-Host "VERIFYING: npm is available..." -ForegroundColor Yellow

try {
    $npmVersion = npm --version
    Write-Host "SUCCESS: npm is available! Version: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: npm is not available!" -ForegroundColor Red
    Write-Host "   npm should be installed with Node.js. Please reinstall Node.js." -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if package.json exists
if (-not (Test-Path "package.json")) {
    Write-Host ""
    Write-Host "ERROR: package.json not found!" -ForegroundColor Red
    Write-Host "   Make sure you're running this from the Eve-Intel-Client folder." -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host ""
Write-Host "INSTALLING: Required Node.js packages..." -ForegroundColor Yellow
Write-Host "   This may take a moment..." -ForegroundColor White
Write-Host ""

# Install packages
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: installing packages!" -ForegroundColor Red
    Write-Host "   Please check your internet connection and try again." -ForegroundColor White
    Write-Host "   You can also try running: npm install manually" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "SUCCESS: All packages ready!" -ForegroundColor Green
Write-Host ""
Write-Host "LAUNCHING: EVE Intel Monitor..." -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   INTEL MONITOR IS NOW RUNNING" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "The monitor will:" -ForegroundColor White
Write-Host "   • Watch your EVE chat logs automatically" -ForegroundColor White
Write-Host "   • Submit intel to Discord within 1 second" -ForegroundColor White
Write-Host "   • Show status updates every 5 minutes" -ForegroundColor White
Write-Host ""
Write-Host "To stop the monitor: Press Ctrl+C or close this window" -ForegroundColor Red
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Launch the monitor
try {
    node simple-intel-monitor.js
    $exitCode = $LASTEXITCODE
} catch {
    $exitCode = 1
}

# Handle exit
Write-Host ""
if ($exitCode -ne 0) {
    Write-Host "ERROR: Intel monitor stopped with an error (exit code: $exitCode)" -ForegroundColor Red
    Write-Host "   Check the messages above for details." -ForegroundColor White
} else {
    Write-Host "SUCCESS: Intel monitor stopped normally." -ForegroundColor Green
}

Write-Host ""
Write-Host "Intel monitor has stopped." -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
