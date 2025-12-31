# Plugin Development Guide

Complete guide for developing and publishing plugins for BotBuilder.

---

## Table of Contents

- [Overview](#overview)
- [Plugin Architecture](#plugin-architecture)
- [Creating a Plugin](#creating-a-plugin)
- [Plugin Types](#plugin-types)
- [Plugin API](#plugin-api)
- [Testing Plugins](#testing-plugins)
- [Publishing Plugins](#publishing-plugins)
- [Examples](#examples)

---

## Overview

BotBuilder's plugin system allows extending the platform with custom functionality:

- **Channel Plugins:** Add new messaging platforms
- **AI Plugins:** Integrate additional AI providers
- **Action Plugins:** Custom flow actions
- **Integration Plugins:** Third-party service connections
- **Analytics Plugins:** Custom reporting and metrics

---

## Plugin Architecture

### Plugin Structure

```
my-plugin/
├── package.json          # Plugin metadata
├── index.js              # Main entry point
├── lib/
│   ├── actions/          # Custom actions
│   ├── hooks/            # Event hooks
│   └── api/              # API extensions
├── ui/                   # Frontend components (optional)
│   └── settings.jsx
├── docs/
│   └── README.md
└── tests/
    └── plugin.test.js
```

### Plugin Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLUGIN LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Install     Plugin files copied to plugins directory        │
│         │                                                        │
│         ▼                                                        │
│   2. Register    Plugin registered with platform                 │
│         │                                                        │
│         ▼                                                        │
│   3. Initialize  Plugin onInit() called with context             │
│         │                                                        │
│         ▼                                                        │
│   4. Activate    Plugin onActivate() called per organization     │
│         │                                                        │
│         ▼                                                        │
│   5. Running     Plugin handles events and requests              │
│         │                                                        │
│         ▼                                                        │
│   6. Deactivate  Plugin onDeactivate() called (cleanup)          │
│         │                                                        │
│         ▼                                                        │
│   7. Uninstall   Plugin files removed                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Creating a Plugin

### Step 1: Initialize Plugin

```bash
mkdir my-botbuilder-plugin
cd my-botbuilder-plugin
npm init
```

### Step 2: Create package.json

```json
{
  "name": "botbuilder-plugin-my-feature",
  "version": "1.0.0",
  "description": "My custom BotBuilder plugin",
  "main": "index.js",
  "botbuilder": {
    "type": "integration",
    "displayName": "My Feature",
    "description": "Adds my custom feature to BotBuilder",
    "icon": "icon.svg",
    "author": "Your Name",
    "homepage": "https://github.com/you/my-plugin",
    "minVersion": "1.0.0",
    "permissions": [
      "bots.read",
      "messages.read",
      "messages.write"
    ],
    "settings": {
      "apiKey": {
        "type": "string",
        "label": "API Key",
        "required": true,
        "secret": true
      },
      "enabled": {
        "type": "boolean",
        "label": "Enable Feature",
        "default": true
      }
    }
  },
  "dependencies": {
    "@botbuilder/plugin-sdk": "^1.0.0"
  }
}
```

### Step 3: Create Main Entry Point

```javascript
// index.js
const { Plugin } = require('@botbuilder/plugin-sdk');

class MyPlugin extends Plugin {
  /**
   * Plugin metadata
   */
  static get meta() {
    return {
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0',
      description: 'Adds custom functionality'
    };
  }

  /**
   * Called when plugin is initialized (once per server)
   * @param {PluginContext} context - Plugin context
   */
  async onInit(context) {
    this.logger = context.logger;
    this.db = context.db;
    this.logger.info('My Plugin initialized');
  }

  /**
   * Called when plugin is activated for an organization
   * @param {Organization} organization - Organization data
   * @param {Object} settings - Plugin settings
   */
  async onActivate(organization, settings) {
    this.logger.info(`Plugin activated for org ${organization.id}`);
    // Initialize per-organization resources
  }

  /**
   * Called when plugin is deactivated
   * @param {Organization} organization - Organization data
   */
  async onDeactivate(organization) {
    this.logger.info(`Plugin deactivated for org ${organization.id}`);
    // Cleanup resources
  }

  /**
   * Register event hooks
   */
  registerHooks() {
    return {
      'message.received': this.onMessageReceived.bind(this),
      'message.beforeSend': this.onBeforeSend.bind(this),
      'bot.created': this.onBotCreated.bind(this)
    };
  }

  /**
   * Register custom actions for flow builder
   */
  registerActions() {
    return [
      {
        id: 'my-custom-action',
        name: 'My Custom Action',
        description: 'Does something custom',
        category: 'Custom',
        icon: 'custom-icon',
        inputs: [
          {
            name: 'parameter1',
            type: 'string',
            label: 'Parameter 1',
            required: true
          }
        ],
        outputs: ['success', 'error'],
        execute: this.executeCustomAction.bind(this)
      }
    ];
  }

  /**
   * Register API routes
   */
  registerRoutes(router) {
    router.get('/my-endpoint', this.handleGetRequest.bind(this));
    router.post('/my-endpoint', this.handlePostRequest.bind(this));
  }

  // Hook implementations
  async onMessageReceived(event) {
    const { message, session, bot } = event;
    // Process incoming message
    // Return modified message or null to skip
    return message;
  }

  async onBeforeSend(event) {
    const { message, session, bot } = event;
    // Modify message before sending
    return message;
  }

  async onBotCreated(event) {
    const { bot, user } = event;
    // React to bot creation
  }

  // Action implementation
  async executeCustomAction(context, inputs) {
    const { parameter1 } = inputs;

    try {
      // Perform custom action
      const result = await this.doSomething(parameter1);

      return {
        output: 'success',
        data: { result }
      };
    } catch (error) {
      return {
        output: 'error',
        data: { error: error.message }
      };
    }
  }

  // Route handlers
  async handleGetRequest(req, res) {
    const { organizationId } = req.plugin;
    // Handle GET request
    res.json({ success: true, data: {} });
  }

  async handlePostRequest(req, res) {
    const { organizationId } = req.plugin;
    const { data } = req.body;
    // Handle POST request
    res.json({ success: true });
  }
}

module.exports = MyPlugin;
```

---

## Plugin Types

### Channel Plugin

Add support for new messaging platforms:

```javascript
class CustomChannelPlugin extends Plugin {
  static get meta() {
    return {
      id: 'custom-channel',
      name: 'Custom Channel',
      type: 'channel'
    };
  }

  registerChannel() {
    return {
      id: 'custom-platform',
      name: 'Custom Platform',
      icon: 'custom-icon',

      // Connection configuration
      connectionFields: [
        { name: 'apiKey', type: 'string', required: true, secret: true },
        { name: 'webhookUrl', type: 'string', required: true }
      ],

      // Message handlers
      connect: this.connect.bind(this),
      disconnect: this.disconnect.bind(this),
      sendMessage: this.sendMessage.bind(this),
      handleWebhook: this.handleWebhook.bind(this)
    };
  }

  async connect(credentials) {
    // Establish connection
    return { success: true, channelId: 'xxx' };
  }

  async disconnect(channelId) {
    // Disconnect channel
  }

  async sendMessage(channelId, message) {
    // Send message to platform
  }

  async handleWebhook(req, res) {
    // Process incoming webhook
  }
}
```

### AI Provider Plugin

Add new AI providers:

```javascript
class CustomAIPlugin extends Plugin {
  static get meta() {
    return {
      id: 'custom-ai',
      name: 'Custom AI Provider',
      type: 'ai-provider'
    };
  }

  registerAIProvider() {
    return {
      id: 'custom-ai',
      name: 'Custom AI',
      models: [
        { id: 'custom-model-1', name: 'Custom Model 1' },
        { id: 'custom-model-2', name: 'Custom Model 2' }
      ],
      configFields: [
        { name: 'apiKey', type: 'string', required: true, secret: true }
      ],
      chat: this.chat.bind(this),
      getEmbedding: this.getEmbedding.bind(this)
    };
  }

  async chat(config, messages, options) {
    // Call AI provider
    return {
      content: 'AI response',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150
      }
    };
  }

  async getEmbedding(config, text) {
    // Generate embedding
    return [0.1, 0.2, 0.3, /* ... */];
  }
}
```

### Action Plugin

Add custom flow actions:

```javascript
class CustomActionsPlugin extends Plugin {
  registerActions() {
    return [
      {
        id: 'send-sms',
        name: 'Send SMS',
        description: 'Send SMS via Twilio',
        category: 'Communication',
        inputs: [
          { name: 'to', type: 'string', label: 'Phone Number' },
          { name: 'message', type: 'text', label: 'Message' }
        ],
        outputs: ['sent', 'failed'],
        execute: this.sendSMS.bind(this)
      },
      {
        id: 'http-request',
        name: 'HTTP Request',
        description: 'Make HTTP request',
        category: 'Integration',
        inputs: [
          { name: 'url', type: 'string', label: 'URL' },
          { name: 'method', type: 'select', options: ['GET', 'POST'] },
          { name: 'body', type: 'json', label: 'Body' }
        ],
        outputs: ['success', 'error'],
        execute: this.httpRequest.bind(this)
      }
    ];
  }

  async sendSMS(context, inputs) {
    const { to, message } = inputs;
    // Send SMS
    return { output: 'sent', data: { messageId: 'xxx' } };
  }

  async httpRequest(context, inputs) {
    const { url, method, body } = inputs;
    // Make HTTP request
    return { output: 'success', data: response };
  }
}
```

---

## Plugin API

### Plugin Context

```javascript
// Available in plugin methods
context = {
  // Logging
  logger: {
    info(message, data),
    warn(message, data),
    error(message, data),
    debug(message, data)
  },

  // Database access
  db: {
    query(sql, params),
    transaction(callback)
  },

  // Redis cache
  cache: {
    get(key),
    set(key, value, ttl),
    del(key)
  },

  // HTTP client
  http: {
    get(url, options),
    post(url, data, options)
  },

  // Event emitter
  events: {
    emit(event, data),
    on(event, handler)
  },

  // Settings
  settings: {
    get(key),
    getAll()
  },

  // Organization
  organization: {
    id,
    name,
    settings
  }
};
```

### Event Hooks

| Hook | Description | Data |
|------|-------------|------|
| `message.received` | Message received | { message, session, bot } |
| `message.beforeSend` | Before sending message | { message, session, bot } |
| `message.sent` | After message sent | { message, session, bot } |
| `session.started` | New session | { session, bot } |
| `session.ended` | Session ended | { session, bot } |
| `bot.created` | Bot created | { bot, user } |
| `bot.updated` | Bot updated | { bot, changes } |
| `bot.deleted` | Bot deleted | { botId } |
| `intent.matched` | Intent detected | { intent, message, session } |

### Database Schema Extension

```javascript
// Define custom tables
async onInit(context) {
  await context.db.query(`
    CREATE TABLE IF NOT EXISTS plugin_my_data (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER REFERENCES organizations(id),
      data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}
```

---

## Testing Plugins

### Unit Testing

```javascript
// tests/plugin.test.js
const MyPlugin = require('../index');
const { createMockContext } = require('@botbuilder/plugin-sdk/testing');

describe('MyPlugin', () => {
  let plugin;
  let mockContext;

  beforeEach(() => {
    mockContext = createMockContext();
    plugin = new MyPlugin();
  });

  test('should initialize correctly', async () => {
    await plugin.onInit(mockContext);
    expect(mockContext.logger.info).toHaveBeenCalled();
  });

  test('should handle message received', async () => {
    const event = {
      message: { content: 'Hello' },
      session: { id: 1 },
      bot: { id: 1 }
    };

    const result = await plugin.onMessageReceived(event);
    expect(result).toBeDefined();
  });

  test('should execute custom action', async () => {
    const context = { session: {}, bot: {} };
    const inputs = { parameter1: 'test' };

    const result = await plugin.executeCustomAction(context, inputs);
    expect(result.output).toBe('success');
  });
});
```

### Integration Testing

```javascript
// tests/integration.test.js
const { TestEnvironment } = require('@botbuilder/plugin-sdk/testing');

describe('MyPlugin Integration', () => {
  let env;

  beforeAll(async () => {
    env = await TestEnvironment.create({
      plugins: ['./index.js'],
      database: 'test_db'
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  test('should work end-to-end', async () => {
    // Create test bot
    const bot = await env.createBot({ name: 'Test Bot' });

    // Send test message
    const response = await env.sendMessage(bot.id, 'Hello');

    expect(response).toBeDefined();
  });
});
```

---

## Publishing Plugins

### Prepare for Publishing

1. **Update package.json:**
```json
{
  "name": "@your-org/botbuilder-plugin-feature",
  "version": "1.0.0",
  "repository": "https://github.com/your-org/plugin",
  "license": "MIT"
}
```

2. **Add README.md** with:
   - Installation instructions
   - Configuration guide
   - Usage examples
   - API documentation

3. **Add LICENSE file**

### Publish to npm

```bash
npm login
npm publish --access public
```

### Submit to Plugin Registry

```bash
# Submit for review
botbuilder plugin submit

# Or via API
POST https://api.botbuilder.com/plugins/submit
{
  "packageName": "@your-org/botbuilder-plugin-feature",
  "version": "1.0.0"
}
```

---

## Examples

### CRM Integration Plugin

```javascript
class CRMPlugin extends Plugin {
  static get meta() {
    return { id: 'crm-integration', name: 'CRM Integration' };
  }

  registerHooks() {
    return {
      'session.started': this.createCRMLead.bind(this),
      'session.ended': this.updateCRMLead.bind(this)
    };
  }

  async createCRMLead(event) {
    const { session } = event;
    const settings = this.context.settings.getAll();

    await this.context.http.post(`${settings.crmUrl}/leads`, {
      headers: { 'Authorization': `Bearer ${settings.apiKey}` },
      body: {
        source: 'chatbot',
        sessionId: session.id,
        contact: session.userInfo
      }
    });
  }

  async updateCRMLead(event) {
    const { session } = event;
    // Update lead with conversation summary
  }
}
```

### Analytics Plugin

```javascript
class AnalyticsPlugin extends Plugin {
  registerHooks() {
    return {
      'message.received': this.trackMessage.bind(this),
      'intent.matched': this.trackIntent.bind(this)
    };
  }

  registerRoutes(router) {
    router.get('/analytics/custom-report', this.getCustomReport.bind(this));
  }

  async trackMessage(event) {
    await this.context.db.query(
      `INSERT INTO plugin_analytics (type, data, created_at)
       VALUES ('message', $1, NOW())`,
      [JSON.stringify(event)]
    );
  }

  async getCustomReport(req, res) {
    const { startDate, endDate } = req.query;

    const result = await this.context.db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM plugin_analytics
       WHERE created_at BETWEEN $1 AND $2
       GROUP BY DATE(created_at)`,
      [startDate, endDate]
    );

    res.json({ success: true, data: result.rows });
  }
}
```

---

## Support

- **SDK Documentation:** https://docs.botbuilder.com/plugins
- **Example Plugins:** https://github.com/botbuilder/example-plugins
- **Developer Forum:** https://community.botbuilder.com
- **Email:** plugins@botbuilder.com
