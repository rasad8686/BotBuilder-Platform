/**
 * ChurnPredictionService Tests
 * Tests for AI-powered churn prediction and customer health scoring
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
const log = require('../../../utils/logger');
const ChurnPredictionService = require('../../../services/recoveryEngine/ChurnPredictionService');

describe('ChurnPredictionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateHealthScore', () => {
    it('should calculate health score with all components', async () => {
      // Mock customer data
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Existing health score
        .mockResolvedValueOnce({ // Engagement data - messages
          rows: [{
            total_messages: '10',
            opened: '8',
            clicked: '5',
            converted: '2'
          }]
        })
        .mockResolvedValueOnce({ // Engagement data - events
          rows: [{
            total_events: '20',
            active_days: '15',
            last_activity: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Churn signals
        .mockResolvedValueOnce({ // Financial score
          rows: [{
            lifetime_value: 1000,
            monthly_recurring_revenue: 100,
            payment_failures_count: 0
          }]
        })
        .mockResolvedValueOnce({ // Satisfaction score
          rows: [{
            nps_score: 50,
            satisfaction_score: 4,
            support_tickets_30d: 1,
            negative_feedback_count: 0
          }]
        })
        .mockResolvedValueOnce({ // Tenure score
          rows: [{
            subscription_start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          }]
        })
        .mockResolvedValue({ rows: [] }); // Save and history update

      const result = await ChurnPredictionService.calculateHealthScore('cust-1', 1);

      expect(result.health_score).toBeGreaterThan(0);
      expect(result.health_score).toBeLessThanOrEqual(100);
      expect(result.health_grade).toMatch(/^[A-F]$/);
      expect(result.churn_probability).toBeGreaterThanOrEqual(0);
      expect(result.churn_probability).toBeLessThanOrEqual(1);
      expect(result.score_breakdown).toBeDefined();
      expect(result.score_breakdown.engagement).toBeDefined();
      expect(result.score_breakdown.financial).toBeDefined();
      expect(result.score_breakdown.satisfaction).toBeDefined();
      expect(result.score_breakdown.tenure).toBeDefined();
      expect(result.score_breakdown.activity).toBeDefined();
    });

    it('should assign health grade A for score >= 80', async () => {
      db.query.mockResolvedValue({ rows: [] });
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '10', opened: '10', clicked: '8', converted: '5' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '30', active_days: '28', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ lifetime_value: 2000, monthly_recurring_revenue: 200, payment_failures_count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ nps_score: 80, satisfaction_score: 5, support_tickets_30d: 0, negative_feedback_count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ subscription_start_date: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000) }] })
        .mockResolvedValue({ rows: [] });

      const result = await ChurnPredictionService.calculateHealthScore('cust-1', 1);

      expect(result.health_score).toBeGreaterThanOrEqual(80);
      expect(result.health_grade).toBe('A');
    });

    it('should apply signal penalties to health score', async () => {
      const signals = [
        { type: 'login_decrease', severity: 'high' },
        { type: 'payment_issues', severity: 'critical' }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '5', opened: '3', clicked: '1', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '10', active_days: '5', last_activity: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }] })
        .mockResolvedValueOnce({ rows: [] }) // Will mock signals separately
        .mockResolvedValueOnce({ rows: [{ lifetime_value: 100, monthly_recurring_revenue: 50, payment_failures_count: 2 }] })
        .mockResolvedValueOnce({ rows: [{ nps_score: -20, satisfaction_score: 2, support_tickets_30d: 5, negative_feedback_count: 2 }] })
        .mockResolvedValueOnce({ rows: [{ subscription_start_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }] })
        .mockResolvedValue({ rows: [] });

      // Mock detectChurnSignals to return signals
      jest.spyOn(ChurnPredictionService, 'detectChurnSignals').mockResolvedValue(signals);

      const result = await ChurnPredictionService.calculateHealthScore('cust-1', 1);

      expect(result.risk_factors).toHaveLength(2);
      expect(result.signal_penalty).toBe(10); // 2 signals * 5 points each
    });

    it('should save health score to database', async () => {
      db.query.mockResolvedValue({ rows: [] });
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '5', opened: '3', clicked: '1', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '10', active_days: '5', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ lifetime_value: 500, monthly_recurring_revenue: 100, payment_failures_count: 0 }] })
        .mockResolvedValueOnce({ rows: [{ nps_score: 30, satisfaction_score: 3, support_tickets_30d: 2, negative_feedback_count: 1 }] })
        .mockResolvedValueOnce({ rows: [{ subscription_start_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }] })
        .mockResolvedValue({ rows: [] });

      await ChurnPredictionService.calculateHealthScore('cust-1', 1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customer_health_scores'),
        expect.any(Array)
      );
    });
  });

  describe('analyzeEngagement', () => {
    it('should analyze customer engagement over period', async () => {
      const now = new Date();
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_messages: '20',
            opened: '15',
            clicked: '10',
            converted: '3'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_events: '30',
            active_days: '20',
            last_activity: now
          }]
        });

      const result = await ChurnPredictionService.analyzeEngagement('cust-1', 30);

      expect(result.period_days).toBe(30);
      expect(result.total_messages).toBe(20);
      expect(result.messages_opened).toBe(15);
      expect(result.open_rate).toBe(75);
      expect(result.click_rate).toBe(50); // 10/20
      expect(result.conversion_rate).toBe(15); // 3/20
      expect(result.active_days).toBe(20);
      expect(result.activity_rate).toBe(66.67); // 20/30
      expect(result.days_since_activity).toBe(0);
    });

    it('should calculate days since last activity', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '0', opened: '0', clicked: '0', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '5', active_days: '2', last_activity: tenDaysAgo }] });

      const result = await ChurnPredictionService.analyzeEngagement('cust-1', 30);

      expect(result.days_since_activity).toBe(10);
    });

    it('should handle zero messages', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '0', opened: '0', clicked: '0', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '0', active_days: '0', last_activity: null }] });

      const result = await ChurnPredictionService.analyzeEngagement('cust-1', 30);

      expect(result.open_rate).toBe(0);
      expect(result.click_rate).toBe(0);
      expect(result.conversion_rate).toBe(0);
    });

    it('should analyze different time periods', async () => {
      db.query.mockResolvedValue({ rows: [{ total_messages: '5', opened: '3', clicked: '1', converted: '0' }] });
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '10', opened: '8', clicked: '4', converted: '1' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '15', active_days: '5', last_activity: new Date() }] });

      const result7 = await ChurnPredictionService.analyzeEngagement('cust-1', 7);
      expect(result7.period_days).toBe(7);

      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '50', opened: '40', clicked: '20', converted: '5' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '100', active_days: '60', last_activity: new Date() }] });

      const result90 = await ChurnPredictionService.analyzeEngagement('cust-1', 90);
      expect(result90.period_days).toBe(90);
    });
  });

  describe('detectChurnSignals', () => {
    it('should detect login decrease signal', async () => {
      // Recent 7 days: low activity
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '2', opened: '1', clicked: '0', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '3', active_days: '1', last_activity: new Date() }] })
        // Previous 14 days: high activity
        .mockResolvedValueOnce({ rows: [{ total_messages: '20', opened: '15', clicked: '10', converted: '3' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '30', active_days: '10', last_activity: new Date() }] })
        .mockResolvedValue({ rows: [{ ticket_count: '0', negative_count: '0', failed_count: '0', mention_count: '0' }] });

      const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

      const loginSignal = result.find(s => s.type === 'login_decrease');
      expect(loginSignal).toBeDefined();
      expect(loginSignal.severity).toBe('high');
    });

    it('should detect usage drop signal', async () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '0', opened: '0', clicked: '0', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '1', active_days: '0', last_activity: fifteenDaysAgo }] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '0', opened: '0', clicked: '0', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '1', active_days: '0', last_activity: fifteenDaysAgo }] })
        .mockResolvedValue({ rows: [{ ticket_count: '0', negative_count: '0', failed_count: '0', mention_count: '0' }] });

      const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

      const usageSignal = result.find(s => s.type === 'usage_drop');
      expect(usageSignal).toBeDefined();
      expect(usageSignal.severity).toBe('critical');
      expect(usageSignal.data.days_inactive).toBe(15);
    });

    it('should detect support ticket signal', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '5', opened: '3', clicked: '1', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '10', active_days: '5', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '10', opened: '7', clicked: '3', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '15', active_days: '10', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ ticket_count: '5' }] })
        .mockResolvedValue({ rows: [{ negative_count: '0', failed_count: '0', mention_count: '0' }] });

      const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

      const ticketSignal = result.find(s => s.type === 'support_tickets');
      expect(ticketSignal).toBeDefined();
      expect(ticketSignal.severity).toBe('critical');
      expect(ticketSignal.data.ticket_count).toBe(5);
    });

    it('should detect payment issues signal', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '5', opened: '3', clicked: '1', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '10', active_days: '5', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '10', opened: '7', clicked: '3', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '15', active_days: '10', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ failed_count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ mention_count: '0' }] });

      const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

      const paymentSignal = result.find(s => s.type === 'payment_issues');
      expect(paymentSignal).toBeDefined();
      expect(paymentSignal.severity).toBe('critical');
    });

    it('should detect competitor mention signal', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '5', opened: '3', clicked: '1', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '10', active_days: '5', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '10', opened: '7', clicked: '3', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '15', active_days: '10', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ ticket_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ negative_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ failed_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ mention_count: '1' }] });

      const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

      const competitorSignal = result.find(s => s.type === 'competitor_mention');
      expect(competitorSignal).toBeDefined();
      expect(competitorSignal.severity).toBe('high');
    });

    it('should return empty array when no signals detected', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_messages: '10', opened: '8', clicked: '5', converted: '2' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '20', active_days: '15', last_activity: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ total_messages: '20', opened: '16', clicked: '10', converted: '4' }] })
        .mockResolvedValueOnce({ rows: [{ total_events: '40', active_days: '30', last_activity: new Date() }] })
        .mockResolvedValue({ rows: [{ ticket_count: '0', negative_count: '0', failed_count: '0', mention_count: '0' }] });

      const result = await ChurnPredictionService.detectChurnSignals('cust-1', 1);

      expect(result).toEqual([]);
    });
  });

  describe('predictChurnProbability', () => {
    it('should predict low probability for high health score', () => {
      const result = ChurnPredictionService.predictChurnProbability(90, []);

      expect(result).toBeLessThan(0.2);
    });

    it('should predict high probability for low health score', () => {
      const result = ChurnPredictionService.predictChurnProbability(20, []);

      expect(result).toBeGreaterThan(0.7);
    });

    it('should increase probability with critical signals', () => {
      const signals = [
        { type: 'payment_issues', severity: 'critical' },
        { type: 'usage_drop', severity: 'critical' }
      ];

      const result = ChurnPredictionService.predictChurnProbability(50, signals);

      expect(result).toBeGreaterThan(0.5);
    });

    it('should never exceed 0.95 probability', () => {
      const signals = Array(10).fill({ type: 'test', severity: 'critical' });

      const result = ChurnPredictionService.predictChurnProbability(0, signals);

      expect(result).toBeLessThanOrEqual(0.95);
    });

    it('should never be negative', () => {
      const result = ChurnPredictionService.predictChurnProbability(100, []);

      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('categorizeRisk', () => {
    it('should categorize very low risk for score >= 80', () => {
      expect(ChurnPredictionService.categorizeRisk(85)).toBe('very_low');
      expect(ChurnPredictionService.categorizeRisk(100)).toBe('very_low');
    });

    it('should categorize low risk for score 60-79', () => {
      expect(ChurnPredictionService.categorizeRisk(60)).toBe('low');
      expect(ChurnPredictionService.categorizeRisk(75)).toBe('low');
    });

    it('should categorize medium risk for score 40-59', () => {
      expect(ChurnPredictionService.categorizeRisk(40)).toBe('medium');
      expect(ChurnPredictionService.categorizeRisk(55)).toBe('medium');
    });

    it('should categorize high risk for score 20-39', () => {
      expect(ChurnPredictionService.categorizeRisk(20)).toBe('high');
      expect(ChurnPredictionService.categorizeRisk(35)).toBe('high');
    });

    it('should categorize critical risk for score < 20', () => {
      expect(ChurnPredictionService.categorizeRisk(15)).toBe('critical');
      expect(ChurnPredictionService.categorizeRisk(0)).toBe('critical');
    });
  });

  describe('generateRetentionStrategy', () => {
    it('should generate critical strategy for critical risk', async () => {
      const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'critical');

      expect(result.priority).toBe('immediate');
      expect(result.actions).toBeDefined();
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.messaging.offer_aggressiveness).toBe('high');

      const personalCall = result.actions.find(a => a.type === 'personal_call');
      expect(personalCall).toBeDefined();
      expect(personalCall.timing).toBe('within_24h');
    });

    it('should generate high risk strategy', async () => {
      const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'high');

      expect(result.priority).toBe('urgent');
      expect(result.messaging.offer_aggressiveness).toBe('medium');

      const accountReview = result.actions.find(a => a.type === 'account_review');
      expect(accountReview).toBeDefined();
    });

    it('should generate medium risk strategy', async () => {
      const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'medium');

      expect(result.priority).toBe('proactive');
      expect(result.messaging.offer_aggressiveness).toBe('low');
    });

    it('should generate low risk strategy', async () => {
      const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'low');

      expect(result.priority).toBe('nurture');
      expect(result.messaging.offer_aggressiveness).toBe('none');
    });

    it('should generate very low risk strategy', async () => {
      const result = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'very_low');

      expect(result.priority).toBe('maintain');

      const advocacy = result.actions.find(a => a.type === 'advocacy');
      expect(advocacy).toBeDefined();
    });

    it('should include discount in critical/high strategies', async () => {
      const criticalResult = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'critical');
      const customOffer = criticalResult.actions.find(a => a.type === 'custom_offer');
      expect(customOffer.discount).toBeDefined();
      expect(customOffer.discount).toBeGreaterThan(0);
    });
  });

  describe('scheduleProactiveOutreach', () => {
    it('should schedule outreach actions', async () => {
      const strategy = await ChurnPredictionService.generateRetentionStrategy('cust-1', 'high');

      db.query.mockResolvedValue({ rows: [{ id: 'event-1', org_id: 1 }] });

      const result = await ChurnPredictionService.scheduleProactiveOutreach('cust-1', strategy);

      expect(result.scheduled_actions).toBeDefined();
      expect(result.scheduled_actions.length).toBeGreaterThan(0);
      expect(result.priority).toBe('urgent');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recovery_events'),
        expect.any(Array)
      );
    });

    it('should calculate scheduled times correctly', async () => {
      const strategy = {
        priority: 'immediate',
        actions: [
          { type: 'call', description: 'Call customer', timing: 'within_24h' },
          { type: 'email', description: 'Send email', timing: 'within_48h' }
        ],
        messaging: { tone: 'urgent' }
      };

      db.query.mockResolvedValue({ rows: [{ id: 'event-1', org_id: 1 }] });

      const result = await ChurnPredictionService.scheduleProactiveOutreach('cust-1', strategy);

      const now = Date.now();
      const action1Time = new Date(result.scheduled_actions[0].scheduled_at).getTime();
      const action2Time = new Date(result.scheduled_actions[1].scheduled_at).getTime();

      expect(action1Time).toBeGreaterThan(now);
      expect(action1Time).toBeLessThan(now + 25 * 60 * 60 * 1000);
      expect(action2Time).toBeGreaterThan(now + 47 * 60 * 60 * 1000);
    });
  });

  describe('getAtRiskCustomers', () => {
    it('should get customers above risk threshold', async () => {
      const mockCustomers = [
        { customer_id: 'c1', churn_probability: 0.8, churn_risk_level: 'critical', active_interventions: '0' },
        { customer_id: 'c2', churn_probability: 0.6, churn_risk_level: 'high', active_interventions: '1' }
      ];

      db.query.mockResolvedValue({ rows: mockCustomers });

      const result = await ChurnPredictionService.getAtRiskCustomers(1, 0.5);

      expect(result.total_at_risk).toBe(2);
      expect(result.threshold).toBe(0.5);
      expect(result.by_risk_level.critical).toHaveLength(1);
      expect(result.by_risk_level.high).toHaveLength(1);
      expect(result.summary.critical_count).toBe(1);
      expect(result.summary.high_count).toBe(1);
    });

    it('should use default threshold of 0.5', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await ChurnPredictionService.getAtRiskCustomers(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 0.5])
      );
    });

    it('should group by risk level correctly', async () => {
      const mockCustomers = [
        { customer_id: 'c1', churn_probability: 0.9, churn_risk_level: 'critical', active_interventions: '0' },
        { customer_id: 'c2', churn_probability: 0.85, churn_risk_level: 'critical', active_interventions: '0' },
        { customer_id: 'c3', churn_probability: 0.7, churn_risk_level: 'high', active_interventions: '0' },
        { customer_id: 'c4', churn_probability: 0.55, churn_risk_level: 'medium', active_interventions: '0' }
      ];

      db.query.mockResolvedValue({ rows: mockCustomers });

      const result = await ChurnPredictionService.getAtRiskCustomers(1, 0.5);

      expect(result.by_risk_level.critical).toHaveLength(2);
      expect(result.by_risk_level.high).toHaveLength(1);
      expect(result.by_risk_level.medium).toHaveLength(1);
    });
  });

  describe('updateHealthScoreHistory', () => {
    it('should update health score history', async () => {
      const mockCurrent = {
        id: 'score-1',
        health_score: 70,
        health_grade: 'B',
        churn_probability: 0.3,
        churn_risk_level: 'low'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCurrent] })
        .mockResolvedValueOnce({ rows: [{ id: 'history-1' }] })
        .mockResolvedValueOnce({ rows: [{ health_score: 75 }, { health_score: 72 }, { health_score: 68 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ChurnPredictionService.updateHealthScoreHistory('cust-1', 75, 1);

      expect(result.score).toBe(75);
      expect(result.previous_score).toBe(70);
      expect(result.change).toBe(5);
      expect(result.trend).toBe('improving');
    });

    it('should detect declining trend', async () => {
      const mockCurrent = {
        id: 'score-1',
        health_score: 70,
        health_grade: 'B',
        churn_probability: 0.3,
        churn_risk_level: 'low'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCurrent] })
        .mockResolvedValueOnce({ rows: [{ id: 'history-1' }] })
        .mockResolvedValueOnce({ rows: [{ health_score: 55 }, { health_score: 58 }, { health_score: 75 }, { health_score: 78 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ChurnPredictionService.updateHealthScoreHistory('cust-1', 55, 1);

      expect(result.trend).toBe('declining');
    });

    it('should detect critical decline', async () => {
      const mockCurrent = {
        id: 'score-1',
        health_score: 70,
        health_grade: 'B',
        churn_probability: 0.3,
        churn_risk_level: 'low'
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockCurrent] })
        .mockResolvedValueOnce({ rows: [{ id: 'history-1' }] })
        .mockResolvedValueOnce({ rows: [{ health_score: 45 }, { health_score: 48 }, { health_score: 75 }, { health_score: 78 }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ChurnPredictionService.updateHealthScoreHistory('cust-1', 45, 1);

      expect(result.trend).toBe('critical_decline');
    });

    it('should return null when no current score found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await ChurnPredictionService.updateHealthScoreHistory('nonexistent', 50, 1);

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
            medium_count: '20',
            low_count: '30',
            very_low_count: '35'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Trend
        .mockResolvedValueOnce({
          rows: [{
            total_churn_risks: '15',
            prevented: '10',
            lost: '3',
            prevention_rate: '66.67'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Risk signals

      const result = await ChurnPredictionService.getChurnAnalytics(1);

      expect(result.summary).toBeDefined();
      expect(result.summary.total_customers).toBe(100);
      expect(result.summary.avg_health_score).toBe(65.5);
      expect(result.summary.at_risk_count).toBe(35); // critical + high + medium
      expect(result.risk_distribution).toBeDefined();
      expect(result.churn_events).toBeDefined();
    });

    it('should include prevention rate', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_customers: '50',
            avg_health_score: '70',
            avg_churn_probability: '0.30',
            critical_count: '2',
            high_count: '5',
            medium_count: '10',
            low_count: '15',
            very_low_count: '18'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_churn_risks: '20',
            prevented: '15',
            lost: '5'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ChurnPredictionService.getChurnAnalytics(1);

      expect(result.churn_events.total).toBe(20);
      expect(result.churn_events.prevented).toBe(15);
      expect(result.churn_events.prevention_rate).toBe('75.00');
    });

    it('should handle zero events', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_customers: '10',
            avg_health_score: '80',
            avg_churn_probability: '0.15',
            critical_count: '0',
            high_count: '0',
            medium_count: '0',
            low_count: '5',
            very_low_count: '5'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_churn_risks: '0',
            prevented: '0',
            lost: '0'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await ChurnPredictionService.getChurnAnalytics(1);

      expect(result.churn_events.prevention_rate).toBe('0');
    });
  });
});
