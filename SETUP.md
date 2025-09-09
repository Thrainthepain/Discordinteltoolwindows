# 🚀 EVE Intel Monitor - Quick Setup Guide

## Step 1: Install Node.js (Required)

**If you don't have Node.js installed:**

1. Go to https://nodejs.org/
2. Download the **LTS version** (left button - recommended)
3. Run the installer with **default settings**
4. **Restart your computer** after installation

**To check if Node.js is working:**
- Open Command Prompt and type: `node --version`
- You should see a version number like `v18.17.0`

## Step 2: Run the Intel Monitor

1. **Double-click** `start-intel-monitor.bat`
2. The script will automatically:
   - Check for Node.js
   - Install required packages (first time only)
   - Test server connection
   - Start monitoring your EVE chat logs

## Step 3: Configure EVE Online (If Not Done)

1. In EVE Online, press `ESC` → `Settings`
2. Go to `Chat & Windows` tab  
3. Set `Chat Logging` to `Enabled`
4. Join intel channels like:
   - Phoenix_Intel
   - Phoenix_Intel_South
   - Your alliance intel channels

## Troubleshooting

### "node is not recognized as internal or external command"
- **Solution**: Node.js is not installed or not in PATH
- **Fix**: Install Node.js from https://nodejs.org/ and restart computer

### "npm install failed"
- **Solution**: Network or permission issues
- **Fix**: Try running `start-intel-monitor.bat` as Administrator

### "No EVE log files found"
- **Solution**: EVE chat logging not enabled or wrong path
- **Fix**: Enable chat logging in EVE settings, restart EVE

### "Connection test failed"
- **Solution**: Firewall or network blocking access
- **Fix**: Check firewall settings, ensure internet connection

## Need Help?

The Intel Monitor will show helpful error messages and guide you through any issues.

For additional support, check the main README.md file.

---
**Ready to use!** Just double-click `start-intel-monitor.bat` to get started.
