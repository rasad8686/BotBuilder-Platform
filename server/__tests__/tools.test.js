/**
 * Tools API Tests
 * Tests for /api/tools endpoints: CRUD, testing, agent assignments
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

// GET all tools
app.get('/api/tools', mockAuth, async (req, res) => {
  try {
    const { type, is_active } = req.query;
    let query = 'SELECT * FROM tools WHERE organization_id = $1';
    const params = [req.organization.id];
    let paramIndex = 2;

    if (type) {
      query += ` AND type = $${paramIndex++}`;
      params.push(type);
    }
    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    query += ' ORDER BY name ASC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET single tool
app.get('/api/tools/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CREATE tool
app.post('/api/tools', mockAuth, async (req, res) => {
  try {
    const { name, description, type, config, parameters } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Tool name is required' });
    }
    if (!type) {
      return res.status(400).json({ success: false, message: 'Tool type is required' });
    }

    const validTypes = ['http', 'function', 'database', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Valid types: ${validTypes.join(', ')}` });
    }

    const result = await db.query(
      `INSERT INTO tools (organization_id, name, description, type, config, parameters, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING *`,
      [req.organization.id, name, description || '', type, JSON.stringify(config || {}), JSON.stringify(parameters || [])]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// UPDATE tool
app.put('/api/tools/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, type, config, parameters, is_active } = req.body;

    const existing = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    const result = await db.query(
      `UPDATE tools SET
       name = COALESCE($1, name),
       description = COALESCE($2, description),
       type = COALESCE($3, type),
       config = COALESCE($4, config),
       parameters = COALESCE($5, parameters),
       is_active = COALESCE($6, is_active),
       updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, description, type, config ? JSON.stringify(config) : null, parameters ? JSON.stringify(parameters) : null, is_active, req.params.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE tool
app.delete('/api/tools/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    await db.query('DELETE FROM tools WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Tool deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// TEST tool
app.post('/api/tools/:id/test', mockAuth, async (req, res) => {
  try {
    const { input } = req.body;

    const toolResult = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    const tool = toolResult.rows[0];

    // Mock tool execution
    res.json({
      success: true,
      data: {
        tool: tool.name,
        type: tool.type,
        input: input || {},
        output: { result: 'Test execution successful' },
        execution_time: 125
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET tool types
app.get('/api/tools/types/list', mockAuth, (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'http', name: 'HTTP API', description: 'Make HTTP requests to external APIs' },
      { id: 'function', name: 'Function', description: 'Execute custom JavaScript functions' },
      { id: 'database', name: 'Database', description: 'Query databases' },
      { id: 'custom', name: 'Custom', description: 'Custom tool implementations' }
    ]
  });
});

// GET agents using tool
app.get('/api/tools/:id/agents', mockAuth, async (req, res) => {
  try {
    const toolResult = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    const result = await db.query(
      `SELECT a.* FROM agents a
       JOIN agent_tools at ON a.id = at.agent_id
       WHERE at.tool_id = $1`,
      [req.params.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ASSIGN tool to agent
app.post('/api/tools/:id/agents/:agentId', mockAuth, async (req, res) => {
  try {
    const toolResult = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    const agentResult = await db.query(
      'SELECT * FROM agents WHERE id = $1 AND organization_id = $2',
      [req.params.agentId, req.organization.id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    await db.query(
      'INSERT INTO agent_tools (agent_id, tool_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.params.agentId, req.params.id]
    );

    res.json({ success: true, message: 'Tool assigned to agent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// REMOVE tool from agent
app.delete('/api/tools/:id/agents/:agentId', mockAuth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM agent_tools WHERE agent_id = $1 AND tool_id = $2',
      [req.params.agentId, req.params.id]
    );

    res.json({ success: true, message: 'Tool removed from agent' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET tool usage analytics
app.get('/api/tools/:id/analytics', mockAuth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const toolResult = await db.query(
      'SELECT * FROM tools WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (toolResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tool not found' });
    }

    const usageResult = await db.query(
      `SELECT DATE(created_at) as date, COUNT(*) as executions, AVG(execution_time) as avg_time
       FROM tool_executions
       WHERE tool_id = $1
       GROUP BY DATE(created_at)
       ORDER BY date DESC LIMIT 30`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        period,
        usage: usageResult.rows,
        total_executions: usageResult.rows.reduce((sum, r) => sum + parseInt(r.executions), 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Tools API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET ALL TOOLS
  // ========================================
  describe('GET /api/tools', () => {
    it('should return all tools', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'HTTP Tool', type: 'http' },
          { id: 2, name: 'DB Tool', type: 'database' }
        ]
      });

      const res = await request(app).get('/api/tools');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by type', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'HTTP Tool', type: 'http' }]
      });

      const res = await request(app).get('/api/tools?type=http');

      expect(res.status).toBe(200);
    });

    it('should filter by is_active', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Active Tool', is_active: true }]
      });

      const res = await request(app).get('/api/tools?is_active=true');

      expect(res.status).toBe(200);
    });

    it('should return empty array if no tools', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/tools');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/tools');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET SINGLE TOOL
  // ========================================
  describe('GET /api/tools/:id', () => {
    it('should return tool by ID', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'HTTP Tool', type: 'http' }]
      });

      const res = await request(app).get('/api/tools/1');

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('HTTP Tool');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/tools/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/tools/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CREATE TOOL
  // ========================================
  describe('POST /api/tools', () => {
    it('should create tool successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'New Tool', type: 'http' }]
      });

      const res = await request(app)
        .post('/api/tools')
        .send({
          name: 'New Tool',
          type: 'http',
          config: { url: 'https://api.example.com' }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/tools')
        .send({ type: 'http' });

      expect(res.status).toBe(400);
    });

    it('should return 400 if type is missing', async () => {
      const res = await request(app)
        .post('/api/tools')
        .send({ name: 'Tool' });

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app)
        .post('/api/tools')
        .send({ name: 'Tool', type: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/tools')
        .send({ name: 'Tool', type: 'http' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // UPDATE TOOL
  // ========================================
  describe('PUT /api/tools/:id', () => {
    it('should update tool successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Tool' }] });

      const res = await request(app)
        .put('/api/tools/1')
        .send({ name: 'Updated Tool' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/tools/999')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/tools/1')
        .send({ name: 'Updated' });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // DELETE TOOL
  // ========================================
  describe('DELETE /api/tools/:id', () => {
    it('should delete tool successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/tools/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/tools/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/tools/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // TEST TOOL
  // ========================================
  describe('POST /api/tools/:id/test', () => {
    it('should test tool successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'HTTP Tool', type: 'http' }]
      });

      const res = await request(app)
        .post('/api/tools/1/test')
        .send({ input: { param: 'value' } });

      expect(res.status).toBe(200);
      expect(res.body.data.output).toBeDefined();
      expect(res.body.data.execution_time).toBeDefined();
    });

    it('should return 404 if tool not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/tools/999/test')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/tools/1/test')
        .send({});

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // TOOL TYPES
  // ========================================
  describe('GET /api/tools/types/list', () => {
    it('should return list of tool types', async () => {
      const res = await request(app).get('/api/tools/types/list');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);
      expect(res.body.data.find(t => t.id === 'http')).toBeDefined();
    });
  });

  // ========================================
  // TOOL AGENTS
  // ========================================
  describe('GET /api/tools/:id/agents', () => {
    it('should return agents using tool', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Agent 1' },
            { id: 2, name: 'Agent 2' }
          ]
        });

      const res = await request(app).get('/api/tools/1/agents');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 if tool not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/tools/999/agents');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/tools/1/agents');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // ASSIGN TOOL TO AGENT
  // ========================================
  describe('POST /api/tools/:id/agents/:agentId', () => {
    it('should assign tool to agent', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Tool exists
        .mockResolvedValueOnce({ rows: [{ id: 5 }] }) // Agent exists
        .mockResolvedValueOnce({ rowCount: 1 }); // Insert

      const res = await request(app).post('/api/tools/1/agents/5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if tool not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/tools/999/agents/5');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Tool');
    });

    it('should return 404 if agent not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/tools/1/agents/999');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Agent');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).post('/api/tools/1/agents/5');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // REMOVE TOOL FROM AGENT
  // ========================================
  describe('DELETE /api/tools/:id/agents/:agentId', () => {
    it('should remove tool from agent', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/tools/1/agents/5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/tools/1/agents/5');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // TOOL ANALYTICS
  // ========================================
  describe('GET /api/tools/:id/analytics', () => {
    it('should return tool analytics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', executions: '50', avg_time: '100' },
            { date: '2024-01-02', executions: '45', avg_time: '95' }
          ]
        });

      const res = await request(app).get('/api/tools/1/analytics');

      expect(res.status).toBe(200);
      expect(res.body.data.usage).toHaveLength(2);
      expect(res.body.data.total_executions).toBe(95);
    });

    it('should return 404 if tool not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/tools/999/analytics');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/tools/1/analytics');

      expect(res.status).toBe(500);
    });
  });
});

// ========================================
// TOOL EDGE CASES
// ========================================
describe('Tool Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Config Validation', () => {
    it('should accept complex config object', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          config: JSON.stringify({
            url: 'https://api.example.com',
            headers: { 'Authorization': 'Bearer token' },
            method: 'POST'
          })
        }]
      });

      const res = await request(app)
        .post('/api/tools')
        .send({
          name: 'Tool',
          type: 'http',
          config: {
            url: 'https://api.example.com',
            headers: { 'Authorization': 'Bearer token' },
            method: 'POST'
          }
        });

      expect(res.status).toBe(201);
    });

    it('should accept parameters array', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          parameters: JSON.stringify([
            { name: 'query', type: 'string', required: true },
            { name: 'limit', type: 'number', required: false }
          ])
        }]
      });

      const res = await request(app)
        .post('/api/tools')
        .send({
          name: 'Tool',
          type: 'http',
          parameters: [
            { name: 'query', type: 'string', required: true },
            { name: 'limit', type: 'number', required: false }
          ]
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Name Validation', () => {
    it('should reject whitespace-only name', async () => {
      const res = await request(app)
        .post('/api/tools')
        .send({ name: '   ', type: 'http' });

      expect(res.status).toBe(400);
    });

    it('should accept unicode name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Инструмент' }]
      });

      const res = await request(app)
        .post('/api/tools')
        .send({ name: 'Инструмент', type: 'http' });

      expect(res.status).toBe(201);
    });
  });

  describe('Type Validation', () => {
    it('should accept all valid types', async () => {
      const types = ['http', 'function', 'database', 'custom'];

      for (const type of types) {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1, type }] });

        const res = await request(app)
          .post('/api/tools')
          .send({ name: 'Tool', type });

        expect(res.status).toBe(201);
      }
    });
  });
});
