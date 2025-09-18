require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function testSheetData() {
    try {
        console.log('🔍 Testing Google Sheets data...');
        
        // Initialize Google Sheets
        const serviceAccountPath = path.join(__dirname, 'service-account.json');
        if (!fs.existsSync(serviceAccountPath)) {
            console.log('❌ service-account.json not found');
            return;
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: serviceAccountPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // Configuration from .env
        const config = {
            mainSheetId: process.env.GOOGLE_SHEET_ID,
            fabricSheetId: process.env.FABRIC_SHEET_ID, 
            combinedSheetId: process.env.COMBINED_SHEET_ID,
            mainSheetName: process.env.GOOGLE_SHEET_NAME || 'Orders',
            fabricSheetName: process.env.FABRIC_SHEET_NAME || 'Fabric Orders',
            combinedSheetName: process.env.COMBINED_SHEET_NAME || 'Combine Orders',
            phoneColumn: 3,        // Column D
            statusColumn: 8,       // Column I
            customerNameColumn: 1, // Column B
            orderNumberColumn: 0,  // Column A
        };

        console.log('📊 Configuration:');
        console.log('Main Sheet ID:', config.mainSheetId);
        console.log('Fabric Sheet ID:', config.fabricSheetId);
        console.log('Combined Sheet ID:', config.combinedSheetId);
        console.log('');

        // Test each sheet
        const sheetsToTest = [
            { id: config.mainSheetId, name: config.mainSheetName, type: 'main' },
            { id: config.fabricSheetId, name: config.fabricSheetName, type: 'fabric' },
            { id: config.combinedSheetId, name: config.combinedSheetName, type: 'combined' }
        ].filter(sheet => sheet.id);

        for (const sheet of sheetsToTest) {
            console.log(`\n📋 Testing ${sheet.type} sheet (${sheet.id})`);
            
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: sheet.id,
                    range: `${sheet.name}!A:P`
                });

                const rows = response.data.values || [];
                console.log(`   Found ${rows.length} total rows (including header)`);
                
                if (rows.length <= 1) {
                    console.log('   ⚠️ No data rows found');
                    continue;
                }

                // Show header
                if (rows[0]) {
                    console.log(`   📝 Header: ${rows[0].slice(0, 10).join(' | ')}`);
                }

                // Check data rows
                const dataRows = rows.slice(1);
                console.log(`   📊 Data rows: ${dataRows.length}`);
                
                for (let i = 0; i < Math.min(dataRows.length, 5); i++) {
                    const row = dataRows[i];
                    const rowIndex = i + 2;
                    
                    const orderNumber = row[config.orderNumberColumn] || '';
                    const customerName = row[config.customerNameColumn] || '';
                    const phone = row[config.phoneColumn] || '';
                    const status = row[config.statusColumn] || '';
                    
                    console.log(`   Row ${rowIndex}: Order=${orderNumber}, Customer=${customerName}, Phone=${phone}, Status=${status}`);
                    
                    // Check if this should trigger a notification
                    const triggerStatuses = ['ready', 'completed', 'delivered', 'pickup', 'confirmed', 'new', 'processing', 'cutting', 'stitching', 'fitting', 'order_confirmed', 'welcome'];
                    const shouldTrigger = triggerStatuses.includes(status?.toLowerCase());
                    
                    if (phone && status) {
                        console.log(`        🎯 Would trigger notification: ${shouldTrigger ? 'YES' : 'NO'}`);
                        if (shouldTrigger) {
                            console.log(`        📱 Would send message to: ${phone}`);
                        }
                    }
                }
                
                if (dataRows.length > 5) {
                    console.log(`   ... and ${dataRows.length - 5} more rows`);
                }

            } catch (error) {
                console.log(`   ❌ Error reading sheet: ${error.message}`);
            }
        }
        
        console.log('\n✅ Sheet analysis complete!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSheetData();