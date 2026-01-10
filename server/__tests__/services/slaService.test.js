/**
 * SLA Service Tests
 * Tests for server/services/slaService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const slaService = require('../../services/slaService');

describe('SLA Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSLAConfig', () => {
    it('should return existing config', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          organization_id: 1,
          tier: 'premium',
          uptime_target: 99.95,
          response_time_target: 300,
          support_response_hours: 8
        }]
      });

      const config = await slaService.getSLAConfig(1);

      expect(config.tier).toBe('premium');
      expect(config.uptime_target).toBe(99.95);
    });

    it('should return default config if none exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const config = await slaService.getSLAConfig(1);

      expect(config.tier).toBe('standard');
      expect(config.uptime_target).toBe(99.9);
    });
  });

  describe('calculateUptime', () => {
    it('should calculate uptime correctly', async () => {
      // Mock no incidents table - use stored metrics
      db.query.mockRejectedValueOnce(new Error('incidents table not found'));
      db.query.mockResolvedValueOnce({
        rows: [{
          total_downtime_minutes: 60,
          incidents_count: 2
        }]
      });

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const result = await slaService.calculateUptime(1, periodStart, periodEnd);

      expect(result).toHaveProperty('totalMinutes');
      expect(result).toHaveProperty('uptimeMinutes');
      expect(result).toHaveProperty('downtimeMinutes');
      expect(result).toHaveProperty('uptimePercentage');
      expect(result.downtimeMinutes).toBe(60);
      expect(result.incidentsCount).toBe(2);
    });

    it('should return 100% uptime with no downtime', async () => {
      db.query.mockRejectedValueOnce(new Error('incidents table not found'));
      db.query.mockResolvedValueOnce({ rows: [] }); // No metrics

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-02');

      const result = await slaService.calculateUptime(1, periodStart, periodEnd);

      expect(result.downtimeMinutes).toBe(0);
      expect(result.uptimePercentage).toBe(100);
    });
  });

  describe('checkSLABreach', () => {
    it('should detect uptime breach', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'standard',
          uptime_target: 99.9,
          response_time_target: 500
        }]
      });

      const breaches = await slaService.checkSLABreach(1, {
        uptimePercentage: 99.5,
        avgResponseTime: 400
      });

      expect(breaches).toHaveLength(1);
      expect(breaches[0].type).toBe('uptime');
      expect(breaches[0].actual).toBe(99.5);
    });

    it('should detect response time breach', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'standard',
          uptime_target: 99.9,
          response_time_target: 500
        }]
      });

      const breaches = await slaService.checkSLABreach(1, {
        uptimePercentage: 99.95,
        avgResponseTime: 600
      });

      expect(breaches).toHaveLength(1);
      expect(breaches[0].type).toBe('response_time');
    });

    it('should return no breaches when SLA met', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'standard',
          uptime_target: 99.9,
          response_time_target: 500
        }]
      });

      const breaches = await slaService.checkSLABreach(1, {
        uptimePercentage: 99.95,
        avgResponseTime: 400
      });

      expect(breaches).toHaveLength(0);
    });
  });

  describe('calculateCredit', () => {
    it('should calculate uptime credit correctly', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'standard',
          uptime_target: 99.9,
          response_time_target: 500
        }]
      });

      const credit = await slaService.calculateCredit(1, 'uptime', 99.5, 1000);

      expect(credit.breachType).toBe('uptime');
      expect(credit.creditPercentage).toBeGreaterThan(0);
      expect(credit.creditAmount).toBeGreaterThan(0);
    });

    it('should return higher credit for lower uptime', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ tier: 'standard', uptime_target: 99.9 }]
      });

      const credit1 = await slaService.calculateCredit(1, 'uptime', 99.0, 1000);

      db.query.mockResolvedValueOnce({
        rows: [{ tier: 'standard', uptime_target: 99.9 }]
      });

      const credit2 = await slaService.calculateCredit(1, 'uptime', 95.0, 1000);

      expect(credit2.creditPercentage).toBeGreaterThan(credit1.creditPercentage);
    });
  });

  describe('generateSLAReport', () => {
    it('should generate report with all sections', async () => {
      // Config
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'standard',
          uptime_target: 99.9,
          response_time_target: 500,
          support_response_hours: 24
        }]
      });

      // Uptime calculation - incidents
      db.query.mockRejectedValueOnce(new Error('no incidents table'));
      db.query.mockResolvedValueOnce({ rows: [] });

      // Metrics
      db.query.mockResolvedValueOnce({
        rows: [{
          avg_response_time: 300
        }]
      });

      // Credits
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          credit_amount: 50,
          status: 'approved'
        }]
      });

      // Breach check config
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'standard',
          uptime_target: 99.9,
          response_time_target: 500
        }]
      });

      const report = await slaService.generateSLAReport(1, '2024-01');

      expect(report).toHaveProperty('organization_id', 1);
      expect(report).toHaveProperty('period', '2024-01');
      expect(report).toHaveProperty('sla_tier');
      expect(report).toHaveProperty('uptime_actual');
      expect(report).toHaveProperty('uptime_met');
      expect(report).toHaveProperty('breaches');
      expect(report).toHaveProperty('credits');
      expect(report).toHaveProperty('daily_uptime');
    });
  });

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      // Config
      db.query.mockResolvedValueOnce({
        rows: [{
          tier: 'premium',
          uptime_target: 99.95,
          response_time_target: 300,
          support_response_hours: 8
        }]
      });

      // Uptime - incidents
      db.query.mockRejectedValueOnce(new Error('no incidents'));
      db.query.mockResolvedValueOnce({ rows: [] });

      // Latest metrics
      db.query.mockResolvedValueOnce({
        rows: [{
          avg_response_time: 200
        }]
      });

      // Credits
      db.query.mockResolvedValueOnce({
        rows: [{ total_credits: 100 }]
      });

      // History
      db.query.mockResolvedValueOnce({
        rows: []
      });

      // Recent incidents
      db.query.mockRejectedValueOnce(new Error('no incidents table'));

      const data = await slaService.getDashboardData(1);

      expect(data).toHaveProperty('tier', 'premium');
      expect(data).toHaveProperty('current_uptime');
      expect(data).toHaveProperty('credit_balance');
      expect(data).toHaveProperty('daily_uptime');
    });
  });

  describe('getSLAHistory', () => {
    it('should return historical metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, period_start: '2024-01-01', uptime_actual: 99.95 },
          { id: 2, period_start: '2023-12-01', uptime_actual: 99.90 }
        ]
      });

      const history = await slaService.getSLAHistory(1, 12);

      expect(history).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 12]
      );
    });
  });

  describe('getSLACredits', () => {
    it('should return credit history', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, breach_type: 'uptime', credit_amount: 50, status: 'applied' },
          { id: 2, breach_type: 'uptime', credit_amount: 25, status: 'pending' }
        ]
      });

      const credits = await slaService.getSLACredits(1);

      expect(credits).toHaveLength(2);
    });
  });

  describe('getDailyUptime', () => {
    it('should return daily uptime data', async () => {
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-03');

      const dailyUptime = await slaService.getDailyUptime(1, periodStart, periodEnd);

      expect(dailyUptime.length).toBeGreaterThan(0);
      expect(dailyUptime[0]).toHaveProperty('date');
      expect(dailyUptime[0]).toHaveProperty('uptime');
      expect(dailyUptime[0]).toHaveProperty('status');
    });
  });

  describe('storeSLAMetrics', () => {
    it('should store metrics successfully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          organization_id: 1,
          uptime_actual: 99.95
        }]
      });

      const result = await slaService.storeSLAMetrics(1, {
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        uptime_actual: 99.95,
        avg_response_time: 300,
        total_downtime_minutes: 10,
        incidents_count: 1,
        sla_breaches: []
      });

      expect(result.uptime_actual).toBe(99.95);
    });
  });

  describe('SLA_TIERS', () => {
    it('should have correct tier configurations', () => {
      expect(slaService.SLA_TIERS).toHaveProperty('standard');
      expect(slaService.SLA_TIERS).toHaveProperty('premium');
      expect(slaService.SLA_TIERS).toHaveProperty('enterprise');

      expect(slaService.SLA_TIERS.standard.uptime_target).toBe(99.9);
      expect(slaService.SLA_TIERS.premium.uptime_target).toBe(99.95);
      expect(slaService.SLA_TIERS.enterprise.uptime_target).toBe(99.99);
    });
  });
});
