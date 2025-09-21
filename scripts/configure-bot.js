#!/usr/bin/env node

/**
 * WhatsApp Bot Configuration Setup Script
 * 
 * This script helps you configure the essential settings for your WhatsApp bot
 * to enable message sending and Google Sheets integration
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

class BotConfigurator {
    constructor() {
        this.envPath = path.join(__dirname, '../.env');
        this.envContent = '';
    }

    async run() {
        console.log('🔧 WhatsApp Bot Configuration Setup');
        console.log('====================================\n');

        try {
            // Read current .env file
            await this.readEnvFile();
            
            // Configure essential settings
            await this.configureGoogleSheets();
            await this.configureWhatsAppPhones();
            await this.configureBotMode();
            
            // Save updated .env file
            await this.saveEnvFile();
            
            console.log('\n✅ Configuration completed successfully!');
            console.log('🔄 Restarting bot to apply changes...');
            
            // Restart the bot
            await this.restartBot();
            
        } catch (error) {
            console.error('❌ Configuration failed:', error.message);
            process.exit(1);
        }
    }

    async readEnvFile() {
        try {
            this.envContent = await fs.readFile(this.envPath, 'utf8');
            console.log('📄 Current .env file loaded');
        } catch (error) {
            console.error('❌ Failed to read .env file:', error.message);
            throw error;
        }
    }

    async configureGoogleSheets() {
        console.log('\n📊 GOOGLE SHEETS CONFIGURATION');
        console.log('===============================');
        console.log('Your bot needs Google Sheet IDs to process orders and send messages.');
        console.log('Follow the guide in GOOGLE_SHEETS_SETUP.md to create your sheets.\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

        try {
            // Main Orders Sheet
            const mainSheetId = await question('Enter your Main Orders Google Sheet ID (or press Enter to skip): ');
            if (mainSheetId && mainSheetId !== '') {
                this.updateEnvValue('GOOGLE_SHEET_ID', mainSheetId);
                console.log('✅ Main Orders Sheet ID configured');
            }

            // Fabric Orders Sheet
            const fabricSheetId = await question('Enter your Fabric Orders Google Sheet ID (or press Enter to skip): ');
            if (fabricSheetId && fabricSheetId !== '') {
                // FABRIC_SHEET_ID removed - using consolidated sheet
                console.log('✅ Fabric Orders Sheet ID configured');
            }

            // Combined Orders Sheet
            const combinedSheetId = await question('Enter your Combined Orders Google Sheet ID (or press Enter to skip): ');
            if (combinedSheetId && combinedSheetId !== '') {
                // COMBINED_SHEET_ID removed - using consolidated sheet
                console.log('✅ Combined Orders Sheet ID configured');
            }

        } finally {
            rl.close();
        }
    }

    async configureWhatsAppPhones() {
        console.log('\n📱 WHATSAPP PHONE CONFIGURATION');
        console.log('===============================');
        console.log('Configure the phone numbers where the bot will send messages.');
        console.log('Use numbers without +91 (e.g., 9876543210)\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

        try {
            // Admin Phone
            const adminPhone = await question('Enter your admin phone number (without +91): ');
            if (adminPhone && adminPhone !== '') {
                this.updateEnvValue('WHATSAPP_ADMIN_PHONE', adminPhone);
                console.log('✅ Admin phone configured');
            }

            // Brother Phone (optional)
            const brotherPhone = await question('Enter brother/assistant phone number (or press Enter to skip): ');
            if (brotherPhone && brotherPhone !== '') {
                this.updateEnvValue('WHATSAPP_BROTHER_PHONE', brotherPhone);
                console.log('✅ Brother phone configured');
            }

        } finally {
            rl.close();
        }
    }

    async configureBotMode() {
        console.log('\n🤖 BOT OPERATION MODE');
        console.log('=====================');
        console.log('Choose how your bot should operate:');
        console.log('1. AUTO - Automatically send messages when orders are ready');
        console.log('2. APPROVAL - Send approval requests before sending messages');
        console.log('3. MANUAL - Only send when manually triggered\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

        try {
            const mode = await question('Enter mode (AUTO/APPROVAL/MANUAL) [default: AUTO]: ');
            const botMode = mode.toUpperCase() || 'AUTO';
            
            if (['AUTO', 'APPROVAL', 'MANUAL'].includes(botMode)) {
                this.updateEnvValue('BOT_MODE', botMode);
                console.log(`✅ Bot mode set to: ${botMode}`);
            } else {
                console.log('⚠️ Invalid mode, using AUTO');
                this.updateEnvValue('BOT_MODE', 'AUTO');
            }

        } finally {
            rl.close();
        }
    }

    updateEnvValue(key, value) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(this.envContent)) {
            this.envContent = this.envContent.replace(regex, newLine);
        } else {
            this.envContent += `\n${newLine}`;
        }
    }

    async saveEnvFile() {
        try {
            await fs.writeFile(this.envPath, this.envContent, 'utf8');
            console.log('💾 .env file updated successfully');
        } catch (error) {
            console.error('❌ Failed to save .env file:', error.message);
            throw error;
        }
    }

    async restartBot() {
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
            console.log('🔄 Restarting bot...');
            
            const restart = spawn('pm2', ['restart', '0'], { 
                stdio: 'inherit',
                shell: true 
            });
            
            restart.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Bot restarted successfully');
                    console.log('\n🎉 Your bot is now configured and ready to send messages!');
                    console.log('📊 Check the status at: http://localhost:3001');
                    resolve();
                } else {
                    console.error('❌ Failed to restart bot');
                    reject(new Error('Restart failed'));
                }
            });
        });
    }
}

// Run the configuration
if (require.main === module) {
    const configurator = new BotConfigurator();
    configurator.run();
}

module.exports = BotConfigurator;
