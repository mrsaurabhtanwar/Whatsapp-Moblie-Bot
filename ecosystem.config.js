module.exports = {
  apps: [{
    name: 'whatsapp-sheet-bot',
    script: 'main-bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M', // Restart if memory exceeds 512MB
    node_args: '--expose-gc --max-old-space-size=512', // Enable GC and limit memory
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      HOST: 'localhost',
      LOG_LEVEL: 'info',
      LOG_TO_FILE: 'true',
      LOG_FILE_PATH: './logs/bot.log',
      POLL_INTERVAL_SECONDS: 180, // 3 minutes for stability
      BATCH_SIZE: 5, // Smaller batches for stability
      BOT_MODE: 'AUTO',
      MAX_RETRIES: 5, // More retries for resilience
      RETRY_DELAY_SECONDS: 45,
      MAX_CONNECTION_ATTEMPTS: 15,
      RECONNECT_DELAY: 10000,
      CONNECTION_MODE: 'production',
      MAX_PROCESSED_ORDERS: 5000,
      BAILEYS_AUTH_PATH: './baileys_auth',
      // Google Sheets Configuration
      GOOGLE_SHEET_ID: '128vwp1tjsej9itNAkQY1Y-5sJsMv3N1TZi5Pl9Wgn6Y',
      GOOGLE_SHEET_NAME: 'Orders',
      FABRIC_SHEET_ID: '1tFb4EBzzvdmDNY0bOtyTXAhX1aRqzfq7NzXLhDqYj0o',
      FABRIC_SHEET_NAME: 'Fabric Orders',
      COMBINED_SHEET_ID: '199mFt3yz1cZQUGcF84pZgNQoxCpOS2gHxFGDD71CZVg',
      COMBINED_SHEET_NAME: 'Combine Orders',
      WORKER_SHEET_ID: '1msVf01VuWsk1mhSMVrvypq_7ubSVjDKlr8aG-6bqE7Q',
      WORKER_SHEET_NAME: 'Payment_Daily_Entry',
      WORKER_LIST_SHEET: 'Worker_List',
      PAYMENT_SHEET_NAME: 'Payment_Daily_Entry',
      // WhatsApp Configuration
      WHATSAPP_ADMIN_PHONE: '917375938371',
      WHATSAPP_BROTHER_PHONE: '919166758467',
      WHATSAPP_ADMIN_PHONE_2: '916375623182'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Enhanced stability settings
    kill_timeout: 15000, // Allow more time for graceful shutdown
    wait_ready: true,
    listen_timeout: 20000, // More time for initialization
    restart_delay: 10000, // Wait 10 seconds before restart
    max_restarts: 5, // Limit restarts to prevent restart loops
    min_uptime: '30s', // Must run for 30s to be considered stable
    // Graceful shutdown
    shutdown_with_message: true,
    // Auto-restart on file changes (disabled for production)
    ignore_watch: ['node_modules', 'logs', 'baileys_auth', '*.lock.json'],
    // Exponential backoff for restart delays
    exp_backoff_restart_delay: 100,
    // Environment-specific settings
    env_production: {
      NODE_ENV: 'production',
      REDIS_URL: 'redis://localhost:6379',
      MOCK_WHATSAPP: 'false',
      DISABLE_POLLING: 'false'
    },
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      MOCK_WHATSAPP: 'true',
      DISABLE_POLLING: 'true'
    },
    env_testing: {
      NODE_ENV: 'testing',
      LOG_LEVEL: 'debug',
      MOCK_WHATSAPP: 'true',
      DISABLE_POLLING: 'true',
      POLL_INTERVAL_SECONDS: 60
    }
  }]
};
