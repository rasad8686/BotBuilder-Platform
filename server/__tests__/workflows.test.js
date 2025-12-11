/**
 * Workflows API Tests
 * Tests for /api/workflows endpoints: CRUD, execute
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

app.get('/api/workflows', mockAuth, async (req, res) => {
  try {
    const { agent_id } = req.query;
    let query = 'SELECT * FROM agent_workflows WHERE organization_id = $1';
    const params = [req.organization.id];
    if (agent_id) { query += ' AND agent_id = $2'; params.push(agent_id); }
    query += ' ORDER BY created_at DESC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/workflows/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM agent_workflows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Workflow not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/workflows', mockAuth, async (req, res) => {
  try {
    const { agent_id, name, description, steps, trigger_type } = req.body;
    if (!agent_id) return res.status(400).json({ success: false, message: 'Agent ID is required' });
    if (!name || name.trim() === '') return res.status(400).json({ success: false, message: 'Workflow name is required' });

    const result = await db.query(
      `INSERT INTO agent_workflows (organization_id, agent_id, name, description, steps, trigger_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [req.organization.id, agent_id, name, description || '', JSON.stringify(steps || []), trigger_type || 'manual']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/workflows/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, steps, trigger_type, is_active } = req.body;
    const existing = await db.query('SELECT * FROM agent_workflows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const result = await db.query(
      `UPDATE agent_workflows SET name = COALESCE($1, name), description = COALESCE($2, description),
       steps = COALESCE($3, steps), trigger_type = COALESCE($4, trigger_type), is_active = COALESCE($5, is_active),
       updated_at = NOW() WHERE id = $6 RETURNING *`,
      [name, description, steps ? JSON.stringify(steps) : null, trigger_type, is_active, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/workflows/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM agent_workflows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Workflow not found' });
    await db.query('DELETE FROM agent_workflows WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Workflow deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/workflows/:id/execute', mockAuth, async (req, res) => {
  try {
    const { input } = req.body;
    const workflowResult = await db.query('SELECT * FROM agent_workflows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (workflowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Workflow not found' });

    const workflow = workflowResult.rows[0];
    if (!workflow.is_active) return res.status(400).json({ success: false, message: 'Workflow is not active' });

    // Create execution record
    const executionResult = await db.query(
      `INSERT INTO workflow_executions (workflow_id, input, status, started_at)
       VALUES ($1, $2, 'running', NOW()) RETURNING *`,
      [req.params.id, JSON.stringify(input || {})]
    );

    res.json({
      success: true,
      data: {
        execution_id: executionResult.rows[0].id,
        workflow_id: workflow.id,
        status: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Workflows API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/workflows', () => {
    it('should return workflows', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Workflow 1' }] });
      const res = await request(app).get('/api/workflows');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by agent_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/workflows?agent_id=5');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/workflows');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/workflows/:id', () => {
    it('should return workflow by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Workflow' }] });
      const res = await request(app).get('/api/workflows/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/workflows/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/workflows/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/workflows', () => {
    it('should create workflow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Workflow' }] });
      const res = await request(app).post('/api/workflows').send({ agent_id: 1, name: 'New Workflow' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if agent_id missing', async () => {
      const res = await request(app).post('/api/workflows').send({ name: 'Workflow' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/workflows').send({ agent_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/workflows').send({ agent_id: 1, name: 'Workflow' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('should update workflow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });
      const res = await request(app).put('/api/workflows/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/workflows/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/workflows/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('should delete workflow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/workflows/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/workflows/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/workflows/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/workflows/:id/execute', () => {
    it('should execute workflow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 10 }] });
      const res = await request(app).post('/api/workflows/1/execute').send({ input: { query: 'test' } });
      expect(res.status).toBe(200);
      expect(res.body.data.execution_id).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/workflows/999/execute').send({});
      expect(res.status).toBe(404);
    });

    it('should return 400 if workflow not active', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });
      const res = await request(app).post('/api/workflows/1/execute').send({});
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/workflows/1/execute').send({});
      expect(res.status).toBe(500);
    });
  });
});
