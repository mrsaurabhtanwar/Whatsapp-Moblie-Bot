/**
 * Simple Logger Service
 * Provides consistent logging throughout the application
 */

const pino = require('pino');

// Create logger instance
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname'
        }
    }
});

module.exports = logger;