#!/usr/bin/env node

/**
 * Test Script for Developer Whitelist
 * 
 * This script tests the developer whitelist functionality to ensure
 * that developer phone numbers bypass all safety limits.
 */

const DeveloperConfig = require('../src/config/developer-config');
const EnhancedSafetyManager = require('../src/managers/enhanced-safety-manager');
const DuplicatePreventionManager = require('../src/managers/duplicate-prevention-manager');

class DeveloperWhitelistTester {
    constructor() {
        this.developerConfig = new DeveloperConfig();
        this.safetyManager = new EnhancedSafetyManager();
        this.duplicateManager = new DuplicatePreventionManager();
        
        this.testPhones = [
            '917375938371',  // Developer phone 1
            '919166758467',  // Developer phone 2
            '916375623182',  // Developer phone 3
            '919876543210'   // Regular phone (should be blocked)
        ];
    }

    async runTests() {
        console.log('🧪 Testing Developer Whitelist Functionality\n');
        
        // Test 1: Developer Config
        await this.testDeveloperConfig();
        
        // Test 2: Safety Manager
        await this.testSafetyManager();
        
        // Test 3: Duplicate Prevention Manager
        await this.testDuplicatePreventionManager();
        
        console.log('\n✅ All tests completed!');
    }

    async testDeveloperConfig() {
        console.log('📱 Testing Developer Config...');
        
        for (const phone of this.testPhones) {
            const isDeveloper = this.developerConfig.isDeveloperPhone(phone);
            const expected = phone !== '919876543210';
            
            if (isDeveloper === expected) {
                console.log(`  ✅ ${phone}: ${isDeveloper ? 'Developer' : 'Regular'} (Correct)`);
            } else {
                console.log(`  ❌ ${phone}: Expected ${expected}, got ${isDeveloper}`);
            }
        }
        
        console.log(`  📋 Developer phones: ${this.developerConfig.getDeveloperPhones().join(', ')}\n`);
    }

    async testSafetyManager() {
        console.log('🛡️ Testing Safety Manager...');
        
        for (const phone of this.testPhones) {
            try {
                const result = await this.safetyManager.canSendMessage(
                    phone,
                    'TEST-001',
                    'welcome',
                    'Test message',
                    { customer_name: 'Test Customer' }
                );
                
                const isDeveloper = this.developerConfig.isDeveloperPhone(phone);
                const shouldAllow = isDeveloper;
                
                if (result.allowed === shouldAllow) {
                    console.log(`  ✅ ${phone}: ${result.allowed ? 'Allowed' : 'Blocked'} (${result.reason})`);
                } else {
                    console.log(`  ❌ ${phone}: Expected ${shouldAllow}, got ${result.allowed} (${result.reason})`);
                }
            } catch (error) {
                console.log(`  ❌ ${phone}: Error - ${error.message}`);
            }
        }
        
        console.log('');
    }

    async testDuplicatePreventionManager() {
        console.log('🔄 Testing Duplicate Prevention Manager...');
        
        for (const phone of this.testPhones) {
            try {
                const result = await this.duplicateManager.checkDuplicate(
                    phone,
                    'TEST-001',
                    'welcome',
                    'Test message',
                    { customer_name: 'Test Customer' }
                );
                
                const isDeveloper = this.developerConfig.isDeveloperPhone(phone);
                const shouldAllow = isDeveloper;
                
                if (result.allowed === shouldAllow) {
                    console.log(`  ✅ ${phone}: ${result.allowed ? 'Allowed' : 'Blocked'} (${result.reason})`);
                } else {
                    console.log(`  ❌ ${phone}: Expected ${shouldAllow}, got ${result.allowed} (${result.reason})`);
                }
            } catch (error) {
                console.log(`  ❌ ${phone}: Error - ${error.message}`);
            }
        }
        
        console.log('');
    }

    displaySummary() {
        console.log('📊 Test Summary:');
        console.log('================');
        console.log('✅ Developer phones should bypass ALL safety limits');
        console.log('✅ Regular phones should be subject to ALL safety limits');
        console.log('✅ Admin commands should work for all developer phones');
        console.log('✅ No rate limits for developer phones');
        console.log('✅ No duplicate prevention for developer phones');
        console.log('✅ No business hours restrictions for developer phones');
        console.log('✅ No startup delay for developer phones');
        console.log('');
        console.log('🔓 Developer Phone Numbers:');
        this.developerConfig.getDeveloperPhones().forEach((phone, index) => {
            console.log(`   ${index + 1}. ${phone}`);
        });
        console.log('');
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new DeveloperWhitelistTester();
    tester.runTests().then(() => {
        tester.displaySummary();
    }).catch(console.error);
}

module.exports = DeveloperWhitelistTester;
