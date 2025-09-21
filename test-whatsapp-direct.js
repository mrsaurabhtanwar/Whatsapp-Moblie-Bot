/**
 * Test WhatsApp message sending directly
 */

const fetch = require('node-fetch');

async function testDirectWhatsAppMessage() {
    console.log('📱 Testing direct WhatsApp message sending...');
    
    try {
        // Test the preview endpoint first
        console.log('1. Testing preview endpoint...');
        const previewResponse = await fetch('http://localhost:3001/api/preview-pending-sends', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const previewResult = await previewResponse.text();
        console.log('Preview Status:', previewResponse.status);
        console.log('Preview Response:', previewResult);
        
        // Test the test-send endpoint
        console.log('\n2. Testing test-send endpoint...');
        const testSendResponse = await fetch('http://localhost:3001/api/test-send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: '7375938371',
                message: 'Test message from automation system',
                messageType: 'test'
            })
        });
        
        const testSendResult = await testSendResponse.text();
        console.log('Test Send Status:', testSendResponse.status);
        console.log('Test Send Response:', testSendResult);
        
    } catch (error) {
        console.error('❌ Error testing direct WhatsApp:', error.message);
    }
}

testDirectWhatsAppMessage();