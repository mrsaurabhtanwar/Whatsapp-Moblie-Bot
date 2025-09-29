const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Optimized Message Templates - Hindi Only (Updated Version)
 * 
 * Features:
 * - Custom Hindi templates only
 * - Modular template structure
 * - Dynamic template selection
 * - Template caching for performance
 * - Location added to all signatures
 */
class MessageTemplates {
    constructor() {
        this.templates = {
            // PROMOTIONAL MESSAGES ONLY - Other templates commented out for festival campaign
            
            /*
            // Core Order Templates - DISABLED for promotional campaign
            welcome: this.getWelcomeTemplate(),
            order_confirmation: this.getOrderConfirmationTemplate(),
            order_ready: this.getOrderReadyTemplate(),
            delivery_notification: this.getDeliveryNotificationTemplate(),
            
            // Reminder Templates - DISABLED for promotional campaign
            pickup_reminder: this.getPickupReminderTemplate(),
            payment_reminder: this.getPaymentReminderTemplate(),
            
            // Fabric Templates - DISABLED for promotional campaign
            fabric_welcome: this.getFabricWelcomeTemplate(),
            fabric_purchase: this.getFabricPurchaseTemplate(),
            fabric_payment_reminder: this.getFabricPaymentReminderTemplate(),
            
            // Combined Templates - DISABLED for promotional campaign
            combined_order: this.getCombinedOrderTemplate(),
            
            // Special Templates - DISABLED for promotional campaign
            pickup_complete: this.getPickupCompleteTemplate(),
            */
            
            // Festival Promotional Templates - ACTIVE
            durga_puja_dussehra_offer: this.getDurgaPujaDussehraOfferTemplate()
        };
        
        // Template cache for performance
        this.templateCache = new Map();
        
        console.log('🎉 PROMOTIONAL CAMPAIGN MODE - Festival Templates Only');
        console.log(`📝 Active template types: ${Object.keys(this.templates).length} (Promotional Only)`);
        console.log('🚫 Regular business templates are DISABLED for promotional campaign');
    }

    // Core Order Templates
    getWelcomeTemplate() {
        return `🙏 *RS Tailor & Fabric में आपका हार्दिक स्वागत है* 🙏

प्रिय *{customer_name}* जी,

आपका हमारे परिवार में शामिल होना हमारे लिए गर्व की बात है! 

✨ *हमारी विशेषताएं:*
- 20+ साल का अनुभव
- बेहतरीन फिटिंग की गारंटी  
- समय पर डिलीवरी
- उच्च गुणवत्ता के कपड़े
- Wedding/Festival स्पेशल कलेक्शन

📍 *दुकान का पता:* Main Market, Kumher
⏰ *समय:* सुबह 10 से रात 8 बजे (सातों दिन)
📞 *संपर्क:* {shop_phone}

💡 *आपको मिलेंगे:*
- Order की पूरी जानकारी WhatsApp पर
- तैयार होने पर तुरंत सूचना
- Special offers की जानकारी

आपके विश्वास के लिए धन्यवाद! 🌟

*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    getOrderConfirmationTemplate() {
        return `✅ *आपका ऑर्डर कन्फर्म हो गया है* ✅

प्रिय *{customer_name}* जी,

आपका ऑर्डर सफलतापूर्वक बुक हो गया है और हमने काम शुरू कर दिया है। 🪡✂️

📋 *ऑर्डर विवरण:*
- ऑर्डर नंबर: #{order_id}
- कपड़े का प्रकार: {garment_type}
- बुकिंग दिनांक: {order_date}

💰 *भुगतान विवरण:*
- कुल राशि: ₹{total_amount}
- एडवांस जमा: ₹{advance_payment} ✓
- शेष राशि: ₹{remaining_amount}

🎯 *विशेष नोट:* {notes}

📢 तैयार होते ही आपको सूचना भेज दी जाएगी।

किसी भी प्रश्न के लिए संपर्क करें: {shop_phone}

धन्यवाद! 🙏
*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    getOrderReadyTemplate() {
        return `🎉 *खुशखबरी! आपका कपड़ा तैयार है* 🎉

प्रिय *{customer_name}* जी,

आपका {garment_type} पूरी तरह से तैयार है और आपका इंतज़ार कर रहा है! ✨

📋 *विवरण:*
- ऑर्डर नंबर: #{order_id}
- तैयार दिनांक: {ready_date}
- कपड़े का प्रकार: {garment_type}

💳 *भुगतान स्थिति:*
- कुल राशि: ₹{total_amount}
- जमा राशि: ₹{advance_payment}
- देय राशि: ₹{remaining_amount}

🏪 *पिकअप टाइमिंग:*
- सुबह 10 से रात 8 बजे
- फोन: {shop_phone}

⭐ *महत्वपूर्ण:* कृपया 3 दिन के अंदर अपना ऑर्डर ले जाएं।

*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    getDeliveryNotificationTemplate() {
        return `✨ *डिलीवरी सफलतापूर्वक पूर्ण* ✨

प्रिय *{customer_name}* जी,

आपका ऑर्डर सफलतापूर्वक डिलीवर हो गया है। हमें उम्मीद है आपको हमारा काम पसंद आया होगा! 

📋 *डिलीवरी विवरण:*
- ऑर्डर नंबर: #{order_id}
- डिलीवरी दिनांक: {delivery_date}
- कपड़ा: {garment_type}

💰 *भुगतान सारांश:*
- कुल राशि: ₹{total_amount}
- प्राप्त राशि: ₹{paid_today}
- बकाया राशि: ₹{remaining_amount}

🌟 *देखभाल के टिप्स:*
- पहली बार ड्राई क्लीन करवाएं
- उल्टा करके प्रेस करें
- धूप में सीधे न सुखाएं

⭐ कृपया Google पर अपना अनुभव शेयर करें!

फिर मिलेंगे! 🙏
*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    // Reminder Templates
    getPickupReminderTemplate() {
        return `🔔 *रिमाइंडर: आपका ऑर्डर तैयार है* 🔔

प्रिय *{customer_name}* जी,

आपका {garment_type} पिछले {days_since_ready} दिनों से तैयार है और आपका इंतज़ार कर रहा है। 

📋 *ऑर्डर: #{order_id}*
💰 *बकाया राशि: ₹{remaining_amount}*

कृपया जल्द से जल्द अपना ऑर्डर ले जाएं। 🙏

⏰ दुकान खुली है: 10 AM - 8 PM

फोन: {shop_phone}
*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    getPaymentReminderTemplate() {
        return `💳 *भुगतान रिमाइंडर* 💳

प्रिय *{customer_name}* जी,

आपने {pickup_date} को अपना {garment_type} (ऑर्डर #{order_id}) ले लिया था।

💰 *बकाया राशि: ₹{remaining_amount}*

कृपया अपनी सुविधा अनुसार भुगतान कर दें:

📱 *UPI/Online:* 8824781960@paytm
💵 *Cash:* दुकान पर

भुगतान के बाद "PAID" लिखकर भेजें।

धन्यवाद! 🙏
*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    // Fabric Templates
    getFabricWelcomeTemplate() {
        return `🙏 *RS Tailor & Fabric में आपका हार्दिक स्वागत है* 🙏

प्रिय *{customer_name}* जी,

आपका हमारे परिवार में शामिल होना हमारे लिए गर्व की बात है! 

✨ *हमारी विशेषताएं:*
- 20+ साल का अनुभव
- बेहतरीन फिटिंग की गारंटी  
- समय पर डिलीवरी
- उच्च गुणवत्ता के कपड़े
- Wedding/Festival स्पेशल कलेक्शन

📍 *दुकान का पता:* Main Market, Kumher
⏰ *समय:* सुबह 10 से रात 8 बजे (सातों दिन)
📞 *संपर्क:* {shop_phone}

💡 *आपको मिलेंगे:*
- Order की पूरी जानकारी WhatsApp पर
- तैयार होने पर तुरंत सूचना
- Special offers की जानकारी

आपके विश्वास के लिए धन्यवाद! 🌟

*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    getFabricPurchaseTemplate() {
        return `🛍️ *कपड़ा खरीदी की पुष्टि* 🛍️

प्रिय *{customer_name}* जी,

आपके द्वारा चुना गया प्रीमियम कपडे की जानकारी इस प्रकार है! ✨

📦 *खरीदी विवरण:*
- ऑर्डर नंबर: #F{order_id}
- मात्रा: {quantity} मीटर

💰 *राशि विवरण:*
- कुल राशि: ₹{fabric_total}
- जमा राशि: ₹{advance_payment}
- बकाया: ₹{remaining_amount}

🎁 *विशेष ऑफर:*
इसी कपड़े की सिलाई पर 5% छूट!

📍 कृपया जल्द से जल्द अपना कपड़ा ले जाएं।

संपर्क: {shop_phone}
*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    getFabricPaymentReminderTemplate() {
        return `💳 *कपड़े का भुगतान बाकी है* 💳

प्रिय *{customer_name}* जी,

आपके कपड़े के ऑर्डर #F{order_id} का भुगतान अभी भी बाकी है।

📦 *विवरण:*
- कपड़ा: {fabric_type} - {brand_name}
- मात्रा: {quantity} मीटर
- बकाया राशि: ₹{remaining_amount}

कृपया जल्द भुगतान करें:
📱 UPI: 8824781960@paytm

धन्यवाद! 🙏
*RS Tailor & Fabric*
Main Market, Kumher`;
    }

    // Combined Templates
    getCombinedOrderTemplate() {
        return `✅ आपका Fabric Purchase Complete और Tailoring Order Confirm हो गया है! 

नमस्ते *{customer_name}* जी 🙏

👉 आपका Fabric Order ✨
📋 Order ID: {fabric_order_id}
📏 Quantity: {fabric_quantity} meters
📅 Purchase Date: {fabric_purchase_date}

💰 Payment Details:
- Total Amount: ₹{fabric_total}
- Advance Payment: ₹{fabric_advance}
- Remaining Amount: ₹{fabric_remaining}

👉 आपका Tailoring Order ✨
- Order ID: {tailor_order_id}
- Item: {garment_type} 👔
- Ready होगा: {delivery_date}

💰 Amount Details:
- Total: ₹{tailor_total}
- Advance मिला: ₹{tailor_advance} ✓
- बाकी Amount: ₹{tailor_remaining}

🏪 Shop Details:
- Timing: 10:00 AM - 8:00 PM
- Phone: {shop_phone}

हमारी दुकान पर आने के लिए धन्यवाद ! 🙏

*RS Tailor & Fabric* 😊
Main Market, Kumher`;
    }

    // Special Templates
    getPickupCompleteTemplate() {
        return `🧾 Order Pickup Complete! 🧾

प्रिय *{customer_name}* जी 🤠

आज ({pickup_date}) आपने अपना {garment_type} (Order #{order_id}) successfully ले लिया! 🎉

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
*RS Tailor & Fabric* ✨
Main Market, Kumher`;
    }

    // Festival Promotional Templates
    getDurgaPujaDussehraOfferTemplate() {
        return `🙏 *नमस्ते {customer_name} जी* 🙏

🌺 *दुर्गा पूजा और दशहरा की हार्दिक शुभकामनाएं* 🌺

इस पावन अवसर पर हम आपके और आपके पूरे परिवार की अच्छी सेहत और खुशहाली की प्रार्थना करते हैं। माँ दुर्गा आप सभी पर अपनी कृपा बनाए रखें। 🙏✨

🎉 *इस दशहरे को बनाइए खास हमारे बेहतरीन ऑफर के साथ!* 🎉

आप हमारे नियमित और प्रिय ग्राहक हैं, इसलिए आपके लिए विशेष *25% की छूट*:

💰 *विशेष ऑफर:*
▪️ ₹1000 की खरीदारी पर सीधे ₹250 की छूट 
▪️ ₹2000 की खरीदारी पर सीधे ₹500 की छूट
▪️ कोई छुपी हुई शर्तें नहीं, सीधी सादी छूट!

📅 *ऑफर की अवधि:*
30 सितंबर से 2 अक्टूबर तक (केवल 3 दिन)
आप इस दौरान कभी भी आ सकते हैं।

🎯 *यह ऑफर केवल आपके लिए उपलब्ध रहेगा!*

📍 *RS Tailor & Fabric*
Main Market, Kumher
📞 *संपर्क:* 8824781960
⏰ *समय:* सुबह 10 से रात 8 बजे

जय माता दी! 🚩
धन्यवाद! 🙏`;
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
            business_hours: '10:00 AM - 8:00 PM',
            customer_name: 'Customer',
            order_id: 'N/A',
            garment_type: 'Item',
            total_amount: '0',
            advance_payment: '0',
            remaining_amount: '0',
            ready_date: new Date().toLocaleDateString(),
            delivery_date: new Date().toLocaleDateString(),
            pickup_date: new Date().toLocaleDateString(),
            order_date: new Date().toLocaleDateString(),
            outstanding_amount: '0',
            paid_today: '0',
            final_payment: '0',
            fabric_type: 'Fabric',
            brand_name: 'Brand',
            fabric_order_id: 'N/A',
            tailor_order_id: 'N/A',
            fabric_total: '0',
            fabric_advance: '0',
            fabric_remaining: '0',
            fabric_quantity: '0',
            fabric_purchase_date: new Date().toLocaleDateString(),
            tailor_total: '0',
            tailor_advance: '0',
            tailor_remaining: '0',
            quantity: '0',
            notes: 'N/A',
            days_since_ready: '0'
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

    // PROMOTIONAL CAMPAIGN ONLY - Other methods commented out
    
    /*
    // Public API Methods (compatible with existing code) - DISABLED for promotional campaign
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
    */

    // Festival Promotional Methods
    getDurgaPujaDussehraOfferMessage(orderData) {
        return this.processTemplate('durga_puja_dussehra_offer', orderData);
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