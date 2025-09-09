import fs from 'fs';
import path from 'path';
import os from 'os';
import fetch from 'node-fetch';

class SimpleIntelMonitor {
    constructor() {
        // Default configuration, will be merged with the JSON config file
        this.config = {
            serverUrl: 'https://intel.thrainkrill.space',
            apiKey: 'desktop-client-api-key-2024',
            pilotName: 'Desktop Client',
            heartbeatInterval: 5 * 60 * 1000, // 5 minutes
            eveLogsPath: null, // Will be auto-detected if null
            inactiveFileTimeout: 2 * 60 * 1000 // 2 minutes to consider a file inactive
        };
        
        // State management
        this.fileStates = new Map();
        this.activeFiles = new Map(); // Track which files are actively being written to
        this.primaryFile = null; // The currently primary active file
        this.clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        this.heartbeatTimer = null;
        this.running = false;
        this.stats = {
            messagesProcessed: 0,
            intelSent: 0,
            errorsEncountered: 0,
            startTime: new Date()
        };
        this.submittedIntel = new Map(); // Tracks submitted intel to prevent duplicates
        this.monitoringStartTime = null; // Track when monitoring started
        this.processingFiles = new Set(); // Track files currently being processed to prevent overlapping
        this.fileChangeDebounce = new Map(); // Debounce rapid file change events
        this.primaryFilesByChannel = new Map(); // Track primary file per channel
        this.standbyFilesByChannel = new Map(); // Track standby files per channel
        this.lastPrimarySelection = 0; // Track when we last ran primary selection
        this.primarySelectionShown = new Set(); // Track which channels we've shown primary selection for
        
        // Intel detection patterns
        this.intelKeywords = [
            'red', 'hostile', 'enemy', 'neut', 'neutral', 'unknown',
            'clear', 'clr', 'status', 'gate', 'station', 'cyno', 'bridge',
            'dock', 'undock', 'jump', 'warp', 'belt', 'safe', 'pos',
            'titan', 'super', 'dread', 'carrier', 'fax', 'blops',
            'drag', 'bubble', 'sabre', 'dictor', 'interdictor',
            'camp', 'camping', 'fleet', 'gang', 'blob', 'spike',
            'drop', 'dropped', 'tackle', 'point', 'scram'
        ];
        
        // EVE system name pattern (examples: J164738, 4O-239, M-OEE8, NIDJ-K, IP6V-X)
        this.systemPattern = /\b([A-Z0-9]{1,4}-[A-Z0-9]{1,4}|J\d{6})\b/g;
        
        // Comprehensive ship name list - just the ship names without faction variants
        this.shipNames = [
            // Assault Frigates
            'Gatherer', 'Retribution', 'Vengeance', 'Harpy', 'Hawk', 'Enyo', 'Erinye', 'Ishkur', 'Kishar', 'Blade', 'Dagger', 'Jaguar', 'Wolf',
            // Attack Battlecruisers
            'Oracle', 'Naga', 'Talos', 'Tornado',
            // Battleships
            'Abaddon', 'Apocalypse', 'Armageddon', 'Rattlesnake', 'Raven', 'Rokh', 'Scorpion', 'Dominix', 'Hyperion', 'Megathron', 'Maelstrom', 'Tempest', 'Typhoon',
            // Black Ops
            'Redeemer', 'Widow', 'Sin', 'Panther',
            // Blockade Runners
            'Prorator', 'Crane', 'Viator', 'Prowler',
            // Carriers
            'Archon', 'Chimera', 'Thanatos', 'Nidhoggur',
            // Combat Battlecruisers
            'Harbinger', 'Prophecy', 'Drake', 'Ferox', 'Brutix', 'Myrmidon', 'Cyclone', 'Hurricane',
            // Combat Recon Ships
            'Curse', 'Rook', 'Lachesis', 'Huginn',
            // Command Destroyers
            'Pontifex', 'Stork', 'Magus', 'Bifrost',
            // Command Ships
            'Absolution', 'Damnation', 'Nighthawk', 'Vulture', 'Astarte', 'Eos', 'Claymore', 'Sleipnir',
            // Corvettes
            'Impairor', 'Ibis', 'Velator', 'Reaper',
            // Covert Ops
            'Anathema', 'Buzzard', 'Helios', 'Cheetah',
            // Cruisers
            'Arbitrator', 'Augoror', 'Maller', 'Omen', 'Blackbird', 'Caracal', 'Moa', 'Osprey', 'Celestis', 'Exequror', 'Thorax', 'Vexor', 'Bellicose', 'Rupture', 'Scythe', 'Stabber',
            // Deep Space Transports
            'Impel', 'Bustard', 'Occator', 'Mastodon',
            // Destroyers
            'Coercer', 'Dragoon', 'Corax', 'Cormorant', 'Algos', 'Catalyst', 'Talwar', 'Thrasher',
            // Dreadnoughts
            'Revelation', 'Phoenix', 'Moros', 'Naglfar',
            // Electronic Attack Ships
            'Sentinel', 'Kitsune', 'Keres', 'Hyena',
            // Force Auxiliaries
            'Apostle', 'Minokawa', 'Ninazu', 'Lif',
            // Force Recon Ships
            'Pilgrim', 'Falcon', 'Arazu', 'Rapier',
            // Freighters
            'Providence', 'Charon', 'Obelisk', 'Fenrir',
            // Frigates
            'Crucifier', 'Executioner', 'Inquisitor', 'Magnate', 'Punisher', 'Tormentor', 'Bantam', 'Condor', 'Griffin', 'Heron', 'Kestrel', 'Merlin', 'Atron', 'Imicus', 'Incursus', 'Maulus', 'Navitas', 'Tristan', 'Breacher', 'Burst', 'Probe', 'Rifter', 'Slasher', 'Vigil',
            // Haulers
            'Bestower', 'Sigil', 'Badger', 'Tayra', 'Epithal', 'Iteron', 'Kryos', 'Miasmos', 'Nereus', 'Hoarder', 'Mammoth', 'Wreathe',
            // Heavy Assault Cruisers
            'Sacrilege', 'Zealot', 'Cerberus', 'Eagle', 'Deimos', 'Ishtar', 'Muninn', 'Vagabond',
            // Heavy Interdiction Cruisers
            'Devoter', 'Onyx', 'Phobos', 'Broadsword',
            // Interceptors
            'Crusader', 'Malediction', 'Crow', 'Raptor', 'Ares', 'Taranis', 'Claw', 'Stiletto',
            // Interdictors
            'Heretic', 'Flycatcher', 'Eris', 'Sabre',
            // Jump Freighters
            'Ark', 'Rhea', 'Anshar', 'Nomad',
            // Logistics
            'Guardian', 'Basilisk', 'Oneiros', 'Scimitar',
            // Marauders
            'Paladin', 'Golem', 'Kronos', 'Vargur',
            // Stealth Bombers
            'Purifier', 'Manticore', 'Nemesis', 'Hound',
            // Strategic Cruisers
            'Legion', 'Tengu', 'Proteus', 'Loki',
            // Supercarriers
            'Aeon', 'Wyvern', 'Nyx', 'Hel',
            // Tactical Destroyers
            'Confessor', 'Jackdaw', 'Hecate', 'Svipul',
            // Titans
            'Avatar', 'Leviathan', 'Erebus', 'Ragnarok',
            // O.R.E. Ships
            'Rorqual', 'Hulk', 'Mackinaw', 'Skiff', 'Endurance', 'Prospect', 'Bowhead', 'Venture', 'Noctis', 'Orca', 'Porpoise', 'Covetor', 'Procurer', 'Retriever',
            // Common special edition/unique ships
            'Sunesis', 'Gnosis', 'Praxis', 'Marshal'
        ];
    }

    /**
     * Loads configuration from simple-intel-config.json and merges it with defaults.
     */
    loadConfig() {
        try {
            const configPath = path.join(process.cwd(), 'simple-intel-config.json');
            if (fs.existsSync(configPath)) {
                const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                Object.assign(this.config, configData); // Merge settings from file
                console.log('✓ Configuration loaded from simple-intel-config.json');
            } else {
                console.log('ℹ️ No config file found. Using default settings.');
            }
        } catch (error) {
            console.error('⚠️ Error loading configuration:', error.message);
        }
    }

    /**
     * Finds the EVE Online chat log directory by checking common locations.
     * Prioritizes the path from the config file if it exists.
     * @returns {string} The path to the chat logs directory.
     */
    findEveLogsDirectory() {
        // Check if a custom path is set and non-empty
        if (this.config.eveLogsPath && this.config.eveLogsPath.trim() !== '' && fs.existsSync(this.config.eveLogsPath)) {
            console.log(`✓ Using custom EVE logs path from config: ${this.config.eveLogsPath}`);
            return this.config.eveLogsPath;
        }
        
        // If custom path is set but doesn't exist, warn the user
        if (this.config.eveLogsPath && this.config.eveLogsPath.trim() !== '' && !fs.existsSync(this.config.eveLogsPath)) {
            console.log(`⚠️ Custom EVE logs path not found: ${this.config.eveLogsPath}`);
            console.log(`⚠️ Falling back to auto-detection...`);
        }

        const possiblePaths = [
            path.join(os.homedir(), 'OneDrive', 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join(os.homedir(), 'Documents', 'EVE', 'logs', 'Chatlogs'),
            path.join(os.homedir(), 'OneDrive - Personal', 'Documents', 'EVE', 'logs', 'Chatlogs'),
        ];

        console.log('🔍 Scanning for EVE Online chat logs...');
        for (const logPath of possiblePaths) {
            if (fs.existsSync(logPath)) {
                console.log(`✓ Found EVE logs at: ${logPath}`);
                return logPath;
            }
        }
        throw new Error('EVE logs directory not found! Please set "eveLogsPath" in your config file.');
    }

    /**
     * Gets all Intel channel files and determines which one is currently active
     * @param {string} logsDirectory - The EVE logs directory path
     * @param {boolean} silent - If true, don't log the file list
     * @param {boolean} onlyNewFiles - If true, only return files created after monitoring started
     * @returns {Array} Array of Intel file info objects
     */
    getIntelFiles(logsDirectory, silent = false, onlyNewFiles = false) {
        const files = fs.readdirSync(logsDirectory);
        const intelFiles = [];
        
        // For startup: check last 6 hours. For runtime: only check files created after monitoring started
        const timeThreshold = onlyNewFiles 
            ? this.monitoringStartTime 
            : Date.now() - (6 * 60 * 60 * 1000); // 6 hours ago

        for (const filename of files) {
            // Look for Intel channel files
            if (filename.toLowerCase().includes('intel') && filename.endsWith('.txt')) {
                const filePath = path.join(logsDirectory, filename);
                const stats = fs.statSync(filePath);
                
                // Filter by time threshold
                if (stats.mtime.getTime() < timeThreshold) {
                    continue;
                }
                
                // Extract character ID from filename (last numbers before .txt)
                const characterMatch = filename.match(/_(\d+)\.txt$/);
                const characterId = characterMatch ? characterMatch[1] : 'unknown';
                
                intelFiles.push({
                    filePath,
                    filename,
                    characterId,
                    lastModified: stats.mtime,
                    size: stats.size,
                    channel: this.extractChannelName(filename)
                });
            }
        }

        // Sort by last modified time (most recent first)
        intelFiles.sort((a, b) => b.lastModified - a.lastModified);
        
        // PRIMARY/STANDBY SELECTION: Only monitor one file per intel channel
        const selectedFiles = this.selectPrimaryIntelFiles(intelFiles);
        
        if (!silent) {
            const timeDesc = onlyNewFiles ? 'new' : 'recent (last 6 hours)';
            console.log(`📋 Found ${intelFiles.length} ${timeDesc} Intel channel files, selected ${selectedFiles.length} primary files:`);
            selectedFiles.forEach((file, index) => {
                const age = Math.floor((Date.now() - file.lastModified.getTime()) / 1000);
                const status = index === 0 ? '[PRIMARY]' : '[STANDBY]';
                console.log(`   ${status} ${file.filename} (${age}s ago, Character: ${file.characterId})`);
            });
        }

        return selectedFiles;
    }

    /**
     * Selects primary intel files - only one file per channel to avoid local duplicates
     * Implements primary/standby system with silent monitoring and automatic failover
     * @param {Array} intelFiles - Array of intel file objects
     * @returns {Array} Array of selected primary files
     */
    selectPrimaryIntelFiles(intelFiles) {
        const now = Date.now();
        const inactiveThreshold = 5 * 60 * 1000; // 5 minutes
        const channelGroups = new Map();
        
        // Group files by channel name
        for (const file of intelFiles) {
            const channelName = file.channel;
            if (!channelGroups.has(channelName)) {
                channelGroups.set(channelName, []);
            }
            channelGroups.get(channelName).push(file);
        }
        
        const selectedFiles = [];
        
        // For each channel, manage primary/standby system
        for (const [channelName, files] of channelGroups) {
            // Sort by last modified time (most recent first)
            files.sort((a, b) => b.lastModified - a.lastModified);
            
            const currentPrimary = this.primaryFilesByChannel.get(channelName);
            const currentStandbys = this.standbyFilesByChannel.get(channelName) || [];
            
            if (files.length === 1) {
                // Only one file for this channel
                selectedFiles.push(files[0]);
                this.primaryFilesByChannel.set(channelName, files[0]);
                this.standbyFilesByChannel.set(channelName, []);
                
                // Show selection only once at startup
                if (!this.primarySelectionShown.has(channelName)) {
                    console.log(`📡 Channel "${channelName}": Only one file found`);
                    console.log(`   ✅ PRIMARY: ${files[0].filename}`);
                    this.primarySelectionShown.add(channelName);
                }
                continue;
            }
            
            // Check if current primary is still active
            let activePrimary = null;
            if (currentPrimary) {
                const currentPrimaryFile = files.find(f => f.filePath === currentPrimary.filePath);
                if (currentPrimaryFile) {
                    const timeSinceLastModified = now - currentPrimaryFile.lastModified.getTime();
                    if (timeSinceLastModified < inactiveThreshold) {
                        activePrimary = currentPrimaryFile;
                    }
                }
            }
            
            if (activePrimary) {
                // Current primary is still active, keep it
                selectedFiles.push(activePrimary);
                const otherFiles = files.filter(f => f.filePath !== activePrimary.filePath);
                this.standbyFilesByChannel.set(channelName, otherFiles);
            } else {
                // Primary is inactive or doesn't exist, select new primary
                const mostRecent = files[0];
                const timeSinceLastModified = now - mostRecent.lastModified.getTime();
                
                let newPrimary = null;
                
                if (timeSinceLastModified < inactiveThreshold) {
                    // Most recent file is active, use it
                    newPrimary = mostRecent;
                } else {
                    // Most recent is inactive, find first active standby
                    for (const file of files) {
                        const fileAge = now - file.lastModified.getTime();
                        if (fileAge < inactiveThreshold) {
                            newPrimary = file;
                            break;
                        }
                    }
                    
                    // If no active files, use most recent anyway
                    if (!newPrimary) {
                        newPrimary = mostRecent;
                    }
                }
                
                selectedFiles.push(newPrimary);
                this.primaryFilesByChannel.set(channelName, newPrimary);
                
                const otherFiles = files.filter(f => f.filePath !== newPrimary.filePath);
                this.standbyFilesByChannel.set(channelName, otherFiles);
                
                // Show selection only when changing or at startup
                const isNewChannel = !this.primarySelectionShown.has(channelName);
                const isPrimaryChange = currentPrimary && currentPrimary.filePath !== newPrimary.filePath;
                
                if (isNewChannel || isPrimaryChange) {
                    if (isPrimaryChange) {
                        console.log(`🔄 Channel "${channelName}": Primary changed (previous inactive)`);
                    } else {
                        console.log(`📡 Channel "${channelName}": Found ${files.length} files, selecting primary...`);
                    }
                    
                    const age = Math.floor((now - newPrimary.lastModified.getTime()) / 1000);
                    const status = age < (inactiveThreshold / 1000) ? 'active' : 'inactive';
                    console.log(`   ✅ PRIMARY: ${newPrimary.filename} (${status}, last modified ${age}s ago)`);
                    
                    otherFiles.forEach(file => {
                        const fileAge = Math.floor((now - file.lastModified.getTime()) / 1000);
                        console.log(`   ⏸️  STANDBY: ${file.filename} (${fileAge}s ago)`);
                    });
                    
                    this.primarySelectionShown.add(channelName);
                }
            }
        }
        
        return selectedFiles;
    }

    /**
     * Extracts channel name from filename
     * @param {string} filename - The log filename
     * @returns {string} The channel name
     */
    extractChannelName(filename) {
        // Remove timestamp and character ID from filename
        // Examples: Phoenix_Intel_South_20250907_193309_2122867331.txt -> Phoenix_Intel_South
        //          Phoenix_Intel_20250907_193309_2122867331.txt -> Phoenix_Intel
        const match = filename.match(/^(.+?)_\d{8}_\d{6}_\d+\.txt$/);
        if (match) {
            const channelName = match[1].replace(/_/g, ' '); // Convert underscores to spaces for readability
            return channelName;
        }
        const fallback = path.basename(filename, '.txt');
        return fallback;
    }

    /**
     * Checks if a message contains intel information
     * Simple rule: System name OR Ship name = Intel
     * @param {string} message - The chat message
     * @returns {boolean} True if message appears to contain intel
     */
    isIntelMessage(message) {
        const lowerMessage = message.toLowerCase();
        
        // Skip system messages and common non-intel patterns
        if (lowerMessage.includes('eve system >') || 
            lowerMessage.includes('channel motd') ||
            lowerMessage.includes('welcome to') ||
            lowerMessage.includes('changed topic') ||
            lowerMessage.includes('has joined') ||
            lowerMessage.includes('has left') ||
            lowerMessage.length < 3) {
            return false;
        }

        // Check for system names - IMPORTANT: test against original message, not lowercase
        this.systemPattern.lastIndex = 0;
        const hasSystemName = this.systemPattern.test(message);
        
        // Check for ship names (case insensitive with word boundaries to avoid false positives)
        const hasShipName = this.shipNames.some(ship => {
            // Use word boundary regex to avoid substring false positives like "eris" in "flerish"
            const shipRegex = new RegExp(`\\b${ship.toLowerCase()}\\b`, 'i');
            return shipRegex.test(message);
        });
        
        // Debug logging
        if (hasSystemName || hasShipName) {
            console.log(`🔍 [DEBUG] Testing message: "${message}"`);
            console.log(`   Systems: ${hasSystemName}, Ships: ${hasShipName}`);
            
            if (hasSystemName) {
                this.systemPattern.lastIndex = 0;
                const systems = this.extractSystemNames(message);
                console.log(`   Found systems: ${JSON.stringify(systems)}`);
            }
            
            if (hasShipName) {
                const foundShips = this.shipNames.filter(ship => {
                    const shipRegex = new RegExp(`\\b${ship.toLowerCase()}\\b`, 'i');
                    return shipRegex.test(message);
                });
                console.log(`   Found ships: ${JSON.stringify(foundShips)}`);
            }
        }

        // Simple rule: System name OR Ship name = Intel
        return hasSystemName || hasShipName;
    }

    /**
     * Extracts system names from a message
     * @param {string} message - The chat message
     * @returns {Array} Array of system names found
     */
    extractSystemNames(message) {
        const systems = [];
        let match;
        // Create a fresh regex instance to avoid state issues - updated to match more EVE systems
        const regex = /\b([A-Z0-9]{1,4}-[A-Z0-9]{1,4}|J\d{6})\b/g;
        
        while ((match = regex.exec(message)) !== null) {
            systems.push(match[1]);
        }
        
        return [...new Set(systems)]; // Remove duplicates
    }

    /**
     * Parses a line from an EVE chat log.
     * @param {string} line - The raw line from the log file.
     * @returns {object|null} A parsed log entry or null if invalid.
     */
    parseLogLine(line) {
        const cleanLine = line.replace(/^[\uFEFF\uFFFE]/, '').replace(/\0/g, '').trim();
        if (!cleanLine) return null;

        // Handle EVE log format: [ 2025.09.07 16:52:50 ] Pilot Name > Message
        const logRegex = /^\[\s*(\d{4}\.\d{2}\.\d{2}\s+\d{2}[:.]\d{2}[:.]\d{2})\s*\]\s*([^>]+)\s*>\s*(.+)$/;
        const match = cleanLine.match(logRegex);
        if (!match) return null;

        const [, timestampStr, pilot, message] = match;
        
        // Convert EVE timestamp format to ISO
        const normalizedTimestamp = new Date(timestampStr.replace(/\./g, '-').replace(' ', 'T') + 'Z');
        if (isNaN(normalizedTimestamp.getTime())) return null;

        return { 
            timestamp: normalizedTimestamp, 
            pilot: pilot.trim(), 
            message: message.trim() 
        };
    }

    /**
     * Reads only the new content from a file since the last read.
     * @param {string} filePath - Path to the file.
     * @param {number} lastSize - The last known size of the file.
     * @returns {Promise<string|null>} New content or null on error.
     */
    async readNewContent(filePath, lastSize) {
        return new Promise((resolve) => {
            // EVE logs are in UTF-16LE encoding
            const stream = fs.createReadStream(filePath, { 
                start: lastSize, 
                encoding: 'utf16le' 
            });
            let content = '';
            stream.on('data', chunk => content += chunk);
            stream.on('end', () => resolve(content));
            stream.on('error', (error) => {
                console.warn(`⚠️ Error reading file ${filePath}: ${error.message}`);
                resolve(null);
            });
        });
    }

    /**
     * Submits intel data to the server.
     * @param {object} intelData - The intel payload to send.
     */
    async submitIntel(intelData) {
        try {
            // Debug logging to see what we're sending
            console.log(`🔍 Submitting intel data:`, {
                system: intelData.system,
                intel: intelData.intel,
                pilot: intelData.pilot,
                channel: intelData.channel,
                timestamp: intelData.timestamp
            });

            const response = await fetch(`${this.config.serverUrl}/api/intel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(intelData)
            });

            if (response.ok) {
                console.log(`✅ Intel submitted from ${intelData.channel}: ${intelData.intel}`);
                this.stats.intelSent++;
                return true;
            } else {
                console.error(`❌ Failed to submit intel from ${intelData.channel}: ${response.status} ${response.statusText}`);
                this.stats.errorsEncountered++;
                return false;
            }
        } catch (error) {
            console.error(`❌ Network error submitting intel from ${intelData.channel || 'unknown'}: ${error.message}`);
            this.stats.errorsEncountered++;
            return false;
        }
    }
    
    /**
     * Sends a heartbeat to the server to show the client is active.
     */
    async sendHeartbeat() {
        try {
            const heartbeatData = {
                clientId: this.clientId,
                pilot: this.config.pilotName,
                version: '2.1.0-enhanced',
                platform: `${os.platform()}-${os.arch()}`,
                stats: {
                    uptime: Math.floor((Date.now() - this.stats.startTime.getTime()) / 1000),
                    watchedFiles: this.fileStates.size,
                    activeFiles: this.activeFiles.size,
                    primaryFile: this.primaryFile ? path.basename(this.primaryFile) : 'none',
                    ...this.stats
                }
            };
            const response = await fetch(`${this.config.serverUrl}/api/heartbeat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(heartbeatData)
            });
            
            if (response.ok) {
                console.log('💗 Heartbeat sent successfully.');
            } else {
                console.warn(`⚠️ Heartbeat failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.warn(`⚠️ Heartbeat failed: ${error.message}`);
        }
    }

    /**
     * Processes new lines from a log file, distinguishing between initial load and real-time updates.
     * @param {string} filePath - Path to the log file.
     * @param {string[]} lines - Array of lines to process.
     * @param {boolean} isInitialLoad - True if this is the first time seeing the file.
     */
    async processNewLines(filePath, lines, isInitialLoad, isPrimaryFile = true) {
        // Extract channel name ONCE per file processing session to avoid spam
        const filename = path.basename(filePath);
        const channelName = this.extractChannelName(filename);
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        
        console.log(`📝 Processing ${lines.length} lines from ${filename} (Channel: ${channelName}, isInitial: ${isInitialLoad})`);

        let processedCount = 0;
        let intelCount = 0;

        for (const line of lines) {
            const parsed = this.parseLogLine(line);
            if (!parsed) continue;

            processedCount++;

            // On initial load, handle very fresh messages differently to avoid duplicate conflicts
            if (isInitialLoad) {
                const age = Math.floor((Date.now() - parsed.timestamp.getTime()) / 1000);
                const veryRecent = age < 30; // Messages under 30 seconds are considered "very recent"
                
                if (parsed.timestamp.getTime() >= tenMinutesAgo) {
                    // Check if it would be intel to provide accurate logging
                    const wouldBeIntel = this.isIntelMessage(parsed.message);
                    const status = wouldBeIntel ? '[INTEL]' : '[CHAT]';
                    
                    if (veryRecent && wouldBeIntel) {
                        console.log(`📋 [INITIAL] ${status} Very recent message from ${channelName}: "${parsed.message}" (${age}s old) - WILL process as real-time`);
                        // Don't continue - but also don't mark as initial load anymore
                        // Reset isInitialLoad for this message only to let it process normally
                    } else {
                        console.log(`📋 [INITIAL] ${status} Recent message from ${channelName}: "${parsed.message}" (${age}s old) - NOT submitted (initial load)`);
                        continue;
                    }
                } else {
                    continue; // Skip old messages entirely
                }
            }
            
            // From this point on, treat very recent initial messages as real-time messages
            
            // Log ALL messages for debugging, not just intel
            const age = Math.floor((Date.now() - parsed.timestamp.getTime()) / 1000);
            console.log(`💬 [${age}s old] ${parsed.pilot} in ${channelName}: ${parsed.message}`);
            
            // Skip if not an intel message
            if (!this.isIntelMessage(parsed.message)) {
                console.log(`   ⏭️ Not intel - skipping`);
                continue;
            }
            
            intelCount++;
            this.stats.messagesProcessed++;
            
            // PRIMARY FILE CHECK: Only process intel from primary files
            if (!isPrimaryFile) {
                console.log(`   👁️ Intel detected in STANDBY file - monitoring silently`);
                continue;
            }
            
            // MULTI-LAYER DUPLICATE PREVENTION
            // 1. Content-based deduplication (ignores channel name to catch cross-source duplicates)
            const contentHash = `${parsed.timestamp.toISOString()}-${parsed.pilot}-${parsed.message}`;
            
            // 2. Channel-specific deduplication
            const intelId = `${channelName}-${contentHash}`;
            
            // 3. Check both content hash and intel ID for maximum protection
            if (this.submittedIntel.has(contentHash) || this.submittedIntel.has(intelId)) {
                console.log(`   🔄 Already processed (content: ${this.submittedIntel.has(contentHash)}, channel: ${this.submittedIntel.has(intelId)}) - skipping duplicate`);
                continue;
            }
            
            // 4. Mark BOTH identifiers as processing immediately to prevent race conditions
            this.submittedIntel.set(contentHash, 'PROCESSING');
            this.submittedIntel.set(intelId, 'PROCESSING');
            
            console.log(`⚡ INTEL DETECTED in ${channelName}: ${parsed.message} (${age}s old)`);
            console.log(`   🔍 Content Hash: ${contentHash}`);
            console.log(`   🔍 Intel ID: ${intelId}`);

            // Extract system names from the message
            const systemNames = this.extractSystemNames(parsed.message);
            const primarySystem = systemNames.length > 0 ? systemNames[0] : channelName;

            // Format intel data to match server expectations
            const intelData = {
                system: primarySystem, // Server expects 'system' field
                intel: parsed.message,
                pilot: parsed.pilot,
                timestamp: parsed.timestamp.toISOString(),
                channel: channelName, // Properly formatted channel name
                source: channelName, // Server checks 'source' field first for channel name
                systemMentions: systemNames, // Additional systems mentioned
                confidence: this.calculateIntelConfidence(parsed.message, systemNames.length > 0)
            };
            
            const success = await this.submitIntel(intelData);
            const timestamp = Date.now();
            if (success) {
                // Mark both identifiers as successfully submitted
                this.submittedIntel.set(contentHash, timestamp);
                this.submittedIntel.set(intelId, timestamp);
                console.log(`   ✅ Successfully submitted to ${channelName}`);
            } else {
                // Mark as failed but still prevent retries
                this.submittedIntel.set(contentHash, 'FAILED');
                this.submittedIntel.set(intelId, 'FAILED');
                console.log(`   ❌ Failed to submit intel from ${channelName}`);
            }
        }
        
        console.log(`✅ Processed ${processedCount} valid messages, found ${intelCount} intel messages in ${channelName}`);
    }

    /**
     * Calculates confidence score for intel messages
     * @param {string} message - The intel message
     * @param {boolean} hasSystemName - Whether message contains system names
     * @returns {number} Confidence score between 0 and 1
     */
    calculateIntelConfidence(message, hasSystemName) {
        let confidence = 0.5; // Base confidence
        const lowerMessage = message.toLowerCase();

        // Higher confidence for specific intel keywords
        if (lowerMessage.includes('red') || lowerMessage.includes('hostile')) confidence += 0.3;
        if (lowerMessage.includes('clear') || lowerMessage.includes('clr')) confidence += 0.2;
        if (lowerMessage.includes('cyno') || lowerMessage.includes('bridge')) confidence += 0.3;
        if (lowerMessage.includes('gate') || lowerMessage.includes('station')) confidence += 0.2;
        if (hasSystemName) confidence += 0.2;

        return Math.min(confidence, 1.0);
    }

    /**
     * Determines which file should be the primary active file and switches if needed
     * @param {Array} intelFiles - Array of intel file info objects
     * @returns {string|null} Path to the primary file or null if none suitable
     */
    selectPrimaryFile(intelFiles) {
        if (intelFiles.length === 0) return null;

        // Find the most recently modified file
        const mostRecent = intelFiles[0]; // Already sorted by lastModified
        const ageMinutes = (Date.now() - mostRecent.lastModified.getTime()) / (60 * 1000);

        // If current primary file is older than 2 minutes, switch to most recent
        if (!this.primaryFile || ageMinutes < 2) {
            if (this.primaryFile !== mostRecent.filePath) {
                if (this.primaryFile) {
                    console.log(`🔄 Switching from ${path.basename(this.primaryFile)} to ${mostRecent.filename}`);
                } else {
                    console.log(`🎯 Selected primary file: ${mostRecent.filename}`);
                }
                this.primaryFile = mostRecent.filePath;
            }
        }

        return this.primaryFile;
    }

    /**
     * Backup method to check primary file for changes (in case fs.watch misses events)
     */
    async checkPrimaryFileForChanges() {
        if (!this.primaryFile || !fs.existsSync(this.primaryFile)) return;

        try {
            const stats = fs.statSync(this.primaryFile);
            const fileState = this.fileStates.get(this.primaryFile);
            
            if (fileState && stats.size > fileState.lastSize) {
                console.log(`🔄 [BACKUP CHECK] File size increased: ${path.basename(this.primaryFile)} (${fileState.lastSize} → ${stats.size} bytes)`);
                const content = await this.readNewContent(this.primaryFile, fileState.lastSize);
                if (content) {
                    console.log(`📝 [BACKUP CHECK] New content found: ${content.length} chars`);
                    await this.processNewLines(this.primaryFile, content.split('\n'), false);
                }
                fileState.lastSize = stats.size;
            }
        } catch (err) {
            console.error(`❌ Error in backup file check: ${err.message}`);
        }
    }

    /**
     * Processes file change events (extracted from fs.watch callback)
     */
    async processFileChange(logsDirectory, filename) {
        const filePath = path.join(logsDirectory, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`❌ File doesn't exist: ${filePath}`);
            return;
        }

        // DEBOUNCE: Prevent processing the same file too rapidly
        const debounceKey = filePath;
        const now = Date.now();
        const lastProcessed = this.fileChangeDebounce.get(debounceKey) || 0;
        
        if (now - lastProcessed < 200) { // 200ms debounce
            console.log(`⏭️ Debouncing rapid file change: ${filename} (last processed ${now - lastProcessed}ms ago)`);
            return;
        }
        
        // OVERLAP PREVENTION: Don't process the same file if it's already being processed
        if (this.processingFiles.has(filePath)) {
            console.log(`⏭️ File already being processed: ${filename}`);
            return;
        }

        const changeId = `${filename}-${Date.now()}`;
        
        // Determine if this file is a primary file for its channel
        const channelName = this.extractChannelName(filename);
        const isPrimaryFile = this.primaryFilesByChannel.get(channelName)?.filePath === filePath;
        
        // Log processing status based on primary/standby
        if (isPrimaryFile) {
            console.log(`🔍 [${changeId}] Processing PRIMARY file change: ${filename}`);
        } else {
            // Standby files are monitored silently (only for failover detection)
            console.log(`👁️ [${changeId}] Monitoring standby file: ${filename} (silent)`);
        }
        
        // Mark as processing and update debounce timestamp
        this.processingFiles.add(filePath);
        this.fileChangeDebounce.set(debounceKey, now);
        
        try {
            const stats = fs.statSync(filePath);
            let fileState = this.fileStates.get(filePath);

            // If seeing the file for the first time
            if (!fileState) {
                console.log(`🎯 [${changeId}] Watching new INTEL channel: ${filename}`);
                fileState = { lastSize: stats.size }; // Start from CURRENT size, not 0
                this.fileStates.set(filePath, fileState);
                
                // For new files, do initial scan based on primary status
                this.readNewContent(filePath, 0).then(content => {
                    if (content) {
                        if (isPrimaryFile) {
                            console.log(`📋 [${changeId}] Initial scan of PRIMARY ${filename} for recent messages`);
                        } else {
                            console.log(`📋 [${changeId}] Initial scan of STANDBY ${filename} (silent monitoring)`);
                        }
                        this.processNewLines(filePath, content.split('\n'), true, isPrimaryFile);
                    }
                });
                return; // Don't process as a real-time update
            } 
            // If the file has grown
            else if (stats.size > fileState.lastSize) {
                if (isPrimaryFile) {
                    console.log(`📈 [${changeId}] File size increased: ${filename} (${fileState.lastSize} → ${stats.size} bytes)`);
                }
                this.readNewContent(filePath, fileState.lastSize).then(content => {
                    if (content) {
                        if (isPrimaryFile) {
                            console.log(`📝 [${changeId}] New content found: ${content.length} chars`);
                        }
                        this.processNewLines(filePath, content.split('\n'), false, isPrimaryFile);
                    }
                });
                fileState.lastSize = stats.size;
            } else {
                console.log(`⏭️ [${changeId}] No size change detected (${stats.size} bytes) - ignoring event`);
            }
        } catch (err) {
            // Ignore errors from files that might be deleted during the check
            console.error(`❌ [${changeId}] Error processing file change: ${err.message}`);
        } finally {
            // Always remove from processing set when done
            this.processingFiles.delete(filePath);
        }
    }

    /**
     * Updates the active status of files and manages the primary file selection
     * @param {string} logsDirectory - The EVE logs directory
     * @param {boolean} silent - If true, don't log the file discovery
     * @param {boolean} onlyNewFiles - If true, only look for files created after monitoring started
     */
    updateActiveFiles(logsDirectory, silent = false, onlyNewFiles = false) {
        const intelFiles = this.getIntelFiles(logsDirectory, silent, onlyNewFiles);
        this.selectPrimaryFile(intelFiles);

        // Update active file tracking
        for (const file of intelFiles) {
            this.activeFiles.set(file.filePath, {
                ...file,
                isActive: file.filePath === this.primaryFile
            });
        }
    }

    /**
     * Starts monitoring the log directory for changes.
     */
    async startMonitoring() {
        this.loadConfig();
        const logsDirectory = this.findEveLogsDirectory();
        this.running = true;
        this.monitoringStartTime = Date.now(); // Track when monitoring started

        console.log(`✓ Monitoring EVE chat logs in: ${logsDirectory}`);
        
        // Get initial Intel files and select primary (from last 6 hours, with full logging)
        this.updateActiveFiles(logsDirectory, false, false);
        
        console.log(`🎯 Primary file selected: ${this.primaryFile}`);
        console.log(`📂 Watching directory: ${logsDirectory}`);
        
        this.sendHeartbeat();
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.config.heartbeatInterval);

        // Check for NEW Intel files created after monitoring started (SILENTLY)
        this.fileCheckTimer = setInterval(() => {
            if (this.running) {
                this.updateActiveFiles(logsDirectory, true, true); // Silent updates, only new files
            }
        }, 500); // Every 500ms for ultra-fast file discovery

        // Add aggressive backup polling for primary file to catch missed events
        // TEMPORARILY DISABLED to prevent duplicates
        /*
        this.backupPollingTimer = setInterval(() => {
            if (this.running && this.primaryFile) {
                this.checkPrimaryFileForChanges();
            }
        }, 100); // Check every 100ms as backup for subsecond response
        */

        // Use fs.watch for native, efficient file system monitoring
        console.log(`🔧 Setting up file watcher for: ${logsDirectory}`);
        const watcher = fs.watch(logsDirectory, { persistent: true, recursive: false }, (eventType, filename) => {
            // Only log intel file events to reduce clutter
            if (!filename || !filename.endsWith('.txt')) {
                return;
            }
            if (!filename.toLowerCase().includes('intel')) {
                return;
            }

            console.log(`📁 Intel file event: ${eventType} on ${filename} at ${new Date().toISOString()}`);

            // Add a small delay to ensure file write is complete
            setTimeout(() => {
                this.processFileChange(logsDirectory, filename);
            }, 100);
        });

        watcher.on('error', (error) => {
            console.error(`❌ File watcher error: ${error.message}`);
        });

        console.log('👀 Ready for REAL-TIME intel monitoring...');
        if (this.primaryFile) {
            console.log(`🔥 Primary file: ${path.basename(this.primaryFile)}`);
        } else {
            console.log('⚠️ No active Intel files found. Waiting for EVE client activity...');
        }
    }
    
    /**
     * Tests the connection to the server's status endpoint.
     */
    async testConnection() {
        this.loadConfig();
        console.log(`🔧 Testing connection to server: ${this.config.serverUrl}`);
        try {
            // Assume a /api/status endpoint exists for health checks
            const statusUrl = new URL(this.config.serverUrl);
            statusUrl.pathname = '/api/status';
            
            const response = await fetch(statusUrl.href);
            if (response.ok) {
                console.log('✅ Connection successful!');
                return true;
            }
            console.error(`❌ Connection failed: ${response.status} ${response.statusText}`);
            return false;
        } catch (error) {
            console.error(`❌ Connection error: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Stops the monitor and cleans up resources.
     */
    stop() {
        if (!this.running) return;
        this.running = false;
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
        if (this.fileCheckTimer) clearInterval(this.fileCheckTimer);
        if (this.backupPollingTimer) clearInterval(this.backupPollingTimer);
        
        // Clear tracking maps
        this.processingFiles.clear();
        this.fileChangeDebounce.clear();
        
        console.log('🛑 Monitor stopped.');
    }
}

// --- Main Execution Logic ---
async function main() {
    const monitor = new SimpleIntelMonitor();
    const command = process.argv[2];

    const shutdown = () => {
        console.log('\n👋 Shutting down...');
        if (monitor.running) monitor.stop();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    switch (command) {
        case 'test':
            const connected = await monitor.testConnection();
            process.exit(connected ? 0 : 1);
            break;
        case 'start':
        case undefined:
            await monitor.startMonitoring();
            break;
        case 'help':
        default:
            console.log('Usage: node simple-intel-monitor.js [command]');
            console.log('  start    Start monitoring (default)');
            console.log('  test     Test the connection to the server');
            break;
    }
}

main().catch(err => {
    console.error("💥 A fatal error occurred:", err);
    process.exit(1);
});

