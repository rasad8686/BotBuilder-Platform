# BotBuilder API Reference

Complete API documentation for all 1200+ endpoints in the BotBuilder platform.

**Version:** 2.0.0
**Base URL:** `https://api.botbuilder.com/api` (Production) | `http://localhost:5000/api` (Development)
**Interactive Docs:** `/api-docs` (Swagger UI)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Bots API](#bots-api)
4. [AI API](#ai-api)
5. [Autonomous Agents API](#autonomous-agents-api)
6. [Knowledge Base API](#knowledge-base-api)
7. [Channels API](#channels-api)
8. [Messages API](#messages-api)
9. [Analytics API](#analytics-api)
10. [Voice API](#voice-api)
11. [Clone API](#clone-api)
12. [Fine-Tuning API](#fine-tuning-api)
13. [Organizations API](#organizations-api)
14. [Team API](#team-api)
15. [Roles API](#roles-api)
16. [SSO API](#sso-api)
17. [SCIM API](#scim-api)
18. [Billing API](#billing-api)
19. [API Tokens API](#api-tokens-api)
20. [Webhooks API](#webhooks-api)
21. [Plugins API](#plugins-api)
22. [Marketplace API](#marketplace-api)
23. [Forum API](#forum-api)
24. [Blog API](#blog-api)
25. [Admin API](#admin-api)
26. [WebSocket Events](#websocket-events)
27. [GraphQL API](#graphql-api)
28. [Error Codes](#error-codes)
29. [Executions API](#executions-api)
30. [Orchestrations API](#orchestrations-api)
31. [Alerts API](#alerts-api)
32. [Rate Limits API](#rate-limits-api)
33. [Workspaces API](#workspaces-api)
34. [Regions API](#regions-api)
35. [SLA API](#sla-api)
36. [Custom Domains API](#custom-domains-api)
37. [Affiliate API](#affiliate-api)
38. [Enterprise Contracts API](#enterprise-contracts-api)
39. [Versions API](#versions-api)

---

## Overview

### Request Format

All requests must include:

```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Organization-ID: <org_id>  (optional, for multi-org)
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### Pagination

List endpoints support pagination:

```
GET /api/bots?page=1&limit=20&sort=created_at&order=desc
```

Response includes:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Rate Limiting

| Tier | Requests/Min | Requests/Day |
|------|-------------|--------------|
| Free | 20 | 1,000 |
| Pro | 100 | 10,000 |
| Enterprise | 500 | 100,000 |

Headers returned:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

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
  "message": "Registration successful. Please verify your email.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### POST /api/auth/login

Authenticate user and get tokens.

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
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

### POST /api/auth/refresh

Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### POST /api/auth/logout

Revoke current session.

### POST /api/auth/logout-all

Revoke all sessions for user.

### POST /api/auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
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

### GET /api/auth/verify-email/:token

Verify email address.

### POST /api/auth/resend-verification

Resend verification email.

---

## Bots API

Base Path: `/api/bots`

### GET /api/bots

List all bots for current organization.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20) |
| search | string | Search by name |
| status | string | Filter by status (active/inactive) |

**Response:**
```json
{
  "success": true,
  "bots": [
    {
      "id": 1,
      "name": "Support Bot",
      "description": "Customer support assistant",
      "language": "en",
      "status": "active",
      "created_at": "2025-01-15T10:30:00Z",
      "message_count": 15420
    }
  ],
  "pagination": { ... }
}
```

### POST /api/bots

Create a new bot.

**Request:**
```json
{
  "name": "Support Bot",
  "description": "Customer support assistant",
  "language": "en",
  "ai_provider": "openai",
  "ai_model": "gpt-4",
  "system_prompt": "You are a helpful support assistant.",
  "temperature": 0.7,
  "max_tokens": 500
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Bot created successfully",
  "bot": {
    "id": 1,
    "name": "Support Bot",
    "webhook_url": "https://api.botbuilder.com/webhooks/abc123"
  }
}
```

### GET /api/bots/:id

Get bot details.

### PUT /api/bots/:id

Update bot configuration.

### DELETE /api/bots/:id

Delete a bot.

### POST /api/bots/:id/duplicate

Duplicate a bot.

### POST /api/bots/:id/export

Export bot configuration.

### POST /api/bots/:id/import

Import bot configuration.

---

## AI API

Base Path: `/api/ai` and `/api/bots/:botId/ai`

### POST /api/bots/:botId/ai/chat

Send message to bot and get AI response.

**Request:**
```json
{
  "message": "What are your business hours?",
  "session_id": "user-session-123",
  "context": {
    "user_name": "John",
    "previous_topic": "pricing"
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "Our business hours are Monday-Friday, 9 AM to 6 PM EST.",
  "session_id": "user-session-123",
  "tokens_used": {
    "prompt": 45,
    "completion": 23,
    "total": 68
  },
  "sources": [
    {
      "document": "FAQ.pdf",
      "chunk_id": 15,
      "relevance": 0.92
    }
  ]
}
```

### GET /api/bots/:botId/ai/config

Get AI configuration for bot.

### PUT /api/bots/:botId/ai/config

Update AI configuration.

**Request:**
```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "system_prompt": "You are a helpful assistant.",
  "temperature": 0.7,
  "max_tokens": 1000,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

### GET /api/ai/models

List available AI models.

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "name": "openai",
      "models": [
        { "id": "gpt-4", "name": "GPT-4", "max_tokens": 8192 },
        { "id": "gpt-4-turbo", "name": "GPT-4 Turbo", "max_tokens": 128000 },
        { "id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "max_tokens": 16385 }
      ]
    },
    {
      "name": "anthropic",
      "models": [
        { "id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "max_tokens": 200000 }
      ]
    }
  ]
}
```

### POST /api/ai/test

Test AI configuration without saving.

---

## Autonomous Agents API

Base Path: `/api/autonomous`

### GET /api/autonomous/agents

List all autonomous agents.

### POST /api/autonomous/agents

Create an autonomous agent.

**Request:**
```json
{
  "name": "Research Agent",
  "description": "Performs web research tasks",
  "goal": "Research competitors and create summary reports",
  "tools": ["web_browser", "file_write"],
  "constraints": [
    "Only visit business websites",
    "Maximum 10 pages per search"
  ],
  "memory_enabled": true,
  "max_iterations": 50
}
```

### GET /api/autonomous/agents/:id

Get agent details.

### PUT /api/autonomous/agents/:id

Update agent configuration.

### DELETE /api/autonomous/agents/:id

Delete an agent.

### POST /api/autonomous/agents/:id/execute

Execute an agent task.

**Request:**
```json
{
  "task": "Research top 5 competitors in the CRM space",
  "parameters": {
    "output_format": "markdown",
    "max_sources": 10
  }
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "exec-abc123",
  "status": "running"
}
```

### GET /api/autonomous/agents/:id/executions

List agent executions.

### GET /api/autonomous/executions/:executionId

Get execution details and results.

### POST /api/autonomous/executions/:executionId/stop

Stop a running execution.

### GET /api/autonomous/tools

List available tools for agents.

**Response:**
```json
{
  "success": true,
  "tools": [
    {
      "id": "web_browser",
      "name": "Web Browser",
      "description": "Browse and search the web",
      "parameters": ["url", "query"]
    },
    {
      "id": "email",
      "name": "Email",
      "description": "Send emails",
      "parameters": ["to", "subject", "body"]
    },
    {
      "id": "http",
      "name": "HTTP Request",
      "description": "Make API requests",
      "parameters": ["method", "url", "headers", "body"]
    }
  ]
}
```

### POST /api/autonomous/agents/:id/schedule

Schedule recurring agent execution.

**Request:**
```json
{
  "cron": "0 9 * * 1",
  "task": "Weekly competitor analysis",
  "enabled": true
}
```

---

## Knowledge Base API

Base Path: `/api/knowledge`

### GET /api/knowledge/bases

List all knowledge bases.

### POST /api/knowledge/bases

Create a knowledge base.

**Request:**
```json
{
  "name": "Product Documentation",
  "description": "Product manuals and FAQs",
  "bot_id": 1
}
```

### GET /api/knowledge/bases/:id

Get knowledge base details.

### PUT /api/knowledge/bases/:id

Update knowledge base.

### DELETE /api/knowledge/bases/:id

Delete knowledge base and all documents.

### POST /api/knowledge/bases/:id/documents

Upload document to knowledge base.

**Request:** `multipart/form-data`
- `file`: PDF, DOCX, TXT, or MD file
- `metadata`: JSON object with custom metadata

### GET /api/knowledge/bases/:id/documents

List documents in knowledge base.

### DELETE /api/knowledge/bases/:id/documents/:docId

Delete a document.

### POST /api/knowledge/bases/:id/search

Search knowledge base.

**Request:**
```json
{
  "query": "How do I reset my password?",
  "limit": 5,
  "threshold": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "chunk_id": 45,
      "document_name": "FAQ.pdf",
      "content": "To reset your password, go to Settings > Security...",
      "relevance": 0.94,
      "metadata": {
        "page": 12,
        "section": "Account Management"
      }
    }
  ]
}
```

### POST /api/knowledge/bases/:id/reindex

Reindex all documents (regenerate embeddings).

---

## Channels API

Base Path: `/api/channels`

### GET /api/channels

List all connected channels.

### POST /api/channels

Connect a new channel.

**Request (Telegram):**
```json
{
  "type": "telegram",
  "bot_id": 1,
  "config": {
    "token": "123456:ABC-DEF..."
  }
}
```

**Request (Discord):**
```json
{
  "type": "discord",
  "bot_id": 1,
  "config": {
    "token": "MTEzNzU...",
    "guild_ids": ["123456789"]
  }
}
```

**Request (WhatsApp):**
```json
{
  "type": "whatsapp",
  "bot_id": 1,
  "config": {
    "phone_number_id": "123456789",
    "access_token": "EAAGm...",
    "verify_token": "my-verify-token"
  }
}
```

### GET /api/channels/:id

Get channel details.

### PUT /api/channels/:id

Update channel configuration.

### DELETE /api/channels/:id

Disconnect channel.

### POST /api/channels/:id/test

Test channel connection.

### GET /api/channels/:id/stats

Get channel statistics.

---

## Messages API

Base Path: `/api/messages`

### GET /api/bots/:botId/messages

Get message history for a bot.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| session_id | string | Filter by session |
| channel | string | Filter by channel |
| start_date | string | Start date (ISO 8601) |
| end_date | string | End date (ISO 8601) |

### GET /api/messages/:id

Get single message details.

### DELETE /api/messages/:id

Delete a message.

### POST /api/messages/export

Export messages to CSV/JSON.

**Request:**
```json
{
  "bot_id": 1,
  "format": "csv",
  "start_date": "2025-01-01",
  "end_date": "2025-01-31"
}
```

---

## Analytics API

Base Path: `/api/analytics`

### GET /api/analytics/overview

Get analytics overview.

**Query Parameters:**
- `bot_id` (optional): Filter by bot
- `period`: day, week, month, year
- `start_date`: ISO 8601 date
- `end_date`: ISO 8601 date

**Response:**
```json
{
  "success": true,
  "data": {
    "total_messages": 45230,
    "total_users": 1250,
    "avg_response_time": 1.2,
    "resolution_rate": 0.78,
    "sentiment_score": 0.82
  }
}
```

### GET /api/analytics/messages

Get message volume over time.

### GET /api/analytics/users

Get user analytics.

### GET /api/analytics/conversations

Get conversation analytics.

### GET /api/analytics/performance

Get bot performance metrics.

### GET /api/analytics/channels

Get per-channel analytics.

### POST /api/analytics/export

Export analytics data.

### GET /api/analyticsAdvanced/anomalies

Detect anomalies in metrics.

### GET /api/analyticsAdvanced/predictions

Get predictive analytics.

### GET /api/analyticsAdvanced/cohorts

Get cohort analysis.

---

## Voice API

Base Path: `/api/voice`

### GET /api/voice/bots

List voice bots.

### POST /api/voice/bots

Create voice bot.

**Request:**
```json
{
  "name": "Phone Support",
  "bot_id": 1,
  "voice": {
    "provider": "google",
    "language": "en-US",
    "voice_name": "en-US-Neural2-C",
    "speed": 1.0,
    "pitch": 0
  },
  "phone_number": "+1234567890"
}
```

### GET /api/voice/bots/:id

Get voice bot details.

### PUT /api/voice/bots/:id

Update voice bot.

### DELETE /api/voice/bots/:id

Delete voice bot.

### POST /api/voice/calls

Initiate outbound call.

**Request:**
```json
{
  "voice_bot_id": 1,
  "to": "+1234567890",
  "context": {
    "customer_name": "John",
    "purpose": "appointment_reminder"
  }
}
```

### GET /api/voice/calls

List call history.

### GET /api/voice/calls/:id

Get call details with transcript.

### POST /api/voice/tts

Text-to-speech conversion.

**Request:**
```json
{
  "text": "Hello, how can I help you today?",
  "voice": "en-US-Neural2-C",
  "format": "mp3"
}
```

### POST /api/voice/stt

Speech-to-text conversion.

**Request:** `multipart/form-data`
- `audio`: Audio file (WAV, MP3, OGG)
- `language`: Language code

---

## Clone API

Base Path: `/api/clone`

### GET /api/clone/profiles

List clone profiles.

### POST /api/clone/profiles

Create clone profile (voice/personality/style).

**Request:**
```json
{
  "name": "Customer Service Voice",
  "type": "voice",
  "samples": ["sample1.wav", "sample2.wav"],
  "settings": {
    "pitch": 0,
    "speed": 1.0
  }
}
```

### GET /api/clone/profiles/:id

Get clone profile details.

### POST /api/clone/profiles/:id/train

Start training job.

### GET /api/clone/jobs

List training jobs.

### GET /api/clone/jobs/:id

Get training job status.

### POST /api/clone/generate

Generate content using clone.

**Request:**
```json
{
  "profile_id": 1,
  "text": "Welcome to our support line.",
  "type": "voice"
}
```

---

## Fine-Tuning API

Base Path: `/api/fine-tuning`

### GET /api/fine-tuning/jobs

List fine-tuning jobs.

### POST /api/fine-tuning/jobs

Create fine-tuning job.

**Request:**
```json
{
  "name": "Customer Support Model",
  "base_model": "gpt-3.5-turbo",
  "dataset_id": 1,
  "hyperparameters": {
    "n_epochs": 3,
    "batch_size": 4,
    "learning_rate_multiplier": 0.1
  }
}
```

### GET /api/fine-tuning/jobs/:id

Get job details.

### DELETE /api/fine-tuning/jobs/:id

Cancel fine-tuning job.

### GET /api/fine-tuning/datasets

List training datasets.

### POST /api/fine-tuning/datasets

Upload training dataset.

**Request:** `multipart/form-data`
- `file`: JSONL file with training examples
- `name`: Dataset name

**JSONL Format:**
```json
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```

### GET /api/fine-tuning/models

List fine-tuned models.

### DELETE /api/fine-tuning/models/:id

Delete fine-tuned model.

---

## Organizations API

Base Path: `/api/organizations`

### GET /api/organizations

List user's organizations.

### POST /api/organizations

Create organization.

**Request:**
```json
{
  "name": "Acme Inc",
  "slug": "acme",
  "settings": {
    "timezone": "America/New_York",
    "language": "en"
  }
}
```

### GET /api/organizations/:id

Get organization details.

### PUT /api/organizations/:id

Update organization.

### DELETE /api/organizations/:id

Delete organization (owner only).

### GET /api/organizations/:id/members

List organization members.

### POST /api/organizations/:id/members

Add member to organization.

### DELETE /api/organizations/:id/members/:userId

Remove member.

### PUT /api/organizations/:id/members/:userId/role

Change member role.

---

## Team API

Base Path: `/api/team`

### GET /api/team

List team members.

### POST /api/team/invite

Invite team member.

**Request:**
```json
{
  "email": "newmember@example.com",
  "role": "member",
  "message": "Join our team!"
}
```

### GET /api/team/invitations

List pending invitations.

### DELETE /api/team/invitations/:id

Cancel invitation.

### POST /api/team/invitations/:token/accept

Accept invitation.

### DELETE /api/team/:userId

Remove team member.

### PUT /api/team/:userId/role

Change member role.

---

## Roles API

Base Path: `/api/roles`

### GET /api/roles

List available roles.

**Response:**
```json
{
  "success": true,
  "roles": [
    {
      "id": 1,
      "name": "admin",
      "permissions": ["*"]
    },
    {
      "id": 2,
      "name": "member",
      "permissions": ["bots:read", "bots:write", "analytics:read"]
    },
    {
      "id": 3,
      "name": "viewer",
      "permissions": ["bots:read", "analytics:read"]
    }
  ]
}
```

### POST /api/roles

Create custom role (Enterprise).

### PUT /api/roles/:id

Update role permissions.

### DELETE /api/roles/:id

Delete custom role.

---

## SSO API

Base Path: `/api/sso`

### GET /api/sso/configurations

List SSO configurations.

### POST /api/sso/configurations

Create SSO configuration.

**Request (SAML):**
```json
{
  "type": "saml",
  "name": "Corporate SSO",
  "settings": {
    "entry_point": "https://idp.example.com/sso",
    "issuer": "https://botbuilder.com",
    "certificate": "-----BEGIN CERTIFICATE-----..."
  }
}
```

**Request (OIDC):**
```json
{
  "type": "oidc",
  "name": "Google Workspace",
  "settings": {
    "client_id": "...",
    "client_secret": "...",
    "authorization_url": "...",
    "token_url": "...",
    "userinfo_url": "..."
  }
}
```

### GET /api/sso/configurations/:id

Get SSO configuration.

### PUT /api/sso/configurations/:id

Update SSO configuration.

### DELETE /api/sso/configurations/:id

Delete SSO configuration.

### GET /api/sso/:provider/login

Initiate SSO login.

### POST /api/sso/:provider/callback

SSO callback endpoint.

---

## SCIM API

Base Path: `/scim/v2`

SCIM 2.0 compliant endpoints for user provisioning.

### GET /scim/v2/Users

List users (SCIM format).

### POST /scim/v2/Users

Create user via SCIM.

### GET /scim/v2/Users/:id

Get user.

### PUT /scim/v2/Users/:id

Replace user.

### PATCH /scim/v2/Users/:id

Update user attributes.

### DELETE /scim/v2/Users/:id

Deactivate user.

### GET /scim/v2/Groups

List groups.

### POST /scim/v2/Groups

Create group.

### GET /scim/v2/ServiceProviderConfig

Get SCIM configuration.

### GET /scim/v2/Schemas

Get supported schemas.

---

## Billing API

Base Path: `/api/billing`

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

Get Stripe customer portal URL.

### GET /api/billing/invoices

List invoices.

### GET /api/billing/usage

Get usage statistics.

### POST /api/billing/webhook

Stripe webhook endpoint.

---

## API Tokens API

Base Path: `/api/api-tokens`

### GET /api/api-tokens

List API tokens.

### POST /api/api-tokens

Create API token.

**Request:**
```json
{
  "name": "Production API Key",
  "expires_at": "2026-01-01T00:00:00Z",
  "permissions": ["bots:read", "bots:write"],
  "ip_allowlist": ["192.168.1.0/24"],
  "spending_limit": {
    "amount": 100,
    "period": "monthly"
  }
}
```

**Response:**
```json
{
  "success": true,
  "token": "bb_live_abc123...",
  "message": "Token created. This is the only time you'll see the full token."
}
```

### GET /api/api-tokens/:id

Get token details (masked).

### PUT /api/api-tokens/:id

Update token settings.

### DELETE /api/api-tokens/:id

Revoke token.

### POST /api/api-tokens/:id/rotate

Rotate token.

### GET /api/api-tokens/:id/usage

Get token usage statistics.

---

## Webhooks API

Base Path: `/api/webhooks`

### GET /api/webhooks

List webhook subscriptions.

### POST /api/webhooks

Create webhook subscription.

**Request:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["message.received", "bot.deployed"],
  "secret": "your-webhook-secret"
}
```

### GET /api/webhooks/:id

Get webhook details.

### PUT /api/webhooks/:id

Update webhook.

### DELETE /api/webhooks/:id

Delete webhook.

### GET /api/webhooks/:id/logs

Get delivery logs.

### POST /api/webhooks/:id/test

Send test event.

### Webhook Events

| Event | Description |
|-------|-------------|
| `message.received` | New message received |
| `message.sent` | Bot sent a message |
| `conversation.started` | New conversation |
| `conversation.ended` | Conversation ended |
| `bot.deployed` | Bot deployed |
| `bot.error` | Bot encountered error |
| `agent.completed` | Agent task completed |
| `user.created` | New user registered |

---

## Plugins API

Base Path: `/api/plugins`

### GET /api/plugins

List available plugins.

### GET /api/plugins/:id

Get plugin details.

### POST /api/plugins/:id/install

Install plugin.

### DELETE /api/plugins/:id/uninstall

Uninstall plugin.

### PUT /api/plugins/:id/config

Configure plugin.

### GET /api/plugins/installed

List installed plugins.

---

## Marketplace API

Base Path: `/api/marketplace`

### GET /api/marketplace/items

List marketplace items.

### GET /api/marketplace/items/:id

Get item details.

### POST /api/marketplace/items/:id/purchase

Purchase item.

### GET /api/marketplace/purchases

List user purchases.

### POST /api/marketplace/items

Submit item for sale (developers).

### GET /api/marketplace/categories

List categories.

---

## Forum API

Base Path: `/api/forum`

### GET /api/forum/topics

List forum topics.

### POST /api/forum/topics

Create topic.

### GET /api/forum/topics/:id

Get topic with replies.

### POST /api/forum/topics/:id/replies

Add reply.

### POST /api/forum/topics/:id/like

Like topic.

### GET /api/forum/categories

List forum categories.

---

## Blog API

Base Path: `/api/blog`

### GET /api/blog/posts

List blog posts.

### GET /api/blog/posts/:id

Get blog post.

### POST /api/blog/posts

Create post (admin).

### PUT /api/blog/posts/:id

Update post.

### DELETE /api/blog/posts/:id

Delete post.

### GET /api/blog/categories

List categories.

---

## Admin API

Base Path: `/api/admin` and `/api/superadmin`

### GET /api/admin/users

List all users (admin only).

### GET /api/admin/stats

Get platform statistics.

### POST /api/admin/users/:id/suspend

Suspend user.

### POST /api/admin/users/:id/unsuspend

Unsuspend user.

### GET /api/superadmin/organizations

List all organizations.

### GET /api/superadmin/metrics

Get system metrics.

### POST /api/superadmin/announcements

Create system announcement.

---

## WebSocket Events

Connect: `wss://api.botbuilder.com` or `ws://localhost:5000`

### Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  path: '/ws',
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Voice Streaming

```javascript
// Start voice session
socket.emit('voice:start', {
  botId: 'bot-id',
  language: 'en-US'
});

// Send audio chunk
socket.emit('voice:audio', {
  chunk: audioBuffer
});

// Receive transcript
socket.on('voice:transcript', (data) => {
  console.log(data.text, data.isFinal);
});

// Stop session
socket.emit('voice:stop');
```

### Widget Messaging

```javascript
// Join widget room
socket.emit('widget:join', {
  botId: 'bot-id',
  sessionId: 'user-session'
});

// Send message
socket.emit('widget:message', {
  text: 'Hello!'
});

// Receive message
socket.on('widget:message', (msg) => {
  console.log(msg.text, msg.isBot);
});

// Typing indicator
socket.emit('widget:typing', { isTyping: true });
```

### Agent Execution

```javascript
// Subscribe to execution updates
socket.emit('execution:subscribe', {
  executionId: 'exec-id'
});

// Receive updates
socket.on('execution:update', (data) => {
  console.log(data.step, data.status, data.output);
});

// Execution completed
socket.on('execution:complete', (data) => {
  console.log(data.result);
});
```

---

## GraphQL API

Endpoint: `POST /graphql`

### Schema

```graphql
type Query {
  bots(page: Int, limit: Int): BotConnection!
  bot(id: ID!): Bot
  messages(botId: ID!, limit: Int): [Message!]!
  analytics(botId: ID, period: String!): Analytics!
  me: User!
}

type Mutation {
  createBot(input: CreateBotInput!): Bot!
  updateBot(id: ID!, input: UpdateBotInput!): Bot!
  deleteBot(id: ID!): Boolean!
  sendMessage(botId: ID!, message: String!): Message!
}

type Subscription {
  messageReceived(botId: ID!): Message!
  botStatusChanged(botId: ID!): BotStatus!
}

type Bot {
  id: ID!
  name: String!
  description: String
  status: String!
  messages: [Message!]!
  analytics: Analytics!
}
```

### Example Query

```graphql
query GetBotWithMessages {
  bot(id: "1") {
    id
    name
    status
    messages(limit: 10) {
      id
      content
      createdAt
    }
    analytics {
      totalMessages
      avgResponseTime
    }
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `QUOTA_EXCEEDED` | 402 | Usage quota exceeded |
| `SERVER_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `AI_ERROR` | 502 | AI provider error |
| `CHANNEL_ERROR` | 502 | Channel provider error |

---

## SDK Examples

### JavaScript SDK

Install the official JavaScript SDK:

```bash
npm install @botbuilder/sdk
```

**Basic Usage:**

```javascript
const BotBuilder = require('@botbuilder/sdk');

// Initialize client
const client = new BotBuilder({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.botbuilder.com'
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

// List agents
const agents = await client.agents.list();

// Query knowledge base
const results = await client.knowledge.query(botId, {
  query: 'How do I reset my password?',
  topK: 5
});
```

**Error Handling:**

```javascript
const { BotBuilderError, NotFoundError, AuthenticationError } = require('@botbuilder/sdk');

try {
  const bot = await client.bots.get(999);
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Bot not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid credentials');
  }
}
```

See full SDK documentation: [packages/botbuilder-sdk/README.md](../packages/botbuilder-sdk/README.md)

### cURL

```bash
# List bots
curl -X GET "https://api.botbuilder.com/api/bots" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Send message
curl -X POST "https://api.botbuilder.com/api/bots/1/ai/chat" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "session_id": "user-123"}'
```

---

## Executions API

Base Path: `/api/executions`

Manage and monitor workflow and agent executions.

### GET /api/executions

Get executions list with filters.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| bot_id | number | Yes | Bot ID to filter executions |
| workflow_id | number | No | Filter by workflow |
| status | string | No | Filter by status |
| start_date | string | No | Start date filter |
| end_date | string | No | End date filter |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "bot_id": 1,
      "workflow_id": 5,
      "status": "completed",
      "started_at": "2025-01-15T10:30:00Z",
      "completed_at": "2025-01-15T10:35:00Z"
    }
  ]
}
```

### GET /api/executions/:id

Get execution details.

**Authentication:** Required

**Response:**
```json
{
  "id": 1,
  "bot_id": 1,
  "workflow_id": 5,
  "status": "completed",
  "input": {},
  "output": {},
  "started_at": "2025-01-15T10:30:00Z",
  "completed_at": "2025-01-15T10:35:00Z"
}
```

### GET /api/executions/:id/steps

Get execution steps.

**Authentication:** Required

**Response:**
```json
[
  {
    "id": 1,
    "execution_id": 1,
    "step_name": "process_input",
    "status": "completed",
    "output": {},
    "started_at": "2025-01-15T10:30:00Z"
  }
]
```

### GET /api/executions/:id/messages

Get agent messages for an execution.

**Authentication:** Required

**Response:**
```json
[
  {
    "id": 1,
    "execution_id": 1,
    "role": "assistant",
    "content": "Processing your request...",
    "created_at": "2025-01-15T10:30:00Z"
  }
]
```

### DELETE /api/executions/:id

Delete execution record.

**Authentication:** Required

**Response:**
```json
{
  "message": "Execution deleted successfully"
}
```

---

## Orchestrations API

Base Path: `/api/orchestrations`

Manage flow orchestrations and transitions between workflows.

### GET /api/orchestrations

List orchestrations for a bot.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| bot_id | number | Yes | Bot ID |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bot_id": 1,
      "name": "Main Orchestration",
      "entry_flow_id": 1,
      "description": "Main conversation flow"
    }
  ]
}
```

### POST /api/orchestrations

Create orchestration.

**Authentication:** Required

**Request:**
```json
{
  "bot_id": 1,
  "name": "Main Orchestration",
  "entry_flow_id": 1,
  "description": "Main conversation flow"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bot_id": 1,
    "name": "Main Orchestration"
  }
}
```

### GET /api/orchestrations/:id

Get orchestration details.

**Authentication:** Required

### PUT /api/orchestrations/:id

Update orchestration.

**Authentication:** Required

### DELETE /api/orchestrations/:id

Delete orchestration.

**Authentication:** Required

### GET /api/orchestrations/:id/transitions

Get transitions for orchestration.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "orchestration_id": 1,
      "from_flow_id": 1,
      "to_flow_id": 2,
      "trigger_type": "intent",
      "trigger_value": {"intent": "transfer"},
      "priority": 0
    }
  ]
}
```

### POST /api/orchestrations/:id/transitions

Add transition.

**Authentication:** Required

**Request:**
```json
{
  "from_flow_id": 1,
  "to_flow_id": 2,
  "trigger_type": "intent",
  "trigger_value": {"intent": "transfer"},
  "priority": 0
}
```

### DELETE /api/orchestrations/:id/transitions/:transitionId

Remove transition.

**Authentication:** Required

### GET /api/orchestrations/:id/variables

Get orchestration variables.

**Authentication:** Required

### POST /api/orchestrations/:id/variables

Add variable to orchestration.

**Authentication:** Required

**Request:**
```json
{
  "name": "user_context",
  "type": "object",
  "default_value": {},
  "scope": "session"
}
```

### POST /api/orchestrations/:id/execute

Execute orchestration.

**Authentication:** Required

**Request:**
```json
{
  "session_id": "session-123",
  "input": {
    "message": "Hello"
  }
}
```

---

## Alerts API

Base Path: `/api/alerts`

Manage usage alerts and notifications.

### GET /api/alerts

Get all alerts for current user/organization.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "alerts": [
    {
      "id": 1,
      "name": "Spending Alert",
      "alert_type": "spending",
      "threshold_value": 100,
      "threshold_type": "absolute",
      "notification_channels": ["email", "slack"],
      "is_active": true
    }
  ]
}
```

### POST /api/alerts

Create a new alert.

**Authentication:** Required

**Request:**
```json
{
  "name": "Spending Alert",
  "alert_type": "spending",
  "threshold_value": 100,
  "threshold_type": "absolute",
  "notification_channels": ["email", "webhook"],
  "webhook_url": "https://your-server.com/alerts",
  "slack_channel": "#alerts",
  "is_active": true
}
```

**Alert Types:**
- `spending` - Budget alerts
- `rate_limit` - Rate limit warnings
- `usage` - Usage threshold alerts
- `error_rate` - Error rate alerts

**Threshold Types:**
- `absolute` - Fixed value
- `percentage` - Percentage of limit

**Notification Channels:**
- `email` - Email notification
- `webhook` - Custom webhook
- `slack` - Slack channel

**Response:** `201 Created`
```json
{
  "success": true,
  "alert": {
    "id": 1,
    "name": "Spending Alert",
    "alert_type": "spending"
  }
}
```

### PUT /api/alerts/:id

Update an existing alert.

**Authentication:** Required

### DELETE /api/alerts/:id

Delete an alert.

**Authentication:** Required

### GET /api/alerts/:id/history

Get trigger history for an alert.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 50 | Max results |
| offset | number | 0 | Offset for pagination |

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "alert_id": 1,
      "triggered_at": "2025-01-15T10:30:00Z",
      "value": 105,
      "notification_sent": ["email"]
    }
  ],
  "total": 10
}
```

### POST /api/alerts/test/:id

Send a test notification for an alert.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Test notification sent",
  "results": {
    "email": "sent",
    "webhook": "sent"
  }
}
```

---

## Rate Limits API

Base Path: `/api/rate-limits`

Get rate limit status and tier information.

### GET /api/rate-limits/status

Get current rate limit status for authenticated user.

**Authentication:** Required

**Response:**
```json
{
  "tier": "pro",
  "limits": {
    "requests_per_minute": 100,
    "requests_per_day": 10000,
    "current_minute": 45,
    "current_day": 2500
  },
  "reset_at": {
    "minute": "2025-01-15T10:31:00Z",
    "day": "2025-01-16T00:00:00Z"
  },
  "percentage_used": {
    "minute": 45.0,
    "day": 25.0
  }
}
```

### GET /api/rate-limits/tiers

Get all available tier limits for comparison.

**Authentication:** Required

**Response:**
```json
{
  "tiers": [
    {
      "name": "free",
      "displayName": "Free",
      "limits": {
        "requests_per_minute": 20,
        "requests_per_day": 1000
      },
      "features": [
        "Basic API access",
        "20 requests/minute",
        "Community support"
      ]
    },
    {
      "name": "pro",
      "displayName": "Pro",
      "limits": {
        "requests_per_minute": 100,
        "requests_per_day": 10000
      },
      "features": [
        "Full API access",
        "Priority support",
        "Webhook integrations"
      ]
    },
    {
      "name": "enterprise",
      "displayName": "Enterprise",
      "limits": {
        "requests_per_minute": 500,
        "requests_per_day": 100000
      },
      "features": [
        "Unlimited API access",
        "Dedicated support",
        "SLA guarantee"
      ]
    }
  ]
}
```

---

## Workspaces API

Base Path: `/api/workspaces`

Manage team workspaces and resources.

### GET /api/workspaces

Get all workspaces for user's organization.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "workspaces": [
    {
      "id": 1,
      "name": "Production",
      "slug": "production",
      "description": "Production bots and APIs",
      "isDefault": true,
      "userRole": "owner",
      "memberCount": 5,
      "resourceCount": 12
    }
  ]
}
```

### POST /api/workspaces

Create new workspace.

**Authentication:** Required

**Request:**
```json
{
  "name": "Development",
  "description": "Development and testing",
  "settings": {
    "visibility": "private"
  }
}
```

### GET /api/workspaces/:id

Get workspace details.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "workspace": {
    "id": 1,
    "name": "Production",
    "slug": "production",
    "members": [
      {
        "userId": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "role": "owner"
      }
    ],
    "resources": [
      {
        "id": 1,
        "resourceType": "bot",
        "resourceId": 1
      }
    ]
  }
}
```

### PUT /api/workspaces/:id

Update workspace.

**Authentication:** Required (Admin or Owner)

### DELETE /api/workspaces/:id

Delete workspace.

**Authentication:** Required (Owner only)

### POST /api/workspaces/:id/members

Add member to workspace.

**Authentication:** Required (Admin or Owner)

**Request:**
```json
{
  "email": "newmember@example.com",
  "role": "editor"
}
```

**Valid Roles:** `admin`, `editor`, `viewer`

### PUT /api/workspaces/:id/members/:memberId

Update member role.

**Authentication:** Required (Owner only)

### DELETE /api/workspaces/:id/members/:memberId

Remove member from workspace.

**Authentication:** Required

### POST /api/workspaces/:id/resources

Add resource to workspace.

**Authentication:** Required (Editor+)

**Request:**
```json
{
  "resourceType": "bot",
  "resourceId": 1
}
```

**Valid Resource Types:** `bot`, `api_token`, `webhook`, `integration`

### DELETE /api/workspaces/:id/resources/:resourceId

Remove resource from workspace.

**Authentication:** Required (Editor+)

---

## Regions API

Base Path: `/api/regions`

Manage data regions and bot deployments.

### GET /api/regions

Get list of all available regions.

**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "regions": [
    {
      "code": "us-east-1",
      "name": "US East (N. Virginia)",
      "endpoint": "https://us-east-1.api.botbuilder.com",
      "status": "active",
      "isDefault": true
    },
    {
      "code": "eu-west-1",
      "name": "EU West (Ireland)",
      "endpoint": "https://eu-west-1.api.botbuilder.com",
      "status": "active",
      "isDefault": false
    }
  ],
  "default": "us-east-1"
}
```

### GET /api/regions/:region/status

Get region health status.

**Authentication:** Not required

**Response:**
```json
{
  "success": true,
  "region": {
    "code": "us-east-1",
    "name": "US East (N. Virginia)",
    "status": "active",
    "health": "healthy",
    "latency": 25,
    "lastChecked": "2025-01-15T10:30:00Z"
  }
}
```

### GET /api/regions/latency-test

Test latency to all regions.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "region": "us-east-1",
      "name": "US East",
      "latency": 25,
      "status": "healthy"
    }
  ],
  "recommended": "us-east-1"
}
```

### PUT /api/regions/organization

Update organization's primary region.

**Authentication:** Required

**Request:**
```json
{
  "primaryRegion": "eu-west-1",
  "allowedRegions": ["eu-west-1", "us-east-1"]
}
```

### PUT /api/regions/bot/:botId

Update bot's region (migrate bot).

**Authentication:** Required

**Request:**
```json
{
  "region": "eu-west-1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bot migrated from us-east-1 to eu-west-1",
  "migration": {
    "botId": 1,
    "fromRegion": "us-east-1",
    "toRegion": "eu-west-1",
    "migratedAt": "2025-01-15T10:30:00Z"
  }
}
```

### GET /api/regions/organization/settings

Get organization's region settings.

**Authentication:** Required

---

## SLA API

Base Path: `/api/sla`

SLA dashboard and reporting for enterprise customers.

### GET /api/sla/config

Get current SLA configuration.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "enterprise",
    "uptime_target": 99.9,
    "response_time_target": 500,
    "support_tier": "premium"
  }
}
```

### GET /api/sla/dashboard

Get SLA dashboard data.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "current_month": {
      "uptime": 99.95,
      "avg_response_time": 320,
      "incidents": 2,
      "sla_met": true
    },
    "year_to_date": {
      "uptime": 99.92,
      "credits_earned": 0
    }
  }
}
```

### GET /api/sla/history

Get historical SLA metrics.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| months | number | 12 | Number of months |

### GET /api/sla/credits

Get SLA credit history.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "credits": [
      {
        "id": 1,
        "period": "2025-01",
        "breach_type": "uptime",
        "credit_amount": 50.00,
        "status": "approved"
      }
    ],
    "totals": {
      "pending": 0,
      "approved": 50.00,
      "applied": 100.00
    }
  }
}
```

### GET /api/sla/report/:period

Get monthly SLA report.

**Authentication:** Required

**Path Parameters:**
- `period` - Month in YYYY-MM format

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| format | string | json | Output format (json, pdf) |

### GET /api/sla/uptime/:period

Get uptime metrics for a specific period.

**Authentication:** Required

### GET /api/sla/daily-uptime

Get daily uptime for current month.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| year | number | Year |
| month | number | Month (1-12) |

---

## Custom Domains API

Base Path: `/api/custom-domains`

Manage custom domains for widget, API, and portal.

### GET /api/custom-domains

Get all custom domains for the organization.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "domain": "chat.example.com",
      "type": "widget",
      "status": "active",
      "ssl_status": "active",
      "ssl_expires_at": "2026-01-15T00:00:00Z",
      "verified_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### POST /api/custom-domains

Add a new custom domain.

**Authentication:** Required

**Request:**
```json
{
  "domain": "chat.example.com",
  "type": "widget",
  "verificationMethod": "cname"
}
```

**Domain Types:** `widget`, `api`, `portal`
**Verification Methods:** `cname`, `txt`

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": 1,
    "domain": "chat.example.com",
    "status": "pending",
    "verification_token": "botbuilder-verify-abc123",
    "dnsRecords": [
      {
        "type": "CNAME",
        "name": "chat",
        "value": "custom.botbuilder.com"
      }
    ]
  }
}
```

### GET /api/custom-domains/:id

Get domain details.

**Authentication:** Required

### PUT /api/custom-domains/:id

Update domain settings.

**Authentication:** Required

### DELETE /api/custom-domains/:id

Remove a custom domain.

**Authentication:** Required

### POST /api/custom-domains/:id/verify

Trigger DNS verification.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "routingConfigured": true,
    "message": "Domain verified successfully"
  }
}
```

### POST /api/custom-domains/:id/ssl

Request SSL certificate.

**Authentication:** Required

### GET /api/custom-domains/:id/dns-records

Get required DNS records for domain setup.

**Authentication:** Required

---

## Affiliate API

Base Path: `/api/affiliate`

Affiliate program management.

### GET /api/affiliate/r/:slug

Track affiliate click and redirect.

**Authentication:** Not required

**Note:** Sets affiliate tracking cookies and redirects to destination URL.

### GET /api/affiliate/account

Get affiliate account details.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "affiliate": {
    "id": 1,
    "affiliate_code": "ABC123",
    "status": "active",
    "commission_rate": 20,
    "total_earnings": 1500.00,
    "pending_balance": 250.00
  }
}
```

### POST /api/affiliate/register

Register as affiliate.

**Authentication:** Required

**Request:**
```json
{
  "website": "https://example.com",
  "promotional_methods": ["blog", "social_media"],
  "tax_id": "12-3456789"
}
```

### PUT /api/affiliate/payment-settings

Update payment settings.

**Authentication:** Required

**Request:**
```json
{
  "paymentMethod": "paypal",
  "paymentDetails": {
    "email": "payments@example.com"
  }
}
```

### GET /api/affiliate/dashboard

Get dashboard stats.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| period | string | Time period (7d, 30d, 90d, all) |

**Response:**
```json
{
  "success": true,
  "stats": {
    "clicks": 1500,
    "conversions": 45,
    "conversion_rate": 3.0,
    "earnings": 450.00
  },
  "chart_data": []
}
```

### GET /api/affiliate/links

Get all affiliate links.

**Authentication:** Required

### POST /api/affiliate/links

Create affiliate link.

**Authentication:** Required

**Request:**
```json
{
  "name": "Blog Post Link",
  "destination_url": "https://botbuilder.com/pricing",
  "campaign": "blog_launch"
}
```

### PUT /api/affiliate/links/:linkId

Update link.

**Authentication:** Required

### DELETE /api/affiliate/links/:linkId

Delete link.

**Authentication:** Required

### GET /api/affiliate/conversions

Get conversions.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status |
| startDate | string | Start date |
| endDate | string | End date |
| limit | number | Max results |

### GET /api/affiliate/payouts

Get payout history.

**Authentication:** Required

### POST /api/affiliate/payouts

Request payout.

**Authentication:** Required

**Request:**
```json
{
  "amount": 250.00
}
```

### GET /api/affiliate/assets

Get marketing assets.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "assets": {
    "banners": [
      {"id": 1, "name": "Banner 728x90", "size": "728x90", "url": "/assets/affiliate/banner-728x90.png"}
    ],
    "logos": [],
    "emailTemplates": [],
    "socialPosts": []
  },
  "affiliateCode": "ABC123"
}
```

---

## Enterprise Contracts API

Base Path: `/api/enterprise`

Manage enterprise contracts, invoices, and amendments.

### GET /api/enterprise/contracts

Get all contracts for the organization.

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "contract_number": "ENT-2025-001",
      "status": "active",
      "start_date": "2025-01-01",
      "end_date": "2025-12-31",
      "annual_value": 50000,
      "invoice_count": 3,
      "amendment_count": 0
    }
  ]
}
```

### POST /api/enterprise/contracts

Create a new contract.

**Authentication:** Required

**Request:**
```json
{
  "tier": "enterprise",
  "annual_value": 50000,
  "included_seats": 25,
  "included_requests": 1000000,
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "auto_renew": true,
  "payment_terms": "net30"
}
```

### GET /api/enterprise/contracts/:id

Get contract details with invoices and amendments.

**Authentication:** Required

### PUT /api/enterprise/contracts/:id

Update contract (draft only).

**Authentication:** Required

### POST /api/enterprise/contracts/:id/sign

Sign contract.

**Authentication:** Required

**Request:**
```json
{
  "signedBy": "John Doe, CEO"
}
```

### GET /api/enterprise/contracts/:id/pdf

Download contract PDF.

**Authentication:** Required

### POST /api/enterprise/contracts/:id/amend

Create contract amendment.

**Authentication:** Required

**Request:**
```json
{
  "amendmentType": "seats_change",
  "description": "Increase seats from 25 to 50",
  "newValue": {"included_seats": 50},
  "effectiveDate": "2025-06-01"
}
```

**Amendment Types:**
- `price_change` - Annual/monthly value change
- `term_extension` - Extend contract end date
- `seats_change` - Change included seats
- `limit_change` - Change request/storage limits

### GET /api/enterprise/invoices

Get all invoices for the organization.

**Authentication:** Required

### POST /api/enterprise/invoices

Generate a new invoice.

**Authentication:** Required

**Request:**
```json
{
  "contractId": 1,
  "periodStart": "2025-01-01",
  "periodEnd": "2025-01-31"
}
```

### GET /api/enterprise/invoices/:id

Get invoice details.

**Authentication:** Required

### GET /api/enterprise/invoices/:id/pdf

Download invoice PDF.

**Authentication:** Required

### POST /api/enterprise/invoices/:id/pay

Mark invoice as paid.

**Authentication:** Required

### POST /api/enterprise/invoices/:id/send

Send invoice to customer.

**Authentication:** Required

### GET /api/enterprise/pricing

Get available pricing tiers.

**Authentication:** Required

### POST /api/enterprise/pricing/calculate

Calculate custom pricing.

**Authentication:** Required

### GET /api/enterprise/summary

Get contract summary for organization.

**Authentication:** Required

---

## Versions API

Base Path: `/api/versions`

Entity version control with branching and merging.

### GET /api/versions/:entityType/:entityId

Get version history.

**Authentication:** Required

**Path Parameters:**
- `entityType` - Type of entity (bot, workflow, flow)
- `entityId` - Entity ID

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 50 | Max results |
| offset | number | 0 | Offset |

**Response:**
```json
{
  "versions": [
    {
      "id": 1,
      "version_number": 5,
      "commit_message": "Updated greeting flow",
      "created_by": 1,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 5
}
```

### POST /api/versions/:entityType/:entityId

Create new version.

**Authentication:** Required

**Request:**
```json
{
  "data": {
    "nodes": [],
    "edges": []
  },
  "commitMessage": "Added new greeting flow"
}
```

### GET /api/versions/:entityType/:entityId/latest

Get latest version.

**Authentication:** Required

### GET /api/versions/:entityType/:entityId/:versionNumber

Get specific version.

**Authentication:** Required

### POST /api/versions/:entityType/:entityId/rollback

Rollback to previous version.

**Authentication:** Required

**Request:**
```json
{
  "targetVersion": 3,
  "commitMessage": "Rollback to stable version"
}
```

**Response:**
```json
{
  "rolledBackTo": 3,
  "newVersion": {
    "id": 6,
    "version_number": 6,
    "commit_message": "Rollback to stable version"
  }
}
```

### GET /api/versions/:entityType/:entityId/diff

View diff between versions.

**Authentication:** Required

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| from | number | From version number |
| to | number | To version number |

### POST /api/versions/:entityType/:entityId/compare

Compare two versions.

**Authentication:** Required

**Request:**
```json
{
  "versionA": 3,
  "versionB": 5
}
```

### GET /api/versions/:entityType/:entityId/branches

List branches.

**Authentication:** Required

### POST /api/versions/:entityType/:entityId/branches

Create branch.

**Authentication:** Required

**Request:**
```json
{
  "branchName": "feature/new-greeting",
  "baseVersionId": 5
}
```

### POST /api/versions/:entityType/:entityId/branches/merge

Merge branch.

**Authentication:** Required

**Request:**
```json
{
  "sourceBranch": "feature/new-greeting",
  "targetBranch": "main",
  "commitMessage": "Merge new greeting feature"
}
```

### DELETE /api/versions/:entityType/:entityId/branches/:branchName

Delete branch.

**Authentication:** Required

---

*Last updated: January 2026*
*API Version: 2.0.0*
