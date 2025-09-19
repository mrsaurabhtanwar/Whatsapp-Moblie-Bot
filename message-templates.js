const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Optimized Message Templates - Hindi Only
 * 
 * Features:
 * - Custom Hindi templates only (English removed)
 * - Modular template structure
 * - Dynamic template selection
 * - Template caching for performance
 * - Easy customization
 */
class MessageTemplates {
    constructor() {
        this.templates = {
            // Core Order Templates
            welcome: this.getWelcomeTemplate(),
            order_confirmation: this.getOrderConfirmationTemplate(),
            order_ready: this.getOrderReadyTemplate(),
            delivery_notification: this.getDeliveryNotificationTemplate(),
            
            // Reminder Templates
            pickup_reminder: this.getPickupReminderTemplate(),
            payment_reminder: this.getPaymentReminderTemplate(),
            
            // Fabric Templates
            fabric_welcome: this.getFabricWelcomeTemplate(),
            fabric_purchase: this.getFabricPurchaseTemplate(),
            fabric_payment_reminder: this.getFabricPaymentReminderTemplate(),
            
            // Combined Templates
            combined_order: this.getCombinedOrderTemplate(),
            
            // Special Templates
            pickup_complete: this.getPickupCompleteTemplate(),
            worker_daily_data: this.getWorkerDailyDataTemplate()
        };
        
        // Template cache for performance
        this.templateCache = new Map();
        
        console.log('✅ Optimized Message Templates initialized (Hindi only)');
        console.log(`📝 Loaded ${Object.keys(this.templates).length} template types`);
    }

    // Core Order Templates
    getWelcomeTemplate() {
        return `🙏{shop_name} में आपका स्वागत है ! आपका दिन शुभ हो !🙏

नमस्ते *{customer_name}* जी! 👋

हमारे साथ जुड़ने के लिए thank you!
आपकी हर जरूरत पूरी करने के लिए हम तैयार हैं! ✨

🏪 Shop Information:
- Timings: {business_hours}
- 7 days open
- Contact: {shop_phone}
- WhatsApp updates automatic मिलते रहेंगे !

📱 हमारी Service:
- Order status updates
- Ready होने पर instant notification
- Payment reminders
- New collection alerts
- Festival/Wedding Offers 🫴 

आपका विश्वास ही हमारी सफलता है! 🙏

💫 Best quality, Best Service - guaranteed!

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getOrderConfirmationTemplate() {
        return `✅ Order Confirm हो गया! ✅

Hello *{customer_name}* जी 👋

आपका order confirm है और हमने काम शुरू कर दिया है! 🎯

📋 Order की Details:
- Order ID: {order_id}
- Item: {garment_type} 👔
- Order Date: {order_date}

💰 Amount Details:
- Total: ₹{total_amount}
- Advance मिला: ₹{advance_amount} ✅
- बाकी Amount: ₹{remaining_amount}

🔔 जैसे ही ready होगा, आपको message भेज देंगे !
🏪 Shop timing: {business_hours}

हमारी दुकान पर आने के लिए धन्यवाद !🙏

{shop_name} 😊
Phone: {shop_phone}

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getOrderReadyTemplate() {
        return `🎉 आपका Order तैयार है ! 🎉

नमस्ते *{customer_name}* जी 🙏

आपका {garment_type} बिल्कुल ready है ! ✨
📋 Order ID: {order_id}
📅 तैयार हुआ: {ready_date}

💰 Payment Details:
- कुल Amount: ₹{total_amount}
- Advance जमा: ₹{advance_amount}
- बाकी Amount: ₹{remaining_amount}

🏪 Pickup Your Order:
- Shop time: {business_hours}
- आज ही आकर ले जाएं !

{shop_name} 😊
Phone: {shop_phone}

⭐ आपका भरोसा हमारे लिए सबकुछ है ! Thank You !

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getDeliveryNotificationTemplate() {
        return `🎉 आपका Order Delivered हो गया! 🎉

नमस्ते *{customer_name}* जी 🙏

आपका {garment_type} successfully deliver हो गया! ✨
📋 Order ID: {order_id}
📅 Delivery Date: {delivery_date}

💰 Payment Summary:
- Total Amount: ₹{total_amount}
- Advance जमा: ₹{advance_amount}
- Final Payment: ₹{final_payment}
- बकाया राशि: ₹{remaining_amount}

👕 Care Instructions:
- हल्के हाथ से Wash करें
- उल्टा करके Iron करें
- Dry Clean भी कर सकते हैं

💫 नये Order के लिए दुबारा जरूर आए !

Again Thank You 
{shop_name} ✨
Phone: {shop_phone}

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    // Reminder Templates
    getPickupReminderTemplate() {
        return `🔔 Pickup Reminder 🔔

Hello *{customer_name}* जी 😊

आपका order ready है! 🎉
कब से wait कर रहे हैं आपका...

📋 Order Info:
- ID: {order_id}
- Item: {garment_type}
- Ready since: {ready_date}

🏪 Shop Details:
- Timings: {business_hours}
- Contact: {shop_phone}

🚗 जल्दी आ जाइए - waiting है आपका!

Thank You - {shop_name} 😊

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getPaymentReminderTemplate() {
        return `💳 Payment Reminder 💳

नमस्ते *{customer_name}* जी 🙏

आपने Order {order_id} ({garment_type}) {order_date} को ले लिया था। 🎯  

लेकिन अभी ₹{outstanding_amount} शेष है — कृपया सुविधा अनुसार जल्द Payment कर दीजिए।

💰 भुगतान विकल्प:
* Cash — दुकान पर आकर दे सकते हैं  
* UPI/Online — नीचे Pay here बटन पर क्लिक करें या भुगतान के बाद PAID भेज दें

🏪 Shop timing: {business_hours}
  
{shop_name} ✨ 
Call/WhatsApp: {shop_phone}

धन्यवाद 🙏

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    // Fabric Templates
    getFabricWelcomeTemplate() {
        return `🙏{shop_name} में आपका स्वागत है ! आपका दिन शुभ हो !🙏

नमस्ते *{customer_name}* जी! 👋

हमारे साथ जुड़ने के लिए thank you!
आपकी हर जरूरत पूरी करने के लिए हम तैयार हैं! ✨

🏪 Shop Information:
- Timings: {business_hours}
- 7 days open
- Contact: {shop_phone}
- WhatsApp updates automatic मिलते रहेंगे !

📱 हमारी Service:
- Order status updates
- Ready होने पर instant notification
- Payment reminders
- New collection alerts
- Festival/Wedding Offers 🫴 

आपका विश्वास ही हमारी सफलता है! 🙏

💫 Best quality, Best Service - guaranteed!

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getFabricPurchaseTemplate() {
        return `🎉 *Fabric Order Ready!* 🎉

नमस्ते *{customer_name}* जी 🙏

आपकी {fabric_type} ({brand_name}) Fabric Ready है! ✨
📋 Order ID: {order_id}

💰 *Payment Details:*
- Total Amount: ₹{total_amount}

🏪 *Pickup Your Fabric:*
- Shop time: {business_hours}
- आज ही आकर ले जाएं !

{shop_name} 😊
Phone: {shop_phone}

⭐ आपका भरोसा हमारे लिए सबकुछ है ! Thank You !

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getFabricPaymentReminderTemplate() {
        return `💳 *Fabric Payment Reminder* 💳

नमस्ते *{customer_name}* जी 🙏

आपकी {fabric_type} Fabric Order {order_id} के लिए ₹{remaining_amount} शेष है।

कृपया सुविधा अनुसार जल्द Payment कर दीजिए।

💰 भुगतान विकल्प:
* Cash — दुकान पर आकर दे सकते हैं  
* UPI/Online — भुगतान के बाद PAID भेज दें

🏪 Shop timing: {business_hours}
  
{shop_name} ✨ 
Call/WhatsApp: {shop_phone}

धन्यवाद 🙏

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    // Combined Templates
    getCombinedOrderTemplate() {
        return `🎉 *Complete Order Ready!* 🎉

नमस्ते *{customer_name}* जी 🙏

आपका Complete Order (Fabric + Tailoring) Ready है! ✨
📋 Combined Order ID: {order_id}
📅 तैयार हुआ: {ready_date}

📦 *Order Components:*
- Fabric Order: {fabric_order_id}
- Tailor Order: {tailor_order_id}

💰 *Payment Details:*
- Total Amount: ₹{total_amount}
- Advance जमा: ₹{advance_amount}
- बाकी Amount: ₹{remaining_amount}

🏪 *Pickup Your Complete Order:*
- Shop time: {business_hours}
- आज ही आकर ले जाएं !

{shop_name} 😊
Phone: {shop_phone}

⭐ आपका भरोसा हमारे लिए सबकुछ है ! Thank You !

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    // Special Templates
    getPickupCompleteTemplate() {
        return `🧾 Order Pickup Complete! 🧾

Dear *{customer_name}* जी 🤠

आज ({pickup_date}) आपने अपना {garment_type} (Order {order_id}) successfully ले लिया! 🎉

💳 Payment Summary:
- Total Amount: ₹{total_amount}
- पहले से जमा: ₹{advance_amount}
- आज दिया: ₹{final_payment}
- बकाया राशि: ₹{remaining_amount}

👕 Care Instructions:
- हल्के हाथ से Wash करें
- उल्टा करके Iron करें
- Dry Clean भी कर सकते हैं

💫 नये Order के लिए दुबारा जरूर आए !

Again Thank You 
{shop_name} ✨
Phone: {shop_phone}

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    getWorkerDailyDataTemplate() {
        return `📊 *Daily Work Report* 📊

नमस्ते *{worker_name}* जी 🙏

आज ({date}) का आपका work report:

📋 *Today's Work:*
- Orders Completed: {orders_completed}
- Orders In Progress: {orders_in_progress}
- New Orders: {new_orders}

💰 *Payment Collection:*
- Total Collected: ₹{total_collected}
- Advance Received: ₹{advance_received}
- Outstanding: ₹{outstanding_amount}

📈 *Performance:*
- Efficiency: {efficiency}%
- Quality Score: {quality_score}/10

🏪 *Tomorrow's Plan:*
- Priority Orders: {priority_orders}
- Expected Completion: {expected_completion}

Keep up the good work! 💪

{shop_name} Management
Phone: {shop_phone}

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`;
    }

    // Template Processing Methods
    getTemplate(templateType) {
        if (!this.templates[templateType]) {
            throw new Error(`Template type '${templateType}' not found`);
        }
        return this.templates[templateType];
    }

    processTemplate(templateType, data) {
        try {
            // Check cache first
            const cacheKey = `${templateType}_${JSON.stringify(data)}`;
            if (this.templateCache.has(cacheKey)) {
                return this.templateCache.get(cacheKey);
            }

            let template = this.getTemplate(templateType);
            
            // Replace placeholders with actual data
            template = this.replacePlaceholders(template, data);
            
            // Cache the processed template
            this.templateCache.set(cacheKey, template);
            
            // Limit cache size
            if (this.templateCache.size > 100) {
                const firstKey = this.templateCache.keys().next().value;
                this.templateCache.delete(firstKey);
            }
            
            return template;
            
        } catch (error) {
            logger.error('Template processing failed:', error);
            throw error;
        }
    }

    replacePlaceholders(template, data) {
        // Default values for missing data
        const defaults = {
            shop_name: 'RS Tailor & Fabric',
            shop_phone: '8824781960',
            business_hours: '10:00 AM - 7:00 PM',
            customer_name: 'Customer',
            order_id: 'N/A',
            garment_type: 'Item',
            total_amount: '0',
            advance_amount: '0',
            remaining_amount: '0',
            ready_date: new Date().toLocaleDateString(),
            delivery_date: new Date().toLocaleDateString(),
            pickup_date: new Date().toLocaleDateString(),
            order_date: new Date().toLocaleDateString(),
            outstanding_amount: '0',
            final_payment: '0',
            fabric_type: 'Fabric',
            brand_name: 'Brand',
            fabric_order_id: 'N/A',
            tailor_order_id: 'N/A',
            worker_name: 'Worker',
            date: new Date().toLocaleDateString(),
            orders_completed: '0',
            orders_in_progress: '0',
            new_orders: '0',
            total_collected: '0',
            advance_received: '0',
            efficiency: '0',
            quality_score: '0',
            priority_orders: '0',
            expected_completion: 'N/A'
        };

        // Merge data with defaults
        const mergedData = { ...defaults, ...data };

        // Replace placeholders
        let processedTemplate = template;
        for (const [key, value] of Object.entries(mergedData)) {
            const placeholder = `{${key}}`;
            processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), value);
        }

        return processedTemplate;
    }

    // Public API Methods (compatible with existing code)
    getWelcomeMessage(orderData) {
        return this.processTemplate('welcome', orderData);
    }

    getOrderConfirmationMessage(orderData) {
        return this.processTemplate('order_confirmation', orderData);
    }

    getOrderReadyMessage(orderData) {
        return this.processTemplate('order_ready', orderData);
    }

    getDeliveryNotificationMessage(orderData) {
        return this.processTemplate('delivery_notification', orderData);
    }

    getPickupReminderMessage(orderData) {
        return this.processTemplate('pickup_reminder', orderData);
    }

    getPaymentReminderMessage(orderData) {
        return this.processTemplate('payment_reminder', orderData);
    }

    getFabricWelcomeMessage(orderData) {
        return this.processTemplate('fabric_welcome', orderData);
    }

    getFabricPurchaseMessage(orderData) {
        return this.processTemplate('fabric_purchase', orderData);
    }

    getFabricPaymentReminderMessage(orderData) {
        return this.processTemplate('fabric_payment_reminder', orderData);
    }

    getCombinedOrderMessage(orderData) {
        return this.processTemplate('combined_order', orderData);
    }

    getPickupCompleteMessage(orderData) {
        return this.processTemplate('pickup_complete', orderData);
    }

    getWorkerDailyDataMessage(workerData) {
        return this.processTemplate('worker_daily_data', workerData);
    }

    // Template Management Methods
    addCustomTemplate(templateType, template) {
        this.templates[templateType] = template;
        console.log(`✅ Custom template added: ${templateType}`);
    }

    updateTemplate(templateType, template) {
        if (!this.templates[templateType]) {
            throw new Error(`Template type '${templateType}' not found`);
        }
        this.templates[templateType] = template;
        this.clearTemplateCache();
        console.log(`✅ Template updated: ${templateType}`);
    }

    removeTemplate(templateType) {
        if (!this.templates[templateType]) {
            throw new Error(`Template type '${templateType}' not found`);
        }
        delete this.templates[templateType];
        this.clearTemplateCache();
        console.log(`✅ Template removed: ${templateType}`);
    }

    clearTemplateCache() {
        this.templateCache.clear();
        console.log('🧹 Template cache cleared');
    }

    getAvailableTemplates() {
        return Object.keys(this.templates);
    }

    getTemplateStats() {
        return {
            totalTemplates: Object.keys(this.templates).length,
            cacheSize: this.templateCache.size,
            availableTypes: this.getAvailableTemplates()
        };
    }
}

module.exports = MessageTemplates;