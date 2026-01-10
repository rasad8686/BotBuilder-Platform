/**
 * Analytics Engine Service
 * Provides advanced analytics capabilities including custom metrics,
 * anomaly detection, report generation, and scheduling
 */

const db = require('../db');
const cron = require('node-cron');
const log = require('../utils/logger');

class AnalyticsEngine {
  constructor() {
    this.scheduledJobs = new Map();
    this.metricCalculators = {
      requests: this.calculateRequestMetrics.bind(this),
      latency: this.calculateLatencyMetrics.bind(this),
      errors: this.calculateErrorMetrics.bind(this),
      cost: this.calculateCostMetrics.bind(this)
    };
  }

  /**
   * Calculate custom metrics based on configuration
   */
  async calculateMetrics(organizationId, config) {
    const { metrics = [], dimensions = [], filters = {}, timeRange = {} } = config;
    const results = {};

    for (const metric of metrics) {
      if (this.metricCalculators[metric]) {
        results[metric] = await this.metricCalculators[metric](organizationId, dimensions, filters, timeRange);
      }
    }

    return results;
  }

  /**
   * Calculate request metrics
   */
  async calculateRequestMetrics(organizationId, dimensions, filters, timeRange) {
    const { startDate, endDate } = this.getTimeRange(timeRange);

    let query = db('api_key_usage')
      .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
      .where('api_tokens.organization_id', organizationId)
      .whereBetween('api_key_usage.created_at', [startDate, endDate]);

    if (filters.endpoint) {
      query = query.where('api_key_usage.endpoint', filters.endpoint);
    }

    const groupByColumns = this.getGroupByColumns(dimensions);

    if (groupByColumns.length > 0) {
      query = query
        .select(...groupByColumns)
        .select(db.raw('COUNT(*) as total_requests'))
        .select(db.raw('SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests'))
        .groupBy(...groupByColumns)
        .orderBy(groupByColumns[0]);
    } else {
      query = query
        .select(db.raw('COUNT(*) as total_requests'))
        .select(db.raw('SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as successful_requests'));
    }

    const data = await query;

    return {
      data,
      summary: {
        total: data.reduce((sum, row) => sum + parseInt(row.total_requests || 0), 0),
        successful: data.reduce((sum, row) => sum + parseInt(row.successful_requests || 0), 0)
      }
    };
  }

  /**
   * Calculate latency metrics
   */
  async calculateLatencyMetrics(organizationId, dimensions, filters, timeRange) {
    const { startDate, endDate } = this.getTimeRange(timeRange);

    let query = db('api_key_usage')
      .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
      .where('api_tokens.organization_id', organizationId)
      .whereBetween('api_key_usage.created_at', [startDate, endDate]);

    if (filters.endpoint) {
      query = query.where('api_key_usage.endpoint', filters.endpoint);
    }

    const groupByColumns = this.getGroupByColumns(dimensions);

    if (groupByColumns.length > 0) {
      query = query
        .select(...groupByColumns)
        .select(db.raw('AVG(response_time) as avg_latency'))
        .select(db.raw('MIN(response_time) as min_latency'))
        .select(db.raw('MAX(response_time) as max_latency'))
        .select(db.raw('PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_latency'))
        .select(db.raw('PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99_latency'))
        .groupBy(...groupByColumns)
        .orderBy(groupByColumns[0]);
    } else {
      query = query
        .select(db.raw('AVG(response_time) as avg_latency'))
        .select(db.raw('MIN(response_time) as min_latency'))
        .select(db.raw('MAX(response_time) as max_latency'));
    }

    const data = await query;

    return {
      data,
      summary: {
        avgLatency: data.length > 0 ? parseFloat(data[0].avg_latency || 0) : 0,
        minLatency: data.length > 0 ? parseFloat(data[0].min_latency || 0) : 0,
        maxLatency: data.length > 0 ? parseFloat(data[0].max_latency || 0) : 0
      }
    };
  }

  /**
   * Calculate error metrics
   */
  async calculateErrorMetrics(organizationId, dimensions, filters, timeRange) {
    const { startDate, endDate } = this.getTimeRange(timeRange);

    let query = db('api_key_usage')
      .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
      .where('api_tokens.organization_id', organizationId)
      .where('api_key_usage.status_code', '>=', 400)
      .whereBetween('api_key_usage.created_at', [startDate, endDate]);

    if (filters.endpoint) {
      query = query.where('api_key_usage.endpoint', filters.endpoint);
    }

    const groupByColumns = this.getGroupByColumns(dimensions);

    if (groupByColumns.length > 0) {
      query = query
        .select(...groupByColumns)
        .select('api_key_usage.status_code')
        .select(db.raw('COUNT(*) as error_count'))
        .groupBy(...groupByColumns, 'api_key_usage.status_code')
        .orderBy(groupByColumns[0]);
    } else {
      query = query
        .select('api_key_usage.status_code')
        .select(db.raw('COUNT(*) as error_count'))
        .groupBy('api_key_usage.status_code');
    }

    const data = await query;

    return {
      data,
      summary: {
        totalErrors: data.reduce((sum, row) => sum + parseInt(row.error_count || 0), 0),
        errorsByCode: data.reduce((acc, row) => {
          acc[row.status_code] = (acc[row.status_code] || 0) + parseInt(row.error_count || 0);
          return acc;
        }, {})
      }
    };
  }

  /**
   * Calculate cost metrics
   */
  async calculateCostMetrics(organizationId, dimensions, filters, timeRange) {
    const { startDate, endDate } = this.getTimeRange(timeRange);

    let query = db('api_key_usage')
      .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
      .where('api_tokens.organization_id', organizationId)
      .whereBetween('api_key_usage.created_at', [startDate, endDate]);

    if (filters.endpoint) {
      query = query.where('api_key_usage.endpoint', filters.endpoint);
    }

    const groupByColumns = this.getGroupByColumns(dimensions);

    if (groupByColumns.length > 0) {
      query = query
        .select(...groupByColumns)
        .select(db.raw('SUM(COALESCE(cost, 0)) as total_cost'))
        .select(db.raw('SUM(COALESCE(tokens_used, 0)) as total_tokens'))
        .groupBy(...groupByColumns)
        .orderBy(groupByColumns[0]);
    } else {
      query = query
        .select(db.raw('SUM(COALESCE(cost, 0)) as total_cost'))
        .select(db.raw('SUM(COALESCE(tokens_used, 0)) as total_tokens'));
    }

    const data = await query;

    return {
      data,
      summary: {
        totalCost: data.reduce((sum, row) => sum + parseFloat(row.total_cost || 0), 0),
        totalTokens: data.reduce((sum, row) => sum + parseInt(row.total_tokens || 0), 0)
      }
    };
  }

  /**
   * Detect anomalies using statistical methods (Z-score and IQR)
   */
  async detectAnomalies(organizationId, metricName, options = {}) {
    const { method = 'zscore', threshold = 3, lookbackDays = 30 } = options;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);

    // Get historical data
    const historicalData = await this.getHistoricalMetricData(organizationId, metricName, startDate, endDate);

    if (historicalData.length < 7) {
      return { anomalies: [], message: 'Insufficient data for anomaly detection' };
    }

    const values = historicalData.map(d => parseFloat(d.value));
    const anomalies = [];

    if (method === 'zscore') {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

      for (let i = 0; i < historicalData.length; i++) {
        const zScore = stdDev === 0 ? 0 : (values[i] - mean) / stdDev;

        if (Math.abs(zScore) > threshold) {
          const deviationPercent = ((values[i] - mean) / mean) * 100;
          const severity = this.getSeverityFromDeviation(Math.abs(deviationPercent));

          anomalies.push({
            metric_name: metricName,
            expected_value: mean,
            actual_value: values[i],
            deviation_percent: deviationPercent,
            severity,
            detected_at: historicalData[i].date,
            z_score: zScore
          });
        }
      }
    } else if (method === 'iqr') {
      const sorted = [...values].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - (threshold * iqr);
      const upperBound = q3 + (threshold * iqr);
      const median = sorted[Math.floor(sorted.length / 2)];

      for (let i = 0; i < historicalData.length; i++) {
        if (values[i] < lowerBound || values[i] > upperBound) {
          const deviationPercent = ((values[i] - median) / median) * 100;
          const severity = this.getSeverityFromDeviation(Math.abs(deviationPercent));

          anomalies.push({
            metric_name: metricName,
            expected_value: median,
            actual_value: values[i],
            deviation_percent: deviationPercent,
            severity,
            detected_at: historicalData[i].date
          });
        }
      }
    }

    // Store detected anomalies
    for (const anomaly of anomalies) {
      await db('analytics_anomalies').insert({
        organization_id: organizationId,
        metric_name: anomaly.metric_name,
        expected_value: anomaly.expected_value,
        actual_value: anomaly.actual_value,
        deviation_percent: anomaly.deviation_percent,
        severity: anomaly.severity,
        detected_at: anomaly.detected_at
      });
    }

    return { anomalies, method, threshold };
  }

  /**
   * Get historical metric data for anomaly detection
   */
  async getHistoricalMetricData(organizationId, metricName, startDate, endDate) {
    const metricQueries = {
      requests: db('api_key_usage')
        .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
        .where('api_tokens.organization_id', organizationId)
        .whereBetween('api_key_usage.created_at', [startDate, endDate])
        .select(db.raw("DATE(api_key_usage.created_at) as date"))
        .select(db.raw('COUNT(*) as value'))
        .groupByRaw('DATE(api_key_usage.created_at)')
        .orderBy('date'),

      latency: db('api_key_usage')
        .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
        .where('api_tokens.organization_id', organizationId)
        .whereBetween('api_key_usage.created_at', [startDate, endDate])
        .select(db.raw("DATE(api_key_usage.created_at) as date"))
        .select(db.raw('AVG(response_time) as value'))
        .groupByRaw('DATE(api_key_usage.created_at)')
        .orderBy('date'),

      errors: db('api_key_usage')
        .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
        .where('api_tokens.organization_id', organizationId)
        .where('api_key_usage.status_code', '>=', 400)
        .whereBetween('api_key_usage.created_at', [startDate, endDate])
        .select(db.raw("DATE(api_key_usage.created_at) as date"))
        .select(db.raw('COUNT(*) as value'))
        .groupByRaw('DATE(api_key_usage.created_at)')
        .orderBy('date'),

      cost: db('api_key_usage')
        .join('api_tokens', 'api_key_usage.api_token_id', 'api_tokens.id')
        .where('api_tokens.organization_id', organizationId)
        .whereBetween('api_key_usage.created_at', [startDate, endDate])
        .select(db.raw("DATE(api_key_usage.created_at) as date"))
        .select(db.raw('SUM(COALESCE(cost, 0)) as value'))
        .groupByRaw('DATE(api_key_usage.created_at)')
        .orderBy('date')
    };

    if (metricQueries[metricName]) {
      return await metricQueries[metricName];
    }

    return [];
  }

  /**
   * Get severity level from deviation percentage
   */
  getSeverityFromDeviation(deviationPercent) {
    if (deviationPercent >= 100) return 'critical';
    if (deviationPercent >= 50) return 'high';
    if (deviationPercent >= 25) return 'medium';
    return 'low';
  }

  /**
   * Generate report in specified format
   */
  async generateReport(reportId, format = 'json') {
    const report = await db('analytics_reports').where('id', reportId).first();

    if (!report) {
      throw new Error('Report not found');
    }

    const config = typeof report.config === 'string' ? JSON.parse(report.config) : report.config;
    const metrics = await this.calculateMetrics(report.organization_id, config);

    // Update last run timestamp
    await db('analytics_reports')
      .where('id', reportId)
      .update({ last_run_at: db.fn.now() });

    const reportData = {
      id: report.id,
      name: report.name,
      description: report.description,
      report_type: report.report_type,
      generated_at: new Date().toISOString(),
      config,
      metrics
    };

    if (format === 'csv') {
      return this.convertToCSV(reportData);
    } else if (format === 'pdf') {
      return this.generatePDFReport(reportData);
    }

    return reportData;
  }

  /**
   * Convert report data to CSV format
   */
  convertToCSV(reportData) {
    const rows = [];
    rows.push(`Report: ${reportData.name}`);
    rows.push(`Generated: ${reportData.generated_at}`);
    rows.push('');

    for (const [metricName, metricData] of Object.entries(reportData.metrics)) {
      rows.push(`Metric: ${metricName}`);

      if (metricData.data && metricData.data.length > 0) {
        const headers = Object.keys(metricData.data[0]);
        rows.push(headers.join(','));

        for (const row of metricData.data) {
          rows.push(headers.map(h => row[h]).join(','));
        }
      }

      if (metricData.summary) {
        rows.push('Summary:');
        for (const [key, value] of Object.entries(metricData.summary)) {
          rows.push(`${key},${typeof value === 'object' ? JSON.stringify(value) : value}`);
        }
      }

      rows.push('');
    }

    return {
      content: rows.join('\n'),
      contentType: 'text/csv',
      filename: `${reportData.name.replace(/\s+/g, '_')}_${Date.now()}.csv`
    };
  }

  /**
   * Generate PDF report (returns HTML for PDF conversion)
   */
  generatePDFReport(reportData) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${reportData.name}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    h2 { color: #666; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #007bff; color: white; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .summary { background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .meta { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <h1>${reportData.name}</h1>
  <p class="meta">Generated: ${reportData.generated_at}</p>
  ${reportData.description ? `<p>${reportData.description}</p>` : ''}

  ${Object.entries(reportData.metrics).map(([metricName, metricData]) => `
    <h2>${metricName.charAt(0).toUpperCase() + metricName.slice(1)} Metrics</h2>
    ${metricData.data && metricData.data.length > 0 ? `
      <table>
        <thead>
          <tr>${Object.keys(metricData.data[0]).map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${metricData.data.map(row => `
            <tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<p>No data available</p>'}
    ${metricData.summary ? `
      <div class="summary">
        <strong>Summary:</strong><br>
        ${Object.entries(metricData.summary).map(([k, v]) =>
          `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`
        ).join('<br>')}
      </div>
    ` : ''}
  `).join('')}
</body>
</html>`;

    return {
      content: html,
      contentType: 'text/html',
      filename: `${reportData.name.replace(/\s+/g, '_')}_${Date.now()}.html`
    };
  }

  /**
   * Schedule a report for periodic execution
   */
  async scheduleReport(reportId, schedule) {
    const report = await db('analytics_reports').where('id', reportId).first();

    if (!report) {
      throw new Error('Report not found');
    }

    // Cancel existing schedule if any
    if (this.scheduledJobs.has(reportId)) {
      this.scheduledJobs.get(reportId).stop();
      this.scheduledJobs.delete(reportId);
    }

    if (!schedule) {
      await db('analytics_reports')
        .where('id', reportId)
        .update({ schedule: null });
      return { message: 'Schedule removed' };
    }

    const cronExpression = this.getCronExpression(schedule);

    if (!cronExpression) {
      throw new Error('Invalid schedule. Use: daily, weekly, or monthly');
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        await this.generateReport(reportId);
        log.info(`Scheduled report ${reportId} executed successfully`);
      } catch (error) {
        log.error(`Error executing scheduled report ${reportId}:`, error);
      }
    });

    this.scheduledJobs.set(reportId, job);

    await db('analytics_reports')
      .where('id', reportId)
      .update({ schedule });

    return { message: `Report scheduled for ${schedule} execution`, cronExpression };
  }

  /**
   * Get cron expression for schedule type
   */
  getCronExpression(schedule) {
    const expressions = {
      daily: '0 0 * * *',      // Every day at midnight
      weekly: '0 0 * * 0',     // Every Sunday at midnight
      monthly: '0 0 1 * *'     // First day of month at midnight
    };
    return expressions[schedule];
  }

  /**
   * Get time range from config
   */
  getTimeRange(timeRange) {
    const endDate = timeRange.endDate ? new Date(timeRange.endDate) : new Date();
    let startDate;

    if (timeRange.startDate) {
      startDate = new Date(timeRange.startDate);
    } else {
      startDate = new Date();
      const period = timeRange.period || '7d';
      const value = parseInt(period);
      const unit = period.replace(/\d/g, '');

      switch (unit) {
        case 'h':
          startDate.setHours(startDate.getHours() - value);
          break;
        case 'd':
          startDate.setDate(startDate.getDate() - value);
          break;
        case 'w':
          startDate.setDate(startDate.getDate() - (value * 7));
          break;
        case 'm':
          startDate.setMonth(startDate.getMonth() - value);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }
    }

    return { startDate, endDate };
  }

  /**
   * Get group by columns based on dimensions
   */
  getGroupByColumns(dimensions) {
    const columnMap = {
      time: db.raw("DATE(api_key_usage.created_at) as time_period"),
      hour: db.raw("DATE_TRUNC('hour', api_key_usage.created_at) as time_period"),
      endpoint: 'api_key_usage.endpoint',
      region: 'api_key_usage.region',
      token: 'api_tokens.name as token_name'
    };

    return dimensions
      .filter(d => columnMap[d])
      .map(d => columnMap[d]);
  }

  /**
   * Get dashboard data with all key metrics
   */
  async getDashboardData(organizationId, timeRange = {}) {
    const config = {
      metrics: ['requests', 'latency', 'errors', 'cost'],
      dimensions: ['time'],
      timeRange
    };

    const metrics = await this.calculateMetrics(organizationId, config);

    // Get recent anomalies
    const anomalies = await db('analytics_anomalies')
      .where('organization_id', organizationId)
      .whereNull('acknowledged_at')
      .orderBy('detected_at', 'desc')
      .limit(10);

    // Get scheduled reports
    const scheduledReports = await db('analytics_reports')
      .where('organization_id', organizationId)
      .whereNotNull('schedule')
      .select('id', 'name', 'schedule', 'last_run_at');

    return {
      metrics,
      anomalies,
      scheduledReports
    };
  }
}

module.exports = new AnalyticsEngine();
