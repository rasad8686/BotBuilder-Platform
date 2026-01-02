# BotBuilder SDK for JavaScript

Official JavaScript/Node.js SDK for the BotBuilder API.

## Installation

```bash
npm install botbuilder-sdk
```

## Quick Start

```javascript
const BotBuilder = require('botbuilder-sdk');

const client = new BotBuilder({
  apiKey: 'your-api-key'
});

// Create a bot
const bot = await client.bots.create({
  name: 'My Bot',
  description: 'A helpful assistant'
});

// Send a message
const response = await client.messages.send({
  botId: bot.id,
  message: 'Hello!'
});
```

## Configuration

```javascript
const client = new BotBuilder({
  apiKey: 'your-api-key',     // Required
  baseUrl: 'https://api.botbuilder.com', // Optional
  timeout: 30000              // Optional (ms)
});
```

## Available Resources

- `client.bots` - Bot management
- `client.messages` - Message sending/receiving
- `client.knowledge` - Knowledge base management
- `client.analytics` - Analytics and metrics
- `client.webhooks` - Webhook configuration

## API Reference

### Bots

```javascript
// List all bots
const bots = await client.bots.list();

// Get a specific bot
const bot = await client.bots.get('bot-id');

// Create a bot
const newBot = await client.bots.create({ name: 'My Bot' });

// Update a bot
await client.bots.update('bot-id', { name: 'Updated Name' });

// Delete a bot
await client.bots.delete('bot-id');
```

### Messages

```javascript
// Send a message
const response = await client.messages.send({
  botId: 'bot-id',
  message: 'Hello!',
  userId: 'user-123'
});

// List messages
const messages = await client.messages.list('bot-id', {
  limit: 50,
  offset: 0
});
```

### Knowledge Base

```javascript
// Upload a document
const doc = await client.knowledge.upload(fileBuffer, {
  name: 'document.pdf',
  botId: 'bot-id'
});

// List documents
const docs = await client.knowledge.list({ botId: 'bot-id' });

// Delete a document
await client.knowledge.delete('doc-id');
```

## Error Handling

```javascript
try {
  const bot = await client.bots.get('invalid-id');
} catch (error) {
  if (error.response) {
    console.error('API Error:', error.response.status, error.response.data);
  } else {
    console.error('Network Error:', error.message);
  }
}
```

## License

MIT
