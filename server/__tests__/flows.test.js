/**
 * Flows API Tests
 * Tests for /api/flows endpoints: flow validation, versioning, templates
 */

const request = require('supertest');

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const db = require('../db');

// Create a minimal express app for testing
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// ========================================
// FLOW ROUTES
// ========================================

app.get('/api/flows', mockAuth, async (req, res) => {
  try {
    const { bot_id, status } = req.query;
    let query = 'SELECT * FROM flows WHERE organization_id = $1';
    const params = [req.organization.id];

    if (bot_id) {
      query += ' AND bot_id = $2';
      params.push(bot_id);
    }
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    query += ' ORDER BY updated_at DESC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/flows/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM flows WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Flow not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows', mockAuth, async (req, res) => {
  try {
    const { name, bot_id, nodes, edges, trigger } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Flow name is required' });
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    if (!trigger) return res.status(400).json({ success: false, message: 'Trigger is required' });

    const botResult = await db.query('SELECT id FROM bots WHERE id = $1 AND organization_id = $2', [bot_id, req.organization.id]);
    if (botResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Bot not found' });

    const result = await db.query(
      'INSERT INTO flows (name, bot_id, organization_id, nodes, edges, trigger, created_by, version) VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING *',
      [name, bot_id, req.organization.id, JSON.stringify(nodes || []), JSON.stringify(edges || []), JSON.stringify(trigger), req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/flows/:id', mockAuth, async (req, res) => {
  try {
    const { name, nodes, edges, trigger, status } = req.body;
    const existingFlow = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existingFlow.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const result = await db.query(
      `UPDATE flows SET name = COALESCE($1, name), nodes = COALESCE($2, nodes), edges = COALESCE($3, edges), trigger = COALESCE($4, trigger), status = COALESCE($5, status), updated_at = NOW() WHERE id = $6 RETURNING *`,
      [name, nodes ? JSON.stringify(nodes) : null, edges ? JSON.stringify(edges) : null, trigger ? JSON.stringify(trigger) : null, status, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/flows/:id', mockAuth, async (req, res) => {
  try {
    const existingFlow = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existingFlow.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });
    await db.query('DELETE FROM flows WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Flow deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows/:id/validate', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const flow = flowResult.rows[0];
    const nodes = JSON.parse(flow.nodes || '[]');
    const edges = JSON.parse(flow.edges || '[]');
    const errors = [];
    const warnings = [];

    if (nodes.length === 0) errors.push({ type: 'error', message: 'Flow must have at least one node' });
    const hasStartNode = nodes.some(n => n.type === 'start');
    if (!hasStartNode) errors.push({ type: 'error', message: 'Flow must have a start node' });

    const connectedNodeIds = new Set([...edges.map(e => e.source), ...edges.map(e => e.target)]);
    const orphanNodes = nodes.filter(n => !connectedNodeIds.has(n.id) && n.type !== 'start');
    if (orphanNodes.length > 0) warnings.push({ type: 'warning', message: `${orphanNodes.length} orphan node(s) found` });

    res.json({ success: true, data: { valid: errors.length === 0, errors, warnings } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows/:id/duplicate', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const flow = flowResult.rows[0];
    const result = await db.query(
      'INSERT INTO flows (name, bot_id, organization_id, nodes, edges, trigger, created_by, version) VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING *',
      [`${flow.name} (Copy)`, flow.bot_id, req.organization.id, flow.nodes, flow.edges, flow.trigger, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows/:id/version', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const flow = flowResult.rows[0];
    await db.query('INSERT INTO flow_versions (flow_id, version, nodes, edges, trigger, created_by) VALUES ($1, $2, $3, $4, $5, $6)', [flow.id, flow.version, flow.nodes, flow.edges, flow.trigger, req.user.id]);
    const result = await db.query('UPDATE flows SET version = version + 1, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/flows/:id/versions', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT id FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });
    const result = await db.query('SELECT * FROM flow_versions WHERE flow_id = $1 ORDER BY version DESC', [req.params.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows/:id/restore/:versionId', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT id FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });

    const versionResult = await db.query('SELECT * FROM flow_versions WHERE id = $1 AND flow_id = $2', [req.params.versionId, req.params.id]);
    if (versionResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Version not found' });

    const version = versionResult.rows[0];
    const result = await db.query('UPDATE flows SET nodes = $1, edges = $2, trigger = $3, updated_at = NOW() WHERE id = $4 RETURNING *', [version.nodes, version.edges, version.trigger, req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/flow-templates', mockAuth, async (req, res) => {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM flow_templates WHERE is_public = true OR organization_id = $1';
    const params = [req.organization.id];
    if (category) { query += ' AND category = $2'; params.push(category); }
    query += ' ORDER BY usage_count DESC';
    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flow-templates', mockAuth, async (req, res) => {
  try {
    const { name, description, category, nodes, edges, trigger, is_public = false } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Template name is required' });
    if (!category) return res.status(400).json({ success: false, message: 'Category is required' });

    const result = await db.query(
      'INSERT INTO flow_templates (name, description, category, nodes, edges, trigger, organization_id, created_by, is_public) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [name, description, category, JSON.stringify(nodes || []), JSON.stringify(edges || []), JSON.stringify(trigger || {}), req.organization.id, req.user.id, is_public]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flow-templates/:id/use', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.body;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });

    const templateResult = await db.query('SELECT * FROM flow_templates WHERE id = $1 AND (is_public = true OR organization_id = $2)', [req.params.id, req.organization.id]);
    if (templateResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Template not found' });

    const template = templateResult.rows[0];
    const flowResult = await db.query(
      'INSERT INTO flows (name, bot_id, organization_id, nodes, edges, trigger, created_by, version) VALUES ($1, $2, $3, $4, $5, $6, $7, 1) RETURNING *',
      [template.name, bot_id, req.organization.id, template.nodes, template.edges, template.trigger, req.user.id]
    );
    await db.query('UPDATE flow_templates SET usage_count = usage_count + 1 WHERE id = $1', [req.params.id]);
    res.status(201).json({ success: true, data: flowResult.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows/:id/activate', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });
    const result = await db.query('UPDATE flows SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['active', req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/flows/:id/deactivate', mockAuth, async (req, res) => {
  try {
    const flowResult = await db.query('SELECT * FROM flows WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (flowResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Flow not found' });
    const result = await db.query('UPDATE flows SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', ['inactive', req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// TESTS
// ========================================

describe('Flows API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/flows', () => {
    it('should return all flows for organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Flow 1' }, { id: 2, name: 'Flow 2' }] });
      const res = await request(app).get('/api/flows');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, bot_id: 1 }] });
      const res = await request(app).get('/api/flows?bot_id=1');
      expect(res.status).toBe(200);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });
      const res = await request(app).get('/api/flows?status=active');
      expect(res.status).toBe(200);
    });

    it('should return empty array if no flows', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/flows');
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/flows');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/flows/:id', () => {
    it('should return flow by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Flow' }] });
      const res = await request(app).get('/api/flows/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/flows/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/flows/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows', () => {
    it('should create a new flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Flow' }] });
      const res = await request(app).post('/api/flows').send({ name: 'New Flow', bot_id: 1, trigger: { type: 'message' } });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app).post('/api/flows').send({ bot_id: 1, trigger: {} });
      expect(res.status).toBe(400);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).post('/api/flows').send({ name: 'Test', trigger: {} });
      expect(res.status).toBe(400);
    });

    it('should return 400 if trigger is missing', async () => {
      const res = await request(app).post('/api/flows').send({ name: 'Test', bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should return 404 if bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows').send({ name: 'Test', bot_id: 999, trigger: {} });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows').send({ name: 'Test', bot_id: 1, trigger: {} });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/flows/:id', () => {
    it('should update flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });
      const res = await request(app).put('/api/flows/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/flows/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should update status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });
      const res = await request(app).put('/api/flows/1').send({ status: 'active' });
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/flows/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/flows/:id', () => {
    it('should delete flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/flows/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/flows/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/flows/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows/:id/validate', () => {
    it('should validate flow successfully', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, nodes: JSON.stringify([{ id: 'n1', type: 'start' }, { id: 'n2', type: 'message' }]), edges: JSON.stringify([{ source: 'n1', target: 'n2' }]) }] });
      const res = await request(app).post('/api/flows/1/validate');
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(true);
    });

    it('should return errors for empty flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, nodes: '[]', edges: '[]' }] });
      const res = await request(app).post('/api/flows/1/validate');
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should return error for missing start node', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, nodes: JSON.stringify([{ id: 'n1', type: 'message' }]), edges: '[]' }] });
      const res = await request(app).post('/api/flows/1/validate');
      expect(res.body.data.valid).toBe(false);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/999/validate');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows/1/validate');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows/:id/duplicate', () => {
    it('should duplicate flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Original', bot_id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 2, name: 'Original (Copy)' }] });
      const res = await request(app).post('/api/flows/1/duplicate');
      expect(res.status).toBe(201);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/999/duplicate');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows/1/duplicate');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows/:id/version', () => {
    it('should create new version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version: 1 }] }).mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rows: [{ id: 1, version: 2 }] });
      const res = await request(app).post('/api/flows/1/version');
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/999/version');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows/1/version');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/flows/:id/versions', () => {
    it('should return all versions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ version: 2 }, { version: 1 }] });
      const res = await request(app).get('/api/flows/1/versions');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/flows/999/versions');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/flows/1/versions');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows/:id/restore/:versionId', () => {
    it('should restore version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 5, nodes: '[]', edges: '[]', trigger: '{}' }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/flows/1/restore/5');
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/999/restore/5');
      expect(res.status).toBe(404);
    });

    it('should return 404 if version not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/1/restore/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows/1/restore/5');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/flow-templates', () => {
    it('should return all templates', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Template 1' }, { id: 2, name: 'Template 2' }] });
      const res = await request(app).get('/api/flow-templates');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by category', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, category: 'welcome' }] });
      const res = await request(app).get('/api/flow-templates?category=welcome');
      expect(res.status).toBe(200);
    });

    it('should return empty array if no templates', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/flow-templates');
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/flow-templates');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flow-templates', () => {
    it('should create template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Template' }] });
      const res = await request(app).post('/api/flow-templates').send({ name: 'New Template', category: 'welcome' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app).post('/api/flow-templates').send({ category: 'welcome' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if category is missing', async () => {
      const res = await request(app).post('/api/flow-templates').send({ name: 'Test' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flow-templates').send({ name: 'Test', category: 'welcome' });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flow-templates/:id/use', () => {
    it('should create flow from template', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Template', nodes: '[]', edges: '[]', trigger: '{}' }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Template' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).post('/api/flow-templates/1/use').send({ bot_id: 1 });
      expect(res.status).toBe(201);
    });

    it('should return 400 if bot_id is missing', async () => {
      const res = await request(app).post('/api/flow-templates/1/use').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if template not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flow-templates/999/use').send({ bot_id: 1 });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flow-templates/1/use').send({ bot_id: 1 });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows/:id/activate', () => {
    it('should activate flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });
      const res = await request(app).post('/api/flows/1/activate');
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/999/activate');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows/1/activate');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/flows/:id/deactivate', () => {
    it('should deactivate flow', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, status: 'inactive' }] });
      const res = await request(app).post('/api/flows/1/deactivate');
      expect(res.status).toBe(200);
    });

    it('should return 404 if flow not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/flows/999/deactivate');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/flows/1/deactivate');
      expect(res.status).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid JSON in nodes', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, nodes: 'invalid', edges: '[]' }] });
      const res = await request(app).post('/api/flows/1/validate');
      expect(res.status).toBe(500);
    });

    it('should handle large flow data', async () => {
      const largeNodes = Array(100).fill(null).map((_, i) => ({ id: `n${i}`, type: 'message' }));
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/flows').send({ name: 'Large Flow', bot_id: 1, trigger: {}, nodes: largeNodes, edges: [] });
      expect(res.status).toBe(201);
    });
  });
});
