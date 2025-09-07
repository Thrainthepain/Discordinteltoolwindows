# EVE Online Intel Monitor Client

A simple, lightweight desktop client that monitors your EVE Online chat logs and automatically submits intel to the intelligence server.

## 🚀 Quick Start

1. **Download the client files** to a folder on your computer
2. **Double-click `start-intel-monitor.bat`** to run the client
3. **Done!** The monitor will automatically find your EVE logs and start watching for intel

## 📋 Requirements

- **Node.js** (Download from https://nodejs.org/)
- **EVE Online** with chat logging enabled
- **Windows** (tested on Windows 10/11)

## 🛠️ Setup

### Step 1: Enable EVE Chat Logging
1. In EVE Online, press `ESC` → `Settings`
2. Go to `Chat & Windows` tab
3. Set `Chat Logging` to `Enabled`
4. Join intel channels (like Phoenix_Intel, Phoenix_Intel_South, etc.)

### Step 2: Configure the Client (Optional)
Edit `simple-intel-config.json` to customize settings:

```json
{
  "serverUrl": "https://intel.thrainkrill.space",
  "apiKey": "desktop-client-api-key-2024",
  "pilotName": "Your Pilot Name",
  "eveLogsPath": "C:\\Path\\To\\Your\\EVE\\logs\\Chatlogs"
}
```

**Most users don't need to change anything!** The client will automatically find your EVE logs.

### Step 3: Run the Client
- **Easy way**: Double-click `start-intel-monitor.bat`
- **Command line**: `node simple-intel-monitor.js`

## 📁 Files Included

- `simple-intel-monitor.js` - Main monitoring script
- `start-intel-monitor.bat` - Easy startup script
- `simple-intel-config.json` - Configuration file
- `README.md` - This file

## � How It Works

1. **Monitors your EVE chat logs** in real-time
2. **Detects intel channels** (anything with "intel" in the name)
3. **Identifies intel messages** (system names, "clr", "red", etc.)
4. **Submits intel** to the server automatically
5. **Shows you what's happening** with live console output

## � What You'll See

```
🚀 Simple EVE Intel Monitor Starting...
📡 Server: https://intel.thrainkrill.space
👤 Pilot: Your Pilot Name
✓ Server connection OK: EVE Intel Server v1.0.0
🔍 Scanning for EVE Online chat logs...
✓ Found EVE logs at: C:\Users\...\Documents\EVE\logs\Chatlogs (47 files)
🎯 Watching INTEL channel: Phoenix_Intel_20250907_040000.txt ⚡
💬 [Phoenix_Intel] Dante Aligeri: P-2TTL clr
⚡ INTEL DETECTED: Phoenix_Intel - P-2TTL clr
✓ Intel sent 🎯: Phoenix_Intel - P-2TTL clr... (420ms)
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

## � Statistics

The client shows stats every 5 minutes:
```
📊 === Intel Monitor Stats ===
⏱️  Uptime: 2h 15m
📨 Messages processed: 1,247
🎯 Intel sent: 89
❌ Errors: 0
=============================
```

## 🛑 Stopping the Client

- **Windows**: Press `Ctrl+C` in the console window
- **Or**: Close the console window
- The client will shut down gracefully

## � Security & Privacy

- **No personal data** is collected
- **Only intel messages** are sent to the server
- **Your pilot name** is included with intel submissions
- **Chat logs stay local** on your computer

## � Need Help?

If you encounter issues:
1. Check this README
2. Look at the console output for error messages
3. Try running `node simple-intel-monitor.js test`
4. Contact Thrain Krill in EVE Online

## 📝 Version History

- **v1.0.0** - Initial release with UTF-16 log support and automatic intel detection

---

**Fly safe! o7**
