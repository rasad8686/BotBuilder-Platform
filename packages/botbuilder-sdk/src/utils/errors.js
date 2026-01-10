/**
 * BotBuilder SDK Error Classes
 */

/**
 * Base error class for BotBuilder SDK
 */
class BotBuilderError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'BotBuilderError';
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Authentication error (401, 403)
 */
class AuthenticationError extends BotBuilderError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

/**
 * Resource not found error (404)
 */
class NotFoundError extends BotBuilderError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Validation error (400, 422)
 */
class ValidationError extends BotBuilderError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * Rate limit error (429)
 */
class RateLimitError extends BotBuilderError {
  constructor(message = 'Rate limit exceeded', details = {}) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = details.retryAfter || 60;
  }
}

module.exports = {
  BotBuilderError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  RateLimitError
};
