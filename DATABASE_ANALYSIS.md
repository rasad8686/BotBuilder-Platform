# BotBuilder Platform - Complete Database Structure Analysis

Generated: 2025-12-30
Database Type: PostgreSQL
Total Migrations: 40+ files
Total Tables: 75+
Total Views: 4

---

## Executive Summary

The BotBuilder platform utilizes a comprehensive PostgreSQL database with 75+ tables organized across multiple business domains supporting:
- Multi-tenant SaaS operations
- Role-based access control (RBAC)
- AI/ML capabilities (fine-tuning, autonomous agents)
- Multi-channel integrations (WhatsApp, Telegram, Slack, Instagram)
- Revenue recovery and customer health analytics
- Enterprise features (SSO, 2FA, SCIM)
- Plugin marketplace
- Voice bot capabilities
- Knowledge base with vector embeddings

---

## Database Configuration

### Knex Configuration (server/knexfile.js)
- Client: PostgreSQL
- Connection timeout: 60,000ms
- Pool: Min 2, Max 10 connections
- SSL enabled for Railway/Render deployments

---

## Complete Table Catalog

### Core Tables (75+):
1. users
2. user_subscriptions
3. user_sessions
4. two_factor_backup_codes
5. password_reset_tokens
6. organizations
7. organization_members
8. roles
9. audit_logs
10. whitelabel_settings
11. bots
12. bot_messages
13. bot_flows
14. agents
15. autonomous_agents
16. agent_tasks
17. task_steps
18. agent_workflows
19. workflow_executions
20. agent_execution_steps
21. agent_messages
22. agent_tools
23. tools
24. tool_executions
25. knowledge_bases
26. documents
27. chunks
28. agent_knowledge_bases
29. intents
30. intent_examples
31. entities
32. entity_values
33. entity_branches
34. entity_versions
35. fine_tune_models
36. fine_tune_datasets
37. fine_tune_jobs
38. fine_tuning_metrics
39. model_versions
40. plugin_categories
41. plugins
42. plugin_versions
43. plugin_installations
44. plugin_reviews
45. channels
46. channel_messages
47. channel_templates
48. channel_webhooks
49. channel_contacts
50. voice_bots
51. voice_bot_sessions
52. voice_bot_templates
53. voice_bot_creations
54. calls
55. call_segments
56. phone_numbers
57. work_clones
58. clone_sessions
59. clone_training_data
60. clone_responses
61. subscription_plans
62. payment_history
63. usage_tracking
64. api_tokens
65. webhook_logs
66. email_notifications
67. sso_configurations
68. sso_domains
69. sso_user_mappings
70. sso_login_logs
71. recovery_campaigns
72. recovery_events
73. recovery_messages
74. recovery_analytics
75. customer_health_scores
76. customer_health_score_history
77. integrations
78. integration_logs
79. widget_configs
80. widget_messages
81. team_members
82. team_invitations
83. team_roles
84. activity_logs
85. nlu_logs
86. embedding_queue
87. flow_orchestrations
88. flow_transitions
89. flow_variables
90. admin_audit_log
91. admin_ip_whitelist
92. admin_login_attempts
93. admin_sessions
94. ab_tests
95. ab_test_results

### Database Views (4):
1. user_subscription_details
2. user_usage_summary
3. recent_audit_activity
4. user_activity_summary

---

## Primary Table Categories & Key Fields

### User Authentication (5 tables)
- users: email UNIQUE, password_hash, 2FA support
- user_subscriptions: Stripe integration, billing cycles
- user_sessions: Session token management, expiration
- two_factor_backup_codes: Recovery codes storage
- password_reset_tokens: Reset token lifecycle

### Multi-Tenancy & RBAC (5 tables)
- organizations: Owner-based model, billing integration
- organization_members: Flexible role assignments
- roles: Seeded (admin, member, viewer)
- audit_logs: Comprehensive action tracking
- whitelabel_settings: Custom branding per org

### Bot Core (4 tables)
- bots: Platform metadata, webhook integration
- bot_messages: Message definitions
- bot_flows: Visual flow JSONB storage
- intents/entities/entity_values: NLU training data

### AI & Agents (9 tables)
- agents: Per-bot agent definitions
- autonomous_agents: Independent agent execution
- agent_tasks: Task assignment and tracking
- task_steps: Step-level execution detail
- agent_workflows: Workflow orchestration
- workflow_executions: Execution logs
- agent_execution_steps: Individual agent steps
- agent_messages: Inter-agent communication
- tools/agent_tools/tool_executions: Tool management

### Knowledge Management (4 tables)
- knowledge_bases: KB configurations
- documents: Document management
- chunks: Document chunks with embeddings
- agent_knowledge_bases: Agent-KB associations

### Fine-Tuning & Models (4 tables)
- fine_tune_models: Custom model tracking
- fine_tune_datasets: Training data files
- fine_tune_jobs: Job status and metrics
- model_versions: Version history

### Channels & Integrations (8 tables)
- channels: Multi-channel configs
- channel_messages: Message delivery tracking
- channel_templates: WhatsApp templates
- channel_webhooks: Webhook event processing
- channel_contacts: Contact management
- integrations: External service connections
- integration_logs: Integration operation history
- voice_bots/calls: Voice interaction tracking

### Billing & Subscriptions (4 tables)
- subscription_plans: Plan definitions
- user_subscriptions: User-plan assignment
- payment_history: Transaction records
- usage_tracking: API/message usage

### Revenue Recovery (6 tables)
- recovery_campaigns: Campaign configurations
- recovery_events: Event triggers
- recovery_messages: Message delivery
- recovery_analytics: Aggregated metrics
- customer_health_scores: AI health scoring
- customer_health_score_history: Score trends

### Marketplace (4 tables)
- plugin_categories: Plugin categorization
- plugins: Plugin marketplace listings
- plugin_versions: Version history
- plugin_installations: Installation tracking

### Enterprise Security (4 tables)
- sso_configurations: SSO provider setup
- sso_domains: Domain verification
- sso_user_mappings: Identity mappings
- sso_login_logs: Authentication audit

### Extensibility (4 tables)
- widget_configs: Embeddable widget setup
- widget_messages: Widget chat history
- api_tokens: API access tokens
- email_notifications: Email queue

---

## Critical Relationships

Users -> Organizations (via organization_members)
Organizations -> Bots -> Agents -> Tools
Agents -> Knowledge Bases -> Documents -> Chunks
Users -> Fine Tune Models -> Jobs -> Datasets
Organizations -> Recovery Campaigns -> Events/Messages/Analytics
Users -> Subscriptions -> Payment History
Channels -> Messages -> Contacts -> Webhooks

---

## Indexing Summary

150+ indexes across all tables
Composite indexes for org/bot/date queries
Partial indexes for status filtering
Missing: pgvector indexes for semantic search
Missing: Partitioning for high-volume tables

---

## Identified Gaps

1. Vector embeddings not enabled (pgvector commented out)
2. Admin tables (admin_*) exist but underdocumented
3. A/B testing schema incomplete
4. Activity logging sparse
5. Flow management partially defined
6. Team collaboration minimal

---

## Recommendations

HIGH PRIORITY:
- Enable pgvector for semantic search
- Add table partitioning (channel_messages, recovery_events)
- Implement archiving for old data
- Use CHECK constraints instead of VARCHAR status
- Create materialized views for analytics

MEDIUM PRIORITY:
- Complete admin table documentation
- Full A/B testing schema
- Implement soft deletes
- Add JSONB validation triggers

---

## Statistics

Tables: 95
Views: 4
Functions: 10+
Triggers: 8+
Indexes: 150+
Foreign Keys: 100+
Migrations: 40+

