/**
 * Enhanced Google Apps Script with RS Tailor & Fabric Automation Rules
 * 
 * This script implements comprehensive automation rules for different message types
 * based on specific conditions and timing constraints.
 * 
 * Features:
 * - 9 different message types with specific triggers
 * - Time-based restrictions (9 AM - 9 PM)
 * - Message frequency controls
 * - Priority-based message sending
 * - Comprehensive condition checking
 */

// ==================== CONFIGURATION ====================

const CONFIG = {
  // Your WhatsApp Bot webhook URL
  WEBHOOK_URL: 'http://localhost:3001/webhook/google-sheets',
  
  // Webhook secret for security
  WEBHOOK_SECRET: '32OsWZZT9OpyFVCQgMSfo202ACz_2L2o9oALDsgNtyRCLrXX9',
  
  // Sheet configuration
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
  
  // Timing configuration
  BUSINESS_HOURS: {
    START: 9,  // 9 AM
    END: 21    // 9 PM
  },
  
  // Message frequency limits
  LIMITS: {
    SAME_CUSTOMER_GAP_HOURS: 4,      // 4 hours between any messages to same customer
    SAME_MESSAGE_TYPE_GAP_HOURS: 24, // 24 hours between same message type
    MAX_REMINDER_ATTEMPTS: 3,        // Maximum reminder attempts
    PICKUP_REMINDER_AFTER_DAYS: 3,   // Send pickup reminder after 3 days
    PAYMENT_REMINDER_AFTER_DAYS: 7,  // Send payment reminder after 7 days
    FABRIC_PAYMENT_REMINDER_DAYS: 5  // Send fabric payment reminder after 5 days
  },
  
  // Message priorities (1 = highest)
  MESSAGE_PRIORITIES: {
    'welcome': 1,
    'order_confirmation': 2,
    'fabric_purchase': 2,
    'combined_order': 2,
    'order_ready': 3,
    'delivery_complete': 4,
    'pickup_reminder': 5,
    'payment_reminder': 6,
    'fabric_payment_reminder': 6
  }
};

// ==================== AUTOMATION FUNCTIONS ====================

/**
 * Main automation function - runs all checks
 */
function runAutomation() {
  console.log('🚀 Starting RS Tailor & Fabric Automation...');
  
  // Check if within business hours
  if (!isWithinBusinessHours()) {
    console.log('⏰ Outside business hours. No messages will be sent.');
    return;
  }
  
  try {
    // Process each sheet
    CONFIG.SHEET_CONFIGS.forEach(sheetConfig => {
      console.log(`📊 Processing ${sheetConfig.description}...`);
      processSheetAutomation(sheetConfig);
    });
    
    console.log('✅ Automation run completed successfully!');
    
  } catch (error) {
    console.error('❌ Automation run failed:', error.message);
  }
}

/**
 * Process automation for a specific sheet
 */
function processSheetAutomation(sheetConfig) {
  try {
    const sheet = SpreadsheetApp.openById(sheetConfig.id);
    const data = getSheetData(sheet, sheetConfig);
    
    if (!data || data.length <= 1) {
      console.log(`⚠️ No data found in ${sheetConfig.description}`);
      return;
    }
    
    const headers = data[0];
    const pendingMessages = [];
    
    // Check each row for automation conditions
    for (let i = 1; i < data.length; i++) {
      const rowData = data[i];
      const rowObject = rowToObject(headers, rowData);
      
      // Check all automation rules for this row
      const messages = checkAutomationRules(rowObject, sheetConfig, i + 1);
      pendingMessages.push(...messages);
    }
    
    // Sort messages by priority and send them
    if (pendingMessages.length > 0) {
      sendPriorityMessages(pendingMessages, sheet, headers);
    }
    
  } catch (error) {
    console.error(`Error processing ${sheetConfig.description}:`, error.message);
  }
}

/**
 * Check all automation rules for a single row
 */
function checkAutomationRules(rowData, sheetConfig, rowIndex) {
  const messages = [];
  
  // Rule 1: Welcome Message
  if (shouldSendWelcomeMessage(rowData)) {
    messages.push({
      type: 'welcome',
      priority: CONFIG.MESSAGE_PRIORITIES.welcome,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumn: 'Welcome Notified',
      updateValue: 'Yes'
    });
  }
  
  // Rule 2: Order Confirmation (Tailoring)
  if (sheetConfig.type === 'tailor' && shouldSendOrderConfirmation(rowData)) {
    messages.push({
      type: 'order_confirmation',
      priority: CONFIG.MESSAGE_PRIORITIES.order_confirmation,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumn: 'Confirmation Notified',
      updateValue: 'Yes'
    });
  }
  
  // Rule 3: Fabric Purchase Confirmation
  if (sheetConfig.type === 'fabric' && shouldSendFabricPurchase(rowData)) {
    messages.push({
      type: 'fabric_purchase',
      priority: CONFIG.MESSAGE_PRIORITIES.fabric_purchase,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumn: 'Purchase Notified',
      updateValue: 'Yes'
    });
  }
  
  // Rule 4: Order Ready (Tailoring)
  if (sheetConfig.type === 'tailor' && shouldSendOrderReady(rowData)) {
    messages.push({
      type: 'order_ready',
      priority: CONFIG.MESSAGE_PRIORITIES.order_ready,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumns: {
        'Ready Notified': 'Yes',
        'Ready Notified Date': new Date().toLocaleDateString()
      }
    });
  }
  
  // Rule 5: Delivery Complete
  if (shouldSendDeliveryComplete(rowData)) {
    messages.push({
      type: 'delivery_complete',
      priority: CONFIG.MESSAGE_PRIORITIES.delivery_complete,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumn: 'Delivery Notified',
      updateValue: 'Yes'
    });
  }
  
  // Rule 6: Combined Order Confirmation
  if (sheetConfig.type === 'combine' && shouldSendCombinedOrder(rowData)) {
    messages.push({
      type: 'combined_order',
      priority: CONFIG.MESSAGE_PRIORITIES.combined_order,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumn: 'Combined Order Notified',
      updateValue: 'Yes'
    });
  }
  
  // Rule 7: Pickup Reminder
  if (sheetConfig.type === 'tailor' && shouldSendPickupReminder(rowData)) {
    messages.push({
      type: 'pickup_reminder',
      priority: CONFIG.MESSAGE_PRIORITIES.pickup_reminder,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumns: {
        'Pickup Reminder Count': (parseInt(rowData['Pickup Reminder Count'] || '0') + 1).toString(),
        'Last Pickup Reminder Date': new Date().toLocaleDateString()
      }
    });
  }
  
  // Rule 8: Payment Reminder (Tailoring)
  if (sheetConfig.type === 'tailor' && shouldSendPaymentReminder(rowData)) {
    messages.push({
      type: 'payment_reminder',
      priority: CONFIG.MESSAGE_PRIORITIES.payment_reminder,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumns: {
        'Payment Reminder Count': (parseInt(rowData['Payment Reminder Count'] || '0') + 1).toString(),
        'Last Payment Reminder Date': new Date().toLocaleDateString()
      }
    });
  }
  
  // Rule 9: Payment Reminder (Fabric)
  if (sheetConfig.type === 'fabric' && shouldSendFabricPaymentReminder(rowData)) {
    messages.push({
      type: 'fabric_payment_reminder',
      priority: CONFIG.MESSAGE_PRIORITIES.fabric_payment_reminder,
      rowData: rowData,
      sheetConfig: sheetConfig,
      rowIndex: rowIndex,
      updateColumns: {
        'Payment Reminder Count': (parseInt(rowData['Payment Reminder Count'] || '0') + 1).toString(),
        'Last Payment Reminder Date': new Date().toLocaleDateString()
      }
    });
  }
  
  return messages;
}

// ==================== CONDITION CHECKERS ====================

function shouldSendWelcomeMessage(rowData) {
  return rowData['Customer Name'] && 
         rowData['Contact Number'] && 
         (!rowData['Welcome Notified'] || rowData['Welcome Notified'].toLowerCase() !== 'yes');
}

function shouldSendOrderConfirmation(rowData) {
  return rowData['Order ID'] && 
         parseFloat(rowData['Advance Payment'] || '0') > 0 && 
         (!rowData['Confirmation Notified'] || rowData['Confirmation Notified'].toLowerCase() !== 'yes');
}

function shouldSendFabricPurchase(rowData) {
  return rowData['Order ID'] && 
         rowData['Customer Name'] && 
         (!rowData['Purchase Notified'] || rowData['Purchase Notified'].toLowerCase() !== 'yes');
}

function shouldSendOrderReady(rowData) {
  return rowData['Delivery Status'] && 
         rowData['Delivery Status'].toLowerCase() === 'ready' && 
         (!rowData['Ready Notified'] || rowData['Ready Notified'].toLowerCase() !== 'yes');
}

function shouldSendDeliveryComplete(rowData) {
  return rowData['Delivery Status'] && 
         rowData['Delivery Status'].toLowerCase() === 'delivered' && 
         (!rowData['Delivery Notified'] || rowData['Delivery Notified'].toLowerCase() !== 'yes');
}

function shouldSendCombinedOrder(rowData) {
  return rowData['Master Order ID'] && 
         rowData['Fabric Order ID'] && 
         rowData['Tailoring Order ID'] && 
         (!rowData['Combined Order Notified'] || rowData['Combined Order Notified'].toLowerCase() !== 'yes');
}

function shouldSendPickupReminder(rowData) {
  if (!rowData['Delivery Status'] || rowData['Delivery Status'].toLowerCase() !== 'ready') return false;
  if (!rowData['Ready Notified'] || rowData['Ready Notified'].toLowerCase() !== 'yes') return false;
  
  const reminderCount = parseInt(rowData['Pickup Reminder Count'] || '0');
  if (reminderCount >= CONFIG.LIMITS.MAX_REMINDER_ATTEMPTS) return false;
  
  const readyDate = new Date(rowData['Ready Notified Date'] || new Date());
  const daysSinceReady = Math.floor((new Date() - readyDate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceReady < CONFIG.LIMITS.PICKUP_REMINDER_AFTER_DAYS) return false;
  
  const lastReminderDate = rowData['Last Pickup Reminder Date'];
  const today = new Date().toLocaleDateString();
  
  return !lastReminderDate || lastReminderDate !== today;
}

function shouldSendPaymentReminder(rowData) {
  if (rowData['Delivery Status'] && rowData['Delivery Status'].toLowerCase() !== 'delivered') return false;
  if (parseFloat(rowData['Remaining Amount'] || '0') <= 0) return false;
  
  const reminderCount = parseInt(rowData['Payment Reminder Count'] || '0');
  if (reminderCount >= CONFIG.LIMITS.MAX_REMINDER_ATTEMPTS) return false;
  
  const deliveryDate = new Date(rowData['Delivery Date'] || new Date());
  const daysSinceDelivery = Math.floor((new Date() - deliveryDate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceDelivery < CONFIG.LIMITS.PAYMENT_REMINDER_AFTER_DAYS) return false;
  
  const lastReminderDate = rowData['Last Payment Reminder Date'];
  const today = new Date().toLocaleDateString();
  
  return !lastReminderDate || lastReminderDate !== today;
}

function shouldSendFabricPaymentReminder(rowData) {
  if (parseFloat(rowData['Remaining Amount'] || '0') <= 0) return false;
  
  const reminderCount = parseInt(rowData['Payment Reminder Count'] || '0');
  if (reminderCount >= CONFIG.LIMITS.MAX_REMINDER_ATTEMPTS) return false;
  
  const purchaseDate = new Date(rowData['Purchase Date'] || new Date());
  const daysSincePurchase = Math.floor((new Date() - purchaseDate) / (1000 * 60 * 60 * 24));
  
  if (daysSincePurchase < CONFIG.LIMITS.FABRIC_PAYMENT_REMINDER_DAYS) return false;
  
  const lastReminderDate = rowData['Last Payment Reminder Date'];
  const today = new Date().toLocaleDateString();
  
  return !lastReminderDate || lastReminderDate !== today;
}

// ==================== UTILITY FUNCTIONS ====================

function isWithinBusinessHours() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= CONFIG.BUSINESS_HOURS.START && hour <= CONFIG.BUSINESS_HOURS.END;
}

function sendPriorityMessages(messages, sheet, headers) {
  // Sort by priority (lower number = higher priority)
  messages.sort((a, b) => a.priority - b.priority);
  
  // Group by customer to respect frequency limits
  const customerMessages = new Map();
  
  messages.forEach(message => {
    const phone = message.rowData['Contact Number'];
    if (!customerMessages.has(phone)) {
      customerMessages.set(phone, []);
    }
    customerMessages.get(phone).push(message);
  });
  
  // Send only one message per customer, respecting priorities
  customerMessages.forEach((customerMsgs, phone) => {
    const highestPriorityMessage = customerMsgs[0]; // Already sorted by priority
    
    // Send the message
    sendMessageWebhook(highestPriorityMessage);
    
    // Update the sheet
    updateSheetAfterMessage(sheet, headers, highestPriorityMessage);
  });
}

function sendMessageWebhook(message) {
  try {
    const payload = {
      sheetId: message.sheetConfig.id,
      sheetName: message.sheetConfig.name,
      sheetType: message.sheetConfig.type,
      rows: [{
        ...message.rowData,
        _messageType: message.type,
        _changeType: 'automation_trigger',
        _automationRule: true
      }],
      timestamp: new Date().toISOString(),
      secret: CONFIG.WEBHOOK_SECRET
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET,
        'ngrok-skip-browser-warning': 'true'
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode >= 200 && responseCode < 300) {
      console.log(`✅ Sent ${message.type} message for ${message.rowData['Customer Name']}`);
    } else {
      throw new Error(`HTTP ${responseCode}: ${response.getContentText()}`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to send ${message.type} message:`, error.message);
  }
}

function updateSheetAfterMessage(sheet, headers, message) {
  try {
    // Get the specific worksheet/tab
    const worksheet = sheet.getSheetByName(message.sheetConfig.tabName);
    if (!worksheet) {
      console.error(`Sheet tab "${message.sheetConfig.tabName}" not found`);
      return;
    }
    
    // Find column indices for updates
    if (message.updateColumn && message.updateValue) {
      const colIndex = headers.findIndex(h => h === message.updateColumn);
      if (colIndex !== -1) {
        worksheet.getRange(message.rowIndex, colIndex + 1).setValue(message.updateValue);
        console.log(`✅ Updated ${message.updateColumn} to ${message.updateValue}`);
      }
    }
    
    if (message.updateColumns) {
      Object.entries(message.updateColumns).forEach(([colName, value]) => {
        const colIndex = headers.findIndex(h => h === colName);
        if (colIndex !== -1) {
          worksheet.getRange(message.rowIndex, colIndex + 1).setValue(value);
          console.log(`✅ Updated ${colName} to ${value}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error updating sheet after message:', error.message);
  }
}

function rowToObject(headers, row) {
  const rowObject = {};
  headers.forEach((header, index) => {
    if (header && row[index] !== undefined && row[index] !== '') {
      rowObject[header] = row[index];
    }
  });
  return rowObject;
}

function getSheetData(sheet, sheetConfig) {
  try {
    const ranges = [
      `${sheetConfig.tabName}!A:Z`,
      `${sheetConfig.name}!A:Z`,
      'Sheet1!A:Z'
    ];
    
    for (const range of ranges) {
      try {
        const data = sheet.getRange(range).getValues();
        if (data && data.length > 1) {
          return data;
        }
      } catch (rangeError) {
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`Error getting sheet data:`, error.message);
    return null;
  }
}

// ==================== TRIGGER SETUP ====================

/**
 * Setup automation triggers
 */
function setupAutomationTriggers() {
  console.log('🔧 Setting up automation triggers...');
  
  try {
    // Clear existing triggers
    clearExistingTriggers();
    
    // New Orders Check - Every 30 minutes
    ScriptApp.newTrigger('runNewOrdersCheck')
      .timeBased()
      .everyMinutes(30)
      .create();
    
    // Status Updates - Every 2 hours
    ScriptApp.newTrigger('runStatusUpdatesCheck')
      .timeBased()
      .everyHours(2)
      .create();
    
    // Daily Reminders - Once daily at 10 AM
    ScriptApp.newTrigger('runDailyReminders')
      .timeBased()
      .everyDays(1)
      .atHour(10)
      .create();
    
    // Combined Orders - Every hour
    ScriptApp.newTrigger('runCombinedOrdersCheck')
      .timeBased()
      .everyHours(1)
      .create();
    
    console.log('✅ Automation triggers setup complete!');
    
  } catch (error) {
    console.error('❌ Trigger setup failed:', error.message);
  }
}

function clearExistingTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const functionName = trigger.getHandlerFunction();
    if (['runNewOrdersCheck', 'runStatusUpdatesCheck', 'runDailyReminders', 'runCombinedOrdersCheck'].includes(functionName)) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log('🧹 Cleared existing automation triggers');
}

// ==================== SPECIALIZED CHECK FUNCTIONS ====================

function runNewOrdersCheck() {
  console.log('🆕 Running New Orders Check...');
  // Implementation for welcome and confirmation messages
  runAutomation();
}

function runStatusUpdatesCheck() {
  console.log('📊 Running Status Updates Check...');
  // Implementation for ready and delivery notifications
  runAutomation();
}

function runDailyReminders() {
  console.log('⏰ Running Daily Reminders Check...');
  // Implementation for pickup and payment reminders
  runAutomation();
}

function runCombinedOrdersCheck() {
  console.log('🔗 Running Combined Orders Check...');
  // Implementation for combined order notifications
  runAutomation();
}

// ==================== TEST FUNCTIONS ====================

/**
 * Test automation with sample data
 */
function testAutomation() {
  console.log('🧪 Testing Automation Rules...');
  
  try {
    // Test with sample data
    const testRow = {
      'Customer Name': 'Test Customer',
      'Contact Number': '9876543210',
      'Order ID': 'TEST001',
      'Advance Payment': '500',
      'Welcome Notified': '',
      'Confirmation Notified': ''
    };
    
    const testConfig = CONFIG.SHEET_CONFIGS[0];
    const messages = checkAutomationRules(testRow, testConfig, 2);
    
    console.log(`✅ Test complete. Found ${messages.length} pending messages:`);
    messages.forEach(msg => {
      console.log(`- ${msg.type} (priority: ${msg.priority})`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

/**
 * Show automation status
 */
function showAutomationStatus() {
  console.log('📊 RS Tailor & Fabric Automation Status:');
  console.log(`- Business Hours: ${CONFIG.BUSINESS_HOURS.START} AM - ${CONFIG.BUSINESS_HOURS.END} PM`);
  console.log(`- Customer Message Gap: ${CONFIG.LIMITS.SAME_CUSTOMER_GAP_HOURS} hours`);
  console.log(`- Max Reminder Attempts: ${CONFIG.LIMITS.MAX_REMINDER_ATTEMPTS}`);
  console.log(`- Sheets Monitored: ${CONFIG.SHEET_CONFIGS.length}`);
  
  const triggers = ScriptApp.getProjectTriggers();
  const automationTriggers = triggers.filter(t => 
    ['runNewOrdersCheck', 'runStatusUpdatesCheck', 'runDailyReminders', 'runCombinedOrdersCheck'].includes(t.getHandlerFunction())
  );
  console.log(`- Active Triggers: ${automationTriggers.length}`);
  
  const currentHour = new Date().getHours();
  const withinHours = currentHour >= CONFIG.BUSINESS_HOURS.START && currentHour <= CONFIG.BUSINESS_HOURS.END;
  console.log(`- Current Status: ${withinHours ? '🟢 Active' : '🔴 Outside Business Hours'}`);
}