/**
 * Intents API Tests
 * Tests for /api/intents endpoints: CRUD, examples
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

app.get('/api/intents', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    const result = await db.query('SELECT * FROM intents WHERE bot_id = $1 ORDER BY name', [bot_id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/intents/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM intents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Intent not found' });
    const examplesResult = await db.query('SELECT * FROM intent_examples WHERE intent_id = $1', [req.params.id]);
    res.json({ success: true, data: { ...result.rows[0], examples: examplesResult.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/intents', mockAuth, async (req, res) => {
  try {
    const { bot_id, name, description, examples } = req.body;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    if (!name || name.trim() === '') return res.status(400).json({ success: false, message: 'Intent name is required' });

    const result = await db.query(
      'INSERT INTO intents (bot_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [bot_id, name, description || '']
    );
    const intentId = result.rows[0].id;

    if (examples && Array.isArray(examples)) {
      for (const example of examples) {
        await db.query('INSERT INTO intent_examples (intent_id, text) VALUES ($1, $2)', [intentId, example]);
      }
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/intents/:id', mockAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const existing = await db.query('SELECT * FROM intents WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Intent not found' });

    const result = await db.query(
      'UPDATE intents SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = NOW() WHERE id = $3 RETURNING *',
      [name, description, req.params.id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/intents/:id', mockAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM intents WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Intent not found' });
    await db.query('DELETE FROM intents WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Intent deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/intents/:id/examples', mockAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === '') return res.status(400).json({ success: false, message: 'Example text is required' });

    const intentResult = await db.query('SELECT * FROM intents WHERE id = $1', [req.params.id]);
    if (intentResult.rows.length === 0) return res.status(404).json({ success: false, message: 'Intent not found' });

    const result = await db.query('INSERT INTO intent_examples (intent_id, text) VALUES ($1, $2) RETURNING *', [req.params.id, text]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/intents/:id/examples/:exampleId', mockAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT * FROM intent_examples WHERE id = $1 AND intent_id = $2', [req.params.exampleId, req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Example not found' });
    await db.query('DELETE FROM intent_examples WHERE id = $1', [req.params.exampleId]);
    res.json({ success: true, message: 'Example deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Intents API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/intents', () => {
    it('should return intents for bot', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting' }] });
      const res = await request(app).get('/api/intents?bot_id=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).get('/api/intents');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/intents?bot_id=1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/intents/:id', () => {
    it('should return intent with examples', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, text: 'Hello' }] });
      const res = await request(app).get('/api/intents/1');
      expect(res.status).toBe(200);
      expect(res.body.data.examples).toBeDefined();
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/intents/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/intents/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/intents', () => {
    it('should create intent', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'greeting' }] });
      const res = await request(app).post('/api/intents').send({ bot_id: 1, name: 'greeting' });
      expect(res.status).toBe(201);
    });

    it('should create intent with examples', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, name: 'greeting' }] });
      const res = await request(app).post('/api/intents').send({ bot_id: 1, name: 'greeting', examples: ['Hello', 'Hi'] });
      expect(res.status).toBe(201);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).post('/api/intents').send({ name: 'greeting' });
      expect(res.status).toBe(400);
    });

    it('should return 400 if name missing', async () => {
      const res = await request(app).post('/api/intents').send({ bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/intents').send({ bot_id: 1, name: 'greeting' });
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/intents/:id', () => {
    it('should update intent', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'updated' }] });
      const res = await request(app).put('/api/intents/1').send({ name: 'updated' });
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).put('/api/intents/999').send({ name: 'updated' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).put('/api/intents/1').send({ name: 'updated' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/intents/:id', () => {
    it('should delete intent', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/intents/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/intents/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/intents/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/intents/:id/examples', () => {
    it('should add example', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 1, text: 'Hello' }] });
      const res = await request(app).post('/api/intents/1/examples').send({ text: 'Hello' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if text missing', async () => {
      const res = await request(app).post('/api/intents/1/examples').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 if intent not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/intents/999/examples').send({ text: 'Hello' });
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/intents/1/examples').send({ text: 'Hello' });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/intents/:id/examples/:exampleId', () => {
    it('should delete example', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 5 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/intents/1/examples/5');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/intents/1/examples/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/intents/1/examples/5');
      expect(res.status).toBe(500);
    });
  });
});
