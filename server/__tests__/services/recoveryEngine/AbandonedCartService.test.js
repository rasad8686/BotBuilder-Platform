/**
 * AbandonedCartService Tests
 * Tests for abandoned cart recovery functionality
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

jest.mock('../../../services/recoveryEngine/RecoveryService', () => ({
  trackEvent: jest.fn()
}));

const db = require('../../../db');
const RecoveryService = require('../../../services/recoveryEngine/RecoveryService');
const AbandonedCartService = require('../../../services/recoveryEngine/AbandonedCartService');

describe('AbandonedCartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectAbandonedCart', () => {
    it('should detect abandoned cart after threshold', async () => {
      const thirtyMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);

      db.query.mockResolvedValue({ rows: [] }); // No existing event
      RecoveryService.trackEvent.mockResolvedValue({
        id: 'event-1',
        event_type: 'cart_abandoned'
      });

      const result = await AbandonedCartService.detectAbandonedCart('session-1', {
        org_id: 1,
        customer_id: 'cust-1',
        cart_id: 'cart-1',
        items: [{ name: 'Product', price: 50 }],
        cart_total: 50,
        last_activity_at: thirtyMinutesAgo
      });

      expect(result.abandoned).toBe(true);
      expect(result.eventId).toBe('event-1');
      expect(RecoveryService.trackEvent).toHaveBeenCalledWith(
        1,
        'cart_abandoned',
        expect.objectContaining({
          customer_id: 'cust-1',
          potential_value: 50
        })
      );
    });

    it('should not detect cart as abandoned before threshold', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      db.query.mockResolvedValue({ rows: [] });

      const result = await AbandonedCartService.detectAbandonedCart('session-1', {
        org_id: 1,
        customer_id: 'cust-1',
        cart_id: 'cart-1',
        last_activity_at: fiveMinutesAgo
      });

      expect(result.abandoned).toBe(false);
      expect(result.minutesSinceActivity).toBeLessThan(30);
    });

    it('should return already tracked if cart exists', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 'existing-event', status: 'pending' }]
      });

      const result = await AbandonedCartService.detectAbandonedCart('session-1', {
        org_id: 1,
        customer_id: 'cust-1',
        cart_id: 'cart-1'
      });

      expect(result.alreadyTracked).toBe(true);
      expect(result.eventId).toBe('existing-event');
    });

    it('should throw error for missing required fields', async () => {
      await expect(AbandonedCartService.detectAbandonedCart('session-1', {
        customer_id: 'cust-1'
      })).rejects.toThrow('org_id, customer_id, and cart_id are required');
    });
  });

  describe('createRecoverySequence', () => {
    it('should create recovery message sequence', async () => {
      const mockEvent = {
        id: 'event-1',
        org_id: 1,
        campaign_id: 'campaign-1',
        customer_email: 'test@example.com',
        message_templates: [{ subject: 'Come back!' }],
        channels: ['email']
      };

      db.query.mockResolvedValueOnce({ rows: [mockEvent] })
        .mockResolvedValue({ rows: [{ id: 'msg-1', sequence_number: 1 }] });

      const result = await AbandonedCartService.createRecoverySequence('cart-1', 'cust-1');

      expect(result.event_id).toBe('event-1');
      expect(result.messages).toBeDefined();
      expect(result.timing).toBeDefined();
    });

    it('should throw error when event not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(AbandonedCartService.createRecoverySequence('nonexistent', 'cust-1'))
        .rejects.toThrow('Abandoned cart event not found');
    });
  });

  describe('scheduleRecoveryMessages', () => {
    it('should schedule messages with default timing', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 'msg-1', sequence_number: 1, channel: 'email' },
          { id: 'msg-2', sequence_number: 2, channel: 'email' },
          { id: 'msg-3', sequence_number: 3, channel: 'email' }
        ]
      }).mockResolvedValue({ rows: [] });

      const result = await AbandonedCartService.scheduleRecoveryMessages('event-1');

      expect(result.scheduled_messages).toHaveLength(3);
      expect(result.scheduled_messages[0].delay_hours).toBe(2);
      expect(result.scheduled_messages[1].delay_hours).toBe(24);
      expect(result.scheduled_messages[2].delay_hours).toBe(48);
    });

    it('should schedule messages with custom timing', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'msg-1', sequence_number: 1, channel: 'sms' }]
      }).mockResolvedValue({ rows: [] });

      const result = await AbandonedCartService.scheduleRecoveryMessages('event-1', [1, 6, 12]);

      expect(result.scheduled_messages[0].delay_hours).toBe(1);
    });

    it('should throw error when no pending messages', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(AbandonedCartService.scheduleRecoveryMessages('event-1'))
        .rejects.toThrow('No pending messages found');
    });
  });

  describe('calculateOptimalTiming', () => {
    it('should calculate optimal timing with engagement data', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { open_hour: 10, open_day: 2, open_count: '5' },
          { open_hour: 14, open_day: 4, open_count: '3' }
        ]
      }).mockResolvedValueOnce({ rows: [] }); // Purchase data

      const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

      expect(result.optimal_hours).toBeDefined();
      expect(result.optimal_days).toBeDefined();
      expect(result.recommended_timing).toHaveLength(3);
      expect(result.confidence).toBe('medium');
    });

    it('should return defaults with no data', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

      expect(result.confidence).toBe('low');
      expect(result.data_points).toBe(0);
    });

    it('should set high confidence with many data points', async () => {
      const manyDataPoints = Array(10).fill(null).map((_, i) => ({
        open_hour: 10 + (i % 12),
        open_day: i % 7,
        open_count: '2'
      }));

      db.query.mockResolvedValueOnce({ rows: manyDataPoints })
        .mockResolvedValueOnce({ rows: [] });

      const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

      expect(result.confidence).toBe('high');
    });
  });

  describe('generatePersonalizedOffer', () => {
    it('should generate offer for high value cart, high value customer', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 150, items: [], currency: 'USD' },
        { lifetime_value: 600, total_orders: 10 }
      );

      expect(result.offer_type).toBe('percentage_discount');
      expect(result.offer_value).toBe(15);
      expect(result.urgency).toBe('high');
    });

    it('should generate offer for new customer', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 150, items: [] },
        { total_orders: 0, lifetime_value: 0 }
      );

      expect(result.offer_type).toBe('percentage_discount');
      expect(result.offer_value).toBe(10);
      expect(result.personalization_factors.is_new_customer).toBe(true);
    });

    it('should generate free shipping for regular customer', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 120, items: [] },
        { total_orders: 3, lifetime_value: 300 }
      );

      expect(result.offer_type).toBe('free_shipping');
    });

    it('should generate higher offer for at-risk customer', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 75, items: [] },
        {
          total_orders: 5,
          last_purchase_days_ago: 90,
          recovery_history: [{ status: 'failed' }]
        }
      );

      expect(result.offer_type).toBe('percentage_discount');
      expect(result.offer_value).toBe(20);
      expect(result.urgency).toBe('critical');
    });

    it('should not offer discount for low value carts of existing customers', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 25, items: [] },
        { total_orders: 3, lifetime_value: 100 }
      );

      expect(result.offer_type).toBe('none');
    });

    it('should generate unique offer code', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 100, items: [] },
        { total_orders: 5, lifetime_value: 400 }
      );

      if (result.offer_type !== 'none') {
        expect(result.offer_code).toMatch(/^RECOVER[A-Z0-9]+$/);
      }
    });

    it('should calculate discount amount correctly', async () => {
      const result = await AbandonedCartService.generatePersonalizedOffer(
        { cart_total: 100, items: [] },
        { lifetime_value: 600, total_orders: 10 }
      );

      expect(result.discount_amount).toBe(15);
      expect(result.final_total).toBe(85);
    });
  });

  describe('trackCartRecovery', () => {
    it('should update cart to recovered status', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'event-1', status: 'recovered' }]
      }).mockResolvedValueOnce({ rows: [] }); // Cancel messages

      const result = await AbandonedCartService.trackCartRecovery('cart-1', 'recovered');

      expect(result.status).toBe('recovered');
    });

    it('should cancel pending messages on recovery', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'event-1', status: 'recovered' }]
      }).mockResolvedValueOnce({ rows: [] });

      await AbandonedCartService.trackCartRecovery('cart-1', 'recovered');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = \'cancelled\''),
        expect.any(Array)
      );
    });

    it('should throw error for invalid status', async () => {
      await expect(AbandonedCartService.trackCartRecovery('cart-1', 'invalid'))
        .rejects.toThrow('Invalid status');
    });

    it('should throw error when cart not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(AbandonedCartService.trackCartRecovery('nonexistent', 'recovered'))
        .rejects.toThrow('Cart recovery event not found');
    });

    it('should accept all valid statuses', async () => {
      const validStatuses = ['recovered', 'partially_recovered', 'failed', 'expired', 'opted_out'];

      for (const status of validStatuses) {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'event-1', status }] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.trackCartRecovery('cart-1', status);
        expect(result.status).toBe(status);
      }
    });
  });

  describe('getAbandonedCarts', () => {
    it('should get abandoned carts for organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 'e1', cart_id: 'c1', cart_total: '100' },
          { id: 'e2', cart_id: 'c2', cart_total: '50' }
        ]
      }).mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await AbandonedCartService.getAbandonedCarts(1);

      expect(result.carts).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await AbandonedCartService.getAbandonedCarts(1, { status: 'pending' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND e.status = $2'),
        expect.arrayContaining([1, 'pending'])
      );
    });

    it('should filter by value range', async () => {
      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await AbandonedCartService.getAbandonedCarts(1, { min_value: 50, max_value: 200 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('potential_value >='),
        expect.any(Array)
      );
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      db.query.mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await AbandonedCartService.getAbandonedCarts(1, { start_date: startDate, end_date: endDate });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('event_occurred_at >='),
        expect.any(Array)
      );
    });
  });

  describe('getRecoveryRate', () => {
    it('should calculate recovery rate', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_abandoned: '100',
          fully_recovered: '20',
          partially_recovered: '10',
          lost: '50',
          in_progress: '20',
          total_value_at_risk: '10000.00',
          total_value_recovered: '3000.00',
          full_recovery_value: '2000.00',
          avg_cart_value: '100.00',
          avg_recovered_value: '100.00'
        }]
      }).mockResolvedValueOnce({ rows: [] }); // Daily breakdown

      const result = await AbandonedCartService.getRecoveryRate(1);

      expect(result.summary.total_abandoned).toBe(100);
      expect(result.summary.recovery_rate).toBe(30);
      expect(result.summary.value_recovery_rate).toBe(30);
    });

    it('should handle zero events', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_abandoned: '0',
          fully_recovered: '0',
          partially_recovered: '0',
          lost: '0',
          in_progress: '0',
          total_value_at_risk: '0',
          total_value_recovered: '0',
          full_recovery_value: '0',
          avg_cart_value: '0',
          avg_recovered_value: '0'
        }]
      }).mockResolvedValueOnce({ rows: [] });

      const result = await AbandonedCartService.getRecoveryRate(1);

      expect(result.summary.recovery_rate).toBe(0);
      expect(result.summary.value_recovery_rate).toBe(0);
    });

    it('should include daily breakdown', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_abandoned: '10',
          fully_recovered: '5',
          partially_recovered: '0',
          lost: '5',
          in_progress: '0',
          total_value_at_risk: '1000',
          total_value_recovered: '500',
          full_recovery_value: '500',
          avg_cart_value: '100',
          avg_recovered_value: '100'
        }]
      }).mockResolvedValueOnce({
        rows: [
          { date: '2024-01-01', abandoned: 5, recovered: 2, value_at_risk: '500', value_recovered: '200' },
          { date: '2024-01-02', abandoned: 5, recovered: 3, value_at_risk: '500', value_recovered: '300' }
        ]
      });

      const result = await AbandonedCartService.getRecoveryRate(1);

      expect(result.daily_breakdown).toHaveLength(2);
    });
  });
});
