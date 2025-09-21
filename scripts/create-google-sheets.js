#!/usr/bin/env node

/**
 * Google Sheets Creation Script
 * 
 * This script creates the necessary Google Sheets with proper structure
 * for the WhatsApp bot to function correctly
 */

const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');

class GoogleSheetsCreator {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.serviceAccountPath = path.join(__dirname, '../service-account.json');
    }

    async initialize() {
        try {
            console.log('🔑 Initializing Google Sheets API...');
            
            if (!require('fs').existsSync(this.serviceAccountPath)) {
                throw new Error('Service account file not found: service-account.json');
            }

            this.auth = new google.auth.GoogleAuth({
                keyFile: this.serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            console.log('✅ Google Sheets API initialized');
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error.message);
            throw error;
        }
    }

    async createSheet(title, sheetName = 'Sheet1') {
        try {
            console.log(`📊 Creating spreadsheet: ${title}...`);
            
            const request = {
                resource: {
                    properties: {
                        title: title
                    },
                    sheets: [{
                        properties: {
                            title: sheetName,
                            gridProperties: {
                                rowCount: 1000,
                                columnCount: 26
                            }
                        }
                    }]
                }
            };

            const response = await this.sheets.spreadsheets.create(request);
            const spreadsheetId = response.data.spreadsheetId;
            
            console.log(`✅ Created spreadsheet: ${title}`);
            console.log(`   ID: ${spreadsheetId}`);
            console.log(`   URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
            
            return spreadsheetId;
        } catch (error) {
            console.error(`❌ Failed to create spreadsheet ${title}:`, error.message);
            throw error;
        }
    }

    async setupMainOrdersSheet(spreadsheetId) {
        try {
            console.log('📋 Setting up Main Orders sheet structure...');
            
            // Headers for Main Orders
            const headers = [
                'Order ID', 'Customer Name', 'Phone Number', 'Garment Type', 
                'Total Amount', 'Advance', 'Remaining', 'Order Date', 
                'Ready Date', 'Delivery Status', 'Welcome Notified', 
                'Confirmation Sent', 'Ready Notification', 'Delivery Notification'
            ];

            // Set headers
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Sheet1!A1:N1',
                valueInputOption: 'RAW',
                resource: {
                    values: [headers]
                }
            });

            // Format headers (bold)
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: 0,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: headers.length
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true
                                    },
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9
                                    }
                                }
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)'
                        }
                    }]
                }
            });

            console.log('✅ Main Orders sheet structure created');
        } catch (error) {
            console.error('❌ Failed to setup Main Orders sheet:', error.message);
            throw error;
        }
    }

    async setupFabricOrdersSheet(spreadsheetId) {
        try {
            console.log('📋 Setting up Fabric Orders sheet structure...');
            
            // Headers for Fabric Orders
            const headers = [
                'Order ID', 'Customer Name', 'Phone Number', 'Fabric Type', 
                'Quantity', 'Total Amount', 'Advance', 'Remaining', 
                'Order Date', 'Ready Date', 'Delivery Status', 'Welcome Notified'
            ];

            // Set headers
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Sheet1!A1:L1',
                valueInputOption: 'RAW',
                resource: {
                    values: [headers]
                }
            });

            // Format headers
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: 0,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: headers.length
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true
                                    },
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9
                                    }
                                }
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)'
                        }
                    }]
                }
            });

            console.log('✅ Fabric Orders sheet structure created');
        } catch (error) {
            console.error('❌ Failed to setup Fabric Orders sheet:', error.message);
            throw error;
        }
    }

    async setupCombinedOrdersSheet(spreadsheetId) {
        try {
            console.log('📋 Setting up Combined Orders sheet structure...');
            
            // Headers for Combined Orders
            const headers = [
                'Order ID', 'Customer Name', 'Phone Number', 'Order Type', 
                'Item Description', 'Total Amount', 'Advance', 'Remaining', 
                'Order Date', 'Ready Date', 'Delivery Status', 'Welcome Notified'
            ];

            // Set headers
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: 'Sheet1!A1:L1',
                valueInputOption: 'RAW',
                resource: {
                    values: [headers]
                }
            });

            // Format headers
            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: {
                    requests: [{
                        repeatCell: {
                            range: {
                                sheetId: 0,
                                startRowIndex: 0,
                                endRowIndex: 1,
                                startColumnIndex: 0,
                                endColumnIndex: headers.length
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true
                                    },
                                    backgroundColor: {
                                        red: 0.9,
                                        green: 0.9,
                                        blue: 0.9
                                    }
                                }
                            },
                            fields: 'userEnteredFormat(textFormat,backgroundColor)'
                        }
                    }]
                }
            });

            console.log('✅ Combined Orders sheet structure created');
        } catch (error) {
            console.error('❌ Failed to setup Combined Orders sheet:', error.message);
            throw error;
        }
    }

    async run() {
        try {
            console.log('🚀 Google Sheets Creation Script');
            console.log('================================\n');

            await this.initialize();

            // Create Main Orders Sheet
            const mainOrdersId = await this.createSheet('Main Orders - WhatsApp Bot', 'Sheet1');
            await this.setupMainOrdersSheet(mainOrdersId);

            // Create Fabric Orders Sheet
            const fabricOrdersId = await this.createSheet('Fabric Orders - WhatsApp Bot', 'Sheet1');
            await this.setupFabricOrdersSheet(fabricOrdersId);

            // Create Combined Orders Sheet
            const combinedOrdersId = await this.createSheet('Combined Orders - WhatsApp Bot', 'Sheet1');
            await this.setupCombinedOrdersSheet(combinedOrdersId);

            console.log('\n🎉 All Google Sheets created successfully!');
            console.log('\n📋 Sheet IDs for your .env file:');
            console.log(`GOOGLE_SHEET_ID=${mainOrdersId}`);
            // FABRIC_SHEET_ID and COMBINED_SHEET_ID removed - using consolidated sheet

            // Update .env file
            await this.updateEnvFile(mainOrdersId, fabricOrdersId, combinedOrdersId);

        } catch (error) {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        }
    }

    async updateEnvFile(mainOrdersId, fabricOrdersId, combinedOrdersId) {
        try {
            const envPath = path.join(__dirname, '../.env');
            let envContent = '';

            // Read existing .env file if it exists
            try {
                envContent = await fs.readFile(envPath, 'utf8');
            } catch (error) {
                // File doesn't exist, start fresh
                envContent = '';
            }

            // Update or add Google Sheet IDs
            const lines = envContent.split('\n');
            const updatedLines = [];
            const sheetIds = {
                'GOOGLE_SHEET_ID': mainOrdersId,
                // FABRIC_SHEET_ID and COMBINED_SHEET_ID removed - using consolidated sheet
            };

            // Process existing lines
            for (const line of lines) {
                let updated = false;
                for (const [key, value] of Object.entries(sheetIds)) {
                    if (line.startsWith(`${key}=`)) {
                        updatedLines.push(`${key}=${value}`);
                        updated = true;
                        break;
                    }
                }
                if (!updated && line.trim()) {
                    updatedLines.push(line);
                }
            }

            // Add new sheet IDs if they weren't found
            for (const [key, value] of Object.entries(sheetIds)) {
                if (!updatedLines.some(line => line.startsWith(`${key}=`))) {
                    updatedLines.push(`${key}=${value}`);
                }
            }

            // Write updated .env file
            await fs.writeFile(envPath, updatedLines.join('\n'), 'utf8');
            console.log('✅ Updated .env file with new Google Sheet IDs');

        } catch (error) {
            console.error('⚠️ Failed to update .env file:', error.message);
            console.log('Please manually add the sheet IDs to your .env file');
        }
    }
}

// Run the script
if (require.main === module) {
    const creator = new GoogleSheetsCreator();
    creator.run();
}

module.exports = GoogleSheetsCreator;
