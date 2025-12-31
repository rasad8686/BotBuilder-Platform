/**
 * Recovery Engine API Routes Tests
 * Tests for AI Revenue Recovery Engine endpoints
 */

const express = require('express');
const request = require('supertest');

// Mock dependencies
jest.mock('../../middleware/auth', () => jest.fn((req, res, next) => {
  req.user = { id: 'user-1', name: 'Test User', current_organization_id: 'org-1' };
  next();
}));

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: jest.fn((req, res, next) => {
    req.organization = { id: 'org-1', name: 'Test Org' };
    next();
  })
}));

jest.mock('../../services/recoveryEngine/RecoveryService', () => ({
  getCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  getCustomerHealthScore: jest.fn()
}));

jest.mock('../../services/recoveryEngine/AbandonedCartService', () => ({
  getAbandonedCarts: jest.fn(),
  detectAbandonedCart: jest.fn(),
  createRecoverySequence: jest.fn(),
  calculateOptimalTiming: jest.fn(),
  scheduleRecoveryMessages: jest.fn()
}));

jest.mock('../../services/recoveryEngine/ChurnPredictionService', () => ({
  calculateHealthScore: jest.fn(),
  getAtRiskCustomers: jest.fn()
}));

jest.mock('../../services/recoveryEngine/RecoveryAnalyticsService', () => ({
  getDashboardStats: jest.fn(),
  getRevenueRecovered: jest.fn(),
  getRecoveryRateByChannel: jest.fn(),
  generateReport: jest.fn()
}));

jest.mock('../../services/recoveryEngine/RecoveryMessagingService', () => ({
  getMessageStats: jest.fn()
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const RecoveryService = require('../../services/recoveryEngine/RecoveryService');
const AbandonedCartService = require('../../services/recoveryEngine/AbandonedCartService');
const ChurnPredictionService = require('../../services/recoveryEngine/ChurnPredictionService');
const RecoveryAnalyticsService = require('../../services/recoveryEngine/RecoveryAnalyticsService');
const RecoveryMessagingService = require('../../services/recoveryEngine/RecoveryMessagingService');
const db = require('../../db');
const recoveryRouter = require('../../routes/recovery');

describe('Recovery Engine API Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/recovery', recoveryRouter);

    // Default: tables exist
    db.query.mockResolvedValue({ rows: [{ exists: true }] });
  });

  describe('Campaigns Endpoints', () => {
    describe('GET /api/recovery/campaigns', () => {
      it('should return campaigns list', async () => {
        const mockCampaigns = {
          campaigns: [
            { id: 'camp-1', name: 'Cart Recovery', status: 'active' },
            { id: 'camp-2', name: 'Win Back', status: 'paused' }
          ],
          total: 2
        };
        RecoveryService.getCampaigns.mockResolvedValue(mockCampaigns);

        const response = await request(app).get('/api/recovery/campaigns');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.campaigns).toEqual(mockCampaigns.campaigns);
      });

      it('should return empty list when table does not exist', async () => {
        db.query.mockResolvedValue({ rows: [{ exists: false }] });

        const response = await request(app).get('/api/recovery/campaigns');

        expect(response.status).toBe(200);
        expect(response.body.campaigns).toEqual([]);
        expect(response.body.total).toBe(0);
      });

      it('should apply filters', async () => {
        RecoveryService.getCampaigns.mockResolvedValue({ campaigns: [], total: 0 });

        await request(app).get('/api/recovery/campaigns?status=active&campaign_type=cart&bot_id=bot-1&limit=10&offset=5');

        expect(RecoveryService.getCampaigns).toHaveBeenCalledWith('org-1', {
          status: 'active',
          campaign_type: 'cart',
          bot_id: 'bot-1',
          limit: 10,
          offset: 5
        });
      });

      it('should handle errors', async () => {
        RecoveryService.getCampaigns.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/campaigns');

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
      });
    });

    describe('POST /api/recovery/campaigns', () => {
      it('should create a new campaign', async () => {
        const campaignData = { name: 'New Campaign', campaign_type: 'cart_recovery' };
        const createdCampaign = { id: 'camp-new', ...campaignData };
        RecoveryService.createCampaign.mockResolvedValue(createdCampaign);

        const response = await request(app)
          .post('/api/recovery/campaigns')
          .send(campaignData);

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.campaign).toEqual(createdCampaign);
      });

      it('should handle creation errors', async () => {
        RecoveryService.createCampaign.mockRejectedValue(new Error('Invalid data'));

        const response = await request(app)
          .post('/api/recovery/campaigns')
          .send({ name: '' });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/recovery/campaigns/:id', () => {
      it('should return single campaign', async () => {
        const campaign = { id: 'camp-1', name: 'Cart Recovery', status: 'active' };
        db.query.mockResolvedValue({ rows: [campaign] });

        const response = await request(app).get('/api/recovery/campaigns/camp-1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.campaign).toEqual(campaign);
      });

      it('should return 404 for non-existent campaign', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/api/recovery/campaigns/non-existent');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Campaign not found');
      });

      it('should handle errors', async () => {
        db.query.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/campaigns/camp-1');

        expect(response.status).toBe(500);
      });
    });

    describe('PUT /api/recovery/campaigns/:id', () => {
      it('should update campaign', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'camp-1' }] });
        RecoveryService.updateCampaign.mockResolvedValue({ id: 'camp-1', name: 'Updated' });

        const response = await request(app)
          .put('/api/recovery/campaigns/camp-1')
          .send({ name: 'Updated' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return 404 for non-existent campaign', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .put('/api/recovery/campaigns/non-existent')
          .send({ name: 'Test' });

        expect(response.status).toBe(404);
      });

      it('should handle update errors', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'camp-1' }] });
        RecoveryService.updateCampaign.mockRejectedValue(new Error('Update failed'));

        const response = await request(app)
          .put('/api/recovery/campaigns/camp-1')
          .send({ name: 'Test' });

        expect(response.status).toBe(400);
      });
    });

    describe('DELETE /api/recovery/campaigns/:id', () => {
      it('should delete campaign', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'camp-1' }] });
        RecoveryService.deleteCampaign.mockResolvedValue(true);

        const response = await request(app).delete('/api/recovery/campaigns/camp-1');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Campaign deleted successfully');
      });

      it('should return 404 for non-existent campaign', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).delete('/api/recovery/campaigns/non-existent');

        expect(response.status).toBe(404);
      });

      it('should handle delete errors', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'camp-1' }] });
        RecoveryService.deleteCampaign.mockRejectedValue(new Error('Delete failed'));

        const response = await request(app).delete('/api/recovery/campaigns/camp-1');

        expect(response.status).toBe(500);
      });
    });
  });

  describe('Abandoned Carts Endpoints', () => {
    describe('GET /api/recovery/carts', () => {
      it('should return abandoned carts', async () => {
        const mockCarts = {
          carts: [{ id: 'cart-1', value: 99.99, status: 'abandoned' }],
          total: 1
        };
        AbandonedCartService.getAbandonedCarts.mockResolvedValue(mockCarts);

        const response = await request(app).get('/api/recovery/carts');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should return empty list when table does not exist', async () => {
        db.query.mockResolvedValue({ rows: [{ exists: false }] });

        const response = await request(app).get('/api/recovery/carts');

        expect(response.status).toBe(200);
        expect(response.body.carts).toEqual([]);
      });

      it('should apply filters', async () => {
        AbandonedCartService.getAbandonedCarts.mockResolvedValue({ carts: [], total: 0 });

        await request(app).get('/api/recovery/carts?status=pending&min_value=50&max_value=200&start_date=2024-01-01&end_date=2024-12-31');

        expect(AbandonedCartService.getAbandonedCarts).toHaveBeenCalledWith('org-1', expect.objectContaining({
          status: 'pending',
          min_value: 50,
          max_value: 200
        }));
      });

      it('should handle errors', async () => {
        AbandonedCartService.getAbandonedCarts.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/carts');

        expect(response.status).toBe(500);
      });
    });

    describe('POST /api/recovery/carts/detect', () => {
      it('should detect abandoned cart', async () => {
        const result = { detected: true, cart_id: 'cart-1' };
        AbandonedCartService.detectAbandonedCart.mockResolvedValue(result);

        const response = await request(app)
          .post('/api/recovery/carts/detect')
          .send({ session_id: 'sess-1', items: [{ sku: 'PROD-1', qty: 1 }] });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle detection errors', async () => {
        AbandonedCartService.detectAbandonedCart.mockRejectedValue(new Error('Detection failed'));

        const response = await request(app)
          .post('/api/recovery/carts/detect')
          .send({ session_id: 'sess-1' });

        expect(response.status).toBe(400);
      });
    });

    describe('POST /api/recovery/carts/:id/recover', () => {
      it('should start cart recovery', async () => {
        const sequence = { event_id: 'event-1', steps: 3 };
        const timing = { recommended_timing: [1, 24, 72] };
        const scheduled = { messages: 3 };

        AbandonedCartService.createRecoverySequence.mockResolvedValue(sequence);
        AbandonedCartService.calculateOptimalTiming.mockResolvedValue(timing);
        AbandonedCartService.scheduleRecoveryMessages.mockResolvedValue(scheduled);

        const response = await request(app)
          .post('/api/recovery/carts/cart-1/recover')
          .send({ customer_id: 'cust-1' });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.sequence).toBeDefined();
        expect(response.body.timing).toBeDefined();
        expect(response.body.scheduled).toBeDefined();
      });

      it('should handle recovery errors', async () => {
        AbandonedCartService.createRecoverySequence.mockRejectedValue(new Error('Recovery failed'));

        const response = await request(app)
          .post('/api/recovery/carts/cart-1/recover')
          .send({ customer_id: 'cust-1' });

        expect(response.status).toBe(400);
      });
    });
  });

  describe('Customer Health Endpoints', () => {
    describe('GET /api/recovery/customers/health', () => {
      it('should return customer health scores', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ exists: true }] })
          .mockResolvedValueOnce({ rows: [{ customer_id: 'cust-1', health_score: 85 }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const response = await request(app).get('/api/recovery/customers/health');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.customers).toBeDefined();
      });

      it('should return empty list when table does not exist', async () => {
        db.query.mockResolvedValue({ rows: [{ exists: false }] });

        const response = await request(app).get('/api/recovery/customers/health');

        expect(response.status).toBe(200);
        expect(response.body.customers).toEqual([]);
      });

      it('should filter by risk level', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ exists: true }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await request(app).get('/api/recovery/customers/health?risk_level=high');

        expect(db.query).toHaveBeenCalledTimes(3);
      });

      it('should handle errors', async () => {
        db.query.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/customers/health');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/recovery/customers/:id/health', () => {
      it('should return single customer health score', async () => {
        RecoveryService.getCustomerHealthScore.mockResolvedValue({ health_score: 90 });

        const response = await request(app).get('/api/recovery/customers/cust-1/health');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.health).toBeDefined();
      });

      it('should recalculate health score when requested', async () => {
        ChurnPredictionService.calculateHealthScore.mockResolvedValue({ health_score: 85 });

        const response = await request(app).get('/api/recovery/customers/cust-1/health?recalculate=true');

        expect(response.status).toBe(200);
        expect(ChurnPredictionService.calculateHealthScore).toHaveBeenCalled();
      });

      it('should calculate if no existing score', async () => {
        RecoveryService.getCustomerHealthScore.mockResolvedValue(null);
        ChurnPredictionService.calculateHealthScore.mockResolvedValue({ health_score: 80 });

        const response = await request(app).get('/api/recovery/customers/cust-1/health');

        expect(response.status).toBe(200);
        expect(ChurnPredictionService.calculateHealthScore).toHaveBeenCalled();
      });

      it('should return 404 if score not found', async () => {
        RecoveryService.getCustomerHealthScore.mockResolvedValue(null);
        ChurnPredictionService.calculateHealthScore.mockResolvedValue(null);

        const response = await request(app).get('/api/recovery/customers/cust-1/health');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Customer health score not found');
      });

      it('should handle errors', async () => {
        RecoveryService.getCustomerHealthScore.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/customers/cust-1/health');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/recovery/customers/at-risk', () => {
      it('should return at-risk customers', async () => {
        const result = { customers: [{ id: 'cust-1', churn_probability: 0.8 }], total: 1 };
        ChurnPredictionService.getAtRiskCustomers.mockResolvedValue(result);

        const response = await request(app).get('/api/recovery/customers/at-risk');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should apply threshold', async () => {
        ChurnPredictionService.getAtRiskCustomers.mockResolvedValue({ customers: [], total: 0 });

        await request(app).get('/api/recovery/customers/at-risk?threshold=0.7');

        expect(ChurnPredictionService.getAtRiskCustomers).toHaveBeenCalledWith('org-1', 0.7);
      });

      it('should handle errors', async () => {
        ChurnPredictionService.getAtRiskCustomers.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/customers/at-risk');

        expect(response.status).toBe(500);
      });
    });
  });

  describe('Analytics Endpoints', () => {
    describe('GET /api/recovery/analytics/dashboard', () => {
      it('should return dashboard stats', async () => {
        const stats = {
          total_recovered: 5000,
          recovery_rate: 25.5,
          abandoned_carts: 100,
          at_risk_customers: 15,
          active_campaigns: 3
        };
        RecoveryAnalyticsService.getDashboardStats.mockResolvedValue(stats);

        const response = await request(app).get('/api/recovery/analytics/dashboard');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.total_recovered).toBe(5000);
      });

      it('should return empty stats when table does not exist', async () => {
        db.query.mockResolvedValue({ rows: [{ exists: false }] });

        const response = await request(app).get('/api/recovery/analytics/dashboard');

        expect(response.status).toBe(200);
        expect(response.body.total_recovered).toBe(0);
      });

      it('should handle errors', async () => {
        RecoveryAnalyticsService.getDashboardStats.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/analytics/dashboard');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/recovery/analytics/revenue', () => {
      it('should return revenue analytics', async () => {
        const revenue = { total: 10000, by_period: [] };
        RecoveryAnalyticsService.getRevenueRecovered.mockResolvedValue(revenue);

        const response = await request(app).get('/api/recovery/analytics/revenue');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should apply date filters', async () => {
        RecoveryAnalyticsService.getRevenueRecovered.mockResolvedValue({ total: 0 });

        await request(app).get('/api/recovery/analytics/revenue?start_date=2024-01-01&end_date=2024-12-31');

        expect(RecoveryAnalyticsService.getRevenueRecovered).toHaveBeenCalledWith('org-1', expect.objectContaining({
          start_date: expect.any(Date),
          end_date: expect.any(Date)
        }));
      });

      it('should handle errors', async () => {
        RecoveryAnalyticsService.getRevenueRecovered.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/analytics/revenue');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/recovery/analytics/channels', () => {
      it('should return channel performance', async () => {
        const channels = {
          email: { recovery_rate: 20 },
          sms: { recovery_rate: 35 }
        };
        RecoveryAnalyticsService.getRecoveryRateByChannel.mockResolvedValue(channels);

        const response = await request(app).get('/api/recovery/analytics/channels');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      it('should handle errors', async () => {
        RecoveryAnalyticsService.getRecoveryRateByChannel.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/analytics/channels');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/recovery/analytics/report', () => {
      it('should generate JSON report', async () => {
        const report = { data: [], generated_at: new Date().toISOString() };
        RecoveryAnalyticsService.generateReport.mockResolvedValue(report);

        const response = await request(app).get('/api/recovery/analytics/report');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.report).toBeDefined();
      });

      it('should generate CSV report', async () => {
        const report = { filename: 'report.csv', content: 'col1,col2\nval1,val2' };
        RecoveryAnalyticsService.generateReport.mockResolvedValue(report);

        const response = await request(app).get('/api/recovery/analytics/report?format=csv');

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('text/csv');
      });

      it('should apply date filters', async () => {
        RecoveryAnalyticsService.generateReport.mockResolvedValue({ data: [] });

        await request(app).get('/api/recovery/analytics/report?start_date=2024-01-01&end_date=2024-12-31&format=json');

        expect(RecoveryAnalyticsService.generateReport).toHaveBeenCalledWith(
          'org-1',
          expect.objectContaining({
            start_date: expect.any(Date),
            end_date: expect.any(Date)
          }),
          'json'
        );
      });

      it('should handle errors', async () => {
        RecoveryAnalyticsService.generateReport.mockRejectedValue(new Error('Report generation failed'));

        const response = await request(app).get('/api/recovery/analytics/report');

        expect(response.status).toBe(500);
      });
    });
  });

  describe('Messages Endpoints', () => {
    describe('GET /api/recovery/messages', () => {
      it('should return messages list', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 'msg-1', status: 'sent' }] })
          .mockResolvedValueOnce({ rows: [{ count: '1' }] });

        const response = await request(app).get('/api/recovery/messages');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.messages).toBeDefined();
      });

      it('should apply filters', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await request(app).get('/api/recovery/messages?campaign_id=camp-1&status=sent&channel=email');

        expect(db.query).toHaveBeenCalled();
      });

      it('should handle errors', async () => {
        db.query.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/messages');

        expect(response.status).toBe(500);
      });
    });

    describe('GET /api/recovery/messages/:id/stats', () => {
      it('should return message stats', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'msg-1', campaign_id: 'camp-1' }] });
        RecoveryMessagingService.getMessageStats.mockResolvedValue({ sent: 100, opened: 50 });

        const response = await request(app).get('/api/recovery/messages/msg-1/stats');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBeDefined();
        expect(response.body.campaign_stats).toBeDefined();
      });

      it('should return stats without campaign', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'msg-1', campaign_id: null }] });

        const response = await request(app).get('/api/recovery/messages/msg-1/stats');

        expect(response.status).toBe(200);
        expect(response.body.campaign_stats).toBeNull();
      });

      it('should return 404 for non-existent message', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const response = await request(app).get('/api/recovery/messages/non-existent/stats');

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Message not found');
      });

      it('should handle errors', async () => {
        db.query.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/recovery/messages/msg-1/stats');

        expect(response.status).toBe(500);
      });
    });
  });
});
