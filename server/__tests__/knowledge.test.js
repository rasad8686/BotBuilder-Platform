/**
 * Knowledge Base API Tests
 * Tests for /api/knowledge endpoints: CRUD, documents, search
 */

const request = require('supertest');

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// GET all knowledge bases
app.get('/api/knowledge', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM knowledge_bases WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET single knowledge base
app.get('/api/knowledge/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CREATE knowledge base
app.post('/api/knowledge', mockAuth, async (req, res) => {
  try {
    const { name, description, embedding_model, chunk_size, chunk_overlap } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const result = await db.query(
      `INSERT INTO knowledge_bases (tenant_id, name, description, embedding_model, chunk_size, chunk_overlap, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *`,
      [req.organization.id, name, description || '', embedding_model || 'text-embedding-ada-002', chunk_size || 1000, chunk_overlap || 200]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATE knowledge base
app.put('/api/knowledge/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, status } = req.body;

    const existing = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    const result = await db.query(
      `UPDATE knowledge_bases SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       status = COALESCE($3, status),
       updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name, description, status, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE knowledge base
app.delete('/api/knowledge/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    await db.query('DELETE FROM knowledge_bases WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Knowledge base deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET documents
app.get('/api/knowledge/:id/documents', mockAuth, async (req, res) => {
  try {
    const kbResult = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (kbResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    const result = await db.query(
      'SELECT * FROM documents WHERE knowledge_base_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADD document
app.post('/api/knowledge/:id/documents', mockAuth, async (req, res) => {
  try {
    const { name, type, content, source_url } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Document name is required' });
    }

    const kbResult = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (kbResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    const result = await db.query(
      `INSERT INTO documents (knowledge_base_id, name, type, source_url, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [req.params.id, name, type || 'text', source_url || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE document
app.delete('/api/knowledge/:id/documents/:docId', mockAuth, async (req, res) => {
  try {
    const kbResult = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (kbResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    const docResult = await db.query(
      'SELECT * FROM documents WHERE id = $1 AND knowledge_base_id = $2',
      [req.params.docId, req.params.id]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    await db.query('DELETE FROM documents WHERE id = $1', [req.params.docId]);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// SEARCH knowledge base
app.post('/api/knowledge/:id/search', mockAuth, async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const kbResult = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (kbResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    // Mock semantic search results
    const result = await db.query(
      `SELECT c.*, d.name as document_name
       FROM chunks c
       JOIN documents d ON c.document_id = d.id
       WHERE d.knowledge_base_id = $1
       LIMIT $2`,
      [req.params.id, limit]
    );

    res.json({
      success: true,
      data: {
        query,
        results: result.rows.map(r => ({
          ...r,
          score: Math.random() * 0.5 + 0.5 // Mock relevance score
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET agents assigned to knowledge base
app.get('/api/knowledge/:id/agents', mockAuth, async (req, res) => {
  try {
    const kbResult = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (kbResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    const result = await db.query(
      `SELECT a.* FROM agents a
       JOIN agent_knowledge_bases akb ON a.id = akb.agent_id
       WHERE akb.knowledge_base_id = $1`,
      [req.params.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATE agent assignments
app.put('/api/knowledge/:id/agents', mockAuth, async (req, res) => {
  try {
    const { agent_ids } = req.body;

    if (!Array.isArray(agent_ids)) {
      return res.status(400).json({ success: false, message: 'agent_ids must be an array' });
    }

    const kbResult = await db.query(
      'SELECT * FROM knowledge_bases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.organization.id]
    );

    if (kbResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }

    // Remove existing assignments
    await db.query('DELETE FROM agent_knowledge_bases WHERE knowledge_base_id = $1', [req.params.id]);

    // Add new assignments
    for (const agentId of agent_ids) {
      await db.query(
        'INSERT INTO agent_knowledge_bases (agent_id, knowledge_base_id) VALUES ($1, $2)',
        [agentId, req.params.id]
      );
    }

    res.json({ success: true, message: 'Agent assignments updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Knowledge Base API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET ALL KNOWLEDGE BASES
  // ========================================
  describe('GET /api/knowledge', () => {
    it('should return all knowledge bases', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'KB 1', status: 'active' },
          { id: 2, name: 'KB 2', status: 'active' }
        ]
      });

      const res = await request(app).get('/api/knowledge');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no knowledge bases', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/knowledge');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/knowledge');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET SINGLE KNOWLEDGE BASE
  // ========================================
  describe('GET /api/knowledge/:id', () => {
    it('should return knowledge base by ID', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test KB', status: 'active' }]
      });

      const res = await request(app).get('/api/knowledge/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test KB');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/knowledge/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/knowledge/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CREATE KNOWLEDGE BASE
  // ========================================
  describe('POST /api/knowledge', () => {
    it('should create knowledge base successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'New KB', status: 'active' }]
      });

      const res = await request(app)
        .post('/api/knowledge')
        .send({ name: 'New KB' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New KB');
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/knowledge')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Name');
    });

    it('should return 400 if name is empty', async () => {
      const res = await request(app)
        .post('/api/knowledge')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
    });

    it('should use default values for optional fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'KB',
          embedding_model: 'text-embedding-ada-002',
          chunk_size: 1000,
          chunk_overlap: 200
        }]
      });

      const res = await request(app)
        .post('/api/knowledge')
        .send({ name: 'KB' });

      expect(res.status).toBe(201);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/knowledge')
        .send({ name: 'KB' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // UPDATE KNOWLEDGE BASE
  // ========================================
  describe('PUT /api/knowledge/:id', () => {
    it('should update knowledge base successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated KB' }] });

      const res = await request(app)
        .put('/api/knowledge/1')
        .send({ name: 'Updated KB' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/knowledge/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/knowledge/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // DELETE KNOWLEDGE BASE
  // ========================================
  describe('DELETE /api/knowledge/:id', () => {
    it('should delete knowledge base successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/knowledge/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/knowledge/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/knowledge/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET DOCUMENTS
  // ========================================
  describe('GET /api/knowledge/:id/documents', () => {
    it('should return documents for knowledge base', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Doc 1', type: 'pdf' },
            { id: 2, name: 'Doc 2', type: 'text' }
          ]
        });

      const res = await request(app).get('/api/knowledge/1/documents');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 if knowledge base not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/knowledge/999/documents');

      expect(res.status).toBe(404);
    });

    it('should return empty array if no documents', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/knowledge/1/documents');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/knowledge/1/documents');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // ADD DOCUMENT
  // ========================================
  describe('POST /api/knowledge/:id/documents', () => {
    it('should add document successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Doc', status: 'pending' }] });

      const res = await request(app)
        .post('/api/knowledge/1/documents')
        .send({ name: 'New Doc', type: 'pdf' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/knowledge/1/documents')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 if knowledge base not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/knowledge/999/documents')
        .send({ name: 'Doc' });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/knowledge/1/documents')
        .send({ name: 'Doc' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // DELETE DOCUMENT
  // ========================================
  describe('DELETE /api/knowledge/:id/documents/:docId', () => {
    it('should delete document successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/knowledge/1/documents/5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if knowledge base not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/knowledge/999/documents/5');

      expect(res.status).toBe(404);
    });

    it('should return 404 if document not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/knowledge/1/documents/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/knowledge/1/documents/5');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // SEARCH
  // ========================================
  describe('POST /api/knowledge/:id/search', () => {
    it('should search knowledge base successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, content: 'Chunk 1', document_name: 'Doc 1' },
            { id: 2, content: 'Chunk 2', document_name: 'Doc 1' }
          ]
        });

      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'How to configure?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results.length).toBeGreaterThan(0);
    });

    it('should return 400 if query is missing', async () => {
      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 if query is empty', async () => {
      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: '   ' });

      expect(res.status).toBe(400);
    });

    it('should return 404 if knowledge base not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/knowledge/999/search')
        .send({ query: 'test' });

      expect(res.status).toBe(404);
    });

    it('should accept custom limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'test', limit: 10 });

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'test' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // AGENT ASSIGNMENTS
  // ========================================
  describe('GET /api/knowledge/:id/agents', () => {
    it('should return assigned agents', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Agent 1' },
            { id: 2, name: 'Agent 2' }
          ]
        });

      const res = await request(app).get('/api/knowledge/1/agents');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 if knowledge base not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/knowledge/999/agents');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/knowledge/1/agents');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/knowledge/:id/agents', () => {
    it('should update agent assignments', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .put('/api/knowledge/1/agents')
        .send({ agent_ids: [1, 2] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if agent_ids is not an array', async () => {
      const res = await request(app)
        .put('/api/knowledge/1/agents')
        .send({ agent_ids: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should return 404 if knowledge base not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/knowledge/999/agents')
        .send({ agent_ids: [1] });

      expect(res.status).toBe(404);
    });

    it('should handle empty agent_ids array', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 0 });

      const res = await request(app)
        .put('/api/knowledge/1/agents')
        .send({ agent_ids: [] });

      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/knowledge/1/agents')
        .send({ agent_ids: [1] });

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// KNOWLEDGE BASE EDGE CASES
// ========================================
describe('Knowledge Base Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Name Validation', () => {
    it('should accept unicode knowledge base name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'База знаний' }] });

      const res = await request(app)
        .post('/api/knowledge')
        .send({ name: 'База знаний' });

      expect(res.status).toBe(201);
    });

    it('should accept very long name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'A'.repeat(255) }] });

      const res = await request(app)
        .post('/api/knowledge')
        .send({ name: 'A'.repeat(255) });

      expect(res.status).toBe(201);
    });
  });

  describe('Document Types', () => {
    it('should accept PDF document type', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, type: 'pdf' }] });

      const res = await request(app)
        .post('/api/knowledge/1/documents')
        .send({ name: 'Doc', type: 'pdf' });

      expect(res.status).toBe(201);
    });

    it('should accept URL source', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, source_url: 'https://example.com' }] });

      const res = await request(app)
        .post('/api/knowledge/1/documents')
        .send({ name: 'Doc', source_url: 'https://example.com' });

      expect(res.status).toBe(201);
    });
  });

  describe('Search Queries', () => {
    it('should handle very long search query', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'A'.repeat(1000) });

      expect(res.status).toBe(200);
    });

    it('should handle special characters in search query', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/knowledge/1/search')
        .send({ query: 'How do I configure $VAR?' });

      expect(res.status).toBe(200);
    });
  });
});
