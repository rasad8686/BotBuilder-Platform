/**
 * Feedback API Tests
 * Tests for /api/feedback endpoints: CRUD, analytics
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

app.get('/api/feedback', mockAuth, async (req, res) => {
  try {
    const { bot_id, rating, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let query = `SELECT f.*, b.name as bot_name FROM feedback f JOIN bots b ON f.bot_id = b.id WHERE b.organization_id = $1`;
    const params = [req.organization.id];
    let paramIndex = 2;
    if (bot_id) { query += ` AND f.bot_id = $${paramIndex++}`; params.push(bot_id); }
    if (rating) { query += ` AND f.rating = $${paramIndex++}`; params.push(rating); }
    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM feedback f JOIN bots b ON f.bot_id = b.id WHERE b.organization_id = $1',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: parseInt(countResult.rows[0].count) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/feedback/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.*, b.name as bot_name FROM feedback f JOIN bots b ON f.bot_id = b.id
       WHERE f.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Feedback not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { bot_id, message_id, rating, comment, user_identifier } = req.body;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });

    const result = await db.query(
      `INSERT INTO feedback (bot_id, message_id, rating, comment, user_identifier)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bot_id, message_id || null, rating, comment || '', user_identifier || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/feedback/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.id FROM feedback f JOIN bots b ON f.bot_id = b.id WHERE f.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Feedback not found' });
    await db.query('DELETE FROM feedback WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/feedback/analytics/summary', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;
    let query = `SELECT COUNT(*) as total, AVG(rating) as avg_rating,
                 SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as positive,
                 SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END) as negative
                 FROM feedback f JOIN bots b ON f.bot_id = b.id WHERE b.organization_id = $1`;
    const params = [req.organization.id];
    if (bot_id) { query += ' AND f.bot_id = $2'; params.push(bot_id); }

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/feedback/analytics/distribution', mockAuth, async (req, res) => {
  try {
    const { bot_id } = req.query;
    let query = `SELECT rating, COUNT(*) as count FROM feedback f JOIN bots b ON f.bot_id = b.id
                 WHERE b.organization_id = $1`;
    const params = [req.organization.id];
    if (bot_id) { query += ' AND f.bot_id = $2'; params.push(bot_id); }
    query += ' GROUP BY rating ORDER BY rating';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/feedback/analytics/trend', mockAuth, async (req, res) => {
  try {
    const { bot_id, days = 30 } = req.query;
    let query = `SELECT DATE(created_at) as date, AVG(rating) as avg_rating, COUNT(*) as count
                 FROM feedback f JOIN bots b ON f.bot_id = b.id
                 WHERE b.organization_id = $1 AND f.created_at > NOW() - INTERVAL '${days} days'`;
    const params = [req.organization.id];
    if (bot_id) { query += ' AND f.bot_id = $2'; params.push(bot_id); }
    query += ' GROUP BY DATE(created_at) ORDER BY date';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Feedback API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/feedback', () => {
    it('should return feedback with pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rating: 5 }] }).mockResolvedValueOnce({ rows: [{ count: '100' }] });
      const res = await request(app).get('/api/feedback');
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/feedback?bot_id=5');
      expect(res.status).toBe(200);
    });

    it('should filter by rating', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/feedback?rating=5');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/feedback');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/feedback/:id', () => {
    it('should return feedback by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rating: 5, comment: 'Great!' }] });
      const res = await request(app).get('/api/feedback/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/feedback/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/feedback/1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/feedback', () => {
    it('should create feedback', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rating: 5 }] });
      const res = await request(app).post('/api/feedback').send({ bot_id: 1, rating: 5, comment: 'Great!' });
      expect(res.status).toBe(201);
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).post('/api/feedback').send({ rating: 5 });
      expect(res.status).toBe(400);
    });

    it('should return 400 if rating invalid', async () => {
      const res = await request(app).post('/api/feedback').send({ bot_id: 1, rating: 6 });
      expect(res.status).toBe(400);
    });

    it('should return 400 if rating missing', async () => {
      const res = await request(app).post('/api/feedback').send({ bot_id: 1 });
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).post('/api/feedback').send({ bot_id: 1, rating: 5 });
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/feedback/:id', () => {
    it('should delete feedback', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/feedback/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/feedback/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/feedback/1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/feedback/analytics/summary', () => {
    it('should return analytics summary', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '100', avg_rating: '4.2', positive: '80', negative: '10' }] });
      const res = await request(app).get('/api/feedback/analytics/summary');
      expect(res.status).toBe(200);
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ total: '50', avg_rating: '4.5' }] });
      const res = await request(app).get('/api/feedback/analytics/summary?bot_id=5');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/feedback/analytics/summary');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/feedback/analytics/distribution', () => {
    it('should return rating distribution', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ rating: 5, count: '50' }, { rating: 4, count: '30' }] });
      const res = await request(app).get('/api/feedback/analytics/distribution');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/feedback/analytics/distribution');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/feedback/analytics/trend', () => {
    it('should return rating trend', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ date: '2024-01-01', avg_rating: '4.5', count: '10' }] });
      const res = await request(app).get('/api/feedback/analytics/trend');
      expect(res.status).toBe(200);
    });

    it('should accept days parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/feedback/analytics/trend?days=7');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/feedback/analytics/trend');
      expect(res.status).toBe(500);
    });
  });
});
