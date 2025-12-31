# BotBuilder Database Relationships Summary

## Core Entity Relationships

### User Hierarchy
- users -> organization_members -> organizations
- users -> user_subscriptions -> subscription_plans
- users -> api_tokens -> bots/organizations
- users -> autonomous_agents -> agent_tasks -> task_steps

### Bot Hierarchy
- organizations -> bots
- bots -> bot_messages, bot_flows, intents, entities
- bots -> agents -> agent_workflows -> workflow_executions
- agents -> agent_tools -> tools
- agents -> agent_knowledge_bases -> knowledge_bases

### Data Flow
- knowledge_bases -> documents -> chunks (embeddings)
- fine_tune_models -> fine_tune_datasets, fine_tune_jobs -> training_metrics
- channels -> channel_messages, channel_templates, channel_contacts
- recovery_campaigns -> recovery_events -> recovery_messages -> recovery_analytics
- customer_health_scores -> customer_health_score_history

### Integrations
- user_id -> integrations -> integration_logs
- organization_id -> sso_configurations -> sso_domains/sso_user_mappings
- bot_id -> webhook_logs, widget_configs

## Table Count by Category

- Authentication: 5 tables
- Multi-tenancy: 5 tables
- Bots: 4 tables
- Agents: 9 tables
- Knowledge: 4 tables
- Fine-tuning: 4 tables
- NLU: 6 tables
- Channels: 8 tables
- Voice: 7 tables
- Billing: 4 tables
- Revenue Recovery: 6 tables
- Plugins: 4 tables
- Security: 4 tables
- Other: 12 tables
Total: 95 tables

## Foreign Key Overview

- Users: 12 outbound FKs
- Organizations: 18 outbound FKs
- Bots: 10 outbound FKs
- Agents: 8 outbound FKs
- Knowledge Bases: 4 outbound FKs
- Channels: 5 outbound FKs
- Total: 100+ foreign keys

## Data Integrity

- All FKs use ON DELETE CASCADE
- UNIQUE constraints: email, slug, token_hash
- CHECK constraints: status enums, value ranges
- Triggers: auto-update timestamps
- Indexes: 150+ for performance

See DATABASE_ANALYSIS.md for complete schema details.

