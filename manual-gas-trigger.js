/**
 * Manually trigger Google Apps Script runAutomation function
 */

const fetch = require('node-fetch');

async function manuallyTriggerGoogleAppsScript() {
    console.log('🔧 Manually triggering Google Apps Script automation...');
    
    try {
        // Try to trigger the runAutomation function via web app
        console.log('📞 Calling Google Apps Script web app...');
        
        const gasResponse = await fetch('https://script.google.com/macros/s/AKfycbxQYkKITpXXk2Wa4GH9KtWqM8g1XHMLbdEU1RJKmSkpSjf9lW-JInNanJWjuhi_d_4z/exec', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'runAutomation'
            })
        });
        
        const gasResult = await gasResponse.text();
        console.log('Google Apps Script Status:', gasResponse.status);
        console.log('Google Apps Script Response:', gasResult);
        
        console.log('\n💡 Instructions to manually run Google Apps Script:');
        console.log('1. Open: https://script.google.com/');
        console.log('2. Find your project: RS Tailor & Fabric Automation');
        console.log('3. Click on the project');
        console.log('4. In the code editor, select function: runAutomation');
        console.log('5. Click the "Run" button (▶️)');
        console.log('6. Check execution log for results');
        
        console.log('\n📊 What should happen:');
        console.log('- Google Apps Script reads your fabric order');
        console.log('- Sees "Purchase Notified = No"');  
        console.log('- Sends webhook to your bot');
        console.log('- Bot sends WhatsApp message');
        console.log('- Google Apps Script updates "Purchase Notified = Yes"');
        
    } catch (error) {
        console.error('❌ Error triggering Google Apps Script:', error.message);
    }
}

manuallyTriggerGoogleAppsScript();