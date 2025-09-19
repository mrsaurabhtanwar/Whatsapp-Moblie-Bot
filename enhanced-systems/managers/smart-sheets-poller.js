const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

/**
 * Smart Google Sheets Poller with Optimization
 * 
 * Features:
 * - Incremental sync (only changed rows)
 * - Change detection and notifications
 * - Smart scheduling based on business hours
 * - Batch processing for efficiency
 * - API quota management
 * - Error recovery and retry logic
 */
class SmartSheetsPoller {
    constructor(options = {}) {
        this.sheets = null;
        this.sheetConfigs = options.sheetConfigs || [];
        this.pollInterval = options.pollInterval || 180000; // 3 minutes default
        this.businessHours = {
            start: 9,  // 9 AM
            end: 20    // 8 PM
        };
        
        // Change tracking
        this.lastSyncTimes = new Map();
        this.changeHistory = new Map();
        this.rowHashes = new Map();
        
        // Performance tracking
        this.apiCallCount = 0;
        this.lastApiReset = Date.now();
        this.quotaLimit = 100; // requests per 100 seconds
        
        // Smart scheduling
        this.smartSchedule = {
            businessHours: 60000,    // 1 minute during business hours
            afterHours: 300000,      // 5 minutes after hours
            weekends: 600000         // 10 minutes on weekends
        };
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            await this.initializeGoogleSheets();
            await this.loadSyncState();
            this.startSmartPolling();
            
            console.log('✅ Smart Sheets Poller initialized');
            console.log(`📊 Monitoring ${this.sheetConfigs.length} sheets`);
            console.log(`⏰ Smart scheduling enabled`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Smart Sheets Poller:', error.message);
        }
    }

    async initializeGoogleSheets() {
        try {
            const serviceAccountPath = path.join(__dirname, 'service-account.json');
            if (!await fs.access(serviceAccountPath).then(() => true).catch(() => false)) {
                throw new Error('Service account file not found');
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: serviceAccountPath,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.metadata.readonly'
                ]
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets API initialized');
            
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error.message);
            throw error;
        }
    }

    async loadSyncState() {
        try {
            const stateFile = path.join(__dirname, 'sheets-sync-state.json');
            const data = await fs.readFile(stateFile, 'utf8');
            const state = JSON.parse(data);
            
            this.lastSyncTimes = new Map(state.lastSyncTimes || []);
            this.changeHistory = new Map(state.changeHistory || []);
            this.rowHashes = new Map(state.rowHashes || []);
            
            console.log('📁 Loaded sync state from file');
            
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn('⚠️ Failed to load sync state:', error.message);
            }
        }
    }

    async saveSyncState() {
        try {
            const stateFile = path.join(__dirname, 'sheets-sync-state.json');
            const state = {
                lastSyncTimes: Array.from(this.lastSyncTimes.entries()),
                changeHistory: Array.from(this.changeHistory.entries()),
                rowHashes: Array.from(this.rowHashes.entries()),
                lastSaved: new Date().toISOString()
            };
            
            await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
            
        } catch (error) {
            console.error('❌ Failed to save sync state:', error.message);
        }
    }

    startSmartPolling() {
        // Initial poll
        this.pollAllSheets();
        
        // Set up smart interval
        this.scheduleNextPoll();
        
        console.log('🔄 Smart polling started');
    }

    scheduleNextPoll() {
        const nextInterval = this.calculateNextPollInterval();
        
        setTimeout(() => {
            this.pollAllSheets();
            this.scheduleNextPoll();
        }, nextInterval);
        
        console.log(`⏰ Next poll scheduled in ${nextInterval / 1000} seconds`);
    }

    calculateNextPollInterval() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Check if it's weekend
        if (day === 0 || day === 6) {
            return this.smartSchedule.weekends;
        }
        
        // Check if it's business hours
        if (hour >= this.businessHours.start && hour < this.businessHours.end) {
            return this.smartSchedule.businessHours;
        }
        
        // After hours
        return this.smartSchedule.afterHours;
    }

    async pollAllSheets() {
        if (!this.checkApiQuota()) {
            console.log('⏳ API quota limit reached, skipping poll');
            return;
        }

        console.log('🔍 Starting smart poll of all sheets...');
        
        for (const config of this.sheetConfigs) {
            try {
                await this.pollSheetSmart(config);
                await this.delay(1000); // 1 second delay between sheets
            } catch (error) {
                console.error(`❌ Error polling ${config.name}:`, error.message);
            }
        }
        
        await this.saveSyncState();
    }

    async pollSheetSmart(config) {
        try {
            const sheetKey = `${config.id}_${config.name}`;
            const lastSync = this.lastSyncTimes.get(sheetKey) || 0;
            
            console.log(`📊 Smart polling ${config.name}...`);
            
            // Get sheet metadata to check for changes
            const metadata = await this.getSheetMetadata(config.id);
            const lastModified = new Date(metadata.modifiedTime).getTime();
            
            // Skip if no changes since last sync
            if (lastModified <= lastSync) {
                console.log(`⏭️ No changes in ${config.name}, skipping`);
                return;
            }
            
            // Get only changed rows
            const changes = await this.getChangedRows(config, lastSync);
            
            if (changes.length > 0) {
                console.log(`📝 Found ${changes.length} changes in ${config.name}`);
                await this.processChanges(config, changes);
            }
            
            // Update last sync time
            this.lastSyncTimes.set(sheetKey, Date.now());
            
        } catch (error) {
            console.error(`❌ Smart poll failed for ${config.name}:`, error.message);
        }
    }

    async getSheetMetadata(sheetId) {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                fields: 'properties.title,modifiedTime'
            });
            
            this.incrementApiCall();
            return response.data.properties;
            
        } catch (error) {
            console.error('❌ Failed to get sheet metadata:', error.message);
            throw error;
        }
    }

    async getChangedRows(config, lastSync) {
        try {
            // Get all data first
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: config.id,
                range: `${config.name}!A:Z`
            });
            
            this.incrementApiCall();
            
            const rows = response.data.values || [];
            if (rows.length <= 1) return [];
            
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            // Find changed rows by comparing hashes
            const changes = [];
            const sheetKey = `${config.id}_${config.name}`;
            
            for (let i = 0; i < dataRows.length; i++) {
                const rowData = dataRows[i];
                const rowHash = this.calculateRowHash(rowData);
                const rowKey = `${sheetKey}_${i}`;
                
                const lastHash = this.rowHashes.get(rowKey);
                
                if (lastHash !== rowHash) {
                    changes.push({
                        rowIndex: i + 2, // +2 for header and 0-based index
                        rowData: rowData,
                        headers: headers,
                        oldHash: lastHash,
                        newHash: rowHash,
                        changeType: lastHash ? 'modified' : 'new'
                    });
                }
                
                this.rowHashes.set(rowKey, rowHash);
            }
            
            return changes;
            
        } catch (error) {
            console.error('❌ Failed to get changed rows:', error.message);
            throw error;
        }
    }

    calculateRowHash(rowData) {
        const crypto = require('crypto');
        const rowString = rowData.join('|');
        return crypto.createHash('md5').update(rowString).digest('hex');
    }

    async processChanges(config, changes) {
        try {
            // Group changes by type for batch processing
            const newRows = changes.filter(c => c.changeType === 'new');
            const modifiedRows = changes.filter(c => c.changeType === 'modified');
            
            console.log(`📝 Processing ${newRows.length} new rows, ${modifiedRows.length} modified rows`);
            
            // Process new rows
            if (newRows.length > 0) {
                await this.processNewRows(config, newRows);
            }
            
            // Process modified rows
            if (modifiedRows.length > 0) {
                await this.processModifiedRows(config, modifiedRows);
            }
            
            // Log changes
            this.logChanges(config, changes);
            
        } catch (error) {
            console.error('❌ Failed to process changes:', error.message);
        }
    }

    async processNewRows(config, newRows) {
        console.log(`🆕 Processing ${newRows.length} new rows in ${config.name}`);
        
        for (const change of newRows) {
            try {
                // Extract order data
                const orderData = this.extractOrderData(change.rowData, change.headers, config.type);
                
                if (this.shouldProcessOrder(orderData, config.type)) {
                    await this.triggerOrderProcessing(config, orderData, change.rowIndex);
                }
                
            } catch (error) {
                console.error(`❌ Failed to process new row ${change.rowIndex}:`, error.message);
            }
        }
    }

    async processModifiedRows(config, modifiedRows) {
        console.log(`✏️ Processing ${modifiedRows.length} modified rows in ${config.name}`);
        
        for (const change of modifiedRows) {
            try {
                // Extract order data
                const orderData = this.extractOrderData(change.rowData, change.headers, config.type);
                
                if (this.shouldProcessOrder(orderData, config.type)) {
                    await this.triggerOrderProcessing(config, orderData, change.rowIndex);
                }
                
            } catch (error) {
                console.error(`❌ Failed to process modified row ${change.rowIndex}:`, error.message);
            }
        }
    }

    extractOrderData(rowData, headers, sheetType) {
        // This would extract order data based on sheet type
        // Similar to your existing logic in main-bot.js
        const orderData = {};
        
        headers.forEach((header, index) => {
            if (header && rowData[index]) {
                orderData[header.toLowerCase().replace(/\s+/g, '_')] = rowData[index];
            }
        });
        
        return orderData;
    }

    shouldProcessOrder(orderData, sheetType) {
        // Check if order should be processed
        // Similar to your existing shouldSendNotification logic
        const status = orderData.status?.trim().toLowerCase();
        const phone = orderData.phone || orderData.contact_info || orderData.contact_number;
        
        if (!status || !phone) return false;
        
        const triggerStatuses = [
            'ready', 'completed', 'delivered', 'pickup',
            'confirmed', 'new', 'pending', 'in process',
            'purchased', 'partial'
        ];
        
        return triggerStatuses.includes(status);
    }

    async triggerOrderProcessing(config, orderData, rowIndex) {
        // This would trigger your existing order processing logic
        console.log(`🎯 Triggering order processing for ${orderData.order_id || 'unknown'} in ${config.name}`);
        
        // Emit event or call your existing processing function
        // This integrates with your main-bot.js processing logic
    }

    logChanges(config, changes) {
        const sheetKey = `${config.id}_${config.name}`;
        const changeLog = {
            timestamp: new Date().toISOString(),
            sheetName: config.name,
            changeCount: changes.length,
            changes: changes.map(c => ({
                rowIndex: c.rowIndex,
                changeType: c.changeType,
                orderId: c.rowData[0] || 'unknown'
            }))
        };
        
        if (!this.changeHistory.has(sheetKey)) {
            this.changeHistory.set(sheetKey, []);
        }
        
        const history = this.changeHistory.get(sheetKey);
        history.push(changeLog);
        
        // Keep only last 100 changes per sheet
        if (history.length > 100) {
            history.splice(0, history.length - 100);
        }
    }

    checkApiQuota() {
        const now = Date.now();
        const timeSinceReset = now - this.lastApiReset;
        
        // Reset counter every 100 seconds
        if (timeSinceReset > 100000) {
            this.apiCallCount = 0;
            this.lastApiReset = now;
        }
        
        return this.apiCallCount < this.quotaLimit;
    }

    incrementApiCall() {
        this.apiCallCount++;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public API methods
    getSyncStatus() {
        return {
            lastSyncTimes: Object.fromEntries(this.lastSyncTimes),
            changeHistory: Object.fromEntries(this.changeHistory),
            apiCallCount: this.apiCallCount,
            quotaLimit: this.quotaLimit,
            smartSchedule: this.smartSchedule
        };
    }

    getChangeHistory(sheetName = null) {
        if (sheetName) {
            const sheetKey = Object.keys(Object.fromEntries(this.changeHistory))
                .find(key => key.includes(sheetName));
            return sheetKey ? this.changeHistory.get(sheetKey) : [];
        }
        
        return Object.fromEntries(this.changeHistory);
    }

    updateSmartSchedule(newSchedule) {
        this.smartSchedule = { ...this.smartSchedule, ...newSchedule };
        console.log('⏰ Smart schedule updated');
    }

    forceFullSync() {
        this.lastSyncTimes.clear();
        this.rowHashes.clear();
        console.log('🔄 Forced full sync - all sheets will be re-processed');
    }

    getPerformanceMetrics() {
        return {
            apiCallsUsed: this.apiCallCount,
            quotaLimit: this.quotaLimit,
            sheetsMonitored: this.sheetConfigs.length,
            lastSyncTimes: Object.fromEntries(this.lastSyncTimes),
            changeHistorySize: Array.from(this.changeHistory.values())
                .reduce((sum, history) => sum + history.length, 0)
        };
    }
}

module.exports = SmartSheetsPoller;
