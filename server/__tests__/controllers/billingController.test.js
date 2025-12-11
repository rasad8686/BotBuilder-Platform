/**
 * Billing Controller Tests
 * Tests for server/controllers/billingController.js
 */

// Use fake timers to prevent setInterval from running
jest.useFakeTimers();

// Set env vars before requiring module
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_PRO_PRICE_ID = 'price_pro_test';
process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise_test';

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const mockSubscriptionsRetrieve = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockCustomersCreate = jest.fn().mockResolvedValue({ id: 'cus_test123' });
const mockCheckoutSessionsCreate = jest.fn().mockResolvedValue({ id: 'cs_test123', url: 'https://checkout.stripe.com/test' });
const mockBillingPortalSessionsCreate = jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/portal' });
const mockInvoicesList = jest.fn().mockResolvedValue({
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
});
const mockWebhooksConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    subscriptions: {
      retrieve: mockSubscriptionsRetrieve,
      update: mockSubscriptionsUpdate
    },
    customers: {
      create: mockCustomersCreate
    },
    checkout: {
      sessions: {
        create: mockCheckoutSessionsCreate
      }
    },
    billingPortal: {
      sessions: {
        create: mockBillingPortalSessionsCreate
      }
    },
    invoices: {
      list: mockInvoicesList
    },
    webhooks: {
      constructEvent: mockWebhooksConstructEvent
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
  handleWebhook,
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

    it('should have features for each plan', () => {
      expect(PLANS.free.features).toBeInstanceOf(Array);
      expect(PLANS.pro.features).toBeInstanceOf(Array);
      expect(PLANS.enterprise.features).toBeInstanceOf(Array);
      expect(PLANS.free.features.length).toBeGreaterThan(0);
    });
  });

  describe('createCheckoutSession - additional', () => {
    it('should handle enterprise plan checkout', async () => {
      mockReq.body = { priceId: 'price_enterprise_test' };
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', stripe_customer_id: 'cus_123' }] });

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getSubscription - additional', () => {
    it('should return enterprise plan details', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Enterprise Org',
          plan_tier: 'enterprise',
          stripe_customer_id: 'cus_123',
          subscription_status: 'active'
        }]
      });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        subscription: expect.objectContaining({
          plan: 'enterprise',
          planName: 'Enterprise',
          price: 99
        })
      }));
    });
  });

  describe('getUsage - additional', () => {
    it('should calculate percentage correctly for unlimited plans', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'enterprise' }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50000' }] });

      await getUsage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        usage: expect.objectContaining({
          bots: expect.objectContaining({
            percentage: 0
          })
        })
      }));
    });

    it('should handle free plan usage', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '500' }] });

      await getUsage(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        usage: expect.objectContaining({
          bots: expect.objectContaining({
            limit: 1
          })
        })
      }));
    });
  });

  describe('getInvoices - additional', () => {
    it('should return invoices without customer id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: null }]
      });

      await getInvoices(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        invoices: []
      }));
    });
  });

  describe('cancelSubscription - success', () => {
    it('should cancel subscription successfully', async () => {
      mockSubscriptionsUpdate.mockResolvedValueOnce({
        cancel_at_period_end: true,
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      });

      db.query.mockResolvedValueOnce({
        rows: [{ stripe_subscription_id: 'sub_test123' }]
      });

      await cancelSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Subscription will be canceled at period end'
      }));
    });

    it('should handle cancel subscription error', async () => {
      mockSubscriptionsUpdate.mockRejectedValueOnce(new Error('Stripe error'));

      db.query.mockResolvedValueOnce({
        rows: [{ stripe_subscription_id: 'sub_test123' }]
      });

      await cancelSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createCheckoutSession - new customer', () => {
    it('should create new stripe customer if none exists', async () => {
      mockReq.body = { priceId: 'price_pro_test' };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', stripe_customer_id: null }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Update customer id

      await createCheckoutSession(mockReq, mockRes);

      expect(mockCustomersCreate).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle idempotency key', async () => {
      mockReq.body = { priceId: 'price_pro_test' };
      mockReq.headers['idempotency-key'] = 'idem-key-123';

      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', stripe_customer_id: 'cus_123' }] });

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle checkout session error', async () => {
      mockReq.body = { priceId: 'price_pro_test' };
      mockCheckoutSessionsCreate.mockRejectedValueOnce(new Error('Stripe error'));

      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', stripe_customer_id: 'cus_123' }] });

      await createCheckoutSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createPortalSession - error handling', () => {
    it('should handle portal session error', async () => {
      mockBillingPortalSessionsCreate.mockRejectedValueOnce(new Error('Stripe error'));

      db.query.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_123' }]
      });

      await createPortalSession(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSubscription - stripe retrieval', () => {
    it('should retrieve stripe subscription', async () => {
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        cancel_at_period_end: false,
        status: 'active'
      });

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          plan_tier: 'pro',
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_123',
          subscription_status: 'active'
        }]
      });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        subscription: expect.objectContaining({
          stripeSubscription: expect.any(Object)
        })
      }));
    });

    it('should handle stripe subscription retrieval error gracefully', async () => {
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('Not found'));

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          plan_tier: 'pro',
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_123',
          subscription_status: 'active'
        }]
      });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 for invalid plan tier', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Test Org',
          plan_tier: 'invalid_plan',
          stripe_customer_id: 'cus_123'
        }]
      });

      await getSubscription(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('handleWebhook', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
      mockReq.headers['stripe-signature'] = 'test_signature';
      mockReq.body = Buffer.from('test body');
    });

    it('should return 500 if webhook secret not configured', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_your_webhook_secret_here';

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should return 400 if missing signature', async () => {
      delete mockReq.headers['stripe-signature'];

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if empty body', async () => {
      mockReq.body = Buffer.alloc(0);
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('empty body');
      });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle checkout.session.completed event', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'checkout.session.completed',
        id: 'evt_123',
        data: {
          object: {
            id: 'cs_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            metadata: { organizationId: '1', plan: 'pro' }
          }
        }
      });
      mockSubscriptionsRetrieve.mockResolvedValueOnce({
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      });

      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Org', plan_tier: 'pro' }]
      });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle customer.subscription.updated event', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'customer.subscription.updated',
        id: 'evt_123',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            cancel_at_period_end: false,
            current_period_end: Math.floor(Date.now() / 1000),
            items: { data: [{ price: { id: 'price_pro_test' } }] }
          }
        }
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', plan_tier: 'free' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', plan_tier: 'pro', subscription_status: 'active' }] });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle customer.subscription.deleted event', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'customer.subscription.deleted',
        id: 'evt_123',
        data: {
          object: {
            id: 'sub_123',
            status: 'canceled'
          }
        }
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org', plan_tier: 'free', subscription_status: 'canceled' }] });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle invoice.payment_succeeded event', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'invoice.payment_succeeded',
        id: 'evt_123',
        data: {
          object: {
            id: 'inv_123',
            amount_paid: 2900,
            currency: 'usd',
            subscription: 'sub_123'
          }
        }
      });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle invoice.payment_failed event', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'invoice.payment_failed',
        id: 'evt_123',
        data: {
          object: {
            id: 'inv_123',
            amount_due: 2900,
            currency: 'usd',
            subscription: 'sub_123'
          }
        }
      });

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org' }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle unrecognized event type', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'unknown.event',
        id: 'evt_123',
        data: { object: {} }
      });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle webhook processing error', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'checkout.session.completed',
        id: 'evt_123',
        data: {
          object: {
            id: 'cs_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            metadata: { organizationId: '1', plan: 'pro' }
          }
        }
      });
      mockSubscriptionsRetrieve.mockRejectedValueOnce(new Error('Stripe error'));

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('handleWebhook - no org found', () => {
    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
      mockReq.headers['stripe-signature'] = 'test_signature';
      mockReq.body = Buffer.from('test body');
    });

    it('should handle subscription updated with no org', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'customer.subscription.updated',
        id: 'evt_123',
        data: {
          object: {
            id: 'sub_nonexistent',
            status: 'active',
            cancel_at_period_end: false,
            current_period_end: Math.floor(Date.now() / 1000)
          }
        }
      });

      db.query.mockResolvedValueOnce({ rows: [] });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle subscription deleted with no org', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'customer.subscription.deleted',
        id: 'evt_123',
        data: {
          object: {
            id: 'sub_nonexistent',
            status: 'canceled'
          }
        }
      });

      db.query.mockResolvedValueOnce({ rows: [] });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle payment failed with no org', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'invoice.payment_failed',
        id: 'evt_123',
        data: {
          object: {
            id: 'inv_123',
            amount_due: 2900,
            currency: 'usd',
            subscription: 'sub_nonexistent'
          }
        }
      });

      db.query.mockResolvedValueOnce({ rows: [] });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should handle checkout without organizationId in metadata', async () => {
      mockWebhooksConstructEvent.mockReturnValueOnce({
        type: 'checkout.session.completed',
        id: 'evt_123',
        data: {
          object: {
            id: 'cs_123',
            customer: 'cus_123',
            subscription: 'sub_123',
            metadata: {}
          }
        }
      });

      await handleWebhook(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getInvoices - stripe error', () => {
    it('should handle stripe API error when fetching invoices', async () => {
      mockInvoicesList.mockRejectedValueOnce(new Error('Stripe API error'));

      db.query.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_123' }]
      });

      await getInvoices(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        invoices: [],
        message: expect.any(String)
      }));
    });
  });
});
