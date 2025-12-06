-- =====================================================
-- Add Knowledge Base support to AI Configuration
-- =====================================================

-- Add knowledge_base_id column to ai_configurations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'knowledge_base_id'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN knowledge_base_id INTEGER REFERENCES knowledge_bases(id) ON DELETE SET NULL;

    COMMENT ON COLUMN ai_configurations.knowledge_base_id IS 'Linked knowledge base for RAG (Retrieval-Augmented Generation)';
  END IF;
END $$;

-- Add enable_rag column to control RAG behavior
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'enable_rag'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN enable_rag BOOLEAN DEFAULT true;

    COMMENT ON COLUMN ai_configurations.enable_rag IS 'Enable RAG (uses knowledge base for context)';
  END IF;
END $$;

-- Add rag_threshold column for similarity threshold
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'rag_threshold'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN rag_threshold DECIMAL(3,2) DEFAULT 0.7;

    COMMENT ON COLUMN ai_configurations.rag_threshold IS 'Minimum similarity score for RAG results (0.0-1.0)';
  END IF;
END $$;

-- Add rag_max_chunks column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_configurations' AND column_name = 'rag_max_chunks'
  ) THEN
    ALTER TABLE ai_configurations
    ADD COLUMN rag_max_chunks INTEGER DEFAULT 5;

    COMMENT ON COLUMN ai_configurations.rag_max_chunks IS 'Maximum number of chunks to include in RAG context';
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_config_knowledge_base
  ON ai_configurations(knowledge_base_id)
  WHERE knowledge_base_id IS NOT NULL;

-- =====================================================
-- Migration Complete
-- =====================================================
