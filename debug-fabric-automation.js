/**
 * Debug script to check what's happening with fabric order automation
 */

const { google } = require('googleapis');
const path = require('path');

async function debugFabricOrderAutomation() {
    console.log('🔍 Debugging Fabric Order Automation...');
    
    try {
        // Initialize Google Sheets API
        const serviceAccount = require('./service-account.json');
        const auth = new google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y';
        
        // Get fabric orders data
        console.log('📊 Fetching Fabric Orders data...');
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Fabric Orders!A:Z'
        });
        
        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('❌ No data found in Fabric Orders sheet');
            return;
        }
        
        const headers = rows[0];
        console.log('📋 Headers found:', headers);
        console.log('📊 Total rows:', rows.length - 1);
        
        // Check each fabric order
        for (let i = 1; i < rows.length; i++) {
            const rowData = rows[i];
            const order = {};
            
            // Convert row to object
            headers.forEach((header, index) => {
                if (header && rowData[index] !== undefined && rowData[index] !== '') {
                    order[header] = rowData[index];
                }
            });
            
            console.log(`\n--- Fabric Order ${i} ---`);
            console.log('Customer Name:', order['Customer Name']);
            console.log('Contact Number:', order['Contact Number']);
            console.log('Order ID:', order['Order ID']);
            console.log('Purchase Notified:', order['Purchase Notified']);
            
            // Check automation conditions
            const shouldSend = order['Order ID'] && 
                             order['Customer Name'] && 
                             (!order['Purchase Notified'] || order['Purchase Notified'].toLowerCase() !== 'yes');
            
            console.log('Should send fabric purchase message:', shouldSend);
            
            if (shouldSend) {
                console.log('✅ This order should trigger a fabric purchase message');
            } else {
                console.log('❌ This order will NOT trigger a message');
                if (!order['Order ID']) console.log('  - Missing Order ID');
                if (!order['Customer Name']) console.log('  - Missing Customer Name');
                if (order['Purchase Notified'] && order['Purchase Notified'].toLowerCase() === 'yes') {
                    console.log('  - Already notified (Purchase Notified = Yes)');
                }
            }
        }
        
        // Check business hours
        const currentHour = new Date().getHours();
        const withinBusinessHours = currentHour >= 9 && currentHour <= 21;
        console.log(`\n⏰ Current time: ${currentHour}:00`);
        console.log(`⏰ Within business hours (9 AM - 9 PM): ${withinBusinessHours}`);
        
    } catch (error) {
        console.error('❌ Error debugging automation:', error.message);
    }
}

debugFabricOrderAutomation();