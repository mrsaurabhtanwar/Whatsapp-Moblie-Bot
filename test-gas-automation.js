/**
 * Test Google Apps Script automation by calling the deployed web app
 */

const fetch = require('node-fetch');

async function testGoogleAppsScriptAutomation() {
    console.log('🧪 Testing Google Apps Script automation...');
    
    // Test the fabric order that should trigger automation
    console.log('📊 Your fabric order details:');
    console.log('- Customer: SAURABH');
    console.log('- Phone: 7375938371');
    console.log('- Order ID: FRSS2109251245');
    console.log('- Purchase Notified: No (should trigger message)');
    
    console.log('\n🔍 Checking what should happen:');
    console.log('1. Google Apps Script should run every 30 minutes (new orders check)');
    console.log('2. It should find the fabric order with "Purchase Notified = No"');
    console.log('3. It should send a webhook to your bot');
    console.log('4. Your bot should send a fabric purchase message');
    console.log('5. Google Apps Script should update "Purchase Notified = Yes"');
    
    // Let's manually trigger the webhook that Google Apps Script should send
    console.log('\n🚀 Manually simulating what Google Apps Script should do...');
    
    const webhookData = {
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
        console.log('📤 Sending webhook to bot...');
        const response = await fetch('http://localhost:3001/webhook/google-sheets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Secret': '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
            },
            body: JSON.stringify(webhookData)
        });

        const result = await response.text();
        console.log('📊 Bot Response Status:', response.status);
        console.log('📊 Bot Response:', result);

        if (response.ok) {
            console.log('\n✅ Manual webhook test successful!');
            console.log('📱 Check WhatsApp number 7375938371 for fabric purchase message');
            console.log('💡 If you received the message, the bot works!');
            console.log('💡 If not, there might be an issue with WhatsApp connection');
        } else {
            console.log('\n❌ Manual webhook test failed');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    console.log('\n🔧 Next steps if automation isn\'t working:');
    console.log('1. Check Google Apps Script execution logs');
    console.log('2. Verify triggers are active');
    console.log('3. Check if business hours restriction applies');
    console.log('4. Ensure WhatsApp is connected');
}

testGoogleAppsScriptAutomation();