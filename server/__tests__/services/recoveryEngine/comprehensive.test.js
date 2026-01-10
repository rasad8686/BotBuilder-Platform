/**
 * Comprehensive Recovery Engine Services Tests
 *
 * Tests for all recovery engine services:
 * - AbandonedCartService
 * - ChurnPredictionService
 * - RecoveryAnalyticsService
 * - RecoveryMessagingService
 * - RecoveryService
 *
 * Includes extensive testing of:
 * - All methods in each service
 * - Database query result handling
 * - Error handling paths
 * - Edge cases (empty arrays, null values)
 * - Calculation accuracy
 * - Campaign scheduling
 * - Analytics aggregations
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../../db');
const log = require('../../../utils/logger');

// Mock nodemailer for RecoveryMessagingService
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'email-123' })
  }))
}));

// Mock fetch for external API calls
global.fetch = jest.fn();

describe('Recovery Engine Services - Comprehensive Tests', () => {
  let AbandonedCartService;
  let ChurnPredictionService;
  let RecoveryAnalyticsService;
  let RecoveryMessagingService;
  let RecoveryService;

  beforeAll(() => {
    // Mock RecoveryService for AbandonedCartService
    jest.mock('../../../services/recoveryEngine/RecoveryService', () => ({
      trackEvent: jest.fn()
    }));

    // Load services after mocks are set up
    AbandonedCartService = require('../../../services/recoveryEngine/AbandonedCartService');
    ChurnPredictionService = require('../../../services/recoveryEngine/ChurnPredictionService');
    RecoveryAnalyticsService = require('../../../services/recoveryEngine/RecoveryAnalyticsService');
    RecoveryMessagingService = require('../../../services/recoveryEngine/RecoveryMessagingService');
    RecoveryService = require('../../../services/recoveryEngine/RecoveryService');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== ABANDONED CART SERVICE TESTS ====================
  describe('AbandonedCartService', () => {
    describe('detectAbandonedCart - Basic Flow', () => {
      it('should detect abandoned cart after 30 minute threshold', async () => {
        const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);

        db.query.mockResolvedValue({ rows: [] });
        const mockTrackEvent = require('../../../services/recoveryEngine/RecoveryService').trackEvent;
        mockTrackEvent.mockResolvedValue({ id: 'event-123' });

        const result = await AbandonedCartService.detectAbandonedCart('session-1', {
          org_id: 1,
          customer_id: 'cust-1',
          cart_id: 'cart-1',
          items: [{ name: 'Product A', price: 50 }],
          cart_total: 50,
          last_activity_at: thirtyFiveMinutesAgo
        });

        expect(result.abandoned).toBe(true);
        expect(result.eventId).toBe('event-123');
      });

      it('should not detect cart as abandoned before threshold', async () => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        db.query.mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.detectAbandonedCart('session-1', {
          org_id: 1,
          customer_id: 'cust-1',
          cart_id: 'cart-1',
          last_activity_at: tenMinutesAgo
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
    });

    describe('detectAbandonedCart - Validation & Errors', () => {
      it('should throw error when org_id is missing', async () => {
        await expect(
          AbandonedCartService.detectAbandonedCart('session-1', {
            customer_id: 'cust-1',
            cart_id: 'cart-1'
          })
        ).rejects.toThrow('org_id, customer_id, and cart_id are required');
      });

      it('should throw error when customer_id is missing', async () => {
        await expect(
          AbandonedCartService.detectAbandonedCart('session-1', {
            org_id: 1,
            cart_id: 'cart-1'
          })
        ).rejects.toThrow('org_id, customer_id, and cart_id are required');
      });

      it('should throw error when cart_id is missing', async () => {
        await expect(
          AbandonedCartService.detectAbandonedCart('session-1', {
            org_id: 1,
            customer_id: 'cust-1'
          })
        ).rejects.toThrow('org_id, customer_id, and cart_id are required');
      });

      it('should handle database errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('Database connection failed'));

        await expect(
          AbandonedCartService.detectAbandonedCart('session-1', {
            org_id: 1,
            customer_id: 'cust-1',
            cart_id: 'cart-1'
          })
        ).rejects.toThrow('Database connection failed');
      });
    });

    describe('detectAbandonedCart - Edge Cases', () => {
      it('should handle empty items array', async () => {
        const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);

        db.query.mockResolvedValue({ rows: [] });
        const mockTrackEvent = require('../../../services/recoveryEngine/RecoveryService').trackEvent;
        mockTrackEvent.mockResolvedValue({ id: 'event-123' });

        const result = await AbandonedCartService.detectAbandonedCart('session-1', {
          org_id: 1,
          customer_id: 'cust-1',
          cart_id: 'cart-1',
          items: [],
          cart_total: 0,
          last_activity_at: thirtyFiveMinutesAgo
        });

        expect(result.abandoned).toBe(true);
        expect(result.item_count).toBe(0);
      });

      it('should use current time when last_activity_at is not provided', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.detectAbandonedCart('session-1', {
          org_id: 1,
          customer_id: 'cust-1',
          cart_id: 'cart-1'
        });

        expect(result.abandoned).toBe(false);
      });

      it('should handle checkout_started flag', async () => {
        const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);

        db.query.mockResolvedValue({ rows: [] });
        const mockTrackEvent = require('../../../services/recoveryEngine/RecoveryService').trackEvent;
        mockTrackEvent.mockResolvedValue({ id: 'event-123' });

        await AbandonedCartService.detectAbandonedCart('session-1', {
          org_id: 1,
          customer_id: 'cust-1',
          cart_id: 'cart-1',
          checkout_started: true,
          last_activity_at: thirtyFiveMinutesAgo
        });

        expect(mockTrackEvent).toHaveBeenCalledWith(
          1,
          'cart_abandoned',
          expect.objectContaining({
            data: expect.objectContaining({
              checkout_started: true
            })
          })
        );
      });
    });

    describe('createRecoverySequence', () => {
      it('should create recovery sequence with messages', async () => {
        const mockEvent = {
          id: 'event-1',
          org_id: 1,
          campaign_id: 'campaign-1',
          customer_email: 'test@example.com',
          customer_phone: '+1234567890',
          message_templates: [
            { subject: 'Subject 1', body: 'Body 1', channel: 'email' },
            { subject: 'Subject 2', body: 'Body 2', channel: 'sms' },
            { subject: 'Subject 3', body: 'Body 3', channel: 'email' }
          ],
          channels: ['email', 'sms']
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockEvent] })
          .mockResolvedValue({ rows: [{ id: 'msg-1', sequence_number: 1 }] });

        const result = await AbandonedCartService.createRecoverySequence('cart-1', 'cust-1');

        expect(result.event_id).toBe('event-1');
        expect(result.cart_id).toBe('cart-1');
        expect(result.customer_id).toBe('cust-1');
        expect(result.messages).toHaveLength(3);
        expect(result.timing).toEqual([2, 24, 48]);
      });

      it('should throw error when event not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          AbandonedCartService.createRecoverySequence('nonexistent', 'cust-1')
        ).rejects.toThrow('Abandoned cart event not found');
      });

      it('should use default message when templates are empty', async () => {
        const mockEvent = {
          id: 'event-1',
          org_id: 1,
          campaign_id: 'campaign-1',
          customer_email: 'test@example.com',
          message_templates: [],
          channels: ['email']
        };

        db.query
          .mockResolvedValueOnce({ rows: [mockEvent] })
          .mockResolvedValue({ rows: [{ id: 'msg-1', sequence_number: 1 }] });

        await AbandonedCartService.createRecoverySequence('cart-1', 'cust-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything(),
            "Don't forget your items!",
            expect.anything(),
            expect.anything(),
            expect.anything(),
            expect.anything()
          ])
        );
      });
    });

    describe('scheduleRecoveryMessages', () => {
      it('should schedule messages with default timing [2, 24, 48]', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { id: 'msg-1', sequence_number: 1, channel: 'email' },
              { id: 'msg-2', sequence_number: 2, channel: 'email' },
              { id: 'msg-3', sequence_number: 3, channel: 'email' }
            ]
          })
          .mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.scheduleRecoveryMessages('event-1');

        expect(result.scheduled_messages).toHaveLength(3);
        expect(result.scheduled_messages[0].delay_hours).toBe(2);
        expect(result.scheduled_messages[1].delay_hours).toBe(24);
        expect(result.scheduled_messages[2].delay_hours).toBe(48);
      });

      it('should schedule with custom timing', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { id: 'msg-1', sequence_number: 1, channel: 'sms' },
              { id: 'msg-2', sequence_number: 2, channel: 'email' }
            ]
          })
          .mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.scheduleRecoveryMessages('event-1', [1, 6, 12]);

        expect(result.scheduled_messages[0].delay_hours).toBe(1);
        expect(result.scheduled_messages[1].delay_hours).toBe(6);
      });

      it('should throw error when no pending messages found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          AbandonedCartService.scheduleRecoveryMessages('event-1')
        ).rejects.toThrow('No pending messages found for sequence');
      });

      it('should use last timing value for extra messages', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { id: 'msg-1', sequence_number: 1, channel: 'email' },
              { id: 'msg-2', sequence_number: 2, channel: 'email' },
              { id: 'msg-3', sequence_number: 3, channel: 'email' },
              { id: 'msg-4', sequence_number: 4, channel: 'email' }
            ]
          })
          .mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.scheduleRecoveryMessages('event-1', [1, 6]);

        expect(result.scheduled_messages[3].delay_hours).toBe(6);
      });
    });

    describe('calculateOptimalTiming', () => {
      it('should calculate optimal timing with engagement data', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { open_hour: '10', open_day: '2', open_count: '5' },
              { open_hour: '14', open_day: '4', open_count: '3' },
              { open_hour: '19', open_day: '6', open_count: '2' }
            ]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

        expect(result.optimal_hours).toHaveLength(3);
        expect(result.optimal_days).toHaveLength(3);
        expect(result.recommended_timing).toHaveLength(3);
        expect(result.confidence).toBe('medium');
        expect(result.data_points).toBe(3);
      });

      it('should return default values with no data', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

        expect(result.optimal_hours).toEqual([10, 14, 19]);
        expect(result.optimal_days).toEqual([2, 4, 6]);
        expect(result.confidence).toBe('low');
        expect(result.data_points).toBe(0);
      });

      it('should set high confidence with 6+ data points', async () => {
        const manyDataPoints = Array(8).fill(null).map((_, i) => ({
          open_hour: String(10 + (i % 12)),
          open_day: String(i % 7),
          open_count: '2'
        }));

        db.query
          .mockResolvedValueOnce({ rows: manyDataPoints })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

        expect(result.confidence).toBe('high');
        expect(result.data_points).toBe(8);
      });

      it('should ensure minimum 2 hour delay', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.calculateOptimalTiming('cust-1');

        expect(result.recommended_timing[0]).toBeGreaterThanOrEqual(2);
      });
    });

    describe('generatePersonalizedOffer', () => {
      it('should generate 15% discount for high value customer with high cart', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 150, items: [], currency: 'USD' },
          { lifetime_value: 600, total_orders: 10 }
        );

        expect(result.offer_type).toBe('percentage_discount');
        expect(result.offer_value).toBe(15);
        expect(result.urgency).toBe('high');
        expect(result.discount_amount).toBe(22.5);
        expect(result.final_total).toBe(127.5);
      });

      it('should generate 10% discount for new customer with high cart', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 150, items: [] },
          { total_orders: 0, lifetime_value: 0 }
        );

        expect(result.offer_type).toBe('percentage_discount');
        expect(result.offer_value).toBe(10);
        expect(result.personalization_factors.is_new_customer).toBe(true);
        expect(result.discount_amount).toBe(15);
      });

      it('should generate free shipping for regular customer with high cart', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 120, items: [] },
          { total_orders: 3, lifetime_value: 300 }
        );

        expect(result.offer_type).toBe('free_shipping');
        expect(result.discount_amount).toBe(0);
      });

      it('should generate 20% for at-risk customer with medium cart', async () => {
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
        expect(result.personalization_factors.is_at_risk).toBe(true);
      });

      it('should generate $10 fixed discount for medium cart', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 75, items: [] },
          { total_orders: 3, lifetime_value: 200 }
        );

        expect(result.offer_type).toBe('fixed_discount');
        expect(result.offer_value).toBe(10);
        expect(result.discount_amount).toBe(10);
        expect(result.final_total).toBe(65);
      });

      it('should generate 5% for new customer with low cart', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 30, items: [] },
          { total_orders: 0, lifetime_value: 0 }
        );

        expect(result.offer_type).toBe('percentage_discount');
        expect(result.offer_value).toBe(5);
      });

      it('should not offer discount for existing customer with low cart', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 25, items: [] },
          { total_orders: 3, lifetime_value: 100 }
        );

        expect(result.offer_type).toBe('none');
        expect(result.offer_code).toBeNull();
      });

      it('should generate unique offer code', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 100, items: [] },
          { lifetime_value: 600, total_orders: 10 }
        );

        expect(result.offer_code).toMatch(/^RECOVER[A-Z0-9]+$/);
        expect(result.offer_code.length).toBeGreaterThan(6);
      });

      it('should not exceed original total when calculating final price', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 5, items: [] },
          { total_orders: 5, lifetime_value: 100, recovery_history: [{ status: 'failed' }] }
        );

        expect(result.final_total).toBeGreaterThanOrEqual(0);
      });
    });

    describe('trackCartRecovery', () => {
      it('should update cart to recovered status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 'event-1', status: 'recovered' }] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.trackCartRecovery('cart-1', 'recovered');

        expect(result.status).toBe('recovered');
      });

      it('should cancel pending messages on recovery', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 'event-1', status: 'recovered' }] })
          .mockResolvedValueOnce({ rows: [] });

        await AbandonedCartService.trackCartRecovery('cart-1', 'recovered');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining("status = 'cancelled'"),
          expect.any(Array)
        );
      });

      it('should throw error for invalid status', async () => {
        await expect(
          AbandonedCartService.trackCartRecovery('cart-1', 'invalid_status')
        ).rejects.toThrow('Invalid status');
      });

      it('should throw error when cart not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          AbandonedCartService.trackCartRecovery('nonexistent', 'recovered')
        ).rejects.toThrow('Cart recovery event not found');
      });

      it('should accept all valid statuses', async () => {
        const validStatuses = ['recovered', 'partially_recovered', 'failed', 'expired', 'opted_out'];

        for (const status of validStatuses) {
          db.query
            .mockResolvedValueOnce({ rows: [{ id: 'event-1', status }] })
            .mockResolvedValueOnce({ rows: [] });

          const result = await AbandonedCartService.trackCartRecovery('cart-1', status);
          expect(result.status).toBe(status);
        }
      });

      it('should not cancel messages for failed status', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 'event-1', status: 'failed' }] });

        await AbandonedCartService.trackCartRecovery('cart-1', 'failed');

        expect(db.query).toHaveBeenCalledTimes(1);
      });
    });

    describe('getAbandonedCarts', () => {
      it('should get abandoned carts with default filters', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { id: 'e1', cart_id: 'c1', cart_total: '100', message_count: '3', messages_sent: '2' },
              { id: 'e2', cart_id: 'c2', cart_total: '50', message_count: '1', messages_sent: '1' }
            ]
          })
          .mockResolvedValueOnce({ rows: [{ count: '2' }] });

        const result = await AbandonedCartService.getAbandonedCarts(1);

        expect(result.carts).toHaveLength(2);
        expect(result.total).toBe(2);
        expect(result.limit).toBe(50);
        expect(result.offset).toBe(0);
      });

      it('should filter by status', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await AbandonedCartService.getAbandonedCarts(1, { status: 'pending' });

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('AND e.status = $2'),
          expect.arrayContaining([1, 'pending', 50, 0])
        );
      });

      it('should filter by min and max value', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
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

        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] });

        await AbandonedCartService.getAbandonedCarts(1, { start_date: startDate, end_date: endDate });

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('event_occurred_at >='),
          expect.any(Array)
        );
      });

      it('should apply pagination', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] });

        const result = await AbandonedCartService.getAbandonedCarts(1, { limit: 10, offset: 20 });

        expect(result.limit).toBe(10);
        expect(result.offset).toBe(20);
      });
    });

    describe('getRecoveryRate', () => {
      it('should calculate recovery rate correctly', async () => {
        db.query
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.getRecoveryRate(1);

        expect(result.summary.total_abandoned).toBe(100);
        expect(result.summary.fully_recovered).toBe(20);
        expect(result.summary.partially_recovered).toBe(10);
        expect(result.summary.lost).toBe(50);
        expect(result.summary.recovery_rate).toBe(30.00);
        expect(result.summary.value_recovery_rate).toBe(30.00);
      });

      it('should handle zero events', async () => {
        db.query
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.getRecoveryRate(1);

        expect(result.summary.recovery_rate).toBe(0);
        expect(result.summary.value_recovery_rate).toBe(0);
      });

      it('should include daily breakdown', async () => {
        db.query
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({
            rows: [
              { date: '2024-01-01', abandoned: '5', recovered: '2', value_at_risk: '500', value_recovered: '200' },
              { date: '2024-01-02', abandoned: '5', recovered: '3', value_at_risk: '500', value_recovered: '300' }
            ]
          });

        const result = await AbandonedCartService.getRecoveryRate(1);

        expect(result.daily_breakdown).toHaveLength(2);
        expect(result.date_range).toBeDefined();
      });
    });
  });

  // ==================== CHURN PREDICTION SERVICE TESTS ====================
  describe('ChurnPredictionService', () => {
    describe('calculateHealthScore', () => {
      it('should calculate health score with all components', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] }) // Customer health scores
          .mockResolvedValueOnce({ rows: [] }) // Engagement recent
          .mockResolvedValueOnce({ rows: [] }) // Engagement previous
          .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] }) // Support tickets
          .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] }) // Negative feedback
          .mockResolvedValueOnce({ rows: [{ failed_count: '0' }] }) // Payment issues
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] }) // Competitor mentions
          .mockResolvedValueOnce({ rows: [] }) // Financial score
          .mockResolvedValueOnce({ rows: [] }) // Satisfaction score
          .mockResolvedValueOnce({ rows: [] }) // Tenure score
          .mockResolvedValueOnce({ rows: [] }) // Save health score
          .mockResolvedValueOnce({ rows: [] }) // Health score history check
          .mockResolvedValueOnce({ rows: [] }); // History insert

        const result = await ChurnPredictionService.calculateHealthScore('cust-1', 1);

        expect(result.health_score).toBeGreaterThanOrEqual(0);
        expect(result.health_score).toBeLessThanOrEqual(100);
        expect(result.health_grade).toMatch(/[A-F]/);
        expect(result.churn_probability).toBeGreaterThanOrEqual(0);
        expect(result.churn_probability).toBeLessThanOrEqual(1);
      });

      it('should apply signal penalties correctly', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ ticket_count: '5' }] })
          .mockResolvedValueOnce({ rows: [{ negative_count: '2' }] })
          .mockResolvedValueOnce({ rows: [{ failed_count: '1' }] })
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await ChurnPredictionService.calculateHealthScore('cust-1', 1);

        expect(result.risk_factors.length).toBeGreaterThan(0);
        expect(result.signal_penalty).toBeGreaterThan(0);
      });

      it('should categorize risk levels correctly', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const testCases = [
          { score: 85, expectedRisk: 'very_low', expectedGrade: 'A' },
          { score: 70, expectedRisk: 'low', expectedGrade: 'B' },
          { score: 50, expectedRisk: 'medium', expectedGrade: 'C' },
          { score: 30, expectedRisk: 'high', expectedGrade: 'D' },
          { score: 10, expectedRisk: 'critical', expectedGrade: 'F' }
        ];

        for (const testCase of testCases) {
          expect(ChurnPredictionService.categorizeRisk(testCase.score)).toBe(testCase.expectedRisk);
        }
      });
    });

    describe('analyzeEngagement', () => {
      it('should calculate engagement metrics correctly', async () => {
        const now = new Date();
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_messages: '10',
              opened: '8',
              clicked: '5',
              converted: '2'
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_events: '15',
              active_days: '10',
              last_activity: now
            }]
          });

        const result = await ChurnPredictionService.analyzeEngagement('cust-1', 30);

        expect(result.total_messages).toBe(10);
        expect(result.open_rate).toBe(80.00);
        expect(result.click_rate).toBe(50.00);
        expect(result.conversion_rate).toBe(20.00);
        expect(result.active_days).toBe(10);
        expect(result.activity_rate).toBeCloseTo(33.33, 1);
      });

      it('should handle zero messages', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_messages: '0',
              opened: '0',
              clicked: '0',
              converted: '0'
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_events: '0',
              active_days: '0',
              last_activity: null
            }]
          });

        const result = await ChurnPredictionService.analyzeEngagement('cust-1', 30);

        expect(result.open_rate).toBe(0);
        expect(result.click_rate).toBe(0);
        expect(result.conversion_rate).toBe(0);
        expect(result.days_since_activity).toBe(30);
      });
    });

    describe('detectChurnSignals', () => {
      it('should detect login decrease signal', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] }) // Recent engagement messages
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '2', last_activity: new Date() }] }) // Recent events
          .mockResolvedValueOnce({ rows: [] }) // Previous engagement messages
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '6', last_activity: new Date() }] }) // Previous events
          .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ failed_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] });

        const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

        const loginSignal = result.find(s => s.type === 'login_decrease');
        expect(loginSignal).toBeDefined();
        expect(loginSignal.severity).toBe('high');
      });

      it('should detect usage drop signal', async () => {
        const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '0', last_activity: oldDate }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '0', last_activity: oldDate }] })
          .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ failed_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] });

        const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

        const usageSignal = result.find(s => s.type === 'usage_drop');
        expect(usageSignal).toBeDefined();
        expect(usageSignal.severity).toBe('critical');
      });

      it('should detect support ticket signal', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '5', last_activity: new Date() }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '5', last_activity: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ ticket_count: '5' }] })
          .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ failed_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] });

        const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

        const ticketSignal = result.find(s => s.type === 'support_tickets');
        expect(ticketSignal).toBeDefined();
        expect(ticketSignal.severity).toBe('critical');
      });

      it('should detect payment issues', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '5', last_activity: new Date() }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '5', last_activity: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ failed_count: '2' }] })
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] });

        const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

        const paymentSignal = result.find(s => s.type === 'payment_issues');
        expect(paymentSignal).toBeDefined();
        expect(paymentSignal.severity).toBe('critical');
      });

      it('should return empty array when no signals detected', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '5', last_activity: new Date() }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '5', last_activity: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ failed_count: '0' }] })
          .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] });

        const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

        expect(result).toEqual([]);
      });
    });

    describe('predictChurnProbability', () => {
      it('should calculate base probability from health score', () => {
        const result = ChurnPredictionService.predictChurnProbability(50, []);

        expect(result).toBe(0.5000);
      });

      it('should increase probability with critical signals', () => {
        const signals = [
          { severity: 'critical' },
          { severity: 'critical' }
        ];

        const result = ChurnPredictionService.predictChurnProbability(50, signals);

        expect(result).toBeGreaterThan(0.5);
      });

      it('should cap probability at 0.95', () => {
        const signals = Array(10).fill({ severity: 'critical' });

        const result = ChurnPredictionService.predictChurnProbability(10, signals);

        expect(result).toBeLessThanOrEqual(0.95);
      });

      it('should handle high health score', () => {
        const result = ChurnPredictionService.predictChurnProbability(90, []);

        expect(result).toBe(0.1000);
      });
    });

    describe('generateRetentionStrategy', () => {
      it('should generate critical strategy', async () => {
        const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'critical');

        expect(result.priority).toBe('immediate');
        expect(result.actions).toBeDefined();
        expect(result.actions.some(a => a.type === 'personal_call')).toBe(true);
        expect(result.messaging.offer_aggressiveness).toBe('high');
      });

      it('should generate high risk strategy', async () => {
        const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'high');

        expect(result.priority).toBe('urgent');
        expect(result.actions.some(a => a.type === 'account_review')).toBe(true);
      });

      it('should generate medium risk strategy', async () => {
        const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'medium');

        expect(result.priority).toBe('proactive');
        expect(result.actions.some(a => a.type === 'engagement_campaign')).toBe(true);
      });

      it('should generate low risk strategy', async () => {
        const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'low');

        expect(result.priority).toBe('nurture');
      });

      it('should generate very_low risk strategy', async () => {
        const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'very_low');

        expect(result.priority).toBe('maintain');
        expect(result.actions.some(a => a.type === 'advocacy')).toBe(true);
      });

      it('should default to medium for unknown risk level', async () => {
        const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'unknown');

        expect(result.priority).toBe('proactive');
      });
    });

    describe('scheduleProactiveOutreach', () => {
      it('should schedule actions with correct timing', async () => {
        const strategy = {
          actions: [
            { type: 'personal_call', description: 'Call customer', timing: 'within_24h' },
            { type: 'email', description: 'Send email', timing: 'within_week' }
          ],
          priority: 'urgent',
          messaging: { tone: 'caring' }
        };

        db.query.mockResolvedValue({ rows: [{ id: 'outreach-1' }] });

        const result = await ChurnPredictionService.scheduleProactiveOutreach('cust-1', strategy);

        expect(result.scheduled_actions).toHaveLength(2);
        expect(result.scheduled_actions[0].action_type).toBe('personal_call');
        expect(result.scheduled_actions[0].status).toBe('scheduled');
      });

      it('should handle discount actions', async () => {
        const strategy = {
          actions: [
            { type: 'custom_offer', description: 'Offer discount', timing: 'within_48h', discount: 30 }
          ],
          priority: 'immediate',
          messaging: {}
        };

        db.query.mockResolvedValue({ rows: [{ id: 'outreach-1' }] });

        const result = await ChurnPredictionService.scheduleProactiveOutreach('cust-1', strategy);

        expect(result.scheduled_actions[0].discount).toBe(30);
      });
    });

    describe('getAtRiskCustomers', () => {
      it('should get customers above threshold', async () => {
        db.query.mockResolvedValue({
          rows: [
            { customer_id: 'c1', churn_risk_level: 'critical', churn_probability: 0.8, active_interventions: '0' },
            { customer_id: 'c2', churn_risk_level: 'high', churn_probability: 0.6, active_interventions: '1' },
            { customer_id: 'c3', churn_risk_level: 'medium', churn_probability: 0.5, active_interventions: '0' }
          ]
        });

        const result = await ChurnPredictionService.getAtRiskCustomers(1, 0.5);

        expect(result.total_at_risk).toBe(3);
        expect(result.by_risk_level.critical).toHaveLength(1);
        expect(result.by_risk_level.high).toHaveLength(1);
        expect(result.by_risk_level.medium).toHaveLength(1);
      });

      it('should group customers by risk level', async () => {
        db.query.mockResolvedValue({
          rows: [
            { customer_id: 'c1', churn_risk_level: 'critical', active_interventions: '0' },
            { customer_id: 'c2', churn_risk_level: 'critical', active_interventions: '1' }
          ]
        });

        const result = await ChurnPredictionService.getAtRiskCustomers(1, 0.7);

        expect(result.summary.critical_count).toBe(2);
        expect(result.summary.high_count).toBe(0);
      });
    });

    describe('updateHealthScoreHistory', () => {
      it('should update history and calculate trend', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 'health-1',
              health_score: 60,
              health_grade: 'B',
              churn_probability: 0.4,
              churn_risk_level: 'medium'
            }]
          })
          .mockResolvedValueOnce({ rows: [{ id: 'history-1' }] })
          .mockResolvedValueOnce({
            rows: [
              { health_score: 65 },
              { health_score: 68 },
              { health_score: 60 },
              { health_score: 58 }
            ]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await ChurnPredictionService.updateHealthScoreHistory('cust-1', 65, 1);

        expect(result.score).toBe(65);
        expect(result.trend).toBe('improving');
      });

      it('should detect declining trend', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 'health-1',
              health_score: 70,
              health_grade: 'B',
              churn_probability: 0.3,
              churn_risk_level: 'low'
            }]
          })
          .mockResolvedValueOnce({ rows: [{ id: 'history-1' }] })
          .mockResolvedValueOnce({
            rows: [
              { health_score: 55 },
              { health_score: 58 },
              { health_score: 70 },
              { health_score: 72 }
            ]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await ChurnPredictionService.updateHealthScoreHistory('cust-1', 55, 1);

        expect(result.trend).toBe('declining');
      });

      it('should return null when no current health score exists', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await ChurnPredictionService.updateHealthScoreHistory('cust-1', 70, 1);

        expect(result).toBeNull();
      });
    });

    describe('getChurnAnalytics', () => {
      it('should get comprehensive churn analytics', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_customers: '100',
              avg_health_score: '65.5',
              avg_churn_probability: '0.35',
              critical_count: '5',
              high_count: '10',
              medium_count: '15',
              low_count: '30',
              very_low_count: '40'
            }]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              total_churn_events: '20',
              prevented: '12',
              lost: '8'
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await ChurnPredictionService.getChurnAnalytics(1);

        expect(result.summary.total_customers).toBe(100);
        expect(result.summary.avg_health_score).toBe(65.5);
        expect(result.summary.at_risk_count).toBe(30);
        expect(result.churn_events.prevention_rate).toBe('60.00');
      });

      it('should handle zero customers', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_customers: '0',
              avg_health_score: null,
              avg_churn_probability: null,
              critical_count: '0',
              high_count: '0',
              medium_count: '0',
              low_count: '0',
              very_low_count: '0'
            }]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              total_churn_events: '0',
              prevented: '0',
              lost: '0'
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await ChurnPredictionService.getChurnAnalytics(1);

        expect(result.summary.total_customers).toBe(0);
        expect(result.churn_events.prevention_rate).toBe('0');
      });
    });
  });

  // ==================== RECOVERY ANALYTICS SERVICE TESTS ====================
  describe('RecoveryAnalyticsService', () => {
    describe('getDashboardStats', () => {
      it('should get comprehensive dashboard statistics', async () => {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_events: '100',
              recovered: '30',
              partially_recovered: '10',
              in_progress: '40',
              total_at_risk: '50000.00',
              total_recovered: '15000.00'
            }]
          })
          .mockResolvedValueOnce({ rows: [{ active_campaigns: '5' }] })
          .mockResolvedValueOnce({
            rows: [{
              total_at_risk: '25',
              critical: '5',
              high: '10'
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_sent: '200',
              opened: '150',
              clicked: '80',
              converted: '30'
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              events_today: '10',
              recovered_today: '3',
              revenue_today: '1500.00'
            }]
          });

        const result = await RecoveryAnalyticsService.getDashboardStats(1);

        expect(result.overview.total_events_30d).toBe(100);
        expect(result.overview.total_recovered_30d).toBe(40);
        expect(result.overview.recovery_rate).toBe('40.0');
        expect(result.campaigns.active).toBe(5);
        expect(result.customers_at_risk.total).toBe(25);
        expect(result.messages.sent).toBe(200);
        expect(result.today.events).toBe(10);
      });

      it('should handle zero data', async () => {
        db.query.mockResolvedValue({
          rows: [{
            total_events: '0',
            recovered: '0',
            partially_recovered: '0',
            in_progress: '0',
            total_at_risk: '0',
            total_recovered: '0',
            active_campaigns: '0',
            total_at_risk: '0',
            critical: '0',
            high: '0',
            total_sent: '0',
            opened: '0',
            clicked: '0',
            converted: '0',
            events_today: '0',
            recovered_today: '0',
            revenue_today: '0'
          }]
        });

        const result = await RecoveryAnalyticsService.getDashboardStats(1);

        expect(result.overview.recovery_rate).toBe('0');
        expect(result.messages.open_rate).toBe('0');
      });
    });

    describe('getRevenueRecovered', () => {
      it('should calculate revenue recovered with breakdown', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              total_recovered: '25000.00',
              total_potential: '50000.00',
              total_recoveries: '50',
              avg_recovery_value: '500.00'
            }]
          })
          .mockResolvedValueOnce({
            rows: [
              { event_type: 'cart_abandoned', recoveries: '30', revenue: '15000.00' },
              { event_type: 'churn_risk', recoveries: '20', revenue: '10000.00' }
            ]
          });

        const result = await RecoveryAnalyticsService.getRevenueRecovered(1);

        expect(result.summary.total_recovered).toBe(25000);
        expect(result.summary.recovery_efficiency).toBe('50.0');
        expect(result.by_type).toHaveLength(2);
      });

      it('should include daily breakdown', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { date: '2024-01-01', recoveries: '5', revenue: '2500.00', potential: '5000.00' },
              { date: '2024-01-02', recoveries: '3', revenue: '1500.00', potential: '3000.00' }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_recovered: '4000.00',
              total_potential: '8000.00',
              total_recoveries: '8',
              avg_recovery_value: '500.00'
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryAnalyticsService.getRevenueRecovered(1);

        expect(result.daily).toHaveLength(2);
        expect(result.daily[0].recoveries).toBe(5);
      });
    });

    describe('getRecoveryRateByChannel', () => {
      it('should calculate metrics by channel', async () => {
        db.query.mockResolvedValue({
          rows: [
            {
              channel: 'email',
              total_sent: '100',
              delivered: '95',
              opened: '70',
              clicked: '30',
              converted: '10',
              revenue: '5000.00'
            },
            {
              channel: 'sms',
              total_sent: '50',
              delivered: '48',
              opened: '40',
              clicked: '20',
              converted: '8',
              revenue: '4000.00'
            }
          ]
        });

        const result = await RecoveryAnalyticsService.getRecoveryRateByChannel(1);

        expect(result.channels).toHaveLength(2);
        expect(result.channels[0].delivery_rate).toBe('95.0');
        expect(result.channels[0].open_rate).toBeCloseTo(73.7, 0);
        expect(result.overall.total_sent).toBe(150);
        expect(result.best_channel).toBe('email');
      });

      it('should handle empty results', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryAnalyticsService.getRecoveryRateByChannel(1);

        expect(result.channels).toEqual([]);
        expect(result.best_channel).toBeNull();
      });
    });

    describe('getCampaignPerformance', () => {
      it('should get detailed campaign performance', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 'camp-1',
              name: 'Cart Recovery',
              campaign_type: 'cart_abandonment',
              status: 'active',
              created_at: new Date()
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_events: '100',
              recovered: '30',
              partially_recovered: '5',
              failed: '40',
              pending: '25',
              total_potential: '50000.00',
              total_recovered: '18000.00',
              avg_recovery: '600.00'
            }]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_messages: '300',
              opened: '220',
              clicked: '100',
              converted: '30',
              bounced: '5',
              failed: '10'
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryAnalyticsService.getCampaignPerformance(1, 'camp-1');

        expect(result.campaign.name).toBe('Cart Recovery');
        expect(result.events.recovery_rate).toBe('35.0');
        expect(result.revenue.efficiency).toBe('36.0');
        expect(result.messages.open_rate).toBeCloseTo(73.3, 0);
      });

      it('should throw error when campaign not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          RecoveryAnalyticsService.getCampaignPerformance(1, 'nonexistent')
        ).rejects.toThrow('Campaign not found');
      });
    });

    describe('getAbandonedCartStats', () => {
      it('should calculate abandoned cart statistics', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_abandoned: '100',
              recovered: '30',
              partially_recovered: '10',
              lost: '50',
              total_cart_value: '50000.00',
              recovered_value: '20000.00',
              avg_cart_value: '500.00',
              avg_recovery_hours: '24.5'
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryAnalyticsService.getAbandonedCartStats(1);

        expect(result.summary.total_abandoned).toBe(100);
        expect(result.summary.recovery_rate).toBe('40.0');
        expect(result.summary.lost_value).toBe(30000);
        expect(result.summary.avg_recovery_hours).toBe('24.5');
      });

      it('should include value distribution', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_abandoned: '50',
              recovered: '20',
              partially_recovered: '5',
              lost: '25',
              total_cart_value: '25000.00',
              recovered_value: '12500.00',
              avg_cart_value: '500.00',
              avg_recovery_hours: '18.0'
            }]
          })
          .mockResolvedValueOnce({
            rows: [
              { value_range: '0-50', count: '10', recovered: '8' },
              { value_range: '50-100', count: '20', recovered: '12' },
              { value_range: '100-200', count: '15', recovered: '4' },
              { value_range: '200-500', count: '3', recovered: '1' },
              { value_range: '500+', count: '2', recovered: '0' }
            ]
          });

        const result = await RecoveryAnalyticsService.getAbandonedCartStats(1);

        expect(result.value_distribution).toHaveLength(5);
        expect(result.value_distribution[0].recovery_rate).toBe('80.0');
      });
    });

    describe('getChurnStats', () => {
      it('should calculate churn statistics', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              total_churn_risks: '50',
              prevented: '20',
              churned: '15',
              in_progress: '15',
              revenue_at_risk: '100000.00',
              revenue_saved: '40000.00'
            }]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [
              { churn_risk_level: 'critical', count: '5', avg_probability: '0.85' },
              { churn_risk_level: 'high', count: '10', avg_probability: '0.65' },
              { churn_risk_level: 'medium', count: '15', avg_probability: '0.45' }
            ]
          });

        const result = await RecoveryAnalyticsService.getChurnStats(1);

        expect(result.summary.total_at_risk).toBe(50);
        expect(result.summary.prevention_rate).toBe('40.0');
        expect(result.risk_distribution.critical.count).toBe(5);
      });
    });

    describe('getCustomerHealthDistribution', () => {
      it('should get health score distribution', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { health_grade: 'A', count: '20', avg_score: '85', avg_churn_prob: '0.15' },
              { health_grade: 'B', count: '30', avg_score: '70', avg_churn_prob: '0.30' },
              { health_grade: 'C', count: '25', avg_score: '50', avg_churn_prob: '0.50' },
              { health_grade: 'D', count: '15', avg_score: '30', avg_churn_prob: '0.70' },
              { health_grade: 'F', count: '10', avg_score: '15', avg_churn_prob: '0.85' }
            ]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              total_customers: '100',
              avg_score: '62',
              min_score: '10',
              max_score: '95',
              median_score: '60'
            }]
          });

        const result = await RecoveryAnalyticsService.getCustomerHealthDistribution(1);

        expect(result.overall.total_customers).toBe(100);
        expect(result.overall.median_score).toBe(60);
        expect(result.by_grade).toHaveLength(5);
      });
    });

    describe('getTopRecoveredCustomers', () => {
      it('should get top recovered customers', async () => {
        db.query.mockResolvedValue({
          rows: [
            { customer_id: 'c1', customer_email: 'c1@test.com', customer_name: 'Customer 1', recovery_count: '5', total_recovered: '5000.00', last_recovery: new Date() },
            { customer_id: 'c2', customer_email: 'c2@test.com', customer_name: 'Customer 2', recovery_count: '3', total_recovered: '3000.00', last_recovery: new Date() }
          ]
        });

        const result = await RecoveryAnalyticsService.getTopRecoveredCustomers(1, 10);

        expect(result).toHaveLength(2);
        expect(result[0].recovery_count).toBe(5);
        expect(result[0].total_recovered).toBe(5000);
      });
    });

    describe('getHourlyPerformance', () => {
      it('should analyze performance by hour and day', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { hour: '10', total_sent: '50', opened: '40', clicked: '20', converted: '10', revenue: '5000.00' },
              { hour: '14', total_sent: '30', opened: '20', clicked: '10', converted: '5', revenue: '2500.00' }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              { day_of_week: '1', total_sent: '100', opened: '70', converted: '20' },
              { day_of_week: '3', total_sent: '80', opened: '50', converted: '15' }
            ]
          });

        const result = await RecoveryAnalyticsService.getHourlyPerformance(1);

        expect(result.hourly).toHaveLength(2);
        expect(result.daily).toHaveLength(2);
        expect(result.recommendations.best_hour).toBe(10);
        expect(result.daily[0].day_name).toBe('Monday');
      });
    });

    describe('generateReport', () => {
      it('should generate comprehensive JSON report', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryAnalyticsService.generateReport(1, {}, 'json');

        expect(result.generated_at).toBeDefined();
        expect(result.dashboard).toBeDefined();
        expect(result.revenue).toBeDefined();
        expect(result.channels).toBeDefined();
      });

      it('should generate CSV report', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryAnalyticsService.generateReport(1, {}, 'csv');

        expect(result.format).toBe('csv');
        expect(result.content).toContain('Recovery Analytics Report');
        expect(result.filename).toMatch(/recovery_report_.*\.csv/);
      });
    });

    describe('comparePerformance', () => {
      it('should compare two periods', async () => {
        const period1 = {
          start_date: new Date('2024-02-01'),
          end_date: new Date('2024-02-29')
        };
        const period2 = {
          start_date: new Date('2024-01-01'),
          end_date: new Date('2024-01-31')
        };

        db.query.mockResolvedValue({
          rows: [{
            total_recovered: '15000.00',
            total_potential: '30000.00',
            total_recoveries: '30',
            avg_recovery_value: '500.00',
            recovery_efficiency: '50.0'
          }]
        });

        const result = await RecoveryAnalyticsService.comparePerformance(1, period1, period2);

        expect(result.period1).toBeDefined();
        expect(result.period2).toBeDefined();
        expect(result.changes).toBeDefined();
        expect(result.trend).toMatch(/improving|declining/);
      });
    });
  });

  // ==================== RECOVERY MESSAGING SERVICE TESTS ====================
  describe('RecoveryMessagingService', () => {
    beforeEach(() => {
      global.fetch.mockClear();
    });

    describe('sendRecoveryMessage', () => {
      it('should send email message', async () => {
        const result = await RecoveryMessagingService.sendRecoveryMessage({
          message_id: 'msg-1',
          to_email: 'test@example.com',
          subject: 'Test Subject',
          body: 'Test Body'
        }, 'email');

        expect(result.success).toBe(true);
        expect(result.channel).toBe('email');
      });

      it('should track message delivery on success', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'msg-1', status: 'sent' }] });

        await RecoveryMessagingService.sendRecoveryMessage({
          message_id: 'msg-1',
          to_email: 'test@example.com',
          subject: 'Test',
          body: 'Body'
        }, 'email');

        expect(db.query).toHaveBeenCalled();
      });

      it('should track failure on error', async () => {
        process.env.EMAIL_HOST = '';
        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryMessagingService.sendRecoveryMessage({
          message_id: 'msg-1',
          to_email: 'test@example.com',
          subject: 'Test',
          body: 'Body'
        }, 'email');

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      it('should throw error for unsupported channel', async () => {
        const result = await RecoveryMessagingService.sendRecoveryMessage({
          to: 'test'
        }, 'unsupported');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unsupported channel');
      });
    });

    describe('sendWhatsAppMessage', () => {
      it('should send WhatsApp message successfully', async () => {
        process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone123';
        process.env.WHATSAPP_ACCESS_TOKEN = 'token123';

        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ messages: [{ id: 'wa-msg-1' }] })
        });

        const result = await RecoveryMessagingService.sendWhatsAppMessage(
          '+1234567890',
          'template_name',
          { var1: 'value1' }
        );

        expect(result.success).toBe(true);
        expect(result.external_id).toBe('wa-msg-1');
      });

      it('should handle WhatsApp API error', async () => {
        process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone123';
        process.env.WHATSAPP_ACCESS_TOKEN = 'token123';

        global.fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ error: { message: 'Invalid template' } })
        });

        const result = await RecoveryMessagingService.sendWhatsAppMessage('+1234567890', 'invalid');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid template');
      });

      it('should throw error when not configured', async () => {
        delete process.env.WHATSAPP_PHONE_NUMBER_ID;
        delete process.env.WHATSAPP_ACCESS_TOKEN;

        const result = await RecoveryMessagingService.sendWhatsAppMessage('+1234567890', 'template');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not configured');
      });
    });

    describe('sendSMSMessage', () => {
      it('should send SMS successfully', async () => {
        process.env.TWILIO_ACCOUNT_SID = 'AC123';
        process.env.TWILIO_AUTH_TOKEN = 'token123';
        process.env.TWILIO_PHONE_NUMBER = '+1234567890';

        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ sid: 'SM123' })
        });

        const result = await RecoveryMessagingService.sendSMSMessage('+1234567890', 'Test message');

        expect(result.success).toBe(true);
        expect(result.external_id).toBe('SM123');
      });

      it('should handle Twilio error', async () => {
        process.env.TWILIO_ACCOUNT_SID = 'AC123';
        process.env.TWILIO_AUTH_TOKEN = 'token123';
        process.env.TWILIO_PHONE_NUMBER = '+1234567890';

        global.fetch.mockResolvedValue({
          ok: false,
          json: async () => ({ message: 'Invalid phone number' })
        });

        const result = await RecoveryMessagingService.sendSMSMessage('+invalid', 'Test');

        expect(result.success).toBe(false);
      });
    });

    describe('sendTelegramMessage', () => {
      it('should send Telegram message successfully', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot123:token';

        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 12345 } })
        });

        const result = await RecoveryMessagingService.sendTelegramMessage('chat123', 'Test message');

        expect(result.success).toBe(true);
        expect(result.external_id).toBe('12345');
      });

      it('should send with buttons', async () => {
        process.env.TELEGRAM_BOT_TOKEN = 'bot123:token';

        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ ok: true, result: { message_id: 12345 } })
        });

        const buttons = [[{ text: 'Click me', url: 'https://example.com' }]];

        const result = await RecoveryMessagingService.sendTelegramMessage(
          'chat123',
          'Test message',
          buttons
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining('reply_markup')
          })
        );
      });
    });

    describe('selectBestChannel', () => {
      it('should select channel based on history', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { channel: 'email', total_sent: '10', opened: '8', clicked: '5', converted: '2' },
              { channel: 'sms', total_sent: '5', opened: '4', clicked: '3', converted: '1' }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{ recipient_email: 'test@example.com', recipient_phone: '+1234567890' }]
          });

        const result = await RecoveryMessagingService.selectBestChannel('cust-1');

        expect(result.recommended_channel).toBeDefined();
        expect(result.available_channels.length).toBeGreaterThan(0);
        expect(result.contact_info).toBeDefined();
      });

      it('should default to email when no history', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{ recipient_email: 'test@example.com', recipient_phone: null }]
          });

        const result = await RecoveryMessagingService.selectBestChannel('cust-1');

        expect(result.recommended_channel).toBe('email');
      });

      it('should return email on error', async () => {
        db.query.mockRejectedValue(new Error('DB error'));

        const result = await RecoveryMessagingService.selectBestChannel('cust-1');

        expect(result.recommended_channel).toBe('email');
        expect(result.error).toBeDefined();
      });
    });

    describe('trackMessageDelivery', () => {
      it('should update message to sent status', async () => {
        db.query.mockResolvedValue({
          rows: [{ id: 'msg-1', status: 'sent', sent_at: new Date() }]
        });

        const result = await RecoveryMessagingService.trackMessageDelivery('msg-1', 'sent');

        expect(result.status).toBe('sent');
      });

      it('should update to delivered status', async () => {
        db.query.mockResolvedValue({
          rows: [{ id: 'msg-1', status: 'delivered', delivered_at: new Date() }]
        });

        const result = await RecoveryMessagingService.trackMessageDelivery('msg-1', 'delivered');

        expect(result.status).toBe('delivered');
      });

      it('should handle bounced with error message', async () => {
        db.query.mockResolvedValue({
          rows: [{ id: 'msg-1', status: 'bounced', error_message: 'Invalid email' }]
        });

        const result = await RecoveryMessagingService.trackMessageDelivery('msg-1', 'bounced', 'Invalid email');

        expect(result.status).toBe('bounced');
      });

      it('should throw error for invalid status', async () => {
        await expect(
          RecoveryMessagingService.trackMessageDelivery('msg-1', 'invalid')
        ).rejects.toThrow('Invalid status');
      });
    });

    describe('trackMessageOpen', () => {
      it('should track message open', async () => {
        db.query.mockResolvedValue({
          rows: [{ id: 'msg-1', status: 'opened', opened_at: new Date() }]
        });

        const result = await RecoveryMessagingService.trackMessageOpen('msg-1');

        expect(result.status).toBe('opened');
      });

      it('should throw error when message not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          RecoveryMessagingService.trackMessageOpen('nonexistent')
        ).rejects.toThrow('Message not found');
      });
    });

    describe('trackMessageClick', () => {
      it('should track message click', async () => {
        db.query.mockResolvedValue({
          rows: [{ id: 'msg-1', status: 'clicked', clicked_at: new Date(), opened_at: new Date() }]
        });

        const result = await RecoveryMessagingService.trackMessageClick('msg-1', 'link-1');

        expect(result.status).toBe('clicked');
      });
    });

    describe('trackConversion', () => {
      it('should track conversion and update related records', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 'msg-1',
              status: 'converted',
              conversion_value: 100,
              channel: 'email',
              event_id: 'event-1',
              campaign_id: 'camp-1'
            }]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryMessagingService.trackConversion('msg-1', 100);

        expect(result.message.status).toBe('converted');
        expect(result.revenue).toBe(100);
        expect(db.query).toHaveBeenCalledTimes(3);
      });
    });

    describe('getMessageStats', () => {
      it('should get message statistics for organization', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              {
                channel: 'email',
                total_sent: '100',
                delivered: '95',
                opened: '70',
                clicked: '30',
                converted: '10',
                bounced: '5',
                failed: '0',
                total_revenue: '5000.00'
              }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{
              total_messages: '100',
              delivered: '95',
              opened: '70',
              clicked: '30',
              converted: '10',
              total_revenue: '5000.00',
              avg_conversion_value: '500.00'
            }]
          });

        const result = await RecoveryMessagingService.getMessageStats(1);

        expect(result.overall.total_sent).toBe(100);
        expect(result.overall.delivery_rate).toBe('95.00');
        expect(result.overall.open_rate).toBeCloseTo(73.68, 1);
        expect(result.by_channel.email).toBeDefined();
      });

      it('should filter by campaign', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await RecoveryMessagingService.getMessageStats(1, 'camp-1');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('campaign_id = $2'),
          expect.arrayContaining([1, 'camp-1'])
        );
      });
    });
  });

  // ==================== RECOVERY SERVICE TESTS ====================
  describe('RecoveryService', () => {
    describe('createCampaign', () => {
      it('should create recovery campaign with all fields', async () => {
        db.query.mockResolvedValue({
          rows: [{
            id: 'camp-1',
            name: 'Test Campaign',
            campaign_type: 'cart_abandonment',
            status: 'draft'
          }]
        });

        const result = await RecoveryService.createCampaign(1, {
          name: 'Test Campaign',
          description: 'Test Description',
          campaign_type: 'cart_abandonment',
          bot_id: 'bot-1',
          channels: ['email', 'sms'],
          created_by: 'user-1'
        });

        expect(result.name).toBe('Test Campaign');
        expect(result.status).toBe('draft');
      });

      it('should throw error for invalid campaign type', async () => {
        await expect(
          RecoveryService.createCampaign(1, {
            name: 'Test',
            campaign_type: 'invalid_type'
          })
        ).rejects.toThrow('Invalid campaign type');
      });
    });

    describe('getCampaigns', () => {
      it('should get campaigns with filters', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [
              { id: 'c1', name: 'Campaign 1', status: 'active' },
              { id: 'c2', name: 'Campaign 2', status: 'active' }
            ]
          })
          .mockResolvedValueOnce({ rows: [{ count: '2' }] });

        const result = await RecoveryService.getCampaigns(1, { status: 'active' });

        expect(result.campaigns).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should apply pagination', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] });

        const result = await RecoveryService.getCampaigns(1, { limit: 10, offset: 20 });

        expect(result.limit).toBe(10);
        expect(result.offset).toBe(20);
      });
    });

    describe('updateCampaign', () => {
      it('should update campaign fields', async () => {
        db.query.mockResolvedValue({
          rows: [{
            id: 'camp-1',
            name: 'Updated Name',
            status: 'active'
          }]
        });

        const result = await RecoveryService.updateCampaign('camp-1', {
          name: 'Updated Name',
          status: 'active'
        });

        expect(result.name).toBe('Updated Name');
      });

      it('should throw error when no fields to update', async () => {
        await expect(
          RecoveryService.updateCampaign('camp-1', {})
        ).rejects.toThrow('No valid fields to update');
      });

      it('should throw error when campaign not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          RecoveryService.updateCampaign('nonexistent', { name: 'Test' })
        ).rejects.toThrow('Campaign not found');
      });
    });

    describe('deleteCampaign', () => {
      it('should delete campaign', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'camp-1' }] });

        const result = await RecoveryService.deleteCampaign('camp-1');

        expect(result).toBe(true);
      });

      it('should throw error when campaign not found', async () => {
        db.query.mockResolvedValue({ rows: [] });

        await expect(
          RecoveryService.deleteCampaign('nonexistent')
        ).rejects.toThrow('Campaign not found');
      });
    });

    describe('trackEvent', () => {
      it('should track recovery event', async () => {
        db.query.mockResolvedValue({
          rows: [{
            id: 'event-1',
            event_type: 'cart_abandoned',
            customer_id: 'cust-1',
            status: 'pending'
          }]
        });

        const result = await RecoveryService.trackEvent(1, 'cart_abandoned', {
          customer_id: 'cust-1',
          customer_email: 'test@example.com',
          potential_value: 100
        });

        expect(result.event_type).toBe('cart_abandoned');
      });

      it('should throw error for invalid event type', async () => {
        await expect(
          RecoveryService.trackEvent(1, 'invalid_type', { customer_id: 'cust-1' })
        ).rejects.toThrow('Invalid event type');
      });

      it('should throw error when customer_id is missing', async () => {
        await expect(
          RecoveryService.trackEvent(1, 'cart_abandoned', {})
        ).rejects.toThrow('customer_id is required');
      });
    });

    describe('processEvent', () => {
      it('should match event to active campaign', async () => {
        const event = {
          id: 'event-1',
          org_id: 1,
          event_type: 'cart_abandoned',
          customer_id: 'cust-1'
        };

        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              id: 'camp-1',
              name: 'Cart Campaign',
              campaign_type: 'cart_abandonment',
              status: 'active'
            }]
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryService.processEvent(event);

        expect(result.action).toBe('matched');
        expect(result.campaignId).toBe('camp-1');
      });

      it('should ignore purchase_completed events', async () => {
        const event = {
          id: 'event-1',
          org_id: 1,
          event_type: 'purchase_completed',
          customer_id: 'cust-1'
        };

        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryService.processEvent(event);

        expect(result.action).toBe('ignored');
      });

      it('should return no_campaign when no active campaign found', async () => {
        const event = {
          id: 'event-1',
          org_id: 1,
          event_type: 'cart_abandoned',
          customer_id: 'cust-1'
        };

        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryService.processEvent(event);

        expect(result.action).toBe('no_campaign');
      });
    });

    describe('getCustomerHealthScore', () => {
      it('should get customer health score with history', async () => {
        db.query
          .mockResolvedValueOnce({
            rows: [{
              id: 'health-1',
              customer_id: 'cust-1',
              health_score: 75,
              churn_probability: 0.25
            }]
          })
          .mockResolvedValueOnce({
            rows: [
              { health_score: 75, churn_probability: 0.25, recorded_at: new Date() },
              { health_score: 72, churn_probability: 0.28, recorded_at: new Date() }
            ]
          });

        const result = await RecoveryService.getCustomerHealthScore('cust-1');

        expect(result.health_score).toBe(75);
        expect(result.history).toHaveLength(2);
      });

      it('should return null when no health score exists', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryService.getCustomerHealthScore('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('getAnalytics', () => {
      it('should get comprehensive analytics', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({
            rows: [{
              total_recovered: '30',
              total_events: '100',
              total_revenue_recovered: '15000.00',
              total_revenue_at_risk: '50000.00',
              avg_recovery_value: '500.00'
            }]
          })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        const result = await RecoveryService.getAnalytics(1);

        expect(result.summary.total_events).toBe(100);
        expect(result.summary.recovery_rate).toBe('30.00');
      });
    });
  });

  // ==================== EDGE CASES & ERROR HANDLING ====================
  describe('Edge Cases & Error Handling', () => {
    describe('Database Edge Cases', () => {
      it('should handle null database responses', async () => {
        db.query.mockResolvedValue({ rows: null });

        await expect(
          AbandonedCartService.getRecoveryRate(1)
        ).rejects.toThrow();
      });

      it('should handle database connection failures', async () => {
        db.query.mockRejectedValue(new Error('Connection failed'));

        await expect(
          RecoveryService.getCampaigns(1)
        ).rejects.toThrow('Connection failed');
      });

      it('should handle empty arrays gracefully', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const result = await AbandonedCartService.getAbandonedCarts(1);

        expect(result.carts).toEqual([]);
        expect(result.total).toBe(0);
      });

      it('should handle malformed query results', async () => {
        db.query.mockResolvedValue({ rows: [{ invalid: 'data' }] });

        await expect(
          RecoveryAnalyticsService.getCampaignPerformance(1, 'camp-1')
        ).rejects.toThrow();
      });

      it('should handle undefined rows', async () => {
        db.query.mockResolvedValue({});

        await expect(
          ChurnPredictionService.getAtRiskCustomers(1, 0.5)
        ).rejects.toThrow();
      });

      it('should handle query timeout', async () => {
        db.query.mockRejectedValue(new Error('Query timeout'));

        await expect(
          RecoveryAnalyticsService.getDashboardStats(1)
        ).rejects.toThrow('Query timeout');
      });
    });

    describe('Null/Undefined Value Handling', () => {
      it('should handle null customer_id gracefully', async () => {
        await expect(
          ChurnPredictionService.calculateHealthScore(null, 1)
        ).rejects.toThrow();
      });

      it('should handle undefined organization ID', async () => {
        await expect(
          RecoveryService.getCampaigns(undefined)
        ).rejects.toThrow();
      });

      it('should handle null cart data', async () => {
        await expect(
          AbandonedCartService.generatePersonalizedOffer(null, {})
        ).rejects.toThrow();
      });

      it('should handle missing required fields in cart data', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { items: [] }, // missing cart_total
          {}
        );

        expect(result).toBeDefined();
      });

      it('should handle null customer history', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 100, items: [] },
          null
        );

        expect(result).toBeDefined();
      });
    });

    describe('Calculation Edge Cases', () => {
      it('should handle division by zero in recovery rate', async () => {
        db.query
          .mockResolvedValueOnce({
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
          })
          .mockResolvedValueOnce({ rows: [] });

        const result = await AbandonedCartService.getRecoveryRate(1);

        expect(result.summary.recovery_rate).toBe(0);
      });

      it('should cap churn probability at maximum', () => {
        const signals = Array(20).fill({ severity: 'critical' });
        const result = ChurnPredictionService.predictChurnProbability(0, signals);

        expect(result).toBeLessThanOrEqual(0.95);
      });

      it('should handle negative cart values', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: -10, items: [] },
          { total_orders: 5 }
        );

        expect(result.final_total).toBeGreaterThanOrEqual(0);
      });

      it('should handle very large cart values', async () => {
        const result = await AbandonedCartService.generatePersonalizedOffer(
          { cart_total: 999999, items: [] },
          { lifetime_value: 1000000, total_orders: 100 }
        );

        expect(result).toBeDefined();
        expect(result.discount_amount).toBeGreaterThan(0);
      });

      it('should handle health score boundary values', () => {
        expect(ChurnPredictionService.categorizeRisk(100)).toBe('very_low');
        expect(ChurnPredictionService.categorizeRisk(0)).toBe('critical');
        expect(ChurnPredictionService.categorizeRisk(80)).toBe('very_low');
        expect(ChurnPredictionService.categorizeRisk(79)).toBe('low');
      });
    });

    describe('Date/Time Edge Cases', () => {
      it('should handle future dates', async () => {
        const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryAnalyticsService.getRevenueRecovered(1, {
          start_date: futureDate,
          end_date: futureDate
        });

        expect(result).toBeDefined();
      });

      it('should handle inverted date ranges', async () => {
        const start = new Date('2024-12-31');
        const end = new Date('2024-01-01');

        db.query.mockResolvedValue({ rows: [] });

        const result = await RecoveryAnalyticsService.getRevenueRecovered(1, {
          start_date: start,
          end_date: end
        });

        expect(result).toBeDefined();
      });

      it('should handle very old dates', async () => {
        const oldDate = new Date('1970-01-01');

        db.query.mockResolvedValue({ rows: [] });

        await RecoveryAnalyticsService.getChurnStats(1, {
          start_date: oldDate,
          end_date: new Date()
        });

        expect(db.query).toHaveBeenCalled();
      });
    });

    describe('String/Text Edge Cases', () => {
      it('should handle very long campaign names', async () => {
        const longName = 'A'.repeat(1000);

        db.query.mockResolvedValue({
          rows: [{
            id: 'camp-1',
            name: longName,
            status: 'draft'
          }]
        });

        const result = await RecoveryService.createCampaign(1, {
          name: longName,
          campaign_type: 'cart_abandonment'
        });

        expect(result.name).toBe(longName);
      });

      it('should handle special characters in email', async () => {
        const result = await RecoveryMessagingService.sendEmailMessage(
          'test+tag@example.com',
          'Test Subject',
          'Test Body'
        );

        expect(result.success).toBe(true);
      });

      it('should handle HTML injection in message body', async () => {
        const maliciousBody = '<script>alert("xss")</script>';

        const result = await RecoveryMessagingService.sendEmailMessage(
          'test@example.com',
          'Test',
          maliciousBody
        );

        expect(result.success).toBe(true);
      });

      it('should format phone numbers correctly', async () => {
        process.env.TWILIO_ACCOUNT_SID = 'AC123';
        process.env.TWILIO_AUTH_TOKEN = 'token123';
        process.env.TWILIO_PHONE_NUMBER = '+1234567890';

        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ sid: 'SM123' })
        });

        const result = await RecoveryMessagingService.sendSMSMessage('1234567890', 'Test');

        expect(result.success).toBe(true);
      });
    });

    describe('Concurrency & Race Conditions', () => {
      it('should handle multiple simultaneous abandoned cart detections', async () => {
        const thirtyFiveMinutesAgo = new Date(Date.now() - 35 * 60 * 1000);

        db.query.mockResolvedValue({ rows: [] });
        const mockTrackEvent = require('../../../services/recoveryEngine/RecoveryService').trackEvent;
        mockTrackEvent.mockResolvedValue({ id: 'event-123' });

        const promises = Array(5).fill(null).map(() =>
          AbandonedCartService.detectAbandonedCart('session-1', {
            org_id: 1,
            customer_id: 'cust-1',
            cart_id: 'cart-1',
            last_activity_at: thirtyFiveMinutesAgo
          })
        );

        const results = await Promise.all(promises);

        expect(results.every(r => r.abandoned)).toBe(true);
      });

      it('should handle rapid status updates', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'event-1', status: 'recovered' }] });

        const promises = ['recovered', 'recovered', 'recovered'].map(status =>
          AbandonedCartService.trackCartRecovery('cart-1', status)
        );

        const results = await Promise.all(promises);

        expect(results.every(r => r.status === 'recovered')).toBe(true);
      });
    });

    describe('Boundary & Limit Testing', () => {
      it('should handle maximum pagination limit', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '10000' }] });

        const result = await AbandonedCartService.getAbandonedCarts(1, { limit: 1000 });

        expect(result.limit).toBe(1000);
      });

      it('should handle zero limit pagination', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] });

        const result = await AbandonedCartService.getAbandonedCarts(1, { limit: 0 });

        expect(result.carts).toEqual([]);
      });

      it('should handle very large offset', async () => {
        db.query
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '100' }] });

        const result = await AbandonedCartService.getAbandonedCarts(1, { offset: 999999 });

        expect(result.carts).toEqual([]);
      });
    });
  });
});
