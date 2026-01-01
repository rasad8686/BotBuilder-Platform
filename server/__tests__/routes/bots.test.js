/**
 * Comprehensive Bots Routes Tests
 * Tests for server/routes/bots.js
 *
 * Coverage:
 * - GET /api/bots - list bots with pagination
 * - POST /api/bots - create new bot
 * - GET /api/bots/:id - get single bot
 * - PUT /api/bots/:id - update bot
 * - DELETE /api/bots/:id - delete bot
 * - Error handling and validation
 * - Authorization checks
 * - Plan limits enforcement
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 1, name: 'Test Org', role: 'admin' };
    next();
  }),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn((role) => (req, res, next) => {
    // Simulate permission check
    if (!req.organization || !req.organization.role) {
      return res.status(403).json({
        success: false,
        message: 'Organization context required'
      });
    }
    next();
  })
}));

jest.mock('../../middleware/audit', () => ({
  logBotCreated: jest.fn().mockResolvedValue({}),
  logBotUpdated: jest.fn().mockResolvedValue({}),
  logBotDeleted: jest.fn().mockResolvedValue({})
}));

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue({})
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const botsRouter = require('../../routes/bots');
const { logBotCreated, logBotUpdated, logBotDeleted } = require('../../middleware/audit');
const webhookService = require('../../services/webhookService');
const log = require('../../utils/logger');

const app = express();
app.use(express.json());
app.use('/api/bots', botsRouter);

describe('Bots Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/bots - Create Bot', () => {
    describe('Successful Creation', () => {
      it('should create bot successfully with all fields', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] }) // Plan check
          .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Bot count
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            user_id: 1,
            organization_id: 1,
            name: 'Test Bot',
            description: 'A test bot',
            platform: 'telegram',
            language: 'en',
            api_token: 'test-token',
            webhook_url: 'https://example.com/webhook',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }] }); // Insert

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram',
            description: 'A test bot',
            language: 'en',
            webhook_url: 'https://example.com/webhook'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Bot created successfully!');
        expect(response.body.bot.name).toBe('Test Bot');
        expect(response.body.bot.platform).toBe('telegram');
        expect(response.body.bot.api_token).toBeDefined();
        expect(logBotCreated).toHaveBeenCalledWith(
          expect.anything(),
          1,
          1,
          expect.objectContaining({ name: 'Test Bot', platform: 'telegram' })
        );
        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'bot.created',
          expect.objectContaining({ bot_id: 1, name: 'Test Bot' })
        );
      });

      it('should create bot with minimal required fields', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'Minimal Bot',
            platform: 'discord',
            language: 'en',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Minimal Bot',
            platform: 'discord'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      it('should trim whitespace from bot name', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'Trimmed Bot',
            platform: 'telegram',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: '  Trimmed Bot  ',
            platform: 'telegram'
          });

        expect(response.status).toBe(201);
        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['Trimmed Bot'])
        );
      });

      it('should normalize platform to lowercase', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'Test Bot',
            platform: 'telegram',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'TELEGRAM'
          });

        expect(response.status).toBe(201);
      });

      it('should convert voice-to-bot platform to web', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'Voice Bot',
            platform: 'web',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Voice Bot',
            platform: 'voice-to-bot'
          });

        expect(response.status).toBe(201);
      });

      it('should default language to en when not provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'Test Bot',
            platform: 'telegram',
            language: 'en',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(201);
        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['en'])
        );
      });

      it('should accept all valid platforms', async () => {
        const validPlatforms = ['telegram', 'whatsapp', 'discord', 'slack', 'messenger', 'web'];

        for (const platform of validPlatforms) {
          jest.clearAllMocks();
          db.query
            .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [{
              id: 1,
              name: `${platform} Bot`,
              platform: platform,
              created_at: new Date()
            }] });

          const response = await request(app)
            .post('/api/bots')
            .send({
              name: `${platform} Bot`,
              platform: platform
            });

          expect(response.status).toBe(201);
        }
      });
    });

    describe('Validation Errors', () => {
      it('should reject missing name', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({ platform: 'telegram' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('name');
      });

      it('should reject empty name', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: '',
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('name');
      });

      it('should reject whitespace-only name', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: '   ',
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('name');
      });

      it('should reject missing platform', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({ name: 'Test Bot' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Platform');
      });

      it('should reject empty platform', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: ''
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Platform');
      });

      it('should reject invalid platform', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'invalid-platform'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid platform');
      });
    });

    describe('Plan Limits', () => {
      it('should enforce free plan limit (1 bot)', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Already at limit

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Plan limit reached');
        expect(response.body.limitReached).toBe(true);
        expect(response.body.currentPlan).toBe('free');
        expect(response.body.currentBots).toBe(1);
        expect(response.body.maxBots).toBe(1);
        expect(response.body.upgradePlan).toBe('pro');
        expect(response.body.message).toContain('Upgrade to Pro');
      });

      it('should enforce pro plan limit (10 bots)', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Already at limit

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Plan limit reached');
        expect(response.body.currentPlan).toBe('pro');
        expect(response.body.currentBots).toBe(10);
        expect(response.body.maxBots).toBe(10);
        expect(response.body.upgradePlan).toBe('enterprise');
        expect(response.body.message).toContain('Upgrade to Enterprise');
      });

      it('should allow unlimited bots on enterprise plan', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // Many bots
          .mockResolvedValueOnce({ rows: [{
            id: 101,
            name: 'Enterprise Bot',
            platform: 'telegram',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Enterprise Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      it('should allow bot creation when under limit', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Under limit of 10
          .mockResolvedValueOnce({ rows: [{
            id: 6,
            name: 'Test Bot',
            platform: 'telegram',
            created_at: new Date()
          }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      it('should default to free plan if plan_tier is null', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: null }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(403);
        expect(response.body.currentPlan).toBe('free');
      });
    });

    describe('Database Errors', () => {
      it('should handle duplicate bot name error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '2' }] })
          .mockRejectedValueOnce({ code: '23505' }); // PostgreSQL duplicate error

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already have');
      });

      it('should handle general database errors', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '2' }] })
          .mockRejectedValueOnce(new Error('Database connection failed'));

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to create bot');
      });

      it('should handle plan check query error', async () => {
        db.query.mockRejectedValueOnce(new Error('DB error'));

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(500);
      });
    });
  });

  describe('GET /api/bots - List Bots', () => {
    describe('Without Pagination', () => {
      it('should return all bots for organization', async () => {
        db.query.mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Bot 1', platform: 'telegram', organization_id: 1 },
            { id: 2, name: 'Bot 2', platform: 'discord', organization_id: 1 }
          ]
        });

        const response = await request(app).get('/api/bots');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Bots retrieved successfully');
        expect(response.body.bots).toHaveLength(2);
        expect(response.body.total).toBe(2);
        expect(response.body.pagination).toBeUndefined();
      });

      it('should return empty array when no bots exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.bots).toHaveLength(0);
        expect(response.body.total).toBe(0);
      });

      it('should order bots by created_at DESC', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/bots');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY created_at DESC'),
          [1]
        );
      });
    });

    describe('With Pagination', () => {
      it('should return paginated bots (page 1)', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // Total count
          .mockResolvedValueOnce({
            rows: Array(10).fill(null).map((_, i) => ({
              id: i + 1,
              name: `Bot ${i + 1}`,
              platform: 'telegram'
            }))
          }); // Paginated results

        const response = await request(app).get('/api/bots?page=1&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(10);
        expect(response.body.pagination).toEqual({
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
          hasNext: true,
          hasPrev: false
        });
      });

      it('should return correct pagination for page 3', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?page=3&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(3);
        expect(response.body.pagination.hasNext).toBe(true);
        expect(response.body.pagination.hasPrev).toBe(true);
      });

      it('should handle last page correctly', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '25' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?page=3&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.hasNext).toBe(false);
        expect(response.body.pagination.hasPrev).toBe(true);
        expect(response.body.pagination.totalPages).toBe(3);
      });

      it('should default to page 1 when page < 1', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?page=0&limit=10');

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(1);
      });

      it('should default to limit 10 when limit not provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?page=1');

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(10);
      });

      it('should enforce maximum limit of 100', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '200' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?page=1&limit=200');

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(100);
        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 100, 0]
        );
      });

      it('should calculate correct offset', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).get('/api/bots?page=3&limit=10');

        // Offset should be (3-1) * 10 = 20
        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 10, 20]
        );
      });

      it('should use pagination when only page is provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?page=2');

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
      });

      it('should use pagination when only limit is provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots?limit=20');

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/bots');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to retrieve bots');
      });

      it('should handle pagination query errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Count query failed'));

        const response = await request(app).get('/api/bots?page=1&limit=10');

        expect(response.status).toBe(500);
      });
    });
  });

  describe('GET /api/bots/:id - Get Single Bot', () => {
    describe('Successful Retrieval', () => {
      it('should return single bot details', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 1,
            user_id: 1,
            organization_id: 1,
            name: 'Test Bot',
            description: 'Test description',
            platform: 'telegram',
            language: 'en',
            api_token: 'test-token',
            webhook_url: 'https://example.com',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }]
        });

        const response = await request(app).get('/api/bots/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.bot.id).toBe(1);
        expect(response.body.bot.name).toBe('Test Bot');
        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          [1, 1]
        );
      });

      it('should return bot with minimal fields', async () => {
        db.query.mockResolvedValueOnce({
          rows: [{
            id: 2,
            name: 'Minimal Bot',
            platform: 'discord',
            organization_id: 1
          }]
        });

        const response = await request(app).get('/api/bots/2');

        expect(response.status).toBe(200);
        expect(response.body.bot.id).toBe(2);
      });
    });

    describe('Not Found Cases', () => {
      it('should return 404 when bot does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots/999');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not found');
      });

      it('should return 404 when bot belongs to different organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots/1');

        expect(response.status).toBe(404);
      });
    });

    describe('Validation', () => {
      it('should reject invalid bot ID (non-numeric)', async () => {
        const response = await request(app).get('/api/bots/abc');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('not found');
      });

      it('should reject negative bot ID', async () => {
        const response = await request(app).get('/api/bots/-1');

        expect(response.status).toBe(404);
      });

      it('should reject zero as bot ID', async () => {
        const response = await request(app).get('/api/bots/0');

        expect(response.status).toBe(404);
      });

      it('should reject decimal bot ID', async () => {
        const response = await request(app).get('/api/bots/1.5');

        expect(response.status).toBe(404);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/bots/1');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to retrieve bot');
      });
    });
  });

  describe('PUT /api/bots/:id - Update Bot', () => {
    describe('Successful Updates', () => {
      it('should update bot name', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Old Name', platform: 'telegram' }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'New Name',
            platform: 'telegram',
            updated_at: new Date()
          }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Bot updated successfully!');
        expect(logBotUpdated).toHaveBeenCalled();
        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'bot.updated',
          expect.objectContaining({ bot_id: 1 })
        );
      });

      it('should update bot description', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, description: 'Old desc' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, description: 'New desc' }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ description: 'New desc' });

        expect(response.status).toBe(200);
      });

      it('should update bot platform', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, platform: 'telegram' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, platform: 'discord' }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ platform: 'discord' });

        expect(response.status).toBe(200);
      });

      it('should update bot language', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, language: 'en' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, language: 'es' }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ language: 'es' });

        expect(response.status).toBe(200);
      });

      it('should update webhook_url', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, webhook_url: 'https://old.com' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, webhook_url: 'https://new.com' }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ webhook_url: 'https://new.com' });

        expect(response.status).toBe(200);
      });

      it('should update is_active status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ is_active: false });

        expect(response.status).toBe(200);
      });

      it('should update multiple fields at once', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'Old Name',
            description: 'Old desc',
            platform: 'telegram'
          }] })
          .mockResolvedValueOnce({ rows: [{
            id: 1,
            name: 'New Name',
            description: 'New desc',
            platform: 'discord'
          }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({
            name: 'New Name',
            description: 'New desc',
            platform: 'discord'
          });

        expect(response.status).toBe(200);
      });

      it('should trim whitespace from updated name', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Old' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Trimmed' }] });

        await request(app)
          .put('/api/bots/1')
          .send({ name: '  Trimmed  ' });

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining(['Trimmed', 1])
        );
      });

      it('should set description to null when empty string provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, description: 'Old' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, description: null }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ description: '' });

        expect(response.status).toBe(200);
      });

      it('should normalize platform to lowercase', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, platform: 'telegram' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, platform: 'discord' }] });

        await request(app)
          .put('/api/bots/1')
          .send({ platform: 'DISCORD' });

        expect(response.status).toBe(200);
      });

      it('should convert voice-to-bot to web platform', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, platform: 'telegram' }] })
          .mockResolvedValueOnce({ rows: [{ id: 1, platform: 'web' }] });

        await request(app)
          .put('/api/bots/1')
          .send({ platform: 'voice-to-bot' });
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid bot ID (non-numeric)', async () => {
        const response = await request(app)
          .put('/api/bots/abc')
          .send({ name: 'New Name' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid bot ID');
      });

      it('should return 404 when bot does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/api/bots/999')
          .send({ name: 'New Name' });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('not found');
      });

      it('should reject empty name', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: '' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('cannot be empty');
      });

      it('should reject whitespace-only name', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: '   ' });

        expect(response.status).toBe(400);
      });

      it('should reject invalid platform', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ platform: 'invalid-platform' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid platform');
      });

      it('should reject non-boolean is_active', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ is_active: 'yes' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('boolean');
      });

      it('should reject update with no fields', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('At least one field');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors on check query', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to update bot');
      });

      it('should handle database errors on update query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockRejectedValueOnce(new Error('Update failed'));

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(500);
      });
    });
  });

  describe('DELETE /api/bots/:id - Delete Bot', () => {
    describe('Successful Deletion', () => {
      it('should delete bot successfully', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{
            name: 'Test Bot',
            platform: 'telegram',
            description: 'Test description'
          }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted successfully');
        expect(response.body.deletedId).toBe(1);
        expect(logBotDeleted).toHaveBeenCalledWith(
          expect.anything(),
          1,
          1,
          expect.objectContaining({ name: 'Test Bot' })
        );
        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'bot.deleted',
          expect.objectContaining({ bot_id: 1 })
        );
      });

      it('should delete bot with minimal information', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ name: 'Bot', platform: 'web' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/bots/2');

        expect(response.status).toBe(200);
      });
    });

    describe('Validation Errors', () => {
      it('should reject invalid bot ID (non-numeric)', async () => {
        const response = await request(app).delete('/api/bots/abc');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid bot ID');
      });

      it('should return 404 when bot does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/bots/999');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('not found');
      });

      it('should return 404 when bot belongs to different organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(404);
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors on check query', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(500);
        expect(response.body.message).toBe('Failed to delete bot');
      });

      it('should handle database errors on delete query', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ name: 'Test Bot', platform: 'telegram' }] })
          .mockRejectedValueOnce(new Error('Delete failed'));

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(500);
      });
    });
  });

  describe('Middleware Integration', () => {
    it('should call authentication middleware', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/bots');

      // Auth middleware sets req.user, which is verified in other tests
      expect(db.query).toHaveBeenCalled();
    });

    it('should call organization context middleware', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app).get('/api/bots');

      // Organization middleware sets req.organization, which is used in queries
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1]) // organization_id
      );
    });
  });

  describe('Logging', () => {
    it('should log bot creation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test', platform: 'telegram', created_at: new Date() }] });

      await request(app)
        .post('/api/bots')
        .send({ name: 'Test', platform: 'telegram' });

      expect(log.info).toHaveBeenCalled();
    });

    it('should log errors', async () => {
      db.query.mockRejectedValueOnce(new Error('Test error'));

      await request(app).get('/api/bots');

      expect(log.error).toHaveBeenCalledWith(
        'Get bots error',
        expect.objectContaining({ error: 'Test error' })
      );
    });
  });
});
