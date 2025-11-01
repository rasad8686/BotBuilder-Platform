# AI Services

This directory contains all AI-related services for the BotBuilder platform.

## Services Overview

### 1. AIProviderFactory
**Purpose:** Factory pattern for creating AI service instances
**File:** `aiProviderFactory.js`

**Features:**
- Creates OpenAI or Claude service instances
- Provides model configurations and pricing info
- Validates AI configurations
- Lists available models per provider

**Usage:**
```javascript
const { AIProviderFactory } = require('./services/ai');

// Get AI service instance
const aiService = AIProviderFactory.getProvider({
  provider: 'openai',
  apiKey: 'sk-...',
  model: 'gpt-4o-mini'
});

// Get available models
const models = AIProviderFactory.getModelsForProvider('openai');

// Validate configuration
const validation = AIProviderFactory.validateConfig(config);
```

### 2. OpenAIService
**Purpose:** Handles OpenAI API communication
**File:** `openaiService.js`

**Features:**
- Chat completions (standard and streaming)
- Token usage tracking
- Error handling
- Connection testing

**Usage:**
```javascript
const { OpenAIService } = require('./services/ai');

const service = new OpenAIService('sk-...', 'gpt-4o-mini');

// Send chat message
const response = await service.chat({
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  maxTokens: 1000
});

// Streaming
await service.chatStream(
  { messages, temperature, maxTokens },
  (chunk) => console.log(chunk.content),
  (complete) => console.log('Done!', complete),
  (error) => console.error(error)
);
```

### 3. ClaudeService
**Purpose:** Handles Anthropic Claude API communication
**File:** `claudeService.js`

**Features:**
- Chat completions (standard and streaming)
- Message format conversion (OpenAI → Claude)
- Token usage tracking
- Error handling

**Usage:**
```javascript
const { ClaudeService } = require('./services/ai');

const service = new ClaudeService('sk-ant-...', 'claude-3-5-sonnet-20241022');

// Send chat message (same interface as OpenAI)
const response = await service.chat({
  messages: [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello!' }
  ],
  temperature: 0.7,
  maxTokens: 1000
});
```

### 4. AIMessageHandler
**Purpose:** Manages conversation context and history
**File:** `aiMessageHandler.js`

**Features:**
- Build message arrays with conversation context
- Save/retrieve conversation history
- Clear conversations
- Conversation statistics

**Usage:**
```javascript
const { AIMessageHandler } = require('./services/ai');

// Build messages with context
const messages = await AIMessageHandler.buildMessagesWithContext({
  botId: 123,
  sessionId: 'user_456',
  userMessage: 'Hello!',
  systemPrompt: 'You are a helpful assistant.',
  contextWindow: 10
});

// Save message to history
await AIMessageHandler.saveMessage({
  botId: 123,
  sessionId: 'user_456',
  role: 'user',
  content: 'Hello!'
});

// Get conversation history
const history = await AIMessageHandler.getConversationHistory(
  botId,
  sessionId,
  limit
);
```

### 5. AICostCalculator
**Purpose:** Calculate costs for AI API usage
**File:** `aiCostCalculator.js`

**Features:**
- Calculate costs based on token usage
- Support for all OpenAI and Claude models
- Cost estimation before API calls
- Format costs for display

**Usage:**
```javascript
const { AICostCalculator } = require('./services/ai');

// Calculate cost
const cost = AICostCalculator.calculateCost({
  provider: 'openai',
  model: 'gpt-4o-mini',
  promptTokens: 100,
  completionTokens: 50
});

// Estimate cost before calling API
const estimate = AICostCalculator.estimateRequestCost({
  provider: 'openai',
  model: 'gpt-4o-mini',
  promptText: 'Long prompt text...',
  estimatedResponseTokens: 500
});

// Compare model costs
const comparison = AICostCalculator.compareModelCosts({
  promptText: 'Test prompt',
  estimatedResponseTokens: 500
});
```

### 6. EncryptionHelper
**Purpose:** Encrypt/decrypt sensitive data (API keys)
**File:** `encryptionHelper.js`

**Features:**
- AES-256-GCM encryption
- API key masking for display
- API key format validation
- Hash generation (one-way)

**Usage:**
```javascript
const { EncryptionHelper } = require('./services/ai');

// Encrypt API key
const encrypted = EncryptionHelper.encrypt('sk-...');

// Decrypt API key
const decrypted = EncryptionHelper.decrypt(encrypted);

// Mask for display
const masked = EncryptionHelper.maskApiKey('sk-1234567890abcdef');
// Output: "sk-1****************cdef"

// Validate API key format
const validation = EncryptionHelper.validateApiKeyFormat('sk-...', 'openai');
```

## Environment Variables

Required environment variables:

```bash
# AI Encryption (optional - falls back to JWT_SECRET)
AI_ENCRYPTION_SECRET=your-secret-key-here

# Platform API Keys (optional - for platform-wide keys)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Architecture

```
ai/
├── aiProviderFactory.js    # Factory for creating AI service instances
├── openaiService.js         # OpenAI API wrapper
├── claudeService.js         # Claude API wrapper
├── aiMessageHandler.js      # Conversation context management
├── aiCostCalculator.js      # Cost calculation utilities
├── encryptionHelper.js      # Encryption/decryption utilities
├── index.js                 # Centralized exports
└── README.md                # This file
```

## Usage Patterns

### Pattern 1: Send AI Message (Complete Flow)

```javascript
const {
  AIProviderFactory,
  AIMessageHandler,
  AICostCalculator,
  EncryptionHelper
} = require('./services/ai');

async function sendAIMessage(botId, sessionId, userMessage, config) {
  // 1. Decrypt API key
  const apiKey = config.api_key_encrypted
    ? EncryptionHelper.decrypt(config.api_key_encrypted)
    : process.env.OPENAI_API_KEY;

  // 2. Get AI service
  const aiService = AIProviderFactory.getProvider({
    provider: config.provider,
    apiKey: apiKey,
    model: config.model
  });

  // 3. Build messages with context
  const messages = await AIMessageHandler.buildMessagesWithContext({
    botId,
    sessionId,
    userMessage,
    systemPrompt: config.system_prompt,
    contextWindow: config.context_window
  });

  // 4. Send to AI
  const response = await aiService.chat({
    messages,
    temperature: config.temperature,
    maxTokens: config.max_tokens
  });

  // 5. Save to conversation history
  await AIMessageHandler.saveMessage({
    botId,
    sessionId,
    role: 'user',
    content: userMessage
  });

  await AIMessageHandler.saveMessage({
    botId,
    sessionId,
    role: 'assistant',
    content: response.content
  });

  // 6. Calculate cost
  const cost = AICostCalculator.calculateCost({
    provider: config.provider,
    model: config.model,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens
  });

  return {
    content: response.content,
    usage: response.usage,
    cost
  };
}
```

### Pattern 2: Test AI Connection

```javascript
const { AIProviderFactory, EncryptionHelper } = require('./services/ai');

async function testAIConnection(config) {
  const apiKey = config.api_key_encrypted
    ? EncryptionHelper.decrypt(config.api_key_encrypted)
    : null;

  if (!apiKey) {
    return { success: false, error: 'No API key configured' };
  }

  const aiService = AIProviderFactory.getProvider({
    provider: config.provider,
    apiKey: apiKey,
    model: config.model
  });

  return await aiService.testConnection();
}
```

## Testing

Each service has built-in testing capabilities:

```javascript
// Test encryption
const EncryptionHelper = require('./encryptionHelper');
console.log('Encryption test:', EncryptionHelper.testEncryption());

// Test AI connection
const service = new OpenAIService(apiKey, model);
const result = await service.testConnection();
console.log('Connection test:', result);
```

## Error Handling

All services throw enhanced error objects:

```javascript
try {
  const response = await aiService.chat(params);
} catch (error) {
  console.error('Provider:', error.provider);
  console.error('Message:', error.message);
  console.error('Type:', error.type);
  console.error('Status:', error.statusCode);
}
```

## Security Notes

⚠️ **IMPORTANT:**
- API keys are encrypted in the database using AES-256-GCM
- Never log or expose decrypted API keys
- Use masked API keys for display: `EncryptionHelper.maskApiKey()`
- Validate API key format before saving
- Set `AI_ENCRYPTION_SECRET` in production

## Maintenance

### Update Pricing

To update pricing, edit `AICostCalculator.PRICING`:

```javascript
static PRICING = {
  openai: {
    'new-model': {
      input: 1.00,   // per 1M tokens
      output: 3.00   // per 1M tokens
    }
  }
}
```

### Add New Provider

1. Create new service class (e.g., `geminiService.js`)
2. Implement `chat()` and `chatStream()` methods
3. Add to `AIProviderFactory.getProvider()`
4. Add pricing to `AICostCalculator.PRICING`
5. Update `getSupportedProviders()` and `getModelsForProvider()`
