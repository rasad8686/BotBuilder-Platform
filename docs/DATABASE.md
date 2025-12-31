# Database Schema Documentation

Complete database schema reference for BotBuilder.

---

## Table of Contents

- [Overview](#overview)
- [Core Tables](#core-tables)
- [Bot System Tables](#bot-system-tables)
- [AI & Knowledge Base Tables](#ai--knowledge-base-tables)
- [Messaging Tables](#messaging-tables)
- [Analytics Tables](#analytics-tables)
- [Enterprise Tables](#enterprise-tables)
- [Recovery Engine Tables](#recovery-engine-tables)
- [Indexes](#indexes)
- [Relationships](#relationships)

---

## Overview

### Database Technology

- **Engine:** PostgreSQL 14+
- **Extensions:**
  - `pgvector` - Vector similarity search for RAG
  - `pg_trgm` - Trigram text search
  - `uuid-ossp` - UUID generation

### Naming Conventions

- Tables: `snake_case`, plural (e.g., `users`, `bot_flows`)
- Columns: `snake_case` (e.g., `created_at`, `organization_id`)
- Primary Keys: `id` (SERIAL or UUID)
- Foreign Keys: `{table}_id` (e.g., `user_id`, `bot_id`)
- Timestamps: `created_at`, `updated_at`

---

## Core Tables

### users

User accounts and authentication.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| email | VARCHAR(255) | Unique email address |
| password_hash | VARCHAR(255) | Bcrypt hashed password |
| name | VARCHAR(255) | Display name |
| avatar_url | TEXT | Profile picture URL |
| email_verified | BOOLEAN | Email verification status |
| two_factor_enabled | BOOLEAN | 2FA enabled flag |
| two_factor_secret | VARCHAR(255) | TOTP secret (encrypted) |
| is_active | BOOLEAN | Account active status |
| last_login_at | TIMESTAMP | Last successful login |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last update timestamp |

### organizations

Multi-tenant organizations.

```sql
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  plan_tier VARCHAR(50) DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| name | VARCHAR(255) | Organization name |
| slug | VARCHAR(100) | URL-friendly identifier |
| logo_url | TEXT | Organization logo |
| plan_tier | VARCHAR(50) | Subscription plan (free/pro/enterprise) |
| settings | JSONB | Organization settings |
| created_by | INTEGER | Creator user ID |

### organization_members

Organization membership and roles.

```sql
CREATE TABLE organization_members (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  invited_by INTEGER REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, user_id)
);
```

| Column | Type | Description |
|--------|------|-------------|
| organization_id | INTEGER | Organization FK |
| user_id | INTEGER | User FK |
| role | VARCHAR(50) | Role (viewer/member/admin) |
| invited_by | INTEGER | User who sent invite |
| joined_at | TIMESTAMP | When user joined |

### roles

Custom role definitions.

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### refresh_tokens

JWT refresh token storage.

```sql
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_info JSONB,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);
```

---

## Bot System Tables

### bots

Bot configurations.

```sql
CREATE TABLE bots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  platform VARCHAR(50) NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  api_token TEXT,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| user_id | INTEGER | Creator user ID |
| organization_id | INTEGER | Organization FK |
| name | VARCHAR(255) | Bot name |
| description | TEXT | Bot description |
| platform | VARCHAR(50) | Platform (telegram/whatsapp/slack/web) |
| language | VARCHAR(10) | Default language |
| api_token | TEXT | Generated API token (encrypted) |
| webhook_url | TEXT | Webhook endpoint |
| is_active | BOOLEAN | Active status |
| settings | JSONB | Bot-specific settings |

### bot_flows

Conversation flow definitions.

```sql
CREATE TABLE bot_flows (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### flow_nodes

Individual nodes in a flow.

```sql
CREATE TABLE flow_nodes (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER NOT NULL REFERENCES bot_flows(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| node_id | VARCHAR(100) | Unique node identifier within flow |
| type | VARCHAR(50) | Node type (trigger/message/condition/action) |
| position_x | INTEGER | X coordinate in canvas |
| position_y | INTEGER | Y coordinate in canvas |
| data | JSONB | Node configuration |

### flow_edges

Connections between nodes.

```sql
CREATE TABLE flow_edges (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER NOT NULL REFERENCES bot_flows(id) ON DELETE CASCADE,
  source_node VARCHAR(100) NOT NULL,
  target_node VARCHAR(100) NOT NULL,
  source_handle VARCHAR(100),
  target_handle VARCHAR(100),
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### channels

Connected messaging channels.

```sql
CREATE TABLE channels (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  credentials JSONB NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| type | VARCHAR(50) | Channel type (telegram/whatsapp/slack) |
| credentials | JSONB | Encrypted channel credentials |
| webhook_url | TEXT | Channel-specific webhook |
| last_sync_at | TIMESTAMP | Last successful sync |

---

## AI & Knowledge Base Tables

### ai_configurations

AI settings per bot.

```sql
CREATE TABLE ai_configurations (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER UNIQUE NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  provider VARCHAR(50) DEFAULT 'openai',
  model VARCHAR(100) DEFAULT 'gpt-4',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  system_prompt TEXT,
  knowledge_base_id INTEGER REFERENCES knowledge_bases(id),
  api_key_encrypted TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| provider | VARCHAR(50) | AI provider (openai/anthropic) |
| model | VARCHAR(100) | Model identifier |
| temperature | DECIMAL(3,2) | Response randomness (0-1) |
| max_tokens | INTEGER | Max response tokens |
| system_prompt | TEXT | System instruction |
| knowledge_base_id | INTEGER | Linked knowledge base |
| api_key_encrypted | TEXT | Encrypted API key (optional) |

### knowledge_bases

Knowledge base containers.

```sql
CREATE TABLE knowledge_bases (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
  chunk_size INTEGER DEFAULT 1000,
  chunk_overlap INTEGER DEFAULT 200,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### documents

Uploaded documents.

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  file_type VARCHAR(50),
  file_size INTEGER,
  file_url TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| status | VARCHAR(50) | Processing status (pending/processing/completed/failed) |
| chunk_count | INTEGER | Number of chunks generated |
| error_message | TEXT | Processing error if any |
| processed_at | TIMESTAMP | When processing completed |

### chunks

Document chunks with embeddings.

```sql
CREATE TABLE chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vector similarity search index
CREATE INDEX idx_chunks_embedding ON chunks
  USING hnsw (embedding vector_cosine_ops);
```

| Column | Type | Description |
|--------|------|-------------|
| content | TEXT | Chunk text content |
| chunk_index | INTEGER | Position in document |
| embedding | vector(1536) | OpenAI embedding vector |
| metadata | JSONB | Additional metadata |

### intents

NLU intents.

```sql
CREATE TABLE intents (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  training_phrases JSONB DEFAULT '[]',
  responses JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  confidence_threshold DECIMAL(3,2) DEFAULT 0.7,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### entities

NLU entities.

```sql
CREATE TABLE entities (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'list',
  values JSONB DEFAULT '[]',
  synonyms JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Messaging Tables

### sessions

Chat sessions.

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  channel_id INTEGER REFERENCES channels(id),
  external_user_id VARCHAR(255),
  user_info JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  assigned_to INTEGER REFERENCES users(id),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  last_message_at TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| external_user_id | VARCHAR(255) | Platform user identifier |
| user_info | JSONB | User profile information |
| context | JSONB | Conversation context |
| status | VARCHAR(50) | Session status (active/closed/transferred) |
| assigned_to | INTEGER | Human agent assignment |

### messages

Chat messages.

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  intent_detected VARCHAR(255),
  confidence DECIMAL(4,3),
  ai_response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

| Column | Type | Description |
|--------|------|-------------|
| sender_type | VARCHAR(20) | Message sender (user/bot/agent) |
| content | TEXT | Message content |
| content_type | VARCHAR(50) | Content type (text/image/file/audio) |
| metadata | JSONB | Additional message data |
| intent_detected | VARCHAR(255) | Detected intent name |
| confidence | DECIMAL(4,3) | Intent confidence score |
| ai_response_time_ms | INTEGER | AI response latency |

### message_feedback

User feedback on messages.

```sql
CREATE TABLE message_feedback (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type VARCHAR(50),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Analytics Tables

### analytics_events

Event tracking.

```sql
CREATE TABLE analytics_events (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  user_id INTEGER REFERENCES users(id),
  session_id INTEGER REFERENCES sessions(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time-based partitioning for performance
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);
```

### daily_stats

Aggregated daily statistics.

```sql
CREATE TABLE daily_stats (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bot_id INTEGER REFERENCES bots(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_messages INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  satisfaction_score DECIMAL(3,2),
  intent_matches INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, bot_id, date)
);
```

---

## Enterprise Tables

### sso_configurations

SSO/SAML configuration.

```sql
CREATE TABLE sso_configurations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  idp_entity_id TEXT,
  idp_sso_url TEXT,
  idp_certificate TEXT,
  sp_entity_id TEXT,
  attribute_mapping JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### scim_tokens

SCIM provisioning tokens.

```sql
CREATE TABLE scim_tokens (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  description VARCHAR(255),
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP
);
```

### audit_logs

System audit trail.

```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
```

### subscriptions

Billing subscriptions.

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan_id VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Recovery Engine Tables

### abandoned_carts

Cart abandonment tracking.

```sql
CREATE TABLE abandoned_carts (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_customer_id VARCHAR(255),
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  cart_data JSONB NOT NULL,
  cart_value DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  abandoned_at TIMESTAMP NOT NULL,
  recovery_status VARCHAR(50) DEFAULT 'pending',
  recovered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### recovery_campaigns

Recovery campaign definitions.

```sql
CREATE TABLE recovery_campaigns (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  delay_hours INTEGER DEFAULT 24,
  channels JSONB DEFAULT '["email"]',
  template_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### recovery_attempts

Individual recovery attempts.

```sql
CREATE TABLE recovery_attempts (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES abandoned_carts(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES recovery_campaigns(id),
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  converted_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### customer_health_scores

Customer health tracking.

```sql
CREATE TABLE customer_health_scores (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_customer_id VARCHAR(255) NOT NULL,
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  churn_probability DECIMAL(4,3),
  engagement_score INTEGER,
  purchase_frequency INTEGER,
  last_activity_at TIMESTAMP,
  factors JSONB DEFAULT '{}',
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, external_customer_id)
);
```

---

## Indexes

### Performance Indexes

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Bots
CREATE INDEX idx_bots_organization ON bots(organization_id);
CREATE INDEX idx_bots_platform ON bots(platform);
CREATE INDEX idx_bots_active ON bots(is_active) WHERE is_active = true;

-- Messages
CREATE INDEX idx_messages_bot ON messages(bot_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Sessions
CREATE INDEX idx_sessions_bot ON sessions(bot_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_external_user ON sessions(external_user_id);

-- Chunks (Vector Search)
CREATE INDEX idx_chunks_document ON chunks(document_id);
CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

-- Analytics
CREATE INDEX idx_analytics_org_type ON analytics_events(organization_id, event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at DESC);

-- Audit Logs
CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
```

---

## Relationships

### Entity Relationship Diagram

```
users ─────────────┬───────────────────────────────────────┐
   │               │                                       │
   │               │                                       │
   ▼               ▼                                       ▼
organizations ◄─── organization_members              refresh_tokens
   │
   ├──► bots ─────────┬──────────────┬──────────────┬──────────────┐
   │       │          │              │              │              │
   │       │          ▼              ▼              ▼              ▼
   │       │    bot_flows      ai_configurations  channels      intents
   │       │       │                  │                            │
   │       │       │                  │                            │
   │       │       ▼                  ▼                            ▼
   │       │   flow_nodes      knowledge_bases                 entities
   │       │   flow_edges           │
   │       │                        │
   │       │                        ▼
   │       │                    documents
   │       │                        │
   │       │                        ▼
   │       │                     chunks
   │       │
   │       │
   │       └───────────► sessions
   │                         │
   │                         ▼
   │                     messages
   │                         │
   │                         ▼
   │                  message_feedback
   │
   ├──► knowledge_bases
   │
   ├──► sso_configurations
   │
   ├──► subscriptions
   │
   ├──► audit_logs
   │
   ├──► abandoned_carts
   │       │
   │       ▼
   │   recovery_attempts
   │
   └──► recovery_campaigns
```

---

## Data Retention

### Retention Policies

| Data Type | Retention Period | Notes |
|-----------|-----------------|-------|
| Messages | 1 year | Configurable per org |
| Sessions | 1 year | Includes metadata |
| Analytics Events | 2 years | Aggregated after 90 days |
| Audit Logs | 3 years | Compliance requirement |
| Refresh Tokens | 30 days | Auto-cleanup |

### Cleanup Jobs

```sql
-- Delete expired refresh tokens
DELETE FROM refresh_tokens
WHERE expires_at < NOW() OR revoked_at IS NOT NULL;

-- Archive old messages
INSERT INTO messages_archive SELECT * FROM messages
WHERE created_at < NOW() - INTERVAL '1 year';

-- Delete old analytics events (after aggregation)
DELETE FROM analytics_events
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## Migrations

### Running Migrations

```bash
# Run pending migrations
npm run migrate

# Create new migration
npm run migrate:create -- add_new_feature

# Rollback last migration
npm run migrate:rollback

# Reset database (DANGER)
npm run migrate:reset
```

### Migration File Structure

```
migrations/
├── 001_initial_schema.sql
├── 002_add_organizations.sql
├── 003_add_ai_configurations.sql
├── 004_add_knowledge_base.sql
├── 005_add_recovery_engine.sql
└── ...
```
