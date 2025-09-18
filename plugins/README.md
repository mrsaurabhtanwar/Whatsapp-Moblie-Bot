# Tailor Shop Bot - Plugin Architecture

This directory contains the plugin-based architecture for the enhanced tailor shop WhatsApp bot, inspired by GataBot-MD's modular design.

## Directory Structure

```
plugins/
├── order-processing/
│   ├── main-orders.js          # Main order processing logic
│   ├── fabric-orders.js        # Fabric order handling
│   └── combined-orders.js      # Combined order processing
├── reminders/
│   ├── pickup-reminders.js     # Pickup reminder system
│   └── payment-reminders.js    # Payment reminder system
├── admin-commands/
│   ├── bot-management.js       # Bot control commands
│   ├── data-backup.js          # Data backup utilities
│   └── system-monitor.js       # System monitoring
├── media/
│   ├── image-processor.js      # Image processing utilities
│   ├── audio-generator.js      # Audio message generation
│   ├── sticker-creator.js      # Sticker creation
│   └── video-processor.js      # Video processing
├── utils/
│   ├── error-handler.js        # Centralized error handling
│   ├── logger.js               # Enhanced logging system
│   └── validator.js            # Input validation utilities
└── core/
    ├── plugin-loader.js        # Plugin loading system
    ├── event-handler.js        # Event handling system
    └── middleware.js           # Request middleware
```

## Plugin Development Guidelines

### 1. Plugin Structure
Each plugin should follow this structure:
```javascript
class PluginName {
    constructor(bot, config = {}) {
        this.bot = bot;
        this.config = config;
        this.name = 'PluginName';
        this.version = '1.0.0';
    }

    async initialize() {
        // Plugin initialization
    }

    async handleMessage(messageData) {
        // Message handling logic
    }

    async cleanup() {
        // Cleanup resources
    }
}

module.exports = PluginName;
```

### 2. Error Handling
All plugins should use the centralized error handler:
```javascript
const ErrorHandler = require('../utils/error-handler');

try {
    // Plugin logic
} catch (error) {
    ErrorHandler.handle(error, this.name, messageData);
}
```

### 3. Logging
Use the enhanced logger for all operations:
```javascript
const Logger = require('../utils/logger');

Logger.info('Plugin operation', { plugin: this.name, data: messageData });
```

## Integration with Existing Bot

The plugin system integrates seamlessly with your existing:
- Google Sheets integration
- Hindi/English message templates
- PM2 production setup
- Duplicate prevention system
- Business logic for tailor shop operations

## Benefits

1. **Modularity**: Easy to add/remove features
2. **Maintainability**: Clear separation of concerns
3. **Scalability**: Plugins can be developed independently
4. **Reusability**: Common functionality shared across plugins
5. **Error Isolation**: Plugin failures don't crash the entire bot
