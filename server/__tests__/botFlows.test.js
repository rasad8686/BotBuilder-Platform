/**
 * Bot Flows API Tests
 * Tests for /api/bots/:botId/flows endpoints: CRUD, export, import
 */

const request = require('supertest');

jest.mock('../db', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

app.get('/api/bots/:botId/flows', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const result = await db.query('SELECT * FROM bot_flows WHERE bot_id = $1 ORDER BY created_at DESC', [req.params.botId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/bots/:botId/flows/:flowId', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const result = await db.query('SELECT * FROM bot_flows WHERE id = $1 AND bot_id = $2', [req.params.flowId, req.params.botId]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/bots/:botId/flows', mockAuth, async (req, res) => {
  try {
    const { name, description, nodes, edges, is_active } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ success: false, message: 'Flow name is required' });

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const result = await db.query(
      `INSERT INTO bot_flows (bot_id, name, description, nodes, edges, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.botId, name, description || '', JSON.stringify(nodes || []), JSON.stringify(edges || []), is_active !== false, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/bots/:botId/flows/:flowId', mockAuth, async (req, res) => {
  try {
    const { name, description, nodes, edges, is_active } = req.body;

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const existing = await db.query('SELECT * FROM bot_flows WHERE id = $1 AND bot_id = $2', [req.params.flowId, req.params.botId]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const result = await db.query(
      `UPDATE bot_flows SET name = COALESCE($1, name), description = COALESCE($2, description),
       nodes = COALESCE($3, nodes), edges = COALESCE($4, edges), is_active = COALESCE($5, is_active),
       updated_at = NOW() WHERE id = $6 RETURNING *`,
      [name, description, nodes ? JSON.stringify(nodes) : null, edges ? JSON.stringify(edges) : null, is_active, req.params.flowId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/bots/:botId/flows/:flowId', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const existing = await db.query('SELECT * FROM bot_flows WHERE id = $1 AND bot_id = $2', [req.params.flowId, req.params.botId]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    await db.query('DELETE FROM bot_flows WHERE id = $1', [req.params.flowId]);
    res.json({ success: true, message: 'Flow deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/bots/:botId/flows/:flowId/duplicate', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const flowResult = await db.query('SELECT * FROM bot_flows WHERE id = $1 AND bot_id = $2', [req.params.flowId, req.params.botId]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const flow = flowResult.rows[0];
    const result = await db.query(
      `INSERT INTO bot_flows (bot_id, name, description, nodes, edges, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING *`,
      [req.params.botId, `${flow.name} (Copy)`, flow.description, flow.nodes, flow.edges, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/bots/:botId/flows/:flowId/export', mockAuth, async (req, res) => {
  try {
    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const flowResult = await db.query('SELECT * FROM bot_flows WHERE id = $1 AND bot_id = $2', [req.params.flowId, req.params.botId]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const flow = flowResult.rows[0];
    res.json({
      success: true,
      data: {
        name: flow.name,
        description: flow.description,
        nodes: flow.nodes,
        edges: flow.edges,
        version: '1.0'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/bots/:botId/flows/import', mockAuth, async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Flow name is required' });
    if (!nodes || !Array.isArray(nodes)) return res.status(400).json({ success: false, message: 'Flow nodes are required' });

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const result = await db.query(
      `INSERT INTO bot_flows (bot_id, name, description, nodes, edges, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING *`,
      [req.params.botId, name, description || '', JSON.stringify(nodes), JSON.stringify(edges || []), req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/bots/:botId/flows/:flowId/test', mockAuth, async (req, res) => {
  try {
    const { input } = req.body;
    if (!input) return res.status(400).json({ success: false, message: 'Test input is required' });

    const botResult = await db.query('SELECT * FROM bots WHERE id = $1 AND organization_id = $2', [req.params.botId, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const flowResult = await db.query('SELECT * FROM bot_flows WHERE id = $1 AND bot_id = $2', [req.params.flowId, req.params.botId]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    // Mock flow execution result
    res.json({
      success: true,
      data: {
        input,
        output: { response: 'Test response', matched_node: 'start' },
        execution_path: ['start', 'process', 'end'],
        duration_ms: 150
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Bot Flows API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/bots/:botId/flows', () => {
    it('should return bot flows', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Main Flow' }] });
      const res = await request(app).get('/api/bots/1/flows');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/bots/999/flows');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/bots/1/flows');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/bots/:botId/flows/:flowId', () => {
    it('should return flow by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Main Flow', nodes: '[]' }] });
      const res = await request(app).get('/api/bots/1/flows/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/bots/999/flows/1');
      expect(res.status).toBe(404);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/bots/1/flows/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/bots/1/flows/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/bots/:botId/flows', () => {
    it('should create flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Flow' }] });
      const res = await request(app).post('/api/bots/1/flows').send({ name: 'New Flow', nodes: [], edges: [] });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/bots/1/flows').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/bots/999/flows').send({ name: 'New Flow' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/bots/1/flows').send({ name: 'New Flow' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/bots/:botId/flows/:flowId', () => {
    it('should update flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Flow' }] });
      const res = await request(app).put('/api/bots/1/flows/1').send({ name: 'Updated Flow' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/bots/999/flows/1').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/bots/1/flows/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/bots/1/flows/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/bots/:botId/flows/:flowId', () => {
    it('should delete flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/bots/1/flows/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/bots/999/flows/1');
      expect(res.status).toBe(404);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/bots/1/flows/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/bots/1/flows/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/bots/:botId/flows/:flowId/duplicate', () => {
    it('should duplicate flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Original', description: 'Desc', nodes: '[]', edges: '[]' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Original (Copy)' }] });
      const res = await request(app).post('/api/bots/1/flows/1/duplicate');
      expect(res.status).toBe(201);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/bots/999/flows/1/duplicate');
      expect(res.status).toBe(404);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/bots/1/flows/999/duplicate');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/bots/1/flows/1/duplicate');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/bots/:botId/flows/:flowId/export', () => {
    it('should export flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Flow', description: 'Desc', nodes: '[]', edges: '[]' }] });
      const res = await request(app).get('/api/bots/1/flows/1/export');
      expect(res.status).toBe(200);
      expect(res.body.data.version).toBeDefined();
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/bots/999/flows/1/export');
      expect(res.status).toBe(404);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/bots/1/flows/999/export');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/bots/1/flows/1/export');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/bots/:botId/flows/import', () => {
    it('should import flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Imported Flow' }] });
      const res = await request(app).post('/api/bots/1/flows/import').send({ name: 'Imported Flow', nodes: [], edges: [] });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/bots/1/flows/import').send({ nodes: [] });
      expect(res.status).toBe(400);
    });

    it('should return 400 if nodes missing', async () => {
      const res = await request(app).post('/api/bots/1/flows/import').send({ name: 'Flow' });
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/bots/999/flows/import').send({ name: 'Flow', nodes: [] });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/bots/1/flows/import').send({ name: 'Flow', nodes: [] });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/bots/:botId/flows/:flowId/test', () => {
    it('should test flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, nodes: '[]' }] });
      const res = await request(app).post('/api/bots/1/flows/1/test').send({ input: 'Hello' });
      expect(res.status).toBe(200);
      expect(res.body.data.execution_path).toBeDefined();
    });

    it('should return 400 if input missing', async () => {
      const res = await request(app).post('/api/bots/1/flows/1/test').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/bots/999/flows/1/test').send({ input: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/bots/1/flows/999/test').send({ input: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/bots/1/flows/1/test').send({ input: 'Hello' });
      expect(res.status).toBe(500);
    });
  });
});
