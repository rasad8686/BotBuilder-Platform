const pool = require('../db');
const log = require('../utils/logger');

class VectorStore {
  /**
   * Create a new knowledge base
   */
  async createKnowledgeBase(tenantId, data) {
    const { name, description, embedding_model, chunk_size, chunk_overlap } = data;

    const result = await pool.query(
      `INSERT INTO knowledge_bases (tenant_id, name, description, embedding_model, chunk_size, chunk_overlap)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        tenantId,
        name,
        description || null,
        embedding_model || 'text-embedding-3-small',
        chunk_size || 1000,
        chunk_overlap || 200
      ]
    );

    return result.rows[0];
  }

  /**
   * Store a chunk with its embedding
   */
  async storeChunk(documentId, knowledgeBaseId, chunkData) {
    const { content, embedding, chunk_index, start_char, end_char, metadata } = chunkData;

    const result = await pool.query(
      `INSERT INTO chunks (document_id, knowledge_base_id, content, embedding, chunk_index, start_char, end_char, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, document_id, knowledge_base_id, chunk_index, created_at`,
      [
        documentId,
        knowledgeBaseId,
        content,
        embedding ? `[${embedding.join(',')}]` : null,
        chunk_index,
        start_char || null,
        end_char || null,
        JSON.stringify(metadata || {})
      ]
    );

    return result.rows[0];
  }

  /**
   * Perform similarity search using cosine distance
   */
  async similaritySearch(knowledgeBaseId, queryEmbedding, options = {}) {
    const { limit = 20, threshold = 0.7 } = options;

    // Get all chunks with embeddings
    const result = await pool.query(
      `SELECT
        c.id,
        c.document_id,
        c.content,
        c.chunk_index,
        c.metadata,
        c.embedding,
        d.name as document_name,
        d.type as document_type
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE c.knowledge_base_id = $1
         AND c.embedding IS NOT NULL`,
      [knowledgeBaseId]
    );

    // Calculate similarity in JavaScript
    const results = result.rows
      .map(row => {
        const embedding = JSON.parse(row.embedding);
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return { ...row, similarity, embedding: undefined };
      })
      .filter(row => row.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Search across multiple knowledge bases
   */
  async multiKnowledgeBaseSearch(knowledgeBaseIds, queryEmbedding, options = {}) {
    const { limit = 20, threshold = 0.7 } = options;

    log.debug(`[VectorStore] multiKnowledgeBaseSearch called`);
    log.debug(`[VectorStore] KB IDs:`, knowledgeBaseIds);
    log.debug(`[VectorStore] Query embedding length:`, queryEmbedding?.length);

    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
      log.debug(`[VectorStore] No KB IDs provided`);
      return [];
    }

    const result = await pool.query(
      `SELECT
        c.id,
        c.document_id,
        c.knowledge_base_id,
        c.content,
        c.chunk_index,
        c.metadata,
        c.embedding,
        d.name as document_name,
        d.type as document_type,
        kb.name as knowledge_base_name
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       JOIN knowledge_bases kb ON c.knowledge_base_id = kb.id
       WHERE c.knowledge_base_id = ANY($1)
         AND c.embedding IS NOT NULL`,
      [knowledgeBaseIds]
    );

    log.debug(`[VectorStore] Found ${result.rows.length} chunks with embeddings`);

    if (result.rows.length === 0) {
      log.debug(`[VectorStore] No chunks found! Check if embeddings are stored.`);
      return [];
    }

    // Calculate similarity in JavaScript
    const allResults = result.rows.map(row => {
      try {
        let embedding = row.embedding;

        // Handle different embedding formats
        if (typeof embedding === 'string') {
          // Check if it's a PostgreSQL array format: [1,2,3] or {1,2,3}
          if (embedding.startsWith('{') && embedding.endsWith('}')) {
            embedding = JSON.parse('[' + embedding.slice(1, -1) + ']');
          } else if (embedding.startsWith('[')) {
            embedding = JSON.parse(embedding);
          } else {
            log.error(`[VectorStore] Unknown embedding format for chunk ${row.id}:`, embedding.substring(0, 50));
            return { ...row, similarity: 0, embedding: undefined };
          }
        }

        // Debug first chunk
        if (row.chunk_index === 0) {
          log.debug(`[VectorStore] Sample embedding length: ${embedding?.length}, first 3 values:`, embedding?.slice(0, 3));
          log.debug(`[VectorStore] Query embedding first 3 values:`, queryEmbedding?.slice(0, 3));
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        return { ...row, similarity, embedding: undefined };
      } catch (e) {
        log.error(`[VectorStore] Error parsing embedding for chunk ${row.id}:`, e.message);
        return { ...row, similarity: 0, embedding: undefined };
      }
    });

    // Log all similarity scores for debugging
    const scores = allResults.map(r => r.similarity.toFixed(4)).join(', ');
    log.debug(`[VectorStore] Similarity scores: ${scores}`);

    const results = allResults
      .filter(row => row.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    log.debug(`[VectorStore] After filtering (threshold ${threshold}): ${results.length} results`);
    return results;
  }

  /**
   * Get all knowledge bases for a tenant
   */
  async getKnowledgeBasesByTenant(tenantId) {
    const result = await pool.query(
      `SELECT * FROM knowledge_bases
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return result.rows;
  }

  /**
   * Get knowledge base by ID
   */
  async getKnowledgeBaseById(id) {
    const result = await pool.query(
      `SELECT * FROM knowledge_bases WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a knowledge base and all associated data
   */
  async deleteKnowledgeBase(id) {
    const result = await pool.query(
      `DELETE FROM knowledge_bases WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Update knowledge base statistics
   */
  async updateStats(knowledgeBaseId) {
    const result = await pool.query(
      `UPDATE knowledge_bases
       SET
         document_count = (SELECT COUNT(*) FROM documents WHERE knowledge_base_id = $1),
         total_chunks = (SELECT COUNT(*) FROM chunks WHERE knowledge_base_id = $1),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [knowledgeBaseId]
    );

    return result.rows[0];
  }

  /**
   * Get chunks by document ID
   */
  async getChunksByDocument(documentId) {
    const result = await pool.query(
      `SELECT id, document_id, knowledge_base_id, content, chunk_index, start_char, end_char, metadata, created_at
       FROM chunks
       WHERE document_id = $1
       ORDER BY chunk_index`,
      [documentId]
    );

    return result.rows;
  }

  /**
   * Delete chunks by document ID
   */
  async deleteChunksByDocument(documentId) {
    const result = await pool.query(
      `DELETE FROM chunks WHERE document_id = $1 RETURNING id`,
      [documentId]
    );

    return result.rowCount;
  }

  /**
   * Assign knowledge base to agent
   */
  async assignToAgent(agentId, knowledgeBaseId, priority = 0) {
    const result = await pool.query(
      `INSERT INTO agent_knowledge_bases (agent_id, knowledge_base_id, priority)
       VALUES ($1, $2, $3)
       ON CONFLICT (agent_id, knowledge_base_id)
       DO UPDATE SET priority = $3
       RETURNING *`,
      [agentId, knowledgeBaseId, priority]
    );

    return result.rows[0];
  }

  /**
   * Remove knowledge base from agent
   */
  async removeFromAgent(agentId, knowledgeBaseId) {
    const result = await pool.query(
      `DELETE FROM agent_knowledge_bases
       WHERE agent_id = $1 AND knowledge_base_id = $2
       RETURNING *`,
      [agentId, knowledgeBaseId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get knowledge bases assigned to an agent
   */
  async getAgentKnowledgeBases(agentId) {
    const result = await pool.query(
      `SELECT kb.*, akb.priority
       FROM knowledge_bases kb
       JOIN agent_knowledge_bases akb ON kb.id = akb.knowledge_base_id
       WHERE akb.agent_id = $1
       ORDER BY akb.priority DESC, kb.name`,
      [agentId]
    );

    return result.rows;
  }

  /**
   * Get agents assigned to a knowledge base
   */
  async getAgentsByKnowledgeBase(knowledgeBaseId) {
    const result = await pool.query(
      `SELECT a.*, akb.priority
       FROM agents a
       JOIN agent_knowledge_bases akb ON a.id = akb.agent_id
       WHERE akb.knowledge_base_id = $1
       ORDER BY akb.priority DESC, a.name`,
      [knowledgeBaseId]
    );

    return result.rows;
  }

  /**
   * Remove all agent assignments from a knowledge base
   */
  async removeAllAgentsFromKnowledgeBase(knowledgeBaseId) {
    const result = await pool.query(
      `DELETE FROM agent_knowledge_bases WHERE knowledge_base_id = $1`,
      [knowledgeBaseId]
    );

    return result.rowCount;
  }
}

module.exports = new VectorStore();
