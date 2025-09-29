/**
 * Media Utilities for WhatsApp Bot
 * Handles media validation, file operations, and media type detection
 */

const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

class MediaUtils {
    constructor() {
        this.supportedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        this.supportedVideoTypes = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
        this.supportedAudioTypes = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
        this.supportedDocumentTypes = ['.pdf', '.doc', '.docx', '.txt', '.xlsx', '.xls'];
        
        // File size limits (in bytes)
        this.maxImageSize = 16 * 1024 * 1024; // 16MB
        this.maxVideoSize = 64 * 1024 * 1024; // 64MB
        this.maxAudioSize = 16 * 1024 * 1024; // 16MB
        this.maxDocumentSize = 100 * 1024 * 1024; // 100MB
    }

    /**
     * Detect media type from file extension
     */
    getMediaType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (this.supportedImageTypes.includes(ext)) {
            return 'image';
        } else if (this.supportedVideoTypes.includes(ext)) {
            return 'video';
        } else if (this.supportedAudioTypes.includes(ext)) {
            return 'audio';
        } else if (this.supportedDocumentTypes.includes(ext)) {
            return 'document';
        }
        
        return 'unknown';
    }

    /**
     * Get MIME type from file extension
     */
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        const mimeTypes = {
            // Images
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            
            // Videos
            '.mp4': 'video/mp4',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            
            // Audio
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4',
            '.aac': 'audio/aac',
            
            // Documents
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.txt': 'text/plain',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * Validate media file
     */
    validateMediaFile(filePath, mediaType = null) {
        const errors = [];
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            errors.push(`File not found: ${filePath}`);
            return { isValid: false, errors };
        }
        
        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSize = stats.size;
        
        // Detect media type if not provided
        if (!mediaType) {
            mediaType = this.getMediaType(filePath);
        }
        
        // Check if media type is supported
        if (mediaType === 'unknown') {
            errors.push(`Unsupported file type: ${path.extname(filePath)}`);
        }
        
        // Check file size limits
        switch (mediaType) {
            case 'image':
                if (fileSize > this.maxImageSize) {
                    errors.push(`Image file too large: ${this.formatFileSize(fileSize)}. Max size: ${this.formatFileSize(this.maxImageSize)}`);
                }
                break;
                
            case 'video':
                if (fileSize > this.maxVideoSize) {
                    errors.push(`Video file too large: ${this.formatFileSize(fileSize)}. Max size: ${this.formatFileSize(this.maxVideoSize)}`);
                }
                break;
                
            case 'audio':
                if (fileSize > this.maxAudioSize) {
                    errors.push(`Audio file too large: ${this.formatFileSize(fileSize)}. Max size: ${this.formatFileSize(this.maxAudioSize)}`);
                }
                break;
                
            case 'document':
                if (fileSize > this.maxDocumentSize) {
                    errors.push(`Document file too large: ${this.formatFileSize(fileSize)}. Max size: ${this.formatFileSize(this.maxDocumentSize)}`);
                }
                break;
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            mediaType,
            fileSize,
            mimeType: this.getMimeType(filePath)
        };
    }

    /**
     * Format file size in human readable format
     */
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Create media directory structure
     */
    createMediaDirectories() {
        const mediaDir = path.join(__dirname, '../../media');
        const subdirs = ['images', 'videos', 'audio', 'documents', 'temp'];
        
        try {
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
                logger.info(`📁 Created media directory: ${mediaDir}`);
            }
            
            subdirs.forEach(subdir => {
                const subdirPath = path.join(mediaDir, subdir);
                if (!fs.existsSync(subdirPath)) {
                    fs.mkdirSync(subdirPath, { recursive: true });
                    logger.info(`📁 Created subdirectory: ${subdirPath}`);
                }
            });
            
            return mediaDir;
            
        } catch (error) {
            logger.error('❌ Failed to create media directories:', error);
            throw error;
        }
    }

    /**
     * Save media file with proper naming
     */
    saveMediaFile(buffer, originalName, mediaType) {
        try {
            const mediaDir = this.createMediaDirectories();
            const timestamp = Date.now();
            const ext = path.extname(originalName);
            const baseName = path.basename(originalName, ext);
            const safeName = `${baseName}_${timestamp}${ext}`;
            
            const subdirMap = {
                'image': 'images',
                'video': 'videos',
                'audio': 'audio',
                'document': 'documents'
            };
            
            const subdir = subdirMap[mediaType] || 'temp';
            const filePath = path.join(mediaDir, subdir, safeName);
            
            fs.writeFileSync(filePath, buffer);
            logger.info(`💾 Media file saved: ${filePath}`);
            
            return {
                success: true,
                filePath,
                fileName: safeName,
                size: buffer.length
            };
            
        } catch (error) {
            logger.error('❌ Failed to save media file:', error);
            throw error;
        }
    }

    /**
     * Clean up old media files
     */
    cleanupOldFiles(maxAgeHours = 24) {
        try {
            const mediaDir = path.join(__dirname, '../../media');
            if (!fs.existsSync(mediaDir)) return;
            
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
            
            const cleanDirectory = (dirPath) => {
                const files = fs.readdirSync(dirPath);
                let deletedCount = 0;
                
                files.forEach(file => {
                    const filePath = path.join(dirPath, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isFile()) {
                        const age = now - stats.mtime.getTime();
                        if (age > maxAge) {
                            fs.unlinkSync(filePath);
                            deletedCount++;
                        }
                    }
                });
                
                return deletedCount;
            };
            
            const subdirs = ['images', 'videos', 'audio', 'documents', 'temp'];
            let totalDeleted = 0;
            
            subdirs.forEach(subdir => {
                const subdirPath = path.join(mediaDir, subdir);
                if (fs.existsSync(subdirPath)) {
                    const deleted = cleanDirectory(subdirPath);
                    totalDeleted += deleted;
                }
            });
            
            if (totalDeleted > 0) {
                logger.info(`🧹 Cleaned up ${totalDeleted} old media files`);
            }
            
            return totalDeleted;
            
        } catch (error) {
            logger.error('❌ Failed to cleanup old files:', error);
            return 0;
        }
    }

    /**
     * Get media file info
     */
    getMediaInfo(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            
            const stats = fs.statSync(filePath);
            const mediaType = this.getMediaType(filePath);
            const mimeType = this.getMimeType(filePath);
            
            return {
                filePath,
                fileName: path.basename(filePath),
                mediaType,
                mimeType,
                size: stats.size,
                sizeFormatted: this.formatFileSize(stats.size),
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime
            };
            
        } catch (error) {
            logger.error('❌ Failed to get media info:', error);
            throw error;
        }
    }

    /**
     * Check if URL is a valid media URL
     */
    isValidMediaUrl(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname.toLowerCase();
            
            // Check if URL has a supported file extension
            const allSupportedTypes = [
                ...this.supportedImageTypes,
                ...this.supportedVideoTypes,
                ...this.supportedAudioTypes,
                ...this.supportedDocumentTypes
            ];
            
            return allSupportedTypes.some(ext => pathname.endsWith(ext));
            
        } catch (error) {
            return false;
        }
    }
}

module.exports = MediaUtils;