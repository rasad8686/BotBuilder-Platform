/**
 * RecoveryService Tests
 * Tests for the AI Revenue Recovery Engine
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const RecoveryService = require('../../../services/recoveryEngine/RecoveryService');

describe('RecoveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCampaign', () => {
    it('should create a recovery campaign with minimal data', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        org_id: 1,
        name: 'Cart Recovery',
        campaign_type: 'cart_abandonment',
        status: 'draft'
      };

      db.query.mockResolvedValue({ rows: [mockCampaign] });

      const result = await RecoveryService.createCampaign(1, {
        name: 'Cart Recovery',
        campaign_type: 'cart_abandonment',
        created_by: 'user-1'
      });

      expect(result.id).toBe('campaign-1');
      expect(result.status).toBe('draft');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recovery_campaigns'),
        expect.any(Array)
      );
    });

    it('should create a campaign with full options', async () => {
      const mockCampaign = {
        id: 'campaign-2',
        org_id: 1,
        name: 'Full Recovery Campaign',
        campaign_type: 'churn_prevention',
        ai_enabled: true,
        incentive_enabled: true
      };

      db.query.mockResolvedValue({ rows: [mockCampaign] });

      const result = await RecoveryService.createCampaign(1, {
        name: 'Full Recovery Campaign',
        description: 'Comprehensive campaign',
        campaign_type: 'churn_prevention',
        bot_id: 'bot-1',
        target_rules: { min_value: 50 },
        message_templates: [{ subject: 'Come back!' }],
        ai_enabled: true,
        ai_personalization: true,
        ai_optimal_timing: true,
        ai_model: 'gpt-4',
        incentive_enabled: true,
        incentive_type: 'percentage',
        incentive_value: 10,
        channels: ['email', 'sms'],
        max_messages_per_customer: 5,
        cooldown_hours: 48,
        created_by: 'user-1'
      });

      expect(result.id).toBe('campaign-2');
    });

    it('should throw error for invalid campaign type', async () => {
      await expect(RecoveryService.createCampaign(1, {
        name: 'Test',
        campaign_type: 'invalid_type',
        created_by: 'user-1'
      })).rejects.toThrow('Invalid campaign type');
    });

    it('should accept all valid campaign types', async () => {
      const validTypes = [
        'cart_abandonment', 'churn_prevention', 'winback',
        'upsell', 'renewal_reminder', 'payment_failed',
        'inactive_user', 'trial_expiring', 'custom'
      ];

      db.query.mockResolvedValue({ rows: [{ id: 'test' }] });

      for (const type of validTypes) {
        await RecoveryService.createCampaign(1, {
          name: 'Test',
          campaign_type: type,
          created_by: 'user-1'
        });
      }

      expect(db.query).toHaveBeenCalledTimes(validTypes.length);
    });
  });

  describe('getCampaigns', () => {
    it('should get campaigns for an organization', async () => {
      const mockCampaigns = [
        { id: 'c1', name: 'Campaign 1' },
        { id: 'c2', name: 'Campaign 2' }
      ];

      db.query.mockResolvedValueOnce({ rows: mockCampaigns })
        .mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await RecoveryService.getCampaigns(1);

      expect(result.campaigns).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await RecoveryService.getCampaigns(1, { status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        expect.arrayContaining([1, 'active'])
      );
    });

    it('should filter by campaign_type', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await RecoveryService.getCampaigns(1, { campaign_type: 'cart_abandonment' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND campaign_type'),
        expect.arrayContaining(['cart_abandonment'])
      );
    });

    it('should filter by bot_id', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await RecoveryService.getCampaigns(1, { bot_id: 'bot-1' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND bot_id'),
        expect.arrayContaining(['bot-1'])
      );
    });

    it('should apply pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await RecoveryService.getCampaigns(1, { limit: 10, offset: 20 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });
  });

  describe('updateCampaign', () => {
    it('should update campaign fields', async () => {
      const mockCampaign = {
        id: 'campaign-1',
        name: 'Updated Name',
        status: 'active'
      };

      db.query.mockResolvedValue({ rows: [mockCampaign] });

      const result = await RecoveryService.updateCampaign('campaign-1', {
        name: 'Updated Name',
        status: 'active'
      });

      expect(result.name).toBe('Updated Name');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE recovery_campaigns'),
        expect.any(Array)
      );
    });

    it('should throw error when no valid fields', async () => {
      await expect(RecoveryService.updateCampaign('campaign-1', {
        invalid_field: 'value'
      })).rejects.toThrow('No valid fields to update');
    });

    it('should throw error when campaign not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(RecoveryService.updateCampaign('nonexistent', {
        name: 'Test'
      })).rejects.toThrow('Campaign not found');
    });

    it('should serialize JSON fields', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'c1' }] });

      await RecoveryService.updateCampaign('campaign-1', {
        target_rules: { min_value: 100 },
        message_templates: [{ subject: 'Test' }],
        channels: ['email', 'sms']
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          JSON.stringify({ min_value: 100 }),
          JSON.stringify([{ subject: 'Test' }]),
          JSON.stringify(['email', 'sms'])
        ])
      );
    });
  });

  describe('deleteCampaign', () => {
    it('should delete a campaign', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'campaign-1' }] });

      const result = await RecoveryService.deleteCampaign('campaign-1');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM recovery_campaigns'),
        ['campaign-1']
      );
    });

    it('should throw error when campaign not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(RecoveryService.deleteCampaign('nonexistent'))
        .rejects.toThrow('Campaign not found');
    });
  });

  describe('trackEvent', () => {
    it('should track a valid event', async () => {
      const mockEvent = {
        id: 'event-1',
        org_id: 1,
        event_type: 'cart_abandoned',
        customer_id: 'cust-1'
      };

      db.query.mockResolvedValueOnce({ rows: [mockEvent] })
        .mockResolvedValue({ rows: [] });

      const result = await RecoveryService.trackEvent(1, 'cart_abandoned', {
        customer_id: 'cust-1',
        customer_email: 'test@example.com',
        potential_value: 100,
        currency: 'USD'
      });

      expect(result.id).toBe('event-1');
    });

    it('should throw error for invalid event type', async () => {
      await expect(RecoveryService.trackEvent(1, 'invalid_event', {
        customer_id: 'cust-1'
      })).rejects.toThrow('Invalid event type');
    });

    it('should throw error when customer_id missing', async () => {
      await expect(RecoveryService.trackEvent(1, 'cart_abandoned', {}))
        .rejects.toThrow('customer_id is required');
    });

    it('should accept all valid event types', async () => {
      const validTypes = [
        'cart_abandoned', 'purchase_completed', 'churn_risk',
        'inactivity', 'payment_failed', 'negative_sentiment'
      ];

      db.query.mockResolvedValue({ rows: [{ id: 'test', org_id: 1 }] });

      for (const type of validTypes) {
        await RecoveryService.trackEvent(1, type, { customer_id: 'cust-1' });
      }

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('processEvent', () => {
    it('should process event and match to campaign', async () => {
      const mockEvent = {
        id: 'event-1',
        org_id: 1,
        event_type: 'cart_abandoned'
      };

      const mockCampaign = {
        id: 'campaign-1',
        name: 'Cart Recovery'
      };

      db.query.mockResolvedValueOnce({ rows: [] }) // Update to processing
        .mockResolvedValueOnce({ rows: [mockCampaign] }) // Find campaign
        .mockResolvedValueOnce({ rows: [] }); // Link to campaign

      const result = await RecoveryService.processEvent(mockEvent);

      expect(result.processed).toBe(true);
      expect(result.action).toBe('matched');
      expect(result.campaignId).toBe('campaign-1');
    });

    it('should ignore purchase_completed events', async () => {
      const mockEvent = {
        id: 'event-1',
        org_id: 1,
        event_type: 'purchase_completed'
      };

      db.query.mockResolvedValue({ rows: [] });

      const result = await RecoveryService.processEvent(mockEvent);

      expect(result.action).toBe('ignored');
    });

    it('should handle no matching campaign', async () => {
      const mockEvent = {
        id: 'event-1',
        org_id: 1,
        event_type: 'cart_abandoned'
      };

      db.query.mockResolvedValueOnce({ rows: [] }) // Update to processing
        .mockResolvedValueOnce({ rows: [] }) // No campaign found
        .mockResolvedValueOnce({ rows: [] }); // Update back to pending

      const result = await RecoveryService.processEvent(mockEvent);

      expect(result.action).toBe('no_campaign');
    });
  });

  describe('getCustomerHealthScore', () => {
    it('should get customer health score', async () => {
      const mockScore = {
        id: 'score-1',
        customer_id: 'cust-1',
        health_score: 75,
        churn_probability: 0.25
      };

      db.query.mockResolvedValueOnce({ rows: [mockScore] })
        .mockResolvedValueOnce({ rows: [] }); // History

      const result = await RecoveryService.getCustomerHealthScore('cust-1');

      expect(result.health_score).toBe(75);
      expect(result.history).toBeDefined();
    });

    it('should return null when not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await RecoveryService.getCustomerHealthScore('nonexistent');

      expect(result).toBeNull();
    });

    it('should filter by org_id when provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await RecoveryService.getCustomerHealthScore('cust-1', 1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND org_id = $2'),
        ['cust-1', 1]
      );
    });
  });

  describe('getAnalytics', () => {
    it('should get recovery analytics', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }) // Timeline
        .mockResolvedValueOnce({ rows: [{ // Summary
          total_recovered: '10',
          total_events: '100',
          total_revenue_recovered: '1000.00',
          total_revenue_at_risk: '10000.00',
          avg_recovery_value: '100.00'
        }] })
        .mockResolvedValueOnce({ rows: [] }) // Campaign stats
        .mockResolvedValueOnce({ rows: [] }); // Events by type

      const result = await RecoveryService.getAnalytics(1);

      expect(result.summary).toBeDefined();
      expect(result.summary.total_events).toBe(100);
      expect(result.summary.recovery_rate).toBeDefined();
      expect(result.date_range).toBeDefined();
    });

    it('should filter by campaign_id', async () => {
      db.query.mockResolvedValue({
        rows: [{
          total_recovered: '0',
          total_events: '0',
          total_revenue_recovered: '0',
          total_revenue_at_risk: '0',
          avg_recovery_value: '0'
        }]
      });

      await RecoveryService.getAnalytics(1, { campaign_id: 'campaign-1' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND campaign_id'),
        expect.arrayContaining(['campaign-1'])
      );
    });

    it('should calculate recovery rate', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '25',
            total_events: '100',
            total_revenue_recovered: '2500.00',
            total_revenue_at_risk: '10000.00',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryService.getAnalytics(1);

      expect(result.summary.recovery_rate).toBe('25.00');
    });
  });
});
