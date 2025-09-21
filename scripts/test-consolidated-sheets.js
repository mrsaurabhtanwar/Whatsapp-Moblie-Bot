/**
 * Test Script for Consolidated Google Sheets Integration
 * 
 * This script tests the updated bot configuration to work with
 * a single spreadsheet containing multiple tabs (Tailor Orders, Fabric Orders, Combine Orders)
 */

const { google } = require('googleapis');
require('dotenv').config();

class ConsolidatedSheetsTester {
    constructor() {
        this.sheets = null;
        this.sheetConfigs = [
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Tailor Orders',
                type: 'tailor',
                description: 'Tailor Orders Tab',
                tabName: 'Tailor Orders'
            },
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Fabric Orders',
                type: 'fabric',
                description: 'Fabric Orders Tab',
                tabName: 'Fabric Orders'
            },
            {
                id: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
                name: 'Combine Orders',
                type: 'combine',
                description: 'Combine Orders Tab',
                tabName: 'Combine Orders'
            }
        ];
    }

    async initializeGoogleSheets() {
        try {
            console.log('🔑 Initializing Google Sheets API...');
            
            const auth = new google.auth.GoogleAuth({
                keyFile: 'service-account.json',
                scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
            });

            this.sheets = google.sheets({ version: 'v4', auth });
            console.log('✅ Google Sheets API initialized');
            
        } catch (error) {
            console.error('❌ Google Sheets initialization failed:', error.message);
            throw error;
        }
    }

    async testSheetAccess(config) {
        try {
            console.log(`\n🔍 Testing access to ${config.description}...`);
            
            // Try different range formats
            const ranges = [
                `${config.tabName}!A:Z`,
                `${config.name}!A:Z`,
                'Sheet1!A:Z',
                'Orders!A:Z'
            ];
            
            let successfulRange = null;
            let data = null;
            
            for (const range of ranges) {
                try {
                    console.log(`  📋 Trying range: ${range}`);
                    const response = await this.sheets.spreadsheets.values.get({
                        spreadsheetId: config.id,
                        range: range
                    });
                    
                    data = response.data.values || [];
                    if (data && data.length > 0) {
                        successfulRange = range;
                        console.log(`  ✅ Success! Retrieved ${data.length} rows using range: ${range}`);
                        break;
                    }
                } catch (rangeError) {
                    console.log(`  ❌ Range ${range} failed: ${rangeError.message}`);
                    continue;
                }
            }
            
            if (successfulRange && data) {
                console.log(`  📊 Data preview for ${config.description}:`);
                if (data.length > 0) {
                    console.log(`    Headers: ${data[0].slice(0, 5).join(' | ')}...`);
                    if (data.length > 1) {
                        console.log(`    Sample row: ${data[1].slice(0, 5).join(' | ')}...`);
                    }
                }
                return { success: true, range: successfulRange, rowCount: data.length };
            } else {
                console.log(`  ⚠️ No data found for ${config.description}`);
                return { success: false, error: 'No data found' };
            }
            
        } catch (error) {
            console.error(`  ❌ Error testing ${config.description}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async testAllSheets() {
        try {
            console.log('🚀 Testing Consolidated Google Sheets Integration');
            console.log('=' .repeat(60));
            
            await this.initializeGoogleSheets();
            
            const results = [];
            
            for (const config of this.sheetConfigs) {
                const result = await this.testSheetAccess(config);
                results.push({
                    config: config,
                    result: result
                });
            }
            
            console.log('\n📊 Test Results Summary:');
            console.log('=' .repeat(60));
            
            let successCount = 0;
            results.forEach(({ config, result }) => {
                const status = result.success ? '✅' : '❌';
                console.log(`${status} ${config.description}: ${result.success ? `${result.rowCount} rows` : result.error}`);
                if (result.success) successCount++;
            });
            
            console.log(`\n🎯 Overall Result: ${successCount}/${results.length} tabs accessible`);
            
            if (successCount === results.length) {
                console.log('🎉 All tabs are accessible! Your consolidated sheet structure is working correctly.');
            } else {
                console.log('⚠️ Some tabs are not accessible. Please check:');
                console.log('   1. Tab names match exactly (case-sensitive)');
                console.log('   2. Service account has access to the spreadsheet');
                console.log('   3. Tabs exist in the spreadsheet');
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }
}

// Run the test
async function runTest() {
    const tester = new ConsolidatedSheetsTester();
    await tester.testAllSheets();
}

// Check if running directly
if (require.main === module) {
    runTest().catch(console.error);
}

module.exports = ConsolidatedSheetsTester;
