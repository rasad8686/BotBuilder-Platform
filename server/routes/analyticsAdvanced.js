/**
 * Analytics Pro Routes
 * Advanced analytics endpoints for custom metrics, reports, and anomaly detection
 */

const express = require('express');
const router = express.Router();
const analyticsEngine = require('../services/analyticsEngine');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/analytics/pro/dashboard
 * Get advanced dashboard data with all key metrics
 */
router.get('/dashboard', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { period, startDate, endDate } = req.query;

    const timeRange = {
      period: period || '7d',
      startDate,
      endDate
    };

    const dashboardData = await analyticsEngine.getDashboardData(organizationId, timeRange);

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/analytics/pro/metrics
 * Custom metrics builder - calculate metrics based on configuration
 */
router.get('/metrics', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { metrics, dimensions, period, startDate, endDate, endpoint } = req.query;

    const config = {
      metrics: metrics ? metrics.split(',') : ['requests'],
      dimensions: dimensions ? dimensions.split(',') : [],
      filters: {
        endpoint: endpoint || null
      },
      timeRange: {
        period: period || '7d',
        startDate,
        endDate
      }
    };

    const metricsData = await analyticsEngine.calculateMetrics(organizationId, config);

    res.json({
      success: true,
      data: metricsData,
      config
    });
  } catch (error) {
    console.error('Metrics calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate metrics'
    });
  }
});

/**
 * POST /api/analytics/pro/reports
 * Create a new custom report
 */
router.post('/reports', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { name, description, report_type, config, schedule } = req.body;

    if (!name || !report_type) {
      return res.status(400).json({
        success: false,
        error: 'Name and report_type are required'
      });
    }

    const validTypes = ['usage', 'performance', 'errors', 'custom'];
    if (!validTypes.includes(report_type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report_type. Must be: usage, performance, errors, or custom'
      });
    }

    const [reportId] = await db('analytics_reports').insert({
      organization_id: organizationId,
      name,
      description,
      report_type,
      config: JSON.stringify(config || {}),
      schedule: schedule || null
    }).returning('id');

    const report = await db('analytics_reports').where('id', reportId.id || reportId).first();

    // Schedule if needed
    if (schedule) {
      await analyticsEngine.scheduleReport(report.id, schedule);
    }

    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create report'
    });
  }
});

/**
 * GET /api/analytics/pro/reports
 * List all reports for organization
 */
router.get('/reports', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const reports = await db('analytics_reports')
      .where('organization_id', organizationId)
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('List reports error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list reports'
    });
  }
});

/**
 * GET /api/analytics/pro/reports/:id
 * Get a specific report
 */
router.get('/reports/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const report = await db('analytics_reports')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get report'
    });
  }
});

/**
 * PUT /api/analytics/pro/reports/:id
 * Update a report
 */
router.put('/reports/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;
    const { name, description, report_type, config, schedule } = req.body;

    const report = await db('analytics_reports')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (report_type) updates.report_type = report_type;
    if (config) updates.config = JSON.stringify(config);
    if (schedule !== undefined) updates.schedule = schedule;

    await db('analytics_reports')
      .where('id', id)
      .update(updates);

    // Update schedule if changed
    if (schedule !== undefined) {
      await analyticsEngine.scheduleReport(parseInt(id), schedule);
    }

    const updatedReport = await db('analytics_reports').where('id', id).first();

    res.json({
      success: true,
      data: updatedReport
    });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update report'
    });
  }
});

/**
 * DELETE /api/analytics/pro/reports/:id
 * Delete a report
 */
router.delete('/reports/:id', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const report = await db('analytics_reports')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Remove schedule if exists
    await analyticsEngine.scheduleReport(parseInt(id), null);

    await db('analytics_reports').where('id', id).delete();

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete report'
    });
  }
});

/**
 * GET /api/analytics/pro/reports/:id/run
 * Run a report and get results
 */
router.get('/reports/:id/run', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;

    const report = await db('analytics_reports')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    const result = await analyticsEngine.generateReport(parseInt(id), 'json');

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Run report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run report'
    });
  }
});

/**
 * GET /api/analytics/pro/reports/:id/export
 * Export report as PDF or CSV
 */
router.get('/reports/:id/export', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;
    const { format = 'csv' } = req.query;

    const report = await db('analytics_reports')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Use csv or pdf'
      });
    }

    const result = await analyticsEngine.generateReport(parseInt(id), format);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export report'
    });
  }
});

/**
 * GET /api/analytics/pro/anomalies
 * Get list of detected anomalies
 */
router.get('/anomalies', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { severity, metric, acknowledged, limit = 50, offset = 0 } = req.query;

    let query = db('analytics_anomalies')
      .where('organization_id', organizationId)
      .orderBy('detected_at', 'desc');

    if (severity) {
      query = query.where('severity', severity);
    }

    if (metric) {
      query = query.where('metric_name', metric);
    }

    if (acknowledged === 'true') {
      query = query.whereNotNull('acknowledged_at');
    } else if (acknowledged === 'false') {
      query = query.whereNull('acknowledged_at');
    }

    const total = await query.clone().count('* as count').first();

    const anomalies = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    res.json({
      success: true,
      data: anomalies,
      pagination: {
        total: parseInt(total.count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get anomalies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get anomalies'
    });
  }
});

/**
 * POST /api/analytics/pro/anomalies/detect
 * Trigger anomaly detection for a specific metric
 */
router.post('/anomalies/detect', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { metric, method = 'zscore', threshold = 3, lookbackDays = 30 } = req.body;

    if (!metric) {
      return res.status(400).json({
        success: false,
        error: 'Metric is required'
      });
    }

    const validMetrics = ['requests', 'latency', 'errors', 'cost'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid metric. Must be: requests, latency, errors, or cost'
      });
    }

    const result = await analyticsEngine.detectAnomalies(organizationId, metric, {
      method,
      threshold: parseFloat(threshold),
      lookbackDays: parseInt(lookbackDays)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Detect anomalies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect anomalies'
    });
  }
});

/**
 * POST /api/analytics/pro/anomalies/:id/acknowledge
 * Acknowledge an anomaly
 */
router.post('/anomalies/:id/acknowledge', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.id;
    const { id } = req.params;

    const anomaly = await db('analytics_anomalies')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!anomaly) {
      return res.status(404).json({
        success: false,
        error: 'Anomaly not found'
      });
    }

    if (anomaly.acknowledged_at) {
      return res.status(400).json({
        success: false,
        error: 'Anomaly already acknowledged'
      });
    }

    await db('analytics_anomalies')
      .where('id', id)
      .update({
        acknowledged_at: db.fn.now(),
        acknowledged_by: userId
      });

    const updated = await db('analytics_anomalies').where('id', id).first();

    res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Acknowledge anomaly error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge anomaly'
    });
  }
});

/**
 * POST /api/analytics/pro/reports/:id/schedule
 * Schedule or unschedule a report
 */
router.post('/reports/:id/schedule', async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { id } = req.params;
    const { schedule } = req.body;

    const report = await db('analytics_reports')
      .where('id', id)
      .where('organization_id', organizationId)
      .first();

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    if (schedule && !['daily', 'weekly', 'monthly'].includes(schedule)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid schedule. Use: daily, weekly, monthly, or null to remove'
      });
    }

    const result = await analyticsEngine.scheduleReport(parseInt(id), schedule || null);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Schedule report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule report'
    });
  }
});

module.exports = router;
