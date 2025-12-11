/**
 * Billing Controller Tests
 * Tests for server/controllers/billingController.js
 */

// Set env vars before requiring module
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_PRO_PRICE_ID = 'price_pro_test';
process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_test';

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn()
    },
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test123' })
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ id: 'cs_test123', url: 'https://checkout.stripe.com/test' })
      }
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' })
      }
    },
    invoices: {
      list: jest.fn().mockResolvedValue({
        data: [{
          id: 'inv_test123',
          created: Date.now() / 1000,
          lines: { data: [{ description: 'Pro Plan' }] },
          total: 2900,
          currency: 'usd',
          status: 'paid',
          invoice_pdf: 'https://stripe.com/invoice.pdf',
          hosted_invoice_url: 'https://stripe.com/invoice'
        }]
      })
    },
    webhooks: {
      constructEvent: jest.fn()
    }
  }));
});

jest.mock('../../services/webhookService', () => ({
  trigger: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUsage,
  cancelSubscription,
  getPlans,
  PLANS
} = require('../../controllers/billingController');

describe('Billing Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      organization: { id: 1 },
      user: { id: 1 },
      body: {},
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('getSubscription', () => {
    it('should return subscription details for pro plan', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          plan_tier: 'pro',
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: null,
          subscription_status: 'active'
        }]
      });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        subscription: expect.objectContaining({
          plan: 'pro',
          planName: 'Pro',
          price: 29
        })
      }));
    });

    it('should return free plan for organization without plan', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          plan_tier: null
        }]
      });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        subscription: expect.objectContaining({
          plan: 'free'
        })
      }));
    });

    it('should return 404 if organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session for pro plan', async () => {
      mockReq.body = { priceId: 'price_pro_test' };
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', stripe_customer_id: 'cus_123' }] });

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        sessionId: 'cs_test123'
      }));
    });

    it('should reject missing priceId', async () => {
      mockReq.body = {};

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should reject invalid priceId', async () => {
      mockReq.body = { priceId: 'invalid_price' };

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if organization not found', async () => {
      mockReq.body = { priceId: 'price_pro_test' };
      db.query.mockResolvedValueOnce({ rows: [] });

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_123' }]
      });

      await createPortalSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        url: expect.any(String)
      }));
    });

    it('should reject if no stripe customer', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await createPortalSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getInvoices', () => {
    it('should return invoices', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_123' }]
      });

      await getInvoices(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        invoices: expect.any(Array)
      }));
    });

    it('should return empty array if no stripe customer', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await getInvoices(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        invoices: []
      }));
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getInvoices(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getUsage', () => {
    it('should return usage statistics', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'pro' }] }) // Plan
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // Bots
        .mockResolvedValueOnce({ rows: [{ count: '1000' }] }); // Messages

      await getUsage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        usage: expect.objectContaining({
          bots: expect.any(Object),
          messages: expect.any(Object)
        })
      }));
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValueOnce(new Error('DB error'));

      await getUsage(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('cancelSubscription', () => {
    it('should reject if no active subscription', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await cancelSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should reject if no stripe subscription id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ stripe_subscription_id: null }]
      });

      await cancelSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPlans', () => {
    it('should return available plans', async () => {
      await getPlans(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        plans: expect.objectContaining({
          free: expect.any(Object),
          pro: expect.any(Object),
          enterprise: expect.any(Object)
        })
      }));
    });
  });

  describe('PLANS constant', () => {
    it('should have correct plan structure', () => {
      expect(PLANS.free).toBeDefined();
      expect(PLANS.pro).toBeDefined();
      expect(PLANS.enterprise).toBeDefined();

      expect(PLANS.free.price).toBe(0);
      expect(PLANS.pro.price).toBe(29);
      expect(PLANS.enterprise.price).toBe(99);
    });

    it('should have limits for each plan', () => {
      expect(PLANS.free.limits.bots).toBe(1);
      expect(PLANS.pro.limits.bots).toBe(10);
      expect(PLANS.enterprise.limits.bots).toBe(-1); // unlimited
    });
  });
});
