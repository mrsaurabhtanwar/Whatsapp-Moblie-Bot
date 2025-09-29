/**
 * Google Apps Script for RS Tailor & Fabric WhatsApp Bot Integration
 * 
 * This script monitors Google Sheets for changes and triggers webhooks
 * to send automated WhatsApp messages to customers
 * 
 * Version: 2.0.0
 * Last Updated: September 21, 2025
 */

// Configuration Constants - Production Ready
const CONFIG = {
  // Webhook Configuration - NGROK TUNNEL
  // Domain: nelda-refutative-ileana.ngrok-free.app
  // ID: rd_32cihg3Ff6basw4lsseUH2YD4Hr
  // Region: Global
  // Status: Active (Created Sep 13, 2025 6:49 AM)
  // TLS: ngrok managed certificate
  WEBHOOK_URL: 'https://nelda-refutative-ileana.ngrok-free.app/api/webhook/google-sheets',
  WEBHOOK_SECRET: 'c33d03f872fa4ebfca65787161644abf77c8672126c06c1a152940dea869ccea',
  
  // Google Sheets IDs (Production)
  SHEET_ID: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
  FABRIC_SHEET_ID: '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
  COMBINED_SHEET_ID: '199mFt3yz1cZQUGcF84pZgNQoxCpOS2gHxFGDD71CZVg',
  
  // Shop Information
  SHOP_PHONE: '8824781960',
  SHOP_NAME: 'RS Tailor & Fabric',
  BUSINESS_HOURS: '10:00 AM - 7:00 PM',
  
  // Admin Configuration
  ADMIN_PHONE: '7375938371',
  BROTHER_PHONE: '7375938371',
  
  // Operation Settings
  DEBUG_MODE: false, // Set to false for production
  RATE_LIMIT_ENABLED: true,
  MAX_DAILY_MESSAGES: 10,
  MAX_HOURLY_MESSAGES: 3,
  
  // Sheet Names (Exact match with your Google Sheets)
  SHEET_NAMES: {
    TAILOR_ORDERS: 'Tailor Orders',
    FABRIC_ORDERS: 'Fabric Orders', 
    COMBINED_ORDERS: 'Combine Orders'
  }
};

// Sheet column mappings based on your actual Google Sheet structure
const TAILOR_COLUMNS = {
  ORDER_ID: 0,                    // A - Order ID
  CUSTOMER_NAME: 1,               // B - Customer Name  
  CONTACT_NUMBER: 2,              // C - Contact Number
  ADDRESS: 3,                     // D - Address
  CUSTOMER_TYPE: 4,               // E - Customer Type
  GARMENT_TYPES: 5,               // F - Garment Types
  ORDER_DATE: 6,                  // G - Order Date
  DELIVERY_DATE: 7,               // H - Delivery Date
  DELIVERY_STATUS: 8,             // I - Delivery Status
  PRICE: 9,                       // J - Price
  ADVANCE_PAYMENT: 10,            // K - Advance Payment
  REMAINING_AMOUNT: 11,           // L - Remaining Amount
  PAID_TODAY: 12,                 // M - paidToday
  PAYMENT_STATUS: 13,             // N - Payment Status
  FESTIVAL: 14,                   // O - Festival
  NOTES: 15,                      // P - Notes
  CREATED_AT: 16,                 // Q - Created At
  WELCOME_NOTIFIED: 17,           // R - Welcome Notified
  CONFIRMATION_NOTIFIED: 18,      // S - Confirmation Notified
  READY_NOTIFIED: 19,             // T - Ready Notified
  DELIVERY_NOTIFIED: 20,          // U - Delivery Notified
  PICKUP_NOTIFIED: 21,            // V - Pickup Notified
  PAYMENT_NOTIFIED: 22,           // W - Payment Notified
  MASTER_ORDER_ID: 23,            // X - Master Order ID
  READY_NOTIFIED_DATE: 24,        // Y - Ready Notified Date
  PICKUP_REMINDER_COUNT: 25,      // Z - Pickup Reminder Count
  LAST_PICKUP_REMINDER_DATE: 26,  // AA - Last Pickup Reminder Date
  PAYMENT_REMINDER_COUNT: 27,     // AB - Payment Reminder Count
  LAST_PAYMENT_REMINDER_DATE: 28  // AC - Last Payment Reminder Date
};

const FABRIC_COLUMNS = {
  ORDER_ID: 0,                    // A - Order ID
  CUSTOMER_NAME: 1,               // B - Customer Name
  CONTACT_NUMBER: 2,              // C - Contact Number
  ADDRESS: 3,                     // D - Address
  CUSTOMER_TYPE: 4,               // E - Customer Type
  GARMENT_TYPES: 5,               // F - Garment Types (Fabric Type)
  ORDER_DATE: 6,                  // G - Order Date
  DELIVERY_DATE: 7,               // H - Delivery Date
  DELIVERY_STATUS: 8,             // I - Delivery Status
  PRICE: 9,                       // J - Price
  ADVANCE_PAYMENT: 10,            // K - Advance Payment
  REMAINING_AMOUNT: 11,           // L - Remaining Amount
  PAID_TODAY: 12,                 // M - paidToday
  PAYMENT_STATUS: 13,             // N - Payment Status
  FESTIVAL: 14,                   // O - Festival
  NOTES: 15,                      // P - Notes
  CREATED_AT: 16,                 // Q - Created At
  WELCOME_NOTIFIED: 17,           // R - Welcome Notified
  CONFIRMATION_NOTIFIED: 18,      // S - Confirmation Notified
  READY_NOTIFIED: 19,             // T - Ready Notified
  DELIVERY_NOTIFIED: 20,          // U - Delivery Notified
  PICKUP_NOTIFIED: 21,            // V - Pickup Notified
  PAYMENT_NOTIFIED: 22,           // W - Payment Notified
  MASTER_ORDER_ID: 23,            // X - Master Order ID
  READY_NOTIFIED_DATE: 24,        // Y - Ready Notified Date
  PICKUP_REMINDER_COUNT: 25,      // Z - Pickup Reminder Count
  LAST_PICKUP_REMINDER_DATE: 26,  // AA - Last Pickup Reminder Date
  PAYMENT_REMINDER_COUNT: 27,     // AB - Payment Reminder Count
  LAST_PAYMENT_REMINDER_DATE: 28  // AC - Last Payment Reminder Date
};

const COMBINED_COLUMNS = {
  TIMESTAMP: 0,                   // A - Timestamp
  COMBINED_ORDER_ID: 1,           // B - Combined Order ID
  MASTER_ORDER_ID: 2,             // C - Master Order ID
  CUSTOMER_NAME: 3,               // D - Customer Name
  CONTACT_NUMBER: 4,              // E - Contact Number
  ADDRESS: 5,                     // F - Address
  CUSTOMER_TYPE: 6,               // G - Customer Type
  ORDER_DATE: 7,                  // H - Order Date
  FESTIVAL: 8,                    // I - Festival
  NOTES: 9,                       // J - Notes
  FABRIC_ORDER_ID: 10,            // K - Fabric Order ID
  FABRIC_PRICE: 11,               // L - Fabric Price
  TAILORING_ORDER_ID: 12,         // M - Tailoring Order ID
  TAILORING_PRICE: 13,            // N - Tailoring Price
  TOTAL_AMOUNT: 14,               // O - Total Amount
  PAYMENT_STATUS: 15,             // P - Payment Status
  ADVANCE_PARTIAL_PAYMENT: 16,    // Q - Advance/Partial Payment
  REMAINING_AMOUNT: 17,           // R - Remaining Amount
  COMBINED_ORDER_NOTIFIED: 18     // S - Combined Order Notified
};

// Valid order statuses that trigger messages
const ORDER_STATUSES = {
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  PICKUP_REMINDER: 'Pickup Reminder',
  PAYMENT_REMINDER: 'Payment Reminder'
};

// Message types corresponding to your templates
const MESSAGE_TYPES = {
  WELCOME: 'welcome',
  ORDER_CONFIRMATION: 'order_confirmation',
  ORDER_READY: 'order_ready',
  DELIVERY_NOTIFICATION: 'delivery_notification',
  PICKUP_REMINDER: 'pickup_reminder',
  PAYMENT_REMINDER: 'payment_reminder',
  FABRIC_WELCOME: 'fabric_welcome',
  FABRIC_PURCHASE: 'fabric_purchase',
  FABRIC_PAYMENT_REMINDER: 'fabric_payment_reminder',
  COMBINED_ORDER: 'combined_order',
  PICKUP_COMPLETE: 'pickup_complete'
};

/**
 * Main function that runs when the sheet is edited
 * This is the trigger function for onChange events
 */
function onEdit(e) {
  try {
    if (!e || !e.range) {
      console.log('No edit event or range detected');
      return;
    }
    
    const sheet = e.source.getActiveSheet();
    if (!sheet) {
      console.log('No active sheet found');
      return;
    }
    
    const sheetName = sheet.getName();
    const range = e.range;
    const row = range.getRow();
    const column = range.getColumn();
    
    // Validate row and column
    if (!row || !column || row < 1 || column < 1) {
      console.log(`Invalid row (${row}) or column (${column}) values`);
      return;
    }
    
    // Skip header row
    if (row === 1) {
      console.log('Header row edited, skipping...');
      return;
    }
    
    // Only process relevant sheets
    if (!isRelevantSheet(sheetName)) {
      console.log(`Sheet ${sheetName} is not monitored, skipping...`);
      return;
    }
    
    console.log(`Sheet edited: ${sheetName}, Row ${row}, Column ${column}`);
    
    // Get the order data from the edited row based on sheet type
    const orderData = getOrderDataFromRow(sheet, row, sheetName);
    
    if (!orderData || !orderData.phone_number) {
      console.log('Invalid order data or missing phone number');
      return;
    }
    
    // Determine what message to send based on the status change and column edited
    const messageType = determineMessageType(orderData, sheetName, column, e);
    
    if (messageType) {
      console.log(`Triggering ${messageType} message for order ${orderData.order_id} in ${sheetName}`);
      sendWebhookToBot(orderData, messageType, row, sheetName);
    } else {
      console.log('No message trigger needed for this edit');
    }
    
  } catch (error) {
    console.error('Error in onEdit function:', error);
    logError('onEdit', error, e);
  }
}

/**
 * Check if the sheet is one we should monitor
 */
function isRelevantSheet(sheetName) {
  return [CONFIG.SHEET_NAMES.TAILOR_ORDERS, CONFIG.SHEET_NAMES.FABRIC_ORDERS, CONFIG.SHEET_NAMES.COMBINED_ORDERS].includes(sheetName);
}

/**
 * Extract order data from a specific row based on sheet type
 */
function getOrderDataFromRow(sheet, row, sheetName) {
  try {
    // Validate inputs
    if (!sheet || !row || row < 2) {
      console.log('Invalid sheet or row parameters');
      return null;
    }
    
    const maxColumns = sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS ? 19 : 29; // Combined has fewer columns
    const lastColumn = sheet.getLastColumn();
    const actualColumns = Math.min(maxColumns, lastColumn);
    
    console.log(`Getting data from row ${row}, columns 1-${actualColumns}`);
    const values = sheet.getRange(row, 1, 1, actualColumns).getValues()[0];
    
    let orderData = {};
    
    if (sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS) {
      orderData = extractTailorOrderData(values);
    } else if (sheetName === CONFIG.SHEET_NAMES.FABRIC_ORDERS) {
      orderData = extractFabricOrderData(values);
    } else if (sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS) {
      orderData = extractCombinedOrderData(values);
    }
    
    // Add common fields
    orderData.sheet_name = sheetName;
    orderData.shop_phone = CONFIG.SHOP_PHONE;
    orderData.shop_name = CONFIG.SHOP_NAME;
    orderData.pickup_date = formatDate(new Date());
    
    console.log('Extracted order data:', JSON.stringify(orderData, null, 2));
    return orderData;
    
  } catch (error) {
    console.error('Error extracting order data:', error);
    return null;
  }
}

/**
 * Extract data from Tailor Orders sheet
 */
function extractTailorOrderData(values) {
  const data = {
    order_id: values[TAILOR_COLUMNS.ORDER_ID] || '',
    customer_name: values[TAILOR_COLUMNS.CUSTOMER_NAME] || '',
    phone_number: cleanPhoneNumber(values[TAILOR_COLUMNS.CONTACT_NUMBER] || ''),
    address: values[TAILOR_COLUMNS.ADDRESS] || '',
    customer_type: values[TAILOR_COLUMNS.CUSTOMER_TYPE] || '',
    garment_type: values[TAILOR_COLUMNS.GARMENT_TYPES] || '',
    order_date: formatDate(values[TAILOR_COLUMNS.ORDER_DATE]),
    delivery_date: formatDate(values[TAILOR_COLUMNS.DELIVERY_DATE]),
    ready_date: formatDate(values[TAILOR_COLUMNS.DELIVERY_DATE]), // Same as delivery date
    delivery_status: values[TAILOR_COLUMNS.DELIVERY_STATUS] || '',
    total_amount: values[TAILOR_COLUMNS.PRICE] || 0,
    advance_payment: values[TAILOR_COLUMNS.ADVANCE_PAYMENT] || 0,
    remaining_amount: values[TAILOR_COLUMNS.REMAINING_AMOUNT] || 0,
    paid_today: values[TAILOR_COLUMNS.PAID_TODAY] || 0,
    payment_status: values[TAILOR_COLUMNS.PAYMENT_STATUS] || '',
    festival: values[TAILOR_COLUMNS.FESTIVAL] || '',
    notes: values[TAILOR_COLUMNS.NOTES] || '',
    created_at: formatDate(values[TAILOR_COLUMNS.CREATED_AT]),
    
    // Notification tracking
    welcome_notified: values[TAILOR_COLUMNS.WELCOME_NOTIFIED] || false,
    confirmation_notified: values[TAILOR_COLUMNS.CONFIRMATION_NOTIFIED] || false,
    ready_notified: values[TAILOR_COLUMNS.READY_NOTIFIED] || false,
    delivery_notified: values[TAILOR_COLUMNS.DELIVERY_NOTIFIED] || false,
    pickup_notified: values[TAILOR_COLUMNS.PICKUP_NOTIFIED] || false,
    payment_notified: values[TAILOR_COLUMNS.PAYMENT_NOTIFIED] || false,
    
    master_order_id: values[TAILOR_COLUMNS.MASTER_ORDER_ID] || '',
    ready_notified_date: formatDate(values[TAILOR_COLUMNS.READY_NOTIFIED_DATE]),
    pickup_reminder_count: values[TAILOR_COLUMNS.PICKUP_REMINDER_COUNT] || 0,
    last_pickup_reminder_date: formatDate(values[TAILOR_COLUMNS.LAST_PICKUP_REMINDER_DATE]),
    payment_reminder_count: values[TAILOR_COLUMNS.PAYMENT_REMINDER_COUNT] || 0,
    last_payment_reminder_date: formatDate(values[TAILOR_COLUMNS.LAST_PAYMENT_REMINDER_DATE]),
    
    // Additional fields for message templates
    order_type: 'Tailor',
    days_since_ready: calculateDaysSinceReady(values[TAILOR_COLUMNS.DELIVERY_DATE]),
    final_payment: values[TAILOR_COLUMNS.PAID_TODAY] || 0,
    advance_amount: values[TAILOR_COLUMNS.ADVANCE_PAYMENT] || 0,
    outstanding_amount: values[TAILOR_COLUMNS.REMAINING_AMOUNT] || 0
  };
  
  return data;
}

/**
 * Extract data from Fabric Orders sheet
 */
function extractFabricOrderData(values) {
  const data = {
    order_id: values[FABRIC_COLUMNS.ORDER_ID] || '',
    customer_name: values[FABRIC_COLUMNS.CUSTOMER_NAME] || '',
    phone_number: cleanPhoneNumber(values[FABRIC_COLUMNS.CONTACT_NUMBER] || ''),
    address: values[FABRIC_COLUMNS.ADDRESS] || '',
    customer_type: values[FABRIC_COLUMNS.CUSTOMER_TYPE] || '',
    fabric_type: values[FABRIC_COLUMNS.GARMENT_TYPES] || '', // In fabric sheet, this is fabric type
    garment_type: values[FABRIC_COLUMNS.GARMENT_TYPES] || '', // Same field for compatibility
    order_date: formatDate(values[FABRIC_COLUMNS.ORDER_DATE]),
    delivery_date: formatDate(values[FABRIC_COLUMNS.DELIVERY_DATE]),
    ready_date: formatDate(values[FABRIC_COLUMNS.DELIVERY_DATE]),
    delivery_status: values[FABRIC_COLUMNS.DELIVERY_STATUS] || '',
    total_amount: values[FABRIC_COLUMNS.PRICE] || 0,
    fabric_total: values[FABRIC_COLUMNS.PRICE] || 0,
    advance_payment: values[FABRIC_COLUMNS.ADVANCE_PAYMENT] || 0,
    fabric_advance: values[FABRIC_COLUMNS.ADVANCE_PAYMENT] || 0,
    remaining_amount: values[FABRIC_COLUMNS.REMAINING_AMOUNT] || 0,
    fabric_remaining: values[FABRIC_COLUMNS.REMAINING_AMOUNT] || 0,
    paid_today: values[FABRIC_COLUMNS.PAID_TODAY] || 0,
    payment_status: values[FABRIC_COLUMNS.PAYMENT_STATUS] || '',
    festival: values[FABRIC_COLUMNS.FESTIVAL] || '',
    notes: values[FABRIC_COLUMNS.NOTES] || '',
    created_at: formatDate(values[FABRIC_COLUMNS.CREATED_AT]),
    
    // Notification tracking
    welcome_notified: values[FABRIC_COLUMNS.WELCOME_NOTIFIED] || false,
    confirmation_notified: values[FABRIC_COLUMNS.CONFIRMATION_NOTIFIED] || false,
    ready_notified: values[FABRIC_COLUMNS.READY_NOTIFIED] || false,
    delivery_notified: values[FABRIC_COLUMNS.DELIVERY_NOTIFIED] || false,
    pickup_notified: values[FABRIC_COLUMNS.PICKUP_NOTIFIED] || false,
    payment_notified: values[FABRIC_COLUMNS.PAYMENT_NOTIFIED] || false,
    
    master_order_id: values[FABRIC_COLUMNS.MASTER_ORDER_ID] || '',
    ready_notified_date: formatDate(values[FABRIC_COLUMNS.READY_NOTIFIED_DATE]),
    pickup_reminder_count: values[FABRIC_COLUMNS.PICKUP_REMINDER_COUNT] || 0,
    last_pickup_reminder_date: formatDate(values[FABRIC_COLUMNS.LAST_PICKUP_REMINDER_DATE]),
    payment_reminder_count: values[FABRIC_COLUMNS.PAYMENT_REMINDER_COUNT] || 0,
    last_payment_reminder_date: formatDate(values[FABRIC_COLUMNS.LAST_PAYMENT_REMINDER_DATE]),
    
    // Additional fields for message templates
    order_type: 'Fabric',
    fabric_order_id: values[FABRIC_COLUMNS.ORDER_ID] || '',
    fabric_purchase_date: formatDate(values[FABRIC_COLUMNS.ORDER_DATE]),
    days_since_ready: calculateDaysSinceReady(values[FABRIC_COLUMNS.DELIVERY_DATE]),
    final_payment: values[FABRIC_COLUMNS.PAID_TODAY] || 0,
    advance_amount: values[FABRIC_COLUMNS.ADVANCE_PAYMENT] || 0,
    outstanding_amount: values[FABRIC_COLUMNS.REMAINING_AMOUNT] || 0,
    quantity: '1', // Default quantity for fabric
    brand_name: 'Premium' // Default brand name
  };
  
  return data;
}

/**
 * Extract data from Combined Orders sheet
 */
function extractCombinedOrderData(values) {
  const data = {
    order_id: values[COMBINED_COLUMNS.COMBINED_ORDER_ID] || '',
    combined_order_id: values[COMBINED_COLUMNS.COMBINED_ORDER_ID] || '',
    master_order_id: values[COMBINED_COLUMNS.MASTER_ORDER_ID] || '',
    customer_name: values[COMBINED_COLUMNS.CUSTOMER_NAME] || '',
    phone_number: cleanPhoneNumber(values[COMBINED_COLUMNS.CONTACT_NUMBER] || ''),
    address: values[COMBINED_COLUMNS.ADDRESS] || '',
    customer_type: values[COMBINED_COLUMNS.CUSTOMER_TYPE] || '',
    order_date: formatDate(values[COMBINED_COLUMNS.ORDER_DATE]),
    festival: values[COMBINED_COLUMNS.FESTIVAL] || '',
    notes: values[COMBINED_COLUMNS.NOTES] || '',
    
    // Fabric order details
    fabric_order_id: values[COMBINED_COLUMNS.FABRIC_ORDER_ID] || '',
    fabric_price: values[COMBINED_COLUMNS.FABRIC_PRICE] || 0,
    fabric_total: values[COMBINED_COLUMNS.FABRIC_PRICE] || 0,
    
    // Tailoring order details
    tailoring_order_id: values[COMBINED_COLUMNS.TAILORING_ORDER_ID] || '',
    tailor_order_id: values[COMBINED_COLUMNS.TAILORING_ORDER_ID] || '',
    tailoring_price: values[COMBINED_COLUMNS.TAILORING_PRICE] || 0,
    tailor_total: values[COMBINED_COLUMNS.TAILORING_PRICE] || 0,
    
    // Combined totals
    total_amount: values[COMBINED_COLUMNS.TOTAL_AMOUNT] || 0,
    payment_status: values[COMBINED_COLUMNS.PAYMENT_STATUS] || '',
    advance_payment: values[COMBINED_COLUMNS.ADVANCE_PARTIAL_PAYMENT] || 0,
    remaining_amount: values[COMBINED_COLUMNS.REMAINING_AMOUNT] || 0,
    
    // Notification tracking
    combined_order_notified: values[COMBINED_COLUMNS.COMBINED_ORDER_NOTIFIED] || false,
    
    // Additional fields for message templates
    order_type: 'Combined',
    garment_type: 'Fabric + Tailoring',
    fabric_advance: Math.round((values[COMBINED_COLUMNS.ADVANCE_PARTIAL_PAYMENT] || 0) * 0.6), // Assume 60% for fabric
    tailor_advance: Math.round((values[COMBINED_COLUMNS.ADVANCE_PARTIAL_PAYMENT] || 0) * 0.4), // Assume 40% for tailoring
    fabric_remaining: Math.round((values[COMBINED_COLUMNS.REMAINING_AMOUNT] || 0) * 0.6),
    tailor_remaining: Math.round((values[COMBINED_COLUMNS.REMAINING_AMOUNT] || 0) * 0.4),
    fabric_quantity: '1',
    delivery_date: formatDate(values[COMBINED_COLUMNS.ORDER_DATE]), // Use order date as delivery date
    advance_amount: values[COMBINED_COLUMNS.ADVANCE_PARTIAL_PAYMENT] || 0,
    outstanding_amount: values[COMBINED_COLUMNS.REMAINING_AMOUNT] || 0,
    timestamp: formatDate(values[COMBINED_COLUMNS.TIMESTAMP])
  };
  
  return data;
}

/**
 * Determine what type of message to send based on the sheet, column edited, and order data
 */
function determineMessageType(orderData, sheetName, columnEdited, editEvent) {
  const orderType = orderData.order_type.toLowerCase();
  const deliveryStatus = (orderData.delivery_status || '').toLowerCase();
  const paymentStatus = (orderData.payment_status || '').toLowerCase();
  
  // Handle different sheet types and column changes
  if (sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS) {
    return determineTailorMessage(orderData, columnEdited);
  } else if (sheetName === CONFIG.SHEET_NAMES.FABRIC_ORDERS) {
    return determineFabricMessage(orderData, columnEdited);
  } else if (sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS) {
    return determineCombinedMessage(orderData, columnEdited);
  }
  
  return null;
}

/**
 * Determine message type for Tailor Orders
 */
function determineTailorMessage(orderData, columnEdited) {
  const deliveryStatus = (orderData.delivery_status || '').toLowerCase();
  const paymentStatus = (orderData.payment_status || '').toLowerCase();
  const masterOrderId = orderData.master_order_id || '';
  const isCombinedOrder = masterOrderId && masterOrderId !== '0' && masterOrderId.toString().trim() !== '';
  
  console.log(`Tailor Order - Master ID: ${masterOrderId}, Is Combined: ${isCombinedOrder}`);
  
  // IMPORTANT: If this is a combined order (Master Order ID is not empty/zero),
  // DO NOT send individual messages from tailor sheet
  if (isCombinedOrder) {
    console.log('This is a combined order - individual tailor messages will be handled by combined sheet');
    return null; // Combined order messages are handled by the Combined Orders sheet
  }
  
  // Handle individual tailor orders (Master Order ID = 0 or empty)
  if (columnEdited === TAILOR_COLUMNS.WELCOME_NOTIFIED + 1) { // +1 because columns are 1-indexed
    // Only send if column shows "No" and welcome hasn't been sent globally
    if (shouldSendNotification(orderData.welcome_notified) && !hasWelcomeBeenSentToPhone(orderData.phone_number)) {
      return MESSAGE_TYPES.WELCOME;
    }
  }
  
  if (columnEdited === TAILOR_COLUMNS.CONFIRMATION_NOTIFIED + 1) {
    // Only send if column shows "No" (not already confirmed)
    if (shouldSendNotification(orderData.confirmation_notified)) {
      return MESSAGE_TYPES.ORDER_CONFIRMATION;
    }
  }
  
  if (columnEdited === TAILOR_COLUMNS.READY_NOTIFIED + 1) {
    // Only send if column shows "No" and delivery status indicates ready
    if (shouldSendNotification(orderData.ready_notified) && (deliveryStatus.includes('ready') || deliveryStatus.includes('completed'))) {
      return MESSAGE_TYPES.ORDER_READY;
    }
  }
  
  if (columnEdited === TAILOR_COLUMNS.PICKUP_NOTIFIED + 1) {
    // Only send if column shows "No" and delivery status indicates picked/delivered
    if (shouldSendNotification(orderData.pickup_notified) && (deliveryStatus.includes('delivered') || deliveryStatus.includes('picked'))) {
      return MESSAGE_TYPES.PICKUP_COMPLETE;
    }
  }
  
  if (columnEdited === TAILOR_COLUMNS.PAYMENT_NOTIFIED + 1) {
    // Only send if column shows "No" and there's remaining amount
    if (shouldSendNotification(orderData.payment_notified) && orderData.remaining_amount > 0) {
      return MESSAGE_TYPES.PAYMENT_REMINDER;
    }
  }
  
  if (columnEdited === TAILOR_COLUMNS.DELIVERY_NOTIFIED + 1) {
    // Only send if column shows "No" and delivery status indicates delivered
    if (shouldSendNotification(orderData.delivery_notified) && (deliveryStatus.includes('delivered') || deliveryStatus.includes('home delivery'))) {
      return MESSAGE_TYPES.DELIVERY_NOTIFICATION;
    }
  }
  
  // Auto-detect based on status changes (only for individual orders)
  if (columnEdited === TAILOR_COLUMNS.DELIVERY_STATUS + 1) {
    // Auto-trigger ready message if status changed to ready and not notified yet
    if (deliveryStatus.includes('ready') && shouldSendNotification(orderData.ready_notified)) {
      return MESSAGE_TYPES.ORDER_READY;
    }
    // Auto-trigger pickup message if status changed to delivered and not notified yet
    if ((deliveryStatus.includes('delivered') || deliveryStatus.includes('picked')) && shouldSendNotification(orderData.pickup_notified)) {
      return MESSAGE_TYPES.PICKUP_COMPLETE;
    }
    // Auto-trigger delivery notification for home delivery
    if ((deliveryStatus.includes('home delivery') || deliveryStatus.includes('delivered')) && shouldSendNotification(orderData.delivery_notified)) {
      return MESSAGE_TYPES.DELIVERY_NOTIFICATION;
    }
  }
  
  // Check for new individual orders (when order_id is added and no welcome sent globally)
  if (columnEdited === TAILOR_COLUMNS.ORDER_ID + 1 && orderData.order_id && shouldSendNotification(orderData.welcome_notified)) {
    if (!hasWelcomeBeenSentToPhone(orderData.phone_number)) {
      return MESSAGE_TYPES.WELCOME;
    }
  }
  
  return null;
}

/**
 * Determine message type for Fabric Orders
 */
function determineFabricMessage(orderData, columnEdited) {
  const deliveryStatus = (orderData.delivery_status || '').toLowerCase();
  const paymentStatus = (orderData.payment_status || '').toLowerCase();
  const masterOrderId = orderData.master_order_id || '';
  const isCombinedOrder = masterOrderId && masterOrderId !== '0' && masterOrderId.toString().trim() !== '';
  
  console.log(`Fabric Order - Master ID: ${masterOrderId}, Is Combined: ${isCombinedOrder}`);
  
  // IMPORTANT: If this is a combined order (Master Order ID is not empty/zero),
  // DO NOT send individual messages from fabric sheet
  if (isCombinedOrder) {
    console.log('This is a combined order - individual fabric messages will be handled by combined sheet');
    return null; // Combined order messages are handled by the Combined Orders sheet
  }
  
  // Handle individual fabric orders (Master Order ID = 0 or empty)
  if (columnEdited === FABRIC_COLUMNS.WELCOME_NOTIFIED + 1) {
    // Only send if column shows "No" and welcome hasn't been sent globally
    if (shouldSendNotification(orderData.welcome_notified) && !hasWelcomeBeenSentToPhone(orderData.phone_number)) {
      return MESSAGE_TYPES.FABRIC_WELCOME;
    }
  }
  
  if (columnEdited === FABRIC_COLUMNS.CONFIRMATION_NOTIFIED + 1) {
    // Only send if column shows "No" (not already confirmed)
    if (shouldSendNotification(orderData.confirmation_notified)) {
      return MESSAGE_TYPES.FABRIC_PURCHASE;
    }
  }
  
  if (columnEdited === FABRIC_COLUMNS.READY_NOTIFIED + 1) {
    // Only send if column shows "No" and delivery status indicates ready
    if (shouldSendNotification(orderData.ready_notified) && (deliveryStatus.includes('ready') || deliveryStatus.includes('completed'))) {
      return MESSAGE_TYPES.ORDER_READY; // Use general ready message for fabric too
    }
  }
  
  if (columnEdited === FABRIC_COLUMNS.PICKUP_NOTIFIED + 1) {
    // Only send if column shows "No" and delivery status indicates picked/delivered
    if (shouldSendNotification(orderData.pickup_notified) && (deliveryStatus.includes('delivered') || deliveryStatus.includes('picked'))) {
      return MESSAGE_TYPES.PICKUP_COMPLETE;
    }
  }
  
  if (columnEdited === FABRIC_COLUMNS.PAYMENT_NOTIFIED + 1) {
    // Only send if column shows "No" and there's remaining amount
    if (shouldSendNotification(orderData.payment_notified) && orderData.remaining_amount > 0) {
      return MESSAGE_TYPES.FABRIC_PAYMENT_REMINDER;
    }
  }
  
  if (columnEdited === FABRIC_COLUMNS.DELIVERY_NOTIFIED + 1) {
    // Only send if column shows "No" and delivery status indicates delivered
    if (shouldSendNotification(orderData.delivery_notified) && (deliveryStatus.includes('delivered') || deliveryStatus.includes('home delivery'))) {
      return MESSAGE_TYPES.DELIVERY_NOTIFICATION;
    }
  }
  
  // Auto-detect based on status changes (only for individual orders)
  if (columnEdited === FABRIC_COLUMNS.DELIVERY_STATUS + 1) {
    // Auto-trigger ready message if status changed to ready and not notified yet
    if (deliveryStatus.includes('ready') && shouldSendNotification(orderData.ready_notified)) {
      return MESSAGE_TYPES.ORDER_READY;
    }
    // Auto-trigger pickup message if status changed to delivered and not notified yet
    if ((deliveryStatus.includes('delivered') || deliveryStatus.includes('picked')) && shouldSendNotification(orderData.pickup_notified)) {
      return MESSAGE_TYPES.PICKUP_COMPLETE;
    }
    // Auto-trigger delivery notification for home delivery
    if ((deliveryStatus.includes('home delivery') || deliveryStatus.includes('delivered')) && shouldSendNotification(orderData.delivery_notified)) {
      return MESSAGE_TYPES.DELIVERY_NOTIFICATION;
    }
  }
  
  // Check for new individual fabric orders (when order_id is added and no welcome sent globally)
  if (columnEdited === FABRIC_COLUMNS.ORDER_ID + 1 && orderData.order_id && shouldSendNotification(orderData.welcome_notified)) {
    if (!hasWelcomeBeenSentToPhone(orderData.phone_number)) {
      return MESSAGE_TYPES.FABRIC_WELCOME;
    }
  }
  
  return null;
}

/**
 * Determine message type for Combined Orders
 */
function determineCombinedMessage(orderData, columnEdited) {
  const combinedOrderId = orderData.combined_order_id || '';
  const masterOrderId = orderData.master_order_id || '';
  
  console.log(`Combined Order - Combined ID: ${combinedOrderId}, Master ID: ${masterOrderId}`);
  
  // Check if Combined Order Notified column was edited
  if (columnEdited === COMBINED_COLUMNS.COMBINED_ORDER_NOTIFIED + 1) {
    // Only send if column shows "No" and combined order ID exists
    if (shouldSendNotification(orderData.combined_order_notified) && combinedOrderId) {
      console.log('Triggering combined order message from notification column');
      return MESSAGE_TYPES.COMBINED_ORDER;
    }
  }
  
  // Check for new combined orders (when Combined Order ID is added)
  if (columnEdited === COMBINED_COLUMNS.COMBINED_ORDER_ID + 1 && combinedOrderId && shouldSendNotification(orderData.combined_order_notified)) {
    // Only send combined order if welcome hasn't been sent to this phone number
    if (!hasWelcomeBeenSentToPhone(orderData.phone_number)) {
      console.log('Triggering combined order message from new combined order ID');
      return MESSAGE_TYPES.COMBINED_ORDER;
    } else {
      console.log('Welcome already sent to this phone number, skipping combined order welcome');
      return null;
    }
  }
  
  // Also trigger when Master Order ID is added (fallback)
  if (columnEdited === COMBINED_COLUMNS.MASTER_ORDER_ID + 1 && masterOrderId && combinedOrderId && shouldSendNotification(orderData.combined_order_notified)) {
    // Only send combined order if welcome hasn't been sent to this phone number
    if (!hasWelcomeBeenSentToPhone(orderData.phone_number)) {
      console.log('Triggering combined order message from master order ID');
      return MESSAGE_TYPES.COMBINED_ORDER;
    } else {
      console.log('Welcome already sent to this phone number, skipping combined order welcome');
      return null;
    }
  }
  
  return null;
}

/**
 * Send webhook to the bot with order data
 */
function sendWebhookToBot(orderData, messageType, row, sheetName) {
  try {
    const payload = {
      event: 'order_update',
      timestamp: new Date().toISOString(),
      sheet_name: sheetName,
      sheet_row: row,
      message_type: messageType,
      order_data: orderData,
      source: 'google_apps_script',
      version: '2.0.0'
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET,
        'User-Agent': 'GoogleAppsScript/RS-Tailor-Bot',
        'X-Sheet-Name': sheetName,
        'X-Message-Type': messageType,
        'ngrok-skip-browser-warning': 'true'  // Skip ngrok browser warning
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    };
    
    console.log('Sending webhook payload:', JSON.stringify(payload, null, 2));
    
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    console.log(`Webhook response: ${responseCode} - ${responseText}`);
    
    if (responseCode === 200) {
      // Update the sheet with successful webhook delivery
      updateSheetWithWebhookStatus(row, sheetName, messageType, 'SUCCESS', responseText);
      
      // Update specific notification column to "Yes" after successful delivery
      updateNotificationColumn(sheetName, row, messageType);
      
      // Special handling for welcome messages - mark as sent across all sheets
      const isWelcomeMessage = messageType === MESSAGE_TYPES.WELCOME || 
                              messageType === MESSAGE_TYPES.FABRIC_WELCOME || 
                              messageType === MESSAGE_TYPES.COMBINED_ORDER;
      
      if (isWelcomeMessage && orderData.phone_number) {
        markWelcomeAsSentForPhone(orderData.phone_number, sheetName, row);
      }
      
      // Special handling for combined orders - update all three sheets
      if (messageType === MESSAGE_TYPES.COMBINED_ORDER && sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS) {
        markCombinedOrderAsNotified(orderData);
      }
      
      console.log('Webhook sent successfully');
    } else {
      // Log the error but don't throw to avoid breaking the sheet
      console.error(`Webhook failed with status ${responseCode}: ${responseText}`);
      updateSheetWithWebhookStatus(row, sheetName, messageType, 'FAILED', `${responseCode}: ${responseText}`);
    }
    
  } catch (error) {
    console.error('Error sending webhook:', error);
    updateSheetWithWebhookStatus(row, sheetName, messageType, 'ERROR', error.toString());
    logError('sendWebhookToBot', error, { orderData, messageType, row, sheetName });
  }
}

/**
 * Update the sheet with webhook delivery status
 */
function updateSheetWithWebhookStatus(row, sheetName, messageType, status, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    const timestamp = new Date().toISOString();
    
    // Update notification flags based on message type and sheet
    if (sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS || sheetName === CONFIG.SHEET_NAMES.FABRIC_ORDERS) {
      updateNotificationFlags(sheet, row, messageType, sheetName);
    } else if (sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS) {
      // Update combined order notification flag
      if (messageType === MESSAGE_TYPES.COMBINED_ORDER) {
        sheet.getRange(row, COMBINED_COLUMNS.COMBINED_ORDER_NOTIFIED + 1).setValue(true);
      }
    }
    
    // Add webhook status to notes or create a log entry
    const currentNotes = sheet.getRange(row, getNoteColumn(sheetName) + 1).getValue() || '';
    const webhookLog = `\n[${timestamp}] ${messageType}: ${status}`;
    const updatedNotes = currentNotes + webhookLog;
    
    // Limit notes length to prevent overflow
    if (updatedNotes.length < 1000) {
      sheet.getRange(row, getNoteColumn(sheetName) + 1).setValue(updatedNotes);
    }
    
    console.log(`Updated ${sheetName} row ${row} with webhook status: ${status}`);
    
  } catch (error) {
    console.error('Error updating sheet with webhook status:', error);
  }
}

/**
 * Update notification flags based on message type
 */
function updateNotificationFlags(sheet, row, messageType, sheetName) {
  const columnMap = sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS ? TAILOR_COLUMNS : FABRIC_COLUMNS;
  const timestamp = new Date().toISOString();
  
  switch (messageType) {
    case MESSAGE_TYPES.WELCOME:
    case MESSAGE_TYPES.FABRIC_WELCOME:
      sheet.getRange(row, columnMap.WELCOME_NOTIFIED + 1).setValue(true);
      break;
      
    case MESSAGE_TYPES.ORDER_CONFIRMATION:
    case MESSAGE_TYPES.FABRIC_PURCHASE:
      sheet.getRange(row, columnMap.CONFIRMATION_NOTIFIED + 1).setValue(true);
      break;
      
    case MESSAGE_TYPES.ORDER_READY:
      sheet.getRange(row, columnMap.READY_NOTIFIED + 1).setValue(true);
      sheet.getRange(row, columnMap.READY_NOTIFIED_DATE + 1).setValue(timestamp);
      break;
      
    case MESSAGE_TYPES.PICKUP_COMPLETE:
    case MESSAGE_TYPES.DELIVERY_NOTIFICATION:
      sheet.getRange(row, columnMap.PICKUP_NOTIFIED + 1).setValue(true);
      break;
      
    case MESSAGE_TYPES.PAYMENT_REMINDER:
    case MESSAGE_TYPES.FABRIC_PAYMENT_REMINDER:
      sheet.getRange(row, columnMap.PAYMENT_NOTIFIED + 1).setValue(true);
      // Increment payment reminder count
      const currentPaymentCount = sheet.getRange(row, columnMap.PAYMENT_REMINDER_COUNT + 1).getValue() || 0;
      sheet.getRange(row, columnMap.PAYMENT_REMINDER_COUNT + 1).setValue(currentPaymentCount + 1);
      sheet.getRange(row, columnMap.LAST_PAYMENT_REMINDER_DATE + 1).setValue(timestamp);
      break;
      
    case MESSAGE_TYPES.PICKUP_REMINDER:
      // Increment pickup reminder count
      const currentPickupCount = sheet.getRange(row, columnMap.PICKUP_REMINDER_COUNT + 1).getValue() || 0;
      sheet.getRange(row, columnMap.PICKUP_REMINDER_COUNT + 1).setValue(currentPickupCount + 1);
      sheet.getRange(row, columnMap.LAST_PICKUP_REMINDER_DATE + 1).setValue(timestamp);
      break;
  }
}

/**
 * Get the notes column index for different sheet types
 */
function getNoteColumn(sheetName) {
  if (sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS) {
    return TAILOR_COLUMNS.NOTES;
  } else if (sheetName === CONFIG.SHEET_NAMES.FABRIC_ORDERS) {
    return FABRIC_COLUMNS.NOTES;
  } else if (sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS) {
    return COMBINED_COLUMNS.NOTES;
  }
  return 0;
}

/**
 * Helper function to check if a notification value is "Yes" (already sent)
 * Handles various formats: true, "Yes", "Y", "TRUE", 1
 */
function isNotificationAlreadySent(value) {
  if (!value) return false;
  
  const stringValue = value.toString().toLowerCase().trim();
  return stringValue === 'yes' || 
         stringValue === 'y' || 
         stringValue === 'true' || 
         stringValue === '1' || 
         value === true;
}

/**
 * Helper function to check if a notification should be sent
 * Returns true only if the notification column shows "No" or is empty
 */
function shouldSendNotification(notificationValue) {
  if (!notificationValue) return true; // Empty means not sent yet
  
  const stringValue = notificationValue.toString().toLowerCase().trim();
  return stringValue === 'no' || 
         stringValue === 'n' || 
         stringValue === 'false' || 
         stringValue === '0' || 
         stringValue === '' ||
         notificationValue === false;
}

/**
 * Check if welcome message has already been sent to a phone number across all sheets
 * This prevents duplicate welcome messages from being sent
 */
function hasWelcomeBeenSentToPhone(phoneNumber) {
  if (!phoneNumber) return false;
  
  try {
    const cleanPhone = cleanPhoneNumber(phoneNumber);
    if (!cleanPhone) return false;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Check Tailor Orders sheet
    const tailorSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TAILOR_ORDERS);
    if (tailorSheet) {
      const tailorData = tailorSheet.getDataRange().getValues();
      const tailorHeaderRow = tailorData[0];
      const phoneColumnIndex = tailorHeaderRow.indexOf('Contact Number');
      const welcomeColumnIndex = tailorHeaderRow.indexOf('Welcome Notified');
      
      if (phoneColumnIndex !== -1 && welcomeColumnIndex !== -1) {
        for (let i = 1; i < tailorData.length; i++) {
          const rowPhone = cleanPhoneNumber(tailorData[i][phoneColumnIndex] || '');
          const welcomeNotified = tailorData[i][welcomeColumnIndex];
          if (rowPhone === cleanPhone && welcomeNotified) {
            console.log(`Welcome already sent to ${cleanPhone} from Tailor Orders sheet`);
            return true;
          }
        }
      }
    }
    
    // Check Fabric Orders sheet
    const fabricSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FABRIC_ORDERS);
    if (fabricSheet) {
      const fabricData = fabricSheet.getDataRange().getValues();
      const fabricHeaderRow = fabricData[0];
      const phoneColumnIndex = fabricHeaderRow.indexOf('Contact Number');
      const welcomeColumnIndex = fabricHeaderRow.indexOf('Welcome Notified');
      
      if (phoneColumnIndex !== -1 && welcomeColumnIndex !== -1) {
        for (let i = 1; i < fabricData.length; i++) {
          const rowPhone = cleanPhoneNumber(fabricData[i][phoneColumnIndex] || '');
          const welcomeNotified = fabricData[i][welcomeColumnIndex];
          if (rowPhone === cleanPhone && welcomeNotified) {
            console.log(`Welcome already sent to ${cleanPhone} from Fabric Orders sheet`);
            return true;
          }
        }
      }
    }
    
    // Check Combined Orders sheet
    const combinedSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.COMBINED_ORDERS);
    if (combinedSheet) {
      const combinedData = combinedSheet.getDataRange().getValues();
      const combinedHeaderRow = combinedData[0];
      const phoneColumnIndex = combinedHeaderRow.indexOf('Contact Number');
      const welcomeColumnIndex = combinedHeaderRow.indexOf('Combined Order Notified');
      
      if (phoneColumnIndex !== -1 && welcomeColumnIndex !== -1) {
        for (let i = 1; i < combinedData.length; i++) {
          const rowPhone = cleanPhoneNumber(combinedData[i][phoneColumnIndex] || '');
          const welcomeNotified = combinedData[i][welcomeColumnIndex];
          if (rowPhone === cleanPhone && welcomeNotified) {
            console.log(`Welcome already sent to ${cleanPhone} from Combined Orders sheet`);
            return true;
          }
        }
      }
    }
    
    console.log(`No welcome message found for ${cleanPhone} across all sheets`);
    return false;
    
  } catch (error) {
    console.error('Error checking welcome status:', error);
    return false; // If there's an error, allow the welcome message to be sent
  }
}

/**
 * Mark welcome as sent across all relevant sheets for a phone number
 * This ensures welcome is only sent once per customer across all order types
 */
function markWelcomeAsSentForPhone(phoneNumber, currentSheetName, currentRow) {
  if (!phoneNumber) return;
  
  try {
    const cleanPhone = cleanPhoneNumber(phoneNumber);
    if (!cleanPhone) return;
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Mark welcome as sent in the current sheet first
    const currentSheet = ss.getSheetByName(currentSheetName);
    if (currentSheet && currentRow) {
      const headers = currentSheet.getRange(1, 1, 1, currentSheet.getLastColumn()).getValues()[0];
      const welcomeColumnIndex = headers.indexOf('Welcome Notified');
      
      if (welcomeColumnIndex !== -1) {
        currentSheet.getRange(currentRow, welcomeColumnIndex + 1).setValue(true);
        console.log(`Marked welcome as sent in ${currentSheetName} for ${cleanPhone}`);
      }
    }
    
    // Also mark welcome in other sheets where the same phone number exists (but hasn't been notified yet)
    const sheetConfigs = [
      { name: CONFIG.SHEET_NAMES.TAILOR_ORDERS, welcomeColumn: 'Welcome Notified' },
      { name: CONFIG.SHEET_NAMES.FABRIC_ORDERS, welcomeColumn: 'Welcome Notified' },
      { name: CONFIG.SHEET_NAMES.COMBINED_ORDERS, welcomeColumn: 'Combined Order Notified' }
    ];
    
    sheetConfigs.forEach(config => {
      if (config.name === currentSheetName) return; // Skip current sheet, already handled
      
      const sheet = ss.getSheetByName(config.name);
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const headerRow = data[0];
      const phoneColumnIndex = headerRow.indexOf('Contact Number');
      const welcomeColumnIndex = headerRow.indexOf(config.welcomeColumn);
      
      if (phoneColumnIndex !== -1 && welcomeColumnIndex !== -1) {
        for (let i = 1; i < data.length; i++) {
          const rowPhone = cleanPhoneNumber(data[i][phoneColumnIndex] || '');
          const welcomeNotified = data[i][welcomeColumnIndex];
          
          if (rowPhone === cleanPhone && !welcomeNotified) {
            sheet.getRange(i + 1, welcomeColumnIndex + 1).setValue(true);
            console.log(`Auto-marked welcome as sent in ${config.name} for ${cleanPhone}`);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error marking welcome as sent:', error);
  }
}

/**
 * Update specific notification column to "Yes" after successful message delivery
 */
function updateNotificationColumn(sheetName, row, messageType) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet || !row || row < 2) return; // Skip if invalid parameters
    
    let columnIndex = -1;
    
    // Determine which column to update based on message type and sheet
    if (sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS) {
      switch (messageType) {
        case MESSAGE_TYPES.WELCOME:
          columnIndex = TAILOR_COLUMNS.WELCOME_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.ORDER_CONFIRMATION:
          columnIndex = TAILOR_COLUMNS.CONFIRMATION_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.ORDER_READY:
          columnIndex = TAILOR_COLUMNS.READY_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.PICKUP_COMPLETE:
          columnIndex = TAILOR_COLUMNS.PICKUP_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.DELIVERY_NOTIFICATION:
          columnIndex = TAILOR_COLUMNS.DELIVERY_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.PAYMENT_REMINDER:
          columnIndex = TAILOR_COLUMNS.PAYMENT_NOTIFIED + 1;
          break;
      }
    } else if (sheetName === CONFIG.SHEET_NAMES.FABRIC_ORDERS) {
      switch (messageType) {
        case MESSAGE_TYPES.FABRIC_WELCOME:
          columnIndex = FABRIC_COLUMNS.WELCOME_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.FABRIC_PURCHASE:
          columnIndex = FABRIC_COLUMNS.CONFIRMATION_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.ORDER_READY:
          columnIndex = FABRIC_COLUMNS.READY_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.PICKUP_COMPLETE:
          columnIndex = FABRIC_COLUMNS.PICKUP_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.FABRIC_PAYMENT_REMINDER:
          columnIndex = FABRIC_COLUMNS.PAYMENT_NOTIFIED + 1;
          break;
        case MESSAGE_TYPES.DELIVERY_NOTIFICATION:
          columnIndex = FABRIC_COLUMNS.DELIVERY_NOTIFIED + 1;
          break;
      }
    } else if (sheetName === CONFIG.SHEET_NAMES.COMBINED_ORDERS) {
      switch (messageType) {
        case MESSAGE_TYPES.COMBINED_ORDER:
          columnIndex = COMBINED_COLUMNS.COMBINED_ORDER_NOTIFIED + 1;
          break;
      }
    }
    
    if (columnIndex > 0) {
      sheet.getRange(row, columnIndex).setValue('Yes');
      console.log(`Updated ${sheetName} row ${row} column ${columnIndex} to 'Yes' for ${messageType}`);
    } else {
      console.warn(`Could not determine column for ${messageType} in ${sheetName}`);
    }
    
  } catch (error) {
    console.error('Error updating notification column:', error);
  }
}

/**
 * Mark combined order as notified across all three sheets
 * This function updates the confirmation flags in Tailor Orders, Fabric Orders, and Combined Orders
 */
function markCombinedOrderAsNotified(orderData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterOrderId = orderData.master_order_id || '';
    const fabricOrderId = orderData.fabric_order_id || '';
    const tailoringOrderId = orderData.tailoring_order_id || '';
    
    console.log(`Marking combined order as notified - Master ID: ${masterOrderId}, Fabric ID: ${fabricOrderId}, Tailor ID: ${tailoringOrderId}`);
    
    if (!masterOrderId) {
      console.log('No Master Order ID found, cannot update related orders');
      return;
    }
    
    // Update Tailor Orders sheet
    if (tailoringOrderId) {
      const tailorSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TAILOR_ORDERS);
      const tailorRow = findOrderRowByOrderId(tailorSheet, tailoringOrderId, TAILOR_COLUMNS.ORDER_ID);
      
      if (tailorRow > 0) {
        console.log(`Updating Tailor Orders row ${tailorRow} for order ${tailoringOrderId}`);
        tailorSheet.getRange(tailorRow, TAILOR_COLUMNS.CONFIRMATION_NOTIFIED + 1).setValue(true);
        tailorSheet.getRange(tailorRow, TAILOR_COLUMNS.WELCOME_NOTIFIED + 1).setValue(true);
        
        // Add note about combined order
        const currentNotes = tailorSheet.getRange(tailorRow, TAILOR_COLUMNS.NOTES + 1).getValue() || '';
        const combinedNote = `\n[Combined Order Confirmed: ${new Date().toISOString()}]`;
        tailorSheet.getRange(tailorRow, TAILOR_COLUMNS.NOTES + 1).setValue(currentNotes + combinedNote);
      } else {
        console.log(`Tailor order ${tailoringOrderId} not found in Tailor Orders sheet`);
      }
    }
    
    // Update Fabric Orders sheet
    if (fabricOrderId) {
      const fabricSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FABRIC_ORDERS);
      const fabricRow = findOrderRowByOrderId(fabricSheet, fabricOrderId, FABRIC_COLUMNS.ORDER_ID);
      
      if (fabricRow > 0) {
        console.log(`Updating Fabric Orders row ${fabricRow} for order ${fabricOrderId}`);
        fabricSheet.getRange(fabricRow, FABRIC_COLUMNS.CONFIRMATION_NOTIFIED + 1).setValue(true);
        fabricSheet.getRange(fabricRow, FABRIC_COLUMNS.WELCOME_NOTIFIED + 1).setValue(true);
        
        // Add note about combined order
        const currentNotes = fabricSheet.getRange(fabricRow, FABRIC_COLUMNS.NOTES + 1).getValue() || '';
        const combinedNote = `\n[Combined Order Confirmed: ${new Date().toISOString()}]`;
        fabricSheet.getRange(fabricRow, FABRIC_COLUMNS.NOTES + 1).setValue(currentNotes + combinedNote);
      } else {
        console.log(`Fabric order ${fabricOrderId} not found in Fabric Orders sheet`);
      }
    }
    
    console.log('Successfully marked combined order as notified across all sheets');
    
  } catch (error) {
    console.error('Error marking combined order as notified:', error);
    logError('markCombinedOrderAsNotified', error, orderData);
  }
}

/**
 * Find the row number of an order by its Order ID in a specific sheet
 */
function findOrderRowByOrderId(sheet, orderId, orderIdColumn) {
  try {
    if (!orderId || !sheet) {
      return -1;
    }
    
    const lastRow = sheet.getLastRow();
    const orderIdColumnIndex = orderIdColumn + 1; // Convert to 1-indexed
    
    // Search through all rows to find the matching Order ID
    for (let row = 2; row <= lastRow; row++) { // Start from row 2 (skip header)
      const cellValue = sheet.getRange(row, orderIdColumnIndex).getValue();
      if (cellValue && cellValue.toString().trim() === orderId.toString().trim()) {
        console.log(`Found order ${orderId} in row ${row}`);
        return row;
      }
    }
    
    console.log(`Order ${orderId} not found in sheet`);
    return -1;
    
  } catch (error) {
    console.error(`Error finding order ${orderId}:`, error);
    return -1;
  }
}

/**
 * Utility Functions
 */

// Convert column letter to index (A=0, B=1, etc.)
function columnToIndex(columnLetter) {
  return columnLetter.charCodeAt(0) - 65;
}

// Clean and format phone number
function cleanPhoneNumber(phone) {
  if (!phone) return '';
  
  // Remove all non-digits
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // Add country code if missing (assuming India +91)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  
  return cleaned;
}

// Format date for display
function formatDate(date) {
  if (!date) return '';
  
  if (typeof date === 'string') return date;
  
  try {
    return new Date(date).toLocaleDateString('en-IN');
  } catch (error) {
    return date.toString();
  }
}

// Calculate days since ready
function calculateDaysSinceReady(readyDate) {
  if (!readyDate) return 0;
  
  try {
    const ready = new Date(readyDate);
    const now = new Date();
    const diffTime = Math.abs(now - ready);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    return 0;
  }
}

// Log errors to a separate sheet or console
function logError(functionName, error, context) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    function: functionName,
    error: error.toString(),
    context: JSON.stringify(context),
    stack: error.stack || 'No stack trace'
  };
  
  console.error('ERROR LOG:', JSON.stringify(errorLog, null, 2));
  
  // Optionally, you can create an "Errors" sheet to log these
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let errorSheet = ss.getSheetByName('Errors');
    
    if (!errorSheet) {
      errorSheet = ss.insertSheet('Errors');
      errorSheet.getRange(1, 1, 1, 5).setValues([['Timestamp', 'Function', 'Error', 'Context', 'Stack']]);
    }
    
    errorSheet.appendRow([errorLog.timestamp, errorLog.function, errorLog.error, errorLog.context, errorLog.stack]);
  } catch (logError) {
    console.error('Failed to log error to sheet:', logError);
  }
}

/**
 * Manual Testing Functions
 */

// Test function to manually trigger a webhook
function testWebhook() {
  const testOrderData = {
    order_id: 'TEST001',
    customer_name: 'Test Customer',
    phone_number: '917375938371',
    order_type: 'Tailor',
    status: 'Confirmed',
    garment_type: 'Shirt',
    total_amount: 500,
    advance_payment: 200,
    remaining_amount: 300,
    order_date: new Date().toLocaleDateString('en-IN'),
    notes: 'Test order',
    shop_phone: CONFIG.SHOP_PHONE,
    shop_name: CONFIG.SHOP_NAME
  };
  
  sendWebhookToBot(testOrderData, MESSAGE_TYPES.ORDER_CONFIRMATION, 999);
}

// Function to setup triggers (run this once to set up automatic triggers)
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new onChange trigger
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.newTrigger('onEdit')
    .timeBased()
    .everyMinutes(1)  // Check every minute for changes
    .create();
    
  console.log('Triggers set up successfully');
}

// Test function to debug sheet data extraction
function testSheetDataExtraction() {
  try {
    console.log('🧪 Testing sheet data extraction...');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetNames = [CONFIG.SHEET_NAMES.TAILOR_ORDERS, CONFIG.SHEET_NAMES.FABRIC_ORDERS, CONFIG.SHEET_NAMES.COMBINED_ORDERS];
    
    sheetNames.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();
        console.log(`📊 ${sheetName}: Last row: ${lastRow}, Last column: ${lastColumn}`);
        
        if (lastRow > 1) {
          // Test data extraction from first data row
          const testRow = 2;
          console.log(`🔍 Testing data extraction from row ${testRow} in ${sheetName}`);
          const orderData = getOrderDataFromRow(sheet, testRow, sheetName);
          if (orderData) {
            console.log(`✅ Successfully extracted data for ${orderData.customer_name || 'Unknown'}`);
          } else {
            console.log(`❌ Failed to extract data from row ${testRow}`);
          }
        }
      } else {
        console.log(`❌ Sheet '${sheetName}' not found`);
      }
    });
    
    console.log('🧪 Sheet data extraction test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Function to check webhook connectivity
function testWebhookConnectivity() {
  try {
    const testPayload = {
      event: 'connectivity_test',
      timestamp: new Date().toISOString(),
      message: 'Testing webhook connectivity from Google Apps Script'
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': CONFIG.WEBHOOK_SECRET,
        'ngrok-skip-browser-warning': 'true'  // Skip ngrok browser warning
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(testPayload)
    };
    
    const response = UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
    console.log(`Connectivity test result: ${response.getResponseCode()} - ${response.getContentText()}`);
    
    return response.getResponseCode() === 200;
  } catch (error) {
    console.error('Webhook connectivity test failed:', error);
    return false;
  }
}

/**
 * Initialization and Setup
 */

// Run this function once to initialize the script
function initialize() {
  console.log('Initializing Google Apps Script for RS Tailor & Fabric Bot');
  console.log('Configuration:', JSON.stringify(CONFIG, null, 2));
  
  // Test webhook connectivity
  const isConnected = testWebhookConnectivity();
  console.log('Webhook connectivity:', isConnected ? 'SUCCESS' : 'FAILED');
  
  // Setup triggers
  setupTriggers();
  
  console.log('Initialization complete');
}

// Helper function to get current configuration
function getConfig() {
  console.log('Current configuration:', JSON.stringify(CONFIG, null, 2));
  return CONFIG;
}

/**
 * Manual trigger functions for different message types
 * Use these for testing specific scenarios
 */

function triggerWelcomeMessage(row, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  const orderData = getOrderDataFromRow(sheet, row, sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  if (orderData) {
    const messageType = sheetName === CONFIG.SHEET_NAMES.FABRIC_ORDERS ? MESSAGE_TYPES.FABRIC_WELCOME : MESSAGE_TYPES.WELCOME;
    sendWebhookToBot(orderData, messageType, row, sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  }
}

function triggerOrderReadyMessage(row, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  const orderData = getOrderDataFromRow(sheet, row, sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  if (orderData) {
    sendWebhookToBot(orderData, MESSAGE_TYPES.ORDER_READY, row, sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  }
}

function triggerPickupReminder(row, sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  const orderData = getOrderDataFromRow(sheet, row, sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  if (orderData) {
    sendWebhookToBot(orderData, MESSAGE_TYPES.PICKUP_REMINDER, row, sheetName || CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  }
}

function triggerCombinedOrderMessage(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.COMBINED_ORDERS);
  const orderData = getOrderDataFromRow(sheet, row, CONFIG.SHEET_NAMES.COMBINED_ORDERS);
  if (orderData) {
    sendWebhookToBot(orderData, MESSAGE_TYPES.COMBINED_ORDER, row, CONFIG.SHEET_NAMES.COMBINED_ORDERS);
  }
}

function triggerFabricPurchaseMessage(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FABRIC_ORDERS);
  const orderData = getOrderDataFromRow(sheet, row, CONFIG.SHEET_NAMES.FABRIC_ORDERS);
  if (orderData) {
    sendWebhookToBot(orderData, MESSAGE_TYPES.FABRIC_PURCHASE, row, CONFIG.SHEET_NAMES.FABRIC_ORDERS);
  }
}

// Batch processing functions for multiple rows
function processAllReadyOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Process Tailor Orders (only individual orders, not combined)
  const tailorSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  processReadyOrdersInSheet(tailorSheet, CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  
  // Process Fabric Orders (only individual orders, not combined)
  const fabricSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FABRIC_ORDERS);
  processReadyOrdersInSheet(fabricSheet, CONFIG.SHEET_NAMES.FABRIC_ORDERS);
}

function processReadyOrdersInSheet(sheet, sheetName) {
  const lastRow = sheet.getLastRow();
  const statusColumn = sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS ? TAILOR_COLUMNS.DELIVERY_STATUS : FABRIC_COLUMNS.DELIVERY_STATUS;
  const readyNotifiedColumn = sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS ? TAILOR_COLUMNS.READY_NOTIFIED : FABRIC_COLUMNS.READY_NOTIFIED;
  const masterOrderIdColumn = sheetName === CONFIG.SHEET_NAMES.TAILOR_ORDERS ? TAILOR_COLUMNS.MASTER_ORDER_ID : FABRIC_COLUMNS.MASTER_ORDER_ID;
  
  for (let row = 2; row <= lastRow; row++) { // Start from row 2 (skip header)
    const status = sheet.getRange(row, statusColumn + 1).getValue().toString().toLowerCase();
    const readyNotified = sheet.getRange(row, readyNotifiedColumn + 1).getValue();
    const masterOrderId = sheet.getRange(row, masterOrderIdColumn + 1).getValue() || '';
    
    // Only process individual orders (Master Order ID = 0 or empty)
    const isCombinedOrder = masterOrderId && masterOrderId !== '0' && masterOrderId.toString().trim() !== '';
    
    if ((status.includes('ready') || status.includes('completed')) && !readyNotified && !isCombinedOrder) {
      const orderData = getOrderDataFromRow(sheet, row, sheetName);
      if (orderData && orderData.phone_number) {
        console.log(`Processing ready individual order: ${orderData.order_id} in ${sheetName}`);
        sendWebhookToBot(orderData, MESSAGE_TYPES.ORDER_READY, row, sheetName);
        Utilities.sleep(1000); // Wait 1 second between messages
      }
    } else if (isCombinedOrder) {
      console.log(`Skipping combined order ${orderData?.order_id || 'unknown'} - will be handled by Combined Orders sheet`);
    }
  }
}

/**
 * Process all pending combined orders
 */
function processAllPendingCombinedOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const combinedSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.COMBINED_ORDERS);
  const lastRow = combinedSheet.getLastRow();
  
  console.log(`Processing combined orders from sheet with ${lastRow} rows`);
  
  for (let row = 2; row <= lastRow; row++) { // Start from row 2 (skip header)
    const combinedOrderNotified = combinedSheet.getRange(row, COMBINED_COLUMNS.COMBINED_ORDER_NOTIFIED + 1).getValue();
    const combinedOrderId = combinedSheet.getRange(row, COMBINED_COLUMNS.COMBINED_ORDER_ID + 1).getValue();
    
    if (combinedOrderId && !combinedOrderNotified) {
      const orderData = getOrderDataFromRow(combinedSheet, row, CONFIG.SHEET_NAMES.COMBINED_ORDERS);
      if (orderData && orderData.phone_number) {
        console.log(`Processing pending combined order: ${orderData.combined_order_id}`);
        sendWebhookToBot(orderData, MESSAGE_TYPES.COMBINED_ORDER, row, CONFIG.SHEET_NAMES.COMBINED_ORDERS);
        Utilities.sleep(1000); // Wait 1 second between messages
      }
    }
  }
}

/**
 * Helper function to check order relationships and Master Order IDs
 */
function debugOrderRelationships() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  console.log('=== DEBUGGING ORDER RELATIONSHIPS ===');
  
  // Check Combined Orders
  const combinedSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.COMBINED_ORDERS);
  const combinedLastRow = combinedSheet.getLastRow();
  
  console.log('\n--- Combined Orders ---');
  for (let row = 2; row <= combinedLastRow; row++) {
    const combinedOrderId = combinedSheet.getRange(row, COMBINED_COLUMNS.COMBINED_ORDER_ID + 1).getValue();
    const masterOrderId = combinedSheet.getRange(row, COMBINED_COLUMNS.MASTER_ORDER_ID + 1).getValue();
    const fabricOrderId = combinedSheet.getRange(row, COMBINED_COLUMNS.FABRIC_ORDER_ID + 1).getValue();
    const tailoringOrderId = combinedSheet.getRange(row, COMBINED_COLUMNS.TAILORING_ORDER_ID + 1).getValue();
    const customerName = combinedSheet.getRange(row, COMBINED_COLUMNS.CUSTOMER_NAME + 1).getValue();
    const notified = combinedSheet.getRange(row, COMBINED_COLUMNS.COMBINED_ORDER_NOTIFIED + 1).getValue();
    
    console.log(`Row ${row}: Combined: ${combinedOrderId}, Master: ${masterOrderId}, Fabric: ${fabricOrderId}, Tailor: ${tailoringOrderId}, Customer: ${customerName}, Notified: ${notified}`);
  }
  
  // Check Tailor Orders
  const tailorSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TAILOR_ORDERS);
  const tailorLastRow = tailorSheet.getLastRow();
  
  console.log('\n--- Tailor Orders ---');
  for (let row = 2; row <= Math.min(tailorLastRow, 10); row++) { // Limit to first 10 for debugging
    const orderId = tailorSheet.getRange(row, TAILOR_COLUMNS.ORDER_ID + 1).getValue();
    const masterOrderId = tailorSheet.getRange(row, TAILOR_COLUMNS.MASTER_ORDER_ID + 1).getValue();
    const customerName = tailorSheet.getRange(row, TAILOR_COLUMNS.CUSTOMER_NAME + 1).getValue();
    const confirmationNotified = tailorSheet.getRange(row, TAILOR_COLUMNS.CONFIRMATION_NOTIFIED + 1).getValue();
    
    const isCombined = masterOrderId && masterOrderId !== '0' && masterOrderId.toString().trim() !== '';
    console.log(`Row ${row}: Order: ${orderId}, Master: ${masterOrderId}, Customer: ${customerName}, Combined: ${isCombined}, Confirmed: ${confirmationNotified}`);
  }
  
  console.log('\n=== END DEBUG ===');
}

console.log('RS Tailor & Fabric Google Apps Script loaded successfully');
