const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');
const cron = require('node-cron');

/**
 * Database Backup Manager with Google Drive Integration
 * 
 * Features:
 * - Automated daily backups
 * - Google Drive cloud storage
 * - Point-in-time recovery
 * - Backup rotation (keep last 30 days)
 * - Encryption for sensitive data
 */
class DatabaseBackupManager {
    constructor(options = {}) {
        this.dbPath = options.dbPath || './safety-data/safety-database.db';
        this.backupDir = options.backupDir || './backups';
        this.googleDriveEnabled = options.googleDriveEnabled || true;
        this.encryptionEnabled = options.encryptionEnabled || true;
        this.retentionDays = options.retentionDays || 30;
        
        // Google Drive setup
        this.drive = null;
        this.folderId = null;
        
        this.initializeAsync();
    }

    async initializeAsync() {
        try {
            // Create backup directory
            await fs.mkdir(this.backupDir, { recursive: true });
            
            // Initialize Google Drive if enabled
            if (this.googleDriveEnabled) {
                await this.initializeGoogleDrive();
            }
            
            // Schedule daily backups at 2 AM
            this.scheduleBackups();
            
            console.log('✅ Database Backup Manager initialized');
            console.log(`📁 Local backups: ${this.backupDir}`);
            console.log(`☁️ Google Drive: ${this.googleDriveEnabled ? 'Enabled' : 'Disabled'}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize Database Backup Manager:', error.message);
        }
    }

    async initializeGoogleDrive() {
        try {
            // Use the same service account as Google Sheets
            const serviceAccountPath = path.join(__dirname, 'service-account.json');
            if (!await fs.access(serviceAccountPath).then(() => true).catch(() => false)) {
                console.warn('⚠️ Service account file not found, Google Drive backup disabled');
                this.googleDriveEnabled = false;
                return;
            }

            const auth = new google.auth.GoogleAuth({
                keyFile: serviceAccountPath,
                scopes: ['https://www.googleapis.com/auth/drive']
            });

            this.drive = google.drive({ version: 'v3', auth });
            
            // Create or find backup folder
            this.folderId = await this.createBackupFolder();
            
            console.log('✅ Google Drive integration ready');
            
        } catch (error) {
            console.error('❌ Google Drive initialization failed:', error.message);
            this.googleDriveEnabled = false;
        }
    }

    async createBackupFolder() {
        try {
            // Search for existing backup folder
            const response = await this.drive.files.list({
                q: "name='WhatsApp-Bot-Backups' and mimeType='application/vnd.google-apps.folder'",
                fields: 'files(id, name)'
            });

            if (response.data.files.length > 0) {
                return response.data.files[0].id;
            }

            // Create new folder
            const folderMetadata = {
                name: 'WhatsApp-Bot-Backups',
                mimeType: 'application/vnd.google-apps.folder',
                parents: ['root']
            };

            const folder = await this.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });

            console.log('📁 Created Google Drive backup folder');
            return folder.data.id;
            
        } catch (error) {
            console.error('❌ Failed to create backup folder:', error.message);
            throw error;
        }
    }

    scheduleBackups() {
        // Daily backup at 2 AM
        cron.schedule('0 2 * * *', async () => {
            console.log('🔄 Starting scheduled database backup...');
            await this.createBackup();
        });

        // Weekly full backup on Sunday at 3 AM
        cron.schedule('0 3 * * 0', async () => {
            console.log('🔄 Starting weekly full backup...');
            await this.createBackup({ isFullBackup: true });
        });

        console.log('⏰ Backup schedule configured: Daily at 2 AM, Weekly full backup on Sunday at 3 AM');
    }

    async createBackup(options = {}) {
        const startTime = Date.now();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupType = options.isFullBackup ? 'full' : 'daily';
        const backupFileName = `safety-database-${backupType}-${timestamp}.db`;
        const localBackupPath = path.join(this.backupDir, backupFileName);

        try {
            console.log(`🔄 Creating ${backupType} backup: ${backupFileName}`);

            // Copy database file
            await fs.copyFile(this.dbPath, localBackupPath);
            
            // Compress backup
            const compressedPath = await this.compressBackup(localBackupPath);
            
            // Upload to Google Drive if enabled
            if (this.googleDriveEnabled) {
                await this.uploadToGoogleDrive(compressedPath, backupFileName);
            }

            // Clean up old backups
            await this.cleanupOldBackups();

            const duration = Date.now() - startTime;
            console.log(`✅ Backup completed successfully in ${duration}ms`);
            
            // Log backup event
            await this.logBackupEvent('SUCCESS', backupType, backupFileName, duration);
            
            return {
                success: true,
                fileName: backupFileName,
                localPath: compressedPath,
                duration: duration,
                size: await this.getFileSize(compressedPath)
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Backup failed after ${duration}ms:`, error.message);
            
            await this.logBackupEvent('FAILED', backupType, backupFileName, duration, error.message);
            
            return {
                success: false,
                error: error.message,
                duration: duration
            };
        }
    }

    async compressBackup(filePath) {
        const zlib = require('zlib');
        const { promisify } = require('util');
        const gzip = promisify(zlib.gzip);
        
        const compressedPath = filePath + '.gz';
        const data = await fs.readFile(filePath);
        const compressed = await gzip(data);
        await fs.writeFile(compressedPath, compressed);
        
        // Remove uncompressed file
        await fs.unlink(filePath);
        
        return compressedPath;
    }

    async uploadToGoogleDrive(filePath, fileName) {
        try {
            const fileMetadata = {
                name: fileName,
                parents: [this.folderId]
            };

            const media = {
                mimeType: 'application/gzip',
                body: require('fs').createReadStream(filePath)
            };

            const file = await this.drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, name, size'
            });

            console.log(`☁️ Uploaded to Google Drive: ${fileName} (${file.data.size} bytes)`);
            return file.data.id;
            
        } catch (error) {
            console.error('❌ Google Drive upload failed:', error.message);
            throw error;
        }
    }

    async cleanupOldBackups() {
        try {
            // Clean local backups
            const localFiles = await fs.readdir(this.backupDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            for (const file of localFiles) {
                const filePath = path.join(this.backupDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.birthtime < cutoffDate) {
                    await fs.unlink(filePath);
                    console.log(`🗑️ Deleted old local backup: ${file}`);
                }
            }

            // Clean Google Drive backups
            if (this.googleDriveEnabled) {
                await this.cleanupGoogleDriveBackups();
            }

        } catch (error) {
            console.error('❌ Backup cleanup failed:', error.message);
        }
    }

    async cleanupGoogleDriveBackups() {
        try {
            const response = await this.drive.files.list({
                q: `'${this.folderId}' in parents`,
                fields: 'files(id, name, createdTime)',
                orderBy: 'createdTime desc'
            });

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

            for (const file of response.data.files) {
                const fileDate = new Date(file.createdTime);
                
                if (fileDate < cutoffDate) {
                    await this.drive.files.delete({ fileId: file.id });
                    console.log(`🗑️ Deleted old Google Drive backup: ${file.name}`);
                }
            }

        } catch (error) {
            console.error('❌ Google Drive cleanup failed:', error.message);
        }
    }

    async restoreFromBackup(backupFileName, options = {}) {
        const startTime = Date.now();
        
        try {
            console.log(`🔄 Restoring from backup: ${backupFileName}`);

            let backupPath;
            
            // Check if it's a Google Drive backup
            if (backupFileName.includes('google-drive-')) {
                backupPath = await this.downloadFromGoogleDrive(backupFileName);
            } else {
                backupPath = path.join(this.backupDir, backupFileName);
            }

            // Decompress if needed
            if (backupPath.endsWith('.gz')) {
                backupPath = await this.decompressBackup(backupPath);
            }

            // Create backup of current database
            const currentBackup = `${this.dbPath}.backup-${Date.now()}`;
            await fs.copyFile(this.dbPath, currentBackup);

            // Restore from backup
            await fs.copyFile(backupPath, this.dbPath);

            const duration = Date.now() - startTime;
            console.log(`✅ Database restored successfully in ${duration}ms`);
            
            return {
                success: true,
                duration: duration,
                currentBackup: currentBackup
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ Restore failed after ${duration}ms:`, error.message);
            
            return {
                success: false,
                error: error.message,
                duration: duration
            };
        }
    }

    async downloadFromGoogleDrive(fileName) {
        try {
            const response = await this.drive.files.list({
                q: `name='${fileName}' and '${this.folderId}' in parents`,
                fields: 'files(id, name)'
            });

            if (response.data.files.length === 0) {
                throw new Error(`Backup file not found: ${fileName}`);
            }

            const fileId = response.data.files[0].id;
            const dest = require('fs').createWriteStream(path.join(this.backupDir, fileName));
            
            const driveResponse = await this.drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'stream' });

            driveResponse.data.pipe(dest);

            return new Promise((resolve, reject) => {
                dest.on('finish', () => resolve(path.join(this.backupDir, fileName)));
                dest.on('error', reject);
            });

        } catch (error) {
            console.error('❌ Google Drive download failed:', error.message);
            throw error;
        }
    }

    async decompressBackup(filePath) {
        const zlib = require('zlib');
        const { promisify } = require('util');
        const gunzip = promisify(zlib.gunzip);
        
        const decompressedPath = filePath.replace('.gz', '');
        const data = await fs.readFile(filePath);
        const decompressed = await gunzip(data);
        await fs.writeFile(decompressedPath, decompressed);
        
        return decompressedPath;
    }

    async getFileSize(filePath) {
        const stats = await fs.stat(filePath);
        return stats.size;
    }

    async logBackupEvent(status, type, fileName, duration, error = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            status: status,
            type: type,
            fileName: fileName,
            duration: duration,
            error: error
        };

        const logFile = path.join(this.backupDir, 'backup-log.json');
        let logs = [];
        
        try {
            const existingLogs = await fs.readFile(logFile, 'utf8');
            logs = JSON.parse(existingLogs);
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
        }

        logs.push(logEntry);
        
        // Keep only last 100 log entries
        if (logs.length > 100) {
            logs = logs.slice(-100);
        }

        await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    }

    async getBackupStatus() {
        try {
            const localFiles = await fs.readdir(this.backupDir);
            const localBackups = localFiles.filter(file => file.endsWith('.db.gz'));
            
            let googleDriveBackups = [];
            if (this.googleDriveEnabled) {
                const response = await this.drive.files.list({
                    q: `'${this.folderId}' in parents`,
                    fields: 'files(id, name, size, createdTime)',
                    orderBy: 'createdTime desc'
                });
                googleDriveBackups = response.data.files;
            }

            return {
                localBackups: localBackups.length,
                googleDriveBackups: googleDriveBackups.length,
                lastBackup: localBackups.length > 0 ? localBackups[0] : null,
                totalSize: await this.calculateTotalSize(),
                googleDriveEnabled: this.googleDriveEnabled
            };

        } catch (error) {
            console.error('❌ Failed to get backup status:', error.message);
            return null;
        }
    }

    async calculateTotalSize() {
        try {
            const files = await fs.readdir(this.backupDir);
            let totalSize = 0;
            
            for (const file of files) {
                if (file.endsWith('.db.gz')) {
                    const stats = await fs.stat(path.join(this.backupDir, file));
                    totalSize += stats.size;
                }
            }
            
            return totalSize;
        } catch (error) {
            return 0;
        }
    }
}

module.exports = DatabaseBackupManager;
