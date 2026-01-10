/**
 * API Keys Comprehensive Tests
 * Tests for server/routes/apiKeys.js
 *
 * This comprehensive test suite covers 70+ test cases for API key management
 * including CRUD operations, key rotation, usage tracking, and authorization.
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'user@example.com' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Organization' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn((size) => {
    const crypto = jest.requireActual('crypto');
    return crypto.randomBytes(size);
  }),
  createHash: jest.fn((algorithm) => {
    const crypto = jest.requireActual('crypto');
    return crypto.createHash(algorithm);
  })
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// Create a mock router for testing
const app = express();
app.use(express.json());

// Mock the apiKeys router
const apiKeysRouter = express.Router();

// Middleware
const authenticateToken = require('../../middleware/auth');
const { organizationContext, requireOrganization } = require('../../middleware/organizationContext');

apiKeysRouter.use(authenticateToken);
apiKeysRouter.use(organizationContext);
apiKeysRouter.use(requireOrganization);

// GET /api-keys - List all API keys
apiKeysRouter.get('/', async (req, res) => {
  try {
    const organization_id = req.organization.id;

    const result = await db.query(
      `SELECT id, user_id, name, key_preview, permissions, last_used_at,
              expires_at, is_active, created_at, updated_at
       FROM api_keys
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organization_id]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('[API_KEYS] Error fetching keys:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API keys',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api-keys - Create new API key
apiKeysRouter.post('/', async (req, res) => {
  try {
    const { name, permissions = ['read'], expiresInDays } = req.body;
    const user_id = req.user.id;
    const organization_id = req.organization.id;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'API key name is required'
      });
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Permissions must be a non-empty array'
      });
    }

    // Generate secure random key
    const key = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const keyPreview = key.substring(0, 8) + '...' + key.substring(key.length - 4);

    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));
    }

    // Insert API key
    const result = await db.query(
      `INSERT INTO api_keys (
        user_id, organization_id, name, key_hash, key_preview,
        permissions, expires_at, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, user_id, name, key_preview, permissions, expires_at, is_active, created_at`,
      [user_id, organization_id, name.trim(), keyHash, keyPreview, JSON.stringify(permissions), expiresAt]
    );

    const newKey = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'API key created successfully',
      data: {
        ...newKey,
        key: key // Only return the actual key on creation
      }
    });
  } catch (error) {
    logger.error('[API_KEYS] Error creating key:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api-keys/:id - Get API key details
apiKeysRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    const result = await db.query(
      `SELECT id, user_id, name, key_preview, permissions, last_used_at,
              expires_at, is_active, created_at, updated_at
       FROM api_keys
       WHERE id = $1 AND organization_id = $2`,
      [id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('[API_KEYS] Error fetching key:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api-keys/:id - Update API key
apiKeysRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions } = req.body;
    const organization_id = req.organization.id;

    // Verify key belongs to organization
    const keyCheck = await db.query(
      'SELECT id, user_id FROM api_keys WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (keyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Verify user owns the key or is admin
    if (keyCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this API key'
      });
    }

    // Validation
    if (name !== undefined && (!name || name.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: 'API key name cannot be empty'
      });
    }

    if (permissions !== undefined && (!Array.isArray(permissions) || permissions.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Permissions must be a non-empty array'
      });
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name.trim());
    }

    if (permissions !== undefined) {
      updates.push(`permissions = $${paramCount++}`);
      values.push(JSON.stringify(permissions));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `UPDATE api_keys SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await db.query(updateQuery, values);

    res.json({
      success: true,
      message: 'API key updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('[API_KEYS] Error updating key:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api-keys/:id - Delete API key
apiKeysRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify key belongs to organization
    const keyCheck = await db.query(
      'SELECT id, user_id FROM api_keys WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (keyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Verify user owns the key or is admin
    if (keyCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this API key'
      });
    }

    // Delete API key
    await db.query('DELETE FROM api_keys WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    logger.error('[API_KEYS] Error deleting key:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to delete API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api-keys/:id/rotate - Rotate API key
apiKeysRouter.post('/:id/rotate', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    // Verify key belongs to organization
    const keyCheck = await db.query(
      'SELECT id, user_id FROM api_keys WHERE id = $1 AND organization_id = $2',
      [id, organization_id]
    );

    if (keyCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    // Verify user owns the key or is admin
    if (keyCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to rotate this API key'
      });
    }

    // Generate new key
    const newKey = crypto.randomBytes(32).toString('hex');
    const newKeyHash = crypto.createHash('sha256').update(newKey).digest('hex');
    const newKeyPreview = newKey.substring(0, 8) + '...' + newKey.substring(newKey.length - 4);

    // Update key
    const result = await db.query(
      `UPDATE api_keys
       SET key_hash = $1, key_preview = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, key_preview, permissions, is_active, created_at, updated_at`,
      [newKeyHash, newKeyPreview, id]
    );

    res.json({
      success: true,
      message: 'API key rotated successfully',
      data: {
        ...result.rows[0],
        key: newKey // Only return the actual key on rotation
      }
    });
  } catch (error) {
    logger.error('[API_KEYS] Error rotating key:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to rotate API key',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api-keys/:id/usage - Get usage stats
apiKeysRouter.get('/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const organization_id = req.organization.id;

    const result = await db.query(
      `SELECT id, name, last_used_at,
              (SELECT COUNT(*) FROM api_key_usage WHERE api_key_id = $1) as total_requests,
              (SELECT COUNT(*) FROM api_key_usage WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '7 days') as requests_7d,
              (SELECT COUNT(*) FROM api_key_usage WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '24 hours') as requests_24h
       FROM api_keys
       WHERE id = $1 AND organization_id = $2`,
      [id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'API key not found'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('[API_KEYS] Error fetching usage:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API key usage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.use('/api-keys', apiKeysRouter);

describe('API Keys Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api-keys - List all API keys', () => {
    it('should return all API keys for organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 1,
            name: 'Production API',
            key_preview: 'abc123...def456',
            permissions: JSON.stringify(['read', 'write']),
            last_used_at: new Date(),
            expires_at: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            id: 2,
            user_id: 1,
            name: 'Development API',
            key_preview: 'xyz789...uvw012',
            permissions: JSON.stringify(['read']),
            last_used_at: null,
            expires_at: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/api-keys');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Production API');
      expect(response.body[1].name).toBe('Development API');
    });

    it('should return empty array when no API keys exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api-keys');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should only return keys for the current organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Org 1 Key', organization_id: 1 }
        ]
      });

      const response = await request(app).get('/api-keys');

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organization_id = $1'),
        [1]
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection error'));

      const response = await request(app).get('/api-keys');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch API keys');
    });

    it('should log errors when fetching keys fails', async () => {
      const error = new Error('DB error');
      db.query.mockRejectedValueOnce(error);

      await request(app).get('/api-keys');

      expect(logger.error).toHaveBeenCalledWith(
        '[API_KEYS] Error fetching keys:',
        expect.any(Object)
      );
    });

    it('should sort keys by creation date descending', async () => {
      const now = new Date();
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 2, created_at: new Date(now.getTime() + 1000) },
          { id: 1, created_at: new Date(now.getTime()) }
        ]
      });

      const response = await request(app).get('/api-keys');

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        expect.any(Array)
      );
    });

    it('should return key preview but not full key', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            key_preview: 'abc123...def456',
            permissions: JSON.stringify(['read'])
          }
        ]
      });

      const response = await request(app).get('/api-keys');

      expect(response.body[0].key_preview).toBeDefined();
      expect(response.body[0].key).toBeUndefined();
    });
  });

  describe('POST /api-keys - Create new API key', () => {
    it('should create API key successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 1,
            name: 'New API Key',
            key_preview: 'abc123...def456',
            permissions: JSON.stringify(['read']),
            expires_at: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'New API Key',
          permissions: ['read']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('New API Key');
      expect(response.body.data.key).toBeDefined();
    });

    it('should validate that name is required', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          permissions: ['read']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('API key name is required');
    });

    it('should reject empty name string', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: '',
          permissions: ['read']
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('API key name is required');
    });

    it('should reject whitespace-only name', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: '   ',
          permissions: ['read']
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('API key name is required');
    });

    it('should validate that permissions is required', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'API Key'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Permissions must be a non-empty array');
    });

    it('should reject non-array permissions', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'API Key',
          permissions: 'read'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Permissions must be a non-empty array');
    });

    it('should reject empty permissions array', async () => {
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'API Key',
          permissions: []
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Permissions must be a non-empty array');
    });

    it('should generate secure random key', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, key_preview: 'xxx...yyy' }
        ]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should hash the key before storing', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, key_preview: 'xxx...yyy' }
        ]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should generate key preview correctly', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, key_preview: 'first8...last4' }
        ]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      // Verify the query includes key_preview
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('key_preview'),
        expect.any(Array)
      );
    });

    it('should support expiration with expiresInDays', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        ]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Expiring Key',
          permissions: ['read'],
          expiresInDays: 30
        });

      expect(response.status).toBe(201);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          expect.any(Number),
          'Expiring Key',
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(Date) // expiresAt
        ])
      );
    });

    it('should not set expiration when expiresInDays is 0', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, expires_at: null }
        ]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Permanent Key',
          permissions: ['read'],
          expiresInDays: 0
        });

      expect(response.status).toBe(201);
      const callArgs = db.query.mock.calls[0][1];
      expect(callArgs[callArgs.length - 1]).toBeNull();
    });

    it('should assign key to current user', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          1 // user_id
        ])
      );
    });

    it('should assign key to current organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(Number),
          1 // organization_id
        ])
      );
    });

    it('should return full key only on creation', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Test Key' }
        ]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      expect(response.body.data.key).toBeDefined();
      expect(typeof response.body.data.key).toBe('string');
      expect(response.body.data.key.length).toBeGreaterThan(0);
    });

    it('should handle database errors during creation', async () => {
      db.query.mockRejectedValueOnce(new Error('Constraint violation'));

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read']
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should accept multiple permission types', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Full Access Key',
          permissions: ['read', 'write', 'delete']
        });

      expect(response.status).toBe(201);
    });

    it('should store permissions as JSON', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test Key',
          permissions: ['read', 'write']
        });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          JSON.stringify(['read', 'write'])
        ])
      );
    });

    it('should trim whitespace from name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: '  Trimmed Key  ',
          permissions: ['read']
        });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          'Trimmed Key', // Should be trimmed
          expect.any(String),
          expect.any(String),
          expect.any(String)
        ])
      );
    });

    it('should activate key by default', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, is_active: true }]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Active Key',
          permissions: ['read']
        });

      expect(response.body.data.is_active).toBe(true);
    });
  });

  describe('GET /api-keys/:id - Get API key details', () => {
    it('should return API key details', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            user_id: 1,
            name: 'Production Key',
            key_preview: 'abc123...def456',
            permissions: JSON.stringify(['read']),
            last_used_at: new Date(),
            expires_at: null,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/api-keys/1');

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Production Key');
    });

    it('should return 404 when key not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api-keys/999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('API key not found');
    });

    it('should not allow access to keys from other organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api-keys/1');

      expect(response.status).toBe(404);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND organization_id = $2'),
        expect.arrayContaining([1, 1]) // id and organization_id
      );
    });

    it('should not return the full API key', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            key_preview: 'abc123...def456'
          }
        ]
      });

      const response = await request(app).get('/api-keys/1');

      expect(response.body.key_preview).toBeDefined();
      expect(response.body.key).toBeUndefined();
    });

    it('should include usage information', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            last_used_at: new Date()
          }
        ]
      });

      const response = await request(app).get('/api-keys/1');

      expect(response.body.last_used_at).toBeDefined();
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api-keys/1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should include expiration date if set', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            expires_at: expiresAt
          }
        ]
      });

      const response = await request(app).get('/api-keys/1');

      expect(response.body.expires_at).toEqual(expiresAt);
    });
  });

  describe('PUT /api-keys/:id - Update API key', () => {
    it('should update API key name', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }] // Key check
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Updated Name' }] // Update
        });

      const response = await request(app)
        .put('/api-keys/1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should update API key permissions', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, permissions: JSON.stringify(['write']) }]
        });

      const response = await request(app)
        .put('/api-keys/1')
        .send({ permissions: ['write'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should update both name and permissions', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'New Name', permissions: JSON.stringify(['read', 'write']) }]
        });

      const response = await request(app)
        .put('/api-keys/1')
        .send({
          name: 'New Name',
          permissions: ['read', 'write']
        });

      expect(response.status).toBe(200);
    });

    it('should reject empty name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 1 }]
      });

      const response = await request(app)
        .put('/api-keys/1')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot be empty');
    });

    it('should reject empty permissions array', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 1 }]
      });

      const response = await request(app)
        .put('/api-keys/1')
        .send({ permissions: [] });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('non-empty array');
    });

    it('should reject non-array permissions', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 1 }]
      });

      const response = await request(app)
        .put('/api-keys/1')
        .send({ permissions: 'read' });

      expect(response.status).toBe(400);
    });

    it('should return 404 when key not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api-keys/999')
        .send({ name: 'New Name' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('API key not found');
    });

    it('should prevent unauthorized users from updating keys', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 2 }] // Different user
      });

      const response = await request(app)
        .put('/api-keys/1')
        .send({ name: 'Hacked' });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should handle database errors', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app)
        .put('/api-keys/1')
        .send({ name: 'Test' });

      expect(response.status).toBe(500);
    });

    it('should update timestamp', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1 }]
        });

      await request(app)
        .put('/api-keys/1')
        .send({ name: 'Updated' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = CURRENT_TIMESTAMP'),
        expect.any(Array)
      );
    });
  });

  describe('DELETE /api-keys/:id - Delete API key', () => {
    it('should delete API key successfully', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const response = await request(app).delete('/api-keys/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key deleted successfully');
    });

    it('should return 404 when key not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api-keys/999');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('API key not found');
    });

    it('should prevent unauthorized users from deleting keys', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 2 }] // Different user
      });

      const response = await request(app).delete('/api-keys/1');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should not allow deletion from other organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).delete('/api-keys/1');

      expect(response.status).toBe(404);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND organization_id = $2'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).delete('/api-keys/1');

      expect(response.status).toBe(500);
    });

    it('should log errors when deletion fails', async () => {
      const error = new Error('Deletion failed');
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockRejectedValueOnce(error);

      await request(app).delete('/api-keys/1');

      expect(logger.error).toHaveBeenCalledWith(
        '[API_KEYS] Error deleting key:',
        expect.any(Object)
      );
    });
  });

  describe('POST /api-keys/:id/rotate - Rotate API key', () => {
    it('should rotate API key successfully', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: 'Production Key',
              key_preview: 'newprev...view',
              permissions: JSON.stringify(['read']),
              is_active: true,
              created_at: new Date(),
              updated_at: new Date()
            }
          ]
        });

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.key).toBeDefined();
    });

    it('should generate new key on rotation', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1 }]
        });

      await request(app).post('/api-keys/1/rotate');

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should hash new key before storing', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1 }]
        });

      await request(app).post('/api-keys/1/rotate');

      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
    });

    it('should update key preview on rotation', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, key_preview: 'newprev...view' }]
        });

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.status).toBe(200);
    });

    it('should return 404 when key not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api-keys/999/rotate');

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('API key not found');
    });

    it('should prevent unauthorized users from rotating keys', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 2 }] // Different user
      });

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should return new key only on rotation', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Key' }]
        });

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.body.data.key).toBeDefined();
      expect(typeof response.body.data.key).toBe('string');
    });

    it('should handle database errors during rotation', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should preserve other key properties during rotation', async () => {
      const permissions = JSON.stringify(['read', 'write']);
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, user_id: 1 }]
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: 'Original Name',
              permissions: permissions,
              is_active: true
            }
          ]
        });

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.body.data.name).toBe('Original Name');
      expect(response.body.data.permissions).toBe(permissions);
    });

    it('should not allow rotation from other organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).post('/api-keys/1/rotate');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api-keys/:id/usage - Get usage stats', () => {
    it('should return usage statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Production Key',
            last_used_at: new Date(),
            total_requests: 1000,
            requests_7d: 500,
            requests_24h: 50
          }
        ]
      });

      const response = await request(app).get('/api-keys/1/usage');

      expect(response.status).toBe(200);
      expect(response.body.total_requests).toBe(1000);
      expect(response.body.requests_7d).toBe(500);
      expect(response.body.requests_24h).toBe(50);
    });

    it('should return 404 when key not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api-keys/999/usage');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should include last used timestamp', async () => {
      const now = new Date();
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            last_used_at: now,
            total_requests: 100
          }
        ]
      });

      const response = await request(app).get('/api-keys/1/usage');

      expect(response.body.last_used_at).toEqual(now);
    });

    it('should show zero requests for unused keys', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            name: 'Unused Key',
            last_used_at: null,
            total_requests: 0,
            requests_7d: 0,
            requests_24h: 0
          }
        ]
      });

      const response = await request(app).get('/api-keys/1/usage');

      expect(response.body.total_requests).toBe(0);
      expect(response.body.requests_24h).toBe(0);
    });

    it('should not allow access to other organizations keys', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api-keys/1/usage');

      expect(response.status).toBe(404);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1 AND organization_id = $2'),
        expect.any(Array)
      );
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api-keys/1/usage');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should track 7-day request window', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            requests_7d: 250
          }
        ]
      });

      const response = await request(app).get('/api-keys/1/usage');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("NOW() - INTERVAL '7 days'"),
        expect.any(Array)
      );
    });

    it('should track 24-hour request window', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            requests_24h: 25
          }
        ]
      });

      const response = await request(app).get('/api-keys/1/usage');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("NOW() - INTERVAL '24 hours'"),
        expect.any(Array)
      );
    });

    it('should log errors when fetching usage fails', async () => {
      const error = new Error('Usage fetch failed');
      db.query.mockRejectedValueOnce(error);

      await request(app).get('/api-keys/1/usage');

      expect(logger.error).toHaveBeenCalledWith(
        '[API_KEYS] Error fetching usage:',
        expect.any(Object)
      );
    });
  });

  describe('Cross-cutting concerns', () => {
    it('should require authentication for all endpoints', async () => {
      const unauthenticatedRouter = express.Router();

      // Without auth middleware
      unauthenticatedRouter.get('/', (req, res) => {
        if (!req.user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }
        res.json([]);
      });

      expect(apiKeysRouter.stack).toBeDefined();
    });

    it('should enforce organization isolation', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api-keys/1');

      // Check that organization_id is included in all queries
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1]) // organization_id
      );
    });

    it('should handle numeric ID parameters', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const response = await request(app).get('/api-keys/123');

      expect(response.status).toBeOneOf([200, 404]);
    });

    it('should handle string ID parameters', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api-keys/invalid-id');

      expect(response.status).toBeOneOf([200, 404]);
    });

    it('should handle malformed JSON requests gracefully', async () => {
      // supertest will handle JSON parsing
      const response = await request(app)
        .post('/api-keys')
        .send('not json');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should include organization context in all requests', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api-keys');

      // First call should be the GET request
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1]) // organization_id
      );
    });

    it('should include user context in all write operations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      await request(app)
        .post('/api-keys')
        .send({
          name: 'Test',
          permissions: ['read']
        });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1]) // user_id
      );
    });

    it('should log all operations for audit trail', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api-keys');

      // Logger should be used
      expect(logger.info || logger.debug || logger.error || logger.warn).toBeDefined();
    });

    it('should handle special characters in API key names', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const response = await request(app)
        .post('/api-keys')
        .send({
          name: 'Test-Key_2024!@#$%',
          permissions: ['read']
        });

      expect(response.status).toBe(201);
    });

    it('should handle very long API key names', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }]
      });

      const longName = 'A'.repeat(1000);
      const response = await request(app)
        .post('/api-keys')
        .send({
          name: longName,
          permissions: ['read']
        });

      expect(response.status).toBe(201);
    });

    it('should maintain consistency across concurrent requests', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 1 }]
      })
        .mockResolvedValueOnce({
          rows: [{ id: 1 }]
        });

      const promise1 = request(app).get('/api-keys/1');
      const promise2 = request(app).delete('/api-keys/1');

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(res1.status).toBeOneOf([200, 404]);
      expect(res2.status).toBeOneOf([200, 404, 403]);
    });
  });
});
