/**
 * Test script to manually trigger webhook and check if automation is working
 */

const fetch = require('node-fetch');

async function testWebhookCall() {
    console.log('🧪 Testing webhook call...');
    
    const testData = {
        sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
        sheetName: 'Fabric Orders',
        sheetType: 'fabric',
        rows: [{
            'Customer Name': 'राज शर्मा',
            'Contact Number': '9876543210',
            'Order ID': 'FAB001',
            'Purchase Date': new Date().toLocaleDateString(),
            'Purchase Notified': '', // Empty to trigger automation
            '_messageType': 'fabric_purchase',
            '_changeType': 'automation_trigger',
            '_automationRule': true
        }],
        timestamp: new Date().toISOString(),
        secret: '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
    };

    try {
        const response = await fetch('http://localhost:3001/webhook/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
            },
            body: JSON.stringify(testData)
        });

        const result = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response:', result);

        if (response.ok) {
            console.log('✅ Webhook test successful!');
        } else {
            console.log('❌ Webhook test failed');
        }

    } catch (error) {
        console.error('❌ Error testing webhook:', error.message);
    }
}

testWebhookCall();