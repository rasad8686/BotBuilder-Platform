-- =====================================================
-- RAG Knowledge Base - pgvector Upgrade Migration
-- =====================================================
-- This migration enables pgvector extension and upgrades
-- the chunks table to use native vector type for embeddings
-- SAFE migration: uses ALTER TABLE to preserve existing data
-- =====================================================

-- Step 1: Enable pgvector extension
-- Note: Requires pgvector to be installed on PostgreSQL server
-- Install: CREATE EXTENSION vector; (run as superuser if needed)
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add organization_id to knowledge_bases if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_bases' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE knowledge_bases ADD COLUMN organization_id INTEGER;
    -- Copy tenant_id to organization_id for existing records
    UPDATE knowledge_bases SET organization_id = tenant_id WHERE organization_id IS NULL;
  END IF;
END $$;

-- Step 3: Add token_count column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chunks' AND column_name = 'token_count'
  ) THEN
    ALTER TABLE chunks ADD COLUMN token_count INTEGER;
  END IF;
END $$;

-- Step 4: Convert embedding column from TEXT to vector(1536)
-- This preserves existing data - pgvector can parse '[0.1,0.2,...]' format
DO $$
DECLARE
  current_type TEXT;
BEGIN
  -- Check current column type
  SELECT udt_name INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'chunks' AND column_name = 'embedding';

  -- Only convert if not already vector type
  IF current_type IS NOT NULL AND current_type != 'vector' THEN
    -- Convert TEXT to vector (pgvector parses '[...]' format automatically)
    ALTER TABLE chunks
    ALTER COLUMN embedding TYPE vector(1536)
    USING CASE
      WHEN embedding IS NULL THEN NULL
      WHEN embedding = '' THEN NULL
      ELSE embedding::vector(1536)
    END;

    RAISE NOTICE 'Converted embedding column from % to vector(1536)', current_type;
  ELSIF current_type = 'vector' THEN
    RAISE NOTICE 'Embedding column already vector type';
  END IF;
END $$;

-- Step 5: Create HNSW index for vector similarity search (if not exists)
-- Drop old index if exists with different config
DROP INDEX IF EXISTS idx_chunks_embedding_hnsw;
CREATE INDEX idx_chunks_embedding_hnsw
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Standard indexes for filtering (if not exist)
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_knowledge_base_id ON chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON chunks(chunk_index);

-- Step 5: Add helper function for cosine similarity search
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(1536),
  kb_id INTEGER,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id INTEGER,
  document_id INTEGER,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.metadata
  FROM chunks c
  WHERE c.knowledge_base_id = kb_id
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 6: Add function for multi-knowledge-base search
CREATE OR REPLACE FUNCTION search_chunks_multi_kb(
  query_embedding vector(1536),
  kb_ids INTEGER[],
  match_threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id INTEGER,
  document_id INTEGER,
  knowledge_base_id INTEGER,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.knowledge_base_id,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    c.metadata
  FROM chunks c
  WHERE c.knowledge_base_id = ANY(kb_ids)
    AND c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 7: Update documents table - add content column for full text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'content'
  ) THEN
    ALTER TABLE documents ADD COLUMN content TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE documents ADD COLUMN error_message TEXT;
  END IF;
END $$;

-- Step 8: Create embedding queue table for async processing
CREATE TABLE IF NOT EXISTS embedding_queue (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id INTEGER REFERENCES chunks(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
CREATE INDEX IF NOT EXISTS idx_embedding_queue_document ON embedding_queue(document_id);

-- Step 9: Add statistics tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_bases' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE knowledge_bases ADD COLUMN last_synced_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_bases' AND column_name = 'total_tokens'
  ) THEN
    ALTER TABLE knowledge_bases ADD COLUMN total_tokens INTEGER DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================
-- To test vector search:
-- SELECT * FROM search_similar_chunks(
--   '[0.1, 0.2, ...]'::vector(1536),  -- query embedding
--   1,                                  -- knowledge_base_id
--   0.7,                                -- similarity threshold
--   5                                   -- max results
-- );
-- =====================================================
