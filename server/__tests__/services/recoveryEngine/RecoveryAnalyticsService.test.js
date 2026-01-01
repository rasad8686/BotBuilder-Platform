/**
 * RecoveryAnalyticsService Tests
 * Tests for recovery analytics and reporting
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
const RecoveryAnalyticsService = require('../../../services/recoveryEngine/RecoveryAnalyticsService');

describe('RecoveryAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
            in_progress: '20',
            total_at_risk: '10000.00',
            total_recovered: '4000.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [{ active_campaigns: '5' }] })
        .mockResolvedValueOnce({
          rows: [{
            total_at_risk: '50',
            critical: '10',
            high: '15'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_sent: '200',
            opened: '150',
            clicked: '80',
            converted: '40'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            events_today: '10',
            recovered_today: '3',
            revenue_today: '300.00'
          }]
        });

      const result = await RecoveryAnalyticsService.getDashboardStats(1);

      expect(result.overview).toBeDefined();
      expect(result.overview.total_events_30d).toBe(100);
      expect(result.overview.total_recovered_30d).toBe(40); // 30 + 10
      expect(result.overview.recovery_rate).toBe('40.0'); // 40/100
      expect(result.campaigns.active).toBe(5);
      expect(result.customers_at_risk.total).toBe(50);
      expect(result.messages.sent).toBe(200);
      expect(result.today.events).toBe(10);
    });

    it('should handle zero events', async () => {
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

      db.query
        .mockResolvedValueOnce({ rows: [{ total_events: '0', recovered: '0', partially_recovered: '0', in_progress: '0', total_at_risk: '0', total_recovered: '0' }] })
        .mockResolvedValueOnce({ rows: [{ active_campaigns: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_at_risk: '0', critical: '0', high: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_sent: '0', opened: '0', clicked: '0', converted: '0' }] })
        .mockResolvedValueOnce({ rows: [{ events_today: '0', recovered_today: '0', revenue_today: '0' }] });

      const result = await RecoveryAnalyticsService.getDashboardStats(1);

      expect(result.overview.recovery_rate).toBe(0);
    });
  });

  describe('getRevenueRecovered', () => {
    it('should get revenue recovery data', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', recoveries: 5, revenue: '500.00', potential: '1000.00' },
            { date: '2024-01-02', recoveries: 3, revenue: '300.00', potential: '800.00' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '800.00',
            total_potential: '1800.00',
            total_recoveries: '8',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { event_type: 'cart_abandoned', recoveries: 5, revenue: '500.00' },
            { event_type: 'churn_risk', recoveries: 3, revenue: '300.00' }
          ]
        });

      const result = await RecoveryAnalyticsService.getRevenueRecovered(1);

      expect(result.summary.total_recovered).toBe(800);
      expect(result.summary.total_potential).toBe(1800);
      expect(result.summary.recovery_efficiency).toBe('44.4'); // 800/1800
      expect(result.daily).toHaveLength(2);
      expect(result.by_type).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      db.query.mockResolvedValue({ rows: [] });
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total_recovered: '0', total_potential: '0', total_recoveries: '0', avg_recovery_value: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      await RecoveryAnalyticsService.getRevenueRecovered(1, { start_date: startDate, end_date: endDate });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, startDate, endDate])
      );
    });

    it('should calculate recovery efficiency', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '7500.00',
            total_potential: '10000.00',
            total_recoveries: '50',
            avg_recovery_value: '150.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.getRevenueRecovered(1);

      expect(result.summary.recovery_efficiency).toBe('75.0');
    });
  });

  describe('getRecoveryRateByChannel', () => {
    it('should get channel performance data', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            channel: 'email',
            total_sent: '100',
            delivered: '95',
            opened: '50',
            clicked: '20',
            converted: '10',
            revenue: '1000.00'
          },
          {
            channel: 'whatsapp',
            total_sent: '50',
            delivered: '49',
            opened: '45',
            clicked: '30',
            converted: '20',
            revenue: '2000.00'
          }
        ]
      });

      const result = await RecoveryAnalyticsService.getRecoveryRateByChannel(1);

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].channel).toBe('whatsapp'); // Sorted by revenue DESC
      expect(result.channels[0].revenue).toBe(2000);
      expect(result.overall.total_sent).toBe(150);
      expect(result.best_channel).toBe('whatsapp');
    });

    it('should calculate channel rates correctly', async () => {
      db.query.mockResolvedValue({
        rows: [{
          channel: 'email',
          total_sent: '100',
          delivered: '90',
          opened: '45',
          clicked: '18',
          converted: '9',
          revenue: '900.00'
        }]
      });

      const result = await RecoveryAnalyticsService.getRecoveryRateByChannel(1);

      const emailChannel = result.channels[0];
      expect(emailChannel.delivery_rate).toBe('90.0'); // 90/100
      expect(emailChannel.open_rate).toBe('50.0'); // 45/90
      expect(emailChannel.click_rate).toBe('40.0'); // 18/45
      expect(emailChannel.conversion_rate).toBe('50.0'); // 9/18
    });

    it('should handle channels with zero sends', async () => {
      db.query.mockResolvedValue({
        rows: [{
          channel: 'telegram',
          total_sent: '0',
          delivered: '0',
          opened: '0',
          clicked: '0',
          converted: '0',
          revenue: '0'
        }]
      });

      const result = await RecoveryAnalyticsService.getRecoveryRateByChannel(1);

      expect(result.channels[0].delivery_rate).toBe(0);
      expect(result.channels[0].open_rate).toBe(0);
    });
  });

  describe('getCampaignPerformance', () => {
    it('should get campaign performance metrics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'campaign-1',
            name: 'Test Campaign',
            campaign_type: 'cart_abandonment',
            status: 'active',
            created_at: new Date()
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_events: '100',
            recovered: '30',
            partially_recovered: '10',
            failed: '20',
            pending: '40',
            total_potential: '10000.00',
            total_recovered: '4000.00',
            avg_recovery: '100.00'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_messages: '200',
            opened: '150',
            clicked: '80',
            converted: '40',
            bounced: '10',
            failed: '5'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Daily performance

      const result = await RecoveryAnalyticsService.getCampaignPerformance(1, 'campaign-1');

      expect(result.campaign.id).toBe('campaign-1');
      expect(result.events.total).toBe(100);
      expect(result.events.recovery_rate).toBe('40.0'); // (30+10)/100
      expect(result.revenue.potential).toBe(10000);
      expect(result.revenue.recovered).toBe(4000);
      expect(result.messages.total).toBe(200);
    });

    it('should throw error when campaign not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(RecoveryAnalyticsService.getCampaignPerformance(1, 'nonexistent'))
        .rejects.toThrow('Campaign not found');
    });

    it('should calculate revenue efficiency', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Test', campaign_type: 'cart_abandonment', status: 'active' }] })
        .mockResolvedValueOnce({
          rows: [{
            total_events: '50',
            recovered: '25',
            partially_recovered: '0',
            failed: '10',
            pending: '15',
            total_potential: '5000.00',
            total_recovered: '3750.00',
            avg_recovery: '150.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [{ total_messages: '100', opened: '80', clicked: '40', converted: '25', bounced: '5', failed: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.getCampaignPerformance(1, 'c1');

      expect(result.revenue.efficiency).toBe('75.0'); // 3750/5000
    });
  });

  describe('getAbandonedCartStats', () => {
    it('should get abandoned cart statistics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_abandoned: '100',
            recovered: '30',
            partially_recovered: '10',
            lost: '40',
            total_cart_value: '10000.00',
            recovered_value: '4000.00',
            avg_cart_value: '100.00',
            avg_recovery_hours: '24.5'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { value_range: '0-50', count: 20, recovered: 5 },
            { value_range: '50-100', count: 40, recovered: 15 },
            { value_range: '100-200', count: 30, recovered: 15 },
            { value_range: '200-500', count: 8, recovered: 4 },
            { value_range: '500+', count: 2, recovered: 1 }
          ]
        });

      const result = await RecoveryAnalyticsService.getAbandonedCartStats(1);

      expect(result.summary.total_abandoned).toBe(100);
      expect(result.summary.total_recovered).toBe(40); // 30 + 10
      expect(result.summary.recovery_rate).toBe('40.0');
      expect(result.summary.avg_recovery_hours).toBe('24.5');
      expect(result.value_distribution).toHaveLength(5);
    });

    it('should calculate lost value', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_abandoned: '50',
            recovered: '20',
            partially_recovered: '5',
            lost: '25',
            total_cart_value: '5000.00',
            recovered_value: '2000.00',
            avg_cart_value: '100.00',
            avg_recovery_hours: '18.0'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.getAbandonedCartStats(1);

      expect(result.summary.lost_value).toBe(3000); // 5000 - 2000
    });

    it('should calculate value distribution recovery rates', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_abandoned: '100',
            recovered: '30',
            partially_recovered: '10',
            lost: '40',
            total_cart_value: '10000.00',
            recovered_value: '4000.00',
            avg_cart_value: '100.00',
            avg_recovery_hours: '24.0'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { value_range: '100-200', count: 40, recovered: 20 }
          ]
        });

      const result = await RecoveryAnalyticsService.getAbandonedCartStats(1);

      expect(result.value_distribution[0].recovery_rate).toBe('50.0'); // 20/40
    });
  });

  describe('getChurnStats', () => {
    it('should get churn statistics', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_churn_risks: '50',
            prevented: '30',
            churned: '10',
            in_progress: '10',
            revenue_at_risk: '50000.00',
            revenue_saved: '30000.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Trend
        .mockResolvedValueOnce({
          rows: [
            { churn_risk_level: 'critical', count: 5, avg_probability: '0.8500' },
            { churn_risk_level: 'high', count: 10, avg_probability: '0.6500' },
            { churn_risk_level: 'medium', count: 15, avg_probability: '0.4500' }
          ]
        });

      const result = await RecoveryAnalyticsService.getChurnStats(1);

      expect(result.summary.total_at_risk).toBe(50);
      expect(result.summary.prevented).toBe(30);
      expect(result.summary.prevention_rate).toBe('60.0');
      expect(result.risk_distribution.critical.count).toBe(5);
      expect(result.risk_distribution.high.count).toBe(10);
    });

    it('should include health score trends', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_churn_risks: '20',
            prevented: '10',
            churned: '5',
            in_progress: '5',
            revenue_at_risk: '20000.00',
            revenue_saved: '10000.00'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { date: '2024-01-01', avg_score: 65, high_risk_count: 10 },
            { date: '2024-01-02', avg_score: 68, high_risk_count: 8 }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.getChurnStats(1);

      expect(result.trend).toHaveLength(2);
      expect(result.trend[0].avg_score).toBe(65);
    });

    it('should handle zero churn events', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_churn_risks: '0',
            prevented: '0',
            churned: '0',
            in_progress: '0',
            revenue_at_risk: '0',
            revenue_saved: '0'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.getChurnStats(1);

      expect(result.summary.prevention_rate).toBe('0');
    });
  });

  describe('getCustomerHealthDistribution', () => {
    it('should get health distribution by grade', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { health_grade: 'A', count: 20, avg_score: 90, avg_churn_prob: '0.1000' },
            { health_grade: 'B', count: 30, avg_score: 70, avg_churn_prob: '0.3000' },
            { health_grade: 'C', count: 25, avg_score: 50, avg_churn_prob: '0.5000' },
            { health_grade: 'D', count: 15, avg_score: 30, avg_churn_prob: '0.7000' },
            { health_grade: 'F', count: 10, avg_score: 10, avg_churn_prob: '0.9000' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] }) // Histogram
        .mockResolvedValueOnce({
          rows: [{
            total_customers: '100',
            avg_score: '62',
            min_score: '5',
            max_score: '98',
            median_score: '65'
          }]
        });

      const result = await RecoveryAnalyticsService.getCustomerHealthDistribution(1);

      expect(result.overall.total_customers).toBe(100);
      expect(result.overall.avg_score).toBe(62);
      expect(result.overall.median_score).toBe(65);
      expect(result.by_grade).toHaveLength(5);
    });

    it('should include score histogram', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { score_range: 0, count: 5 },
            { score_range: 10, count: 10 },
            { score_range: 20, count: 15 }
          ]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_customers: '30',
            avg_score: '25',
            min_score: '5',
            max_score: '29',
            median_score: '20'
          }]
        });

      const result = await RecoveryAnalyticsService.getCustomerHealthDistribution(1);

      expect(result.histogram).toHaveLength(3);
      expect(result.histogram[0].range).toBe('0-9');
      expect(result.histogram[1].range).toBe('10-19');
    });
  });

  describe('getTopRecoveredCustomers', () => {
    it('should get top customers by recovered revenue', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            customer_id: 'c1',
            customer_email: 'customer1@example.com',
            customer_name: 'Customer 1',
            recovery_count: 5,
            total_recovered: '5000.00',
            last_recovery: new Date()
          },
          {
            customer_id: 'c2',
            customer_email: 'customer2@example.com',
            customer_name: 'Customer 2',
            recovery_count: 3,
            total_recovered: '3000.00',
            last_recovery: new Date()
          }
        ]
      });

      const result = await RecoveryAnalyticsService.getTopRecoveredCustomers(1, 10);

      expect(result).toHaveLength(2);
      expect(result[0].total_recovered).toBe(5000);
      expect(result[0].recovery_count).toBe(5);
    });

    it('should use default limit of 10', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await RecoveryAnalyticsService.getTopRecoveredCustomers(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 10])
      );
    });
  });

  describe('getHourlyPerformance', () => {
    it('should get hourly performance data', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { hour: 9, total_sent: 20, opened: 15, clicked: 8, converted: 3, revenue: '300.00' },
            { hour: 14, total_sent: 30, opened: 25, clicked: 15, converted: 8, revenue: '800.00' },
            { hour: 19, total_sent: 25, opened: 20, clicked: 10, converted: 5, revenue: '500.00' }
          ]
        })
        .mockResolvedValueOnce({
          rows: [
            { day_of_week: 1, total_sent: 50, opened: 40, converted: 10 },
            { day_of_week: 3, total_sent: 60, opened: 50, converted: 15 }
          ]
        });

      const result = await RecoveryAnalyticsService.getHourlyPerformance(1);

      expect(result.hourly).toHaveLength(3);
      expect(result.daily).toHaveLength(2);
      expect(result.recommendations.best_hour).toBeDefined();
    });

    it('should identify best hour for sending', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [
            { hour: 10, total_sent: 50, opened: 40, clicked: 20, converted: 10, revenue: '1000.00' },
            { hour: 14, total_sent: 50, opened: 30, clicked: 15, converted: 5, revenue: '500.00' }
          ]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.getHourlyPerformance(1);

      expect(result.recommendations.best_hour).toBe(10);
      expect(result.recommendations.best_hour_open_rate).toBe('80.0');
    });

    it('should map day numbers to names', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { day_of_week: 0, total_sent: 10, opened: 8, converted: 2 },
            { day_of_week: 6, total_sent: 15, opened: 12, converted: 3 }
          ]
        });

      const result = await RecoveryAnalyticsService.getHourlyPerformance(1);

      expect(result.daily[0].day_name).toBe('Sunday');
      expect(result.daily[1].day_name).toBe('Saturday');
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive JSON report', async () => {
      // Mock all analytics calls
      db.query.mockResolvedValue({
        rows: [{
          total_events: '100',
          recovered: '30',
          partially_recovered: '10',
          in_progress: '20',
          total_at_risk: '10000.00',
          total_recovered: '4000.00',
          active_campaigns: '5',
          total_at_risk: '50',
          critical: '10',
          high: '15',
          total_sent: '200',
          opened: '150',
          clicked: '80',
          converted: '40',
          events_today: '10',
          recovered_today: '3',
          revenue_today: '300.00',
          total_potential: '10000.00',
          total_recoveries: '40',
          avg_recovery_value: '100.00',
          channel: 'email',
          delivered: '95',
          bounced: '5',
          failed: '0',
          revenue: '1000.00',
          total_abandoned: '80',
          lost: '20',
          total_cart_value: '8000.00',
          recovered_value: '3200.00',
          avg_cart_value: '100.00',
          avg_recovery_hours: '24.0',
          count: '20',
          avg_score: '70',
          avg_churn_prob: '0.30',
          total_customers: '100',
          min_score: '10',
          max_score: '95',
          median_score: '70',
          total_churn_risks: '30',
          prevented: '20',
          churned: '5',
          revenue_at_risk: '30000.00',
          revenue_saved: '20000.00',
          hour: '14',
          day_of_week: '2'
        }]
      });

      const result = await RecoveryAnalyticsService.generateReport(1);

      expect(result.generated_at).toBeDefined();
      expect(result.org_id).toBe(1);
      expect(result.dashboard).toBeDefined();
      expect(result.revenue).toBeDefined();
      expect(result.channels).toBeDefined();
      expect(result.abandoned_carts).toBeDefined();
      expect(result.churn).toBeDefined();
      expect(result.customer_health).toBeDefined();
      expect(result.timing_analysis).toBeDefined();
    });

    it('should generate CSV format report', async () => {
      db.query.mockResolvedValue({ rows: [] });
      db.query
        .mockResolvedValue({
          rows: [{
            total_events: '10',
            recovered: '5',
            partially_recovered: '0',
            in_progress: '2',
            total_at_risk: '1000.00',
            total_recovered: '500.00',
            active_campaigns: '1',
            critical: '0',
            high: '1',
            total_sent: '20',
            opened: '15',
            clicked: '8',
            converted: '5',
            events_today: '2',
            recovered_today: '1',
            revenue_today: '100.00',
            total_potential: '1000.00',
            total_recoveries: '5',
            avg_recovery_value: '100.00',
            count: '5',
            avg_score: '70',
            total_customers: '10',
            min_score: '50',
            max_score: '90',
            median_score: '70'
          }]
        });

      const result = await RecoveryAnalyticsService.generateReport(1, {}, 'csv');

      expect(result.format).toBe('csv');
      expect(result.content).toContain('Recovery Analytics Report');
      expect(result.content).toContain('DASHBOARD SUMMARY');
      expect(result.filename).toContain('.csv');
    });
  });

  describe('comparePerformance', () => {
    it('should compare two time periods', async () => {
      const period1 = { start_date: new Date('2024-02-01'), end_date: new Date('2024-02-29') };
      const period2 = { start_date: new Date('2024-01-01'), end_date: new Date('2024-01-31') };

      // Period 1 (current)
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Daily data
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '5000.00',
            total_potential: '10000.00',
            total_recoveries: '50',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // By type
        .mockResolvedValueOnce({ rows: [] }) // Channel data
        // Period 2 (previous)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '4000.00',
            total_potential: '10000.00',
            total_recoveries: '40',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.comparePerformance(1, period1, period2);

      expect(result.period1.revenue).toBe(5000);
      expect(result.period2.revenue).toBe(4000);
      expect(result.changes.revenue_change).toBe('25.0'); // (5000-4000)/4000
      expect(result.trend).toBe('improving');
    });

    it('should handle zero previous value', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '1000.00',
            total_potential: '2000.00',
            total_recoveries: '10',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '0',
            total_potential: '0',
            total_recoveries: '0',
            avg_recovery_value: '0'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.comparePerformance(1, {}, {});

      expect(result.changes.revenue_change).toBe('100.0');
    });

    it('should detect declining trend', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '3000.00',
            total_potential: '10000.00',
            total_recoveries: '30',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            total_recovered: '4000.00',
            total_potential: '10000.00',
            total_recoveries: '40',
            avg_recovery_value: '100.00'
          }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await RecoveryAnalyticsService.comparePerformance(1, {}, {});

      expect(result.trend).toBe('declining');
    });
  });
});
