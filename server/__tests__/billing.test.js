/**
 * Billing API Tests
 * Tests for /api/billing endpoints: subscriptions, payments, invoices
 */

const request = require('supertest');

jest.mock('../db', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const express = require('express');
const db = require('../db');

const app = express();
app.use(express.json());

const mockAuth = (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  req.organization = { id: 1, name: 'Test Org' };
  next();
};

// GET plans
app.get('/api/billing/plans', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET current subscription
app.get('/api/billing/subscription', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT us.*, sp.name as plan_name, sp.price, sp.features
       FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.organization_id = $1 AND us.status = 'active'`,
      [req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CREATE subscription / upgrade
app.post('/api/billing/subscribe', mockAuth, async (req, res) => {
  try {
    const { plan_id, payment_method_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    const planResult = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [plan_id]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Deactivate existing subscription
    await db.query(
      "UPDATE user_subscriptions SET status = 'cancelled' WHERE organization_id = $1 AND status = 'active'",
      [req.organization.id]
    );

    // Create new subscription
    const result = await db.query(
      `INSERT INTO user_subscriptions (organization_id, plan_id, status, current_period_start, current_period_end)
       VALUES ($1, $2, 'active', NOW(), NOW() + INTERVAL '1 month') RETURNING *`,
      [req.organization.id, plan_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CANCEL subscription
app.post('/api/billing/cancel', mockAuth, async (req, res) => {
  try {
    const { reason } = req.body;

    const subResult = await db.query(
      "SELECT * FROM user_subscriptions WHERE organization_id = $1 AND status = 'active'",
      [req.organization.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active subscription found' });
    }

    await db.query(
      "UPDATE user_subscriptions SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = $1 WHERE id = $2",
      [reason || null, subResult.rows[0].id]
    );

    res.json({ success: true, message: 'Subscription cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET payment history
app.get('/api/billing/payments', mockAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT * FROM payment_history WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.organization.id, limit, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM payment_history WHERE organization_id = $1',
      [req.organization.id]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET invoices
app.get('/api/billing/invoices', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM invoices WHERE organization_id = $1 ORDER BY created_at DESC`,
      [req.organization.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET single invoice
app.get('/api/billing/invoices/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM invoices WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET usage
app.get('/api/billing/usage', mockAuth, async (req, res) => {
  try {
    const { period = 'current' } = req.query;

    const result = await db.query(
      `SELECT metric, SUM(value) as total
       FROM usage_tracking
       WHERE organization_id = $1
       GROUP BY metric`,
      [req.organization.id]
    );

    // Get limits from subscription
    const subResult = await db.query(
      `SELECT sp.features FROM user_subscriptions us
       JOIN subscription_plans sp ON us.plan_id = sp.id
       WHERE us.organization_id = $1 AND us.status = 'active'`,
      [req.organization.id]
    );

    const limits = subResult.rows[0]?.features || {};

    res.json({
      success: true,
      data: {
        usage: result.rows.reduce((acc, r) => ({ ...acc, [r.metric]: parseInt(r.total) }), {}),
        limits,
        period
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADD payment method
app.post('/api/billing/payment-methods', mockAuth, async (req, res) => {
  try {
    const { stripe_payment_method_id, is_default } = req.body;

    if (!stripe_payment_method_id) {
      return res.status(400).json({ success: false, message: 'Payment method ID is required' });
    }

    // If is_default, unset other defaults
    if (is_default) {
      await db.query(
        'UPDATE payment_methods SET is_default = false WHERE organization_id = $1',
        [req.organization.id]
      );
    }

    const result = await db.query(
      `INSERT INTO payment_methods (organization_id, stripe_payment_method_id, is_default)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.organization.id, stripe_payment_method_id, is_default || false]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET payment methods
app.get('/api/billing/payment-methods', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM payment_methods WHERE organization_id = $1 ORDER BY is_default DESC, created_at DESC',
      [req.organization.id]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE payment method
app.delete('/api/billing/payment-methods/:id', mockAuth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM payment_methods WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.organization.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }

    await db.query('DELETE FROM payment_methods WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Payment method deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CREATE Stripe checkout session
app.post('/api/billing/create-checkout-session', mockAuth, async (req, res) => {
  try {
    const { plan_id, success_url, cancel_url } = req.body;

    if (!plan_id) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    const planResult = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [plan_id]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    // Mock Stripe session
    res.json({
      success: true,
      data: {
        session_id: 'cs_test_' + Math.random().toString(36).substr(2, 9),
        url: success_url || 'https://checkout.stripe.com/pay/cs_test'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET billing portal URL
app.get('/api/billing/portal', mockAuth, async (req, res) => {
  try {
    // Mock Stripe portal URL
    res.json({
      success: true,
      data: {
        url: 'https://billing.stripe.com/session/test_portal'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

describe('Billing API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // GET PLANS
  // ========================================
  describe('GET /api/billing/plans', () => {
    it('should return available plans', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Free', price: 0 },
          { id: 2, name: 'Pro', price: 29 },
          { id: 3, name: 'Enterprise', price: 99 }
        ]
      });

      const res = await request(app).get('/api/billing/plans');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(3);
    });

    it('should return empty array if no plans', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/billing/plans');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/plans');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // GET SUBSCRIPTION
  // ========================================
  describe('GET /api/billing/subscription', () => {
    it('should return current subscription', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          plan_name: 'Pro',
          price: 29,
          status: 'active'
        }]
      });

      const res = await request(app).get('/api/billing/subscription');

      expect(res.status).toBe(200);
      expect(res.body.data.plan_name).toBe('Pro');
    });

    it('should return null if no subscription', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/billing/subscription');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/subscription');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // SUBSCRIBE
  // ========================================
  describe('POST /api/billing/subscribe', () => {
    it('should create subscription', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Pro' }] }) // Plan exists
        .mockResolvedValueOnce({ rowCount: 0 }) // Cancel existing
        .mockResolvedValueOnce({ rows: [{ id: 1, plan_id: 2, status: 'active' }] }); // Create new

      const res = await request(app)
        .post('/api/billing/subscribe')
        .send({ plan_id: 2 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 if plan_id is missing', async () => {
      const res = await request(app)
        .post('/api/billing/subscribe')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 if plan not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/billing/subscribe')
        .send({ plan_id: 999 });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/billing/subscribe')
        .send({ plan_id: 2 });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CANCEL
  // ========================================
  describe('POST /api/billing/cancel', () => {
    it('should cancel subscription', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/billing/cancel')
        .send({ reason: 'Too expensive' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if no active subscription', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/billing/cancel')
        .send({});

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/billing/cancel')
        .send({});

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // PAYMENTS
  // ========================================
  describe('GET /api/billing/payments', () => {
    it('should return payment history', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { id: 1, amount: 29, status: 'succeeded' },
            { id: 2, amount: 29, status: 'succeeded' }
          ]
        })
        .mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const res = await request(app).get('/api/billing/payments');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should handle pagination', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });

      const res = await request(app).get('/api/billing/payments?page=3&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(3);
      expect(res.body.pagination.total).toBe(50);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/payments');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // INVOICES
  // ========================================
  describe('GET /api/billing/invoices', () => {
    it('should return invoices', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, amount: 29, status: 'paid' },
          { id: 2, amount: 29, status: 'paid' }
        ]
      });

      const res = await request(app).get('/api/billing/invoices');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/invoices');

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/billing/invoices/:id', () => {
    it('should return single invoice', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, amount: 29, status: 'paid' }]
      });

      const res = await request(app).get('/api/billing/invoices/1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(1);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/billing/invoices/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/invoices/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // USAGE
  // ========================================
  describe('GET /api/billing/usage', () => {
    it('should return usage data', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { metric: 'messages', total: '1000' },
            { metric: 'bots', total: '5' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{ features: { messages_limit: 5000, bots_limit: 10 } }]
        });

      const res = await request(app).get('/api/billing/usage');

      expect(res.status).toBe(200);
      expect(res.body.data.usage.messages).toBe(1000);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/usage');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // PAYMENT METHODS
  // ========================================
  describe('POST /api/billing/payment-methods', () => {
    it('should add payment method', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, stripe_payment_method_id: 'pm_test' }]
      });

      const res = await request(app)
        .post('/api/billing/payment-methods')
        .send({ stripe_payment_method_id: 'pm_test' });

      expect(res.status).toBe(201);
    });

    it('should return 400 if payment_method_id is missing', async () => {
      const res = await request(app)
        .post('/api/billing/payment-methods')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should set as default', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1 }) // Unset other defaults
        .mockResolvedValueOnce({ rows: [{ id: 1, is_default: true }] });

      const res = await request(app)
        .post('/api/billing/payment-methods')
        .send({ stripe_payment_method_id: 'pm_test', is_default: true });

      expect(res.status).toBe(201);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/billing/payment-methods')
        .send({ stripe_payment_method_id: 'pm_test' });

      expect(res.status).toBe(500);
    });
  });

  describe('GET /api/billing/payment-methods', () => {
    it('should return payment methods', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, last4: '4242', is_default: true },
          { id: 2, last4: '5555', is_default: false }
        ]
      });

      const res = await request(app).get('/api/billing/payment-methods');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).get('/api/billing/payment-methods');

      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/billing/payment-methods/:id', () => {
    it('should delete payment method', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app).delete('/api/billing/payment-methods/1');

      expect(res.status).toBe(200);
    });

    it('should return 404 if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/billing/payment-methods/999');

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app).delete('/api/billing/payment-methods/1');

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // CHECKOUT SESSION
  // ========================================
  describe('POST /api/billing/create-checkout-session', () => {
    it('should create checkout session', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 2, name: 'Pro' }] });

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ plan_id: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.session_id).toBeDefined();
      expect(res.body.data.url).toBeDefined();
    });

    it('should return 400 if plan_id is missing', async () => {
      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 if plan not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ plan_id: 999 });

      expect(res.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/billing/create-checkout-session')
        .send({ plan_id: 2 });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // BILLING PORTAL
  // ========================================
  describe('GET /api/billing/portal', () => {
    it('should return billing portal URL', async () => {
      const res = await request(app).get('/api/billing/portal');

      expect(res.status).toBe(200);
      expect(res.body.data.url).toBeDefined();
    });
  });
});
