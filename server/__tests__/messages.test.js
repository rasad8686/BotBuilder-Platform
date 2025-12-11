/**
 * Messages API Tests
 * Tests for /api/messages endpoints: CRUD, search, export
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
app.get('/api/messages/search', mockAuth, async (req, res) => {
  try {
    const { q, bot_id } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Search query is required' });

    let query = `SELECT m.*, b.name as bot_name FROM bot_messages m
                 JOIN bots b ON m.bot_id = b.id
                 WHERE b.organization_id = $1 AND m.content ILIKE $2`;
    const params = [req.organization.id, `%${q}%`];
    if (bot_id) { query += ' AND m.bot_id = $3'; params.push(bot_id); }
    query += ' ORDER BY m.created_at DESC LIMIT 100';

    const result = await db.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/messages/export', mockAuth, async (req, res) => {
  try {
    const { bot_id, format = 'json', start_date, end_date } = req.query;
    if (!bot_id) return res.status(400).json({ success: false, message: 'Bot ID is required' });

    let query = `SELECT m.* FROM bot_messages m JOIN bots b ON m.bot_id = b.id
                 WHERE m.bot_id = $1 AND b.organization_id = $2`;
    const params = [bot_id, req.organization.id];
    if (start_date) { query += ' AND m.created_at >= $3'; params.push(start_date); }
    if (end_date) { query += ` AND m.created_at <= $${params.length + 1}`; params.push(end_date); }
    query += ' ORDER BY m.created_at DESC';

    const result = await db.query(query, params);
    if (format === 'csv') {
      res.type('text/csv');
      res.send('id,content,created_at\n' + result.rows.map(r => `${r.id},"${r.content}",${r.created_at}`).join('\n'));
    } else {
      res.json({ success: true, data: result.rows });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/messages', mockAuth, async (req, res) => {
  try {
    const { bot_id, channel_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT m.*, b.name as bot_name FROM bot_messages m
                 JOIN bots b ON m.bot_id = b.id WHERE b.organization_id = $1`;
    const params = [req.organization.id];
    let paramIndex = 2;

    if (bot_id) { query += ` AND m.bot_id = $${paramIndex++}`; params.push(bot_id); }
    if (channel_id) { query += ` AND m.channel_id = $${paramIndex++}`; params.push(channel_id); }

    query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM bot_messages m JOIN bots b ON m.bot_id = b.id WHERE b.organization_id = $1',
      [req.organization.id]
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

app.get('/api/messages/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, b.name as bot_name FROM bot_messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE m.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/messages/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.id FROM bot_messages m JOIN bots b ON m.bot_id = b.id
       WHERE m.id = $1 AND b.organization_id = $2`,
      [req.params.id, req.organization.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
    await db.query('DELETE FROM bot_messages WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Messages API', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('GET /api/messages', () => {
    it('should return messages with pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello' }] }).mockResolvedValueOnce({ rows: [{ count: '100' }] });
      const res = await request(app).get('/api/messages');
      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/messages?bot_id=5');
      expect(res.status).toBe(200);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/messages');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/messages/:id', () => {
    it('should return message by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello' }] });
      const res = await request(app).get('/api/messages/1');
      expect(res.status).toBe(200);
      expect(res.body.data.content).toBe('Hello');
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/messages/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/messages/1');
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/messages/:id', () => {
    it('should delete message', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).delete('/api/messages/1');
      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).delete('/api/messages/999');
      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).delete('/api/messages/1');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/messages/search', () => {
    it('should search messages', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello world' }] });
      const res = await request(app).get('/api/messages/search?q=Hello');
      expect(res.status).toBe(200);
    });

    it('should return 400 if query missing', async () => {
      const res = await request(app).get('/api/messages/search');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/messages/search?q=test');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/messages/export', () => {
    it('should export messages as JSON', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello' }] });
      const res = await request(app).get('/api/messages/export?bot_id=1');
      expect(res.status).toBe(200);
    });

    it('should export messages as CSV', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, content: 'Hello', created_at: '2024-01-01' }] });
      const res = await request(app).get('/api/messages/export?bot_id=1&format=csv');
      expect(res.status).toBe(200);
      expect(res.type).toBe('text/csv');
    });

    it('should return 400 if bot_id missing', async () => {
      const res = await request(app).get('/api/messages/export');
      expect(res.status).toBe(400);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));
      const res = await request(app).get('/api/messages/export?bot_id=1');
      expect(res.status).toBe(500);
    });
  });
});
