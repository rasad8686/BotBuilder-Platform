const pool = require('../db');

class Document {
  /**
   * Find all documents by knowledge base ID
   */
  static async findByKnowledgeBase(knowledgeBaseId) {
    const result = await pool.query(
      `SELECT * FROM documents
       WHERE knowledge_base_id = $1
       ORDER BY created_at DESC`,
      [knowledgeBaseId]
    );

    return result.rows;
  }

  /**
   * Find document by ID
   */
  static async findById(id) {
    const result = await pool.query(
      `SELECT * FROM documents WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find document by ID with knowledge base verification
   */
  static async findByIdAndKnowledgeBase(id, knowledgeBaseId) {
    const result = await pool.query(
      `SELECT * FROM documents WHERE id = $1 AND knowledge_base_id = $2`,
      [id, knowledgeBaseId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new document
   */
  static async create(data) {
    const {
      knowledge_base_id,
      name,
      type,
      source_url,
      file_path,
      file_size,
      content_hash,
      metadata = {}
    } = data;

    const result = await pool.query(
      `INSERT INTO documents (knowledge_base_id, name, type, source_url, file_path, file_size, content_hash, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        knowledge_base_id,
        name,
        type,
        source_url || null,
        file_path || null,
        file_size || null,
        content_hash || null,
        JSON.stringify(metadata)
      ]
    );

    return result.rows[0];
  }

  /**
   * Update document status
   */
  static async updateStatus(id, status, chunkCount = null) {
    let query, values;

    if (chunkCount !== null) {
      query = `UPDATE documents
               SET status = $1, chunk_count = $2, updated_at = CURRENT_TIMESTAMP
               WHERE id = $3
               RETURNING *`;
      values = [status, chunkCount, id];
    } else {
      query = `UPDATE documents
               SET status = $1, updated_at = CURRENT_TIMESTAMP
               WHERE id = $2
               RETURNING *`;
      values = [status, id];
    }

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Update document
   */
  static async update(id, data) {
    const { name, type, source_url, file_path, file_size, content_hash, status, chunk_count, metadata } = data;

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(type);
    }
    if (source_url !== undefined) {
      fields.push(`source_url = $${paramIndex++}`);
      values.push(source_url);
    }
    if (file_path !== undefined) {
      fields.push(`file_path = $${paramIndex++}`);
      values.push(file_path);
    }
    if (file_size !== undefined) {
      fields.push(`file_size = $${paramIndex++}`);
      values.push(file_size);
    }
    if (content_hash !== undefined) {
      fields.push(`content_hash = $${paramIndex++}`);
      values.push(content_hash);
    }
    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (chunk_count !== undefined) {
      fields.push(`chunk_count = $${paramIndex++}`);
      values.push(chunk_count);
    }
    if (metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(metadata));
    }

    if (fields.length === 0) {
      return await this.findById(id);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE documents
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Delete a document
   */
  static async delete(id) {
    const result = await pool.query(
      `DELETE FROM documents WHERE id = $1 RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find document by content hash (for deduplication)
   */
  static async findByContentHash(knowledgeBaseId, contentHash) {
    const result = await pool.query(
      `SELECT * FROM documents WHERE knowledge_base_id = $1 AND content_hash = $2`,
      [knowledgeBaseId, contentHash]
    );

    return result.rows[0] || null;
  }

  /**
   * Get documents by status
   */
  static async findByStatus(knowledgeBaseId, status) {
    const result = await pool.query(
      `SELECT * FROM documents
       WHERE knowledge_base_id = $1 AND status = $2
       ORDER BY created_at DESC`,
      [knowledgeBaseId, status]
    );

    return result.rows;
  }

  /**
   * Count documents by knowledge base
   */
  static async countByKnowledgeBase(knowledgeBaseId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM documents WHERE knowledge_base_id = $1`,
      [knowledgeBaseId]
    );

    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = Document;
