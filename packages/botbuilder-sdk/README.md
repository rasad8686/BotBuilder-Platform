# @botbuilder/sdk

Official JavaScript SDK for BotBuilder API - Enterprise AI Chatbot Platform.

## Installation

```bash
npm install @botbuilder/sdk
```

## Quick Start

```javascript
const BotBuilder = require('@botbuilder/sdk');

// Initialize client
const client = new BotBuilder({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.botbuilder.com' // optional
});

// List bots
const bots = await client.bots.list();
console.log(bots);

// Create a bot
const bot = await client.bots.create({
  name: 'Customer Support Bot',
  platform: 'telegram',
  language: 'en'
});

// Send a message
const response = await client.messages.send(bot.id, {
  message: 'Hello, how can I help you?',
  sessionId: 'session_123'
});

console.log(response.message);
```

## Authentication

You can authenticate using either a JWT token or API key:

```javascript
// Using API Key (recommended for server-side)
const client = new BotBuilder({
  apiKey: 'your-api-key'
});

// Using JWT Token
const client = new BotBuilder({
  token: 'your-jwt-token'
});
```

## Resources

### Bots

```javascript
// List all bots
const bots = await client.bots.list({ page: 1, limit: 10 });

// Get a specific bot
const bot = await client.bots.get(123);

// Create a bot
const newBot = await client.bots.create({
  name: 'My Bot',
  platform: 'telegram',
  language: 'en',
  description: 'A helpful bot'
});

// Update a bot
const updated = await client.bots.update(123, {
  name: 'Updated Name',
  is_active: true
});

// Delete a bot
await client.bots.delete(123);
```

### Messages

```javascript
// Send a message to a bot
const response = await client.messages.send(botId, {
  message: 'Hello!',
  sessionId: 'session_abc'
});

// Get message history
const messages = await client.messages.list(botId, {
  sessionId: 'session_abc',
  limit: 50
});
```

### Autonomous Agents

```javascript
// List agents
const agents = await client.agents.list();

// Create an agent
const agent = await client.agents.create({
  name: 'Research Agent',
  model: 'gpt-4o',
  tools: ['web_search', 'web_scrape']
});

// Execute agent task
const execution = await client.agents.execute(agentId, {
  goal: 'Research AI trends and summarize findings'
});

// Get execution status
const status = await client.agents.getExecution(executionId);
```

### Knowledge Base

```javascript
// List documents
const docs = await client.knowledge.listDocuments(botId);

// Upload a document
const doc = await client.knowledge.uploadDocument(botId, {
  title: 'FAQ Document',
  content: 'Your document content here...'
});

// Query knowledge base
const results = await client.knowledge.query(botId, {
  query: 'How do I reset my password?',
  topK: 5
});
```

### Webhooks

```javascript
// List webhooks
const webhooks = await client.webhooks.list();

// Create a webhook
const webhook = await client.webhooks.create({
  url: 'https://your-server.com/webhook',
  events: ['bot.created', 'message.received']
});

// Delete a webhook
await client.webhooks.delete(webhookId);
```

## Error Handling

```javascript
const { BotBuilderError, AuthenticationError, NotFoundError } = require('@botbuilder/sdk');

try {
  const bot = await client.bots.get(999);
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Bot not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid credentials');
  } else {
    console.log('Unknown error:', error.message);
  }
}
```

## Configuration Options

```javascript
const client = new BotBuilder({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.botbuilder.com', // API base URL
  timeout: 30000,                        // Request timeout (ms)
  retries: 3,                            // Number of retries
  debug: false                           // Enable debug logging
});
```

## TypeScript Support

TypeScript definitions are included:

```typescript
import BotBuilder, { Bot, Message, Agent } from '@botbuilder/sdk';

const client = new BotBuilder({ apiKey: 'your-key' });

const bot: Bot = await client.bots.get(123);
```

## License

MIT
