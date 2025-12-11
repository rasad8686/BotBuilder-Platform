/**
 * Orchestrations API Tests
 * Tests for /api/orchestrations endpoints: multi-agent orchestration, pipelines
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

// Specific routes MUST come before parameterized routes
app.get('/api/orchestrations/types', mockAuth, async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'sequential', name: 'Sequential', description: 'Execute agents one after another' },
      { id: 'parallel', name: 'Parallel', description: 'Execute agents simultaneously' },
      { id: 'conditional', name: 'Conditional', description: 'Execute agents based on conditions' },
      { id: 'router', name: 'Router', description: 'Route to different agents based on input' }
    ]
  });
});

app.get('/api/orchestrations/executions/:executionId', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT oe.*, o.name as orchestration_name FROM orchestration_executions oe
       JOIN orchestrations o ON oe.orchestration_id = o.id
       WHERE oe.id = $1 AND o.organization_id = $2`,
      [req.params.executionId, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Execution not found' });

    // Get step results
    const stepsResult = await db.query(
      'SELECT * FROM orchestration_execution_steps WHERE execution_id = $1 ORDER BY step_number',
      [req.params.executionId]
    );

    res.json({ success: true, data: { ...result.rows[0], steps: stepsResult.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/orchestrations', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM orchestrations WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/orchestrations/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM orchestrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Orchestration not found' });

    // Get associated agents
    const agentsResult = await db.query(
      'SELECT a.* FROM agents a JOIN orchestration_agents oa ON a.id = oa.agent_id WHERE oa.orchestration_id = $1 ORDER BY oa.order_index',
      [req.params.id]
    );
    res.json({ success: true, data: { ...result.rows[0], agents: agentsResult.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/orchestrations', mockAuth, async (req, res) => {
  try {
    const { name, description, type, config, agents } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ success: false, message: 'Orchestration name is required' });

    const validTypes = ['sequential', 'parallel', 'conditional', 'router'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Valid: ${validTypes.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO orchestrations (organization_id, name, description, type, config, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6) RETURNING *`,
      [req.organization.id, name, description || '', type || 'sequential', JSON.stringify(config || {}), req.user.id]
    );

    // Add agents if provided
    if (agents && agents.length > 0) {
      for (let i = 0; i < agents.length; i++) {
        await db.query(
          'INSERT INTO orchestration_agents (orchestration_id, agent_id, order_index) VALUES ($1, $2, $3)',
          [result.rows[0].id, agents[i], i]
        );
      }
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/orchestrations/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, type, config, is_active, agents } = req.body;

    const existing = await db.query(
      'SELECT * FROM orchestrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Orchestration not found' });

    const result = await db.query(
      `UPDATE orchestrations SET name = COALESCE($1, name), description = COALESCE($2, description),
       type = COALESCE($3, type), config = COALESCE($4, config), is_active = COALESCE($5, is_active),
       updated_at = NOW() WHERE id = $6 RETURNING *`,
      [name, description, type, config ? JSON.stringify(config) : null, is_active, req.params.id]
    );

    // Update agents if provided
    if (agents) {
      await db.query('DELETE FROM orchestration_agents WHERE orchestration_id = $1', [req.params.id]);
      for (let i = 0; i < agents.length; i++) {
        await db.query(
          'INSERT INTO orchestration_agents (orchestration_id, agent_id, order_index) VALUES ($1, $2, $3)',
          [req.params.id, agents[i], i]
        );
      }
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/orchestrations/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM orchestrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Orchestration not found' });

    await db.query('DELETE FROM orchestration_agents WHERE orchestration_id = $1', [req.params.id]);
    await db.query('DELETE FROM orchestrations WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Orchestration deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/orchestrations/:id/execute', mockAuth, async (req, res) => {
  try {
    const { input, context } = req.body;
    if (!input) return res.status(400).json({ success: false, message: 'Input is required' });

    const orchestrationResult = await db.query(
      'SELECT * FROM orchestrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (orchestrationResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Orchestration not found' });

    const orchestration = orchestrationResult.rows[0];
    if (!orchestration.is_active) {
      return res.status(400).json({ success: false, message: 'Orchestration is not active' });
    }

    // Create execution record
    const executionResult = await db.query(
      `INSERT INTO orchestration_executions (orchestration_id, input, context, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW()) RETURNING *`,
      [req.params.id, JSON.stringify(input), JSON.stringify(context || {})]
    );

    res.json({
      success: true,
      data: {
        execution_id: executionResult.rows[0].id,
        orchestration_id: orchestration.id,
        status: 'running'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/orchestrations/:id/executions', mockAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const orchestrationResult = await db.query(
      'SELECT * FROM orchestrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (orchestrationResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Orchestration not found' });

    const result = await db.query(
      'SELECT * FROM orchestration_executions WHERE orchestration_id = $1 ORDER BY started_at DESC LIMIT $2 OFFSET $3',
      [req.params.id, parseInt(limit), parseInt(offset)]
    );
    const countResult = await db.query(
      'SELECT COUNT(*) FROM orchestration_executions WHERE orchestration_id = $1',
      [req.params.id]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/orchestrations/:id/duplicate', mockAuth, async (req, res) => {
  try {
    const orchestrationResult = await db.query(
      'SELECT * FROM orchestrations WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (orchestrationResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Orchestration not found' });

    const original = orchestrationResult.rows[0];
    const result = await db.query(
      `INSERT INTO orchestrations (organization_id, name, description, type, config, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING *`,
      [req.organization.id, `${original.name} (Copy)`, original.description, original.type, original.config, req.user.id]
    );

    // Copy agents
    const agentsResult = await db.query(
      'SELECT * FROM orchestration_agents WHERE orchestration_id = $1 ORDER BY order_index',
      [req.params.id]
    );
    for (const agent of agentsResult.rows) {
      await db.query(
        'INSERT INTO orchestration_agents (orchestration_id, agent_id, order_index) VALUES ($1, $2, $3)',
        [result.rows[0].id, agent.agent_id, agent.order_index]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Orchestrations API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/orchestrations', () => {
    it('should return orchestrations', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Pipeline 1' }] });
      const res = await request(app).get('/api/orchestrations');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/orchestrations');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/orchestrations/:id', () => {
    it('should return orchestration with agents', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Pipeline', type: 'sequential' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Agent 1' }, { id: 2, name: 'Agent 2' }] });
      const res = await request(app).get('/api/orchestrations/1');
      expect(res.status).toBe(200);
      expect(res.body.data.agents).toHaveLength(2);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/orchestrations/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/orchestrations/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/orchestrations', () => {
    it('should create orchestration', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Pipeline' }] });
      const res = await request(app).post('/api/orchestrations').send({ name: 'New Pipeline', type: 'sequential' });
      expect(res.status).toBe(201);
    });

    it('should create with agents', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Pipeline' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/orchestrations').send({ name: 'Pipeline', agents: [1, 2] });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/orchestrations').send({});
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app).post('/api/orchestrations').send({ name: 'Pipeline', type: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/orchestrations').send({ name: 'Pipeline' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/orchestrations/:id', () => {
    it('should update orchestration', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });
      const res = await request(app).put('/api/orchestrations/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('should update agents', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/orchestrations/1').send({ agents: [1, 2] });
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/orchestrations/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/orchestrations/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/orchestrations/:id', () => {
    it('should delete orchestration', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 2 })
        .mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/orchestrations/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/orchestrations/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/orchestrations/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/orchestrations/:id/execute', () => {
    it('should execute orchestration', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 10 }] });
      const res = await request(app).post('/api/orchestrations/1/execute').send({ input: { query: 'test' } });
      expect(res.status).toBe(200);
      expect(res.body.data.execution_id).toBeDefined();
    });

    it('should return 400 if input missing', async () => {
      const res = await request(app).post('/api/orchestrations/1/execute').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/orchestrations/999/execute').send({ input: {} });
      expect(res.status).toBe(404);
    });

    it('should return 400 if not active', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });
      const res = await request(app).post('/api/orchestrations/1/execute').send({ input: {} });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/orchestrations/1/execute').send({ input: {} });
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/orchestrations/:id/executions', () => {
    it('should return executions with pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });
      const res = await request(app).get('/api/orchestrations/1/executions');
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });

    it('should return 404 if orchestration not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/orchestrations/999/executions');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/orchestrations/1/executions');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/orchestrations/executions/:executionId', () => {
    it('should return execution with steps', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rows: [{ step_number: 1 }, { step_number: 2 }] });
      const res = await request(app).get('/api/orchestrations/executions/1');
      expect(res.status).toBe(200);
      expect(res.body.data.steps).toHaveLength(2);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/orchestrations/executions/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/orchestrations/executions/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/orchestrations/:id/duplicate', () => {
    it('should duplicate orchestration', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Original', description: '', type: 'sequential', config: '{}' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Original (Copy)' }] })
        .mockResolvedValueOnce({ rows: [{ agent_id: 1, order_index: 0 }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/orchestrations/1/duplicate');
      expect(res.status).toBe(201);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/orchestrations/999/duplicate');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/orchestrations/1/duplicate');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/orchestrations/types', () => {
    it('should return orchestration types', async () => {
      const res = await request(app).get('/api/orchestrations/types');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);
    });
  });
});
