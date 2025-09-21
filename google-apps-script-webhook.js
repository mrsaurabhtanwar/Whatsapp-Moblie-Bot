/**
 * Google Apps Script Webhook Integration for WhatsApp Bot
 * 
 * This script monitors Google Sheets for changes and sends real-time notifications
 * to your WhatsApp Bot webhook endpoint when order statuses change.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Delete the default code and paste this entire script
 * 4. Update the configuration section below with your values
 * 5. Save the script (Ctrl+S)
 * 6. Run the setupWebhook() function once to set up triggers
 * 7. Test with testWebhook() function
 * 
 * FEATURES:
 * - Real-time notifications when sheet data changes
 * - Monitors multiple sheets (Orders, Fabric, Combined)
 * - Sends only changed rows to reduce webhook payload
 * - Includes webhook secret for security
 * - Comprehensive error handling and logging
 * - Automatic retry mechanism for failed webhooks
 */

// ==================== CONFIGURATION ====================
// UPDATE THESE VALUES WITH YOUR ACTUAL CONFIGURATION

const CONFIG = {
  // Your WhatsApp Bot webhook URL (replace with your actual domain)
  WEBHOOK_URL: 'https://your-domain.com/webhook/google-sheets',
  
  // Webhook secret for security (must match WEBHOOK_SECRET in your .env file)
  WEBHOOK_SECRET: '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9',
  
  // Main Orders Sheet ID (contains all orders - fabric, tailoring, and combined)
  MAIN_SHEET_ID: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
  
  // Sheet configuration (consolidated sheet with multiple tabs)
  SHEET_CONFIGS: [
    {
      id: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
      name: 'Tailor Orders',
      type: 'tailor',
      description: 'Tailor Orders Tab',
      tabName: 'Tailor Orders'
    },
    {
      id: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
      name: 'Fabric Orders',
      type: 'fabric',
      description: 'Fabric Orders Tab',
      tabName: 'Fabric Orders'
    },
    {
      id: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
      name: 'Combine Orders',
      type: 'combine',
      description: 'Combine Orders Tab',
      tabName: 'Combine Orders'
    }
  ],
  
  // Columns to monitor for changes (status columns that trigger notifications)
  // Updated to match your actual sheet headers
  STATUS_COLUMNS: [
    // Common columns across all tabs
    'Payment Status',
    'Welcome Notified',
    'Delivery Status',
    
    // Tailor Orders specific
    'Confirmation Notified',
    'Ready Notified', 
    'Delivery Notified',
    'Pickup Notified',
    'Payment Notified',
    
    // Fabric Orders specific
    'Purchase Notified',
    'Payment Reminder Count',
    'Last Payment Reminder Date',
    
    // Combine Orders specific
    'Combined Order Notified'
  ],
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Convert row array to object using headers
 */
function rowToObject(headers, row) {
  const rowObject = {};
  headers.forEach((header, index) => {
    if (header && row[index] !== undefined && row[index] !== '') {
      rowObject[header] = row[index];
    }
  });
  return rowObject;
}

/**
 * Extract phone number from row object
 */
function extractPhone(rowObject) {
  const phoneFields = ['Contact Number', 'Phone', 'Phone Number', 'Contact Info', 'phone'];
  for (const field of phoneFields) {
    if (rowObject[field]) {
      return String(rowObject[field]).replace(/\D/g, '');
    }
  }
  return null;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Setup webhook triggers for all configured sheets
 * Run this function once after updating the configuration
 */
function setupWebhook() {
  console.log('🔧 Setting up webhook triggers...');
  
  try {
    // Clear existing triggers first
    clearExistingTriggers();
    
    // Set up triggers for each sheet
    CONFIG.SHEET_CONFIGS.forEach(sheetConfig => {
      try {
        const sheet = SpreadsheetApp.openById(sheetConfig.id);
        const sheetName = sheetConfig.name;
        
        // Create onEdit trigger for this sheet
        ScriptApp.newTrigger('onSheetEdit')
          .timeBased()
          .everyMinutes(1) // Check every minute for changes
          .create();
        
        console.log(`✅ Trigger created for ${sheetConfig.description} (${sheetConfig.id})`);
        
      } catch (error) {
        console.error(`❌ Failed to create trigger for ${sheetConfig.description}:`, error.message);
      }
    });
    
    console.log('✅ Webhook setup complete!');
    console.log('📋 Next steps:');
    console.log('1. Test the webhook with testWebhook() function');
    console.log('2. Make a test edit to your sheet to verify it works');
    console.log('3. Monitor the logs for any issues');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

/**
 * Clear all existing triggers to prevent duplicates
 */
function clearExistingTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onSheetEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log('🧹 Cleared existing triggers');
}

/**
 * Main function called when sheet data changes
 * This function is triggered automatically by Google Apps Script
 */
function onSheetEdit(e) {
  try {
    console.log('📝 Sheet edit detected, checking for changes...');
    
    // Check all configured sheets for changes
    CONFIG.SHEET_CONFIGS.forEach(sheetConfig => {
      try {
        checkSheetForChanges(sheetConfig);
      } catch (error) {
        console.error(`Error checking ${sheetConfig.description}:`, error.message);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in onSheetEdit:', error.message);
  }
}

/**
 * Check a specific sheet for changes and send webhook if needed
 */
function checkSheetForChanges(sheetConfig) {
  try {
    const sheet = SpreadsheetApp.openById(sheetConfig.id);
    const sheetName = sheetConfig.name;
    
    // Get current sheet data
    const currentData = getSheetData(sheet, sheetConfig);
    if (!currentData || currentData.length === 0) {
      return; // No data to process
    }
    
    // Get stored data from last check
    const lastDataKey = `lastData_${sheetConfig.id}`;
    const lastData = getStoredData(lastDataKey);
    
    // Compare current data with last stored data
    const changes = findChanges(lastData, currentData);
    
    if (changes.length > 0) {
      console.log(`📊 Found ${changes.length} changes in ${sheetConfig.description}`);
      
      // Send webhook with changed data
      sendWebhook(sheetConfig, changes);
      
      // Store current data for next comparison
      setStoredData(lastDataKey, currentData);
    }
    
  } catch (error) {
    console.error(`Error checking sheet ${sheetConfig.description}:`, error.message);
  }
}

/**
 * Get data from a specific sheet
 */
function getSheetData(sheet, sheetConfig) {
  try {
    // Try different range formats to handle various sheet structures
    const ranges = [
      `${sheetConfig.tabName}!A:Z`,  // Use tabName for specific tab
      `${sheetConfig.name}!A:Z`,     // Fallback to name
      'Sheet1!A:Z',
      'Orders!A:Z',
      'Data!A:Z'
    ];
    
    for (const range of ranges) {
      try {
        const data = sheet.getRange(range).getValues();
        if (data && data.length > 1) {
          console.log(`✅ Retrieved ${data.length} rows from ${sheetConfig.description} using range: ${range}`);
          return data;
        }
      } catch (rangeError) {
        continue; // Try next range
      }
    }
    
    console.warn(`⚠️ No valid data found for ${sheetConfig.description}`);
    return null;
    
  } catch (error) {
    console.error(`Error getting sheet data from ${sheetConfig.description}:`, error.message);
    return null;
  }
}

/**
 * Find changes between old and new data with enhanced detection
 */
function findChanges(oldData, newData) {
  if (!oldData || oldData.length === 0) {
    // First time - mark all existing data as new orders
    const changes = [];
    const headers = newData[0];
    
    for (let i = 1; i < newData.length; i++) {
      const rowObject = rowToObject(headers, newData[i]);
      rowObject._changeType = 'new_order';
      rowObject._isNewPhone = isNewPhoneAcrossAllSheets(extractPhone(rowObject));
      changes.push(rowObject);
    }
    
    return changes;
  }
  
  const changes = [];
  const headers = newData[0];
  
  // Find key column indices
  const phoneColIndex = headers.findIndex(h => h && /phone|contact/i.test(h));
  const orderIdColIndex = headers.findIndex(h => h && /(order.*id|combined.*order|master.*order)/i.test(h));
  const statusColIndex = headers.findIndex(h => h && /delivery.*status|status/i.test(h));
  
  // Track important status columns that indicate order state changes
  const importantStatusColumns = [
    'Delivery Status',
    'Payment Status', 
    'Welcome Notified',
    'Confirmation Notified',
    'Ready Notified',
    'Delivery Notified',
    'Pickup Notified',
    'Combined Order Notified'
  ];
  
  const statusColumnIndices = importantStatusColumns.map(colName => 
    headers.findIndex(h => h && h.toLowerCase() === colName.toLowerCase())
  ).filter(index => index !== -1);
  
  // Compare each row for changes
  for (let i = 1; i < newData.length; i++) {
    const newRow = newData[i];
    const oldRow = oldData[i] || [];
    
    // Check if this is a completely new row (new order)
    const isNewOrder = oldRow.length === 0 || 
                      (orderIdColIndex >= 0 && !oldRow[orderIdColIndex] && newRow[orderIdColIndex]);
    
    // Check for status changes in important columns
    let hasStatusChange = false;
    let changedColumns = [];
    
    for (const statusIndex of statusColumnIndices) {
      if (statusIndex >= 0 && statusIndex < newRow.length) {
        const oldValue = oldRow[statusIndex] || '';
        const newValue = newRow[statusIndex] || '';
        
        if (oldValue !== newValue) {
          hasStatusChange = true;
          changedColumns.push({
            column: headers[statusIndex],
            oldValue: oldValue,
            newValue: newValue
          });
        }
      }
    }
    
    if (isNewOrder || hasStatusChange) {
      const rowObject = rowToObject(headers, newRow);
      
      if (isNewOrder) {
        rowObject._changeType = 'new_order';
        rowObject._isNewPhone = isNewPhoneAcrossAllSheets(extractPhone(rowObject));
      } else {
        rowObject._changeType = 'status_change';
        rowObject._changedColumns = changedColumns;
        
        // Determine specific status change type
        const deliveryStatus = (newRow[statusColIndex] || '').toLowerCase();
        if (deliveryStatus === 'ready') {
          rowObject._statusChangeType = 'ready';
        } else if (['delivered', 'completed'].includes(deliveryStatus)) {
          rowObject._statusChangeType = 'delivered';
        } else {
          rowObject._statusChangeType = 'other';
        }
      }
      
      changes.push(rowObject);
    }
  }
  
  return changes;
}



/**
 * Check if phone number is new across all configured sheets
 */
function isNewPhoneAcrossAllSheets(phone) {
  if (!phone) return false;
  
  try {
    // Normalize phone number
    let normalizedPhone = String(phone).replace(/\D/g, '');
    if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
      normalizedPhone = normalizedPhone.substring(2); // Remove country code for comparison
    }
    
    // Check each configured sheet
    for (const config of CONFIG.SHEET_CONFIGS) {
      try {
        const sheet = SpreadsheetApp.openById(config.id);
        const data = getSheetData(sheet, config);
        
        if (!data || data.length <= 1) continue;
        
        const headers = data[0];
        const phoneColIndex = headers.findIndex(h => h && /phone|contact/i.test(h));
        if (phoneColIndex === -1) continue;
        
        // Check all rows in this sheet
        for (let i = 1; i < data.length; i++) {
          const rowPhone = String(data[i][phoneColIndex] || '').replace(/\D/g, '');
          let normalizedRowPhone = rowPhone;
          
          if (normalizedRowPhone.startsWith('91') && normalizedRowPhone.length === 12) {
            normalizedRowPhone = normalizedRowPhone.substring(2);
          }
          
          // If we find a match, phone is not new
          if (normalizedRowPhone === normalizedPhone && normalizedRowPhone.length >= 10) {
            return false;
          }
        }
      } catch (sheetError) {
        console.warn(`Error checking sheet ${config.name} for phone ${phone}:`, sheetError.message);
        continue;
      }
    }
    
    return true; // Phone not found in any sheet
    
  } catch (error) {
    console.error('Error checking if phone is new:', error.message);
    return false; // Default to false if there's an error
  }
}

/**
 * Send webhook to WhatsApp Bot
 */
function sendWebhook(sheetConfig, changes) {
  try {
    const payload = {
      sheetId: sheetConfig.id,
      sheetName: sheetConfig.name,
      sheetType: sheetConfig.type,
      rows: changes,
      timestamp: new Date().toISOString(),
      secret: CONFIG.WEBHOOK_SECRET
    };
    
    console.log(`📤 Sending webhook for ${sheetConfig.description} with ${changes.length} changes`);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET
      },
      payload: JSON.stringify(payload)
    };
    
    // Send webhook with retry logic
    sendWithRetry(CONFIG.WEBHOOK_URL, options, 0);
    
  } catch (error) {
    console.error('❌ Error sending webhook:', error.message);
  }
}

/**
 * Send webhook with retry logic
 */
function sendWithRetry(url, options, attempt) {
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      const responseText = response.getContentText();
      console.log(`✅ Webhook sent successfully (attempt ${attempt + 1}):`, responseText);
    } else {
      throw new Error(`HTTP ${responseCode}: ${response.getContentText()}`);
    }
    
  } catch (error) {
    console.error(`❌ Webhook attempt ${attempt + 1} failed:`, error.message);
    
    if (attempt < CONFIG.MAX_RETRIES - 1) {
      console.log(`🔄 Retrying in ${CONFIG.RETRY_DELAY_MS}ms...`);
      Utilities.sleep(CONFIG.RETRY_DELAY_MS);
      sendWithRetry(url, options, attempt + 1);
    } else {
      console.error('❌ All webhook attempts failed');
    }
  }
}

/**
 * Test webhook functionality
 * Run this function to test if the webhook is working
 */
function testWebhook() {
  console.log('🧪 Testing webhook functionality...');
  
  try {
    // Create test payload
    const testPayload = {
      sheetId: CONFIG.SHEET_CONFIGS[0].id,
      sheetName: CONFIG.SHEET_CONFIGS[0].name,
      sheetType: CONFIG.SHEET_CONFIGS[0].type,
      rows: [
        {
          'Order ID': 'TEST-' + Date.now(),
          'Customer Name': 'Test Customer',
          'Phone': '1234567890',
          'Delivery Status': 'pending',
          'Test': true
        }
      ],
      timestamp: new Date().toISOString(),
      secret: CONFIG.WEBHOOK_SECRET
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET
      },
      payload: JSON.stringify(testPayload)
    };
    
    console.log('📤 Sending test webhook...');
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      console.log('✅ Test webhook successful!');
      console.log('Response:', responseText);
    } else {
      console.error('❌ Test webhook failed:', responseCode, responseText);
    }
    
  } catch (error) {
    console.error('❌ Test webhook error:', error.message);
  }
}

/**
 * Get webhook status and configuration
 */
function getWebhookStatus() {
  console.log('📊 Webhook Status:');
  console.log('URL:', CONFIG.WEBHOOK_URL);
  console.log('Secret configured:', !!CONFIG.WEBHOOK_SECRET);
  console.log('Sheets monitored:', CONFIG.SHEET_CONFIGS.length);
  
  CONFIG.SHEET_CONFIGS.forEach(sheet => {
    console.log(`- ${sheet.description}: ${sheet.id}`);
  });
  
  // Check triggers
  const triggers = ScriptApp.getProjectTriggers();
  const webhookTriggers = triggers.filter(t => t.getHandlerFunction() === 'onSheetEdit');
  console.log('Active triggers:', webhookTriggers.length);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Store data in PropertiesService for comparison
 */
function setStoredData(key, data) {
  try {
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error storing data:', error.message);
  }
}

/**
 * Get stored data from PropertiesService
 */
function getStoredData(key) {
  try {
    const data = PropertiesService.getScriptProperties().getProperty(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting stored data:', error.message);
    return null;
  }
}

/**
 * Clear all stored data (for testing/reset)
 */
function clearStoredData() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const keys = properties.getKeys();
    
    keys.forEach(key => {
      if (key.startsWith('lastData_')) {
        properties.deleteProperty(key);
      }
    });
    
    console.log('🧹 Cleared all stored data');
  } catch (error) {
    console.error('Error clearing stored data:', error.message);
  }
}

// ==================== SETUP INSTRUCTIONS ====================

/**
 * Complete setup instructions
 * Run this function to see detailed setup instructions
 */
function showSetupInstructions() {
  console.log('📋 GOOGLE APPS SCRIPT WEBHOOK SETUP INSTRUCTIONS');
  console.log('');
  console.log('1. UPDATE CONFIGURATION:');
  console.log('   - Replace WEBHOOK_URL with your actual bot domain');
  console.log('   - Replace WEBHOOK_SECRET with your secure secret');
  console.log('   - Update SHEET_IDS with your actual Google Sheet IDs');
  console.log('');
  console.log('2. SAVE AND SETUP:');
  console.log('   - Save this script (Ctrl+S)');
  console.log('   - Run setupWebhook() function once');
  console.log('   - Run testWebhook() to verify it works');
  console.log('');
  console.log('3. TEST:');
  console.log('   - Make a test edit to your Google Sheet');
  console.log('   - Check the logs to see if webhook was sent');
  console.log('   - Verify your WhatsApp Bot received the notification');
  console.log('');
  console.log('4. MONITOR:');
  console.log('   - Check logs regularly for any errors');
  console.log('   - Use getWebhookStatus() to check configuration');
  console.log('   - Use clearStoredData() if you need to reset');
  console.log('');
  console.log('✅ Setup complete! Your webhook system is now active.');
}
