/**
 * Plugins API Tests
 * Tests for /api/plugins endpoints: plugin install, config, permissions
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
  req.user = { id: 1, email: 'test@example.com', role: 'admin' };
  req.organization = { id: 1, name: 'Test Org', plan_tier: 'pro' };
  next();
};

// ========================================
// PLUGIN ROUTES
// ========================================

app.get('/api/plugins', mockAuth, async (req, res) => {
  try {
    const { category, status } = req.query;
    let query = 'SELECT * FROM plugins WHERE is_public = true OR organization_id = $1';
    const params = [req.organization.id];

    if (category) { query += ` AND category = $${params.length + 1}`; params.push(category); }
    if (status) { query += ` AND status = $${params.length + 1}`; params.push(status); }
    query += ' ORDER BY install_count DESC';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Specific routes MUST come before :id route
app.get('/api/plugins/installed', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, pi.config, pi.installed_at, pi.is_active FROM plugins p
       JOIN plugin_installations pi ON p.id = pi.plugin_id
       WHERE pi.organization_id = $1 ORDER BY pi.installed_at DESC`,
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/plugins/categories', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT DISTINCT category FROM plugins WHERE is_public = true ORDER BY category');
    res.json({ success: true, data: result.rows.map(r => r.category) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/plugins/search', mockAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ success: false, message: 'Search query must be at least 2 characters' });
    const result = await db.query(
      `SELECT * FROM plugins WHERE is_public = true AND (name ILIKE $1 OR description ILIKE $1) ORDER BY install_count DESC LIMIT 20`,
      [`%${q}%`]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// :id route comes after specific routes
app.get('/api/plugins/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM plugins WHERE id = $1 AND (is_public = true OR organization_id = $2)', [req.params.id, req.organization.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/plugins/:id/install', mockAuth, async (req, res) => {
  try {
    const pluginResult = await db.query('SELECT * FROM plugins WHERE id = $1 AND (is_public = true OR organization_id = $2)', [req.params.id, req.organization.id]);
    if (pluginResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not found' });

    const plugin = pluginResult.rows[0];

    // Check plan restrictions
    if (plugin.min_plan && !['pro', 'enterprise'].includes(req.organization.plan_tier)) {
      return res.status(403).json({ success: false, message: 'This plugin requires a Pro or Enterprise plan' });
    }

    // Check if already installed
    const existingInstall = await db.query('SELECT id FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (existingInstall.rows.length > 0) return res.status(400).json({ success: false, message: 'Plugin already installed' });

    const result = await db.query(
      'INSERT INTO plugin_installations (plugin_id, organization_id, installed_by, config, is_active) VALUES ($1, $2, $3, $4, true) RETURNING *',
      [req.params.id, req.organization.id, req.user.id, JSON.stringify(plugin.default_config || {})]
    );

    // Increment install count
    await db.query('UPDATE plugins SET install_count = install_count + 1 WHERE id = $1', [req.params.id]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/plugins/:id/uninstall', mockAuth, async (req, res) => {
  try {
    const installResult = await db.query('SELECT * FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (installResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not installed' });

    await db.query('DELETE FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    await db.query('UPDATE plugins SET install_count = GREATEST(install_count - 1, 0) WHERE id = $1', [req.params.id]);

    res.json({ success: true, message: 'Plugin uninstalled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/plugins/:id/config', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT config FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not installed' });
    res.json({ success: true, data: JSON.parse(result.rows[0].config || '{}') });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/plugins/:id/config', mockAuth, async (req, res) => {
  try {
    const { config } = req.body;
    if (!config || typeof config !== 'object') return res.status(400).json({ success: false, message: 'Config must be an object' });

    const installResult = await db.query('SELECT * FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (installResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not installed' });

    // Validate config against schema
    const pluginResult = await db.query('SELECT config_schema FROM plugins WHERE id = $1', [req.params.id]);
    const schemaRaw = pluginResult.rows[0]?.config_schema;
    if (schemaRaw) {
      const schema = typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw;
      const requiredFields = Object.keys(schema).filter(k => schema[k].required);
      for (const field of requiredFields) {
        if (config[field] === undefined) return res.status(400).json({ success: false, message: `Missing required config field: ${field}` });
      }
    }

    const result = await db.query('UPDATE plugin_installations SET config = $1, updated_at = NOW() WHERE plugin_id = $2 AND organization_id = $3 RETURNING *', [JSON.stringify(config), req.params.id, req.organization.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/plugins/:id/enable', mockAuth, async (req, res) => {
  try {
    const installResult = await db.query('SELECT * FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (installResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not installed' });

    const result = await db.query('UPDATE plugin_installations SET is_active = true, updated_at = NOW() WHERE plugin_id = $1 AND organization_id = $2 RETURNING *', [req.params.id, req.organization.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/plugins/:id/disable', mockAuth, async (req, res) => {
  try {
    const installResult = await db.query('SELECT * FROM plugin_installations WHERE plugin_id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (installResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not installed' });

    const result = await db.query('UPDATE plugin_installations SET is_active = false, updated_at = NOW() WHERE plugin_id = $1 AND organization_id = $2 RETURNING *', [req.params.id, req.organization.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/plugins/:id/permissions', mockAuth, async (req, res) => {
  try {
    const pluginResult = await db.query('SELECT permissions FROM plugins WHERE id = $1', [req.params.id]);
    if (pluginResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not found' });
    res.json({ success: true, data: JSON.parse(pluginResult.rows[0].permissions || '[]') });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Developer routes for creating plugins
app.post('/api/plugins', mockAuth, async (req, res) => {
  try {
    const { name, description, category, version, permissions, config_schema, default_config, is_public = false } = req.body;

    if (!name) return res.status(400).json({ success: false, message: 'Plugin name is required' });
    if (!category) return res.status(400).json({ success: false, message: 'Category is required' });
    if (!version) return res.status(400).json({ success: false, message: 'Version is required' });

    // Validate version format
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(version)) return res.status(400).json({ success: false, message: 'Version must be in format X.Y.Z' });

    const result = await db.query(
      'INSERT INTO plugins (name, description, category, version, permissions, config_schema, default_config, organization_id, created_by, is_public) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [name, description, category, version, JSON.stringify(permissions || []), JSON.stringify(config_schema || {}), JSON.stringify(default_config || {}), req.organization.id, req.user.id, is_public]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/plugins/:id', mockAuth, async (req, res) => {
  try {
    const { name, description, category, version, permissions, config_schema, default_config } = req.body;

    const pluginResult = await db.query('SELECT * FROM plugins WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (pluginResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not found or not owned by you' });

    const result = await db.query(
      `UPDATE plugins SET name = COALESCE($1, name), description = COALESCE($2, description), category = COALESCE($3, category),
       version = COALESCE($4, version), permissions = COALESCE($5, permissions), config_schema = COALESCE($6, config_schema),
       default_config = COALESCE($7, default_config), updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, description, category, version, permissions ? JSON.stringify(permissions) : null, config_schema ? JSON.stringify(config_schema) : null, default_config ? JSON.stringify(default_config) : null, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/plugins/:id', mockAuth, async (req, res) => {
  try {
    const pluginResult = await db.query('SELECT * FROM plugins WHERE id = $1 AND organization_id = $2', [req.params.id, req.organization.id]);
    if (pluginResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Plugin not found or not owned by you' });

    // Check if plugin has installations
    const installCount = await db.query('SELECT COUNT(*) as count FROM plugin_installations WHERE plugin_id = $1', [req.params.id]);
    if (parseInt(installCount.rows[0].count) > 0) return res.status(400).json({ success: false, message: 'Cannot delete plugin with active installations' });

    await db.query('DELETE FROM plugins WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Plugin deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ========================================
// TESTS
// ========================================

describe('Plugins API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/plugins', () => {
    it('should return all available plugins', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Plugin 1' }, { id: 2, name: 'Plugin 2' }] });
      const res = await request(app).get('/api/plugins');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by category', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, category: 'analytics' }] });
      const res = await request(app).get('/api/plugins?category=analytics');
      expect(res.status).toBe(200);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });
      const res = await request(app).get('/api/plugins?status=active');
      expect(res.status).toBe(200);
    });

    it('should return empty array if no plugins', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/plugins');
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/plugins/:id', () => {
    it('should return plugin by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Plugin' }] });
      const res = await request(app).get('/api/plugins/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if plugin not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/plugins/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins/1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/plugins/installed', () => {
    it('should return installed plugins', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Installed Plugin', is_active: true }] });
      const res = await request(app).get('/api/plugins/installed');
      expect(res.status).toBe(200);
    });

    it('should return empty array if no plugins installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/plugins/installed');
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins/installed');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/plugins/:id/install', () => {
    it('should install plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Plugin', default_config: '{}' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1, plugin_id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).post('/api/plugins/1/install');
      expect(res.status).toBe(201);
    });

    it('should return 404 if plugin not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/plugins/999/install');
      expect(res.status).toBe(404);
    });

    it('should return 400 if already installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/plugins/1/install');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already installed');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/plugins/1/install');
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/plugins/:id/uninstall', () => {
    it('should uninstall plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/plugins/1/uninstall');
      expect(res.status).toBe(200);
    });

    it('should return 404 if plugin not installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/plugins/999/uninstall');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/plugins/1/uninstall');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/plugins/:id/config', () => {
    it('should return plugin config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ config: '{"key": "value"}' }] });
      const res = await request(app).get('/api/plugins/1/config');
      expect(res.status).toBe(200);
      expect(res.body.data.key).toBe('value');
    });

    it('should return 404 if plugin not installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/plugins/999/config');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins/1/config');
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/plugins/:id/config', () => {
    it('should update plugin config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ config_schema: null }] }).mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).put('/api/plugins/1/config').send({ config: { key: 'newValue' } });
      expect(res.status).toBe(200);
    });

    it('should return 400 if config is not an object', async () => {
      const res = await request(app).put('/api/plugins/1/config').send({ config: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should return 404 if plugin not installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/plugins/999/config').send({ config: {} });
      expect(res.status).toBe(404);
    });

    it('should validate required config fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ config_schema: JSON.stringify({ apiKey: { required: true } }) }] });
      const res = await request(app).put('/api/plugins/1/config').send({ config: {} });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('apiKey');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/plugins/1/config').send({ config: {} });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/plugins/:id/enable', () => {
    it('should enable plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] });
      const res = await request(app).post('/api/plugins/1/enable');
      expect(res.status).toBe(200);
    });

    it('should return 404 if plugin not installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/plugins/999/enable');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/plugins/1/enable');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/plugins/:id/disable', () => {
    it('should disable plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });
      const res = await request(app).post('/api/plugins/1/disable');
      expect(res.status).toBe(200);
    });

    it('should return 404 if plugin not installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/plugins/999/disable');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/plugins/1/disable');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/plugins/:id/permissions', () => {
    it('should return plugin permissions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ permissions: '["read_messages", "write_messages"]' }] });
      const res = await request(app).get('/api/plugins/1/permissions');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return 404 if plugin not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/plugins/999/permissions');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins/1/permissions');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/plugins/categories', () => {
    it('should return all categories', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ category: 'analytics' }, { category: 'messaging' }] });
      const res = await request(app).get('/api/plugins/categories');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins/categories');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/plugins/search', () => {
    it('should search plugins', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Analytics Plugin' }] });
      const res = await request(app).get('/api/plugins/search?q=analytics');
      expect(res.status).toBe(200);
    });

    it('should return 400 if query is too short', async () => {
      const res = await request(app).get('/api/plugins/search?q=a');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/plugins/search?q=test');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/plugins', () => {
    it('should create a new plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Plugin' }] });
      const res = await request(app).post('/api/plugins').send({ name: 'New Plugin', category: 'analytics', version: '1.0.0' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app).post('/api/plugins').send({ category: 'analytics', version: '1.0.0' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if category is missing', async () => {
      const res = await request(app).post('/api/plugins').send({ name: 'Test', version: '1.0.0' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if version is missing', async () => {
      const res = await request(app).post('/api/plugins').send({ name: 'Test', category: 'analytics' });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid version format', async () => {
      const res = await request(app).post('/api/plugins').send({ name: 'Test', category: 'analytics', version: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/plugins').send({ name: 'Test', category: 'analytics', version: '1.0.0' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/plugins/:id', () => {
    it('should update plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated' }] });
      const res = await request(app).put('/api/plugins/1').send({ name: 'Updated' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if plugin not found or not owned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/plugins/999').send({ name: 'Updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/plugins/1').send({ name: 'Updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/plugins/:id', () => {
    it('should delete plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/plugins/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if plugin not found or not owned', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/plugins/999');
      expect(res.status).toBe(404);
    });

    it('should return 400 if plugin has active installations', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ count: '5' }] });
      const res = await request(app).delete('/api/plugins/1');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('active installations');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/plugins/1');
      expect(res.status).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty permissions array', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ permissions: '[]' }] });
      const res = await request(app).get('/api/plugins/1/permissions');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle null config', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ config: null }] });
      const res = await request(app).get('/api/plugins/1/config');
      expect(res.status).toBe(200);
    });

    it('should handle special characters in search query', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/plugins/search?q=test%20plugin');
      expect(res.status).toBe(200);
    });
  });
});
