const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

class MessageTemplates {
    constructor() {
        this.templates = {
            // Order Confirmation Messages
            order_confirmation_hindi: `✅ Order Confirm हो गया! ✅

Hello *{customer_name}* जी 👋

आपका order confirm है और हमने काम शुरू कर दिया है! 🎯

📋 Order की Details:
- Order ID: {order_id}
- Item: {garment_type} 👔
- Ready होगा: {delivery_date}

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
📍 Main Market, Kumher`,


            // Order Ready for Pickup
            order_ready_hindi: `🎉 आपका Order तैयार है ! 🎉

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
📍 Main Market, Kumher`,


            // Payment Reminder
            payment_reminder_hindi: `💳 Payment Reminder 💳

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
📍 Main Market, Kumher`,


            // Pickup Reminder
            pickup_reminder_hindi: `🔔 Pickup Reminder 🔔

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
📍 Main Market, Kumher`,

            // Welcome Message (New Customer)
            welcome_hindi: `🙏{shop_name} में आपका स्वागत है ! आपका दिन शुभ हो !🙏

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
📍 Main Market, Kumher`,


            // Order Pickup Complete
            pickup_complete_hindi: `🧾 Order Pickup Complete! 🧾

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
📍 Main Market, Kumher`,

            // Fabric Order Templates
            fabric_order_ready_hindi: `🎉 *Fabric Order Ready!* 🎉

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
📍 Main Market, Kumher`,

            // Combined Order Templates
            combined_order_ready_hindi: `🎉 *Complete Order Ready!* 🎉

नमस्ते *{customer_name}* जी 🙏

आपका Complete Order (Fabric + Tailoring) Ready है! ✨
📋 Combined Order ID: {order_id}
📅 तैयार हुआ: {ready_date}

📦 *Order Components:*
- Fabric Order: {fabric_order_id}
- Tailor Order: {tailor_order_id}

💰 *Payment Details:*
- कुल Amount: ₹{total_amount}
- Advance जमा: ₹{advance_amount}
- बाकी Amount: ₹{remaining_amount}

🏪 *Pickup Your Complete Order:*
- Shop time: {business_hours}
- आज ही आकर ले जाएं !

{shop_name} 😊
Phone: {shop_phone}

⭐ आपका भरोसा हमारे लिए सबकुछ है ! Thank You !

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`,

            // Delivery Notification
            delivery_notification_hindi: `🚚 आपका Order Deliver हो गया! 🚚

नमस्ते *{customer_name}* जी 🙏

आपका Order {order_id} ({garment_type}) successfully deliver हो गया है! ✨
📋 Order ID: {order_id}
📅 Delivery Date: {delivery_date}

💰 Payment Status:
- Total Amount: ₹{total_amount}
- Advance Payment: ₹{advance_amount}
- Remaining Amount: ₹{remaining_amount}

✅ Order Successfully Delivered!

अगर कोई issue है तो contact करें:
📞 Phone: {shop_phone}

आपकी खुशी ही हमारी सफलता है! 🙏

{shop_name} 😊

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`,


            // Pickup Reminder Templates
            pickup_reminder_hindi: `🔔 *Pickup Reminder #{reminder_number}* 🔔

नमस्ते *{customer_name}* जी 🙏

आपका Order *{order_id}* ready है और {days_pending} दिन से आपके pickup का इंतजार कर रहा है! 

📋 Order Details:
- Order ID: {order_id}
- Item: {garment_type}
- Ready Date: {ready_date}
- Days Pending: {days_pending} दिन

💰 Payment Status:
- Total Amount: ₹{total_amount}
- Advance Payment: ₹{advance_amount}
- Remaining Amount: ₹{remaining_amount}

⚠️ कृपया जल्दी से अपना order pickup कर लें!

🏪 Shop Details:
- Timing: 10:00 AM - 7:00 PM
- Phone: {shop_phone}
- Address: {shop_address}

आपका order safe है, लेकिन कृपया जल्दी pickup करें! 🙏

{shop_name} 😊

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`,


            // Payment Reminder Templates
            payment_reminder_hindi: `💳 *Payment Reminder #{reminder_number}* 💳

नमस्ते *{customer_name}* जी 🙏

आपका Order *{order_id}* deliver हो गया है लेकिन payment pending है!

📋 Order Details:
- Order ID: {order_id}
- Item: {garment_type}
- Delivery Date: {delivery_date}
- Days Since Delivery: {days_pending} दिन

💰 Payment Details:
- Total Amount: ₹{total_amount}
- Advance Payment: ₹{advance_amount}
- *Remaining Amount: ₹{remaining_amount}*

⚠️ कृपया बाकी payment जल्दी से complete करें!

🏪 Payment Options:
- Cash Payment at Shop
- UPI: {shop_phone}
- Timing: 10:00 AM - 7:00 PM

आपका payment हमारे लिए important है! 🙏

{shop_name} 😊

🏪 RS Tailor & Fabric
📍 Main Market, Kumher`,


            // Fabric Order Templates
            fabric_welcome_hindi: `🙏{shop_name} में आपका स्वागत है ! आपका दिन शुभ हो !🙏

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

💫 Best quality, Best Service - guaranteed!`,


            fabric_purchase_hindi: `🧵 आपका Fabric Purchase Complete! 🧵

नमस्ते *{customer_name}* जी 🙏

आपका Fabric Order *{order_id}* successfully purchase हो गया है! ✨
📋 Order ID: {order_id}
🧵 Fabric: {fabric_type} ({fabric_color})
📏 Quantity: {quantity} meters
📅 Purchase Date: {purchase_date}

💰 Payment Details:
- Total Amount: ₹{total_amount}
- Advance Payment: ₹{advance_payment}
- Remaining Amount: ₹{remaining_amount}

✅ Fabric Purchase Completed!

अगर कोई issue है तो contact करें:
📞 Phone: {shop_phone}

आपकी खुशी ही हमारी सफलता है! 🙏

{shop_name} 😊`,


            fabric_payment_reminder_hindi: `💳 *Fabric Payment Reminder #{reminder_number}* 💳

नमस्ते *{customer_name}* जी 🙏

आपका Fabric Order *{order_id}* purchase हो गया है लेकिन payment pending है!

📋 Order Details:
- Order ID: {order_id}
- Fabric: {fabric_type} ({fabric_color})
- Purchase Date: {purchase_date}
- Days Since Purchase: {days_pending} दिन

💰 Payment Details:
- Total Amount: ₹{total_amount}
- Advance Payment: ₹{advance_payment}
- *Remaining Amount: ₹{remaining_amount}*

⚠️ कृपया payment जल्दी से complete करें!

🏪 Payment Options:
- Cash Payment at Shop
- UPI: {shop_phone}
- Timing: {business_hours}

आपका payment हमारे लिए important है! 🙏

{shop_name} 😊`,


            // Combined Order Templates
            combined_order_hindi: `✅ आपका Fabric Purchase Complete और Tailoring Order Confirm हो गया है! 

नमस्ते *{customer_name}* जी 🙏


👉 आपका Fabric Order ✨
📋 Order ID: {fabric_order_id}
🧵 Fabric: {fabric_type} ({fabric_color})
📏 Quantity: {fabric_quantity} meters
📅 Purchase Date: {fabric_purchase_date}

💰 Payment Details:
- Total Amount: ₹{fabric_total_amount}
- Advance Payment: ₹{fabric_advance_payment}
- Remaining Amount: ₹{fabric_remaining_amount}


👉 आपका Tailoring Order ✨
- Order ID: {tailoring_order_id}
- Item: {tailoring_garment_type} 👔
- Ready होगा: {tailoring_delivery_date}

💰 Amount Details:
- Total: ₹{tailoring_total_amount}
- Advance मिला: ₹{tailoring_advance_payment} ✅
- बाकी Amount: ₹{tailoring_remaining_amount}


🏪 Shop Details:
- Timing: {business_hours}
- Phone: {shop_phone}

हमारी दुकान पर आने के लिए धन्यवाद ! 🙏

{shop_name} 😊
Main Market, Kumher.`,


            // Worker Daily Data Messages
            worker_daily_data_hindi: `📊 *दैनिक कार्य रिपोर्ट* 📊

नमस्ते *{worker_name}* जी! 🙏

आज की आपकी कार्य रिपोर्ट यहाँ है:

📅 *दिनांक:* {date}
👤 *कार्यकर्ता नाम:* {worker_name}
🎨 *पेंट काउंट:* {paint_count}
👔 *शर्ट काउंट:* {shirt_count}
💰 *कुल कार्य राशि:* ₹{total_work_amount}
💵 *अग्रिम लिया गया:* ₹{advance_taken}
💸 *बाकी भुगतान:* ₹{remaining_payment}
📝 *नोट्स:* {notes}

📊 *कुल गणना:*
• कुल राशि: ₹{grand_total_amount}
• कुल अग्रिम: ₹{grand_total_advance}
• कुल बाकी: ₹{grand_total_remaining}

🏪 *RS Tailor & Fabric*
📍 Main Market, Kumher
📞 Phone: 8824781960

धन्यवाद! 🙏`,

        };

        // Default shop configuration
        this.shopConfig = {
            shop_name: process.env.SHOP_NAME || 'RS Tailor & Fabric',
            shop_phone: process.env.SHOP_PHONE || '8824781960',
            shop_address: process.env.SHOP_ADDRESS || 'Main Market, Kumher',
            business_hours: process.env.BUSINESS_HOURS || '10:00 AM - 7:00 PM'
        };

        // Language preference (hindi/english)
        this.defaultLanguage = process.env.DEFAULT_LANGUAGE || 'hindi';
    }

    /**
     * Get template by type and language
     */
    getTemplate(templateType, language = null) {
        const lang = language || this.defaultLanguage;
        const templateKey = `${templateType}_${lang}`;
        
        if (this.templates[templateKey]) {
            return this.templates[templateKey];
        }
        
        // No fallback needed - only Hindi templates available
        
        logger.error(`Template not found: ${templateKey}`);
        return this.getDefaultTemplate(templateType);
    }

    /**
     * Get default template if specific template not found
     */
    getDefaultTemplate(templateType) {
        const defaultTemplates = {
            order_ready: `Your order #{order_id} is ready for pickup!\n\nCustomer: {customer_name}\nPhone: {customer_phone}\n\nPlease visit our shop during business hours.\n\n{shop_name}\n{shop_phone}`,
            payment_reminder: `Payment reminder for order #{order_id}\n\nOutstanding amount: ₹{outstanding_amount}\nCustomer: {customer_name}\n\nPlease make payment at your earliest convenience.\n\n{shop_name}\n{shop_phone}`,
            welcome: `🙏{shop_name} में आपका स्वागत है ! आपका दिन शुभ हो !🙏

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

💫 Best quality, Best Service - guaranteed!`
        };
        
        return defaultTemplates[templateType] || `Message from {shop_name}\n\nHello {customer_name},\n\nThank you for your business!\n\n{shop_name}\n{shop_phone}`;
    }

    /**
     * Format template with data
     */
    formatTemplate(templateType, data, language = null) {
        try {
            const template = this.getTemplate(templateType, language);
            
            // Merge shop config with data
            const formattedData = {
                ...this.shopConfig,
                ...data,
                // Ensure dates are formatted properly
                ready_date: this.formatDate(data.ready_date),
                delivery_date: this.formatDate(data.delivery_date),
                pickup_date: this.formatDate(data.pickup_date),
                order_date: this.formatDate(data.order_date),
                due_date: this.formatDate(data.due_date)
            };
            
            // Replace template variables
            let formattedMessage = template;
            Object.keys(formattedData).forEach(key => {
                const value = formattedData[key] || '';
                const regex = new RegExp(`{${key}}`, 'g');
                formattedMessage = formattedMessage.replace(regex, value);
            });
            
            // Clean up any remaining unreplaced variables
            formattedMessage = formattedMessage.replace(/{[^}]+}/g, '');
            
            return formattedMessage;
        } catch (error) {
            logger.error('Error formatting template:', error.message);
            return this.getDefaultTemplate(templateType);
        }
    }

    /**
     * Format date to readable string
     */
    formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    /**
     * Determine order type and get appropriate template
     */
    getOrderReadyMessage(orderData, language = null) {
        const { garment_type, fabric_type, fabric_order_id, tailor_order_id } = orderData;
        
        // Check if it's a combined order (fabric + tailoring)
        if (fabric_order_id && tailor_order_id) {
            return this.formatTemplate('combined_order_ready', orderData, language);
        }
        
        // Check if it's a fabric-only order
        if (fabric_type && !garment_type) {
            return this.formatTemplate('fabric_order_ready', orderData, language);
        }
        
        // Default to regular order
        return this.formatTemplate('order_ready', orderData, language);
    }

    /**
     * Get payment reminder message
     */
    getPaymentReminderMessage(orderData, language = null) {
        return this.formatTemplate('payment_reminder', orderData, language);
    }

    /**
     * Get welcome message for new customer
     */
    getWelcomeMessage(customerData, language = null) {
        return this.formatTemplate('welcome', customerData, language);
    }

    /**
     * Get pickup complete message
     */
    getPickupCompleteMessage(orderData, language = null) {
        return this.formatTemplate('pickup_complete', orderData, language);
    }

    /**
     * Get pickup reminder message
     */
    getPickupReminderMessage(orderData, language = null) {
        return this.formatTemplate('pickup_reminder', orderData, language);
    }

    /**
     * Get order confirmation message
     */
    getOrderConfirmationMessage(orderData, language = null) {
        return this.formatTemplate('order_confirmation', orderData, language || 'hindi');
    }

    /**
     * Get delivery notification message
     */
    getDeliveryNotificationMessage(orderData, language = null) {
        return this.formatTemplate('delivery_notification', orderData, language);
    }

    // Note: getPickupReminderMessage is defined above; removing duplicate to prevent accidental overrides

    /**
     * Get fabric welcome message
     */
    getFabricWelcomeMessage(orderData, language = null) {
        return this.formatTemplate('fabric_welcome', orderData, language);
    }

    /**
     * Get fabric purchase notification message
     */
    getFabricPurchaseMessage(orderData, language = null) {
        return this.formatTemplate('fabric_purchase', orderData, language);
    }

    /**
     * Get fabric payment reminder message
     */
    getFabricPaymentReminderMessage(orderData, language = null) {
        return this.formatTemplate('fabric_payment_reminder', orderData, language);
    }

    /**
     * Get combined order message
     */
    getCombinedOrderMessage(orderData, language = null) {
        return this.formatTemplate('combined_order', orderData, language);
    }

    /**
     * Get worker daily data message
     */
    getWorkerDailyDataMessage(workerData, language = 'hindi') {
        return this.formatTemplate('worker_daily_data', workerData, 'hindi');
    }

    /**
     * Add custom template
     */
    addTemplate(templateType, template, language = 'english') {
        const templateKey = `${templateType}_${language}`;
        this.templates[templateKey] = template;
        logger.info(`Added custom template: ${templateKey}`);
    }

    /**
     * Update shop configuration
     */
    updateShopConfig(config) {
        this.shopConfig = { ...this.shopConfig, ...config };
        logger.info('Updated shop configuration');
    }

    /**
     * Get all available templates
     */
    getAvailableTemplates() {
        // Correctly parse template type and language by splitting on the last underscore
        return Object.keys(this.templates).map(key => {
            const lastUnderscore = key.lastIndexOf('_');
            const type = lastUnderscore > -1 ? key.substring(0, lastUnderscore) : key;
            const language = lastUnderscore > -1 ? key.substring(lastUnderscore + 1) : this.defaultLanguage;
            return { type, language };
        });
    }

    /**
     * Set default language
     */
    setDefaultLanguage(language) {
        this.defaultLanguage = language;
        logger.info(`Default language set to: ${language}`);
    }
}

module.exports = MessageTemplates;
