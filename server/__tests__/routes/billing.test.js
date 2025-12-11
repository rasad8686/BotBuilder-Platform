/**
 * Billing Routes Tests
 * Tests for server/routes/billing.js
 */

// Mock env vars before requiring billing route
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.STRIPE_PRO_PRICE_ID = 'price_test_pro';
process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_test_enterprise';

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', current_organization_id: 1 };
  next();
}));

jest.mock('../../controllers/billingController', () => ({
  handleWebhook: jest.fn((req, res) => res.json({ received: true }))
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test'
        })
      }
    },
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: false
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30
      })
    }
  }));
});

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const request = require('supertest');
const db = require('../../db');
const { handleWebhook } = require('../../controllers/billingController');
const billingRouter = require('../../routes/billing');

const app = express();
app.use(express.json());
app.use('/api/billing', billingRouter);

describe('Billing Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/billing/webhook', () => {
    it('should handle webhook', async () => {
      const response = await request(app)
        .post('/api/billing/webhook')
        .send({});

      expect(response.status).toBe(200);
      expect(handleWebhook).toHaveBeenCalled();
    });
  });

  describe('POST /api/billing/checkout', () => {
    it('should create checkout session', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@example.com', name: 'Test User' }]
      });

      const response = await request(app)
        .post('/api/billing/checkout')
        .send({
          planType: 'pro',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.checkoutUrl).toBeDefined();
    });

    it('should reject missing planType', async () => {
      const response = await request(app)
        .post('/api/billing/checkout')
        .send({
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should reject missing successUrl', async () => {
      const response = await request(app)
        .post('/api/billing/checkout')
        .send({
          planType: 'pro',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid planType', async () => {
      const response = await request(app)
        .post('/api/billing/checkout')
        .send({
          planType: 'invalid',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid plan type');
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/billing/checkout')
        .send({
          planType: 'pro',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel'
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return subscription details', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          plan_tier: 'pro',
          stripe_subscription_id: 'sub_test_123',
          subscription_status: 'active',
          stripe_customer_id: 'cus_test_123'
        }]
      });

      const response = await request(app).get('/api/billing/subscription');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.subscription.plan).toBe('pro');
    });

    it('should return free plan if no organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/billing/subscription');

      expect(response.status).toBe(200);
      expect(response.body.subscription.plan).toBe('free');
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/billing/subscription');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/billing/cancel', () => {
    it('should cancel subscription', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, stripe_subscription_id: 'sub_test_123' }]
      });

      const response = await request(app)
        .post('/api/billing/cancel')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.cancelAtPeriodEnd).toBe(true);
    });

    it('should reject if no subscription', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/billing/cancel')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No active subscription');
    });

    it('should reject if no stripe subscription id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, stripe_subscription_id: null }]
      });

      const response = await request(app)
        .post('/api/billing/cancel')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/billing/usage', () => {
    it('should return usage for organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'pro' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: 5000 }] });

      const response = await request(app).get('/api/billing/usage');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.current).toBe(5000);
      expect(response.body.limit).toBe(50000);
      expect(response.body.plan).toBe('pro');
    });

    it('should return defaults if no organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/billing/usage');

      expect(response.status).toBe(200);
      expect(response.body.current).toBe(0);
      expect(response.body.limit).toBe(1000);
      expect(response.body.plan).toBe('free');
    });

    it('should return 0 usage if no usage record', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app).get('/api/billing/usage');

      expect(response.status).toBe(200);
      expect(response.body.current).toBe(0);
    });

    it('should handle enterprise unlimited', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'enterprise' }] })
        .mockResolvedValueOnce({ rows: [{ message_count: 100000 }] });

      const response = await request(app).get('/api/billing/usage');

      expect(response.status).toBe(200);
      expect(response.body.percentage).toBe(0); // Unlimited
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      const response = await request(app).get('/api/billing/usage');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/billing/plans', () => {
    it('should return available plans', async () => {
      const response = await request(app).get('/api/billing/plans');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.plans).toBeDefined();
      expect(response.body.plans.free).toBeDefined();
      expect(response.body.plans.pro).toBeDefined();
      expect(response.body.plans.enterprise).toBeDefined();
    });

    it('should include correct pricing', async () => {
      const response = await request(app).get('/api/billing/plans');

      expect(response.body.plans.free.price).toBe(0);
      expect(response.body.plans.pro.price).toBe(29);
      expect(response.body.plans.enterprise.price).toBe(99);
    });

    it('should include features', async () => {
      const response = await request(app).get('/api/billing/plans');

      expect(response.body.plans.free.features).toContain('1 bot');
      expect(response.body.plans.pro.features).toContain('10 bots');
      expect(response.body.plans.enterprise.features).toContain('Unlimited bots');
    });
  });
});
