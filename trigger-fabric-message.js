/**
 * Manual trigger to test fabric order message sending
 */

const fetch = require('node-fetch');

async function triggerFabricOrderMessage() {
    console.log('🚀 Manually triggering fabric order message...');
    
    const testData = {
        sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
        sheetName: 'Fabric Orders',
        sheetType: 'fabric',
        rows: [{
            'Customer Name': 'SAURABH',
            'Contact Number': '7375938371',
            'Order ID': 'FRSS2109251245',
            'Purchase Date': new Date().toLocaleDateString(),
            'Purchase Notified': 'No',
            '_messageType': 'fabric_purchase',
            '_changeType': 'automation_trigger',
            '_automationRule': true
        }],
        timestamp: new Date().toISOString(),
        secret: '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
    };

    try {
        console.log('📤 Sending webhook request...');
        const response = await fetch('http://localhost:3001/webhook/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
            },
            body: JSON.stringify(testData)
        });

        const result = await response.text();
        console.log('📊 Response Status:', response.status);
        console.log('📊 Response:', result);

        if (response.ok) {
            console.log('✅ Manual trigger successful!');
            console.log('📱 Check WhatsApp for the fabric purchase message to 7375938371');
        } else {
            console.log('❌ Manual trigger failed');
        }

    } catch (error) {
        console.error('❌ Error triggering message:', error.message);
    }
}

triggerFabricOrderMessage();