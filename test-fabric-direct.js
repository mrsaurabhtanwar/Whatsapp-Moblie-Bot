require('dotenv').config();
const WhatsAppTailorBot = require('./main-bot');

async function testFabricOrderProcessing() {
    console.log('🧪 Testing Fabric Order Processing Logic (No WhatsApp)...\n');
    
    try {
        // Create bot instance
        const bot = new WhatsAppTailorBot();
        
        // Initialize Google Sheets
        console.log('🔑 Initializing Google Sheets...');
        await bot.initializeGoogleSheets();
        console.log('✅ Google Sheets initialized\n');
        
        // Mock the processOrderData method to test the column mapping
        console.log('📊 Testing fabric order status mapping directly...');
        
        // Read fabric sheet data
        const response = await bot.sheets.spreadsheets.values.get({
            spreadsheetId: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
            range: 'A:Z'
        });
        
        const rows = response.data.values || [];
        if (rows.length <= 1) {
            console.log('📝 No fabric order data found');
            return;
        }
        
        const headers = rows[0];
        const dataRows = rows.slice(1);
        
        console.log('📋 Headers:', headers.map((h, i) => `${i}: ${h}`).join(' | '));
        console.log('');
        
        // Process each row to test the status mapping
        for (let index = 0; index < dataRows.length; index++) {
            const rowData = dataRows[index];
            const rowIndex = index + 2; // +2 because we skip header and it's 1-indexed
            
            // Simulate the same logic as in main-bot.js for fabric orders
            const sheetType = 'fabric';
            const status = sheetType === 'fabric' ? (rowData[6] || '') : (rowData[8] || ''); // This is our fix
            const orderId = rowData[0] || '';
            const customerName = rowData[1] || '';
            const phone = rowData[2] || '';
            
            console.log(`📋 Processing Row ${rowIndex}:`);
            console.log(`   Order ID: ${orderId}`);
            console.log(`   Customer: ${customerName}`);
            console.log(`   Phone: ${phone}`);
            console.log(`   🔍 Column 6 (Payment Status): "${rowData[6] || ''}"`);
            console.log(`   🔍 Column 8 (Note): "${rowData[8] || ''}"`);
            console.log(`   ✅ Selected Status: "${status}" (from column ${sheetType === 'fabric' ? '6' : '8'})`);
            
            // Test if this status would trigger processing
            const triggerStatuses = [
                'ready', 'completed', 'delivered', 'pickup', 'confirmed',
                'new', 'pending', 'in process', 'purchased', 'partial'
            ];
            
            const cleanStatus = status.trim().toLowerCase();
            const shouldTrigger = triggerStatuses.includes(cleanStatus);
            
            console.log(`   📊 Status "${cleanStatus}" should trigger: ${shouldTrigger ? '✅ YES' : '❌ NO'}`);
            
            if (shouldTrigger) {
                console.log(`   🎯 This order WOULD be processed for messaging`);
            } else {
                console.log(`   ⏭️ This order would be SKIPPED`);
            }
            console.log('');
        }
        
        console.log('🔍 Summary:');
        console.log('- If bot shows Status="Partial" → ✅ Fix is working');
        console.log('- If bot shows Status="NA" → ❌ Fix not applied');
        console.log('- "Partial" status should trigger processing');
        console.log('- "NA" status should NOT trigger processing');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
console.log('Starting Direct Fabric Order Processing Test...\n');
testFabricOrderProcessing().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});