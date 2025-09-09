# EVE Online Intel Monitor Client - **FIXED VERSION** 🚀

A simple, lightweight desktop client that monitors your EVE Online chat logs and automatically submits **REAL-TIME** intel to the intelligence server.

## 🔥 **MAJOR FIXES INCLUDED IN THIS VERSION**

### ✅ **Fixed Old Message Flooding**
**PROBLEM SOLVED**: The previous version was submitting hours-old messages as "new" intel during startup, causing spam and confusion.

**SOLUTION**: The client now properly distinguishes between:
- 📋 **[INITIAL]** messages (old messages found during startup) - **NOT submitted**
- ⚡ **REAL-TIME** messages (new messages appearing live) - **Submitted immediately**

### ✅ **Fixed Client Connection Tracking** 
**PROBLEM SOLVED**: The website wasn't showing connected clients properly.

**SOLUTION**: Added robust heartbeat system that:
- 💗 Sends heartbeat every 5 minutes to server
- 🔗 Website now shows "Connected Clients: X" accurately
- 📊 Proper client connection monitoring

### ✅ **Fixed Module Warnings**
**PROBLEM SOLVED**: Node.js was showing module type warnings.

**SOLUTION**: Added proper `"type": "module"` configuration for clean startup.

### ✅ **Enhanced Real-Time Detection**
**IMPROVEMENT**: Optimized file watching and UTF-16 encoding support for faster, more reliable intel detection.

---

## 🚀 Quick Start - **SUPER EASY!**

### **For New Users (First Time Setup):**
1. **Download all files** to a folder on your computer
2. **Double-click `start-intel-monitor.bat`**
3. **If Node.js isn't installed:** The script will automatically open the download page - just install it and run the script again
4. **That's it!** Everything else is automatic:
   - ✅ Automatically installs required packages
   - ✅ Automatically finds your EVE chat logs  
   - ✅ Automatically tests server connection
   - ✅ Starts monitoring for real-time intel

### **For Return Users:**
Just double-click `start-intel-monitor.bat` - everything is already set up!

## 📋 What You Need

- **Windows** computer (tested on Windows 10/11)
- **Node.js** - *Don't worry! The script will guide you through installation if needed*
- **EVE Online** with chat logging enabled
- **Windows** (tested on Windows 10/11)

## 🛠️ Setup Details

*Most users can skip this section - the batch file handles everything automatically!*

### Step 1: Enable EVE Chat Logging
1. In EVE Online, press `ESC` → `Settings`
2. Go to `Chat & Windows` tab  
3. Set `Chat Logging` to `Enabled`
4. Join intel channels (like Phoenix_Intel, Phoenix_Intel_South, etc.)

### Step 2: Configuration (Optional)
The client works perfectly with default settings! But if you want to customize, edit `simple-intel-config.json`:

```json
{
  "serverUrl": "https://intel.thrainkrill.space",
  "apiKey": "desktop-client-api-key-2024", 
  "pilotName": "Your Pilot Name",
  "eveLogsPath": "auto"
}
```

**The client automatically finds your EVE logs** - no manual path configuration needed!

### Step 3: Run the Client
Just double-click `start-intel-monitor.bat` - that's it!

## 📁 Files Included

- `simple-intel-monitor.js` - Main monitoring script
- `start-intel-monitor.bat` - Easy startup script
- `simple-intel-config.json` - Configuration file
- `README.md` - This file

## 🔄 **How It Works (FIXED)**

1. **Connects to server** and establishes heartbeat tracking
2. **Scans your EVE chat logs** and finds intel channels
3. **Initial Load**: Shows old messages as `📋 [INITIAL] ... - NOT submitted`
4. **Real-Time Monitoring**: Watches for **NEW** messages only
5. **Detects intel** in real-time (system names, "clr", "red", etc.)
6. **Submits NEW intel** immediately: `⚡ INTEL DETECTED: ... ✅ Intel submitted in 150ms`

## 💻 **What You'll See (FIXED OUTPUT)**

### ✅ **Correct Startup (No Old Message Spam)**

```text
🚀 Simple EVE Intel Monitor Starting...
📡 Server: https://intel.thrainkrill.space
👤 Pilot: Your Pilot Name
✅ Connection successful!
✓ Found EVE logs at: C:\Users\...\Documents\EVE\logs\Chatlogs (852 files)
💗 Starting heartbeat every 5 minutes
💗 Heartbeat sent successfully

🎯 Watching INTEL channel: Phoenix_Intel_20250907_071235.txt ⚡
📋 Initial load: Phoenix_Intel - found 61 recent messages (last 10 minutes)
💬 [RECENT] [Phoenix_Intel] Skeeter7785: X36Y-G +15 init bombers
💬 [RECENT] [Phoenix_Intel] ... (58 more recent messages)

📋 [INITIAL] Intel found: Phoenix_Intel - Y-C3EQ* clr (message -8727s old) - NOT submitted
📋 [INITIAL] Intel found: Phoenix_Intel - P-2TTL clr (message -9047s old) - NOT submitted
📋 [INITIAL] Intel found: Phoenix_Intel - MQ-NPY clr (message -11297s old) - NOT submitted
📨 61 recent messages in Phoenix_Intel

👀 Ready for REAL-TIME intel monitoring...
```

### ⚡ **Real-Time Intel Detection (NEW MESSAGES ONLY)**

```text
[When someone types NEW intel in game chat]
⚡ INTEL DETECTED: Phoenix_Intel - P-2TTL red spike (message 2s old)
✅ Intel submitted in 145ms (total delay: ~2s)
```

## 🎯 Supported Intel Channels

The client automatically detects channels with names containing:
- `intel` (Phoenix_Intel, Alliance_Intel, etc.)
- `military`
- `defense` 
- `recon`
- `standing fleet`

## 🔍 Intel Detection

Automatically detects messages containing:
- **Status**: clear, clr, status, stat
- **Hostiles**: red, hostile, neut, neutral
- **Activity**: spike, gate, station, cyno, fleet
- **Tactical**: bubble, camp, bridge, titan

## ⚙️ Advanced Configuration

### Custom EVE Logs Path
If the client can't find your EVE logs, specify the path in `simple-intel-config.json`:

```json
{
  "eveLogsPath": "D:\\Games\\EVE Online\\logs\\Chatlogs"
}
```

### Command Line Options
```bash
node simple-intel-monitor.js start    # Start monitoring (default)
node simple-intel-monitor.js test     # Test server connection
node simple-intel-monitor.js help     # Show help
```

## 🔧 Troubleshooting

### "EVE logs directory not found!"
- Make sure EVE Online is installed
- Enable chat logging in EVE settings
- Join some chat channels to create log files
- Specify custom path in config if needed

### "Cannot connect to server"
- Check your internet connection
- Verify the server URL in config
- Make sure you're not behind a restrictive firewall

### "Node.js is not installed"
- Download and install Node.js from https://nodejs.org/
- Restart the script after installation

### No intel being detected
- Make sure you're in intel channels
- Check that channel names contain "intel"
- Try typing some test messages with "red" or "clear"

## 🌐 **Website Features**

Access the intel dashboard at: <https://intel.thrainkrill.space>

**NEW FEATURES**:

- ✅ **Logout Button**: Top-right corner for easy logout
- ✅ **Connected Clients**: Shows "🔗 X clients connected" in real-time
- ✅ **Auto-refresh**: Page updates every 30 seconds
- ✅ **User Information**: Displays "Welcome, [Pilot Name]"

## � **What's Different in This FIXED Version**

| **Issue** | **Before (Broken)** | **After (FIXED)** |
|-----------|---------------------|-------------------|
| **Old Messages** | ❌ Submitted hours-old messages as "new" intel | ✅ Shows `📋 [INITIAL] ... - NOT submitted` |
| **Client Count** | ❌ Website showed "0 clients" | ✅ Shows accurate "🔗 X clients connected" |
| **Real-Time** | ❌ Mixed old/new messages | ✅ Only NEW messages submitted with `⚡ INTEL DETECTED` |
| **Performance** | ❌ Message flooding, KV quota errors | ✅ Clean operation, no quotas, fast response |
| **Heartbeat** | ❌ No connection tracking | ✅ `💗 Heartbeat sent successfully` every 5 min |
| **Module Warnings** | ❌ Node.js warnings on startup | ✅ Clean startup with proper module config |

## 🏆 **Features Summary**

✅ **Real-time intel monitoring** (NEW messages only)  
✅ **Automatic EVE log detection** (supports OneDrive, Steam, custom paths)  
✅ **UTF-16 encoding support** (handles EVE's Unicode chat logs)  
✅ **Multiple intel channel support** (Phoenix_Intel, Alliance, Corp, etc.)  
✅ **Intelligent keyword detection** (system names, status, hostiles, etc.)  
✅ **Client connection tracking** (heartbeat every 5 minutes)  
✅ **Website dashboard** (real-time intel view with logout/client count)  
✅ **KV-free architecture** (unlimited performance, no quotas)  
✅ **Cross-platform compatibility** (Windows, Linux via Wine)  
✅ **Zero configuration** (works out of the box for most users)  
✅ **Clean console output** (no spam, clear status messages)

## 📝 **Version History**

- **v1.2.0** - **MAJOR FIX RELEASE** 🔥
  - ✅ Fixed old message flooding during startup
  - ✅ Added proper client connection tracking with heartbeat
  - ✅ Implemented KV-free architecture (no storage limitations)
  - ✅ Fixed timezone parsing and timing optimization
  - ✅ Added website logout button and client count display
  - ✅ Enhanced real-time detection with proper UTF-16 support
  - ✅ Eliminated module type warnings

- **v1.0.0** - Initial release with UTF-16 log support and automatic intel detection

## 💬 **Need Help?**

If you encounter issues:

1. Check this README for troubleshooting
2. Look at the console output for error messages
3. Try running `node simple-intel-monitor.js test`
4. Visit the website: <https://intel.thrainkrill.space>
5. Contact **Thrain Krill** in EVE Online

---

**This FIXED version ensures you only submit REAL-TIME intel, not old historical messages!**

## 🛑 **Stopping the Client**

- **Windows**: Press `Ctrl+C` in the console window
- **Or**: Close the console window
- The client will shut down gracefully:

```text
👋 Shutting down Intel Monitor...
💗 Heartbeat stopped
```

## 🔒 **Security & Privacy**

- **No personal data** is collected beyond pilot name
- **Only intel messages** are sent to the server
- **Your pilot name** is included with intel submissions for accountability
- **Chat logs stay local** on your computer
- **KV-free architecture** - no database quotas or storage limitations

---

**Fly safe! o7**

---

**Server Status**: <https://intel.thrainkrill.space>  
**Client Package**: `E:\discordeveintel\Eve-Intel-Client\`  
**Last Updated**: September 7, 2025 - **MAJOR FIX RELEASE**
