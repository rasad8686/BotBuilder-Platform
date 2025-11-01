# Database Migrations

This directory contains SQL migration files for the BotBuilder platform.

## Available Migrations

### 20250102_add_ai_tables.sql
**Purpose:** Add AI integration tables
**Created:** 2025-01-02
**Tables:**
- `ai_configurations` - AI provider settings per bot
- `ai_usage_logs` - Usage tracking for billing
- `ai_conversations` - Conversation history for context

## Running Migrations

### Run a Migration

```bash
# From project root
node server/scripts/runMigration.js 20250102_add_ai_tables.sql
```

### Verify Migration

```bash
# Check if AI tables were created
node server/scripts/verifyAiTables.js
```

### Rollback (if needed)

```bash
# Rollback AI tables
node server/scripts/runMigration.js 20250102_rollback_ai_tables.sql
```

## Migration Naming Convention

Format: `YYYYMMDD_description.sql`

Examples:
- `20250102_add_ai_tables.sql`
- `20250103_add_payment_methods.sql`
- `20250104_add_analytics_events.sql`

## Safety Notes

⚠️ **IMPORTANT:**
- Always backup your database before running migrations
- Test migrations in development first
- Review the SQL file before executing
- Migrations are NOT reversible unless you run the rollback script
- Rollback scripts will DELETE DATA - use with caution

## Environment

Make sure your `.env` file has:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

The migration runner will automatically detect SSL requirements for Railway/Render.
