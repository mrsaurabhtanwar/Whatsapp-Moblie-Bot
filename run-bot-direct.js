require('dotenv').config();
const WhatsAppTailorBot = require('./main-bot');

// Mock WhatsApp connection for testing
process.env.MOCK_WHATSAPP = 'true';

async function runBotDirectly() {
    console.log('🚀 Starting Bot Directly with Fabric Order Fix...\n');
    
    try {
        // Create bot instance
        const bot = new WhatsAppTailorBot();
        
        // Initialize
        console.log('🔑 Initializing bot...');
        await bot.initializeGoogleSheets();
        
        // Set up fabric sheet configuration
        bot.sheetConfigs = [
            {
                type: 'fabric',
                id: process.env.FABRIC_SHEET_ID || '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
                name: 'Fabric Orders',
                range: 'A:Z'
            }
        ];
        
        console.log('✅ Bot initialized\n');
        
        // Enable mock WhatsApp mode
        bot.mockMode = true;
        
        console.log('📊 Processing fabric orders with fixed column mapping...');
        
        // Run polling to process fabric orders
        await bot.pollAllSheets();
        
        console.log('\n✅ Fabric order processing completed!');
        console.log('\n📋 Check the logs above to verify:');
        console.log('- Status should show "Partial" (from column 6)');
        console.log('- Status should NOT show "NA" (from column 8)');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the bot
runBotDirectly().then(() => {
    console.log('\n🎉 Direct bot execution completed');
    process.exit(0);
}).catch(error => {
    console.error('\n❌ Failed to run bot:', error);
    process.exit(1);
});