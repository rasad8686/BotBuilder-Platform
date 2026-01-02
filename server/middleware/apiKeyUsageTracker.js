/**
 * @fileoverview API Key Usage Tracker Middleware
 * @description Tracks API usage statistics per API token.
 * Records endpoint, method, response time, status code, and more.
 * @module middleware/apiKeyUsageTracker
 */

const db = require('../db');
const crypto = require('crypto');
const log = require('../utils/logger');

/**
 * Extract API token from request
 * Supports Bearer token in Authorization header
 * @param {Object} req - Express request object
 * @returns {string|null} - Token or null
 */
function extractApiToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} - IP address
 */
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Verify API token and get token ID
 * @param {string} token - Raw API token
 * @returns {Promise<Object|null>} - Token record or null
 */
async function verifyApiToken(token) {
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await db.query(
      `SELECT id, organization_id, bot_id, is_active, expires_at
       FROM api_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tokenRecord = result.rows[0];

    // Check if token is active
    if (!tokenRecord.is_active) {
      return null;
    }

    // Check if token is expired
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return null;
    }

    return tokenRecord;
  } catch (error) {
    log.error('[API_KEY_USAGE] Error verifying token:', { error: error.message });
    return null;
  }
}

/**
 * Record API usage asynchronously (fire and forget)
 * @param {Object} usageData - Usage data to record
 */
async function recordUsage(usageData) {
  try {
    await db.query(
      `INSERT INTO api_key_usage (
        api_token_id, endpoint, method, status_code,
        response_time_ms, tokens_used, cost_usd,
        ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        usageData.api_token_id,
        usageData.endpoint,
        usageData.method,
        usageData.status_code,
        usageData.response_time_ms,
        usageData.tokens_used || 0,
        usageData.cost_usd || 0,
        usageData.ip_address,
        usageData.user_agent
      ]
    );

    // Update last_used_at on api_tokens
    await db.query(
      `UPDATE api_tokens SET last_used_at = NOW() WHERE id = $1`,
      [usageData.api_token_id]
    );
  } catch (error) {
    log.error('[API_KEY_USAGE] Error recording usage:', { error: error.message });
  }
}

/**
 * API Key Usage Tracker Middleware
 * Tracks API requests made with API tokens
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const apiKeyUsageTracker = async (req, res, next) => {
  const startTime = Date.now();
  const token = extractApiToken(req);

  // If no API token, skip tracking (might be JWT auth)
  if (!token) {
    return next();
  }

  // Verify token
  const tokenRecord = await verifyApiToken(token);

  if (!tokenRecord) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired API token'
    });
  }

  // Attach token info to request for downstream use
  req.apiToken = tokenRecord;

  // Capture original end function
  const originalEnd = res.end;

  // Override end to capture response
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Record usage asynchronously (fire and forget)
    recordUsage({
      api_token_id: tokenRecord.id,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      status_code: res.statusCode,
      response_time_ms: responseTime,
      tokens_used: res.locals?.tokensUsed || 0,
      cost_usd: res.locals?.costUsd || 0,
      ip_address: getClientIp(req),
      user_agent: req.headers['user-agent'] || 'unknown'
    });

    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Optional middleware to authenticate via API token only
 * Use this for public API endpoints that require API key authentication
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const authenticateApiToken = async (req, res, next) => {
  const token = extractApiToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'API token required. Use Authorization: Bearer <token>'
    });
  }

  const tokenRecord = await verifyApiToken(token);

  if (!tokenRecord) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired API token'
    });
  }

  // Attach token info to request
  req.apiToken = tokenRecord;

  // Set user context from API token for compatibility
  req.user = {
    id: null, // API tokens don't have a user context
    organization_id: tokenRecord.organization_id
  };
  req.organization = {
    id: tokenRecord.organization_id
  };

  next();
};

/**
 * Get usage statistics for an API token
 * @param {number} tokenId - API token ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Usage statistics
 */
async function getTokenUsageStats(tokenId, options = {}) {
  const { period = '30d', groupBy = 'day' } = options;

  // Calculate date range
  let intervalSql;
  switch (period) {
    case '24h':
      intervalSql = "NOW() - INTERVAL '24 hours'";
      break;
    case '7d':
      intervalSql = "NOW() - INTERVAL '7 days'";
      break;
    case '30d':
    default:
      intervalSql = "NOW() - INTERVAL '30 days'";
      break;
    case '90d':
      intervalSql = "NOW() - INTERVAL '90 days'";
      break;
  }

  // Get summary stats
  const summaryResult = await db.query(
    `SELECT
       COUNT(*) as total_requests,
       COALESCE(AVG(response_time_ms), 0) as avg_response_time,
       COALESCE(SUM(tokens_used), 0) as total_tokens,
       COALESCE(SUM(cost_usd), 0) as total_cost,
       COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
       COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests
     FROM api_key_usage
     WHERE api_token_id = $1 AND created_at >= ${intervalSql}`,
    [tokenId]
  );

  // Get time series data
  let timeGroupSql;
  switch (groupBy) {
    case 'hour':
      timeGroupSql = "DATE_TRUNC('hour', created_at)";
      break;
    case 'day':
    default:
      timeGroupSql = "DATE_TRUNC('day', created_at)";
      break;
    case 'week':
      timeGroupSql = "DATE_TRUNC('week', created_at)";
      break;
  }

  const timeSeriesResult = await db.query(
    `SELECT
       ${timeGroupSql} as period,
       COUNT(*) as requests,
       COALESCE(AVG(response_time_ms), 0) as avg_response_time,
       COALESCE(SUM(tokens_used), 0) as tokens_used,
       COALESCE(SUM(cost_usd), 0) as cost
     FROM api_key_usage
     WHERE api_token_id = $1 AND created_at >= ${intervalSql}
     GROUP BY ${timeGroupSql}
     ORDER BY period ASC`,
    [tokenId]
  );

  // Get top endpoints
  const topEndpointsResult = await db.query(
    `SELECT
       endpoint,
       method,
       COUNT(*) as request_count,
       COALESCE(AVG(response_time_ms), 0) as avg_response_time
     FROM api_key_usage
     WHERE api_token_id = $1 AND created_at >= ${intervalSql}
     GROUP BY endpoint, method
     ORDER BY request_count DESC
     LIMIT 10`,
    [tokenId]
  );

  // Get status code distribution
  const statusDistResult = await db.query(
    `SELECT
       status_code,
       COUNT(*) as count
     FROM api_key_usage
     WHERE api_token_id = $1 AND created_at >= ${intervalSql}
     GROUP BY status_code
     ORDER BY count DESC`,
    [tokenId]
  );

  const summary = summaryResult.rows[0] || {};

  return {
    summary: {
      totalRequests: parseInt(summary.total_requests) || 0,
      avgResponseTime: Math.round(parseFloat(summary.avg_response_time) || 0),
      totalTokens: parseInt(summary.total_tokens) || 0,
      totalCost: parseFloat(summary.total_cost) || 0,
      successfulRequests: parseInt(summary.successful_requests) || 0,
      failedRequests: parseInt(summary.failed_requests) || 0,
      successRate: summary.total_requests > 0
        ? Math.round((summary.successful_requests / summary.total_requests) * 100)
        : 0
    },
    timeSeries: timeSeriesResult.rows.map(row => ({
      period: row.period,
      requests: parseInt(row.requests),
      avgResponseTime: Math.round(parseFloat(row.avg_response_time)),
      tokensUsed: parseInt(row.tokens_used),
      cost: parseFloat(row.cost)
    })),
    topEndpoints: topEndpointsResult.rows.map(row => ({
      endpoint: row.endpoint,
      method: row.method,
      requestCount: parseInt(row.request_count),
      avgResponseTime: Math.round(parseFloat(row.avg_response_time))
    })),
    statusDistribution: statusDistResult.rows.map(row => ({
      statusCode: row.status_code,
      count: parseInt(row.count)
    }))
  };
}

module.exports = {
  apiKeyUsageTracker,
  authenticateApiToken,
  getTokenUsageStats,
  verifyApiToken,
  recordUsage
};
