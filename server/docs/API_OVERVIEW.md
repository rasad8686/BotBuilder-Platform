# BotBuilder API Overview

## Base URL

- **Development:** `http://localhost:5000/api`
- **Production:** `https://your-domain.com/api`

## Interactive Documentation

- **Swagger UI:** `/api-docs`
- **OpenAPI JSON:** `/api-docs.json`

---

## Authentication

### JWT Token Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Obtaining a Token

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "YourPassword123"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### Token Refresh

```http
POST /api/auth/refresh
Cookie: refreshToken=<refresh-token>
```

---

## Rate Limiting

API requests are rate limited to prevent abuse:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| AI Endpoints | 20 requests | 1 minute |

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time until reset (Unix timestamp)

---

## API Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | User login |
| POST | `/auth/logout` | User logout |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/refresh` | Refresh access token |

### Bots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bots` | List all bots |
| POST | `/bots` | Create new bot |
| GET | `/bots/:id` | Get bot details |
| PUT | `/bots/:id` | Update bot |
| DELETE | `/bots/:id` | Delete bot |

### AI Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bots/:id/ai/config` | Get AI configuration |
| PUT | `/bots/:id/ai/config` | Update AI configuration |
| POST | `/bots/:id/ai/chat` | Send message to AI |

### Knowledge Base
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/knowledge` | List knowledge items |
| POST | `/knowledge` | Add knowledge item |
| POST | `/knowledge/upload` | Upload document |
| DELETE | `/knowledge/:id` | Delete knowledge item |

### Channels
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/channels` | List connected channels |
| POST | `/channels/telegram/connect` | Connect Telegram |
| POST | `/channels/slack/connect` | Connect Slack |
| POST | `/channels/whatsapp/connect` | Connect WhatsApp |
| DELETE | `/channels/:id` | Disconnect channel |

### Intents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/intents` | List intents |
| POST | `/intents` | Create intent |
| PUT | `/intents/:id` | Update intent |
| DELETE | `/intents/:id` | Delete intent |
| POST | `/intents/:id/train` | Train intent model |

### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/workflows` | List workflows |
| POST | `/workflows` | Create workflow |
| PUT | `/workflows/:id` | Update workflow |
| DELETE | `/workflows/:id` | Delete workflow |
| POST | `/workflows/:id/execute` | Execute workflow |

### Recovery Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/recovery/dashboard` | Recovery dashboard stats |
| GET | `/recovery/campaigns` | List campaigns |
| POST | `/recovery/campaigns` | Create campaign |
| GET | `/recovery/carts` | Abandoned carts list |
| GET | `/recovery/customers` | Customer health data |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/overview` | Overview stats |
| GET | `/analytics/messages-over-time` | Message trends |
| GET | `/analytics/by-bot` | Stats per bot |
| GET | `/analytics/comprehensive` | Full analytics |

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/organizations` | List organizations |
| POST | `/organizations` | Create organization |
| PUT | `/organizations/:id` | Update organization |
| GET | `/organizations/:id/members` | List members |
| POST | `/organizations/:id/invite` | Invite member |

### SSO (Enterprise)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sso/config` | Get SSO configuration |
| POST | `/sso/config` | Configure SSO |
| GET | `/sso/login/:domain` | Initiate SSO login |
| POST | `/sso/callback` | SSO callback |

### SCIM (Enterprise)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scim/v2/Users` | List users |
| POST | `/scim/v2/Users` | Create user |
| GET | `/scim/v2/Users/:id` | Get user |
| PUT | `/scim/v2/Users/:id` | Update user |
| DELETE | `/scim/v2/Users/:id` | Delete user |
| GET | `/scim/v2/Groups` | List groups |

### Billing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/billing/subscription` | Current subscription |
| POST | `/billing/checkout` | Create checkout session |
| GET | `/billing/usage` | Usage statistics |
| GET | `/billing/invoices` | Invoice history |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Webhooks

Configure webhooks to receive real-time events:

```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-server.com/webhook",
  "events": ["message.received", "bot.deployed"],
  "secret": "your-webhook-secret"
}
```

Webhook payloads include HMAC signature in `X-Webhook-Signature` header.

---

## SDK & Libraries

- **JavaScript/Node.js:** `npm install @botbuilder/sdk`
- **Python:** `pip install botbuilder-sdk`

---

## Support

- Documentation: https://docs.botbuilder.com
- API Status: https://status.botbuilder.com
- Email: support@botbuilder.com
