#!/usr/bin/env node

/**
 * Simple EVE Intel Monitor - Fixed Version
 * Monitors EVE chat logs and pushes intel to the server
 * No GUI required - just run and forget
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { watch } from 'chokidar';

class SimpleIntelMonitor {
    constructor() {
        this.config = {
            serverUrl: 'https://intel.thrainkrill.space',
            apiKey: 'desktop-client-api-key-2024',
            updateInterval: 100, // Check every 100ms for ultra-fast intel detection
            pilotName: 'Thrain Krill',
            heartbeatInterval: 10 * 1000 // 10 seconds (faster response)
        };
        
        this.watchedFiles = new Map();
        this.lastProcessedLines = new Map();
        this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.heartbeatTimer = null;
        this.heartbeatCounter = 0; // Track heartbeat count for less frequent logging
        
        // Primary log selection for multiple clients
        this.channelLogs = new Map(); // channelName -> { primaryLog: filePath, allLogs: [filePaths], lastActivity: timestamp, lastSwitch: timestamp }
        this.lastActivityCheck = new Map(); // filePath -> lastModified timestamp
        this.processedMessages = new Set(); // Track processed messages to prevent duplicates
        this.PRIMARY_SWITCH_COOLDOWN = 5000; // 5 seconds minimum between primary log switches
        
        // Clean up old processed messages every 5 minutes to prevent memory leaks
        setInterval(() => {
            this.cleanupProcessedMessages();
        }, 5 * 60 * 1000);
        
        this.stats = {
            messagesProcessed: 0,
            intelSent: 0,
            errorsEncountered: 0,
            startTime: new Date()
        };

        // Intel keywords to look for
        this.intelKeywords = [
            'clear', 'clr', 'status', 'stat',
            'red', 'hostile', 'neut', 'neutral',
            'spike', 'spikes', 'spiked',
            'gate', 'station', 'pos', 'citadel',
            'cyno', 'bridge', 'titan', 'super',
            'fleet', 'gang', 'blob', 'camp',
            'bubble', 'drag', 'pull', 'stop',
            'warp', 'align', 'safe', 'dock'
        ];

        // Intel channel patterns (case-insensitive)
        this.intelChannelPatterns = [
            /intel/i,           // Any channel with "intel" in the name
            /phoenix.*intel/i,  // Phoenix_Intel_South, Phoenix_Intel_North, etc.
            /standing.*fleet/i, // Standing Fleet channels
            /fleet.*intel/i,    // Fleet intel channels
            /alliance.*intel/i, // Alliance intel channels
            /corp.*intel/i,     // Corp intel channels
            /military/i,        // Military channels
            /defense/i,         // Defense channels
            /recon/i           // Recon channels
        ];
    }

    /**
     * Get current timestamp in HH:MM:SS format for logging
     */
    getTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    /**
     * Enhanced console.log with timestamp
     */
    log(message) {
        console.log(`[${this.getTimestamp()}] ${message}`);
    }

    /**
     * Load configuration from file or use defaults
     */
    loadConfig() {
        try {
            const configPaths = [
                path.join(process.cwd(), 'client-config-workers.json'),
                path.join(process.cwd(), 'client', 'client-config-workers.json'),
                path.join(process.cwd(), 'simple-intel-config.json')
            ];

            for (const configPath of configPaths) {
                if (fs.existsSync(configPath)) {
                    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    
                    if (configData.server) {
                        // Workers config format
                        this.config.serverUrl = configData.server.url;
                        this.config.apiKey = configData.server.apiKey || this.config.apiKey;
                    } else if (configData.serverUrl) {
                        // Simple config format
                        this.config.serverUrl = configData.serverUrl;
                    }

                    if (configData.pilotName) {
                        this.config.pilotName = configData.pilotName;
                    }

                    if (configData.eveLogsPath) {
                        this.config.eveLogsPath = configData.eveLogsPath;
                    }

                    if (configData.apiKey) {
                        this.config.apiKey = configData.apiKey;
                    }

                    this.log(`✓ Configuration loaded from ${configPath}`);
                    break;
                }
            }
        } catch (error) {
            this.log(`⚠ Using default configuration: ${error.message}`);
        }
    }

    /**
     * Send heartbeat to server to track client connection
     */
    async sendHeartbeat() {
        try {
            const heartbeatData = {
                clientId: this.clientId
            };

            const response = await fetch(`${this.config.serverUrl}/api/heartbeat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(heartbeatData)
            });

            if (response.ok) {
                const result = await response.json();
                this.heartbeatCounter++;
                // Only show heartbeat message every 5 minutes (30 heartbeats at 10s intervals)
                if (this.heartbeatCounter % 30 === 0) {
                    this.log(`💗 Heartbeat sent successfully (${this.heartbeatCounter} total)`);
                }
            } else {
                this.log(`⚠ Heartbeat failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            this.log(`⚠ Heartbeat error: ${error.message}`);
        }
    }

    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        this.log(`💗 Starting heartbeat every ${this.config.heartbeatInterval / 1000} seconds (showing status every 5 minutes)`);
        
        // Send initial heartbeat
        this.sendHeartbeat();
        
        // Set up periodic heartbeat
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat timer
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            this.log('💗 Heartbeat stopped');
        }
    }

    /**
     * Find EVE Online chat log directory
     */
    findEveLogsDirectory() {
        // If user specified a custom path in config, use that first
        if (this.config.eveLogsPath) {
            const customPath = this.config.eveLogsPath;
            if (fs.existsSync(customPath)) {
                this.log(`✓ Using custom EVE logs path: ${customPath}`);
                return customPath;
            } else {
                this.log(`⚠ Custom path not found: ${customPath}, trying default locations...`);
            }
        }

        // Auto-scan common locations
        const possiblePaths = [
            // OneDrive locations (common with newer Windows)
            path.join(os.homedir(), 'OneDrive', 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join(os.homedir(), 'OneDrive - Personal', 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join(os.homedir(), 'OneDrive - Microsoft', 'Documents', 'EVE', 'logs', 'Chatlogs'),
            
            // Standard local Documents
            path.join(os.homedir(), 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join(os.homedir(), 'Documents', 'EVE', 'logs'),
            
            // Alternative locations
            path.join(os.homedir(), 'EVE', 'logs', 'Chatlogs'),
            path.join('C:', 'Users', os.userInfo().username, 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join('C:', 'Users', os.userInfo().username, 'OneDrive', 'Documents', 'EVE', 'logs', 'Chatlogs'),
            
            // Steam installation paths
            path.join('C:', 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'EVE Online', 'logs', 'Chatlogs'),
            path.join('C:', 'Program Files', 'CCP', 'EVE', 'logs', 'Chatlogs'),
            
            // Custom game drives
            path.join('D:', 'EVE Online', 'logs', 'Chatlogs'),
            path.join('E:', 'EVE Online', 'logs', 'Chatlogs'),
            
            // Linux Wine/Proton paths
            path.join(os.homedir(), '.steam', 'steam', 'steamapps', 'compatdata', '8500', 'pfx', 'drive_c', 'users', 'steamuser', 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join(os.homedir(), '.local', 'share', 'Steam', 'steamapps', 'compatdata', '8500', 'pfx', 'drive_c', 'users', 'steamuser', 'Documents', 'EVE', 'logs', 'Chatlogs')
        ];

        this.log('🔍 Scanning for EVE Online chat logs...');
        
        for (const logPath of possiblePaths) {
            this.log(`   Checking: ${logPath}`);
            if (fs.existsSync(logPath)) {
                // Verify it contains chat log files
                try {
                    const files = fs.readdirSync(logPath);
                    const logFiles = files.filter(file => file.endsWith('.txt'));
                    
                    if (logFiles.length > 0) {
                        this.log(`✓ Found EVE logs at: ${logPath} (${logFiles.length} files)`);
                        return logPath;
                    } else {
                        this.log(`   Directory exists but no .txt files found`);
                    }
                } catch (error) {
                    this.log(`   Cannot read directory: ${error.message}`);
                }
            }
        }

        // If we get here, provide helpful error message
        const errorMessage = `
❌ EVE logs directory not found!

To fix this:
1. Make sure EVE Online is installed and you've opened chat channels
2. Enable chat logging in EVE: ESC > Settings > Chat & Windows > Chat Logging = Enabled
3. Or specify a custom path in your config file:

{
  "serverUrl": "https://intel.thrainkrill.space",
  "apiKey": "desktop-client-api-key-2024",
  "pilotName": "YourPilotName",
  "eveLogsPath": "C:\\\\path\\\\to\\\\your\\\\EVE\\\\logs\\\\Chatlogs"
}

Common locations we checked:
${possiblePaths.slice(0, 5).map(p => `  - ${p}`).join('\n')}
... and ${possiblePaths.length - 5} more locations
        `;
        
        throw new Error(errorMessage);
    }

    /**
     * Check if a file was modified within the last 24 hours
     */
    isFileRecent(filePath, hoursThreshold = 24) {
        try {
            const stats = fs.statSync(filePath);
            const fileTime = stats.mtime.getTime();
            const now = Date.now();
            const thresholdMs = hoursThreshold * 60 * 60 * 1000; // Convert hours to milliseconds
            
            return (now - fileTime) <= thresholdMs;
        } catch (error) {
            // If we can't stat the file, assume it's not recent
            return false;
        }
    }

    /**
     * Check if a channel is an intel channel based on its name
     */
    isIntelChannel(channelName) {
        return this.intelChannelPatterns.some(pattern => pattern.test(channelName));
    }

    /**
     * Extract intel data from a chat message
     */
    extractIntelData(message, system, pilot, timestamp, channelName = '') {
        const lowerMessage = message.toLowerCase();
        const isFromIntelChannel = this.isIntelChannel(channelName);
        
        // Check if message contains intel keywords
        const hasIntelKeyword = this.intelKeywords.some(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        );

        // For non-intel channels, require keywords
        if (!hasIntelKeyword && !isFromIntelChannel) {
            return null;
        }

        // For intel channels, be much more permissive - accept almost any message!
        if (isFromIntelChannel) {
            // Skip Channel MOTD messages first (regardless of content)
            if (/channel motd/i.test(message)) {
                return null;
            }

            // Skip other obvious non-intel messages
            const skipPatterns = [
                /^eve system>/i,            // System messages
                /fleet.*invite/i,           // Fleet invites
                /can i get.*link/i,         // Fleet link requests
                /link.*fleet/i,             // Fleet link requests (reverse order)
                /^\s*$/,                    // Empty messages
                /^o7$/i,                    // Greetings
                /^thanks?$/i,               // Thanks
                /^ty$/i,                    // Thank you
                /join.*fleet/i,             // Fleet join requests
                /mumble/i,                  // Mumble references (unless with system)
                /discord/i,                 // Discord references
                /rorq.*fleet/i,             // Rorqual fleet references
                /ferox.*fleet/i,            // Ferox fleet references
                /going to reship/i          // Reshipping messages
            ];

            // If message matches skip patterns and doesn't contain location info, skip it
            const hasLocationInfo = /\b[A-Z0-9\-]{3,}\b/i.test(message) || // System codes
                                   /\b(gate|station|belt|local|\+\d+|\-\d+|\d+\+|\d+\-)\b/i.test(message);

            const shouldSkip = skipPatterns.some(pattern => pattern.test(message)) && !hasLocationInfo;
            
            if (shouldSkip) {
                return null;
            }

            // Accept everything else in intel channels!
            // This includes:
            // - System names alone: "4O-239"  
            // - System + pilot names: "4O-239 FITTIpalti Kira Frost"
            // - Partial intel: just pilot names that might be hostiles
            // - Follow-up messages with additional details
            // - Multi-line intel reports
        } else if (!hasIntelKeyword) {
            // Non-intel channels still need keywords
            return null;
        }

        // Extract additional intel context
        const intelData = {
            system: system,
            intel: message,
            pilot: pilot,
            timestamp: timestamp,
            confidence: this.calculateConfidence(lowerMessage, isFromIntelChannel),
            source: isFromIntelChannel ? 'intel_channel' : 'general_chat'
        };

        return intelData;
    }

    /**
     * Calculate confidence score for intel message
     */
    calculateConfidence(message, isFromIntelChannel = false) {
        let score = isFromIntelChannel ? 0.7 : 0.5; // Higher base confidence for intel channels

        // Higher confidence for specific patterns
        if (message.includes('red') || message.includes('hostile')) score += 0.3;
        if (message.includes('clear') || message.includes('clr')) score += 0.2;
        if (message.includes('status') || message.includes('stat')) score += 0.2;
        if (message.includes('gate') || message.includes('station')) score += 0.1;
        if (message.includes('cyno') || message.includes('bridge')) score += 0.3;

        return Math.min(score, 1.0);
    }

    /**
     * Quick check if a line contains intel keywords (for buffer checking)
     */
    containsIntelKeywords(line) {
        if (!line || !line.trim()) return false;
        
        const parsed = this.parseLogLine(line);
        if (!parsed) return false;
        
        const lowerMessage = parsed.message.toLowerCase();
        
        // Check for intel keywords
        const hasIntelKeyword = this.intelKeywords.some(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        );
        
        // Check for system name patterns (3-4 char combinations with numbers/dashes)
        const systemPattern = /[A-Z0-9]{1,4}-[A-Z0-9]{1,4}/i;
        const hasSystemName = systemPattern.test(parsed.message);
        
        return hasIntelKeyword || hasSystemName;
    }

    /**
     * Parse EVE chat log line
     */
    parseLogLine(line) {
        // EVE log format: [ 2024.09.07 05:30:15 ] Character Name > Message content
        // Clean the line by removing any remaining BOM or control characters
        let cleanLine = line
            .replace(/^[\uFEFF\uFFFE]/, '')     // Remove any remaining BOM
            .replace(/\0/g, '')                 // Remove null characters  
            .trim();                            // Clean whitespace
            
        const logRegex = /^\[\s*(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\s*\]\s*([^>]+)\s*>\s*(.+)$/;
        const match = cleanLine.match(logRegex);

        if (!match) {
            return null;
        }

        const [, timestamp, pilot, message] = match;
        
        // Parse timestamp as UTC (EVE logs are in UTC/EVE time)
        const utcTimestamp = timestamp.replace(/\./g, '-').replace(' ', 'T') + 'Z';
        
        return {
            timestamp: new Date(utcTimestamp), // Parse as UTC time
            pilot: pilot.trim(),
            message: message.trim()
        };
    }

    /**
     * Submit intel data to the server
     */
    async submitIntel(intelData) {
        const startTime = Date.now();
        try {
            // Send in the legacy format the worker expects
            const workerFormat = {
                system: intelData.system,
                intel: intelData.intel,
                pilot: intelData.pilot,
                timestamp: intelData.timestamp.toISOString()
            };

            // Submitting intel (production mode - minimal logging)

            const response = await fetch(`${this.config.serverUrl}/api/intel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(workerFormat)
            });

            const responseTime = Date.now() - startTime;
            
            if (response.ok) {
                const result = await response.json();
                this.stats.intelSent++;
                this.log(`✅ Intel submitted successfully (${responseTime}ms)`);
                if (result.message && result.message !== 'Intel received successfully') {
                    this.log(`   Server: ${result.message}`);
                }
            } else {
                const errorText = await response.text();
                this.log(`❌ Failed to submit intel: ${response.status} ${response.statusText}`);
                this.log(`   Response: ${errorText}`);
                this.stats.errorsEncountered++;
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.log(`❌ Error submitting intel (${responseTime}ms): ${error.message}`);
            this.stats.errorsEncountered++;
        }
    }

    /**
     * Register a log file for a channel and determine if it should be the primary
     */
    registerChannelLog(filePath) {
        const fileName = path.basename(filePath, '.txt');
        const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, '');
        
        if (!this.channelLogs.has(channelName)) {
            this.channelLogs.set(channelName, {
                primaryLog: filePath,
                allLogs: [filePath],
                lastActivity: this.getFileModifiedTime(filePath),
                lastSwitch: Date.now()
            });
            return true; // This is the primary log
        }
        
        const channelData = this.channelLogs.get(channelName);
        
        // Add to list if not already there
        if (!channelData.allLogs.includes(filePath)) {
            channelData.allLogs.push(filePath);
        }
        
        // Check if this should become the new primary log (with cooldown)
        const fileModTime = this.getFileModifiedTime(filePath);
        const timeSinceLastSwitch = Date.now() - (channelData.lastSwitch || 0);
        const isSignificantlyNewer = fileModTime > channelData.lastActivity + 10000; // 10 seconds newer
        
        if (isSignificantlyNewer && timeSinceLastSwitch > this.PRIMARY_SWITCH_COOLDOWN) {
            if (channelData.primaryLog !== filePath) {
                this.log(`🔄 [${channelName}] Switching primary log: ${path.basename(channelData.primaryLog)} → ${path.basename(filePath)}`);
                channelData.primaryLog = filePath;
                channelData.lastSwitch = Date.now();
            }
            channelData.lastActivity = fileModTime;
            return true; // This is now the primary log
        }
        
        return false; // This is not the primary log
    }

    /**
     * Check if a file path is the current primary log for its channel
     */
    isPrimaryLog(filePath) {
        const fileName = path.basename(filePath, '.txt');
        const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, '');
        const channelData = this.channelLogs.get(channelName);
        return channelData && channelData.primaryLog === filePath;
    }

    /**
     * Update activity for a log file and potentially switch primary logs
     */
    updateLogActivity(filePath) {
        const fileName = path.basename(filePath, '.txt');
        const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, '');
        const channelData = this.channelLogs.get(channelName);
        
        if (!channelData) return false;
        
        const fileModTime = this.getFileModifiedTime(filePath);
        this.lastActivityCheck.set(filePath, fileModTime);
        
        // Only switch if it's significantly more active and cooldown has passed
        const timeSinceLastSwitch = Date.now() - (channelData.lastSwitch || 0);
        const isSignificantlyNewer = fileModTime > channelData.lastActivity + 10000; // 10 seconds newer
        
        if (isSignificantlyNewer && channelData.primaryLog !== filePath && timeSinceLastSwitch > this.PRIMARY_SWITCH_COOLDOWN) {
            this.log(`🔄 [${channelName}] Switching to more active log: ${path.basename(channelData.primaryLog)} → ${path.basename(filePath)}`);
            channelData.primaryLog = filePath;
            channelData.lastActivity = fileModTime;
            channelData.lastSwitch = Date.now();
            return true; // Primary log changed
        } else if (channelData.primaryLog === filePath) {
            channelData.lastActivity = fileModTime;
        }
        
        return false;
    }

    /**
     * Get file modification time safely
     */
    getFileModifiedTime(filePath) {
        try {
            return fs.statSync(filePath).mtime.getTime();
        } catch (error) {
            return 0;
        }
    }

    /**
     * Clean up old processed messages to prevent memory leaks
     */
    cleanupProcessedMessages() {
        // Keep only messages from the last hour (3600000 ms)
        const oneHourAgo = Date.now() - 3600000;
        const messagesToKeep = new Set();
        
        for (const messageId of this.processedMessages) {
            // Extract timestamp from messageId (format: system:pilot:intel:timestamp)
            const parts = messageId.split(':');
            const timestamp = parseInt(parts[parts.length - 1]);
            
            if (timestamp > oneHourAgo) {
                messagesToKeep.add(messageId);
            }
        }
        
        this.processedMessages = messagesToKeep;
        this.log(`🧹 Cleaned up processed messages (kept ${messagesToKeep.size} recent messages)`);
    }

    /**
     * Filter lines to only include actual user messages (excludes MOTD, headers, empty lines)
     */
    filterToMessageLines(lines) {
        return lines.filter(line => {
            if (!line.trim()) return false;
            
            // Skip header lines (Channel ID, Channel Name, etc.)
            if (line.includes('Channel ID:') || 
                line.includes('Channel Name:') || 
                line.includes('Listener:') || 
                line.includes('Session started:') ||
                line.match(/^-+$/)) {
                return false;
            }
            
            // Skip EVE System MOTD messages
            if (line.includes('EVE System >') && line.includes('Channel MOTD')) {
                return false;
            }
            
            // Only include lines that match the chat log format
            const logRegex = /^\[\s*(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\s*\]\s*([^>]+)\s*>\s*(.+)$/;
            return logRegex.test(line.trim());
        });
    }

    /**
     * Get the count of actual message lines (excluding MOTD and headers)
     */
    getMessageLineCount(lines) {
        return this.filterToMessageLines(lines).length;
    }

    /**
     * Process a chat log file with optimized initial loading
     */
    async processLogFile(filePath, isInitialLoad = false) {
        try {
            // Read file with proper encoding detection for EVE logs
            let content;
            try {
                // First try reading as UTF-16 LE (little-endian) which is common for EVE logs
                content = fs.readFileSync(filePath, 'utf16le');
            } catch (error) {
                try {
                    // Fallback to UTF-8
                    content = fs.readFileSync(filePath, 'utf8');
                } catch (error2) {
                    this.log(`⚠ Error reading file ${path.basename(filePath)}: ${error2.message}`);
                    return;
                }
            }
            
            const allLines = content.split('\n');
            const lines = this.filterToMessageLines(allLines); // Only count actual message lines
            const lastProcessedLine = this.lastProcessedLines.get(filePath) || 0;

            // Extract system name from filename
            const fileName = path.basename(filePath, '.txt');
            const systemMatch = fileName.match(/^(.+?)_\d{8}_\d{6}.*$/);
            const system = systemMatch ? systemMatch[1] : 'Unknown';
            const channelName = system;
            const isIntelChannel = this.isIntelChannel(channelName);

            // For initial load, only process messages from the last 1 minute
            let linesToProcess;
            if (isInitialLoad) {
                const now = new Date();
                const oneMinuteAgo = new Date(now.getTime() - (1 * 60 * 1000));
                
                // Filter lines to only include messages from the last 1 minute
                linesToProcess = lines.filter(line => {
                    if (!line.trim()) return false;
                    const parsed = this.parseLogLine(line);
                    if (!parsed) return false;
                    return parsed.timestamp >= oneMinuteAgo;
                });
                
                if (isIntelChannel && linesToProcess.length > 0) {
                    this.log(`📋 Initial load: ${channelName} - found ${linesToProcess.length} recent messages (last 1 minute)`);
                }
                
                // Set last processed to total lines to avoid reprocessing on next change
                this.lastProcessedLines.set(filePath, lines.length);
            } else {
                // Normal processing: only new lines since last processed
                
                // Add a small buffer to catch any messages that might have been missed due to race conditions
                // Check up to 3 lines before the lastProcessedLine to catch any missed intel
                const bufferSize = 3;
                const startIndex = Math.max(0, lastProcessedLine - bufferSize);
                
                // Filter to only new lines that haven't been processed yet
                linesToProcess = [];
                for (let i = startIndex; i < lines.length; i++) {
                    const line = lines[i];
                    const lineIndex = i;
                    
                    // Only process lines that are truly new (at or after lastProcessedLine)
                    // OR lines in the buffer zone that contain intel keywords (safety check)
                    if (lineIndex >= lastProcessedLine) {
                        linesToProcess.push(line);
                    } else if (lineIndex >= startIndex && this.containsIntelKeywords(line)) {
                        linesToProcess.push(line);
                    }
                }
            }
            
            let processedCount = 0;
            let newMessageCount = 0;

            for (const line of linesToProcess) {
                if (!line.trim()) {
                    continue;
                }

                const parsed = this.parseLogLine(line);
                if (!parsed) {
                    continue;
                }

                newMessageCount++;
                this.stats.messagesProcessed++;

                // Show messages from intel channels (limit output for initial load)
                if (isIntelChannel) {
                    if (!isInitialLoad) {
                        const timestamp = new Date().toLocaleTimeString();
                        const messageAge = Math.floor((new Date() - parsed.timestamp) / 1000);
                        console.log(`💬 [${timestamp}] [${channelName}] ${parsed.pilot}: ${parsed.message} (${messageAge}s ago)`);
                    } else if (newMessageCount <= 3) {
                        console.log(`💬 [RECENT] [${channelName}] ${parsed.pilot}: ${parsed.message}`);
                    } else if (newMessageCount === 4) {
                        console.log(`💬 [RECENT] [${channelName}] ... (${linesToProcess.length - 3} more recent messages)`);
                    }
                }

                // Extract intel if message contains keywords
                const intelData = this.extractIntelData(
                    parsed.message,
                    system,
                    parsed.pilot,
                    parsed.timestamp,
                    channelName
                );

                if (intelData) {
                    const messageAge = Math.floor((new Date() - parsed.timestamp) / 1000);
                    
                    // Create unique message ID to prevent duplicates
                    const messageId = `${intelData.system}:${intelData.pilot}:${intelData.intel}:${parsed.timestamp.getTime()}`;
                    
                    // Check if we've already processed this exact message
                    if (this.processedMessages.has(messageId)) {
                        console.log(`🔄 [DUPLICATE] Skipping already processed: ${intelData.system} - ${intelData.intel}`);
                        continue;
                    }
                    
                    // Submit intel for NEW messages OR recent messages during initial load (within 1 minute)
                    const shouldSubmit = !isInitialLoad || messageAge <= (1 * 60); // 1 minute = 60 seconds
                    
                    if (shouldSubmit) {
                        // Mark as processed before submitting
                        this.processedMessages.add(messageId);
                        
                        const submitStartTime = Date.now();
                        console.log(`⚡ INTEL DETECTED: ${intelData.system} - ${intelData.intel} (message ${messageAge}s old)`);
                        await this.submitIntel(intelData);
                        const submitTime = Date.now() - submitStartTime;
                        console.log(`✅ Intel submitted in ${submitTime}ms (total delay: ~${messageAge}s)`);
                        processedCount++;
                    } else {
                        // During initial load, log that we found intel but don't submit if it's old
                        console.log(`📋 [INITIAL] Intel found: ${intelData.system} - ${intelData.intel} (message ${messageAge}s old) - NOT submitted`);
                    }
                }
            }

            // Update last processed line count (only for non-initial loads)
            if (!isInitialLoad) {
                this.lastProcessedLines.set(filePath, lines.length);
            }

            if (newMessageCount > 0 && isIntelChannel) {
                const loadType = isInitialLoad ? 'recent' : 'new';
                console.log(`📨 ${newMessageCount} ${loadType} messages in ${channelName}${processedCount > 0 ? `, ${processedCount} intel sent` : ''}`);
            }

        } catch (error) {
            console.error(`✗ Error processing log file ${filePath}: ${error.message}`);
            this.stats.errorsEncountered++;
        }
    }

    /**
     * Start monitoring EVE chat logs
     */
    async startMonitoring() {
        this.log('🚀 Simple EVE Intel Monitor Starting...');
        this.log(`📡 Server: ${this.config.serverUrl}`);
        this.log(`👤 Pilot: ${this.config.pilotName}`);
        
        try {
            const logsDirectory = this.findEveLogsDirectory();
            
            // Watch for new and modified log files with optimized settings for maximum speed
            const watcher = watch(path.join(logsDirectory, '*.txt'), {
                persistent: true,
                ignoreInitial: false,
                usePolling: true,         // Enable polling for OneDrive compatibility
                interval: 100,            // Poll every 100ms for ultra-fast detection
                awaitWriteFinish: {       // Wait for file write to complete
                    stabilityThreshold: 100,  // Wait only 100ms after last change
                    pollInterval: 50          // Check every 50ms for maximum responsiveness
                },
                atomic: true              // Handle atomic writes properly
            });

            watcher.on('add', (filePath) => {
                // Only process files modified in the last 24 hours
                if (!this.isFileRecent(filePath, 24)) {
                    return; // Skip old files
                }

                const fileName = path.basename(filePath, '.txt');
                const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, '');
                const isIntel = this.isIntelChannel(channelName);
                
                if (isIntel) {
                    // Register this log file and check if it should be the primary
                    const isPrimary = this.registerChannelLog(filePath);
                    
                    if (isPrimary) {
                        this.log(`🎯 Watching INTEL channel: ${path.basename(filePath)} ⚡ (PRIMARY)`);
                        // Initial load - only process recent messages for primary INTEL channels
                        this.processLogFile(filePath, true);
                    } else {
                        this.log(`📋 Found additional INTEL log: ${path.basename(filePath)} (standby)`);
                    }
                } else {
                    // Skip non-intel channels silently (removed verbose logging)
                }
            });

            watcher.on('change', (filePath) => {
                // Only process files modified in the last 24 hours
                if (!this.isFileRecent(filePath, 24)) {
                    return; // Skip old files silently
                }

                const fileName = path.basename(filePath, '.txt');
                const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, '');
                const isIntel = this.isIntelChannel(channelName);
                
                // Only log file changes for intel channels
                if (isIntel) {
                    const changeTime = new Date();
                    console.log(`🔄 [${changeTime.toLocaleTimeString()}] File change detected: ${path.basename(filePath)}`);
                    
                    // Update activity and check if this should become the primary log
                    const switchedToPrimary = this.updateLogActivity(filePath);
                    
                    // Only process if this is the primary log for this channel
                    if (this.isPrimaryLog(filePath)) {
                        console.log(`   ⚡ Processing INTEL channel: ${channelName} (PRIMARY)`);
                        // If we just switched to this primary log, treat it as initial load to avoid backlog processing
                        // Otherwise, normal processing for new messages only
                        this.processLogFile(filePath, switchedToPrimary);
                    } else {
                        console.log(`   📋 Ignoring non-primary INTEL log: ${channelName}`);
                    }
                } else {
                    // Silently ignore non-intel channels during runtime
                    return;
                }
            });

            watcher.on('error', (error) => {
                this.log(`✗ Watcher error: ${error.message}`);
                this.stats.errorsEncountered++;
            });

            this.log(`✓ Monitoring EVE chat logs in: ${logsDirectory}`);
            
            // Start heartbeat to track client connection
            this.startHeartbeat();
            
            // Print stats every 5 minutes
            setInterval(() => {
                this.printStats();
            }, 5 * 60 * 1000);

        } catch (error) {
            console.error(`✗ Failed to start monitoring: ${error.message}`);
            process.exit(1);
        }
    }

    /**
     * Print current statistics
     */
    printStats() {
        const uptime = Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000);
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        this.log(`\n📊 EVE Intel Monitor Stats:`);
        this.log(`   Uptime: ${hours}h ${minutes}m`);
        this.log(`   Messages processed: ${this.stats.messagesProcessed}`);
        this.log(`   Intel sent: ${this.stats.intelSent}`);
        this.log(`   Errors: ${this.stats.errorsEncountered}`);
        this.log(`   Files watching: ${this.watchedFiles.size}`);
        this.log('');
    }

    /**
     * Test connection to the server
     */
    async testConnection() {
        this.log('🔧 Testing connection to server...');
        try {
            const response = await fetch(`${this.config.serverUrl}/health`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                this.log('✅ Connection successful!');
                this.log(`   Server: ${result.status || 'online'}`);
                this.log(`   Version: ${result.version || '1.0.0'}`);
                return true;
            } else {
                this.log(`❌ Connection failed: ${response.status} ${response.statusText}`);
                return false;
            }
        } catch (error) {
            this.log(`❌ Connection error: ${error.message}`);
            return false;
        }
    }
}

// Main function
async function main() {
    const monitor = new SimpleIntelMonitor();
    
    // Make monitor available for graceful shutdown
    global.monitor = monitor;
    
    // Load configuration
    monitor.loadConfig();
    
    // Handle command line arguments
    const command = process.argv[2];
    
    switch (command) {
        case 'test':
            await monitor.testConnection();
            break;
            
        case 'start':
        case undefined:
            // Test connection first
            const connected = await monitor.testConnection();
            if (!connected) {
                console.error('❌ Cannot connect to server. Please check your configuration.');
                process.exit(1);
            }
            
            // Start monitoring
            await monitor.startMonitoring();
            break;
            
        case 'help':
        default:
            console.log('Simple EVE Intel Monitor');
            console.log('Usage:');
            console.log('  node simple-intel-monitor.js [command]');
            console.log('');
            console.log('Commands:');
            console.log('  test     Test connection to server');
            console.log('  start    Start monitoring (default)');
            console.log('  help     Show this help message');
            break;
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    console.log(`\n[${timestamp}] 👋 Shutting down Intel Monitor...`);
    if (global.monitor) {
        global.monitor.stopHeartbeat();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    console.log(`\n[${timestamp}] 👋 Shutting down Intel Monitor...`);
    if (global.monitor) {
        global.monitor.stopHeartbeat();
    }
    process.exit(0);
});

// Run the CLI
main().catch(error => {
    console.error(`💥 Fatal error: ${error.message}`);
    process.exit(1);
});
