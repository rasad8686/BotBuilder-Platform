# AI Routes Documentation

Complete API documentation for AI integration endpoints.

## Base URL

```
http://localhost:5000/api
```

Production:
```
https://botbuilder-platform.onrender.com/api
```

---

## Authentication

All routes marked **(Auth Required)** need:

**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
X-Organization-ID: YOUR_ORG_ID
```

---

## 📋 Table of Contents

1. [Public Routes](#public-routes)
2. [AI Configuration](#ai-configuration)
3. [AI Chat](#ai-chat)
4. [AI Usage & Billing](#ai-usage--billing)

---

## Public Routes

### Get Available Providers

Get list of all available AI providers.

**Endpoint:** `GET /ai/providers`

**Auth:** Not required

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "id": "openai",
      "name": "Openai",
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o",
          "description": "Most capable model, best for complex tasks",
          "contextWindow": 128000,
          "maxTokens": 16384,
          "pricing": {
            "input": 2.50,
            "output": 10.00
          }
        }
      ]
    },
    {
      "id": "claude",
      "name": "Claude",
      "models": [...]
    }
  ]
}
```

### Get Models for Provider

Get available models for a specific provider.

**Endpoint:** `GET /ai/models/:provider`

**Auth:** Not required

**Parameters:**
- `provider` - Provider name (`openai` or `claude`)

**Example:** `GET /ai/models/openai`

**Response:**
```json
{
  "success": true,
  "provider": "openai",
  "models": [
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4o Mini",
      "description": "Fast and affordable, great for simple tasks",
      "contextWindow": 128000,
      "maxTokens": 16384,
      "pricing": {
        "input": 0.150,
        "output": 0.600
      }
    }
  ]
}
```

---

## AI Configuration

### Get AI Configuration

Get AI configuration for a bot.

**Endpoint:** `GET /bots/:botId/ai/configure`

**Auth:** Required (viewer or higher)

**Response:**
```json
{
  "success": true,
  "config": {
    "id": 1,
    "bot_id": 123,
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 1000,
    "system_prompt": "You are a helpful assistant.",
    "context_window": 10,
    "enable_streaming": true,
    "is_enabled": true,
    "has_custom_key": true,
    "created_at": "2025-01-02T10:00:00Z",
    "updated_at": "2025-01-02T10:00:00Z"
  },
  "availableModels": [...]
}
```

### Create/Update AI Configuration

Configure AI for a bot.

**Endpoint:** `POST /bots/:botId/ai/configure`

**Auth:** Required (member or higher)

**Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "api_key": "sk-...",
  "temperature": 0.7,
  "max_tokens": 1000,
  "system_prompt": "You are a helpful customer support assistant.",
  "context_window": 10,
  "enable_streaming": true,
  "is_enabled": true
}
```

**Fields:**
- `provider` **(required)** - `openai` or `claude`
- `model` **(required)** - Model identifier
- `api_key` (optional) - Custom API key (BYO key). If not provided, uses platform key
- `temperature` (optional) - 0.0 to 2.0, default 0.7
- `max_tokens` (optional) - Max response length, default 1000
- `system_prompt` (optional) - System instruction, default "You are a helpful assistant."
- `context_window` (optional) - Number of previous messages to include, 0-100, default 10
- `enable_streaming` (optional) - Enable streaming responses, default true
- `is_enabled` (optional) - Enable/disable AI, default true

**Response:**
```json
{
  "success": true,
  "message": "AI configuration created successfully",
  "config": {...}
}
```

### Delete AI Configuration

Delete AI configuration for a bot.

**Endpoint:** `DELETE /bots/:botId/ai/configure`

**Auth:** Required (admin only)

**Response:**
```json
{
  "success": true,
  "message": "AI configuration deleted successfully"
}
```

### Test AI Connection

Test if AI configuration works.

**Endpoint:** `POST /bots/:botId/ai/test`

**Auth:** Required (viewer or higher)

**Response:**
```json
{
  "success": true,
  "test": {
    "success": true,
    "provider": "openai",
    "model": "gpt-4o-mini",
    "message": "Connection successful",
    "testResponse": "OK"
  }
}
```

---

## AI Chat

### Send Chat Message

Send a message to AI and get response.

**Endpoint:** `POST /bots/:botId/ai/chat`

**Auth:** Required (member or higher)

**Body:**
```json
{
  "message": "Hello, how can you help me?",
  "sessionId": "user_12345"
}
```

**Fields:**
- `message` **(required)** - User message text
- `sessionId` **(required)** - Unique session identifier for context tracking

**Response:**
```json
{
  "success": true,
  "response": "Hello! I'm here to help you. How can I assist you today?",
  "usage": {
    "promptTokens": 150,
    "completionTokens": 25,
    "totalTokens": 175
  },
  "cost": 0.000123,
  "responseTime": 1234
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "AI is not configured or enabled for this bot"
}
```

---

## AI Usage & Billing

### Get Bot Usage Statistics

Get AI usage statistics for a bot.

**Endpoint:** `GET /bots/:botId/ai/usage`

**Auth:** Required (viewer or higher)

**Query Parameters:**
- `startDate` (optional) - Filter from date (ISO 8601)
- `endDate` (optional) - Filter to date (ISO 8601)
- `limit` (optional) - Max records to return, default 50

**Example:** `GET /bots/123/ai/usage?limit=10&startDate=2025-01-01`

**Response:**
```json
{
  "success": true,
  "usage": [
    {
      "id": 1,
      "provider": "openai",
      "model": "gpt-4o-mini",
      "prompt_tokens": 150,
      "completion_tokens": 25,
      "total_tokens": 175,
      "cost_usd": 0.000123,
      "response_time_ms": 1234,
      "status": "success",
      "created_at": "2025-01-02T10:00:00Z"
    }
  ],
  "summary": {
    "totalRequests": 100,
    "totalPromptTokens": 15000,
    "totalCompletionTokens": 2500,
    "totalTokens": 17500,
    "totalCost": 0.0123,
    "avgResponseTime": 1200.5,
    "successfulRequests": 98,
    "failedRequests": 2
  }
}
```

### Get Organization Billing

Get AI billing information for entire organization.

**Endpoint:** `GET /organizations/:orgId/ai/billing`

**Auth:** Required (viewer or higher)

**Response:**
```json
{
  "success": true,
  "currentMonth": {
    "totalRequests": 500,
    "totalTokens": 75000,
    "totalCost": 1.23,
    "byProvider": [
      {
        "provider": "openai",
        "total_requests": "300",
        "total_tokens": "45000",
        "total_cost": "0.75",
        "requests_per_provider": "300"
      },
      {
        "provider": "claude",
        "total_requests": "200",
        "total_tokens": "30000",
        "total_cost": "0.48",
        "requests_per_provider": "200"
      }
    ]
  },
  "allTime": {
    "totalRequests": 5000,
    "totalTokens": 750000,
    "totalCost": 12.34
  },
  "daily": [
    {
      "date": "2025-01-02",
      "requests": 50,
      "tokens": 7500,
      "cost": 0.12
    }
  ]
}
```

---

## Error Codes

**400 Bad Request**
- Invalid request parameters
- Missing required fields
- Invalid configuration

**401 Unauthorized**
- Missing or invalid JWT token

**403 Forbidden**
- Insufficient permissions

**404 Not Found**
- Bot not found
- Configuration not found

**500 Internal Server Error**
- Server error
- AI API error

---

## Example Workflow

### 1. Setup AI for a Bot

```bash
# Get available providers and models
curl http://localhost:5000/api/ai/providers

# Configure AI for bot
curl -X POST http://localhost:5000/api/bots/123/ai/configure \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "model": "gpt-4o-mini",
    "api_key": "sk-...",
    "system_prompt": "You are a helpful customer support assistant.",
    "temperature": 0.7,
    "max_tokens": 1000,
    "context_window": 10
  }'

# Test connection
curl -X POST http://localhost:5000/api/bots/123/ai/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID"
```

### 2. Send Chat Messages

```bash
# Send first message
curl -X POST http://localhost:5000/api/bots/123/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello!",
    "sessionId": "user_123"
  }'

# Send follow-up (with context)
curl -X POST http://localhost:5000/api/bots/123/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What did I just say?",
    "sessionId": "user_123"
  }'
```

### 3. Monitor Usage

```bash
# Get bot usage
curl http://localhost:5000/api/bots/123/ai/usage?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID"

# Get organization billing
curl http://localhost:5000/api/organizations/456/ai/billing \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Organization-ID: YOUR_ORG_ID"
```

---

## Security Notes

⚠️ **IMPORTANT:**
- API keys are encrypted in the database using AES-256-GCM
- Never expose decrypted API keys in responses
- Use HTTPS in production
- Rate limit AI endpoints to prevent abuse
- Monitor usage to prevent unexpected costs

---

## Cost Management

### Typical Costs (as of January 2025)

**OpenAI GPT-4o Mini** (Recommended for most use cases)
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens
- Average conversation: ~$0.0001 - $0.001

**Claude 3.5 Sonnet** (Best reasoning)
- Input: $3.00 / 1M tokens
- Output: $15.00 / 1M tokens
- Average conversation: ~$0.001 - $0.01

**Tips to reduce costs:**
1. Use `gpt-4o-mini` or `claude-3-5-haiku` for simple tasks
2. Reduce `context_window` if full history not needed
3. Set appropriate `max_tokens` limits
4. Monitor usage regularly
5. Implement rate limiting

---

## Support

For issues or questions:
- Check logs: `console.error` messages in backend
- Verify API keys are valid
- Ensure bot belongs to organization
- Check RBAC permissions
- Review usage logs in database
