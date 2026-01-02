/**
 * API Audit Logs Routes
 * Endpoints for viewing and exporting API audit logs
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../db');
const logger = require('../utils/logger');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/audit-logs
 * Get paginated list of audit logs with filters
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      userId: filterUserId,
      tokenId,
      serviceAccountId,
      method,
      endpoint,
      statusCode,
      ipAddress,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('api_audit_logs')
      .select(
        'id',
        'user_id',
        'api_token_id',
        'service_account_id',
        'method',
        'endpoint',
        'status_code',
        'response_time_ms',
        'response_size_bytes',
        'ip_address',
        'user_agent',
        'geo_country',
        'geo_city',
        'error_message',
        'created_at'
      );

    let countQuery = db('api_audit_logs');

    // Filter by organization
    if (organizationId) {
      query = query.where('organization_id', organizationId);
      countQuery = countQuery.where('organization_id', organizationId);
    } else {
      query = query.where('user_id', userId);
      countQuery = countQuery.where('user_id', userId);
    }

    // Apply filters
    if (startDate) {
      query = query.where('created_at', '>=', new Date(startDate));
      countQuery = countQuery.where('created_at', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('created_at', '<=', new Date(endDate));
      countQuery = countQuery.where('created_at', '<=', new Date(endDate));
    }

    if (filterUserId) {
      query = query.where('user_id', filterUserId);
      countQuery = countQuery.where('user_id', filterUserId);
    }

    if (tokenId) {
      query = query.where('api_token_id', tokenId);
      countQuery = countQuery.where('api_token_id', tokenId);
    }

    if (serviceAccountId) {
      query = query.where('service_account_id', serviceAccountId);
      countQuery = countQuery.where('service_account_id', serviceAccountId);
    }

    if (method) {
      query = query.where('method', method.toUpperCase());
      countQuery = countQuery.where('method', method.toUpperCase());
    }

    if (endpoint) {
      query = query.where('endpoint', 'like', `%${endpoint}%`);
      countQuery = countQuery.where('endpoint', 'like', `%${endpoint}%`);
    }

    if (statusCode) {
      if (statusCode.includes('-')) {
        const [min, max] = statusCode.split('-').map(Number);
        query = query.whereBetween('status_code', [min, max]);
        countQuery = countQuery.whereBetween('status_code', [min, max]);
      } else {
        query = query.where('status_code', parseInt(statusCode));
        countQuery = countQuery.where('status_code', parseInt(statusCode));
      }
    }

    if (ipAddress) {
      query = query.where('ip_address', ipAddress);
      countQuery = countQuery.where('ip_address', ipAddress);
    }

    // Get total count
    const [{ count }] = await countQuery.count('id as count');

    // Apply sorting and pagination
    const validSortColumns = ['created_at', 'method', 'endpoint', 'status_code', 'response_time_ms'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc';

    const logs = await query
      .orderBy(sortColumn, order)
      .limit(parseInt(limit))
      .offset(offset);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

/**
 * GET /api/audit-logs/stats
 * Get aggregated statistics for audit logs
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { startDate, endDate, period = 'day' } = req.query;

    let baseQuery = db('api_audit_logs');

    // Filter by organization
    if (organizationId) {
      baseQuery = baseQuery.where('organization_id', organizationId);
    } else {
      baseQuery = baseQuery.where('user_id', userId);
    }

    // Apply date filters
    if (startDate) {
      baseQuery = baseQuery.where('created_at', '>=', new Date(startDate));
    }
    if (endDate) {
      baseQuery = baseQuery.where('created_at', '<=', new Date(endDate));
    }

    // Total requests
    const [totalResult] = await baseQuery.clone().count('id as count');

    // Requests by method
    const methodStats = await baseQuery.clone()
      .select('method')
      .count('id as count')
      .groupBy('method')
      .orderBy('count', 'desc');

    // Requests by status code range
    const statusStats = await baseQuery.clone()
      .select(db.raw(`
        CASE
          WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
          WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
          WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
          WHEN status_code >= 500 THEN '5xx'
          ELSE 'other'
        END as status_group
      `))
      .count('id as count')
      .groupBy('status_group');

    // Average response time
    const [avgResponse] = await baseQuery.clone()
      .avg('response_time_ms as avg_time')
      .max('response_time_ms as max_time')
      .min('response_time_ms as min_time');

    // Top endpoints
    const topEndpoints = await baseQuery.clone()
      .select('endpoint', 'method')
      .count('id as count')
      .avg('response_time_ms as avg_time')
      .groupBy('endpoint', 'method')
      .orderBy('count', 'desc')
      .limit(10);

    // Top error endpoints
    const topErrors = await baseQuery.clone()
      .where('status_code', '>=', 400)
      .select('endpoint', 'method', 'status_code')
      .count('id as count')
      .groupBy('endpoint', 'method', 'status_code')
      .orderBy('count', 'desc')
      .limit(10);

    // Requests over time
    let dateFormat;
    switch (period) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%W';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const timeSeriesQuery = baseQuery.clone()
      .select(db.raw(`DATE_FORMAT(created_at, '${dateFormat}') as period`))
      .count('id as count')
      .avg('response_time_ms as avg_time')
      .groupBy('period')
      .orderBy('period', 'asc');

    let timeSeries = [];
    try {
      timeSeries = await timeSeriesQuery;
    } catch {
      // SQLite fallback
      timeSeries = await baseQuery.clone()
        .select(db.raw(`strftime('${dateFormat.replace(/%/g, '%')}', created_at) as period`))
        .count('id as count')
        .avg('response_time_ms as avg_time')
        .groupBy('period')
        .orderBy('period', 'asc');
    }

    // Unique IPs
    const [uniqueIps] = await baseQuery.clone()
      .countDistinct('ip_address as count');

    res.json({
      success: true,
      stats: {
        totalRequests: parseInt(totalResult?.count || 0),
        uniqueIps: parseInt(uniqueIps?.count || 0),
        methodBreakdown: methodStats,
        statusBreakdown: statusStats,
        responseTime: {
          avg: Math.round(avgResponse?.avg_time || 0),
          max: avgResponse?.max_time || 0,
          min: avgResponse?.min_time || 0
        },
        topEndpoints,
        topErrors,
        timeSeries
      }
    });
  } catch (error) {
    logger.error('Error fetching audit log stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log statistics'
    });
  }
});

/**
 * GET /api/audit-logs/export
 * Export audit logs as CSV or JSON
 */
router.get('/export', async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const {
      format = 'json',
      startDate,
      endDate,
      limit = 10000
    } = req.query;

    let query = db('api_audit_logs')
      .select('*');

    // Filter by organization
    if (organizationId) {
      query = query.where('organization_id', organizationId);
    } else {
      query = query.where('user_id', userId);
    }

    // Apply date filters
    if (startDate) {
      query = query.where('created_at', '>=', new Date(startDate));
    }
    if (endDate) {
      query = query.where('created_at', '<=', new Date(endDate));
    }

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit));

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'id', 'created_at', 'method', 'endpoint', 'status_code',
        'response_time_ms', 'ip_address', 'user_agent', 'user_id',
        'api_token_id', 'error_message'
      ];

      let csv = headers.join(',') + '\n';

      logs.forEach(log => {
        const row = headers.map(header => {
          let value = log[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csv += row.join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
      return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.json`);
    res.json({
      exported_at: new Date().toISOString(),
      count: logs.length,
      logs
    });
  } catch (error) {
    logger.error('Error exporting audit logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs'
    });
  }
});

/**
 * GET /api/audit-logs/:id
 * Get detailed view of a single audit log
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    let query = db('api_audit_logs')
      .where('id', id);

    // Filter by organization
    if (organizationId) {
      query = query.where('organization_id', organizationId);
    } else {
      query = query.where('user_id', userId);
    }

    const log = await query.first();

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    // Parse JSON fields
    const parsedLog = {
      ...log,
      path_params: typeof log.path_params === 'string' ? JSON.parse(log.path_params) : log.path_params,
      query_params: typeof log.query_params === 'string' ? JSON.parse(log.query_params) : log.query_params,
      request_body: typeof log.request_body === 'string' ? JSON.parse(log.request_body) : log.request_body,
      request_headers: typeof log.request_headers === 'string' ? JSON.parse(log.request_headers) : log.request_headers
    };

    res.json({
      success: true,
      log: parsedLog
    });
  } catch (error) {
    logger.error('Error fetching audit log detail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log'
    });
  }
});

module.exports = router;
