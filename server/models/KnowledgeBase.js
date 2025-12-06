const pool = require('../db');

class KnowledgeBase {
  /**
   * Find all knowledge bases by tenant ID
   */
  static async findByTenant(tenantId) {
    const result = await pool.query(
      `SELECT * FROM knowledge_bases
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return result.rows;
  }

  /**
   * Find knowledge base by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM knowledge_bases WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find knowledge base by ID with tenant verification
   */
  static async findByIdAndTenant(id, tenantId) {
    const result = await pool.query(
      `SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new knowledge base
   */
  static async create(data) {
    const {
      tenant_id,
      name,
      description,
      embedding_model = 'text-embedding-3-small',
      chunk_size = 1000,
      chunk_overlap = 200
    } = data;

    const result = await pool.query(
      `INSERT INTO knowledge_bases (tenant_id, name, description, embedding_model, chunk_size, chunk_overlap)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, name, description, embedding_model, chunk_size, chunk_overlap]
    );

    return result.rows[0];
  }

  /**
   * Update a knowledge base
   */
  static async update(id, data) {
    const { name, description, embedding_model, chunk_size, chunk_overlap, status } = data;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(description);
    }
    if (embedding_model !== undefined) {
      fields.push(`embedding_model = $${paramIndex++}`);
      values.push(embedding_model);
    }
    if (chunk_size !== undefined) {
      fields.push(`chunk_size = $${paramIndex++}`);
      values.push(chunk_size);
    }
    if (chunk_overlap !== undefined) {
      fields.push(`chunk_overlap = $${paramIndex++}`);
      values.push(chunk_overlap);
    }
    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE knowledge_bases
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a knowledge base
   */
  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM knowledge_bases WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Update document and chunk counts
   */
  static async updateCounts(id) {
    const result = await pool.query(
      `UPDATE knowledge_bases
       SET
         document_count = (SELECT COUNT(*) FROM documents WHERE knowledge_base_id = $1),
         total_chunks = (SELECT COUNT(*) FROM chunks WHERE knowledge_base_id = $1),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Get knowledge bases assigned to an agent
   */
  static async findByAgent(agentId) {
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
   * Check if knowledge base exists and belongs to tenant
   */
  static async existsForTenant(id, tenantId) {
    const result = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM knowledge_bases WHERE id = $1 AND tenant_id = $2) as exists`,
      [id, tenantId]
    );

    return result.rows[0].exists;
  }
}

module.exports = KnowledgeBase;
