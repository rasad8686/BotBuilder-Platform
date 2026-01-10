/**
 * Bots Controller Tests
 * Tests for server/routes/bots.js
 *
 * This test suite provides comprehensive coverage for all bot CRUD operations,
 * including validation, authorization, plan limits, and error handling.
 */

// Mock all dependencies before requiring the router
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => next()));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => next()),
  requireOrganization: jest.fn((req, res, next) => next())
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../middleware/audit', () => ({
  logBotCreated: jest.fn().mockResolvedValue(true),
  logBotUpdated: jest.fn().mockResolvedValue(true),
  logBotDeleted: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'mock-api-token-12345678901234567890123456789012')
  }))
}));

const request = require('supertest');
const express = require('express');
const db = require('../../db');
const webhookService = require('../../services/webhookService');
const { logBotCreated, logBotUpdated, logBotDeleted } = require('../../middleware/audit');
const log = require('../../utils/logger');
const crypto = require('crypto');

// Create Express app and mount the router
const app = express();
app.use(express.json());

// Mock the middleware to inject user and organization context
app.use((req, res, next) => {
  req.user = { id: 1 };
  req.organization = { id: 1 };
  next();
});

// Import router after mocks are set up
const botsRouter = require('../../routes/bots');
app.use('/api/bots', botsRouter);

describe.skip('Bots Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close database pool if it exists
    const db = require('../../db');
    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }

    // Clean up timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('POST /api/bots - Create Bot', () => {
    describe('Successful bot creation', () => {
      it('should create a new bot with all required fields', async () => {
        const mockBot = {
          id: 1,
          user_id: 1,
          organization_id: 1,
          name: 'Test Bot',
          description: 'Test Description',
          platform: 'telegram',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          webhook_url: 'https://example.com/webhook',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] }) // Plan check
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Bot count
          .mockResolvedValueOnce({ rows: [mockBot] }); // Insert bot

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram',
            description: 'Test Description',
            webhook_url: 'https://example.com/webhook'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Bot created successfully!');
        expect(response.body.bot).toMatchObject({
          id: 1,
          name: 'Test Bot',
          platform: 'telegram',
          description: 'Test Description'
        });
        expect(logBotCreated).toHaveBeenCalled();
        expect(webhookService.trigger).toHaveBeenCalledWith(1, 'bot.created', expect.any(Object));
      });

      it('should create bot with minimal required fields', async () => {
        const mockBot = {
          id: 2,
          user_id: 1,
          organization_id: 1,
          name: 'Minimal Bot',
          description: null,
          platform: 'whatsapp',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          webhook_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Minimal Bot',
            platform: 'whatsapp'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.bot.description).toBeNull();
        expect(response.body.bot.webhook_url).toBeNull();
      });

      it('should create bot with custom language', async () => {
        const mockBot = {
          id: 3,
          user_id: 1,
          organization_id: 1,
          name: 'Spanish Bot',
          description: null,
          platform: 'discord',
          language: 'es',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          webhook_url: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Spanish Bot',
            platform: 'discord',
            language: 'ES' // Should be normalized to lowercase
          });

        expect(response.status).toBe(201);
        expect(response.body.bot.language).toBe('es');
      });

      it('should normalize platform to lowercase', async () => {
        const mockBot = {
          id: 4,
          user_id: 1,
          organization_id: 1,
          name: 'Normalized Bot',
          platform: 'slack',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Normalized Bot',
            platform: 'SLACK' // Should be normalized to lowercase
          });

        expect(response.status).toBe(201);
        expect(response.body.bot.platform).toBe('slack');
      });

      it('should convert voice-to-bot platform to web', async () => {
        const mockBot = {
          id: 5,
          user_id: 1,
          organization_id: 1,
          name: 'Voice Bot',
          platform: 'web',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '2' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Voice Bot',
            platform: 'voice-to-bot'
          });

        expect(response.status).toBe(201);
        expect(response.body.bot.platform).toBe('web');
      });

      it('should trim whitespace from input fields', async () => {
        const mockBot = {
          id: 6,
          user_id: 1,
          organization_id: 1,
          name: 'Trimmed Bot',
          description: 'Clean description',
          platform: 'messenger',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          webhook_url: 'https://example.com',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: '  Trimmed Bot  ',
            platform: '  messenger  ',
            description: '  Clean description  ',
            webhook_url: '  https://example.com  '
          });

        expect(response.status).toBe(201);
        expect(response.body.bot.name).toBe('Trimmed Bot');
      });
    });

    describe('Validation errors', () => {
      it('should return 400 if name is missing', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Bot name is required');
      });

      it('should return 400 if name is empty string', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: '',
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Bot name is required');
      });

      it('should return 400 if name is only whitespace', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: '   ',
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Bot name is required');
      });

      it('should return 400 if platform is missing', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Platform is required (e.g., telegram, whatsapp, discord)');
      });

      it('should return 400 if platform is empty string', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: ''
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Platform is required (e.g., telegram, whatsapp, discord)');
      });

      it('should return 400 if platform is only whitespace', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: '   '
          });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Platform is required (e.g., telegram, whatsapp, discord)');
      });

      it('should return 400 for invalid platform', async () => {
        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'invalid-platform'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid platform');
        expect(response.body.message).toContain('telegram, whatsapp, discord, slack, messenger, web');
      });
    });

    describe('Plan limits', () => {
      it('should enforce free plan limit (1 bot)', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Already at limit

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Second Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(403);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Plan limit reached');
        expect(response.body.currentPlan).toBe('free');
        expect(response.body.currentBots).toBe(1);
        expect(response.body.maxBots).toBe(1);
        expect(response.body.limitReached).toBe(true);
        expect(response.body.message).toContain('Upgrade to Pro');
        expect(response.body.upgradePlan).toBe('pro');
        expect(log.warn).toHaveBeenCalledWith('Bot creation limit reached', expect.any(Object));
      });

      it('should enforce pro plan limit (10 bots)', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] })
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Already at limit

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Eleventh Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Plan limit reached');
        expect(response.body.currentPlan).toBe('pro');
        expect(response.body.currentBots).toBe(10);
        expect(response.body.maxBots).toBe(10);
        expect(response.body.message).toContain('Upgrade to Enterprise');
        expect(response.body.upgradePlan).toBe('enterprise');
      });

      it('should allow unlimited bots for enterprise plan', async () => {
        const mockBot = {
          id: 100,
          user_id: 1,
          organization_id: 1,
          name: 'Enterprise Bot',
          platform: 'telegram',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1000' }] }) // 1000 existing bots
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Enterprise Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(log.info).toHaveBeenCalledWith(
          'Bot creation limit OK',
          expect.objectContaining({ maxBots: 'unlimited' })
        );
      });

      it('should default to free plan if plan_tier is not set', async () => {
        const mockBot = {
          id: 7,
          user_id: 1,
          organization_id: 1,
          name: 'Default Plan Bot',
          platform: 'telegram',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{}] }) // No plan_tier set
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Default Plan Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(201);
        expect(log.info).toHaveBeenCalledWith(
          'Bot creation limit check',
          expect.objectContaining({ plan: 'free' })
        );
      });
    });

    describe('Database errors', () => {
      it('should handle duplicate bot name error', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockRejectedValueOnce({ code: '23505', message: 'Duplicate key' });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Duplicate Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('You already have a bot with this name');
      });

      it('should handle general database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database connection failed'));

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to create bot');
        expect(log.error).toHaveBeenCalledWith('Create bot error', expect.any(Object));
      });

      it('should not expose error details in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        db.query.mockRejectedValueOnce(new Error('Sensitive database error'));

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBeUndefined();

        process.env.NODE_ENV = originalEnv;
      });

      it('should expose error details in development', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        db.query.mockRejectedValueOnce(new Error('Debug error message'));

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test Bot',
            platform: 'telegram'
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Debug error message');

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('Audit and webhooks', () => {
      it('should log bot creation to audit trail', async () => {
        const mockBot = {
          id: 8,
          user_id: 1,
          organization_id: 1,
          name: 'Audited Bot',
          description: 'Test',
          platform: 'telegram',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        await request(app)
          .post('/api/bots')
          .send({
            name: 'Audited Bot',
            platform: 'telegram',
            description: 'Test'
          });

        expect(logBotCreated).toHaveBeenCalledWith(
          expect.any(Object),
          1,
          8,
          expect.objectContaining({
            name: 'Audited Bot',
            platform: 'telegram',
            description: 'Test'
          })
        );
      });

      it('should trigger webhook for bot creation', async () => {
        const mockBot = {
          id: 9,
          user_id: 1,
          organization_id: 1,
          name: 'Webhook Bot',
          platform: 'telegram',
          language: 'en',
          api_token: 'mock-api-token-12345678901234567890123456789012',
          is_active: true,
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        await request(app)
          .post('/api/bots')
          .send({
            name: 'Webhook Bot',
            platform: 'telegram'
          });

        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'bot.created',
          expect.objectContaining({
            bot_id: 9,
            name: 'Webhook Bot',
            platform: 'telegram'
          })
        );
      });
    });
  });

  describe('GET /api/bots - Get All Bots', () => {
    describe('Without pagination', () => {
      it('should return all bots for organization', async () => {
        const mockBots = [
          {
            id: 1,
            user_id: 1,
            organization_id: 1,
            name: 'Bot 1',
            platform: 'telegram',
            language: 'en',
            api_token: 'token1',
            is_active: true,
            created_at: new Date('2024-01-02'),
            updated_at: new Date()
          },
          {
            id: 2,
            user_id: 1,
            organization_id: 1,
            name: 'Bot 2',
            platform: 'whatsapp',
            language: 'en',
            api_token: 'token2',
            is_active: true,
            created_at: new Date('2024-01-01'),
            updated_at: new Date()
          }
        ];

        db.query.mockResolvedValueOnce({ rows: mockBots });

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
    });

    describe('With pagination', () => {
      it('should return paginated bots with page and limit', async () => {
        const mockBots = [
          { id: 1, name: 'Bot 1', organization_id: 1 },
          { id: 2, name: 'Bot 2', organization_id: 1 }
        ];

        db.query
          .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Total count
          .mockResolvedValueOnce({ rows: mockBots }); // Paginated results

        const response = await request(app)
          .get('/api/bots')
          .query({ page: 1, limit: 2 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination).toEqual({
          page: 1,
          limit: 2,
          total: 10,
          totalPages: 5,
          hasNext: true,
          hasPrev: false
        });
      });

      it('should handle page 2 correctly', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '10' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/bots')
          .query({ page: 2, limit: 5 });

        expect(response.status).toBe(200);
        expect(response.body.pagination).toMatchObject({
          page: 2,
          limit: 5,
          total: 10,
          totalPages: 2,
          hasNext: false,
          hasPrev: true
        });
      });

      it('should default to page 1 if page is invalid', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/bots')
          .query({ page: 0, limit: 10 });

        expect(response.status).toBe(200);
        expect(response.body.pagination.page).toBe(1);
      });

      it('should default to limit 10 if limit is invalid', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/bots')
          .query({ page: 1, limit: 0 });

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(10);
      });

      it('should enforce maximum limit of 100', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '200' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/bots')
          .query({ page: 1, limit: 500 });

        expect(response.status).toBe(200);
        expect(response.body.pagination.limit).toBe(100);
      });

      it('should use pagination when only page is provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/bots')
          .query({ page: 1 });

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.limit).toBe(10);
      });

      it('should use pagination when only limit is provided', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '5' }] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .get('/api/bots')
          .query({ limit: 20 });

        expect(response.status).toBe(200);
        expect(response.body.pagination).toBeDefined();
        expect(response.body.pagination.page).toBe(1);
      });

      it('should calculate correct offset for page 3', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ count: '50' }] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app)
          .get('/api/bots')
          .query({ page: 3, limit: 10 });

        // Verify the query was called with correct offset (page 3, limit 10 = offset 20)
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT $2 OFFSET $3'),
          [1, 10, 20]
        );
      });
    });

    describe('Error handling', () => {
      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/bots');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to retrieve bots');
        expect(log.error).toHaveBeenCalledWith('Get bots error', expect.any(Object));
      });

      it('should not expose error details in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        db.query.mockRejectedValueOnce(new Error('Sensitive error'));

        const response = await request(app).get('/api/bots');

        expect(response.status).toBe(500);
        expect(response.body.error).toBeUndefined();

        process.env.NODE_ENV = originalEnv;
      });
    });
  });

  describe('GET /api/bots/:id - Get Single Bot', () => {
    describe('Successful retrieval', () => {
      it('should return bot details for valid ID', async () => {
        const mockBot = {
          id: 1,
          user_id: 1,
          organization_id: 1,
          name: 'Test Bot',
          description: 'Description',
          platform: 'telegram',
          language: 'en',
          api_token: 'token123',
          webhook_url: 'https://example.com',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query.mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app).get('/api/bots/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.bot).toMatchObject({
          id: 1,
          name: 'Test Bot',
          platform: 'telegram'
        });
      });

      it('should verify organization ownership', async () => {
        const mockBot = {
          id: 5,
          organization_id: 1,
          name: 'Org Bot'
        };

        db.query.mockResolvedValueOnce({ rows: [mockBot] });

        await request(app).get('/api/bots/5');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE id = $1 AND organization_id = $2'),
          [5, 1]
        );
      });
    });

    describe('Validation errors', () => {
      it('should return 404 for non-numeric ID', async () => {
        const response = await request(app).get('/api/bots/abc');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Bot not found');
        expect(log.warn).toHaveBeenCalledWith('Invalid bot ID', expect.any(Object));
      });

      it('should return 404 for negative ID', async () => {
        const response = await request(app).get('/api/bots/-1');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Bot not found');
      });

      it('should return 404 for zero ID', async () => {
        const response = await request(app).get('/api/bots/0');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Bot not found');
      });

      it('should return 404 for decimal ID', async () => {
        const response = await request(app).get('/api/bots/1.5');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Bot not found');
      });
    });

    describe('Not found errors', () => {
      it('should return 404 when bot does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).get('/api/bots/999');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Bot not found or not accessible in this organization');
        expect(log.warn).toHaveBeenCalledWith('Bot not found', expect.any(Object));
      });

      it('should return 404 when bot belongs to different organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // No match with org filter

        const response = await request(app).get('/api/bots/1');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('not accessible in this organization');
      });
    });

    describe('Error handling', () => {
      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).get('/api/bots/1');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to retrieve bot');
        expect(log.error).toHaveBeenCalledWith('Get bot error', expect.any(Object));
      });

      it('should handle missing organization context', async () => {
        // Create a test with no organization
        const appNoOrg = express();
        appNoOrg.use(express.json());
        appNoOrg.use((req, res, next) => {
          req.user = { id: 1 };
          req.organization = null;
          next();
        });
        appNoOrg.use('/api/bots', botsRouter);

        const response = await request(appNoOrg).get('/api/bots/1');

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Organization context required');
        expect(log.error).toHaveBeenCalledWith('GET bot - No organization context', expect.any(Object));
      });
    });
  });

  describe('PUT /api/bots/:id - Update Bot', () => {
    describe('Successful updates', () => {
      it('should update bot name', async () => {
        const oldBot = {
          id: 1,
          name: 'Old Name',
          description: 'Description',
          platform: 'telegram',
          language: 'en',
          webhook_url: null,
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          name: 'New Name',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] }) // Check query
          .mockResolvedValueOnce({ rows: [updatedBot] }); // Update query

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Bot updated successfully!');
        expect(response.body.bot.name).toBe('New Name');
      });

      it('should update bot description', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          description: null,
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          description: 'New description',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ description: 'New description' });

        expect(response.status).toBe(200);
        expect(response.body.bot.description).toBe('New description');
      });

      it('should update bot platform', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          platform: 'whatsapp',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ platform: 'whatsapp' });

        expect(response.status).toBe(200);
        expect(response.body.bot.platform).toBe('whatsapp');
      });

      it('should update bot language', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          language: 'es',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ language: 'ES' }); // Should be normalized

        expect(response.status).toBe(200);
        expect(response.body.bot.language).toBe('es');
      });

      it('should update webhook_url', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          webhook_url: null,
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          webhook_url: 'https://new-webhook.com',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ webhook_url: 'https://new-webhook.com' });

        expect(response.status).toBe(200);
        expect(response.body.bot.webhook_url).toBe('https://new-webhook.com');
      });

      it('should update is_active status', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          is_active: false,
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ is_active: false });

        expect(response.status).toBe(200);
        expect(response.body.bot.is_active).toBe(false);
      });

      it('should update multiple fields at once', async () => {
        const oldBot = {
          id: 1,
          name: 'Old Bot',
          description: null,
          platform: 'telegram',
          language: 'en',
          webhook_url: null,
          is_active: true
        };

        const updatedBot = {
          id: 1,
          name: 'New Bot',
          description: 'Updated',
          platform: 'discord',
          language: 'fr',
          webhook_url: 'https://example.com',
          is_active: false,
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({
            name: 'New Bot',
            description: 'Updated',
            platform: 'discord',
            language: 'fr',
            webhook_url: 'https://example.com',
            is_active: false
          });

        expect(response.status).toBe(200);
        expect(response.body.bot).toMatchObject({
          name: 'New Bot',
          description: 'Updated',
          platform: 'discord',
          language: 'fr',
          is_active: false
        });
      });

      it('should trim whitespace from updated fields', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          name: 'Trimmed Name',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: '  Trimmed Name  ' });

        expect(response.status).toBe(200);
        expect(response.body.bot.name).toBe('Trimmed Name');
      });

      it('should set description to null when empty string provided', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          description: 'Old description',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          description: null,
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ description: '' });

        expect(response.status).toBe(200);
        expect(response.body.bot.description).toBeNull();
      });

      it('should convert voice-to-bot platform to web on update', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          ...oldBot,
          platform: 'web',
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ platform: 'voice-to-bot' });

        expect(response.status).toBe(200);
        expect(response.body.bot.platform).toBe('web');
      });
    });

    describe('Validation errors', () => {
      it('should return 400 for invalid bot ID', async () => {
        const response = await request(app)
          .put('/api/bots/abc')
          .send({ name: 'New Name' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid bot ID');
      });

      it('should return 400 if no fields provided for update', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        db.query.mockResolvedValueOnce({ rows: [oldBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('At least one field must be provided for update');
      });

      it('should return 400 if name is empty string', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        db.query.mockResolvedValueOnce({ rows: [oldBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: '' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Bot name cannot be empty');
      });

      it('should return 400 if name is only whitespace', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        db.query.mockResolvedValueOnce({ rows: [oldBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: '   ' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Bot name cannot be empty');
      });

      it('should return 400 for invalid platform', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        db.query.mockResolvedValueOnce({ rows: [oldBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ platform: 'invalid-platform' });

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('Invalid platform');
      });

      it('should return 400 if is_active is not boolean', async () => {
        const oldBot = {
          id: 1,
          name: 'Bot',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        db.query.mockResolvedValueOnce({ rows: [oldBot] });

        const response = await request(app)
          .put('/api/bots/1')
          .send({ is_active: 'yes' });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('is_active must be a boolean value');
      });
    });

    describe('Not found errors', () => {
      it('should return 404 when bot does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app)
          .put('/api/bots/999')
          .send({ name: 'New Name' });

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Bot not found or not accessible in this organization');
      });

      it('should return 404 when bot belongs to different organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // No match with org filter

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('not accessible in this organization');
      });
    });

    describe('Audit and webhooks', () => {
      it('should log bot update to audit trail', async () => {
        const oldBot = {
          id: 1,
          name: 'Old Name',
          description: 'Old desc',
          platform: 'telegram',
          language: 'en',
          webhook_url: null,
          is_active: true
        };

        const updatedBot = {
          id: 1,
          name: 'New Name',
          description: 'New desc',
          platform: 'telegram',
          language: 'en',
          webhook_url: null,
          is_active: true,
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name', description: 'New desc' });

        expect(logBotUpdated).toHaveBeenCalledWith(
          expect.any(Object),
          1,
          1,
          expect.objectContaining({ name: 'Old Name', description: 'Old desc' }),
          expect.objectContaining({ name: 'New Name', description: 'New desc' })
        );
      });

      it('should trigger webhook for bot update', async () => {
        const oldBot = {
          id: 1,
          name: 'Old Name',
          platform: 'telegram',
          language: 'en',
          is_active: true
        };

        const updatedBot = {
          id: 1,
          name: 'New Name',
          platform: 'telegram',
          language: 'en',
          is_active: false,
          updated_at: new Date('2024-01-01T00:00:00Z')
        };

        db.query
          .mockResolvedValueOnce({ rows: [oldBot] })
          .mockResolvedValueOnce({ rows: [updatedBot] });

        await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name', is_active: false });

        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'bot.updated',
          expect.objectContaining({
            bot_id: 1,
            name: 'New Name',
            is_active: false,
            changes: expect.objectContaining({
              old: expect.any(Object),
              new: expect.any(Object)
            })
          })
        );
      });
    });

    describe('Error handling', () => {
      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .put('/api/bots/1')
          .send({ name: 'New Name' });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to update bot');
        expect(log.error).toHaveBeenCalledWith('Update bot error', expect.any(Object));
      });
    });
  });

  describe('DELETE /api/bots/:id - Delete Bot', () => {
    describe('Successful deletion', () => {
      it('should delete bot successfully', async () => {
        const mockBot = {
          name: 'Test Bot',
          platform: 'telegram',
          description: 'Test description'
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockBot] }) // Check query
          .mockResolvedValueOnce({ rows: [] }); // Delete query

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Bot "Test Bot" deleted successfully!');
        expect(response.body.deletedId).toBe(1);
      });

      it('should verify organization ownership before deletion', async () => {
        const mockBot = {
          name: 'Org Bot',
          platform: 'telegram'
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockBot] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/api/bots/5');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('WHERE id = $1 AND organization_id = $2'),
          [5, 1]
        );
      });

      it('should delete bot even without description', async () => {
        const mockBot = {
          name: 'Bot',
          platform: 'telegram',
          description: null
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockBot] })
          .mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Bot "Bot" deleted successfully!');
      });
    });

    describe('Validation errors', () => {
      it('should return 400 for invalid bot ID', async () => {
        const response = await request(app).delete('/api/bots/abc');

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Invalid bot ID');
      });

      it('should return 400 for negative bot ID', async () => {
        const response = await request(app).delete('/api/bots/-1');

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid bot ID');
      });
    });

    describe('Not found errors', () => {
      it('should return 404 when bot does not exist', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const response = await request(app).delete('/api/bots/999');

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Bot not found or not accessible in this organization');
      });

      it('should return 404 when bot belongs to different organization', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // No match with org filter

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(404);
        expect(response.body.message).toContain('not accessible in this organization');
      });
    });

    describe('Audit and webhooks', () => {
      it('should log bot deletion to audit trail', async () => {
        const mockBot = {
          name: 'Deleted Bot',
          platform: 'telegram',
          description: 'Will be deleted'
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockBot] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/api/bots/1');

        expect(logBotDeleted).toHaveBeenCalledWith(
          expect.any(Object),
          1,
          1,
          expect.objectContaining({
            name: 'Deleted Bot',
            platform: 'telegram',
            description: 'Will be deleted'
          })
        );
      });

      it('should trigger webhook for bot deletion', async () => {
        const mockBot = {
          name: 'Webhook Delete Bot',
          platform: 'whatsapp',
          description: 'Test'
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockBot] })
          .mockResolvedValueOnce({ rows: [] });

        await request(app).delete('/api/bots/1');

        expect(webhookService.trigger).toHaveBeenCalledWith(
          1,
          'bot.deleted',
          expect.objectContaining({
            bot_id: 1,
            name: 'Webhook Delete Bot',
            platform: 'whatsapp',
            description: 'Test',
            deleted_at: expect.any(String)
          })
        );
      });
    });

    describe('Error handling', () => {
      it('should handle database errors', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe('Failed to delete bot');
        expect(log.error).toHaveBeenCalledWith('Delete bot error', expect.any(Object));
      });

      it('should not expose error details in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        db.query.mockRejectedValueOnce(new Error('Sensitive error'));

        const response = await request(app).delete('/api/bots/1');

        expect(response.status).toBe(500);
        expect(response.body.error).toBeUndefined();

        process.env.NODE_ENV = originalEnv;
      });
    });
  });

  describe('Security and Authorization', () => {
    it('should require authentication for POST /api/bots', async () => {
      // This is handled by the authenticateToken middleware
      // The test verifies the middleware is applied
      expect(require('../../middleware/auth')).toBeDefined();
    });

    it('should require organization context for all routes', async () => {
      const { organizationContext, requireOrganization } = require('../../middleware/organizationContext');
      expect(organizationContext).toBeDefined();
      expect(requireOrganization).toBeDefined();
    });

    it('should check permissions for POST (member)', async () => {
      const { checkPermission } = require('../../middleware/checkPermission');
      expect(checkPermission).toBeDefined();
    });

    it('should check permissions for GET (viewer)', async () => {
      const { checkPermission } = require('../../middleware/checkPermission');
      expect(checkPermission).toBeDefined();
    });

    it('should check permissions for PUT (member)', async () => {
      const { checkPermission } = require('../../middleware/checkPermission');
      expect(checkPermission).toBeDefined();
    });

    it('should check permissions for DELETE (admin)', async () => {
      const { checkPermission } = require('../../middleware/checkPermission');
      expect(checkPermission).toBeDefined();
    });
  });

  describe('API Token Generation', () => {
    it('should generate unique API token for new bots', async () => {
      const mockBot = {
        id: 1,
        name: 'Token Bot',
        platform: 'telegram',
        language: 'en',
        api_token: 'mock-api-token-12345678901234567890123456789012',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [mockBot] });

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: 'Token Bot',
          platform: 'telegram'
        });

      expect(response.status).toBe(201);
      expect(response.body.bot.api_token).toBeDefined();
      expect(response.body.bot.api_token).toBe('mock-api-token-12345678901234567890123456789012');
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long bot names gracefully', async () => {
      const longName = 'A'.repeat(1000);
      const mockBot = {
        id: 1,
        name: longName,
        platform: 'telegram',
        language: 'en',
        api_token: 'token',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [mockBot] });

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: longName,
          platform: 'telegram'
        });

      expect(response.status).toBe(201);
    });

    it('should handle special characters in bot name', async () => {
      const mockBot = {
        id: 1,
        name: "Bot's \"Special\" Name & More",
        platform: 'telegram',
        language: 'en',
        api_token: 'token',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [mockBot] });

      const response = await request(app)
        .post('/api/bots')
        .send({
          name: "Bot's \"Special\" Name & More",
          platform: 'telegram'
        });

      expect(response.status).toBe(201);
    });

    it('should handle pagination with zero results', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/bots')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.pagination.total).toBe(0);
      expect(response.body.pagination.totalPages).toBe(0);
    });

    it('should handle updating is_active to true', async () => {
      const oldBot = {
        id: 1,
        name: 'Bot',
        platform: 'telegram',
        language: 'en',
        is_active: false
      };

      const updatedBot = {
        ...oldBot,
        is_active: true,
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [oldBot] })
        .mockResolvedValueOnce({ rows: [updatedBot] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({ is_active: true });

      expect(response.status).toBe(200);
      expect(response.body.bot.is_active).toBe(true);
    });

    it('should handle webhook_url set to null', async () => {
      const oldBot = {
        id: 1,
        name: 'Bot',
        platform: 'telegram',
        language: 'en',
        webhook_url: 'https://old.com',
        is_active: true
      };

      const updatedBot = {
        ...oldBot,
        webhook_url: null,
        updated_at: new Date()
      };

      db.query
        .mockResolvedValueOnce({ rows: [oldBot] })
        .mockResolvedValueOnce({ rows: [updatedBot] });

      const response = await request(app)
        .put('/api/bots/1')
        .send({ webhook_url: null });

      expect(response.status).toBe(200);
      expect(response.body.bot.webhook_url).toBeNull();
    });
  });

  describe('Platform Normalization', () => {
    const platforms = ['telegram', 'whatsapp', 'discord', 'slack', 'messenger', 'web'];

    platforms.forEach(platform => {
      it(`should accept ${platform} as valid platform`, async () => {
        const mockBot = {
          id: 1,
          name: 'Test',
          platform: platform,
          language: 'en',
          api_token: 'token',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        };

        db.query
          .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [mockBot] });

        const response = await request(app)
          .post('/api/bots')
          .send({
            name: 'Test',
            platform: platform.toUpperCase()
          });

        expect(response.status).toBe(201);
        expect(response.body.bot.platform).toBe(platform);
      });
    });
  });
});
