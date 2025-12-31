# BotBuilder API Documentation

Complete API reference for the BotBuilder platform with 530+ endpoints.

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Bots API](#bots-api)
- [AI API](#ai-api)
- [Knowledge Base API](#knowledge-base-api)
- [Intents API](#intents-api)
- [Entities API](#entities-api)
- [Channels API](#channels-api)
- [Flows API](#flows-api)
- [Messages API](#messages-api)
- [Sessions API](#sessions-api)
- [Analytics API](#analytics-api)
- [Organizations API](#organizations-api)
- [Team API](#team-api)
- [Roles API](#roles-api)
- [SSO API](#sso-api)
- [SCIM API](#scim-api)
- [Billing API](#billing-api)
- [Recovery Engine API](#recovery-engine-api)
- [Workflows API](#workflows-api)
- [Plugins API](#plugins-api)
- [Voice API](#voice-api)
- [Webhooks API](#webhooks-api)
- [Admin API](#admin-api)
- [Widget API](#widget-api)

---

## Overview

### Base URL

```
Development: http://localhost:5000/api
Production:  https://your-domain.com/api
```

### Request Format

All requests should include:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

### Response Format

```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

### Error Format

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

---

## Authentication

### POST /api/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### POST /api/auth/login

Authenticate user and obtain tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### POST /api/auth/logout

Invalidate current session.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /api/auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

### POST /api/auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

### POST /api/auth/reset-password

Reset password with token.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "NewSecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

### GET /api/auth/me

Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

### Two-Factor Authentication

#### POST /api/2fa/setup

Initialize 2FA setup.

**Response:** `200 OK`
```json
{
  "success": true,
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

#### POST /api/2fa/verify

Verify and enable 2FA.

**Request:**
```json
{
  "token": "123456"
}
```

#### POST /api/2fa/disable

Disable 2FA.

**Request:**
```json
{
  "token": "123456"
}
```

---

## Bots API

### GET /api/bots

List all bots for current organization.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| page | integer | Page number (default: 1) |
| limit | integer | Items per page (default: 10, max: 100) |
| search | string | Search by bot name |

**Response:** `200 OK`
```json
{
  "success": true,
  "bots": [
    {
      "id": 1,
      "name": "Customer Support Bot",
      "platform": "telegram",
      "language": "en",
      "is_active": true,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### POST /api/bots

Create a new bot.

**Request:**
```json
{
  "name": "Customer Support Bot",
  "platform": "telegram",
  "language": "en",
  "description": "Handles customer inquiries"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "bot": {
    "id": 1,
    "name": "Customer Support Bot",
    "platform": "telegram",
    "language": "en",
    "api_token": "abc123...",
    "is_active": true
  }
}
```

### GET /api/bots/:id

Get bot details.

**Response:** `200 OK`
```json
{
  "success": true,
  "bot": {
    "id": 1,
    "name": "Customer Support Bot",
    "platform": "telegram",
    "language": "en",
    "description": "Handles customer inquiries",
    "api_token": "abc123...",
    "webhook_url": "https://...",
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### PUT /api/bots/:id

Update bot configuration.

**Request:**
```json
{
  "name": "Updated Bot Name",
  "description": "Updated description",
  "is_active": false
}
```

### DELETE /api/bots/:id

Delete a bot.

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Bot deleted successfully"
}
```

### POST /api/bots/:id/clone

Clone an existing bot.

**Request:**
```json
{
  "name": "Cloned Bot Name"
}
```

---

## AI API

### GET /api/bots/:botId/ai/config

Get AI configuration for a bot.

**Response:** `200 OK`
```json
{
  "success": true,
  "config": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 1000,
    "system_prompt": "You are a helpful assistant...",
    "knowledge_base_id": 1
  }
}
```

### PUT /api/bots/:botId/ai/config

Update AI configuration.

**Request:**
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 1000,
  "system_prompt": "You are a helpful assistant..."
}
```

### POST /api/bots/:botId/ai/chat

Send message to AI and get response.

**Request:**
```json
{
  "message": "Hello, how can I track my order?",
  "session_id": "session-123",
  "context": {}
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "response": "I'd be happy to help you track your order...",
  "sources": [
    {
      "documentName": "FAQ.pdf",
      "similarity": 0.92
    }
  ],
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 80,
    "total_tokens": 230
  }
}
```

### POST /api/ai/providers

List available AI providers.

### GET /api/ai/models/:provider

List models for a provider.

---

## Knowledge Base API

### GET /api/knowledge

List knowledge bases.

**Response:** `200 OK`
```json
{
  "success": true,
  "knowledgeBases": [
    {
      "id": 1,
      "name": "Product FAQ",
      "description": "Product information",
      "document_count": 15,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/knowledge

Create a knowledge base.

**Request:**
```json
{
  "name": "Product FAQ",
  "description": "Product information and FAQs"
}
```

### GET /api/knowledge/:id

Get knowledge base details.

### PUT /api/knowledge/:id

Update knowledge base.

### DELETE /api/knowledge/:id

Delete knowledge base.

### POST /api/knowledge/:id/documents

Upload document to knowledge base.

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | file | PDF, TXT, DOCX, or CSV file |
| name | string | Document name |

### GET /api/knowledge/:id/documents

List documents in knowledge base.

### DELETE /api/knowledge/:id/documents/:docId

Delete a document.

### POST /api/knowledge/:id/search

Search knowledge base.

**Request:**
```json
{
  "query": "How do I return a product?",
  "limit": 5,
  "threshold": 0.7
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "results": [
    {
      "content": "To return a product...",
      "document_name": "Returns Policy.pdf",
      "similarity": 0.92
    }
  ]
}
```

---

## Intents API

### GET /api/intents

List all intents for a bot.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bot_id | integer | Filter by bot |

### POST /api/intents

Create a new intent.

**Request:**
```json
{
  "bot_id": 1,
  "name": "greeting",
  "description": "User greetings",
  "training_phrases": [
    "hello",
    "hi there",
    "good morning"
  ],
  "responses": [
    "Hello! How can I help you today?",
    "Hi there! What can I do for you?"
  ]
}
```

### GET /api/intents/:id

Get intent details.

### PUT /api/intents/:id

Update intent.

### DELETE /api/intents/:id

Delete intent.

### POST /api/intents/:id/train

Train the intent model.

### POST /api/intents/bulk-import

Import intents from file.

### GET /api/intents/export

Export intents to file.

---

## Entities API

### GET /api/entities

List all entities.

### POST /api/entities

Create a new entity.

**Request:**
```json
{
  "bot_id": 1,
  "name": "product_size",
  "type": "list",
  "values": ["small", "medium", "large", "xl"]
}
```

### GET /api/entities/:id

Get entity details.

### PUT /api/entities/:id

Update entity.

### DELETE /api/entities/:id

Delete entity.

---

## Channels API

### GET /api/channels

List connected channels.

### POST /api/channels/telegram/connect

Connect Telegram bot.

**Request:**
```json
{
  "bot_id": 1,
  "bot_token": "123456:ABC-DEF..."
}
```

### POST /api/channels/whatsapp/connect

Connect WhatsApp Business.

**Request:**
```json
{
  "bot_id": 1,
  "phone_number_id": "123456789",
  "access_token": "EAAx...",
  "verify_token": "your-verify-token"
}
```

### POST /api/channels/slack/connect

Connect Slack workspace.

### POST /api/channels/discord/connect

Connect Discord server.

### DELETE /api/channels/:id

Disconnect a channel.

### GET /api/channels/:id/status

Get channel connection status.

---

## Flows API

### GET /api/bots/:botId/flows

List conversation flows for a bot.

### POST /api/bots/:botId/flows

Create a new flow.

**Request:**
```json
{
  "name": "Customer Support Flow",
  "description": "Main support flow",
  "nodes": [
    {
      "id": "start",
      "type": "trigger",
      "data": { "trigger": "intent", "intent": "greeting" }
    },
    {
      "id": "response",
      "type": "message",
      "data": { "text": "Hello! How can I help?" }
    }
  ],
  "edges": [
    { "source": "start", "target": "response" }
  ]
}
```

### GET /api/bots/:botId/flows/:flowId

Get flow details.

### PUT /api/bots/:botId/flows/:flowId

Update flow.

### DELETE /api/bots/:botId/flows/:flowId

Delete flow.

### POST /api/bots/:botId/flows/:flowId/publish

Publish flow to production.

### POST /api/bots/:botId/flows/:flowId/test

Test flow with sample input.

---

## Messages API

### GET /api/messages

List messages with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| bot_id | integer | Filter by bot |
| session_id | string | Filter by session |
| start_date | date | Start date |
| end_date | date | End date |
| page | integer | Page number |
| limit | integer | Items per page |

### GET /api/messages/:id

Get message details.

### DELETE /api/messages/:id

Delete a message.

### GET /api/messages/export

Export messages as CSV/JSON.

---

## Sessions API

### GET /api/sessions

List chat sessions.

### GET /api/sessions/:id

Get session details with messages.

### DELETE /api/sessions/:id

End/delete a session.

### POST /api/sessions/:id/assign

Assign session to agent.

**Request:**
```json
{
  "agent_id": 5
}
```

---

## Analytics API

### GET /api/analytics/overview

Get overview statistics.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| start_date | date | Start date |
| end_date | date | End date |

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "total_messages": 45230,
    "total_sessions": 8420,
    "total_users": 3250,
    "avg_response_time": 1.2,
    "satisfaction_rate": 0.87
  }
}
```

### GET /api/analytics/messages-over-time

Get message volume trends.

### GET /api/analytics/by-bot

Get statistics per bot.

### GET /api/analytics/intents

Get intent usage statistics.

### GET /api/analytics/conversations

Get conversation analytics.

### GET /api/analytics/comprehensive

Get comprehensive analytics report.

### GET /api/analytics/export

Export analytics data.

---

## Organizations API

### GET /api/organizations

List user's organizations.

### POST /api/organizations

Create a new organization.

**Request:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

### GET /api/organizations/:id

Get organization details.

### PUT /api/organizations/:id

Update organization.

### DELETE /api/organizations/:id

Delete organization.

### GET /api/organizations/:id/members

List organization members.

### POST /api/organizations/:id/invite

Invite a member.

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "member"
}
```

### DELETE /api/organizations/:id/members/:userId

Remove a member.

### POST /api/organizations/switch

Switch current organization context.

**Request:**
```json
{
  "organization_id": 2
}
```

---

## Team API

### GET /api/team

List team members.

### POST /api/team/invite

Invite team member.

### PUT /api/team/:userId/role

Update member role.

### DELETE /api/team/:userId

Remove team member.

---

## Roles API

### GET /api/roles

List available roles.

### POST /api/roles

Create custom role.

**Request:**
```json
{
  "name": "Bot Manager",
  "permissions": [
    "bots.read",
    "bots.write",
    "analytics.read"
  ]
}
```

### GET /api/roles/:id

Get role details.

### PUT /api/roles/:id

Update role.

### DELETE /api/roles/:id

Delete role.

---

## SSO API

### GET /api/sso/config

Get SSO configuration.

### POST /api/sso/config

Configure SSO.

**Request (SAML):**
```json
{
  "type": "saml",
  "idp_entity_id": "https://idp.example.com",
  "idp_sso_url": "https://idp.example.com/sso",
  "idp_certificate": "-----BEGIN CERTIFICATE-----..."
}
```

**Request (OIDC):**
```json
{
  "type": "oidc",
  "issuer": "https://auth.example.com",
  "client_id": "...",
  "client_secret": "..."
}
```

### GET /api/sso/login/:domain

Initiate SSO login.

### POST /api/sso/callback

SSO callback endpoint.

### DELETE /api/sso/config

Disable SSO.

---

## SCIM API

SCIM 2.0 compliant endpoints for user provisioning.

### GET /api/scim/v2/Users

List users.

### POST /api/scim/v2/Users

Create user.

### GET /api/scim/v2/Users/:id

Get user.

### PUT /api/scim/v2/Users/:id

Replace user.

### PATCH /api/scim/v2/Users/:id

Update user.

### DELETE /api/scim/v2/Users/:id

Delete user.

### GET /api/scim/v2/Groups

List groups.

### POST /api/scim/v2/Groups

Create group.

---

## Billing API

### GET /api/billing/subscription

Get current subscription.

### POST /api/billing/checkout

Create checkout session.

**Request:**
```json
{
  "plan": "pro",
  "billing_cycle": "monthly"
}
```

### POST /api/billing/portal

Create customer portal session.

### GET /api/billing/usage

Get usage statistics.

### GET /api/billing/invoices

List invoices.

### POST /api/billing/webhook

Stripe webhook endpoint.

---

## Recovery Engine API

### GET /api/recovery/dashboard

Get recovery dashboard stats.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "abandoned_carts": 156,
    "recovered_carts": 42,
    "recovery_rate": 0.27,
    "revenue_recovered": 12500.00,
    "campaigns_active": 5
  }
}
```

### GET /api/recovery/carts

List abandoned carts.

### GET /api/recovery/carts/:id

Get cart details.

### POST /api/recovery/carts/:id/recover

Trigger recovery for a cart.

### GET /api/recovery/campaigns

List recovery campaigns.

### POST /api/recovery/campaigns

Create recovery campaign.

**Request:**
```json
{
  "name": "24h Cart Recovery",
  "trigger": "cart_abandoned",
  "delay_hours": 24,
  "channels": ["email", "whatsapp"],
  "template_id": 1
}
```

### GET /api/recovery/customers

List customers with health scores.

### GET /api/recovery/customers/:id

Get customer health details.

### GET /api/recovery/analytics

Get recovery analytics.

---

## Workflows API

### GET /api/workflows

List workflows.

### POST /api/workflows

Create workflow.

**Request:**
```json
{
  "name": "Welcome Sequence",
  "trigger": {
    "type": "event",
    "event": "user.created"
  },
  "steps": [
    {
      "type": "delay",
      "duration": "1h"
    },
    {
      "type": "email",
      "template_id": 1
    }
  ]
}
```

### GET /api/workflows/:id

Get workflow details.

### PUT /api/workflows/:id

Update workflow.

### DELETE /api/workflows/:id

Delete workflow.

### POST /api/workflows/:id/activate

Activate workflow.

### POST /api/workflows/:id/deactivate

Deactivate workflow.

### POST /api/workflows/:id/execute

Manually execute workflow.

### GET /api/workflows/:id/executions

List workflow executions.

---

## Plugins API

### GET /api/plugins

List available plugins.

### GET /api/plugins/installed

List installed plugins.

### POST /api/plugins/:id/install

Install a plugin.

### DELETE /api/plugins/:id/uninstall

Uninstall a plugin.

### GET /api/plugins/:id/config

Get plugin configuration.

### PUT /api/plugins/:id/config

Update plugin configuration.

---

## Voice API

### POST /api/voice/text-to-speech

Convert text to speech.

**Request:**
```json
{
  "text": "Hello, how can I help you?",
  "language": "en-US",
  "voice": "en-US-Wavenet-D"
}
```

**Response:** Audio file (base64 or URL)

### POST /api/voice/speech-to-text

Convert speech to text.

**Content-Type:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| audio | file | Audio file (WAV, MP3, etc.) |
| language | string | Language code |

### POST /api/voice/call/initiate

Initiate a voice call (Twilio).

### POST /api/voice/call/webhook

Handle voice call webhook.

### GET /api/voice/calls

List call history.

---

## Webhooks API

### GET /api/webhooks

List configured webhooks.

### POST /api/webhooks

Create webhook.

**Request:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["message.received", "bot.deployed"],
  "secret": "webhook-secret"
}
```

### GET /api/webhooks/:id

Get webhook details.

### PUT /api/webhooks/:id

Update webhook.

### DELETE /api/webhooks/:id

Delete webhook.

### POST /api/webhooks/:id/test

Test webhook.

### GET /api/webhooks/:id/logs

Get webhook delivery logs.

---

## Admin API

Super admin endpoints for platform management.

### GET /api/admin/users

List all platform users.

### GET /api/admin/organizations

List all organizations.

### GET /api/admin/stats

Get platform statistics.

### POST /api/admin/users/:id/suspend

Suspend a user.

### POST /api/admin/users/:id/activate

Activate a user.

### GET /api/admin/audit-logs

Get system audit logs.

### POST /api/admin/broadcast

Send broadcast message.

---

## Widget API

### GET /api/widget/:botId/config

Get widget configuration.

### POST /api/widget/:botId/init

Initialize widget session.

### POST /api/widget/:botId/message

Send message via widget.

### GET /api/widget/:botId/history

Get chat history.

---

## Webhook Events

Available webhook events:

| Event | Description |
|-------|-------------|
| `message.received` | New message received |
| `message.sent` | Message sent by bot |
| `session.started` | New chat session started |
| `session.ended` | Chat session ended |
| `bot.created` | New bot created |
| `bot.updated` | Bot configuration updated |
| `bot.deleted` | Bot deleted |
| `bot.deployed` | Bot deployed to channel |
| `intent.matched` | Intent matched |
| `user.created` | New user registered |
| `subscription.updated` | Subscription changed |

---

## SDKs

Official SDKs available:

- **JavaScript/Node.js:** `npm install @botbuilder/sdk`
- **Python:** `pip install botbuilder-sdk`

---

## Support

- **API Status:** https://status.botbuilder.com
- **Email:** api-support@botbuilder.com
- **Swagger UI:** http://localhost:5000/api-docs
