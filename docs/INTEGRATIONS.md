# Platform Integrations Guide

Complete guide for integrating BotBuilder with messaging platforms and third-party services.

---

## Table of Contents

- [Overview](#overview)
- [Telegram Integration](#telegram-integration)
- [WhatsApp Integration](#whatsapp-integration)
- [Slack Integration](#slack-integration)
- [Discord Integration](#discord-integration)
- [Web Widget](#web-widget)
- [AI Providers](#ai-providers)
- [Email Integration](#email-integration)
- [Voice Integration](#voice-integration)
- [Webhook Integration](#webhook-integration)

---

## Overview

BotBuilder supports multiple messaging platforms and integrations:

| Platform | Type | Status |
|----------|------|--------|
| Telegram | Messaging | Full Support |
| WhatsApp | Messaging | Full Support |
| Slack | Messaging | Full Support |
| Discord | Messaging | Full Support |
| Instagram | Messaging | Beta |
| Web Widget | Embed | Full Support |
| OpenAI | AI Provider | Full Support |
| Anthropic | AI Provider | Full Support |
| Twilio | Voice | Full Support |
| SendGrid | Email | Full Support |

---

## Telegram Integration

### Prerequisites

- Telegram account
- BotFather bot token

### Step 1: Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow prompts to name your bot
4. Save the API token provided

### Step 2: Connect in BotBuilder

```http
POST /api/channels/telegram/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "bot_id": 1,
  "bot_token": "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
}
```

### Step 3: Configure Webhook

BotBuilder automatically sets up the webhook. Manual configuration:

```http
POST https://api.telegram.org/bot<TOKEN>/setWebhook
{
  "url": "https://your-domain.com/api/webhooks/telegram/<bot_id>"
}
```

### Telegram Features

| Feature | Support |
|---------|---------|
| Text Messages | Yes |
| Images | Yes |
| Documents | Yes |
| Voice Messages | Yes |
| Inline Keyboards | Yes |
| Reply Keyboards | Yes |
| Commands | Yes |
| Groups | Yes |

### Example: Inline Keyboard

```javascript
// In flow node configuration
{
  "type": "message",
  "data": {
    "text": "Choose an option:",
    "reply_markup": {
      "inline_keyboard": [
        [
          { "text": "Option 1", "callback_data": "opt1" },
          { "text": "Option 2", "callback_data": "opt2" }
        ]
      ]
    }
  }
}
```

---

## WhatsApp Integration

### Prerequisites

- Meta Business Account
- WhatsApp Business API access
- Verified business phone number

### Step 1: Meta Business Setup

1. Go to [Meta Business Suite](https://business.facebook.com)
2. Create or select a Business Account
3. Add WhatsApp to your business
4. Create a WhatsApp Business App
5. Get your Phone Number ID and Access Token

### Step 2: Connect in BotBuilder

```http
POST /api/channels/whatsapp/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "bot_id": 1,
  "phone_number_id": "1234567890",
  "access_token": "EAAxxxxxxx...",
  "verify_token": "your-custom-verify-token"
}
```

### Step 3: Configure Webhook in Meta

1. Go to App Dashboard > WhatsApp > Configuration
2. Set Callback URL: `https://your-domain.com/api/webhooks/whatsapp`
3. Set Verify Token: (same as above)
4. Subscribe to: `messages`, `message_templates`

### WhatsApp Features

| Feature | Support |
|---------|---------|
| Text Messages | Yes |
| Template Messages | Yes |
| Images | Yes |
| Documents | Yes |
| Location | Yes |
| Contacts | Yes |
| Interactive Buttons | Yes |
| List Messages | Yes |

### Message Templates

WhatsApp requires pre-approved templates for business-initiated messages:

```http
POST /api/channels/whatsapp/templates
{
  "bot_id": 1,
  "name": "order_update",
  "language": "en",
  "category": "UTILITY",
  "components": [
    {
      "type": "BODY",
      "text": "Your order {{1}} has been shipped!"
    }
  ]
}
```

### Send Template Message

```http
POST /api/channels/whatsapp/send-template
{
  "bot_id": 1,
  "to": "1234567890",
  "template": "order_update",
  "parameters": ["ORD-12345"]
}
```

---

## Slack Integration

### Prerequisites

- Slack workspace
- Admin permissions to install apps

### Step 1: Create Slack App

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From scratch"
4. Name your app and select workspace

### Step 2: Configure OAuth & Permissions

Add these OAuth scopes:
- `chat:write`
- `channels:read`
- `groups:read`
- `im:read`
- `im:write`
- `users:read`

### Step 3: Enable Event Subscriptions

1. Go to Event Subscriptions
2. Enable Events
3. Set Request URL: `https://your-domain.com/api/webhooks/slack`
4. Subscribe to events:
   - `message.im`
   - `message.channels`
   - `app_mention`

### Step 4: Connect in BotBuilder

```http
POST /api/channels/slack/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "bot_id": 1,
  "client_id": "xxxxx.xxxxx",
  "client_secret": "xxxxxxxxxxxxx",
  "signing_secret": "xxxxxxxxxxxxx",
  "bot_token": "xoxb-xxxxx-xxxxx"
}
```

### Slack Features

| Feature | Support |
|---------|---------|
| Direct Messages | Yes |
| Channel Messages | Yes |
| Blocks | Yes |
| Interactive Components | Yes |
| Slash Commands | Yes |
| Modal Views | Yes |
| File Uploads | Yes |

### Example: Block Kit Message

```javascript
{
  "type": "message",
  "data": {
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Welcome!* How can I help you today?"
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "Get Help" },
            "action_id": "help_button"
          }
        ]
      }
    ]
  }
}
```

---

## Discord Integration

### Prerequisites

- Discord server
- Admin permissions

### Step 1: Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Create a Bot user
4. Enable "Message Content Intent"

### Step 2: Get Bot Token

1. Go to Bot section
2. Copy the token
3. Enable required intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### Step 3: Connect in BotBuilder

```http
POST /api/channels/discord/connect
Authorization: Bearer <token>
Content-Type: application/json

{
  "bot_id": 1,
  "bot_token": "MTxxxxxx.xxxxxx.xxxxxx",
  "application_id": "123456789012345678"
}
```

### Step 4: Invite Bot to Server

Generate invite URL with permissions:
```
https://discord.com/api/oauth2/authorize?client_id=<APPLICATION_ID>&permissions=274877958144&scope=bot
```

### Discord Features

| Feature | Support |
|---------|---------|
| Text Messages | Yes |
| Embeds | Yes |
| Reactions | Yes |
| Slash Commands | Yes |
| Buttons | Yes |
| Select Menus | Yes |

---

## Web Widget

### Embedding the Widget

Add to your website:

```html
<script>
  window.BotBuilderConfig = {
    botId: 'your-bot-id',
    apiUrl: 'https://api.your-domain.com',
    theme: {
      primaryColor: '#007bff',
      headerText: 'Chat with us',
      position: 'right'
    }
  };
</script>
<script src="https://your-domain.com/widget.js" async></script>
```

### Widget Configuration Options

```javascript
window.BotBuilderConfig = {
  // Required
  botId: 'your-bot-id',
  apiUrl: 'https://api.your-domain.com',

  // Appearance
  theme: {
    primaryColor: '#007bff',
    backgroundColor: '#ffffff',
    textColor: '#333333',
    headerText: 'Chat Support',
    placeholderText: 'Type a message...',
    position: 'right', // 'left' or 'right'
    width: '400px',
    height: '600px'
  },

  // Behavior
  autoOpen: false,
  openDelay: 5000, // ms
  showOnMobile: true,
  persistSession: true,

  // Events
  onOpen: function() { console.log('Widget opened'); },
  onClose: function() { console.log('Widget closed'); },
  onMessage: function(msg) { console.log('New message:', msg); }
};
```

### Widget API

```javascript
// Open widget
window.BotBuilder.open();

// Close widget
window.BotBuilder.close();

// Send message programmatically
window.BotBuilder.sendMessage('Hello!');

// Set user info
window.BotBuilder.setUser({
  name: 'John Doe',
  email: 'john@example.com',
  customField: 'value'
});

// Clear conversation
window.BotBuilder.clearHistory();
```

---

## AI Providers

### OpenAI Integration

#### Configuration

```http
PUT /api/bots/:botId/ai/config
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 1000,
  "system_prompt": "You are a helpful assistant..."
}
```

#### Available Models

| Model | Description | Cost |
|-------|-------------|------|
| gpt-4 | Most capable | $$$ |
| gpt-4-turbo | Faster, cheaper | $$ |
| gpt-3.5-turbo | Fast, economical | $ |

#### Using Organization API Key

```http
PUT /api/bots/:botId/ai/config
{
  "provider": "openai",
  "api_key": "sk-..."  // Encrypted storage
}
```

### Anthropic (Claude) Integration

#### Configuration

```http
PUT /api/bots/:botId/ai/config
{
  "provider": "anthropic",
  "model": "claude-3-sonnet",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### Available Models

| Model | Description |
|-------|-------------|
| claude-3-opus | Most capable |
| claude-3-sonnet | Balanced |
| claude-3-haiku | Fast |

---

## Email Integration

### SendGrid Setup

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
```

### SMTP Configuration

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_SECURE=false
EMAIL_FROM=noreply@your-domain.com
```

### Send Email via API

```http
POST /api/email/send
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "template": "welcome",
  "data": {
    "name": "John"
  }
}
```

---

## Voice Integration

### Twilio Setup

```env
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

### Initiate Call

```http
POST /api/voice/call/initiate
{
  "to": "+1234567890",
  "bot_id": 1,
  "script_id": 1
}
```

### Voice Features

| Feature | Support |
|---------|---------|
| Outbound Calls | Yes |
| Inbound Calls | Yes |
| Speech Recognition | Yes |
| Text-to-Speech | Yes |
| Call Recording | Yes |
| DTMF Input | Yes |

### Text-to-Speech

```http
POST /api/voice/text-to-speech
{
  "text": "Hello, welcome to our service.",
  "language": "en-US",
  "voice": "en-US-Wavenet-D"
}
```

### Speech-to-Text

```http
POST /api/voice/speech-to-text
Content-Type: multipart/form-data

file: <audio-file>
language: en-US
```

---

## Webhook Integration

### Configure Webhooks

```http
POST /api/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": [
    "message.received",
    "message.sent",
    "session.started",
    "session.ended",
    "bot.deployed"
  ],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "message.received",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "message_id": 123,
    "bot_id": 1,
    "session_id": 456,
    "content": "Hello!",
    "sender_type": "user"
  }
}
```

### Verify Webhook Signature

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return `sha256=${expectedSignature}` === signature;
}
```

### Available Events

| Event | Description |
|-------|-------------|
| message.received | New message from user |
| message.sent | Bot sent a message |
| session.started | New conversation started |
| session.ended | Conversation ended |
| bot.created | New bot created |
| bot.updated | Bot configuration changed |
| bot.deleted | Bot deleted |
| bot.deployed | Bot deployed to channel |
| intent.matched | Intent detected |
| handoff.requested | Human handoff requested |

---

## Testing Integrations

### Test Telegram Webhook

```bash
curl -X POST https://your-domain.com/api/webhooks/telegram/1 \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123,
    "message": {
      "message_id": 1,
      "from": {"id": 123, "first_name": "Test"},
      "chat": {"id": 123, "type": "private"},
      "text": "Hello"
    }
  }'
```

### Test Webhook Delivery

```http
POST /api/webhooks/:id/test
```

### View Webhook Logs

```http
GET /api/webhooks/:id/logs
```

---

## Troubleshooting

### Common Issues

1. **Webhook not receiving messages**
   - Verify webhook URL is accessible
   - Check SSL certificate
   - Verify domain is whitelisted

2. **Authentication errors**
   - Check API keys/tokens
   - Verify permissions

3. **Rate limiting**
   - Implement exponential backoff
   - Cache frequent requests

For more help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
