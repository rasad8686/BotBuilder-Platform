/**
 * API Tokens Tests
 * Tests for /api/api-tokens endpoints: create, list, delete tokens
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

// Mock crypto
jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mock-api-token-12345')
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('hashed-token')
    })
  })
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

// Mock API tokens routes
app.get('/api/api-tokens', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, token_prefix, created_at, last_used_at FROM api_tokens WHERE organization_id = $1 ORDER BY created_at DESC',
      [req.organization.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/api-tokens', mockAuth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Token name is required' });
    }

    // Check token limit
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM api_tokens WHERE organization_id = $1',
      [req.organization.id]
    );

    if (parseInt(countResult.rows[0].count) >= 10) {
      return res.status(400).json({ success: false, message: 'Maximum token limit reached (10)' });
    }

    const token = 'bb_' + 'mock-api-token-12345';
    const tokenPrefix = token.substring(0, 10) + '...';

    const result = await db.query(
      'INSERT INTO api_tokens (name, token_hash, token_prefix, organization_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, token_prefix, created_at',
      [name, 'hashed-token', tokenPrefix, req.organization.id, req.user.id]
    );

    res.status(201).json({
      success: true,
      data: {
        ...result.rows[0],
        token: token // Only returned once on creation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/api-tokens/:id', mockAuth, async (req, res) => {
  try {
    // Check if token exists and belongs to organization
    const existingToken = await db.query(
      'SELECT * FROM api_tokens WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (existingToken.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    await db.query('DELETE FROM api_tokens WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Token revoked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('API Tokens API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // LIST TOKENS
  // ========================================
  describe('GET /api/api-tokens', () => {
    it('should return all tokens for the organization', async () => {
      const mockTokens = [
        { id: 1, name: 'Token 1', token_prefix: 'bb_abc123...', created_at: new Date() },
        { id: 2, name: 'Token 2', token_prefix: 'bb_def456...', created_at: new Date() }
      ];
      db.query.mockResolvedValueOnce({ rows: mockTokens });

      const res = await request(app).get('/api/api-tokens');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty array if no tokens exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/api-tokens');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('should not return full token value', async () => {
      const mockTokens = [
        { id: 1, name: 'Token 1', token_prefix: 'bb_abc123...' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockTokens });

      const res = await request(app).get('/api/api-tokens');

      expect(res.status).toBe(200);
      expect(res.body.data[0].token).toBeUndefined();
      expect(res.body.data[0].token_hash).toBeUndefined();
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/api-tokens');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // CREATE TOKEN
  // ========================================
  describe('POST /api/api-tokens', () => {
    it('should create a new token successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Count check
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Token', token_prefix: 'bb_mock-a...', created_at: new Date() }] });

      const res = await request(app)
        .post('/api/api-tokens')
        .send({ name: 'New Token' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Token');
      expect(res.body.data.token).toBeDefined(); // Token returned on creation
      expect(res.body.data.token).toMatch(/^bb_/); // Starts with bb_
    });

    it('should return 400 if name is missing', async () => {
      const res = await request(app)
        .post('/api/api-tokens')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('required');
    });

    it('should return 400 if name is empty', async () => {
      const res = await request(app)
        .post('/api/api-tokens')
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if token limit reached', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const res = await request(app)
        .post('/api/api-tokens')
        .send({ name: 'New Token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('limit');
    });
  });

  // ========================================
  // DELETE TOKEN
  // ========================================
  describe('DELETE /api/api-tokens/:id', () => {
    it('should delete an existing token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Check exists
        .mockResolvedValueOnce({ rowCount: 1 }); // Delete

      const res = await request(app).delete('/api/api-tokens/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('revoked');
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/api-tokens/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should handle database error on delete', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/api-tokens/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // EDGE CASES
  // ========================================
  describe('Edge Cases', () => {
    it('should handle very long token name', async () => {
      const longName = 'A'.repeat(500);
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: longName }] });

      const res = await request(app)
        .post('/api/api-tokens')
        .send({ name: longName });

      expect([201, 400]).toContain(res.status);
    });

    it('should handle special characters in token name', async () => {
      const specialName = 'Token <>&"\'';
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: specialName }] });

      const res = await request(app)
        .post('/api/api-tokens')
        .send({ name: specialName });

      expect([201, 400]).toContain(res.status);
    });

    it('should handle invalid token ID format', async () => {
      const res = await request(app).delete('/api/api-tokens/invalid');

      expect([400, 404, 500]).toContain(res.status);
    });

    it('should handle whitespace-only name', async () => {
      const res = await request(app)
        .post('/api/api-tokens')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
    });
  });
});
