# EVE Intel Client - Fixes Summary

## Issues Fixed

### 1. **API Data Format Mismatch**
- **Problem**: Client was sending `channel` field but server expected `system` field
- **Fix**: Updated client to send `system` as primary field (extracted from message or channel name)
- **Additional**: Added `systemMentions` array for multiple systems in one message

### 2. **Multiple EVE Client Handling**
- **Problem**: Client monitored ALL intel files simultaneously, causing duplicate submissions
- **Fix**: Implemented primary/standby system that monitors only the most recently active file
- **Features**: 
  - Automatic detection of active Intel channel files
  - Primary file selection based on recent activity
  - Automatic switching when primary file becomes inactive

### 3. **Intel Message Detection**
- **Problem**: No filtering for actual intel messages vs general chat
- **Fix**: Added intelligent intel detection with:
  - Keywords: red, hostile, clear, gate, cyno, etc.
  - System name pattern matching (J164738, 4O-239, M-OEE8, etc.)
  - Confidence scoring for intel quality

### 4. **Log File Handling**
- **Problem**: File monitoring was unreliable and didn't handle EVE's UTF-16LE encoding properly
- **Fix**: 
  - Improved file encoding detection
  - Better error handling for file operations
  - Enhanced file state tracking

### 5. **System Name Extraction**
- **Problem**: Server couldn't identify which systems were mentioned in intel
- **Fix**: Added regex pattern to extract EVE system names from messages
- **Patterns**: Supports J-space (J164738), null-sec (4O-239), and other formats

### 6. **Real-time vs Historical Data**
- **Problem**: Client would send old messages on startup
- **Fix**: Enhanced initial load logic that processes recent messages but doesn't submit them

## New Features Added

### Multi-Client Priority System
- Automatically detects multiple EVE clients running on same computer
- Selects most recently active Intel channel as primary
- Keeps other channels on standby for automatic failover

### Enhanced Intel Detection
```javascript
// Detects various intel patterns:
- System names: J164738, 4O-239, M-OEE8, NIDJ-K
- Intel keywords: red, hostile, clear, gate, cyno, bridge
- Confidence scoring for message quality
```

### Better Monitoring Output
```
📋 Found 3 Intel channel files:
   [PRIMARY] Phoenix_Intel_South_20250907_164829_2120829300.txt (45s ago, Character: 2120829300)
   [STANDBY] Phoenix_Intel_20250907_164829_2122867331.txt (120s ago, Character: 2122867331)
   [STANDBY] Test_Intel_Channel_20250908_033000_1234567890.txt (300s ago, Character: 1234567890)
```

### Enhanced API Payload
```json
{
  "system": "4O-239",
  "intel": "4O-239  FITTIpalti  Kira Frost Ohmiras  Phunas  ProTere  unterkernon",
  "pilot": "Thrain Krill",
  "timestamp": "2025-09-07T16:56:39.000Z",
  "channel": "Phoenix_Intel_South",
  "systemMentions": ["4O-239"],
  "confidence": 0.8
}
```

## Configuration Updates

### New Config Options
```json
{
  "serverUrl": "https://intel.thrainkrill.space",
  "apiKey": "desktop-client-api-key-2024",
  "pilotName": "Thrain Krill",
  "eveLogsPath": "",
  "inactiveFileTimeout": 120000
}
```

## Testing Performed

1. ✅ Connection test passes
2. ✅ Intel file detection working
3. ✅ Real EVE log format parsing
4. ✅ System name extraction from actual intel messages
5. ✅ API format matches server expectations
6. 🔄 Real-time monitoring (ready for testing)

## Next Steps

1. Test with live EVE client intel channels
2. Verify Discord webhook integration
3. Test multi-client scenario with multiple characters
4. Monitor for any duplicate message issues

## Breaking Changes

- Intel payload format changed (added `system`, `systemMentions`, `confidence`)
- File monitoring now focuses on primary file only
- Enhanced heartbeat includes more detailed stats

Server-side code should be compatible as it already handles flexible input formats.
