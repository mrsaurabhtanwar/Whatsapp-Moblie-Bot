#!/usr/bin/env node

/**
 * Webhook Integration Test Script
 * 
 * This script tests the webhook functionality to ensure everything is working correctly.
 * Run this after setting up the webhook system to verify the integration.
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const CONFIG = {
  BOT_URL: process.env.WEBHOOK_URL || 'http://localhost:3001',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9',
  TEST_SHEET_ID: process.env.GOOGLE_SHEET_ID || '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y'
};

/**
 * Test webhook endpoint availability
 */
async function testWebhookEndpoint() {
  console.log('🧪 Testing webhook endpoint availability...');
  
  try {
    const response = await axios.get(`${CONFIG.BOT_URL}/webhook/test`);
    
    if (response.status === 200) {
      console.log('✅ Webhook endpoint is accessible');
      console.log('📊 Status:', response.data);
      return true;
    } else {
      console.log('❌ Webhook endpoint returned unexpected status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook endpoint test failed:', error.message);
    return false;
  }
}

/**
 * Test webhook with sample data
 */
async function testWebhookWithData() {
  console.log('🧪 Testing webhook with sample data...');
  
  const testPayload = {
    sheetId: CONFIG.TEST_SHEET_ID,
    sheetName: 'Orders',
    sheetType: 'orders',
    rows: [
      {
        'Order ID': 'TEST-' + Date.now(),
        'Customer Name': 'Test Customer',
        'Phone': '1234567890',
        'Delivery Status': 'pending',
        'Ready Notified': 'No',
        'Delivery Notified': 'No',
        'Welcome Notified': 'No',
        'Test': true
      }
    ],
    timestamp: new Date().toISOString(),
    secret: CONFIG.WEBHOOK_SECRET
  };
  
  try {
    const response = await axios.post(`${CONFIG.BOT_URL}/webhook/google-sheets`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Webhook data test successful');
      console.log('📊 Response:', response.data);
      return true;
    } else {
      console.log('❌ Webhook data test failed with status:', response.status);
      console.log('📊 Response:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook data test failed:', error.message);
    if (error.response) {
      console.log('📊 Error response:', error.response.data);
    }
    return false;
  }
}

/**
 * Test webhook security (invalid secret)
 */
async function testWebhookSecurity() {
  console.log('🧪 Testing webhook security...');
  
  const testPayload = {
    sheetId: CONFIG.TEST_SHEET_ID,
    sheetName: 'Orders',
    sheetType: 'orders',
    rows: [],
    timestamp: new Date().toISOString(),
    secret: 'invalid-secret'
  };
  
  try {
    const response = await axios.post(`${CONFIG.BOT_URL}/webhook/google-sheets`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': 'invalid-secret'
      }
    });
    
    console.log('❌ Security test failed - webhook accepted invalid secret');
    return false;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Webhook security test passed - invalid secret rejected');
      return true;
    } else {
      console.log('❌ Security test failed with unexpected error:', error.message);
      return false;
    }
  }
}

/**
 * Test bot health endpoint
 */
async function testBotHealth() {
  console.log('🧪 Testing bot health endpoint...');
  
  try {
    const response = await axios.get(`${CONFIG.BOT_URL}/api/health`);
    
    if (response.status === 200) {
      console.log('✅ Bot health check passed');
      console.log('📊 Health status:', response.data);
      return true;
    } else {
      console.log('❌ Bot health check failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Bot health check failed:', error.message);
    return false;
  }
}

/**
 * Test bot status endpoint
 */
async function testBotStatus() {
  console.log('🧪 Testing bot status endpoint...');
  
  try {
    const response = await axios.get(`${CONFIG.BOT_URL}/status`);
    
    if (response.status === 200) {
      console.log('✅ Bot status check passed');
      console.log('📊 Status:', response.data);
      return true;
    } else {
      console.log('❌ Bot status check failed with status:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Bot status check failed:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Webhook Integration Tests');
  console.log('=====================================');
  console.log(`Bot URL: ${CONFIG.BOT_URL}`);
  console.log(`Webhook Secret: ${CONFIG.WEBHOOK_SECRET ? 'Configured' : 'Not configured'}`);
  console.log(`Test Sheet ID: ${CONFIG.TEST_SHEET_ID}`);
  console.log('');
  
  const tests = [
    { name: 'Bot Status', fn: testBotStatus },
    { name: 'Bot Health', fn: testBotHealth },
    { name: 'Webhook Endpoint', fn: testWebhookEndpoint },
    { name: 'Webhook Security', fn: testWebhookSecurity },
    { name: 'Webhook Data', fn: testWebhookWithData }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🔍 Running ${test.name} test...`);
    const result = await test.fn();
    results.push({ name: test.name, passed: result });
    
    if (result) {
      console.log(`✅ ${test.name} test passed`);
    } else {
      console.log(`❌ ${test.name} test failed`);
    }
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Webhook integration is working correctly.');
    console.log('\n📋 Next steps:');
    console.log('1. Set up Google Apps Script webhook');
    console.log('2. Test with actual sheet changes');
    console.log('3. Monitor logs for any issues');
  } else {
    console.log('⚠️ Some tests failed. Please check the configuration and try again.');
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure bot is running and accessible');
    console.log('2. Check WEBHOOK_SECRET configuration');
    console.log('3. Verify webhook endpoint is working');
    console.log('4. Check bot logs for any errors');
  }
  
  return passed === total;
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testWebhookEndpoint,
  testWebhookWithData,
  testWebhookSecurity,
  testBotHealth,
  testBotStatus,
  runAllTests
};
