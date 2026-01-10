/**
 * Tour Analytics Service
 * Handles all analytics business logic for Product Tours system
 */

const db = require('../config/db');

class TourAnalyticsService {
  /**
   * Get summary analytics for all tours in workspace
   * @param {string} workspaceId - Workspace ID
   * @param {Object} dateRange - { startDate, endDate }
   * @param {string} status - Optional status filter
   * @returns {Object} Summary analytics
   */
  async getSummary(workspaceId, dateRange, status = null) {
    const { startDate, endDate } = dateRange;

    let query = db('tour_analytics as ta')
      .join('tours as t', 't.id', 'ta.tour_id')
      .where('t.workspace_id', workspaceId);

    if (startDate) {
      query = query.where('ta.date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('ta.date', '<=', endDate);
    }
    if (status && status !== 'all') {
      query = query.where('t.status', status);
    }

    const totals = await query.clone()
      .select(
        db.raw('COUNT(DISTINCT t.id) as total_tours'),
        db.raw('COALESCE(SUM(ta.impressions), 0) as total_impressions'),
        db.raw('COALESCE(SUM(ta.starts), 0) as total_starts'),
        db.raw('COALESCE(SUM(ta.completions), 0) as total_completions'),
        db.raw('COALESCE(AVG(ta.completion_rate), 0) as avg_completion_rate')
      )
      .first();

    // Count active tours
    const activeTours = await db('tours')
      .where('workspace_id', workspaceId)
      .where('status', 'active')
      .count('id as count')
      .first();

    return {
      totalTours: parseInt(totals.total_tours) || 0,
      activeTours: parseInt(activeTours.count) || 0,
      totalImpressions: parseInt(totals.total_impressions) || 0,
      totalStarts: parseInt(totals.total_starts) || 0,
      totalCompletions: parseInt(totals.total_completions) || 0,
      avgCompletionRate: parseFloat(totals.avg_completion_rate).toFixed(1) || 0
    };
  }

  /**
   * Get daily statistics
   * @param {string} workspaceId - Workspace ID
   * @param {Object} dateRange - { startDate, endDate }
   * @param {string} tourId - Optional tour ID filter
   * @returns {Array} Daily statistics
   */
  async getDailyStats(workspaceId, dateRange, tourId = null) {
    const { startDate, endDate } = dateRange;

    let query = db('tour_analytics as ta')
      .join('tours as t', 't.id', 'ta.tour_id')
      .where('t.workspace_id', workspaceId)
      .select(
        'ta.date',
        db.raw('SUM(ta.impressions) as impressions'),
        db.raw('SUM(ta.starts) as starts'),
        db.raw('SUM(ta.completions) as completions'),
        db.raw('SUM(ta.dismissals) as dismissals')
      )
      .groupBy('ta.date')
      .orderBy('ta.date', 'asc');

    if (startDate) {
      query = query.where('ta.date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('ta.date', '<=', endDate);
    }
    if (tourId) {
      query = query.where('ta.tour_id', tourId);
    }

    const results = await query;

    return results.map(row => ({
      date: row.date,
      impressions: parseInt(row.impressions) || 0,
      starts: parseInt(row.starts) || 0,
      completions: parseInt(row.completions) || 0,
      dismissals: parseInt(row.dismissals) || 0
    }));
  }

  /**
   * Get funnel data for a specific tour
   * @param {string} tourId - Tour ID
   * @param {Object} dateRange - { startDate, endDate }
   * @returns {Object} Funnel data
   */
  async getFunnelData(tourId, dateRange) {
    const { startDate, endDate } = dateRange;

    // Get tour totals
    let query = db('tour_analytics')
      .where('tour_id', tourId);

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const totals = await query
      .select(
        db.raw('COALESCE(SUM(impressions), 0) as impressions'),
        db.raw('COALESCE(SUM(starts), 0) as started'),
        db.raw('COALESCE(SUM(completions), 0) as completed'),
        db.raw('COALESCE(SUM(dismissals), 0) as dismissed')
      )
      .first();

    // Get step-level views from events
    const stepViews = await db('tour_events')
      .join('tour_steps', 'tour_steps.id', 'tour_events.step_id')
      .where('tour_events.tour_id', tourId)
      .where('tour_events.event_type', 'step_viewed')
      .whereBetween('tour_events.created_at', [startDate, endDate])
      .select(
        'tour_steps.id as stepId',
        'tour_steps.step_order as stepOrder',
        'tour_steps.title',
        db.raw('COUNT(*) as views')
      )
      .groupBy('tour_steps.id', 'tour_steps.step_order', 'tour_steps.title')
      .orderBy('tour_steps.step_order', 'asc');

    return {
      impressions: parseInt(totals.impressions) || 0,
      started: parseInt(totals.started) || 0,
      completed: parseInt(totals.completed) || 0,
      dismissed: parseInt(totals.dismissed) || 0,
      stepViews: stepViews.map(s => ({
        stepId: s.stepId,
        stepOrder: s.stepOrder,
        title: s.title,
        views: parseInt(s.views) || 0
      }))
    };
  }

  /**
   * Get per-step analytics for a tour
   * @param {string} tourId - Tour ID
   * @param {Object} dateRange - { startDate, endDate }
   * @returns {Array} Step analytics
   */
  async getStepAnalytics(tourId, dateRange) {
    const { startDate, endDate } = dateRange;

    // Get steps
    const steps = await db('tour_steps')
      .where('tour_id', tourId)
      .orderBy('step_order', 'asc');

    // Get step events
    const stepMetrics = await db('tour_events')
      .where('tour_id', tourId)
      .whereIn('event_type', ['step_viewed', 'step_completed', 'step_skipped'])
      .whereBetween('created_at', [startDate || '2000-01-01', endDate || '2100-01-01'])
      .select(
        'step_id',
        'event_type',
        db.raw('COUNT(*) as count'),
        db.raw('AVG(CAST(event_data->>\'timeSpent\' AS FLOAT)) as avg_time')
      )
      .groupBy('step_id', 'event_type');

    // Build step metrics map
    const metricsMap = {};
    stepMetrics.forEach(m => {
      if (!metricsMap[m.step_id]) {
        metricsMap[m.step_id] = { views: 0, completions: 0, skipped: 0, avgTime: 0 };
      }
      if (m.event_type === 'step_viewed') {
        metricsMap[m.step_id].views = parseInt(m.count) || 0;
        metricsMap[m.step_id].avgTime = parseFloat(m.avg_time) || 0;
      } else if (m.event_type === 'step_completed') {
        metricsMap[m.step_id].completions = parseInt(m.count) || 0;
      } else if (m.event_type === 'step_skipped') {
        metricsMap[m.step_id].skipped = parseInt(m.count) || 0;
      }
    });

    return steps.map((step, index) => {
      const metrics = metricsMap[step.id] || { views: 0, completions: 0, skipped: 0, avgTime: 0 };
      const dropOffs = metrics.views - metrics.completions - metrics.skipped;
      const dropOffRate = metrics.views > 0 ? ((dropOffs / metrics.views) * 100).toFixed(1) : 0;

      return {
        stepId: step.id,
        stepOrder: step.step_order || index + 1,
        title: step.title || `Step ${index + 1}`,
        views: metrics.views,
        completions: metrics.completions,
        skipped: metrics.skipped,
        dropOffs: Math.max(0, dropOffs),
        dropOffRate: parseFloat(dropOffRate),
        avgTime: Math.round(metrics.avgTime)
      };
    });
  }

  /**
   * Get top performing tours
   * @param {string} workspaceId - Workspace ID
   * @param {number} limit - Number of tours to return
   * @param {string} sortBy - Sort field (completions, impressions, rate)
   * @param {Object} dateRange - { startDate, endDate }
   * @returns {Array} Top tours
   */
  async getTopTours(workspaceId, limit = 10, sortBy = 'completions', dateRange = {}) {
    const { startDate, endDate } = dateRange;

    let query = db('tour_analytics as ta')
      .join('tours as t', 't.id', 'ta.tour_id')
      .where('t.workspace_id', workspaceId)
      .select(
        't.id as tourId',
        't.name',
        't.status',
        db.raw('SUM(ta.impressions) as impressions'),
        db.raw('SUM(ta.starts) as starts'),
        db.raw('SUM(ta.completions) as completions'),
        db.raw('AVG(ta.completion_rate) as completion_rate'),
        db.raw('AVG(ta.avg_time_seconds) as avgTime')
      )
      .groupBy('t.id', 't.name', 't.status');

    if (startDate) {
      query = query.where('ta.date', '>=', startDate);
    }
    if (endDate) {
      query = query.where('ta.date', '<=', endDate);
    }

    // Sort
    const sortMap = {
      completions: 'completions',
      impressions: 'impressions',
      rate: 'completion_rate',
      starts: 'starts'
    };
    query = query.orderBy(sortMap[sortBy] || 'completions', 'desc');
    query = query.limit(limit);

    const results = await query;

    return results.map(row => ({
      tourId: row.tourId,
      name: row.name,
      status: row.status,
      impressions: parseInt(row.impressions) || 0,
      starts: parseInt(row.starts) || 0,
      completions: parseInt(row.completions) || 0,
      completion_rate: parseFloat(row.completion_rate).toFixed(1) || 0,
      avgTime: Math.round(parseFloat(row.avgTime)) || 0
    }));
  }

  /**
   * Calculate trends between two periods
   * @param {Object} current - Current period data
   * @param {Object} previous - Previous period data
   * @returns {Object} Trends
   */
  calculateTrends(current, previous) {
    const calc = (curr, prev) => {
      if (!prev || prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev * 100).toFixed(1);
    };

    return {
      impressions: parseFloat(calc(current.impressions, previous.impressions)),
      starts: parseFloat(calc(current.starts, previous.starts)),
      completions: parseFloat(calc(current.completions, previous.completions)),
      rate: parseFloat(calc(current.rate, previous.rate))
    };
  }

  /**
   * Export analytics data to CSV format
   * @param {Object} data - Data to export
   * @returns {string} CSV string
   */
  exportToCSV(data) {
    const rows = [];

    // Summary section
    if (data.summary) {
      rows.push('SUMMARY');
      rows.push(`Total Tours,${data.summary.totalTours}`);
      rows.push(`Total Impressions,${data.summary.totalImpressions}`);
      rows.push(`Total Completions,${data.summary.totalCompletions}`);
      rows.push(`Avg Completion Rate,${data.summary.avgCompletionRate}%`);
      rows.push('');
    }

    // Tours section
    if (data.tours && data.tours.length > 0) {
      rows.push('TOURS');
      rows.push('Name,Status,Impressions,Starts,Completions,Rate,Avg Time');
      data.tours.forEach(tour => {
        rows.push(`"${tour.name}",${tour.status},${tour.impressions},${tour.starts},${tour.completions},${tour.completion_rate}%,${tour.avgTime}s`);
      });
      rows.push('');
    }

    // Daily section
    if (data.daily && data.daily.length > 0) {
      rows.push('DAILY STATISTICS');
      rows.push('Date,Impressions,Starts,Completions,Dismissals');
      data.daily.forEach(day => {
        rows.push(`${day.date},${day.impressions},${day.starts},${day.completions},${day.dismissals}`);
      });
      rows.push('');
    }

    // Steps section
    if (data.steps && data.steps.length > 0) {
      rows.push('STEP BREAKDOWN');
      rows.push('Step #,Title,Views,Completions,Drop-off Rate,Avg Time');
      data.steps.forEach(step => {
        rows.push(`${step.stepOrder},"${step.title}",${step.views},${step.completions},${step.dropOffRate}%,${step.avgTime}s`);
      });
    }

    return rows.join('\n');
  }

  /**
   * Get analytics for workspace overview dashboard
   * @param {string} workspaceId - Workspace ID
   * @param {Object} dateRange - { startDate, endDate }
   * @returns {Object} Overview data
   */
  async getOverview(workspaceId, dateRange) {
    const [summary, daily, topTours] = await Promise.all([
      this.getSummary(workspaceId, dateRange),
      this.getDailyStats(workspaceId, dateRange),
      this.getTopTours(workspaceId, 5, 'completions', dateRange)
    ]);

    return {
      summary,
      daily,
      topTours
    };
  }
}

module.exports = new TourAnalyticsService();
