# BotBuilder Platform

<p align="center">
  <strong>AI-Powered Chatbot Builder with Revenue Recovery Engine</strong>
</p>

<p align="center">
  Build, deploy, and manage intelligent chatbots across multiple platforms with advanced AI capabilities and e-commerce recovery features.
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#installation">Installation</a> |
  <a href="#api-documentation">API Docs</a> |
  <a href="#deployment">Deployment</a> |
  <a href="#contributing">Contributing</a>
</p>

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Testing](#testing)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

---

## Features

### Core Platform

| Feature | Description |
|---------|-------------|
| **Multi-Platform Deployment** | WhatsApp, Telegram, Slack, Discord, Instagram, Web Widget |
| **Visual AI Flow Studio** | Drag-and-drop bot builder with ReactFlow |
| **Intent Builder** | NLU training with custom intents and entities |
| **Knowledge Base (RAG)** | Retrieval Augmented Generation with pgvector |
| **Multi-Agent Orchestration** | Coordinate multiple AI agents |
| **Real-Time Analytics** | Comprehensive dashboard with metrics |
| **Voice Integration** | Speech-to-Text and Text-to-Speech |
| **Clone Engine** | Clone bot personalities and styles |

### AI Revenue Recovery Engine

| Feature | Description |
|---------|-------------|
| **Abandoned Cart Recovery** | Automated cart recovery workflows |
| **Customer Health Scoring** | Predictive churn analysis |
| **Win-Back Campaigns** | Personalized re-engagement |
| **Multi-Channel Outreach** | Email, SMS, WhatsApp campaigns |
| **Revenue Analytics** | ROI tracking and forecasting |

### Enterprise Features

| Feature | Description |
|---------|-------------|
| **SSO Integration** | SAML 2.0, OIDC, Azure AD, Google, Okta |
| **SCIM Provisioning** | Automated user lifecycle management |
| **RBAC** | Role-based access control (Viewer, Member, Admin) |
| **Audit Logging** | Complete activity trail |
| **White-Label** | Custom branding support |
| **API Rate Limiting** | Redis-based rate limiting |
| **Multi-Organization** | Organization-based data isolation |

### Security

- JWT authentication with refresh tokens
- 2FA support (TOTP)
- AES-256-GCM encryption for sensitive data
- CSRF protection
- Security headers (Helmet.js)
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

---

## Screenshots

### Dashboard
```
+----------------------------------+
|  BotBuilder Dashboard            |
|----------------------------------|
|  [Bots: 12] [Messages: 45.2K]   |
|  [Active Users: 1.2K]            |
|                                  |
|  +-- Message Volume Chart --+    |
|  |   ___/\___/\___          |    |
|  +-------------------------+    |
|                                  |
|  +-- Bot Performance Table --+   |
|  | Bot Name | Messages | Conv% | |
|  | Support  | 12.5K    | 78%   | |
|  | Sales    | 8.2K     | 65%   | |
|  +---------------------------+   |
+----------------------------------+
```

### AI Flow Studio
```
+----------------------------------+
|  Flow Studio - Customer Support  |
|----------------------------------|
|  [Start] --> [Intent Check]      |
|              /         \         |
|         [FAQ]       [Agent]      |
|           |            |         |
|       [Response]   [Transfer]    |
|           |            |         |
|         [End]        [End]       |
+----------------------------------+
```

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS, React Router, i18next, ReactFlow |
| **Backend** | Node.js 18+, Express.js, PostgreSQL 14+, Redis |
| **AI/ML** | OpenAI GPT-4, Claude (Anthropic), pgvector, Custom Fine-Tuning |
| **Voice** | Twilio, Google Speech-to-Text, Text-to-Speech |
| **Infrastructure** | Docker, Railway, Vercel |
| **Testing** | Jest, Supertest, Cypress |

---

## SDK & Developer Tools

### JavaScript SDK

```bash
npm install @botbuilder/sdk
```

```javascript
const BotBuilder = require('@botbuilder/sdk');

const client = new BotBuilder({ apiKey: 'your-api-key' });

// Create a bot
const bot = await client.bots.create({
  name: 'My Bot',
  platform: 'telegram'
});

// Send a message
const response = await client.messages.send(bot.id, {
  message: 'Hello!',
  sessionId: 'session_123'
});
```

### Developer Resources

| Resource | Location |
|----------|----------|
| OpenAPI Spec | `server/docs/openapi.yaml` |
| Postman Collection | `docs/BotBuilder.postman_collection.json` |
| Swagger UI | `http://localhost:5000/api-docs` |
| Status Page | `http://localhost:5000/status` |
| SDK Docs | `packages/botbuilder-sdk/README.md` |

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/BotBuilder.git
cd BotBuilder

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Configure environment
cd ../server
cp .env.example .env
# Edit .env with your configuration

# 4. Setup database
npm run migrate

# 5. Start development servers
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev

# 6. Open browser
# Frontend: http://localhost:5173
# Backend: http://localhost:5000
# API Docs: http://localhost:5000/api-docs
```

---

## Installation

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 18.x+ | LTS recommended |
| PostgreSQL | 14+ | With pgvector extension |
| Redis | 6+ | Optional, for caching |
| npm/yarn | Latest | Package manager |

### Step-by-Step Installation

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/BotBuilder.git
cd BotBuilder
```

#### 2. Install Server Dependencies

```bash
cd server
npm install
```

#### 3. Install Client Dependencies

```bash
cd ../client
npm install
```

#### 4. Database Setup

```bash
# Create PostgreSQL database
createdb botbuilder

# Install pgvector extension (for RAG/Knowledge Base)
psql -d botbuilder -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
cd ../server
npm run migrate
```

#### 5. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your settings (see Environment Variables section)
```

#### 6. Start Development Servers

```bash
# Start backend (from server directory)
npm run dev

# Start frontend (from client directory - new terminal)
npm run dev
```

---

## Environment Variables

Create a `.env` file in the `server` directory:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ============================================
# DATABASE
# ============================================
DATABASE_URL=postgresql://user:password@localhost:5432/botbuilder

# ============================================
# AUTHENTICATION
# ============================================
# JWT Secret (minimum 64 characters, generate with: openssl rand -hex 32)
JWT_SECRET=your-64-character-secure-secret-key-here-minimum-64-chars-required
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Encryption key for sensitive data (32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key

# ============================================
# AI PROVIDERS
# ============================================
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# ============================================
# REDIS (Optional - for caching & rate limiting)
# ============================================
REDIS_URL=redis://localhost:6379

# ============================================
# EMAIL (SMTP)
# ============================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_FROM=noreply@botbuilder.com

# ============================================
# OAUTH PROVIDERS (Optional)
# ============================================
# Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# GitHub
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# ============================================
# MESSAGING PLATFORMS (Optional)
# ============================================
# Telegram
TELEGRAM_BOT_TOKEN=...

# WhatsApp (Meta Business)
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_VERIFY_TOKEN=...

# Slack
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_SIGNING_SECRET=...

# ============================================
# VOICE (Twilio - Optional)
# ============================================
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# ============================================
# STRIPE (Billing - Optional)
# ============================================
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ============================================
# ENTERPRISE SSO (Optional)
# ============================================
SAML_CALLBACK_URL=https://your-domain.com/api/sso/callback
```

---

## Project Structure

```
BotBuilder/
├── client/                      # React Frontend
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── api/                 # API client functions
│   │   ├── components/          # Reusable UI components
│   │   │   ├── common/          # Buttons, inputs, modals
│   │   │   ├── dashboard/       # Dashboard widgets
│   │   │   ├── flow/            # Flow builder components
│   │   │   └── settings/        # Settings panels
│   │   ├── contexts/            # React contexts
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Bots.jsx
│   │   │   ├── FlowStudio.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── Settings.jsx
│   │   ├── utils/               # Utility functions
│   │   ├── App.jsx              # Main app component
│   │   └── main.jsx             # Entry point
│   ├── cypress/                 # E2E tests
│   ├── package.json
│   └── vite.config.js
│
├── server/                      # Express Backend
│   ├── routes/                  # API route handlers
│   │   ├── auth.js              # Authentication
│   │   ├── bots.js              # Bot management
│   │   ├── ai.js                # AI configuration
│   │   ├── knowledge.js         # Knowledge base
│   │   ├── channels.js          # Channel connections
│   │   ├── analytics.js         # Analytics
│   │   ├── organizations.js     # Multi-org
│   │   ├── sso.js               # SSO/SAML
│   │   ├── scim.js              # SCIM provisioning
│   │   ├── billing.js           # Stripe billing
│   │   ├── recovery.js          # Revenue recovery
│   │   └── ... (40+ more)
│   │
│   ├── services/                # Business logic
│   │   ├── ai/                  # AI providers
│   │   │   ├── openaiService.js
│   │   │   ├── claudeService.js
│   │   │   └── aiMessageHandler.js
│   │   ├── autonomous/          # Autonomous agents
│   │   ├── clone/               # Clone engine
│   │   ├── voice/               # Voice services
│   │   ├── recoveryEngine/      # Revenue recovery
│   │   ├── ragService.js        # RAG implementation
│   │   └── ... (30+ more)
│   │
│   ├── middleware/              # Express middleware
│   │   ├── auth.js              # JWT authentication
│   │   ├── checkPermission.js   # RBAC
│   │   ├── rateLimiter.js       # Rate limiting
│   │   ├── audit.js             # Audit logging
│   │   ├── csrf.js              # CSRF protection
│   │   └── ... (15+ more)
│   │
│   ├── knowledge/               # Knowledge base system
│   │   ├── EmbeddingService.js  # Vector embeddings
│   │   ├── VectorStore.js       # pgvector operations
│   │   └── ChunkProcessor.js    # Document chunking
│   │
│   ├── models/                  # Database models
│   ├── migrations/              # Database migrations
│   ├── utils/                   # Utility functions
│   ├── docs/                    # OpenAPI/Swagger specs
│   ├── __tests__/               # Jest tests
│   ├── app.js                   # Express app setup
│   ├── db.js                    # Database connection
│   └── package.json
│
├── migrations/                  # Root-level migrations
├── docs/                        # Project documentation
│   ├── API.md                   # Full API documentation
│   ├── SETUP.md                 # Development setup
│   ├── DEPLOYMENT.md            # Production deployment
│   ├── ARCHITECTURE.md          # System architecture
│   ├── DATABASE.md              # Database schema
│   ├── SECURITY.md              # Security guide
│   ├── INTEGRATIONS.md          # Platform integrations
│   ├── PLUGINS.md               # Plugin development
│   ├── TROUBLESHOOTING.md       # Common issues
│   └── CHANGELOG.md             # Version history
│
├── .github/                     # GitHub workflows
├── docker-compose.yml           # Docker setup
├── README.md                    # This file
└── LICENSE
```

---

## Documentation

- [Getting Started](/docs/SETUP.md)
- [API Reference](/docs/API_REFERENCE.md)
- [User Guide](/docs/USER_GUIDE.md)
- [Integrations](/docs/INTEGRATIONS.md)
- [Troubleshooting](/docs/TROUBLESHOOTING.md)

### Interactive Resources

- [API Playground](/playground) - Test API endpoints live
- [Video Tutorials](/academy) - Step-by-step guides
- AI Assistant - Available on all doc pages

### Supported Languages

Documentation and AI Assistant available in:
- Azerbaijani
- Turkish
- English
- Russian

---

## API Documentation

### Interactive Documentation

- **Swagger UI:** `http://localhost:5000/api-docs`
- **OpenAPI JSON:** `http://localhost:5000/api-docs.json`

### API Overview

The BotBuilder API provides **530+ endpoints** organized into the following categories:

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Authentication** | 15 | Login, register, 2FA, password reset |
| **Bots** | 25 | Bot CRUD, flows, configurations |
| **AI** | 30 | Chat, configuration, fine-tuning |
| **Knowledge Base** | 20 | Documents, chunks, embeddings |
| **Intents & Entities** | 25 | NLU training data |
| **Channels** | 40 | Telegram, WhatsApp, Slack, etc. |
| **Analytics** | 35 | Metrics, reports, exports |
| **Organizations** | 30 | Multi-org management |
| **Team & Roles** | 25 | User management, RBAC |
| **SSO** | 20 | SAML, OIDC configuration |
| **SCIM** | 15 | User provisioning |
| **Billing** | 20 | Subscriptions, invoices |
| **Recovery Engine** | 40 | Abandoned carts, campaigns |
| **Workflows** | 30 | Automation workflows |
| **Plugins** | 25 | Plugin management |
| **Voice** | 30 | Speech services |
| **Webhooks** | 25 | Event notifications |
| **Admin** | 50+ | Super admin operations |

### Authentication

All protected endpoints require a Bearer token:

```http
Authorization: Bearer <your-jwt-token>
```

#### Obtain Token

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
  "success": true,
  "token": "eyJhbGciOiJIUzI1...",
  "refreshToken": "...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

### Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| AI Endpoints | 20 requests | 1 minute |
| File Upload | 10 requests | 1 hour |

Rate limit headers:
- `X-RateLimit-Limit`: Maximum requests
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

### Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

| Status | Code | Description |
|--------|------|-------------|
| 400 | BAD_REQUEST | Invalid parameters |
| 401 | UNAUTHORIZED | Invalid/missing token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 429 | RATE_LIMITED | Too many requests |
| 500 | SERVER_ERROR | Internal error |

For detailed API documentation, see [docs/API.md](docs/API.md).

---

## Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build individually
docker build -t botbuilder-server ./server
docker build -t botbuilder-client ./client
```

### Railway Deployment

1. Connect your GitHub repository to Railway
2. Add PostgreSQL and Redis services
3. Configure environment variables
4. Deploy!

### Vercel (Frontend)

```bash
cd client
vercel --prod
```

### Manual Production Deployment

1. **Server:**
```bash
cd server
npm install --production
npm run build
npm start
```

2. **Client:**
```bash
cd client
npm run build
# Serve dist/ folder with nginx or similar
```

For detailed deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Testing

### Backend Tests

```bash
cd server

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- routes/bots.test.js

# Run in watch mode
npm run test:watch
```

### Frontend Tests

```bash
cd client

# Run unit tests
npm test

# Run E2E tests (Cypress)
npm run cypress:open

# Run E2E headless
npm run cypress:run
```

### Test Coverage Goals

| Category | Target |
|----------|--------|
| Routes | 80% |
| Services | 85% |
| Middleware | 90% |
| Utils | 95% |

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/BotBuilder.git
   ```
3. **Create** a feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make** your changes
5. **Test** your changes:
   ```bash
   npm test
   ```
6. **Commit** with a descriptive message:
   ```bash
   git commit -m "Add amazing feature"
   ```
7. **Push** to your fork:
   ```bash
   git push origin feature/amazing-feature
   ```
8. **Open** a Pull Request

### Code Style

- Use ESLint configuration provided
- Follow existing code patterns
- Add JSDoc comments for functions
- Write tests for new features
- Update documentation as needed

### Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance

### Pull Request Checklist

- [ ] Tests pass
- [ ] Code follows style guide
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] No sensitive data committed

---

## Security

### Reporting Vulnerabilities

Please report security vulnerabilities privately to: security@botbuilder.com

**Do not** open public issues for security vulnerabilities.

### Security Features

- JWT with short expiry + refresh tokens
- Password hashing with bcrypt (12 rounds)
- Rate limiting on all endpoints
- CSRF tokens for state-changing operations
- Input validation with express-validator
- SQL injection prevention (parameterized queries)
- XSS prevention (content sanitization)
- Helmet.js security headers
- CORS configuration
- Encrypted sensitive data (API keys, tokens)

For detailed security information, see [docs/SECURITY.md](docs/SECURITY.md).

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/BotBuilder/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/BotBuilder/discussions)
- **Email:** support@botbuilder.com

---

## Author

**Rashad**

GitHub: [@rasad8686](https://github.com/rasad8686)

---

<p align="center">
  Made with care by Rashad
</p>
