/**
 * Entities API Tests
 * Tests for /api/entities endpoints: CRUD, values
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

app.get('/api/entities', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    const result = await db.query('SELECT * FROM entities WHERE bot_id = $1 ORDER BY name', [bot_id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/entities/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM entities WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Entity not found' });
    const valuesResult = await db.query('SELECT * FROM entity_values WHERE entity_id = $1', [req.params.id]);
    res.json({ success: true, data: { ...result.rows[0], values: valuesResult.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/entities', mockAuth, async (req, res) => {
  try {
    const { bot_id, name, type, values } = req.body;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    if (!name || name.trim() === '') return res.status(400).json({ success: false, message: 'Entity name is required' });

    const validTypes = ['list', 'regex', 'pattern', 'custom'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Valid types: ${validTypes.join(', ')}` });
    }

    const result = await db.query(
      'INSERT INTO entities (bot_id, name, type) VALUES ($1, $2, $3) RETURNING *',
      [bot_id, name, type || 'list']
    );
    const entityId = result.rows[0].id;

    if (values && Array.isArray(values)) {
      for (const value of values) {
        const val = typeof value === 'string' ? value : value.value;
        const synonyms = typeof value === 'object' ? value.synonyms : null;
        await db.query('INSERT INTO entity_values (entity_id, value, synonyms) VALUES ($1, $2, $3)',
          [entityId, val, synonyms ? JSON.stringify(synonyms) : null]);
      }
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/entities/:id', mockAuth, async (req, res) => {
  try {
    const { name, type } = req.body;
    const existing = await db.query('SELECT * FROM entities WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Entity not found' });

    const result = await db.query(
      'UPDATE entities SET name = COALESCE($1, name), type = COALESCE($2, type), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, type, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/entities/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM entities WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Entity not found' });
    await db.query('DELETE FROM entities WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Entity deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/entities/:id/values', mockAuth, async (req, res) => {
  try {
    const { value, synonyms } = req.body;
    if (!value || value.trim() === '') return res.status(400).json({ success: false, message: 'Value is required' });

    const entityResult = await db.query('SELECT * FROM entities WHERE id = $1', [req.params.id]);
    if (entityResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Entity not found' });

    const result = await db.query(
      'INSERT INTO entity_values (entity_id, value, synonyms) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, value, synonyms ? JSON.stringify(synonyms) : null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/entities/:id/values/:valueId', mockAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM entity_values WHERE id = $1 AND entity_id = $2', [req.params.valueId, req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Value not found' });
    await db.query('DELETE FROM entity_values WHERE id = $1', [req.params.valueId]);
    res.json({ success: true, message: 'Value deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Entities API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/entities', () => {
    it('should return entities for bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'city', type: 'list' }] });
      const res = await request(app).get('/api/entities?bot_id=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).get('/api/entities');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/entities?bot_id=1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/entities/:id', () => {
    it('should return entity with values', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'city' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, value: 'New York' }] });
      const res = await request(app).get('/api/entities/1');
      expect(res.status).toBe(200);
      expect(res.body.data.values).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/entities/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/entities/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/entities', () => {
    it('should create entity', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'city' }] });
      const res = await request(app).post('/api/entities').send({ bot_id: 1, name: 'city' });
      expect(res.status).toBe(201);
    });

    it('should create entity with values', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, name: 'city' }] });
      const res = await request(app).post('/api/entities').send({ bot_id: 1, name: 'city', values: ['New York', 'London'] });
      expect(res.status).toBe(201);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).post('/api/entities').send({ name: 'city' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/entities').send({ bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid type', async () => {
      const res = await request(app).post('/api/entities').send({ bot_id: 1, name: 'city', type: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/entities').send({ bot_id: 1, name: 'city' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/entities/:id', () => {
    it('should update entity', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'updated' }] });
      const res = await request(app).put('/api/entities/1').send({ name: 'updated' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/entities/999').send({ name: 'updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/entities/1').send({ name: 'updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/entities/:id', () => {
    it('should delete entity', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/entities/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/entities/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/entities/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/entities/:id/values', () => {
    it('should add value', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, value: 'New York' }] });
      const res = await request(app).post('/api/entities/1/values').send({ value: 'New York' });
      expect(res.status).toBe(201);
    });

    it('should add value with synonyms', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, value: 'NYC', synonyms: ['New York City'] }] });
      const res = await request(app).post('/api/entities/1/values').send({ value: 'NYC', synonyms: ['New York City'] });
      expect(res.status).toBe(201);
    });

    it('should return 400 if value missing', async () => {
      const res = await request(app).post('/api/entities/1/values').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if entity not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/entities/999/values').send({ value: 'Test' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/entities/1/values').send({ value: 'Test' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/entities/:id/values/:valueId', () => {
    it('should delete value', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/entities/1/values/5');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/entities/1/values/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/entities/1/values/5');
      expect(res.status).toBe(500);
    });
  });
});
