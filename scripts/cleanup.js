#!/usr/bin/env node

/**
 * Cleanup Script for WhatsApp Bot
 * 
 * This script removes unused files and directories to clean up the project
 */

const fs = require('fs').promises;
const path = require('path');

class ProjectCleanup {
    constructor() {
        this.filesToRemove = [
            'lucky-xd-reference', // Different bot entirely
            '.bot-lock.json', // Will be regenerated
            'qr-code.png', // Will be regenerated
            'bot-errors.log', // Old log files
            'bot-output.log'
        ];
        
        this.directoriesToClean = [
            'logs', // Will be recreated
            'sessions' // Empty directory
        ];
    }

    async cleanup() {
        console.log('🧹 Starting project cleanup...\n');
        
        let removedCount = 0;
        let errorCount = 0;
        
        // Remove files
        for (const file of this.filesToRemove) {
            try {
                const stats = await fs.stat(file);
                if (stats.isDirectory()) {
                    await fs.rmdir(file, { recursive: true });
                    console.log(`✅ Removed directory: ${file}`);
                } else {
                    await fs.unlink(file);
                    console.log(`✅ Removed file: ${file}`);
                }
                removedCount++;
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.log(`❌ Error removing ${file}: ${error.message}`);
                    errorCount++;
                } else {
                    console.log(`ℹ️  File not found (already removed): ${file}`);
                }
            }
        }
        
        // Clean directories
        for (const dir of this.directoriesToClean) {
            try {
                const files = await fs.readdir(dir);
                if (files.length === 0) {
                    await fs.rmdir(dir);
                    console.log(`✅ Removed empty directory: ${dir}`);
                    removedCount++;
                } else {
                    console.log(`ℹ️  Directory not empty, keeping: ${dir}`);
                }
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    console.log(`❌ Error cleaning directory ${dir}: ${error.message}`);
                    errorCount++;
                }
            }
        }
        
        console.log(`\n📊 Cleanup Summary:`);
        console.log(`   ✅ Removed: ${removedCount} items`);
        console.log(`   ❌ Errors: ${errorCount} items`);
        
        if (errorCount === 0) {
            console.log('\n🎉 Cleanup completed successfully!');
        } else {
            console.log('\n⚠️  Cleanup completed with some errors.');
        }
    }
}

// Run cleanup if called directly
if (require.main === module) {
    const cleanup = new ProjectCleanup();
    cleanup.cleanup().catch(console.error);
}

module.exports = ProjectCleanup;
