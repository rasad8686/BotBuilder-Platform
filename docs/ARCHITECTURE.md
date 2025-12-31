# System Architecture

Comprehensive overview of the BotBuilder platform architecture.

---

## Table of Contents

- [Overview](#overview)
- [High-Level Architecture](#high-level-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Architecture](#database-architecture)
- [AI/ML Architecture](#aiml-architecture)
- [Messaging Architecture](#messaging-architecture)
- [Security Architecture](#security-architecture)
- [Scalability Patterns](#scalability-patterns)

---

## Overview

BotBuilder is a multi-tenant SaaS platform built with a modern microservices-ready monolithic architecture. The system is designed for:

- **Multi-tenancy:** Organization-based data isolation
- **Scalability:** Horizontal scaling with stateless services
- **Extensibility:** Plugin system for custom integrations
- **Security:** Defense-in-depth security model

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   Web    │  │  Mobile  │  │   API    │  │  Widget  │  │ Channels │      │
│  │   App    │  │   App    │  │  Client  │  │  Embed   │  │(TG,WA,..)│      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼─────────────┼─────────────┼─────────────┼─────────────┼─────────────┘
        │             │             │             │             │
        └─────────────┴──────┬──────┴─────────────┴─────────────┘
                             │
                    ┌────────▼────────┐
                    │  Load Balancer  │
                    │    (Nginx)      │
                    └────────┬────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                   API GATEWAY LAYER                                          │
├────────────────────────────┼────────────────────────────────────────────────┤
│  ┌─────────────────────────▼─────────────────────────────────┐              │
│  │                    Express.js Server                       │              │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │              │
│  │  │   Auth   │  │   Rate   │  │   CORS   │  │  Audit   │  │              │
│  │  │Middleware│  │ Limiter  │  │  Handler │  │  Logger  │  │              │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │              │
│  └───────────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                   APPLICATION LAYER                                          │
├────────────────────────────┼────────────────────────────────────────────────┤
│  ┌─────────────────────────▼─────────────────────────────────┐              │
│  │                     Route Handlers                         │              │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐   │              │
│  │  │Bots │  │ AI  │  │Auth │  │Orgs │  │Flows│  │ ... │   │              │
│  │  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘   │              │
│  └─────┼────────┼────────┼────────┼────────┼────────┼───────┘              │
│        └────────┴────────┴────┬───┴────────┴────────┘                       │
│                               │                                              │
│  ┌────────────────────────────▼──────────────────────────────┐              │
│  │                      Services Layer                        │              │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │              │
│  │  │    AI      │  │  Recovery  │  │   Voice    │           │              │
│  │  │  Services  │  │   Engine   │  │  Services  │           │              │
│  │  └────────────┘  └────────────┘  └────────────┘           │              │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐           │              │
│  │  │   Clone    │  │   RAG      │  │  Webhook   │           │              │
│  │  │  Engine    │  │  Service   │  │  Service   │           │              │
│  │  └────────────┘  └────────────┘  └────────────┘           │              │
│  └───────────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                      DATA LAYER                                              │
├────────────────────────────┼────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌───────▼──────┐  ┌──────────────┐                       │
│  │  PostgreSQL  │  │    Redis     │  │  S3/Storage  │                       │
│  │  + pgvector  │  │   (Cache)    │  │   (Files)    │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────────────┐
│                 EXTERNAL SERVICES                                            │
├────────────────────────────┼────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  OpenAI  │  │  Claude  │  │ Telegram │  │ WhatsApp │  │  Stripe  │      │
│  │   API    │  │   API    │  │   Bot    │  │ Business │  │   API    │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │  Twilio  │  │  SMTP    │  │  Slack   │  │  IdP/SSO │                     │
│  │  (Voice) │  │  (Email) │  │   API    │  │  (SAML)  │                     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Technology Stack

- **Framework:** React 18 with Vite
- **State Management:** React Context + Local State
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **Flow Builder:** ReactFlow
- **Internationalization:** i18next

### Component Structure

```
src/
├── components/
│   ├── common/              # Shared UI components
│   │   ├── Button.jsx
│   │   ├── Modal.jsx
│   │   ├── Input.jsx
│   │   └── Table.jsx
│   ├── dashboard/           # Dashboard-specific
│   │   ├── StatsCard.jsx
│   │   ├── ChartWidget.jsx
│   │   └── RecentActivity.jsx
│   ├── flow/                # Flow builder
│   │   ├── FlowCanvas.jsx
│   │   ├── NodeTypes/
│   │   └── EdgeTypes/
│   └── layout/              # Layout components
│       ├── Sidebar.jsx
│       ├── Header.jsx
│       └── MainLayout.jsx
├── contexts/                # React contexts
│   ├── AuthContext.jsx
│   ├── ThemeContext.jsx
│   └── OrganizationContext.jsx
├── hooks/                   # Custom hooks
│   ├── useAuth.js
│   ├── useApi.js
│   └── useWebSocket.js
├── pages/                   # Page components
│   ├── Dashboard.jsx
│   ├── Bots/
│   ├── Analytics/
│   └── Settings/
├── api/                     # API client
│   ├── client.js
│   ├── auth.js
│   ├── bots.js
│   └── ai.js
└── utils/                   # Utilities
    ├── formatters.js
    ├── validators.js
    └── constants.js
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Application                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│   │   Context    │      │   Context    │      │   Context    │ │
│   │    Auth      │      │    Theme     │      │     Org      │ │
│   └──────┬───────┘      └──────────────┘      └──────────────┘ │
│          │                                                       │
│   ┌──────▼───────┐                                              │
│   │    Pages     │                                              │
│   │  (Routes)    │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│   ┌──────▼───────┐      ┌──────────────┐                       │
│   │  Components  │◄────►│  Local State │                       │
│   └──────┬───────┘      └──────────────┘                       │
│          │                                                       │
│   ┌──────▼───────┐      ┌──────────────┐                       │
│   │   Hooks      │◄────►│  API Client  │                       │
│   │  (useApi)    │      └──────┬───────┘                       │
│   └──────────────┘             │                                │
│                                │                                 │
└────────────────────────────────┼────────────────────────────────┘
                                 │
                         ┌───────▼───────┐
                         │  Backend API  │
                         └───────────────┘
```

---

## Backend Architecture

### Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL + pgvector
- **Cache:** Redis
- **Queue:** Bull (Redis-based)
- **Authentication:** JWT + Refresh Tokens

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ROUTES LAYER                             │
│   Handle HTTP requests, validate input, call services            │
├─────────────────────────────────────────────────────────────────┤
│  routes/                                                         │
│  ├── auth.js         (Authentication endpoints)                  │
│  ├── bots.js         (Bot CRUD operations)                       │
│  ├── ai.js           (AI configuration & chat)                   │
│  ├── knowledge.js    (Knowledge base management)                 │
│  ├── channels.js     (Channel connections)                       │
│  ├── organizations.js (Multi-org management)                     │
│  └── ...             (40+ route files)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MIDDLEWARE LAYER                          │
│   Cross-cutting concerns: auth, validation, logging              │
├─────────────────────────────────────────────────────────────────┤
│  middleware/                                                     │
│  ├── auth.js              (JWT verification)                     │
│  ├── checkPermission.js   (RBAC enforcement)                     │
│  ├── rateLimiter.js       (Rate limiting)                        │
│  ├── organizationContext.js (Tenant isolation)                   │
│  ├── audit.js             (Action logging)                       │
│  ├── validators.js        (Input validation)                     │
│  └── errorHandler.js      (Error handling)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SERVICES LAYER                            │
│   Business logic, external integrations                          │
├─────────────────────────────────────────────────────────────────┤
│  services/                                                       │
│  ├── ai/                                                         │
│  │   ├── openaiService.js     (OpenAI integration)              │
│  │   ├── claudeService.js     (Claude integration)              │
│  │   ├── aiMessageHandler.js  (Chat processing)                 │
│  │   └── aiCostCalculator.js  (Token/cost tracking)             │
│  ├── recoveryEngine/                                             │
│  │   ├── AbandonedCartService.js                                │
│  │   ├── ChurnPredictionService.js                              │
│  │   └── RecoveryMessagingService.js                            │
│  ├── voice/                                                      │
│  │   ├── TwilioService.js                                       │
│  │   ├── SpeechToText.js                                        │
│  │   └── TextToSpeech.js                                        │
│  ├── ragService.js            (RAG implementation)              │
│  ├── webhookService.js        (Webhook delivery)                │
│  └── emailService.js          (Email sending)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                              │
│   Database access, caching, file storage                         │
├─────────────────────────────────────────────────────────────────┤
│  ├── db.js                  (PostgreSQL connection pool)         │
│  ├── knowledge/                                                  │
│  │   ├── VectorStore.js     (pgvector operations)               │
│  │   ├── EmbeddingService.js (Vector embeddings)                │
│  │   └── ChunkProcessor.js   (Document chunking)                │
│  └── cache/                                                      │
│      └── redisClient.js      (Redis connection)                 │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
HTTP Request
    │
    ▼
┌─────────────────┐
│  Rate Limiter   │──── 429 Too Many Requests
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   CORS Check    │──── 403 Forbidden
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Body Parser    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Auth Check    │──── 401 Unauthorized
│  (JWT Verify)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Org Context   │──── 403 No Organization
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Permission     │──── 403 Forbidden
│    Check        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Input Valid.   │──── 400 Bad Request
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Route Handler  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Service      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Audit Logger   │
└────────┬────────┘
         │
         ▼
HTTP Response
```

---

## Database Architecture

### PostgreSQL Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORGANIZATIONS & USERS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │organizations│──────│organization │──────│    users    │    │
│   │             │      │  _members   │      │             │    │
│   └─────────────┘      └─────────────┘      └─────────────┘    │
│         │                                          │            │
│         │                                          │            │
│   ┌─────▼───────┐                          ┌──────▼──────┐     │
│   │   roles     │                          │refresh_tokens│     │
│   └─────────────┘                          └─────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BOT SYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │    bots     │──────│  bot_flows  │──────│ flow_nodes  │    │
│   │             │      │             │      │             │    │
│   └──────┬──────┘      └─────────────┘      └─────────────┘    │
│          │                                                       │
│   ┌──────┴──────────────────────┬──────────────────────┐       │
│   │                             │                       │        │
│   ▼                             ▼                       ▼        │
│ ┌─────────────┐         ┌─────────────┐         ┌─────────────┐│
│ │ai_config    │         │  channels   │         │   intents   ││
│ └─────────────┘         └─────────────┘         └──────┬──────┘│
│                                                        │        │
│                                                 ┌──────▼──────┐ │
│                                                 │  entities   │ │
│                                                 └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE BASE (RAG)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │knowledge    │──────│  documents  │──────│   chunks    │    │
│   │  _bases     │      │             │      │ (+ vector)  │    │
│   └─────────────┘      └─────────────┘      └─────────────┘    │
│                                                                  │
│   Vector similarity search using pgvector extension              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGING SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │  sessions   │──────│  messages   │──────│ message     │    │
│   │             │      │             │      │ _feedback   │    │
│   └─────────────┘      └─────────────┘      └─────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Indexing Strategy

```sql
-- Primary indexes (auto-created)
-- Secondary indexes for performance

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);

-- Bots
CREATE INDEX idx_bots_org ON bots(organization_id);
CREATE INDEX idx_bots_platform ON bots(platform);

-- Messages
CREATE INDEX idx_messages_bot ON messages(bot_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Vector search (HNSW index for fast similarity search)
CREATE INDEX idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops);
```

---

## AI/ML Architecture

### RAG (Retrieval-Augmented Generation) Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER QUERY                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING SERVICE                             │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  Convert query to vector using OpenAI embeddings     │      │
│   │  Model: text-embedding-ada-002 (1536 dimensions)     │      │
│   └──────────────────────────────────────────────────────┘      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VECTOR STORE                                 │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  Search PostgreSQL with pgvector                     │      │
│   │  SELECT * FROM chunks                                │      │
│   │  WHERE kb_id IN (...) AND embedding <=> $1 < 0.3     │      │
│   │  ORDER BY embedding <=> $1 LIMIT 10                  │      │
│   └──────────────────────────────────────────────────────┘      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT BUILDER                               │
│                                                                  │
│   ┌──────────────────────────────────────────────────────┐      │
│   │  Combine retrieved chunks with user query            │      │
│   │  Add source citations                                │      │
│   │  Apply prompt engineering                            │      │
│   └──────────────────────────────────────────────────────┘      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       LLM PROVIDER                               │
│                                                                  │
│   ┌────────────┐    ┌────────────┐    ┌────────────┐           │
│   │   OpenAI   │    │   Claude   │    │   Custom   │           │
│   │  GPT-4     │    │  Sonnet    │    │ Fine-tuned │           │
│   └────────────┘    └────────────┘    └────────────┘           │
│                                                                  │
│   Provider selection based on bot configuration                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AI RESPONSE                                  │
│   + Source citations                                             │
│   + Token usage tracking                                         │
│   + Cost calculation                                             │
└─────────────────────────────────────────────────────────────────┘
```

### AI Provider Factory Pattern

```javascript
// services/ai/aiProviderFactory.js

class AIProviderFactory {
  static getProvider(config) {
    switch (config.provider) {
      case 'openai':
        return new OpenAIService(config);
      case 'anthropic':
        return new ClaudeService(config);
      case 'custom':
        return new CustomModelService(config);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

---

## Messaging Architecture

### Channel Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCOMING MESSAGE                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Telegram   │    │   WhatsApp   │    │    Slack     │
│   Webhook    │    │   Webhook    │    │   Webhook    │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   Message Normalizer  │
               │   (Unified Format)    │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │    Session Manager    │
               │   (Create/Resume)     │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   Intent Detection    │
               │   (NLU Engine)        │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   Flow Executor       │
               │   (Conversation)      │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │   AI Message Handler  │
               │   (LLM + RAG)         │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │  Response Formatter   │
               │  (Channel-specific)   │
               └───────────┬───────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Telegram   │  │   WhatsApp   │  │    Slack     │
│   Send API   │  │   Send API   │  │   Send API   │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Security Architecture

### Defense in Depth

```
┌─────────────────────────────────────────────────────────────────┐
│                      PERIMETER SECURITY                          │
│   - Cloudflare/WAF                                               │
│   - DDoS Protection                                              │
│   - SSL/TLS Termination                                          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK SECURITY                              │
│   - Rate Limiting                                                │
│   - IP Filtering                                                 │
│   - CORS Policies                                                │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION SECURITY                           │
│   - JWT Authentication                                           │
│   - RBAC Authorization                                           │
│   - Input Validation                                             │
│   - CSRF Protection                                              │
│   - Security Headers (Helmet.js)                                 │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SECURITY                               │
│   - Encryption at Rest (AES-256-GCM)                            │
│   - Encryption in Transit (TLS 1.3)                             │
│   - Parameterized Queries (SQL Injection Prevention)            │
│   - Multi-tenant Isolation                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐                                    ┌──────────┐
│  Client  │                                    │  Server  │
└────┬─────┘                                    └────┬─────┘
     │                                               │
     │  1. POST /auth/login {email, password}       │
     │─────────────────────────────────────────────>│
     │                                               │
     │                                    ┌──────────┴──────────┐
     │                                    │ - Verify credentials │
     │                                    │ - Generate JWT       │
     │                                    │ - Generate refresh   │
     │                                    │ - Set httpOnly cookie│
     │                                    └──────────┬──────────┘
     │                                               │
     │  2. {token, user} + Set-Cookie: refreshToken │
     │<─────────────────────────────────────────────│
     │                                               │
     │  3. GET /api/bots                            │
     │     Authorization: Bearer <token>            │
     │─────────────────────────────────────────────>│
     │                                               │
     │                                    ┌──────────┴──────────┐
     │                                    │ - Verify JWT         │
     │                                    │ - Extract user       │
     │                                    │ - Check permissions  │
     │                                    └──────────┬──────────┘
     │                                               │
     │  4. {success: true, bots: [...]}             │
     │<─────────────────────────────────────────────│
     │                                               │
```

---

## Scalability Patterns

### Horizontal Scaling

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Server 1   │    │   Server 2   │    │   Server 3   │
│   (PM2)      │    │   (PM2)      │    │   (PM2)      │
└──────────────┘    └──────────────┘    └──────────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
           ┌──────────────┐  ┌──────────────┐
           │   Redis      │  │  PostgreSQL  │
           │   Cluster    │  │   (Primary)  │
           └──────────────┘  └──────┬───────┘
                                    │
                             ┌──────┴───────┐
                             │   Read       │
                             │   Replicas   │
                             └──────────────┘
```

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                      CACHE LAYERS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Layer 1: Application Cache (In-Memory)                        │
│   - Configuration data                                          │
│   - Session data                                                │
│   - Hot paths                                                   │
│   TTL: 5-60 seconds                                             │
│                                                                  │
│   Layer 2: Redis Cache                                          │
│   - API responses                                               │
│   - User sessions                                               │
│   - Rate limit counters                                         │
│   TTL: 1-60 minutes                                             │
│                                                                  │
│   Layer 3: Database Query Cache                                 │
│   - PostgreSQL query cache                                      │
│   - Prepared statements                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

BotBuilder's architecture is designed for:

1. **Maintainability:** Clear separation of concerns
2. **Scalability:** Stateless services, horizontal scaling
3. **Security:** Defense in depth, multi-tenant isolation
4. **Extensibility:** Plugin system, service-based architecture
5. **Performance:** Caching, connection pooling, async processing
