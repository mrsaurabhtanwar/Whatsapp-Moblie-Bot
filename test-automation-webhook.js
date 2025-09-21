/**
 * Test automation webhook with SAURABH's fabric order
 */

const https = require('https');

const testData = {
  sheetId: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
  sheetName: 'Fabric Orders',
  sheetType: 'fabric',
  rows: [{
    'Customer Name': 'SAURABH',
    'Contact Number': '7375938371',
    'Order ID': 'FRSS2109251245',
    'Purchase Date': '21/09/2025',
    'Fabric Type': 'Cotton',
    'Quantity': '2 meters',
    'Total Amount': '1000',
    'Advance Payment': '500',
    'Remaining Amount': '500',
    'Welcome Notified': '',
    'Purchase Notified': '',
    '_messageType': 'fabric_purchase',
    '_changeType': 'automation_trigger',
    '_automationRule': true
  }],
  timestamp: new Date().toISOString(),
  secret: '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'nelda-refutative-ileana.ngrok-free.app',
  port: 443,
  path: '/webhook/google-sheets',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Webhook-Secret': '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9',
    'ngrok-skip-browser-warning': 'true'
  }
};

console.log('🧪 Testing automation webhook for SAURABH fabric order...');
console.log('📞 Contact:', testData.rows[0]['Contact Number']);
console.log('🆔 Order ID:', testData.rows[0]['Order ID']);
console.log('📦 Message Type:', testData.rows[0]['_messageType']);

const req = https.request(options, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);

  let responseData = '';
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('📨 Response:', responseData);
    try {
      const response = JSON.parse(responseData);
      if (response.success) {
        console.log('✅ Webhook test successful!');
        if (response.processed > 0) {
          console.log(`📨 ${response.processed} message(s) processed`);
        } else {
          console.log('⚠️ No messages were processed - check automation conditions');
        }
      } else {
        console.log('❌ Webhook test failed:', response.error || 'Unknown error');
      }
    } catch (e) {
      console.log('📄 Raw response:', responseData);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(postData);
req.end();