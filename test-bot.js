const WhatsAppClient = require('./whatsapp-client');

async function testBot() {
    console.log('🚀 Starting WhatsApp Bot Test...');
    
    try {
        const client = new WhatsAppClient();
        await client.initialize();
        
        console.log('✅ WhatsApp client initialized successfully!');
        console.log('📱 Please scan the QR code to connect...');
        
        // Wait for connection
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes
        
        while (attempts < maxAttempts) {
            const state = client.getConnectionState();
            
            if (state.isConnected) {
                console.log('🎉 WhatsApp connected successfully!');
                console.log('✅ Bot is ready to send messages');
                
                // Send a test message to yourself (optional)
                // const jid = 'YOUR_PHONE_NUMBER@s.whatsapp.net';
                // await client.sendMessage(jid, 'Hello! Bot is working! 🤖');
                
                break;
            }
            
            if (state.qrCode) {
                console.log('📱 QR Code ready for scanning...');
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }
        
        if (attempts >= maxAttempts) {
            console.log('⏰ Connection timeout. Please restart and try again.');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testBot();