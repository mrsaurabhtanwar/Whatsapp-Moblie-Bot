/**
 * Test fabric purchase message template specifically
 */

const fetch = require('node-fetch');

async function testFabricPurchaseMessage() {
    console.log('🧪 Testing fabric purchase message specifically...');
    
    try {
        // Test the exact fabric purchase message that should be sent
        console.log('📱 Testing direct fabric purchase message...');
        
        const testSendResponse = await fetch('http://localhost:3001/api/test-send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '7375938371',
                message: `🛍️ नमस्ते SAURABH जी,

RS Tailor & Fabric में आपका हार्दिक स्वागत है! 🙏

आपका फैब्रिक पर्चेज कन्फर्म हो गया है:

📋 ऑर्डर डिटेल्स:
• ऑर्डर नंबर: FRSS2109251245
• फैब्रिक: Chiffon (Pink)
• मात्रा: 2.3 meters
• कुल राशि: ₹1150

✨ हमारी विशेषताएं:
- 20+ साल का अनुभव
- बेहतरीन quality की गारंटी
- समय पर delivery

📍 RS Tailor & Fabric
Main Market, Kumher
⏰ 10 AM - 8 PM (सातों दिन)

धन्यवाद! 🙏`,
                messageType: 'fabric_purchase'
            })
        });
        
        const testResult = await testSendResponse.text();
        console.log('Direct Message Status:', testSendResponse.status);
        console.log('Direct Message Response:', testResult);
        
        if (testSendResponse.ok) {
            console.log('✅ Direct message test successful!');
            console.log('📱 Check WhatsApp 7375938371 for the fabric purchase message');
        } else {
            console.log('❌ Direct message test failed');
        }
        
    } catch (error) {
        console.error('❌ Error testing fabric purchase message:', error.message);
    }
}

testFabricPurchaseMessage();