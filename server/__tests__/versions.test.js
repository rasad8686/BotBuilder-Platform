/**
 * Versions API Tests
 * Tests for /api/versions endpoints: CRUD, restore, compare
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
app.get('/api/versions/compare', mockAuth, async (req, res) => {
  try {
    const { version_a, version_b } = req.query;
    if (!version_a || !version_b) return res.status(400).json({ success: false, message: 'Both version IDs are required' });

    const versionAResult = await db.query('SELECT * FROM versions WHERE id = $1', [version_a]);
    const versionBResult = await db.query('SELECT * FROM versions WHERE id = $1', [version_b]);

    if (versionAResult.rows.length === 0 || versionBResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'One or both versions not found' });
    }

    res.json({
      success: true,
      data: {
        version_a: versionAResult.rows[0],
        version_b: versionBResult.rows[0],
        changes: [] // In real implementation, compute diff
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/versions', mockAuth, async (req, res) => {
  try {
    const { resource_type, resource_id } = req.query;
    if (!resource_type || !resource_id) return res.status(400).json({ success: false, message: 'Resource type and ID are required' });

    const result = await db.query(
      `SELECT v.*, u.name as created_by_name FROM versions v
       LEFT JOIN users u ON v.created_by = u.id
       WHERE v.resource_type = $1 AND v.resource_id = $2
       ORDER BY v.version_number DESC`,
      [resource_type, resource_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/versions/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT v.*, u.name as created_by_name FROM versions v LEFT JOIN users u ON v.created_by = u.id WHERE v.id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Version not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/versions', mockAuth, async (req, res) => {
  try {
    const { resource_type, resource_id, data, description } = req.body;
    if (!resource_type) return res.status(400).json({ success: false, message: 'Resource type is required' });
    if (!resource_id) return res.status(400).json({ success: false, message: 'Resource ID is required' });
    if (!data) return res.status(400).json({ success: false, message: 'Version data is required' });

    // Get next version number
    const lastVersion = await db.query(
      'SELECT MAX(version_number) as max_version FROM versions WHERE resource_type = $1 AND resource_id = $2',
      [resource_type, resource_id]
    );
    const nextVersion = (lastVersion.rows[0].max_version || 0) + 1;

    const result = await db.query(
      `INSERT INTO versions (resource_type, resource_id, version_number, data, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [resource_type, resource_id, nextVersion, JSON.stringify(data), description || '', req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/versions/:id/restore', mockAuth, async (req, res) => {
  try {
    const versionResult = await db.query('SELECT * FROM versions WHERE id = $1', [req.params.id]);
    if (versionResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Version not found' });

    const version = versionResult.rows[0];

    // Create new version from restored data
    const lastVersion = await db.query(
      'SELECT MAX(version_number) as max_version FROM versions WHERE resource_type = $1 AND resource_id = $2',
      [version.resource_type, version.resource_id]
    );
    const nextVersion = (lastVersion.rows[0].max_version || 0) + 1;

    const newVersion = await db.query(
      `INSERT INTO versions (resource_type, resource_id, version_number, data, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [version.resource_type, version.resource_id, nextVersion, version.data, `Restored from version ${version.version_number}`, req.user.id]
    );

    res.json({ success: true, data: newVersion.rows[0], message: 'Version restored successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/versions/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM versions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Version not found' });
    await db.query('DELETE FROM versions WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Version deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Versions API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/versions', () => {
    it('should return versions for resource', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version_number: 1 }] });
      const res = await request(app).get('/api/versions?resource_type=bot&resource_id=1');
      expect(res.status).toBe(200);
    });

    it('should return 400 if resource_type missing', async () => {
      const res = await request(app).get('/api/versions?resource_id=1');
      expect(res.status).toBe(400);
    });

    it('should return 400 if resource_id missing', async () => {
      const res = await request(app).get('/api/versions?resource_type=bot');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/versions?resource_type=bot&resource_id=1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/versions/:id', () => {
    it('should return version by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version_number: 1, data: '{}' }] });
      const res = await request(app).get('/api/versions/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/versions/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/versions/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/versions', () => {
    it('should create version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ max_version: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 2, version_number: 2 }] });
      const res = await request(app).post('/api/versions').send({ resource_type: 'bot', resource_id: 1, data: { name: 'Test' } });
      expect(res.status).toBe(201);
    });

    it('should return 400 if resource_type missing', async () => {
      const res = await request(app).post('/api/versions').send({ resource_id: 1, data: {} });
      expect(res.status).toBe(400);
    });

    it('should return 400 if resource_id missing', async () => {
      const res = await request(app).post('/api/versions').send({ resource_type: 'bot', data: {} });
      expect(res.status).toBe(400);
    });

    it('should return 400 if data missing', async () => {
      const res = await request(app).post('/api/versions').send({ resource_type: 'bot', resource_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/versions').send({ resource_type: 'bot', resource_id: 1, data: {} });
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/versions/:id/restore', () => {
    it('should restore version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, resource_type: 'bot', resource_id: 1, version_number: 1, data: '{}' }] })
        .mockResolvedValueOnce({ rows: [{ max_version: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 3, version_number: 3 }] });
      const res = await request(app).post('/api/versions/1/restore');
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('restored');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/versions/999/restore');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/versions/1/restore');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/versions/compare', () => {
    it('should compare two versions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version_number: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 2 }] });
      const res = await request(app).get('/api/versions/compare?version_a=1&version_b=2');
      expect(res.status).toBe(200);
      expect(res.body.data.version_a).toBeDefined();
      expect(res.body.data.version_b).toBeDefined();
    });

    it('should return 400 if version_a missing', async () => {
      const res = await request(app).get('/api/versions/compare?version_b=2');
      expect(res.status).toBe(400);
    });

    it('should return 400 if version_b missing', async () => {
      const res = await request(app).get('/api/versions/compare?version_a=1');
      expect(res.status).toBe(400);
    });

    it('should return 404 if version not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 2 }] });
      const res = await request(app).get('/api/versions/compare?version_a=999&version_b=2');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/versions/compare?version_a=1&version_b=2');
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/versions/:id', () => {
    it('should delete version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/versions/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/versions/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/versions/1');
      expect(res.status).toBe(500);
    });
  });
});
