/**
 * V2 API Error Codes
 * Professional, consistent error handling
 */

const ErrorCodes = {
  // Authentication Errors (1000-1099)
  AUTH_TOKEN_MISSING: { code: 'AUTH_TOKEN_MISSING', status: 401, message: 'Authentication token is required' },
  AUTH_TOKEN_INVALID: { code: 'AUTH_TOKEN_INVALID', status: 401, message: 'Authentication token is invalid' },
  AUTH_TOKEN_EXPIRED: { code: 'AUTH_TOKEN_EXPIRED', status: 401, message: 'Authentication token has expired' },
  AUTH_INSUFFICIENT_PERMISSIONS: { code: 'AUTH_INSUFFICIENT_PERMISSIONS', status: 403, message: 'Insufficient permissions for this action' },

  // Validation Errors (2000-2099)
  VALIDATION_ERROR: { code: 'VALIDATION_ERROR', status: 400, message: 'Validation failed' },
  INVALID_REQUEST_BODY: { code: 'INVALID_REQUEST_BODY', status: 400, message: 'Request body is invalid' },
  INVALID_QUERY_PARAMS: { code: 'INVALID_QUERY_PARAMS', status: 400, message: 'Query parameters are invalid' },
  MISSING_REQUIRED_FIELD: { code: 'MISSING_REQUIRED_FIELD', status: 400, message: 'Required field is missing' },

  // Resource Errors (3000-3099)
  RESOURCE_NOT_FOUND: { code: 'RESOURCE_NOT_FOUND', status: 404, message: 'Resource not found' },
  BOT_NOT_FOUND: { code: 'BOT_NOT_FOUND', status: 404, message: 'Bot not found' },
  MESSAGE_NOT_FOUND: { code: 'MESSAGE_NOT_FOUND', status: 404, message: 'Message not found' },
  AGENT_NOT_FOUND: { code: 'AGENT_NOT_FOUND', status: 404, message: 'Agent not found' },
  KNOWLEDGE_NOT_FOUND: { code: 'KNOWLEDGE_NOT_FOUND', status: 404, message: 'Knowledge base not found' },
  WEBHOOK_NOT_FOUND: { code: 'WEBHOOK_NOT_FOUND', status: 404, message: 'Webhook not found' },

  // Rate Limiting (4000-4099)
  RATE_LIMIT_EXCEEDED: { code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Rate limit exceeded' },
  QUOTA_EXCEEDED: { code: 'QUOTA_EXCEEDED', status: 429, message: 'API quota exceeded' },

  // Conflict Errors (5000-5099)
  RESOURCE_CONFLICT: { code: 'RESOURCE_CONFLICT', status: 409, message: 'Resource conflict' },
  DUPLICATE_RESOURCE: { code: 'DUPLICATE_RESOURCE', status: 409, message: 'Resource already exists' },
  IDEMPOTENCY_CONFLICT: { code: 'IDEMPOTENCY_CONFLICT', status: 409, message: 'Idempotency key already used with different parameters' },

  // Server Errors (6000-6099)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', status: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', status: 503, message: 'Service temporarily unavailable' },
  DATABASE_ERROR: { code: 'DATABASE_ERROR', status: 500, message: 'Database operation failed' },
  EXTERNAL_SERVICE_ERROR: { code: 'EXTERNAL_SERVICE_ERROR', status: 502, message: 'External service error' },

  // Webhook Errors (7000-7099)
  WEBHOOK_SIGNATURE_INVALID: { code: 'WEBHOOK_SIGNATURE_INVALID', status: 401, message: 'Webhook signature is invalid' },
  WEBHOOK_PAYLOAD_INVALID: { code: 'WEBHOOK_PAYLOAD_INVALID', status: 400, message: 'Webhook payload is invalid' },
  WEBHOOK_DELIVERY_FAILED: { code: 'WEBHOOK_DELIVERY_FAILED', status: 500, message: 'Webhook delivery failed' }
};

/**
 * Create an API error
 */
class ApiError extends Error {
  constructor(errorCode, details = null) {
    super(errorCode.message);
    this.code = errorCode.code;
    this.status = errorCode.status;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details })
    };
  }
}

module.exports = {
  ErrorCodes,
  ApiError
};
