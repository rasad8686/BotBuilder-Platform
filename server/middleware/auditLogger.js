/**
 * API Audit Logger Middleware
 * Logs all API requests and responses for audit trail
 * Features:
 * - Async write for performance
 * - Sensitive data masking
 * - Request/response capture
 * - Geo-location from IP
 */

const db = require('../db');
const logger = require('../utils/logger');

// Sensitive field patterns to mask
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'api_key',
  'apiKey',
  'secret',
  'authorization',
  'card_number',
  'cardNumber',
  'cvv',
  'ssn',
  'credit_card',
  'creditCard',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'private_key',
  'privateKey'
];

// Headers to exclude from logging
const EXCLUDED_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token'
];

/**
 * Mask sensitive data in an object
 * @param {Object} obj - Object to mask
 * @param {number} depth - Current recursion depth
 * @returns {Object} Masked object
 */
const maskSensitiveData = (obj, depth = 0) => {
  if (depth > 5) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => maskSensitiveData(item, depth + 1));
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Check if this is a sensitive field
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      lowerKey.includes(field.toLowerCase())
    );

    if (isSensitive) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value, depth + 1);
    } else {
      masked[key] = value;
    }
  }
  return masked;
};

/**
 * Filter and mask headers
 * @param {Object} headers - Request headers
 * @returns {Object} Filtered headers
 */
const filterHeaders = (headers) => {
  const filtered = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (!EXCLUDED_HEADERS.includes(lowerKey)) {
      filtered[key] = value;
    } else {
      filtered[key] = '[REDACTED]';
    }
  }
  return filtered;
};

/**
 * Extract path parameters from request
 * @param {Object} req - Express request
 * @returns {Object} Path parameters
 */
const extractPathParams = (req) => {
  return req.params || {};
};

/**
 * Get client IP address
 * @param {Object} req - Express request
 * @returns {string} IP address
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

/**
 * Parse geo location from IP (simplified - would need GeoIP service)
 * @param {string} ip - IP address
 * @returns {Object} Geo location
 */
const parseGeoLocation = (ip) => {
  // In production, use a GeoIP service like MaxMind
  // For now, return null values
  return {
    country: null,
    city: null
  };
};

/**
 * Calculate response size
 * @param {Object} res - Express response
 * @returns {number} Size in bytes
 */
const getResponseSize = (res) => {
  const contentLength = res.get('content-length');
  if (contentLength) {
    return parseInt(contentLength, 10);
  }
  return 0;
};

/**
 * Write audit log to database asynchronously
 * @param {Object} logData - Audit log data
 */
const writeAuditLog = async (logData) => {
  try {
    await db('api_audit_logs').insert(logData);
  } catch (error) {
    logger.error('Failed to write audit log:', error);
  }
};

/**
 * Audit Logger Middleware
 * Captures request/response data and logs to database
 */
const auditLogger = (options = {}) => {
  const {
    excludePaths = ['/health', '/api/health', '/favicon.ico'],
    excludeMethods = [],
    logResponseBody = false,
    maxBodySize = 10000 // Max body size to log in bytes
  } = options;

  return (req, res, next) => {
    // Skip excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Skip excluded methods
    if (excludeMethods.includes(req.method)) {
      return next();
    }

    // Capture start time
    const startTime = Date.now();

    // Store original end function
    const originalEnd = res.end;
    let responseBody = '';

    // Override end to capture response
    res.end = function(chunk, encoding) {
      // Capture response body if enabled
      if (logResponseBody && chunk) {
        responseBody = chunk.toString();
      }

      // Restore original end
      res.end = originalEnd;
      res.end(chunk, encoding);

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Build audit log entry
      const logEntry = {
        organization_id: req.user?.organization_id || null,
        user_id: req.user?.id || null,
        api_token_id: req.apiToken?.id || null,
        service_account_id: req.serviceAccount?.id || null,

        // Request info
        method: req.method,
        endpoint: req.originalUrl?.split('?')[0] || req.path,
        path_params: JSON.stringify(extractPathParams(req)),
        query_params: JSON.stringify(maskSensitiveData(req.query || {})),
        request_body: JSON.stringify(maskSensitiveData(
          typeof req.body === 'object' ? req.body : {}
        )),
        request_headers: JSON.stringify(filterHeaders(req.headers || {})),

        // Response info
        status_code: res.statusCode,
        response_time_ms: responseTime,
        response_size_bytes: getResponseSize(res),

        // Context
        ip_address: getClientIp(req),
        user_agent: req.headers['user-agent'] || null,
        geo_country: parseGeoLocation(getClientIp(req)).country,
        geo_city: parseGeoLocation(getClientIp(req)).city,

        // Error message if applicable
        error_message: res.statusCode >= 400 ? (res.errorMessage || null) : null,

        created_at: new Date()
      };

      // Truncate large bodies
      if (logEntry.request_body.length > maxBodySize) {
        logEntry.request_body = JSON.stringify({ _truncated: true, _size: logEntry.request_body.length });
      }

      // Write asynchronously (fire and forget for performance)
      setImmediate(() => writeAuditLog(logEntry));
    };

    next();
  };
};

/**
 * Error capture middleware - should be used after error handler
 * Captures error messages for audit log
 */
const captureError = (err, req, res, next) => {
  res.errorMessage = err.message || 'Unknown error';
  next(err);
};

module.exports = {
  auditLogger,
  captureError,
  maskSensitiveData,
  filterHeaders,
  getClientIp
};
