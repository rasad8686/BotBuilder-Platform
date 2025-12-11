/**
 * Executions API Tests
 * Tests for /api/executions endpoints: list, get, cancel
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

app.get('/api/executions', mockAuth, async (req, res) => {
  try {
    const { workflow_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = `SELECT we.*, aw.name as workflow_name FROM workflow_executions we
                 JOIN agent_workflows aw ON we.workflow_id = aw.id WHERE aw.organization_id = $1`;
    const params = [req.organization.id];
    let paramIndex = 2;
    if (workflow_id) { query += ` AND we.workflow_id = $${paramIndex++}`; params.push(workflow_id); }
    if (status) { query += ` AND we.status = $${paramIndex++}`; params.push(status); }
    query += ` ORDER BY we.started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM workflow_executions we JOIN agent_workflows aw ON we.workflow_id = aw.id WHERE aw.organization_id = $1',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/executions/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT we.*, aw.name as workflow_name FROM workflow_executions we
       JOIN agent_workflows aw ON we.workflow_id = aw.id
       WHERE we.id = $1 AND aw.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Execution not found' });

    const stepsResult = await db.query('SELECT * FROM agent_execution_steps WHERE execution_id = $1 ORDER BY step_number', [req.params.id]);
    res.json({ success: true, data: { ...result.rows[0], steps: stepsResult.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/executions/:id/cancel', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT we.* FROM workflow_executions we JOIN agent_workflows aw ON we.workflow_id = aw.id
       WHERE we.id = $1 AND aw.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Execution not found' });

    const execution = result.rows[0];
    if (execution.status !== 'running' && execution.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel running or pending executions' });
    }

    await db.query("UPDATE workflow_executions SET status = 'cancelled', completed_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: 'Execution cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/executions/:id/logs', mockAuth, async (req, res) => {
  try {
    const execResult = await db.query(
      `SELECT we.* FROM workflow_executions we JOIN agent_workflows aw ON we.workflow_id = aw.id
       WHERE we.id = $1 AND aw.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (execResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Execution not found' });

    const logsResult = await db.query('SELECT * FROM execution_logs WHERE execution_id = $1 ORDER BY created_at', [req.params.id]);
    res.json({ success: true, data: logsResult.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/executions/:id/retry', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT we.*, aw.steps FROM workflow_executions we JOIN agent_workflows aw ON we.workflow_id = aw.id
       WHERE we.id = $1 AND aw.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Execution not found' });

    const execution = result.rows[0];
    if (execution.status === 'running') {
      return res.status(400).json({ success: false, message: 'Cannot retry a running execution' });
    }

    const newExecution = await db.query(
      `INSERT INTO workflow_executions (workflow_id, input, status, started_at)
       VALUES ($1, $2, 'running', NOW()) RETURNING *`,
      [execution.workflow_id, execution.input]
    );
    res.json({ success: true, data: { execution_id: newExecution.rows[0].id, status: 'running' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Executions API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/executions', () => {
    it('should return executions with pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] }).mockResolvedValueOnce({ rows: [{ count: '50' }] });
      const res = await request(app).get('/api/executions');
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by workflow_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/executions?workflow_id=5');
      expect(res.status).toBe(200);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/executions?status=completed');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/executions');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/executions/:id', () => {
    it('should return execution with steps', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, step_number: 1 }] });
      const res = await request(app).get('/api/executions/1');
      expect(res.status).toBe(200);
      expect(res.body.data.steps).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/executions/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/executions/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/executions/:id/cancel', () => {
    it('should cancel running execution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'running' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).post('/api/executions/1/cancel');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/executions/999/cancel');
      expect(res.status).toBe(404);
    });

    it('should return 400 for completed execution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] });
      const res = await request(app).post('/api/executions/1/cancel');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/executions/1/cancel');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/executions/:id/logs', () => {
    it('should return execution logs', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, message: 'Started' }] });
      const res = await request(app).get('/api/executions/1/logs');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/executions/999/logs');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/executions/1/logs');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/executions/:id/retry', () => {
    it('should retry failed execution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'failed', workflow_id: 5, input: '{}' }] })
        .mockResolvedValueOnce({ rows: [{ id: 10 }] });
      const res = await request(app).post('/api/executions/1/retry');
      expect(res.status).toBe(200);
      expect(res.body.data.execution_id).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/executions/999/retry');
      expect(res.status).toBe(404);
    });

    it('should return 400 for running execution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'running' }] });
      const res = await request(app).post('/api/executions/1/retry');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/executions/1/retry');
      expect(res.status).toBe(500);
    });
  });
});
