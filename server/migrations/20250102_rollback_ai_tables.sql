-- ═══════════════════════════════════════════════════════════
-- AI INTEGRATION ROLLBACK
-- Created: 2025-01-02
-- Description: Rollback AI tables (if needed)
-- ═══════════════════════════════════════════════════════════

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS ai_conversations CASCADE;
DROP TABLE IF EXISTS ai_usage_logs CASCADE;
DROP TABLE IF EXISTS ai_configurations CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ AI tables dropped successfully!';
    RAISE NOTICE '   - ai_conversations';
    RAISE NOTICE '   - ai_usage_logs';
    RAISE NOTICE '   - ai_configurations';
END $$;
