require('dotenv').config();
const WhatsAppTailorBot = require('./main-bot');

async function testFabricOrderDirectProcessing() {
    console.log('🧪 Testing Fabric Order Processing (Direct pollSheet Call)...\n');
    
    try {
        // Create bot instance
        const bot = new WhatsAppTailorBot();
        
        // Initialize Google Sheets
        console.log('🔑 Initializing Google Sheets...');
        await bot.initializeGoogleSheets();
        console.log('✅ Google Sheets initialized\n');
        
        // Set up the bot for fabric processing
        bot.sheetConfigs = [
            {
                type: 'fabric',
                id: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
                name: 'Fabric Orders',
                range: 'A:Z'
            }
        ];
        
        // Mock WhatsApp connection and client
        bot.whatsappClient = {
            getConnectionState: () => ({ isConnected: true }),
            sendMessage: async (phone, message) => {
                console.log(`📱 MOCK MESSAGE to ${phone}:`);
                console.log(`   ${message.substring(0, 150)}...`);
                console.log('   ✅ Message would be sent\n');
                return { success: true };
            }
        };
        
        console.log('🔄 Testing fabric order processing with fixed column mapping...\n');
        
        // Call the bot's pollSheet method directly for fabric orders
        try {
            await bot.pollSheet(
                process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
                'Fabric Orders',
                'fabric'
            );
            console.log('✅ Fabric order processing completed successfully');
        } catch (error) {
            console.error('❌ Fabric order processing failed:', error.message);
            console.error('Stack:', error.stack);
        }
        
        console.log('\n📋 Expected Results:');
        console.log('- Status should show "Partial" (from Payment Status column 6)');
        console.log('- Status should NOT show "NA" (from Note column 8)');
        console.log('- Order with "Partial" status should trigger message sending');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
console.log('Starting Fabric Order Processing Test...\n');
testFabricOrderDirectProcessing().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
});