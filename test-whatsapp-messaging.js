/**
 * WhatsApp Message Test Script
 * Tests message sending functionality with the connected WhatsApp client
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3001';

async function testWhatsAppMessaging() {
    console.log('🧪 Testing WhatsApp Message Sending...');
    console.log('');

    try {
        // Test 1: Check server health
        console.log('1️⃣ Checking server health...');
        const healthResponse = await axios.get(`${SERVER_URL}/api/health`);
        console.log('✅ Server is healthy:', healthResponse.data.status);
        console.log('📱 Shop:', healthResponse.data.shop);
        console.log('⏱️ Uptime:', Math.round(healthResponse.data.uptime), 'seconds');
        console.log('');

        // Test 2: Send test message to admin number
        console.log('2️⃣ Sending test message to admin number...');
        
        const testMessage = {
            phone: '7375938371', // Admin phone from config
            message: `🤖 Test message from WhatsApp Tailor Bot!\n\n` +
                    `✅ Bot Status: Connected\n` +
                    `📅 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
                    `🏪 Shop: RS Tailor & Fabric\n` +
                    `🔗 Webhook: Active\n\n` +
                    `This is a test message to confirm your WhatsApp bot is working perfectly! 🎉`
        };

        const response = await axios.post(`${SERVER_URL}/api/test-send`, testMessage, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.data.success) {
            console.log('🎉 SUCCESS! Test message sent successfully!');
            console.log('📞 Sent to:', response.data.phone);
            console.log('⏰ Timestamp:', response.data.timestamp);
            console.log('');
            console.log('📱 Check your WhatsApp to see the test message!');
        } else {
            console.log('❌ Failed to send message:', response.data);
        }

    } catch (error) {
        console.log('❌ Test failed with error:');
        
        if (error.response) {
            console.log('📄 Status:', error.response.status);
            console.log('📄 Response:', error.response.data);
            
            if (error.response.status === 503) {
                console.log('');
                console.log('💡 WhatsApp might not be connected yet. Please check:');
                console.log('   1. Is the bot server running?');
                console.log('   2. Did you scan the QR code?');
                console.log('   3. Check server logs for connection status');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.log('🔌 Cannot connect to server - is the bot running?');
            console.log('💡 Run: npm start');
        } else {
            console.log('🔍 Error details:', error.message);
        }
    }

    console.log('');
    console.log('🏁 WhatsApp messaging test complete!');
}

// Additional test functions
async function testWebhookFlow() {
    console.log('🌐 Testing webhook flow...');
    
    try {
        const webhookPayload = {
            event: 'order_added',
            message_type: 'welcome',
            order_data: {
                phone: '7375938371',
                order_id: 'TEST-WEBHOOK-001',
                customer_name: 'Test Customer',
                measurements: 'Test webhook message flow'
            },
            sheet_name: 'Main Orders',
            sheet_row: 2
        };

        const response = await axios.post(`${SERVER_URL}/api/webhook/google-sheets`, webhookPayload, {
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': process.env.WEBHOOK_SECRET || 'c33d03f872fa4ebfca65787161644abf77c8672126c06c1a152940dea869ccea'
            }
        });

        console.log('✅ Webhook test successful:', response.data);
    } catch (error) {
        console.log('❌ Webhook test failed:', error.response?.data || error.message);
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting WhatsApp Bot Tests...');
    console.log('═'.repeat(50));
    console.log('');
    
    await testWhatsAppMessaging();
    
    console.log('');
    console.log('═'.repeat(50));
    
    // Uncomment to test webhook flow
    // await testWebhookFlow();
}

if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testWhatsAppMessaging, testWebhookFlow };