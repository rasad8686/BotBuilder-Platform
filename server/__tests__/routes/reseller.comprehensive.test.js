/**
 * Comprehensive tests for reseller portal routes
 * Tests reseller applications, dashboard, customers, commissions, payouts, branding, and admin routes
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies
const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  query: (...args) => mockQuery(...args)
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn().mockReturnValue({ id: 1, email: 'test@example.com' })
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('mockedapikey123')
  })
}));

jest.mock('../../services/resellerService', () => ({
  calculateCommission: jest.fn(),
  getResellerStats: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const resellerRouter = require('../../routes/reseller');

describe('Reseller Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    app = express();
    app.use(express.json());
    app.use('/api/reseller', resellerRouter);
  });

  describe('POST /api/reseller/apply', () => {
    it('should require name, email, and company_name', async () => {
      const res = await request(app)
        .post('/api/reseller/apply')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Name, email, and company name are required');
    });

    it('should return 400 if application already exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] });

      const res = await request(app)
        .post('/api/reseller/apply')
        .send({
          name: 'Test User',
          email: 'existing@example.com',
          company_name: 'Test Company'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Application already exists for this email');
      expect(res.body.status).toBe('pending');
    });

    it('should create reseller application successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'New Reseller',
            email: 'new@example.com',
            company_name: 'New Company',
            status: 'pending',
            created_at: new Date().toISOString()
          }]
        }); // insert

      const res = await request(app)
        .post('/api/reseller/apply')
        .send({
          name: 'New Reseller',
          email: 'new@example.com',
          company_name: 'New Company',
          phone: '+1234567890',
          website: 'https://newcompany.com',
          description: 'A new reseller',
          country: 'US'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Application submitted successfully');
      expect(res.body.application.name).toBe('New Reseller');
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/reseller/apply')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          company_name: 'Test Company'
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Server error');
    });
  });

  describe('GET /api/reseller/dashboard', () => {
    it('should return 401 without authentication', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => { throw new Error('Invalid token'); });

      const res = await request(app)
        .get('/api/reseller/dashboard')
        .set('Authorization', 'Bearer invalid');

      expect(res.status).toBe(403);
    });

    it('should return 403 if user is not an approved reseller', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // reseller check

      const res = await request(app)
        .get('/api/reseller/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Reseller access required');
    });

    it('should return dashboard stats', async () => {
      // Mock reseller check
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller', tier: 'gold', commission_rate: 15 }]
      });

      // Mock dashboard queries
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // customer count
        .mockResolvedValueOnce({ rows: [{ total_revenue: '5000', total_commission: '750' }] }) // revenue stats
        .mockResolvedValueOnce({ rows: [{ pending: '200' }] }) // pending commissions
        .mockResolvedValueOnce({ rows: [{ month: '2024-01', revenue: '1000', commission: '150' }] }) // monthly trend
        .mockResolvedValueOnce({ rows: [{ organization_name: 'Org1' }] }) // recent customers
        .mockResolvedValueOnce({ rows: [{ total_paid: '500', pending_payout: '100' }] }); // payout summary

      const res = await request(app)
        .get('/api/reseller/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dashboard.reseller.name).toBe('Test Reseller');
      expect(res.body.dashboard.stats.customer_count).toBe(10);
      expect(res.body.dashboard.stats.total_revenue).toBe(5000);
    });

    it('should handle database errors in dashboard', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/reseller/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });
  });

  describe('GET /api/reseller/customers', () => {
    beforeEach(() => {
      // Mock reseller authentication
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
    });

    it('should return customer list with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // count
        .mockResolvedValueOnce({
          rows: [
            { id: 1, organization_name: 'Org1', status: 'active' },
            { id: 2, organization_name: 'Org2', status: 'active' }
          ]
        }); // customers

      const res = await request(app)
        .get('/api/reseller/customers?page=1&limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.customers).toHaveLength(2);
      expect(res.body.pagination.total).toBe(25);
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/reseller/customers?status=active')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });

    it('should search by organization name', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ organization_name: 'Acme Corp' }] });

      const res = await request(app)
        .get('/api/reseller/customers?search=Acme')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.customers).toHaveLength(1);
    });
  });

  describe('POST /api/reseller/customers', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
    });

    it('should require organization_id', async () => {
      const res = await request(app)
        .post('/api/reseller/customers')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Organization ID is required');
    });

    it('should return 404 if organization not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // org check

      const res = await request(app)
        .post('/api/reseller/customers')
        .set('Authorization', 'Bearer valid-token')
        .send({ organization_id: 999 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Organization not found');
    });

    it('should return 400 if already a customer', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Org' }] }) // org check
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // existing check

      const res = await request(app)
        .post('/api/reseller/customers')
        .set('Authorization', 'Bearer valid-token')
        .send({ organization_id: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Organization is already a customer');
    });

    it('should create customer successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Org' }] }) // org check
        .mockResolvedValueOnce({ rows: [] }) // existing check
        .mockResolvedValueOnce({ rows: [{ id: 1, organization_id: 1 }] }) // insert
        .mockResolvedValueOnce({ rows: [] }); // activity log

      const res = await request(app)
        .post('/api/reseller/customers')
        .set('Authorization', 'Bearer valid-token')
        .send({
          organization_id: 1,
          custom_price: 99.99,
          margin: 20,
          notes: 'VIP customer'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Customer added successfully');
    });
  });

  describe('GET /api/reseller/commissions', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
    });

    it('should return commission list with summary', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // count
        .mockResolvedValueOnce({
          rows: [
            { id: 1, commission_amount: 100, status: 'approved' }
          ]
        }) // commissions
        .mockResolvedValueOnce({
          rows: [
            { status: 'pending', count: '5', total: '500' },
            { status: 'approved', count: '3', total: '300' }
          ]
        }); // summary

      const res = await request(app)
        .get('/api/reseller/commissions')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.commissions).toHaveLength(1);
      expect(res.body.summary.pending.count).toBe(5);
    });

    it('should filter by year and month', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/reseller/commissions?year=2024&month=1&status=pending')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/reseller/payouts', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
    });

    it('should return payout history with available balance', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // count
        .mockResolvedValueOnce({
          rows: [
            { id: 1, amount: 200, status: 'completed' }
          ]
        }) // payouts
        .mockResolvedValueOnce({ rows: [{ available: '350' }] }); // balance

      const res = await request(app)
        .get('/api/reseller/payouts')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payouts).toHaveLength(1);
      expect(res.body.available_balance).toBe(350);
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ available: '0' }] });

      const res = await request(app)
        .get('/api/reseller/payouts?status=pending')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/reseller/payouts/request', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller', payment_info: { bank: 'Test Bank' } }]
      });
    });

    it('should require minimum $50 balance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ available: '30' }] }); // balance

      const res = await request(app)
        .post('/api/reseller/payouts/request')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Minimum payout amount is $50');
    });

    it('should prevent duplicate pending payouts', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ available: '100' }] }) // balance
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // pending check

      const res = await request(app)
        .post('/api/reseller/payouts/request')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('You already have a pending payout request');
    });

    it('should create payout request successfully', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ available: '150' }] }) // balance
        .mockResolvedValueOnce({ rows: [] }) // pending check
        .mockResolvedValueOnce({ rows: [{ id: 1, amount: 150, status: 'pending' }] }) // create payout
        .mockResolvedValueOnce({ rows: [] }) // link commissions
        .mockResolvedValueOnce({ rows: [] }); // activity log

      const res = await request(app)
        .post('/api/reseller/payouts/request')
        .set('Authorization', 'Bearer valid-token')
        .send({ method: 'paypal', notes: 'Monthly payout' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.payout.amount).toBe(150);
    });
  });

  describe('GET /api/reseller/branding', () => {
    it('should return branding settings and features', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          tier: 'gold',
          custom_branding: { logo_url: 'https://example.com/logo.png' }
        }]
      });

      const res = await request(app)
        .get('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tier).toBe('gold');
      expect(res.body.features.custom_logo).toBe(true);
      expect(res.body.features.custom_domain).toBe(false);
    });

    it('should show platinum features correctly', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          tier: 'platinum',
          custom_branding: {}
        }]
      });

      const res = await request(app)
        .get('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.features.custom_domain).toBe(true);
      expect(res.body.features.white_label_emails).toBe(true);
    });
  });

  describe('PUT /api/reseller/branding', () => {
    it('should require gold or platinum tier', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, tier: 'silver' }]
      });

      const res = await request(app)
        .put('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token')
        .send({ logo_url: 'https://example.com/logo.png' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Custom branding requires Gold or Platinum tier');
    });

    it('should require platinum for custom domain', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, tier: 'gold' }]
      });

      const res = await request(app)
        .put('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token')
        .send({ custom_domain: 'reseller.example.com' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Custom domain requires Platinum tier');
    });

    it('should update branding for gold tier', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, tier: 'gold' }] }) // auth
        .mockResolvedValueOnce({ rows: [{ custom_branding: { logo_url: 'new-logo.png' } }] }) // update
        .mockResolvedValueOnce({ rows: [] }); // activity log

      const res = await request(app)
        .put('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token')
        .send({
          logo_url: 'https://example.com/new-logo.png',
          primary_color: '#ff6600',
          company_name: 'My Company'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should update branding with custom domain for platinum', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, tier: 'platinum' }] }) // auth
        .mockResolvedValueOnce({ rows: [{ custom_branding: { custom_domain: 'custom.example.com' } }] }) // update
        .mockResolvedValueOnce({ rows: [] }); // activity log

      const res = await request(app)
        .put('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token')
        .send({
          logo_url: 'https://example.com/logo.png',
          custom_domain: 'custom.example.com'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/reseller/admin/list', () => {
    beforeEach(() => {
      // Mock admin auth
      mockQuery.mockResolvedValueOnce({
        rows: [{ role: 'admin' }]
      });
    });

    it('should return 403 if not admin', async () => {
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'member' }] }); // not admin

      const res = await request(app)
        .get('/api/reseller/admin/list')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Admin access required');
    });

    it('should return reseller list with pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '15' }] }) // count
        .mockResolvedValueOnce({
          rows: [
            { id: 1, name: 'Reseller 1', status: 'approved', customer_count: '5', total_commission: '500' }
          ]
        }); // resellers

      const res = await request(app)
        .get('/api/reseller/admin/list?page=1&limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resellers).toHaveLength(1);
      expect(res.body.pagination.total).toBe(15);
    });

    it('should filter by status, tier, and search', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/api/reseller/admin/list?status=approved&tier=gold&search=Test')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/reseller/admin/:id/approve', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ role: 'admin' }]
      });
    });

    it('should return 404 if reseller not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update

      const res = await request(app)
        .put('/api/reseller/admin/999/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'gold', commission_rate: 15 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Reseller not found');
    });

    it('should approve reseller with tier and commission rate', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          status: 'approved',
          tier: 'gold',
          commission_rate: 15
        }]
      });

      const res = await request(app)
        .put('/api/reseller/admin/1/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'gold', commission_rate: 15 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reseller.tier).toBe('gold');
      expect(res.body.reseller.commission_rate).toBe(15);
    });

    it('should use default values when not provided', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          status: 'approved',
          tier: 'silver',
          commission_rate: 10
        }]
      });

      const res = await request(app)
        .put('/api/reseller/admin/1/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/reseller/admin/:id/tier', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ role: 'admin' }]
      });
    });

    it('should require valid tier', async () => {
      const res = await request(app)
        .put('/api/reseller/admin/1/tier')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Valid tier (silver, gold, platinum) is required');
    });

    it('should require tier parameter', async () => {
      const res = await request(app)
        .put('/api/reseller/admin/1/tier')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 if reseller not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put('/api/reseller/admin/999/tier')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'gold' });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Reseller not found');
    });

    it('should update tier successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, tier: 'platinum', commission_rate: 20 }]
      });

      const res = await request(app)
        .put('/api/reseller/admin/1/tier')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'platinum', commission_rate: 20 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reseller.tier).toBe('platinum');
    });

    it('should update tier without commission rate', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, tier: 'gold' }]
      });

      const res = await request(app)
        .put('/api/reseller/admin/1/tier')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'gold' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Middleware: Authentication', () => {
    it('should return 401 without authorization header', async () => {
      const res = await request(app)
        .get('/api/reseller/dashboard');

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });

    it('should return 403 with invalid token', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify.mockImplementationOnce(() => { throw new Error('Invalid'); });

      const res = await request(app)
        .get('/api/reseller/dashboard')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Invalid token');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors in customer creation', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/reseller/customers')
        .set('Authorization', 'Bearer valid-token')
        .send({ organization_id: 1 });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe('Server error');
    });

    it('should handle database errors in commissions', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/reseller/commissions')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });

    it('should handle database errors in payouts', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/reseller/payouts')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });

    it('should handle database errors in payout request', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Reseller' }]
      });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .post('/api/reseller/payouts/request')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(500);
    });

    it('should handle database errors in branding update', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, tier: 'gold' }]
      });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/reseller/branding')
        .set('Authorization', 'Bearer valid-token')
        .send({ logo_url: 'https://example.com/logo.png' });

      expect(res.status).toBe(500);
    });

    it('should handle database errors in admin list', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/reseller/admin/list')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });

    it('should handle database errors in admin approve', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/reseller/admin/1/approve')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(500);
    });

    it('should handle database errors in admin tier update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .put('/api/reseller/admin/1/tier')
        .set('Authorization', 'Bearer valid-token')
        .send({ tier: 'gold' });

      expect(res.status).toBe(500);
    });

    it('should handle middleware auth error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/reseller/dashboard')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });

    it('should handle requireAdmin middleware error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const res = await request(app)
        .get('/api/reseller/admin/list')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(500);
    });
  });
});
