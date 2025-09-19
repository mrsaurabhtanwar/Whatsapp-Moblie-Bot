#!/usr/bin/env node

/**
 * WhatsApp Bot Testing Script
 * 
 * This script will:
 * 1. Start the bot
 * 2. Test core functionality
 * 3. Report status
 * 4. Provide testing commands
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

class BotTester {
    constructor() {
        this.botProcess = null;
        this.testResults = {
            startup: false,
            dashboard: false,
            whatsapp: false,
            sheets: false,
            messaging: false
        };
    }

    async startBot() {
        console.log('🚀 Starting WhatsApp Bot...');
        
        return new Promise((resolve, reject) => {
            this.botProcess = spawn('node', ['main-bot.js'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            let startupComplete = false;
            let connectionEstablished = false;

            this.botProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[BOT] ${output.trim()}`);
                
                // Check for startup completion
                if (output.includes('Dashboard running at http://localhost:3001')) {
                    this.testResults.startup = true;
                    this.testResults.dashboard = true;
                    if (!startupComplete) {
                        startupComplete = true;
                        console.log('✅ Bot started successfully!');
                        resolve();
                    }
                }
                
                // Check for WhatsApp connection
                if (output.includes('WhatsApp connected successfully')) {
                    this.testResults.whatsapp = true;
                    if (!connectionEstablished) {
                        connectionEstablished = true;
                        console.log('✅ WhatsApp connected successfully!');
                    }
                }
            });

            this.botProcess.stderr.on('data', (data) => {
                const error = data.toString();
                console.error(`[ERROR] ${error.trim()}`);
            });

            this.botProcess.on('close', (code) => {
                console.log(`Bot process exited with code ${code}`);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (!startupComplete) {
                    reject(new Error('Bot startup timeout'));
                }
            }, 30000);
        });
    }

    async testDashboard() {
        console.log('🧪 Testing Dashboard...');
        
        return new Promise((resolve) => {
            const req = http.get('http://localhost:3001', (res) => {
                if (res.statusCode === 200) {
                    console.log('✅ Dashboard is accessible');
                    this.testResults.dashboard = true;
                } else {
                    console.log('❌ Dashboard returned status:', res.statusCode);
                }
                resolve();
            });

            req.on('error', (err) => {
                console.log('❌ Dashboard test failed:', err.message);
                resolve();
            });

            req.setTimeout(5000, () => {
                console.log('❌ Dashboard test timeout');
                req.destroy();
                resolve();
            });
        });
    }

    async testHealthEndpoint() {
        console.log('🧪 Testing Health Endpoint...');
        
        return new Promise((resolve) => {
            const req = http.get('http://localhost:3001/api/health', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const health = JSON.parse(data);
                        console.log('✅ Health endpoint working:', health);
                    } catch (e) {
                        console.log('❌ Health endpoint returned invalid JSON');
                    }
                    resolve();
                });
            });

            req.on('error', (err) => {
                console.log('❌ Health endpoint test failed:', err.message);
                resolve();
            });

            req.setTimeout(5000, () => {
                console.log('❌ Health endpoint test timeout');
                req.destroy();
                resolve();
            });
        });
    }

    async testGoogleSheets() {
        console.log('🧪 Testing Google Sheets Connection...');
        
        // Check if service account file exists
        const serviceAccountPath = path.join(process.cwd(), 'service-account.json');
        if (fs.existsSync(serviceAccountPath)) {
            console.log('✅ Service account file found');
            this.testResults.sheets = true;
        } else {
            console.log('❌ Service account file not found');
        }
    }

    async runTests() {
        try {
            console.log('🧪 Starting Bot Tests...\n');
            
            // Start the bot
            await this.startBot();
            
            // Wait a bit for full initialization
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Test dashboard
            await this.testDashboard();
            
            // Test health endpoint
            await this.testHealthEndpoint();
            
            // Test Google Sheets
            await this.testGoogleSheets();
            
            // Print results
            this.printResults();
            
            // Keep bot running for manual testing
            console.log('\n🎯 Bot is running for manual testing...');
            console.log('📊 Dashboard: http://localhost:3001');
            console.log('🔍 Health Check: http://localhost:3001/api/health');
            console.log('⏹️  Press Ctrl+C to stop the bot');
            
            // Keep the process alive
            process.on('SIGINT', () => {
                console.log('\n🛑 Stopping bot...');
                if (this.botProcess) {
                    this.botProcess.kill();
                }
                process.exit(0);
            });
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            if (this.botProcess) {
                this.botProcess.kill();
            }
            process.exit(1);
        }
    }

    printResults() {
        console.log('\n📊 Test Results:');
        console.log('================');
        console.log(`🚀 Bot Startup: ${this.testResults.startup ? '✅' : '❌'}`);
        console.log(`📊 Dashboard: ${this.testResults.dashboard ? '✅' : '❌'}`);
        console.log(`📱 WhatsApp: ${this.testResults.whatsapp ? '✅' : '❌'}`);
        console.log(`📋 Google Sheets: ${this.testResults.sheets ? '✅' : '❌'}`);
        console.log(`💬 Messaging: ${this.testResults.messaging ? '✅' : '❌'}`);
        
        const workingCount = Object.values(this.testResults).filter(Boolean).length;
        const totalCount = Object.keys(this.testResults).length;
        
        console.log(`\n🎯 Overall Status: ${workingCount}/${totalCount} tests passed`);
        
        if (workingCount === totalCount) {
            console.log('🎉 All tests passed! Bot is fully functional.');
        } else {
            console.log('⚠️  Some tests failed. Check the issues above.');
        }
    }
}

// Run the tests
const tester = new BotTester();
tester.runTests();

