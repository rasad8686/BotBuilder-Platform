/**
 * Bots API Tests - Real Route Coverage
 * Tests for /api/bots endpoints: CRUD operations
 * Uses actual route handlers for code coverage
 */

const request = require('supertest');
const express = require('express');

// ========================================
// MOCKS - Must be defined BEFORE imports
// ========================================

// Mock the database
jest.mock('../db', () => ({
  query: jest.fn(),
  pool: { query: jest.fn() }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn()
}));

// Mock webhook service
jest.mock('../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue(true)
}));

// Mock audit middleware
jest.mock('../middleware/audit', () => ({
  logBotCreated: jest.fn().mockResolvedValue(true),
  logBotUpdated: jest.fn().mockResolvedValue(true),
  logBotDeleted: jest.fn().mockResolvedValue(true)
}));

// Mock authentication middleware
jest.mock('../middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.user = {
      id: 1,
      email: 'test@example.com',
      username: 'testuser',
      current_organization_id: 1,
      organization_id: 1
    };
    next();
  });
});

// Mock organization context middleware
jest.mock('../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = {
      id: 1,
      org_id: 1,
      name: 'Test Organization',
      slug: 'test-org',
      role: 'admin',
      owner_id: 1,
      is_owner: true
    };
    req.hasRole = function(requiredRole) {
      const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.organization.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
      return userRoleLevel >= requiredRoleLevel;
    };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => {
    if (!req.organization || !req.organization.id) {
      return res.status(403).json({
        success: false,
        message: 'Organization context required'
      });
    }
    next();
  })
}));

// Mock checkPermission middleware
jest.mock('../middleware/checkPermission', () => ({
  checkPermission: jest.fn((requiredRole) => {
    return (req, res, next) => {
      if (!req.organization || !req.organization.role) {
        return res.status(403).json({
          success: false,
          message: 'Organization context required'
        });
      }
      const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.organization.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
      if (userRoleLevel < requiredRoleLevel) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. Required role: ${requiredRole}`
        });
      }
      next();
    };
  })
}));

// ========================================
// NOW import the actual routes
// ========================================
const db = require('../db');
const botsRouter = require('../routes/bots');

// Create test app with REAL routes
const app = express();
app.use(express.json());
app.use('/api/bots', botsRouter);

// ========================================
// TEST SUITES
// ========================================

describe('Bots API - Real Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET /api/bots - List all bots
  // ========================================
  describe('GET /api/bots', () => {
    it('should return all bots for organization', async () => {
      const mockBots = [
        { id: 1, name: 'Bot 1', platform: 'telegram', organization_id: 1 },
        { id: 2, name: 'Bot 2', platform: 'whatsapp', organization_id: 1 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockBots });

      const res = await request(app).get('/api/bots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bots).toHaveLength(2);
    });

    it('should return empty array when no bots exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bots).toHaveLength(0);
    });

    it('should return paginated bots when page/limit provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] }); // count query
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Bot 1', platform: 'telegram' }]
      }); // paginated query

      const res = await request(app).get('/api/bots?page=1&limit=5');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.total).toBe(10);
    });

    it('should enforce maximum limit of 100', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '200' }] });
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots?page=1&limit=500');

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const res = await request(app).get('/api/bots');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Failed to retrieve bots');
    });
  });

  // ========================================
  // GET /api/bots/:id - Get single bot
  // ========================================
  describe('GET /api/bots/:id', () => {
    it('should return a specific bot by ID', async () => {
      const mockBot = { id: 1, name: 'Test Bot', platform: 'telegram', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [mockBot] });

      const res = await request(app).get('/api/bots/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bot.id).toBe(1);
      expect(res.body.bot.name).toBe('Test Bot');
    });

    it('should return 404 when bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/bots/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should return 404 for invalid bot ID', async () => {
      const res = await request(app).get('/api/bots/invalid');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should handle database errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/bots/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // POST /api/bots - Create new bot
  // ========================================
  describe('POST /api/bots', () => {
    it('should create a new bot successfully', async () => {
      const newBot = {
        id: 1,
        name: 'New Bot',
        platform: 'telegram',
        description: 'A test bot',
        user_id: 1,
        organization_id: 1,
        created_at: new Date().toISOString()
      };

      // Mock plan query
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      // Mock count query
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Mock insert query
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({
          name: 'New Bot',
          platform: 'telegram',
          description: 'A test bot'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.bot.name).toBe('New Bot');
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({ platform: 'telegram' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('name is required');
    });

    it('should return 400 when platform is missing', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Test Bot' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Platform is required');
    });

    it('should return 400 for invalid platform', async () => {
      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Test Bot', platform: 'invalid_platform' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid platform');
    });

    it('should return 403 when plan limit reached (free plan)', async () => {
      // Mock plan query - free plan
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] });
      // Mock count query - already at limit
      db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'New Bot', platform: 'telegram' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Plan limit reached');
      expect(res.body.limitReached).toBe(true);
      expect(res.body.upgradePlan).toBe('pro');
    });

    it('should return 403 when plan limit reached (pro plan)', async () => {
      // Mock plan query - pro plan
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] });
      // Mock count query - already at limit (10 bots)
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'New Bot', platform: 'telegram' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Plan limit reached');
      expect(res.body.upgradePlan).toBe('enterprise');
    });

    it('should handle duplicate bot name error', async () => {
      // Mock plan query
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      // Mock count query
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Mock insert query - duplicate key error
      const error = new Error('duplicate key');
      error.code = '23505';
      db.query.mockRejectedValueOnce(error);

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Duplicate Bot', platform: 'telegram' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already have a bot with this name');
    });

    it('should handle database errors during creation', async () => {
      // Mock plan query
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      // Mock count query
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      // Mock insert query - general error
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'New Bot', platform: 'telegram' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should accept valid platforms (whatsapp)', async () => {
      const newBot = { id: 1, name: 'WhatsApp Bot', platform: 'whatsapp', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'WhatsApp Bot', platform: 'whatsapp' });

      expect(res.status).toBe(201);
    });

    it('should accept valid platforms (discord)', async () => {
      const newBot = { id: 1, name: 'Discord Bot', platform: 'discord', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Discord Bot', platform: 'discord' });

      expect(res.status).toBe(201);
    });

    it('should accept valid platforms (slack)', async () => {
      const newBot = { id: 1, name: 'Slack Bot', platform: 'slack', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Slack Bot', platform: 'slack' });

      expect(res.status).toBe(201);
    });

    it('should accept valid platforms (messenger)', async () => {
      const newBot = { id: 1, name: 'Messenger Bot', platform: 'messenger', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Messenger Bot', platform: 'messenger' });

      expect(res.status).toBe(201);
    });
  });

  // ========================================
  // PUT /api/bots/:id - Update bot
  // ========================================
  describe('PUT /api/bots/:id', () => {
    it('should update bot name successfully', async () => {
      const existingBot = { id: 1, name: 'Old Name', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      const updatedBot = { ...existingBot, name: 'New Name', updated_at: new Date().toISOString() };

      db.query.mockResolvedValueOnce({ rows: [existingBot] }); // check query
      db.query.mockResolvedValueOnce({ rows: [updatedBot] }); // update query

      const res = await request(app)
        .put('/api/bots/1')
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.bot.name).toBe('New Name');
    });

    it('should update bot description', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: 'Old desc', language: 'en', webhook_url: null, is_active: true };
      const updatedBot = { ...existingBot, description: 'New description' };

      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ description: 'New description' });

      expect(res.status).toBe(200);
      expect(res.body.bot.description).toBe('New description');
    });

    it('should update bot is_active status', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      const updatedBot = { ...existingBot, is_active: false };

      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ is_active: false });

      expect(res.status).toBe(200);
      expect(res.body.bot.is_active).toBe(false);
    });

    it('should update bot platform', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      const updatedBot = { ...existingBot, platform: 'whatsapp' };

      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ platform: 'whatsapp' });

      expect(res.status).toBe(200);
      expect(res.body.bot.platform).toBe('whatsapp');
    });

    it('should return 404 when bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/bots/999')
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid bot ID', async () => {
      const res = await request(app)
        .put('/api/bots/invalid')
        .send({ name: 'New Name' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid bot ID');
    });

    it('should return 400 when no fields provided', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      db.query.mockResolvedValueOnce({ rows: [existingBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('At least one field must be provided');
    });

    it('should return 400 for empty name', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      db.query.mockResolvedValueOnce({ rows: [existingBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot be empty');
    });

    it('should return 400 for invalid platform on update', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      db.query.mockResolvedValueOnce({ rows: [existingBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ platform: 'invalid_platform' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid platform');
    });

    it('should return 400 when is_active is not boolean', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      db.query.mockResolvedValueOnce({ rows: [existingBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ is_active: 'not_boolean' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('is_active must be a boolean');
    });

    it('should handle database errors during update', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/bots/1')
        .send({ name: 'New Name' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should update webhook_url', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      const updatedBot = { ...existingBot, webhook_url: 'https://example.com/webhook' };

      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ webhook_url: 'https://example.com/webhook' });

      expect(res.status).toBe(200);
      expect(res.body.bot.webhook_url).toBe('https://example.com/webhook');
    });

    it('should update language', async () => {
      const existingBot = { id: 1, name: 'Test Bot', platform: 'telegram', description: null, language: 'en', webhook_url: null, is_active: true };
      const updatedBot = { ...existingBot, language: 'az' };

      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({ language: 'az' });

      expect(res.status).toBe(200);
      expect(res.body.bot.language).toBe('az');
    });
  });

  // ========================================
  // DELETE /api/bots/:id - Delete bot
  // ========================================
  describe('DELETE /api/bots/:id', () => {
    it('should delete bot successfully', async () => {
      const existingBot = { name: 'Test Bot', platform: 'telegram', description: 'A test bot' };
      db.query.mockResolvedValueOnce({ rows: [existingBot] }); // check query
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // delete query

      const res = await request(app).delete('/api/bots/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted successfully');
      expect(res.body.deletedId).toBe(1);
    });

    it('should return 404 when bot not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/bots/999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid bot ID', async () => {
      const res = await request(app).delete('/api/bots/invalid');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid bot ID');
    });

    it('should handle database errors during deletion', async () => {
      const existingBot = { name: 'Test Bot', platform: 'telegram', description: 'A test bot' };
      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/bots/1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================================
  // Edge Cases and Additional Tests
  // ========================================
  describe('Edge Cases', () => {
    it('should handle bot with all fields populated', async () => {
      const fullBot = {
        id: 1,
        name: 'Full Bot',
        platform: 'telegram',
        description: 'Full description',
        language: 'en',
        webhook_url: 'https://example.com',
        is_active: true,
        api_token: 'token123',
        user_id: 1,
        organization_id: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.query.mockResolvedValueOnce({ rows: [fullBot] });

      const res = await request(app).get('/api/bots/1');

      expect(res.status).toBe(200);
      expect(res.body.bot).toMatchObject({
        id: 1,
        name: 'Full Bot',
        platform: 'telegram'
      });
    });

    it('should handle multiple field updates at once', async () => {
      const existingBot = { id: 1, name: 'Old', platform: 'telegram', description: 'Old desc', language: 'en', webhook_url: null, is_active: true };
      const updatedBot = {
        ...existingBot,
        name: 'New Name',
        description: 'New desc',
        is_active: false,
        language: 'tr'
      };

      db.query.mockResolvedValueOnce({ rows: [existingBot] });
      db.query.mockResolvedValueOnce({ rows: [updatedBot] });

      const res = await request(app)
        .put('/api/bots/1')
        .send({
          name: 'New Name',
          description: 'New desc',
          is_active: false,
          language: 'tr'
        });

      expect(res.status).toBe(200);
      expect(res.body.bot.name).toBe('New Name');
      expect(res.body.bot.description).toBe('New desc');
      expect(res.body.bot.is_active).toBe(false);
    });

    it('should trim whitespace from bot name on create', async () => {
      const newBot = { id: 1, name: 'Trimmed Bot', platform: 'telegram', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: '  Trimmed Bot  ', platform: 'telegram' });

      expect(res.status).toBe(201);
      // Verify that trimmed name is used in query
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['Trimmed Bot'])
      );
    });

    it('should convert platform to lowercase', async () => {
      const newBot = { id: 1, name: 'Test Bot', platform: 'telegram', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Test Bot', platform: 'TELEGRAM' });

      expect(res.status).toBe(201);
    });

    it('should handle null description on create', async () => {
      const newBot = { id: 1, name: 'No Desc Bot', platform: 'telegram', description: null, organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'No Desc Bot', platform: 'telegram' });

      expect(res.status).toBe(201);
      expect(res.body.bot.description).toBeNull();
    });

    it('should use default language "en" when not provided', async () => {
      const newBot = { id: 1, name: 'Default Lang Bot', platform: 'telegram', language: 'en', organization_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] });
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      db.query.mockResolvedValueOnce({ rows: [newBot] });

      const res = await request(app)
        .post('/api/bots')
        .send({ name: 'Default Lang Bot', platform: 'telegram' });

      expect(res.status).toBe(201);
    });
  });
});
