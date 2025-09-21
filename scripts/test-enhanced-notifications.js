/**
 * Test Enhanced Notification System
 * 
 * This script tests the improved webhook processing and notification logic
 * to ensure all notification types work correctly with the enhanced change detection.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Test data simulation
const testWebhookData = {
    newOrderTests: [
        {
            sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
            sheetName: 'Tailor Orders',
            sheetType: 'tailor',
            rows: [
                {
                    'Order ID': 'TEST001',
                    'Customer Name': 'Test Customer 1',
                    'Contact Number': '9123456789',
                    'Garment Types': 'Shirt',
                    'Total Amount': '1000',
                    'Advance/Partial Payment': '500',
                    'Remaining Amount': '500',
                    'Delivery Status': 'pending',
                    '_changeType': 'new_order',
                    '_isNewPhone': true
                }
            ]
        }
    ],
    statusChangeTests: [
        {
            sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
            sheetName: 'Tailor Orders',
            sheetType: 'tailor',
            rows: [
                {
                    'Order ID': 'TEST002',
                    'Customer Name': 'Test Customer 2',
                    'Contact Number': '9123456790',
                    'Garment Types': 'Pant',
                    'Total Amount': '800',
                    'Advance/Partial Payment': '400',
                    'Remaining Amount': '400',
                    'Delivery Status': 'ready',
                    '_changeType': 'status_change',
                    '_statusChangeType': 'ready',
                    '_changedColumns': [{
                        column: 'Delivery Status',
                        oldValue: 'pending',
                        newValue: 'ready'
                    }]
                }
            ]
        },
        {
            sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
            sheetName: 'Tailor Orders', 
            sheetType: 'tailor',
            rows: [
                {
                    'Order ID': 'TEST003',
                    'Customer Name': 'Test Customer 3',
                    'Contact Number': '9123456791',
                    'Garment Types': 'Kurta',
                    'Total Amount': '1200',
                    'Advance/Partial Payment': '600',
                    'Remaining Amount': '600',
                    'Delivery Status': 'delivered',
                    '_changeType': 'status_change',
                    '_statusChangeType': 'delivered',
                    '_changedColumns': [{
                        column: 'Delivery Status',
                        oldValue: 'ready',
                        newValue: 'delivered'
                    }]
                }
            ]
        }
    ],
    fabricOrderTests: [
        {
            sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
            sheetName: 'Fabric Orders',
            sheetType: 'fabric',
            rows: [
                {
                    'Fabric Order ID': 'FAB001',
                    'Customer Name': 'Fabric Customer 1',
                    'Contact Number': '9123456792',
                    'Fabric Type': 'Cotton',
                    'Brand Name': 'Premium Cotton',
                    'Quantity (meters)': '3',
                    'Price per Meter': '200',
                    'Fabric Total': '600',
                    'Payment Status': 'Pending',
                    '_changeType': 'new_order',
                    '_isNewPhone': false
                }
            ]
        }
    ]
};

async function testEnhancedNotifications() {
    console.log('🧪 Testing Enhanced Notification System...\n');
    
    try {
        // Initialize bot in test mode
        process.env.MOCK_WHATSAPP = 'true';
        process.env.DISABLE_POLLING = 'true';
        
        const EnhancedWhatsAppBot = require('../src/core/bot');
        const bot = new EnhancedWhatsAppBot({
            testMode: true,
            skipConnection: true
        });
        
        // Test 1: New Order with New Customer (should send welcome + confirmation)
        console.log('📋 Test 1: New Order with New Customer');
        console.log('Expected: Welcome message + Confirmation message');
        const result1 = await bot.processWebhookData(testWebhookData.newOrderTests[0]);
        console.log('Result:', result1);
        console.log('');
        
        // Test 2: Status Change to Ready (should send ready message)
        console.log('📋 Test 2: Status Change to Ready');
        console.log('Expected: Order ready message');
        const result2 = await bot.processWebhookData(testWebhookData.statusChangeTests[0]);
        console.log('Result:', result2);
        console.log('');
        
        // Test 3: Status Change to Delivered (should send delivery message)
        console.log('📋 Test 3: Status Change to Delivered');
        console.log('Expected: Delivery notification message');
        const result3 = await bot.processWebhookData(testWebhookData.statusChangeTests[1]);
        console.log('Result:', result3);
        console.log('');
        
        // Test 4: Fabric Order with Existing Customer (should send confirmation only)
        console.log('📋 Test 4: Fabric Order with Existing Customer');
        console.log('Expected: Confirmation message only (no welcome)');
        const result4 = await bot.processWebhookData(testWebhookData.fabricOrderTests[0]);
        console.log('Result:', result4);
        console.log('');
        
        console.log('✅ All tests completed!');
        console.log('\n📊 Test Summary:');
        console.log(`- New order tests: ${testWebhookData.newOrderTests.length}`);
        console.log(`- Status change tests: ${testWebhookData.statusChangeTests.length}`);
        console.log(`- Fabric order tests: ${testWebhookData.fabricOrderTests.length}`);
        console.log('\n💡 Check the mock logs above to verify correct message types were triggered.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
    }
}

async function testHelperMethods() {
    console.log('\n🔧 Testing Helper Methods...');
    
    try {
        const EnhancedWhatsAppBot = require('../src/core/bot');
        const bot = new EnhancedWhatsAppBot({
            testMode: true,
            skipConnection: true
        });
        
        // Test phone extraction
        const testOrder = {
            'Contact Number': '9123456789',
            'Customer Name': 'Test Customer',
            'Order ID': 'TEST123'
        };
        
        const phone = bot.extractPhone(testOrder);
        const orderId = bot.extractOrderId(testOrder);
        const formattedPhone = bot.formatPhoneNumber(phone);
        const normalized = bot.normalizeOrderData(testOrder);
        
        console.log('✅ Phone extraction:', phone);
        console.log('✅ Order ID extraction:', orderId);
        console.log('✅ Formatted phone:', formattedPhone);
        console.log('✅ Normalized data sample:', {
            customer_name: normalized.customer_name,
            order_id: normalized.order_id,
            phone: normalized.phone
        });
        
    } catch (error) {
        console.error('❌ Helper method test failed:', error.message);
    }
}

// Run tests
if (require.main === module) {
    (async () => {
        await testEnhancedNotifications();
        await testHelperMethods();
        
        console.log('\n🎯 Enhanced Notification System Ready!');
        console.log('\n📝 Next Steps:');
        console.log('1. Update your Google Apps Script with the enhanced webhook code');
        console.log('2. Test with real Google Sheets data');
        console.log('3. Monitor logs for proper message flow');
        console.log('4. Verify WhatsApp messages are sent correctly');
    })();
}

module.exports = {
    testWebhookData,
    testEnhancedNotifications,
    testHelperMethods
};