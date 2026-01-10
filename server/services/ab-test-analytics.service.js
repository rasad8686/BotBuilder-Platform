/**
 * A/B Test Analytics Service
 * Handles analytics calculations and data aggregation for A/B tests
 */

const db = require('../config/db');

class ABTestAnalyticsService {
  /**
   * Get workspace-wide analytics
   */
  async getWorkspaceAnalytics(workspaceId, options = {}) {
    const {
      period = '30d',
      startDate,
      endDate,
      status = 'all'
    } = options;

    const { start, end } = this.getDateRange(period, startDate, endDate);

    try {
      // Get all tests
      let testsQuery = db('ab_tests')
        .where('workspace_id', workspaceId)
        .whereBetween('created_at', [start, end]);

      if (status !== 'all') {
        testsQuery = testsQuery.where('status', status);
      }

      const tests = await testsQuery;

      // Get aggregate stats
      const statsQuery = await db('ab_test_impressions as i')
        .join('ab_tests as t', 'i.test_id', 't.id')
        .where('t.workspace_id', workspaceId)
        .whereBetween('i.created_at', [start, end])
        .select(
          db.raw('COUNT(DISTINCT i.id) as total_impressions'),
          db.raw('COUNT(DISTINCT CASE WHEN i.converted = true THEN i.id END) as total_conversions')
        )
        .first();

      // Get tests with their metrics
      const testsWithMetrics = await Promise.all(
        tests.map(async (test) => {
          const metrics = await this.getTestMetrics(test.id, start, end);
          return { ...test, ...metrics };
        })
      );

      // Count by status
      const runningTests = testsWithMetrics.filter(t => t.status === 'running').length;
      const completedTests = testsWithMetrics.filter(t => t.status === 'completed').length;
      const testsWithWinners = testsWithMetrics.filter(t => t.winner_variant_id).length;

      // Calculate averages
      const totalImpressions = parseInt(statsQuery?.total_impressions) || 0;
      const totalConversions = parseInt(statsQuery?.total_conversions) || 0;
      const avgConversionRate = totalImpressions > 0
        ? (totalConversions / totalImpressions) * 100
        : 0;

      // Get timeline data
      const timeline = await this.getWorkspaceTimeline(workspaceId, start, end);

      // Calculate comparison with previous period
      const comparison = await this.getWorkspaceComparison(workspaceId, start, end);

      return {
        totalTests: tests.length,
        runningTests,
        completedTests,
        totalImpressions,
        totalConversions,
        avgConversionRate,
        testsWithWinners,
        tests: testsWithMetrics,
        timeline,
        comparison
      };
    } catch (error) {
      console.error('Error getting workspace analytics:', error);
      throw error;
    }
  }

  /**
   * Get single test analytics
   */
  async getTestAnalytics(testId, options = {}) {
    const { period = '30d', startDate, endDate } = options;
    const { start, end } = this.getDateRange(period, startDate, endDate);

    try {
      // Get test info
      const test = await db('ab_tests').where('id', testId).first();
      if (!test) {
        throw new Error('Test not found');
      }

      // Get variants with metrics
      const variants = await this.getVariantMetrics(testId, start, end);

      // Find control
      const control = variants.find(v => v.is_control);

      // Calculate statistical significance
      const statistics = this.calculateStatistics(variants, control);

      // Get timeline data
      const timeline = await this.getTestTimeline(testId, start, end);

      // Get hourly data
      const hourlyData = await this.getHourlyData(testId, start, end);

      // Determine winner
      let winner = null;
      if (statistics.isSignificant && statistics.lift > 0) {
        winner = variants.reduce((best, v) => {
          if (!best) return v;
          const rate = v.impressions > 0 ? v.conversions / v.impressions : 0;
          const bestRate = best.impressions > 0 ? best.conversions / best.impressions : 0;
          return rate > bestRate ? v : best;
        }, null)?.name;
      }

      return {
        ...test,
        variants,
        winner,
        ...statistics,
        timeline,
        hourlyData,
        funnelData: variants
      };
    } catch (error) {
      console.error('Error getting test analytics:', error);
      throw error;
    }
  }

  /**
   * Get variant metrics
   */
  async getVariantMetrics(testId, start, end) {
    const variants = await db('ab_test_variants')
      .where('test_id', testId)
      .select('*');

    const metricsPromises = variants.map(async (variant) => {
      const stats = await db('ab_test_impressions')
        .where('variant_id', variant.id)
        .whereBetween('created_at', [start, end])
        .select(
          db.raw('COUNT(*) as impressions'),
          db.raw('COUNT(CASE WHEN converted = true THEN 1 END) as conversions')
        )
        .first();

      const impressions = parseInt(stats?.impressions) || 0;
      const conversions = parseInt(stats?.conversions) || 0;
      const conversionRate = impressions > 0 ? (conversions / impressions) * 100 : 0;

      return {
        ...variant,
        impressions,
        conversions,
        conversionRate,
        isControl: variant.is_control
      };
    });

    return Promise.all(metricsPromises);
  }

  /**
   * Get test metrics
   */
  async getTestMetrics(testId, start, end) {
    const stats = await db('ab_test_impressions')
      .where('test_id', testId)
      .whereBetween('created_at', [start, end])
      .select(
        db.raw('COUNT(*) as impressions'),
        db.raw('COUNT(CASE WHEN converted = true THEN 1 END) as conversions')
      )
      .first();

    const impressions = parseInt(stats?.impressions) || 0;
    const conversions = parseInt(stats?.conversions) || 0;

    return {
      impressions,
      conversions,
      conversionRate: impressions > 0 ? (conversions / impressions) * 100 : 0
    };
  }

  /**
   * Get test timeline data
   */
  async getTestTimeline(testId, start, end) {
    const data = await db('ab_test_impressions as i')
      .join('ab_test_variants as v', 'i.variant_id', 'v.id')
      .where('i.test_id', testId)
      .whereBetween('i.created_at', [start, end])
      .select(
        db.raw('DATE(i.created_at) as date'),
        'v.name as variant_name',
        db.raw('COUNT(*) as impressions'),
        db.raw('COUNT(CASE WHEN i.converted = true THEN 1 END) as conversions')
      )
      .groupBy('date', 'v.name')
      .orderBy('date');

    return data.map(row => ({
      date: row.date,
      variantName: row.variant_name,
      impressions: parseInt(row.impressions) || 0,
      conversions: parseInt(row.conversions) || 0,
      conversionRate: row.impressions > 0
        ? (row.conversions / row.impressions) * 100
        : 0
    }));
  }

  /**
   * Get workspace timeline data
   */
  async getWorkspaceTimeline(workspaceId, start, end) {
    const data = await db('ab_test_impressions as i')
      .join('ab_tests as t', 'i.test_id', 't.id')
      .join('ab_test_variants as v', 'i.variant_id', 'v.id')
      .where('t.workspace_id', workspaceId)
      .whereBetween('i.created_at', [start, end])
      .select(
        db.raw('DATE(i.created_at) as date'),
        'v.name as variant_name',
        db.raw('COUNT(*) as impressions'),
        db.raw('COUNT(CASE WHEN i.converted = true THEN 1 END) as conversions')
      )
      .groupBy('date', 'v.name')
      .orderBy('date');

    return data.map(row => ({
      date: row.date,
      variantName: row.variant_name,
      impressions: parseInt(row.impressions) || 0,
      conversions: parseInt(row.conversions) || 0,
      conversionRate: row.impressions > 0
        ? (row.conversions / row.impressions) * 100
        : 0
    }));
  }

  /**
   * Get hourly performance data
   */
  async getHourlyData(testId, start, end) {
    const data = await db('ab_test_impressions as i')
      .join('ab_test_variants as v', 'i.variant_id', 'v.id')
      .where('i.test_id', testId)
      .whereBetween('i.created_at', [start, end])
      .select(
        db.raw('EXTRACT(DOW FROM i.created_at) as day_of_week'),
        db.raw('EXTRACT(HOUR FROM i.created_at) as hour'),
        'v.name as variant_name',
        db.raw('COUNT(*) as impressions'),
        db.raw('COUNT(CASE WHEN i.converted = true THEN 1 END) as conversions')
      )
      .groupBy('day_of_week', 'hour', 'v.name')
      .orderBy(['day_of_week', 'hour']);

    return data.map(row => ({
      dayOfWeek: parseInt(row.day_of_week),
      hour: parseInt(row.hour),
      variantName: row.variant_name,
      impressions: parseInt(row.impressions) || 0,
      conversions: parseInt(row.conversions) || 0,
      conversionRate: row.impressions > 0
        ? (row.conversions / row.impressions) * 100
        : 0
    }));
  }

  /**
   * Calculate statistical significance
   */
  calculateStatistics(variants, control) {
    if (!control || variants.length < 2) {
      return {
        confidence: 0,
        isSignificant: false,
        lift: 0,
        sampleSize: 0,
        recommendedSampleSize: 1000,
        dailyRate: 0
      };
    }

    const totalSampleSize = variants.reduce((sum, v) => sum + v.impressions, 0);
    const controlRate = control.impressions > 0
      ? control.conversions / control.impressions
      : 0;

    // Find best performing non-control variant
    const treatment = variants
      .filter(v => !v.isControl)
      .reduce((best, v) => {
        if (!best) return v;
        const rate = v.impressions > 0 ? v.conversions / v.impressions : 0;
        const bestRate = best.impressions > 0 ? best.conversions / best.impressions : 0;
        return rate > bestRate ? v : best;
      }, null);

    if (!treatment) {
      return {
        confidence: 0,
        isSignificant: false,
        lift: 0,
        sampleSize: totalSampleSize,
        recommendedSampleSize: 1000,
        dailyRate: 0
      };
    }

    const treatmentRate = treatment.impressions > 0
      ? treatment.conversions / treatment.impressions
      : 0;

    // Calculate Z-score for two-proportion test
    const pooledP = (control.conversions + treatment.conversions) /
                   (control.impressions + treatment.impressions);
    const pooledSE = Math.sqrt(
      pooledP * (1 - pooledP) * (1 / control.impressions + 1 / treatment.impressions)
    );

    const zScore = pooledSE > 0 ? (treatmentRate - controlRate) / pooledSE : 0;

    // Convert Z-score to confidence percentage (using normal distribution approximation)
    const confidence = Math.min(99.9, this.zToConfidence(Math.abs(zScore)));

    // Calculate lift
    const lift = controlRate > 0
      ? ((treatmentRate - controlRate) / controlRate) * 100
      : 0;

    // Estimate recommended sample size for 95% confidence with 80% power
    const recommendedSampleSize = this.calculateRequiredSampleSize(
      controlRate,
      controlRate * 1.1, // Assume 10% MDE
      0.05,
      0.8
    );

    return {
      confidence,
      isSignificant: confidence >= 95,
      lift,
      sampleSize: totalSampleSize,
      recommendedSampleSize,
      dailyRate: 0 // Would need historical data to calculate
    };
  }

  /**
   * Convert Z-score to confidence percentage
   */
  zToConfidence(z) {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return (0.5 * (1.0 + sign * y)) * 100;
  }

  /**
   * Calculate required sample size
   */
  calculateRequiredSampleSize(baseRate, expectedRate, alpha = 0.05, power = 0.8) {
    const zAlpha = 1.96; // For 95% confidence
    const zBeta = 0.84;  // For 80% power

    const p1 = baseRate;
    const p2 = expectedRate;
    const pAvg = (p1 + p2) / 2;

    const numerator = Math.pow(zAlpha * Math.sqrt(2 * pAvg * (1 - pAvg)) +
                              zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)), 2);
    const denominator = Math.pow(p2 - p1, 2);

    return Math.ceil(numerator / denominator) || 1000;
  }

  /**
   * Get period comparison data
   */
  async getWorkspaceComparison(workspaceId, currentStart, currentEnd) {
    const periodLength = currentEnd - currentStart;
    const previousStart = new Date(currentStart - periodLength);
    const previousEnd = currentStart;

    const [current, previous] = await Promise.all([
      this.getPeriodStats(workspaceId, currentStart, currentEnd),
      this.getPeriodStats(workspaceId, previousStart, previousEnd)
    ]);

    return { current, previous };
  }

  /**
   * Get stats for a period
   */
  async getPeriodStats(workspaceId, start, end) {
    const stats = await db('ab_test_impressions as i')
      .join('ab_tests as t', 'i.test_id', 't.id')
      .where('t.workspace_id', workspaceId)
      .whereBetween('i.created_at', [start, end])
      .select(
        db.raw('COUNT(*) as impressions'),
        db.raw('COUNT(CASE WHEN i.converted = true THEN 1 END) as conversions')
      )
      .first();

    const testsCreated = await db('ab_tests')
      .where('workspace_id', workspaceId)
      .whereBetween('created_at', [start, end])
      .count('id as count')
      .first();

    const impressions = parseInt(stats?.impressions) || 0;
    const conversions = parseInt(stats?.conversions) || 0;

    return {
      impressions,
      conversions,
      conversionRate: impressions > 0 ? (conversions / impressions) * 100 : 0,
      testsCreated: parseInt(testsCreated?.count) || 0
    };
  }

  /**
   * Compare two variants
   */
  async compareVariants(testId, variantA, variantB) {
    const variants = await this.getVariantMetrics(testId, new Date(0), new Date());

    const a = variants.find(v => v.name === variantA);
    const b = variants.find(v => v.name === variantB);

    if (!a || !b) {
      throw new Error('Variant not found');
    }

    const rateA = a.impressions > 0 ? a.conversions / a.impressions : 0;
    const rateB = b.impressions > 0 ? b.conversions / b.impressions : 0;

    const lift = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : 0;

    return {
      variantA: a,
      variantB: b,
      lift,
      winner: rateA > rateB ? variantA : variantB
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(testId, options = {}) {
    const { format = 'csv', period = '30d' } = options;
    const { start, end } = this.getDateRange(period);

    const data = await this.getTestAnalytics(testId, { period });

    if (format === 'csv') {
      return this.generateCSV(data);
    }

    return data;
  }

  /**
   * Generate CSV content
   */
  generateCSV(data) {
    const headers = ['Variant', 'Impressions', 'Conversions', 'Conversion Rate', 'Is Control'];
    const rows = data.variants.map(v => [
      v.name,
      v.impressions,
      v.conversions,
      `${v.conversionRate.toFixed(2)}%`,
      v.isControl ? 'Yes' : 'No'
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Get date range from period
   */
  getDateRange(period, customStart, customEnd) {
    const end = customEnd ? new Date(customEnd) : new Date();
    let start;

    switch (period) {
      case '7d':
        start = new Date(end - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(end - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        start = customStart ? new Date(customStart) : new Date(end - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        start = new Date(0);
        break;
      default:
        start = new Date(end - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }
}

module.exports = new ABTestAnalyticsService();
