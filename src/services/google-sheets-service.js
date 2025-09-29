/**
 * Google Sheets Service
 * Handles reading and writing data to Google Sheets
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class GoogleSheetsService {
    constructor() {
        this.sheets = null;
        this.spreadsheetId = process.env.GOOGLE_SHEET_ID;
        this.serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './service-account.json';
        this.isInitialized = false;
    }

    /**
     * Initialize Google Sheets API
     */
    async initialize() {
        try {
            logger.info('🔄 Initializing Google Sheets service...');

            if (!this.spreadsheetId) {
                throw new Error('GOOGLE_SHEET_ID environment variable is required');
            }

            // Load service account credentials
            const credentials = JSON.parse(fs.readFileSync(this.serviceAccountPath, 'utf8'));
            
            // Create JWT client
            const auth = new google.auth.JWT(
                credentials.client_email,
                null,
                credentials.private_key,
                ['https://www.googleapis.com/auth/spreadsheets']
            );

            // Initialize sheets API
            this.sheets = google.sheets({ version: 'v4', auth });
            
            // Test connection
            await this.testConnection();
            
            this.isInitialized = true;
            logger.info('✅ Google Sheets service initialized successfully');
            
        } catch (error) {
            logger.error('❌ Failed to initialize Google Sheets service:', error);
            throw error;
        }
    }

    /**
     * Test connection to Google Sheets
     */
    async testConnection() {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId,
                fields: 'properties.title'
            });
            
            logger.info(`📊 Connected to spreadsheet: ${response.data.properties.title}`);
            return true;
            
        } catch (error) {
            logger.error('❌ Google Sheets connection test failed:', error);
            throw error;
        }
    }

    /**
     * Read data from a specific sheet
     */
    async readSheet(sheetName, range = null) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets service not initialized');
        }

        try {
            const fullRange = range ? `${sheetName}!${range}` : sheetName;
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: fullRange
            });

            return response.data.values || [];
            
        } catch (error) {
            logger.error(`❌ Failed to read sheet ${sheetName}:`, error);
            throw error;
        }
    }

    /**
     * Write data to a specific sheet
     */
    async writeSheet(sheetName, range, values) {
        if (!this.isInitialized) {
            throw new Error('Google Sheets service not initialized');
        }

        try {
            const fullRange = `${sheetName}!${range}`;
            
            const response = await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: fullRange,
                valueInputOption: 'RAW',
                resource: {
                    values: values
                }
            });

            logger.info(`✅ Updated sheet ${sheetName} at range ${range}`);
            return response.data;
            
        } catch (error) {
            logger.error(`❌ Failed to write to sheet ${sheetName}:`, error);
            throw error;
        }
    }

    /**
     * Update a single cell
     */
    async updateCell(sheetName, row, column, value) {
        const range = `${sheetName}!${column}${row}`;
        return await this.writeSheet(sheetName, range, [[value]]);
    }

    /**
     * Mark notification as sent in the sheet
     */
    async markNotificationSent(sheetName, row, notificationType) {
        try {
            // Map notification types to column letters
            const columnMap = {
                'welcome': 'R',
                'order_confirmation': 'S', 
                'order_ready': 'T',
                'delivery_notification': 'U',
                'pickup_notified': 'V',
                'payment_notified': 'W'
            };

            const column = columnMap[notificationType];
            if (!column) {
                logger.warn(`⚠️ Unknown notification type: ${notificationType}`);
                return;
            }

            await this.updateCell(sheetName, row, column, 'Yes');
            logger.info(`✅ Marked ${notificationType} as sent for row ${row} in ${sheetName}`);
            
        } catch (error) {
            logger.error(`❌ Failed to mark notification sent:`, error);
            throw error;
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            spreadsheetId: this.spreadsheetId,
            serviceAccountPath: this.serviceAccountPath
        };
    }
}

module.exports = GoogleSheetsService;
