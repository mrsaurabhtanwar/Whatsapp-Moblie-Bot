require('dotenv').config();
const WhatsAppTailorBot = require('./main-bot');

async function testFabricOrders() {
    console.log('🧪 Testing Fabric Order Status Mapping...\n');
    
    try {
        // Create bot instance
        const bot = new WhatsAppTailorBot();
        
        // Initialize Google Sheets
        console.log('🔑 Initializing Google Sheets...');
        await bot.initializeGoogleSheets();
        console.log('✅ Google Sheets initialized\n');
        
        // Test fabric sheet processing
        console.log('� Testing fabric orders processing...');
        
        // Set up sheet configs for fabric orders
        bot.sheetConfigs = [
            {
                type: 'fabric',
                id: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
                name: 'Fabric Orders',
                range: 'A:Z'
            }
        ];
        
        // Process fabric orders
        const result = await bot.pollAllSheets();
        
        console.log('\n📋 Fabric Orders Processing Results:');
        console.log('='.repeat(50));
        
        if (result && result.length > 0) {
            console.log(`✅ Found ${result.length} orders to process`);
            result.forEach((order, index) => {
                console.log(`\n📦 Order ${index + 1}:`);
                console.log(`   Order ID: ${order.order_id || 'N/A'}`);
                console.log(`   Customer: ${order.customer_name || 'N/A'}`);
                console.log(`   Phone: ${order.phone || 'N/A'}`);
                console.log(`   Status: ${order.status || 'N/A'}`);
                console.log(`   Payment Status: ${order.status || 'N/A'} (should be from column 6)`);
            });
        } else {
            console.log('📝 No orders found or processed');
        }
        
        console.log('\n🔍 Testing specific fabric order data extraction...');
        
        // Read raw fabric sheet data to verify column mapping
        const response = await bot.sheets.spreadsheets.values.get({
            spreadsheetId: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
            range: 'A:Z'
        });
        
        const rows = response.data.values || [];
        if (rows.length > 1) {
            const headers = rows[0];
            const dataRows = rows.slice(1);
            
            console.log('\n📋 Raw Sheet Data Analysis:');
            console.log('Headers:', headers.map((h, i) => `${i}: ${h}`).join(' | '));
            
            dataRows.forEach((rowData, index) => {
                const rowIndex = index + 2; // +2 because we skip header and it's 1-indexed
                const orderId = rowData[0] || '';
                const customerName = rowData[1] || '';
                const phone = rowData[2] || '';
                const paymentStatus = rowData[6] || ''; // Payment Status column (index 6)
                const note = rowData[8] || ''; // Note column (index 8)
                
                console.log(`\n📋 Row ${rowIndex} (${orderId}):`);
                console.log(`   Customer: ${customerName}`);
                console.log(`   Phone: ${phone}`);
                console.log(`   Column 6 (Payment Status): "${paymentStatus}"`);
                console.log(`   Column 8 (Note): "${note}"`);
                console.log(`   ✅ Bot should use: "${paymentStatus}" (Payment Status)`);
                console.log(`   ❌ Bot should NOT use: "${note}" (Note)`);
            });
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
console.log('Starting Fabric Orders Test...\n');
testFabricOrders().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});