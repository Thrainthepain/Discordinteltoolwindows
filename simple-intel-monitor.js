#!/usr/bin/env node

/**
 * Simple EVE Intel Monitor
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
            pilotName: 'Thrain Krill'
        };
        
        this.watchedFiles = new Map();
        this.lastProcessedLines = new Map();
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
            path.join('E:', 'EVE Online', 'logs', 'Chatlogs')
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
        return {
            timestamp: new Date(timestamp.replace(/\./g, '-').replace(' ', 'T') + 'Z'),
            pilot: pilot.trim(),
            message: message.trim()
        };
    }

    /**
     * Submit intel to the server
     */
    async submitIntel(intelData) {
        try {
            const startTime = Date.now();
            const response = await fetch(`${this.config.serverUrl}/api/intel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.apiKey,
                    'User-Agent': 'Simple-Intel-Monitor/1.0'
                },
                body: JSON.stringify(intelData)
            });

            const responseTime = Date.now() - startTime;

            if (response.ok) {
                this.stats.intelSent++;
                const sourceIcon = intelData.source === 'intel_channel' ? '🎯' : '💬';
                console.log(`✓ Intel sent ${sourceIcon}: ${intelData.system} - ${intelData.intel.substring(0, 50)}... (${responseTime}ms)`);
                return true;
            } else {
                throw new Error(`Server responded with status ${response.status}`);
            }
        } catch (error) {
            this.stats.errorsEncountered++;
            console.error(`✗ Failed to submit intel: ${error.message}`);
            return false;
        }
    }

    /**
     * Process a chat log file
     */
    async processLogFile(filePath) {
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
            const systemMatch = fileName.match(/^(.+?)_\d{8}_\d{6}.*$/); // Handle longer timestamps
            const system = systemMatch ? systemMatch[1] : 'Unknown';
            const channelName = system; // Use the extracted system/channel name
            const isIntelChannel = this.isIntelChannel(channelName);

            // Process new lines only
            const newLines = lines.slice(lastProcessedLine);
            let processedCount = 0;
            let newMessageCount = 0;

            for (const line of newLines) {
                if (!line.trim()) continue;

                const parsed = this.parseLogLine(line);
                if (!parsed) {
                    continue;
                }

                newMessageCount++;
                this.stats.messagesProcessed++;

                // Show all new messages from intel channels
                if (isIntelChannel) {
                    console.log(`💬 [${channelName}] ${parsed.pilot}: ${parsed.message}`);
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
                    console.log(`⚡ INTEL DETECTED: ${intelData.system} - ${intelData.intel}`);
                    await this.submitIntel(intelData);
                    processedCount++;
                }
            }

            // Update last processed line count
            this.lastProcessedLines.set(filePath, lines.length);

            if (newMessageCount > 0 && isIntelChannel) {
                console.log(`📊 ${newMessageCount} new messages in ${channelName}${processedCount > 0 ? `, ${processedCount} intel sent` : ''}`);
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
            
            // Watch for new and modified log files
            const watcher = watch(path.join(logsDirectory, '*.txt'), {
                persistent: true,
                ignoreInitial: false
            });

            watcher.on('add', (filePath) => {
                // Only process files modified in the last 24 hours
                if (!this.isFileRecent(filePath, 24)) {
                    return; // Skip old files
                }

                const fileName = path.basename(filePath, '.txt');
                const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, ''); // Remove timestamp and any suffix
                const isIntel = this.isIntelChannel(channelName);
                
                if (isIntel) {
                    console.log(`🎯 Watching INTEL channel: ${path.basename(filePath)} ⚡`);
                } else {
                    console.log(`👀 Watching log file: ${path.basename(filePath)}`);
                }
                
                this.processLogFile(filePath);
            });

            watcher.on('change', (filePath) => {
                // Only process files modified in the last 24 hours
                if (!this.isFileRecent(filePath, 24)) {
                    return; // Skip old files
                }

                const fileName = path.basename(filePath, '.txt');
                const channelName = fileName.replace(/_\d{8}_\d{6}.*$/, ''); // Remove timestamp and any suffix
                const isIntel = this.isIntelChannel(channelName);
                
                // Process the file
                this.processLogFile(filePath);
            });

            watcher.on('error', (error) => {
                console.error(`✗ Watcher error: ${error.message}`);
                this.stats.errorsEncountered++;
            });

            console.log(`✓ Monitoring EVE chat logs in: ${logsDirectory}`);
            
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
        
        console.log('\n📊 === Intel Monitor Stats ===');
        console.log(`⏱️  Uptime: ${hours}h ${minutes}m`);
        console.log(`📨 Messages processed: ${this.stats.messagesProcessed}`);
        console.log(`🎯 Intel sent: ${this.stats.intelSent}`);
        console.log(`❌ Errors: ${this.stats.errorsEncountered}`);
        console.log('=============================\n');
    }

    /**
     * Test connection to server
     */
    async testConnection() {
        try {
            console.log('🔍 Testing connection to server...');
            
            const response = await fetch(`${this.config.serverUrl}/health`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Simple-Intel-Monitor/1.0'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✓ Server connection OK: ${data.service} v${data.version}`);
                return true;
            } else {
                throw new Error(`Server responded with status ${response.status}`);
            }
        } catch (error) {
            console.error(`✗ Connection test failed: ${error.message}`);
            return false;
        }
    }
}

// CLI Interface
async function main() {
    const monitor = new SimpleIntelMonitor();
    
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
            console.log('  start    Start monitoring (default)');
            console.log('  test     Test connection to server');
            console.log('  help     Show this help message');
            console.log('');
            console.log('Configuration:');
            console.log('  Place client-config-workers.json or simple-intel-config.json in the same directory');
            break;
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down Intel Monitor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down Intel Monitor...');
    process.exit(0);
});

// Run the CLI
main().catch(error => {
    console.error(`💥 Fatal error: ${error.message}`);
    process.exit(1);
});
