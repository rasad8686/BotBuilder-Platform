const log = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * SECURITY: Hides stack traces and sensitive error details in production
 */

// Custom error class for API errors
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error codes mapping
const ERROR_CODES = {
  VALIDATION_ERROR: { status: 400, message: 'Validation failed' },
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'Access denied' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CONFLICT: { status: 409, message: 'Resource conflict' },
  RATE_LIMITED: { status: 429, message: 'Too many requests' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  DATABASE_ERROR: { status: 500, message: 'Database error' },
  EXTERNAL_SERVICE_ERROR: { status: 502, message: 'External service error' },
};

/**
 * Global error handler middleware
 * SECURITY: Never expose stack traces or internal error details in production
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let code = err.code || 'INTERNAL_ERROR';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Token expired';
  } else if (err.code === '23505') {
    // PostgreSQL unique violation
    statusCode = 409;
    code = 'CONFLICT';
    message = 'Resource already exists';
  } else if (err.code === '23503') {
    // PostgreSQL foreign key violation
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid reference';
  }

  // Log error with full details (including stack trace) - only to logs
  log.error('Request error', {
    code,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    organizationId: req.user?.organization_id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // SECURITY: Build safe response (no stack traces, no internal details)
  const response = {
    success: false,
    error: {
      code,
      message: process.env.NODE_ENV === 'production'
        ? ERROR_CODES[code]?.message || 'Something went wrong'
        : message,
    },
  };

  // Add request ID if available (for debugging)
  if (req.id) {
    response.error.requestId = req.id;
  }

  // SECURITY: Only include details in development
  if (process.env.NODE_ENV !== 'production') {
    response.error.details = err.message;
    response.error.path = req.path;
  }

  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  log.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: req.path,
    },
  });
};

/**
 * Async handler wrapper - catches async errors
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  APIError,
  ERROR_CODES,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
