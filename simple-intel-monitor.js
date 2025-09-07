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
            updateInterval: 1000, // Check every second
            pilotName: 'Thrain Krill',
            heartbeatInterval: 5 * 60 * 1000 // 5 minutes
        };
        
        this.watchedFiles = new Map();
        this.lastProcessedLines = new Map();
        this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.heartbeatTimer = null;
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

                    console.log(`✓ Configuration loaded from ${configPath}`);
                    break;
                }
            }
        } catch (error) {
            console.log(`⚠ Using default configuration: ${error.message}`);
        }
    }

    /**
     * Send heartbeat to server to track client connection
     */
    async sendHeartbeat() {
        try {
            const heartbeatData = {
                clientId: this.clientId,
                pilot: this.config.pilotName,
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                platform: `${os.platform()}-${os.arch()}`,
                stats: {
                    uptime: Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000),
                    messagesProcessed: this.stats.messagesProcessed,
                    intelSent: this.stats.intelSent,
                    errorsEncountered: this.stats.errorsEncountered,
                    watchedFiles: this.watchedFiles.size
                }
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
                console.log(`💗 Heartbeat sent successfully`);
            } else {
                console.log(`⚠ Heartbeat failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.log(`⚠ Heartbeat error: ${error.message}`);
        }
    }

    /**
     * Start heartbeat timer
     */
    startHeartbeat() {
        console.log(`💗 Starting heartbeat every ${this.config.heartbeatInterval / 1000 / 60} minutes`);
        
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
            console.log('💗 Heartbeat stopped');
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
                console.log(`✓ Using custom EVE logs path: ${customPath}`);
                return customPath;
            } else {
                console.log(`⚠ Custom path not found: ${customPath}, trying default locations...`);
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

        console.log('🔍 Scanning for EVE Online chat logs...');
        
        for (const logPath of possiblePaths) {
            console.log(`   Checking: ${logPath}`);
            if (fs.existsSync(logPath)) {
                // Verify it contains chat log files
                try {
                    const files = fs.readdirSync(logPath);
                    const logFiles = files.filter(file => file.endsWith('.txt'));
                    
                    if (logFiles.length > 0) {
                        console.log(`✓ Found EVE logs at: ${logPath} (${logFiles.length} files)`);
                        return logPath;
                    } else {
                        console.log(`   Directory exists but no .txt files found`);
                    }
                } catch (error) {
                    console.log(`   Cannot read directory: ${error.message}`);
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

        // For dedicated intel channels, accept more messages (lower threshold)
        if (!hasIntelKeyword && !isFromIntelChannel) {
            return null;
        }

        // For intel channels, even messages without keywords might be intel
        if (isFromIntelChannel && !hasIntelKeyword) {
            // Check if it's likely intel (system names, directional info, etc.)
            const likelyIntel = /\b(gate|station|belt|asteroid|moon|planet|sun|warp|jump|dock|undock|in|out|\+1|\-1|next|coming|going)\b/i.test(lowerMessage);
            if (!likelyIntel) {
                return null;
            }
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
        
        // Parse timestamp as local time (EVE logs are in local timezone)
        const localTimestamp = timestamp.replace(/\./g, '-').replace(' ', 'T');
        
        return {
            timestamp: new Date(localTimestamp), // Parse as local time, not UTC
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
            const response = await fetch(`${this.config.serverUrl}/api/intel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(intelData)
            });

            const responseTime = Date.now() - startTime;
            
            if (response.ok) {
                const result = await response.json();
                this.stats.intelSent++;
                console.log(`✅ Intel submitted successfully (${responseTime}ms)`);
                if (result.message && result.message !== 'Intel received successfully') {
                    console.log(`   Server: ${result.message}`);
                }
            } else {
                const errorText = await response.text();
                console.error(`❌ Failed to submit intel: ${response.status} ${response.statusText}`);
                console.error(`   Response: ${errorText}`);
                this.stats.errorsEncountered++;
            }
        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error(`❌ Error submitting intel (${responseTime}ms):`, error.message);
            this.stats.errorsEncountered++;
        }
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
                    console.log(`⚠ Error reading file ${path.basename(filePath)}:`, error2.message);
                    return;
                }
            }
            
            const lines = content.split('\n');
            const lastProcessedLine = this.lastProcessedLines.get(filePath) || 0;

            // Extract system name from filename
            const fileName = path.basename(filePath, '.txt');
            const systemMatch = fileName.match(/^(.+?)_\d{8}_\d{6}.*$/);
            const system = systemMatch ? systemMatch[1] : 'Unknown';
            const channelName = system;
            const isIntelChannel = this.isIntelChannel(channelName);

            // For initial load, only process messages from the last 10 minutes
            let linesToProcess;
            if (isInitialLoad) {
                const now = new Date();
                const tenMinutesAgo = new Date(now.getTime() - (10 * 60 * 1000));
                
                // Filter lines to only include messages from the last 10 minutes
                linesToProcess = lines.filter(line => {
                    if (!line.trim()) return false;
                    const parsed = this.parseLogLine(line);
                    if (!parsed) return false;
                    return parsed.timestamp >= tenMinutesAgo;
                });
                
                if (isIntelChannel && linesToProcess.length > 0) {
                    console.log(`📋 Initial load: ${channelName} - found ${linesToProcess.length} recent messages (last 10 minutes)`);
                }
                
                // Set last processed to total lines to avoid reprocessing on next change
                this.lastProcessedLines.set(filePath, lines.length);
            } else {
                // Normal processing: only new lines since last processed
                linesToProcess = lines.slice(lastProcessedLine);
            }
            
            let processedCount = 0;
            let newMessageCount = 0;

            for (const line of linesToProcess) {
                if (!line.trim()) continue;

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
                    
                    // Only submit intel for NEW messages (not during initial load)
                    if (!isInitialLoad) {
                        const submitStartTime = Date.now();
                        console.log(`⚡ INTEL DETECTED: ${intelData.system} - ${intelData.intel} (message ${messageAge}s old)`);
                        await this.submitIntel(intelData);
                        const submitTime = Date.now() - submitStartTime;
                        console.log(`✅ Intel submitted in ${submitTime}ms (total delay: ~${messageAge}s)`);
                        processedCount++;
                    } else {
                        // During initial load, just log that we found intel but don't submit
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
        console.log('🚀 Simple EVE Intel Monitor Starting...');
        console.log(`📡 Server: ${this.config.serverUrl}`);
        console.log(`👤 Pilot: ${this.config.pilotName}`);
        
        try {
            const logsDirectory = this.findEveLogsDirectory();
            
            // Watch for new and modified log files with optimized settings
            const watcher = watch(path.join(logsDirectory, '*.txt'), {
                persistent: true,
                ignoreInitial: false,
                usePolling: false,        // Use native OS events for faster detection
                awaitWriteFinish: {       // Wait for file write to complete
                    stabilityThreshold: 100,  // Wait 100ms after last change
                    pollInterval: 50          // Check every 50ms
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
                    console.log(`🎯 Watching INTEL channel: ${path.basename(filePath)} ⚡`);
                } else {
                    console.log(`👀 Watching log file: ${path.basename(filePath)}`);
                }
                
                // Initial load - only process recent messages
                this.processLogFile(filePath, true);
            });

            watcher.on('change', (filePath) => {
                const changeTime = new Date();
                console.log(`🔄 [${changeTime.toLocaleTimeString()}] File change detected: ${path.basename(filePath)}`);
                
                // Only process files modified in the last 24 hours
                if (!this.isFileRecent(filePath, 24)) {
                    return; // Skip old files
                }

                const fileName = path.basename(filePath, '.txt');
                const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, '');
                const isIntel = this.isIntelChannel(channelName);
                
                if (isIntel) {
                    console.log(`⚡ [${changeTime.toLocaleTimeString()}] Processing intel channel: ${channelName}`);
                }
                
                // Normal processing - only new messages
                this.processLogFile(filePath, false);
            });

            watcher.on('error', (error) => {
                console.error(`✗ Watcher error: ${error.message}`);
                this.stats.errorsEncountered++;
            });

            console.log(`✓ Monitoring EVE chat logs in: ${logsDirectory}`);
            
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
        
        console.log(`\n📊 EVE Intel Monitor Stats:`);
        console.log(`   Uptime: ${hours}h ${minutes}m`);
        console.log(`   Messages processed: ${this.stats.messagesProcessed}`);
        console.log(`   Intel sent: ${this.stats.intelSent}`);
        console.log(`   Errors: ${this.stats.errorsEncountered}`);
        console.log(`   Files watching: ${this.watchedFiles.size}`);
        console.log('');
    }

    /**
     * Test connection to the server
     */
    async testConnection() {
        console.log('🔧 Testing connection to server...');
        try {
            const response = await fetch(`${this.config.serverUrl}/api/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Connection successful!');
                console.log(`   Server: ${result.status || 'Online'}`);
                console.log(`   Version: ${result.version || 'Unknown'}`);
                return true;
            } else {
                console.error(`❌ Connection failed: ${response.status} ${response.statusText}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ Connection error: ${error.message}`);
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
    console.log('\n👋 Shutting down Intel Monitor...');
    if (global.monitor) {
        global.monitor.stopHeartbeat();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down Intel Monitor...');
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
