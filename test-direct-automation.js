/**
 * Direct test of automation message processing bypassing webhook
 */

const { handleAutomationMessage } = require('./src/core/bot');

async function testDirectAutomation() {
    console.log('🧪 Testing direct automation message processing...');
    
    try {
        // Test data that matches SAURABH's fabric order
        const testData = {
            'Customer Name': 'SAURABH',
            'Contact Number': '7375938371',
            'Order ID': 'FRSS2109251245',
            'Purchase Date': '21/09/2025',
            'Fabric Type': 'Cotton',
            'Quantity': '5 meters',
            'Rate per Meter': '₹150',
            'Total Amount': '₹750',
            'Advance Payment': '₹300',
            'Remaining Amount': '₹450',
            'Status': 'Confirmed',
            'Welcome Notified': '',
            'Purchase Notified': '',
            '_messageType': 'welcome',
            '_changeType': 'automation_trigger',
            '_automationRule': true
        };
        
        const messageConfig = {
            sheetType: 'fabric',
            sheetName: 'Fabric Orders',
            messageType: 'welcome'
        };
        
        console.log('📤 Sending test automation message...');
        console.log('Data:', JSON.stringify(testData, null, 2));
        
        const result = await handleAutomationMessage(testData, messageConfig);
        
        if (result) {
            console.log('✅ Automation message processed successfully!');
        } else {
            console.log('❌ Automation message processing failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testDirectAutomation();