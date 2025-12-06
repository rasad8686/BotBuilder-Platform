-- Knowledge Base Vector DB Migration
-- Run this when PostgreSQL is available

-- Enable vector extension (optional - only if pgvector is installed)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  embedding_model VARCHAR(100) DEFAULT 'text-embedding-3-small',
  chunk_size INTEGER DEFAULT 500,
  chunk_overlap INTEGER DEFAULT 50,
  status VARCHAR(50) DEFAULT 'active',
  document_count INTEGER DEFAULT 0,
  total_chunks INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  source_url TEXT,
  file_path TEXT,
  file_size INTEGER,
  content_hash VARCHAR(64),
  status VARCHAR(50) DEFAULT 'pending',
  chunk_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chunks table with vector embedding
CREATE TABLE IF NOT EXISTS chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding TEXT,
  chunk_index INTEGER NOT NULL,
  start_char INTEGER,
  end_char INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Knowledge Bases junction table
CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL,
  knowledge_base_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(agent_id, knowledge_base_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_tenant ON knowledge_bases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_status ON knowledge_bases(status);
CREATE INDEX IF NOT EXISTS idx_documents_knowledge_base ON documents(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_knowledge_base ON chunks(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_agent ON agent_knowledge_bases(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_knowledge_bases_kb ON agent_knowledge_bases(knowledge_base_id);

-- Vector similarity search index (IVFFlat for approximate nearest neighbor)
-- Note: This requires at least some data before creation, or use HNSW instead
-- CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
