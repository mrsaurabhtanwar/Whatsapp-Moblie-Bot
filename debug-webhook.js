/**
 * Debug the webhook processing to see exactly what's happening
 */

const fetch = require('node-fetch');

async function debugWebhookProcessing() {
    console.log('🐛 Debugging webhook processing...');
    
    // Test with very explicit automation data
    const testData = {
        sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
        sheetName: 'Fabric Orders',
        sheetType: 'fabric',
        rows: [{
            'Customer Name': 'SAURABH',
            'Contact Number': '7375938371',
            'Order ID': 'FRSS2109251245',
            'Purchase Date': '9/21/2025',
            'Purchase Notified': 'No',
            '_messageType': 'fabric_purchase',
            '_changeType': 'automation_trigger',
            '_automationRule': true
        }],
        timestamp: new Date().toISOString(),
        secret: '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
    };

    console.log('📤 Sending debug webhook with data:');
    console.log(JSON.stringify(testData, null, 2));

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
        console.log('\n📊 Response Status:', response.status);
        console.log('📊 Response Body:', result);

        // Also test the health endpoint to make sure bot is responding
        console.log('\n🏥 Testing bot health...');
        const healthResponse = await fetch('http://localhost:3001/api/health');
        const healthResult = await healthResponse.text();
        console.log('Health Status:', healthResponse.status);
        console.log('Health Response:', healthResult);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugWebhookProcessing();