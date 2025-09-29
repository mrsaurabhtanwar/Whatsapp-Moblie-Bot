/**
 * PM2 Ecosystem Configuration for WhatsApp Tailor Bot
 * Production deployment configuration
 */

module.exports = {
  apps: [
    {
      name: 'whatsapp-bot',
      script: 'src/app.js',
      cwd: process.cwd(),
      
      // Instance configuration
      instances: 1, // WhatsApp connection should be single instance
      exec_mode: 'fork', // Use fork mode for single instance
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        LOG_LEVEL: 'info'
      },
      
      // Restart policy
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: '30s',
      
      // Logging
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto restart on file changes (disable in production)
      watch: false,
      
      // Memory and CPU limits
      max_memory_restart: '500M',
      
      // Graceful shutdown
      kill_timeout: 5000,
      
      // Process management
      pid_file: './safety-data/process.pid',
      
      // Additional PM2 options
      autorestart: true,
      max_restarts: 10,
      
      // Environment specific overrides
      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        watch: true,
        ignore_watch: [
          'node_modules',
          'logs',
          'auth_info_baileys',
          '*.log'
        ]
      },
      
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        watch: false
      }
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:mrsaurabhtanwar/Whatsapp-Moblie-Bot.git',
      path: '/var/www/whatsapp-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};