const Joi = require('joi');

/**
 * XSS Sanitization - Remove dangerous HTML/script content
 * This is a simple sanitizer that removes script tags and event handlers
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;

  return str
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs that could contain scripts
    .replace(/data:\s*text\/html/gi, '')
    // Remove dangerous tags
    .replace(/<(iframe|object|embed|form|input|link|meta|style)[^>]*>/gi, '')
    // Escape remaining < and > to prevent HTML injection
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to sanitize request body
 */
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

// Password complexity pattern (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Validation schemas
const schemas = {
  // User registration validation - Enhanced password rules
  register: Joi.object({
    username: Joi.string()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.pattern.base': 'Username can only contain letters, numbers, underscores and hyphens'
      }),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(passwordPattern)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number'
      }),
  }),

  // User login validation
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  // Bot creation validation
  createBot: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    platform: Joi.string().valid('telegram', 'discord', 'slack', 'whatsapp', 'web', 'messenger').required(),
    description: Joi.string().max(500).allow('').optional(),
    api_token: Joi.string().max(500).allow('').optional(),
  }),

  // Bot update validation
  updateBot: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(500).allow('').optional(),
    platform: Joi.string().valid('telegram', 'discord', 'slack', 'whatsapp', 'web', 'messenger').optional(),
    is_active: Joi.boolean().optional(),
    api_token: Joi.string().max(500).allow('').optional(),
  }),

  // Message validation
  createMessage: Joi.object({
    bot_id: Joi.number().integer().required(),
    message_type: Joi.string().valid('response', 'command', 'error', 'greeting', 'fallback').required(),
    content: Joi.string().min(1).max(5000).required(),
    trigger_keywords: Joi.array().items(Joi.string()).optional(),
  }),

  // Password reset request
  passwordResetRequest: Joi.object({
    email: Joi.string().email().required(),
  }),

  // Password reset confirm
  passwordResetConfirm: Joi.object({
    token: Joi.string().required(),
    password: Joi.string()
      .min(8)
      .pattern(passwordPattern)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number'
      }),
  }),

  // Feedback validation
  feedback: Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    email: Joi.string().email().optional(),
    category: Joi.string().valid('bug', 'feature', 'support', 'other').required(),
    message: Joi.string().min(10).max(2000).required(),
  }),

  // Organization creation
  createOrganization: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    slug: Joi.string().min(2).max(50).pattern(/^[a-z0-9-]+$/).optional(),
  }),

  // Team invitation
  teamInvite: Joi.object({
    email: Joi.string().email().required(),
    role: Joi.string().valid('admin', 'member', 'viewer').required(),
  }),

  // API token creation
  createApiToken: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    permissions: Joi.array().items(Joi.string()).optional(),
    expires_in_days: Joi.number().integer().min(1).max(365).optional(),
  }),

  // Generic ID parameter
  idParam: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};

// Validation middleware factory
const validate = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next();
    }

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
};

// Validate URL parameters
const validateParams = (schemaName) => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return next();
    }

    const { error } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Invalid parameters',
        errors
      });
    }

    next();
  };
};

module.exports = {
  validate,
  validateParams,
  schemas,
  sanitizeInput,
  sanitizeString,
  sanitizeObject
};
