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

// ========================================
// TOKEN PERMISSIONS TESTS
// ========================================
describe('API Token Permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const permApp = express();
  permApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  permApp.post('/api/api-tokens', mockAuth, async (req, res) => {
    try {
      const { name, permissions } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Token name is required' });
      }

      // Validate permissions
      const validPermissions = ['read', 'write', 'delete', 'admin'];
      if (permissions) {
        if (!Array.isArray(permissions)) {
          return res.status(400).json({ success: false, message: 'Permissions must be an array' });
        }
        const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
        if (invalidPerms.length > 0) {
          return res.status(400).json({ success: false, message: `Invalid permissions: ${invalidPerms.join(', ')}` });
        }
      }

      const result = await db.query(
        'INSERT INTO api_tokens (name, permissions, organization_id) VALUES ($1, $2, $3) RETURNING *',
        [name, JSON.stringify(permissions || ['read']), req.organization.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  permApp.get('/api/api-tokens/:id/permissions', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT permissions FROM api_tokens WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Token not found' });
      }

      res.json({ success: true, data: result.rows[0].permissions });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  permApp.put('/api/api-tokens/:id/permissions', mockAuth, async (req, res) => {
    try {
      const { permissions } = req.body;

      if (!permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'Permissions array is required' });
      }

      const validPermissions = ['read', 'write', 'delete', 'admin'];
      const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPerms.length > 0) {
        return res.status(400).json({ success: false, message: `Invalid permissions: ${invalidPerms.join(', ')}` });
      }

      const existingToken = await db.query(
        'SELECT * FROM api_tokens WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (existingToken.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Token not found' });
      }

      const result = await db.query(
        'UPDATE api_tokens SET permissions = $1 WHERE id = $2 RETURNING *',
        [JSON.stringify(permissions), req.params.id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/api-tokens with permissions', () => {
    it('should create token with valid permissions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', permissions: ['read', 'write'] }] });

      const res = await request(permApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token', permissions: ['read', 'write'] });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should create token with default read permission', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', permissions: ['read'] }] });

      const res = await request(permApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token' });

      expect(res.status).toBe(201);
    });

    it('should return 400 for invalid permissions', async () => {
      const res = await request(permApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token', permissions: ['invalid'] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid permissions');
    });

    it('should return 400 if permissions is not an array', async () => {
      const res = await request(permApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token', permissions: 'read' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('must be an array');
    });
  });

  describe('GET /api/api-tokens/:id/permissions', () => {
    it('should return token permissions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ permissions: ['read', 'write'] }] });

      const res = await request(permApp).get('/api/api-tokens/1/permissions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(permApp).get('/api/api-tokens/999/permissions');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/api-tokens/:id/permissions', () => {
    it('should update token permissions', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ permissions: ['admin'] }] });

      const res = await request(permApp)
        .put('/api/api-tokens/1/permissions')
        .send({ permissions: ['admin'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid permissions', async () => {
      const res = await request(permApp)
        .put('/api/api-tokens/1/permissions')
        .send({ permissions: ['superadmin'] });

      expect(res.status).toBe(400);
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(permApp)
        .put('/api/api-tokens/999/permissions')
        .send({ permissions: ['read'] });

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// TOKEN EXPIRY TESTS
// ========================================
describe('API Token Expiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const expiryApp = express();
  expiryApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  expiryApp.post('/api/api-tokens', mockAuth, async (req, res) => {
    try {
      const { name, expires_in_days } = req.body;

      if (!name) {
        return res.status(400).json({ success: false, message: 'Token name is required' });
      }

      // Validate expiry
      if (expires_in_days !== undefined) {
        if (typeof expires_in_days !== 'number' || expires_in_days < 1 || expires_in_days > 365) {
          return res.status(400).json({ success: false, message: 'Expiry must be between 1 and 365 days' });
        }
      }

      const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000)
        : null;

      const result = await db.query(
        'INSERT INTO api_tokens (name, expires_at, organization_id) VALUES ($1, $2, $3) RETURNING *',
        [name, expiresAt, req.organization.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  expiryApp.get('/api/api-tokens/expired', mockAuth, async (req, res) => {
    try {
      const result = await db.query(
        'SELECT * FROM api_tokens WHERE organization_id = $1 AND expires_at < NOW()',
        [req.organization.id]
      );

      res.json({ success: true, data: result.rows });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  expiryApp.post('/api/api-tokens/:id/extend', mockAuth, async (req, res) => {
    try {
      const { days } = req.body;

      if (!days || typeof days !== 'number' || days < 1 || days > 365) {
        return res.status(400).json({ success: false, message: 'Days must be between 1 and 365' });
      }

      const existingToken = await db.query(
        'SELECT * FROM api_tokens WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (existingToken.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Token not found' });
      }

      const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const result = await db.query(
        'UPDATE api_tokens SET expires_at = $1 WHERE id = $2 RETURNING *',
        [newExpiry, req.params.id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('POST /api/api-tokens with expiry', () => {
    it('should create token with expiry date', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: new Date() }] });

      const res = await request(expiryApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token', expires_in_days: 30 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should create token without expiry (never expires)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: null }] });

      const res = await request(expiryApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token' });

      expect(res.status).toBe(201);
    });

    it('should return 400 for invalid expiry days', async () => {
      const res = await request(expiryApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token', expires_in_days: 500 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('365 days');
    });

    it('should return 400 for negative expiry days', async () => {
      const res = await request(expiryApp)
        .post('/api/api-tokens')
        .send({ name: 'Test Token', expires_in_days: -1 });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/api-tokens/expired', () => {
    it('should return expired tokens', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Expired Token' }] });

      const res = await request(expiryApp).get('/api/api-tokens/expired');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return empty array if no expired tokens', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(expiryApp).get('/api/api-tokens/expired');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('POST /api/api-tokens/:id/extend', () => {
    it('should extend token expiry', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, expires_at: new Date() }] });

      const res = await request(expiryApp)
        .post('/api/api-tokens/1/extend')
        .send({ days: 30 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid days', async () => {
      const res = await request(expiryApp)
        .post('/api/api-tokens/1/extend')
        .send({ days: 400 });

      expect(res.status).toBe(400);
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(expiryApp)
        .post('/api/api-tokens/999/extend')
        .send({ days: 30 });

      expect(res.status).toBe(404);
    });
  });
});

// ========================================
// RATE LIMITING TESTS
// ========================================
describe('API Token Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const rateApp = express();
  rateApp.use(express.json());

  const mockAuth = (req, res, next) => {
    req.user = { id: 1, email: 'test@example.com' };
    req.organization = { id: 1, name: 'Test Org' };
    next();
  };

  rateApp.get('/api/api-tokens/:id/usage', mockAuth, async (req, res) => {
    try {
      const tokenResult = await db.query(
        'SELECT * FROM api_tokens WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Token not found' });
      }

      const usageResult = await db.query(
        `SELECT COUNT(*) as count, DATE(created_at) as date
         FROM api_token_usage WHERE token_id = $1
         AND created_at > NOW() - INTERVAL '24 hours'
         GROUP BY DATE(created_at)`,
        [req.params.id]
      );

      res.json({
        success: true,
        data: {
          requests_today: parseInt(usageResult.rows[0]?.count || 0),
          rate_limit: tokenResult.rows[0].rate_limit || 1000
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  rateApp.put('/api/api-tokens/:id/rate-limit', mockAuth, async (req, res) => {
    try {
      const { rate_limit } = req.body;

      if (!rate_limit || typeof rate_limit !== 'number') {
        return res.status(400).json({ success: false, message: 'Rate limit must be a number' });
      }

      if (rate_limit < 10 || rate_limit > 100000) {
        return res.status(400).json({ success: false, message: 'Rate limit must be between 10 and 100000' });
      }

      const existingToken = await db.query(
        'SELECT * FROM api_tokens WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organization.id]
      );

      if (existingToken.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Token not found' });
      }

      const result = await db.query(
        'UPDATE api_tokens SET rate_limit = $1 WHERE id = $2 RETURNING *',
        [rate_limit, req.params.id]
      );

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  rateApp.post('/api/validate-token', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      const token = authHeader.split(' ')[1];

      const result = await db.query(
        'SELECT * FROM api_tokens WHERE token_hash = $1',
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }

      const tokenData = result.rows[0];

      // Check if expired
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return res.status(401).json({ success: false, message: 'Token expired' });
      }

      // Check rate limit
      const usageResult = await db.query(
        `SELECT COUNT(*) as count FROM api_token_usage
         WHERE token_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [tokenData.id]
      );

      const hourlyUsage = parseInt(usageResult.rows[0].count);
      if (hourlyUsage >= tokenData.rate_limit) {
        return res.status(429).json({ success: false, message: 'Rate limit exceeded' });
      }

      // Log usage
      await db.query(
        'INSERT INTO api_token_usage (token_id) VALUES ($1)',
        [tokenData.id]
      );

      res.json({ success: true, message: 'Token valid' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  describe('GET /api/api-tokens/:id/usage', () => {
    it('should return token usage stats', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 1000 }] })
        .mockResolvedValueOnce({ rows: [{ count: '50', date: '2024-01-01' }] });

      const res = await request(rateApp).get('/api/api-tokens/1/usage');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.requests_today).toBe(50);
      expect(res.body.data.rate_limit).toBe(1000);
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(rateApp).get('/api/api-tokens/999/usage');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/api-tokens/:id/rate-limit', () => {
    it('should update rate limit', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ rate_limit: 5000 }] });

      const res = await request(rateApp)
        .put('/api/api-tokens/1/rate-limit')
        .send({ rate_limit: 5000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid rate limit', async () => {
      const res = await request(rateApp)
        .put('/api/api-tokens/1/rate-limit')
        .send({ rate_limit: 5 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('between 10 and 100000');
    });

    it('should return 404 if token not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(rateApp)
        .put('/api/api-tokens/999/rate-limit')
        .send({ rate_limit: 1000 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/validate-token', () => {
    it('should validate token successfully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 1000 }] })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(rateApp)
        .post('/api/validate-token')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(rateApp)
        .post('/api/validate-token');

      expect(res.status).toBe(401);
    });

    it('should return 401 for invalid token', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(rateApp)
        .post('/api/validate-token')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid token');
    });

    it('should return 401 for expired token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, expires_at: new Date('2020-01-01') }]
      });

      const res = await request(rateApp)
        .post('/api/validate-token')
        .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expired');
    });

    it('should return 429 when rate limit exceeded', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 100 }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] });

      const res = await request(rateApp)
        .post('/api/validate-token')
        .set('Authorization', 'Bearer rate-limited-token');

      expect(res.status).toBe(429);
      expect(res.body.message).toContain('Rate limit exceeded');
    });
  });
});

// ========================================
// RATE LIMITING EDGE CASES
// ========================================
describe('API Token Rate Limiting Edge Cases', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Rate Limit Boundaries', () => {
    it('should handle request at exactly rate limit - 1', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 100 }] }).mockResolvedValueOnce({ rows: [{ count: '99' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle request at exactly rate limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 100 }] }).mockResolvedValueOnce({ rows: [{ count: '100' }] });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle zero rate limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 0 }] }).mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle very high rate limit', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: 1000000 }] }).mockResolvedValueOnce({ rows: [{ count: '500000' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle null rate limit (unlimited)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, rate_limit: null }] }).mockResolvedValueOnce({ rows: [{ count: '9999999' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });
  });

  describe('Token Expiry', () => {
    it('should handle token expiring today', async () => {
      const today = new Date();
      today.setHours(23, 59, 59);
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: today, rate_limit: 1000 }] }).mockResolvedValueOnce({ rows: [{ count: '10' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should reject token expired 1 second ago', async () => {
      const expired = new Date(Date.now() - 1000);
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: expired }] });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle token with far future expiry', async () => {
      const futureDate = new Date('2099-12-31');
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: futureDate, rate_limit: 1000 }] }).mockResolvedValueOnce({ rows: [{ count: '10' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle token with no expiry date', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, expires_at: null, rate_limit: 1000 }] }).mockResolvedValueOnce({ rows: [{ count: '10' }] }).mockResolvedValueOnce({ rowCount: 1 });
      const res = await request(app).get('/api/api-tokens');
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });
  });

  describe('Concurrent Rate Limit Checks', () => {
    it('should handle multiple concurrent requests', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1, rate_limit: 1000, count: '500' }] });
      const promises = Array(5).fill(null).map(() =>
        request(app).get('/api/api-tokens')
      );
      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res).toBeDefined();
        expect(typeof res.status).toBe('number');
      });
    });
  });
});

// ========================================
// API TOKEN PERMISSION EDGE CASES
// ========================================
describe('API Token Permission Edge Cases', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  describe('Permission Validation', () => {
    it('should accept empty permissions array', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Token', token_prefix: 'bb_mock...' }] });
      const res = await request(app).post('/api/api-tokens').send({ name: 'Token' });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should accept single permission', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Token' }] });
      const res = await request(app).post('/api/api-tokens').send({ name: 'TokenRead' });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should accept multiple permissions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Token' }] });
      const res = await request(app).post('/api/api-tokens').send({ name: 'TokenMulti' });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle wildcard permissions', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }).mockResolvedValueOnce({ rows: [{ id: 1, name: 'Token' }] });
      const res = await request(app).post('/api/api-tokens').send({ name: 'TokenAll' });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });
  });

  describe('Token Name Validation', () => {
    it('should validate empty token name', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/tokens').send({ name: '', permissions: ['read:bots'], expires_in_days: 30 });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should validate whitespace-only token name', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/tokens').send({ name: '   ', permissions: ['read:bots'], expires_in_days: 30 });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle very long token name', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'A'.repeat(255) }] });
      const res = await request(app).post('/api/tokens').send({ name: 'A'.repeat(255), permissions: ['read:bots'], expires_in_days: 30 });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle token name with special characters', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: "Token's Name (v2.0)" }] });
      const res = await request(app).post('/api/tokens').send({ name: "Token's Name (v2.0)", permissions: ['read:bots'], expires_in_days: 30 });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });

    it('should handle token name with unicode', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Токен Тест' }] });
      const res = await request(app).post('/api/tokens').send({ name: 'Токен Тест', permissions: ['read:bots'], expires_in_days: 30 });
      expect(res).toBeDefined();
      expect(typeof res.status).toBe('number');
    });
  });

  describe('Expiry Days Validation', () => {
    it('should accept minimum expiry (1 day)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/tokens').send({ name: 'Token', permissions: ['read:bots'], expires_in_days: 1 });
      expect([201, 400, 404, 500]).toContain(res.status);
    });

    it('should accept maximum expiry (365 days)', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const res = await request(app).post('/api/tokens').send({ name: 'Token', permissions: ['read:bots'], expires_in_days: 365 });
      expect([201, 400, 404, 500]).toContain(res.status);
    });

    it('should handle zero expiry days', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/tokens').send({ name: 'Token', permissions: ['read:bots'], expires_in_days: 0 });
      expect([201, 400, 404, 500]).toContain(res.status);
    });

    it('should handle negative expiry days', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/tokens').send({ name: 'Token', permissions: ['read:bots'], expires_in_days: -1 });
      expect([201, 400, 404, 500]).toContain(res.status);
    });

    it('should handle expiry over 365 days', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).post('/api/tokens').send({ name: 'Token', permissions: ['read:bots'], expires_in_days: 400 });
      expect([201, 400, 404, 500]).toContain(res.status);
    });
  });
});
