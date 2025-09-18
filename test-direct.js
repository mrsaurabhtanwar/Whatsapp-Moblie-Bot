require('dotenv').config();
const WhatsAppClient = require('./whatsapp-client');
const MessageTemplates = require('./message-templates');

async function testDirectMessage() {
    console.log('📱 Testing direct WhatsApp message...');
    
    try {
        // Initialize WhatsApp client
        const whatsappClient = new WhatsAppClient();
        await whatsappClient.initialize();
        
        console.log('⏳ Waiting for WhatsApp connection...');
        
        // Wait for connection
        let attempts = 0;
        while (attempts < 30) {
            const state = whatsappClient.getConnectionState();
            if (state.isConnected) {
                console.log('✅ WhatsApp connected!');
                break;
            }
            if (state.qrCode) {
                console.log('📱 QR Code available for scanning...');
            }
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;
        }
        
        if (!whatsappClient.getConnectionState().isConnected) {
            console.log('❌ WhatsApp connection failed. Please scan QR code and try manual test.');
            return;
        }
        
        // Test messages
        const messageTemplates = new MessageTemplates();
        
        // Get phone number from user input
        const phone = '7375938371'; // Your actual phone number
        
        console.log('🙏 Sending welcome message...');
        const welcomeMessage = messageTemplates.getWelcomeMessage({
            customer_name: 'Saurabh',
            phone: phone
        });
        
        const jid = phone.startsWith('91') ? phone + '@s.whatsapp.net' : '91' + phone + '@s.whatsapp.net';
        await whatsappClient.sendMessage(jid, welcomeMessage);
        console.log('✅ Welcome message sent!');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('📋 Sending order confirmation...');
        const confirmationMessage = messageTemplates.getOrderConfirmationMessage({
            customer_name: 'Saurabh',
            order_id: 'TVU17092514',
            garment_type: 'Test Order',
            delivery_date: 'Soon',
            total_amount: '1000',
            advance_amount: '500',
            remaining_amount: '500'
        });
        
        await whatsappClient.sendMessage(jid, confirmationMessage);
        console.log('✅ Order confirmation sent!');
        
        console.log('🎉 Test complete! Check your WhatsApp for messages.');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Only run if phone number is provided
const testPhone = process.argv[2];
if (testPhone) {
    console.log(`Testing with phone: ${testPhone}`);
    testDirectMessage();
} else {
    console.log('❌ Please provide phone number as argument:');
    console.log('Example: node test-direct.js 9123456789');
}