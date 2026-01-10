/**
 * V2 API Router
 * Professional API with consistent responses, pagination, and more
 *
 * Features:
 * - Consistent response envelope
 * - Cursor-based pagination
 * - Request ID tracking
 * - Rate limit headers
 * - Idempotency support
 * - HATEOAS links
 * - Webhook signatures
 */

const express = require('express');
const router = express.Router();

// V2 Middleware
const requestId = require('./middleware/requestId');
const responseEnvelope = require('./middleware/responseEnvelope');
const paginate = require('./middleware/paginate');
const idempotency = require('./middleware/idempotency');
const rateLimitHeaders = require('./middleware/rateLimitHeaders');

// V2 Routes
const healthRoutes = require('./routes/health');
const botsRoutes = require('./routes/bots');
const messagesRoutes = require('./routes/messages');
const agentsRoutes = require('./routes/agents');
const knowledgeRoutes = require('./routes/knowledge');
const webhooksRoutes = require('./routes/webhooks');

// Apply V2 middleware to all routes
router.use(requestId);
router.use(responseEnvelope);
router.use(paginate);
router.use(idempotency);
router.use(rateLimitHeaders({ limit: 100, windowMs: 60000 }));

// Health check routes (no auth required)
router.use('/health', healthRoutes);

// Import existing auth middleware
let authMiddleware;
try {
  authMiddleware = require('../middleware/auth');
} catch (e) {
  // Fallback if auth middleware not found
  authMiddleware = (req, res, next) => {
    // Try to get user from existing session/token
    if (req.user) {
      return next();
    }
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_TOKEN_MISSING',
        message: 'Authentication required'
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: 'v2'
      },
      _wrapped: true
    });
  };
}

// Protected routes
router.use('/bots', authMiddleware, botsRoutes);
router.use('/bots', authMiddleware, messagesRoutes);
router.use('/bots', authMiddleware, knowledgeRoutes);
router.use('/agents', authMiddleware, agentsRoutes);
router.use('/webhooks', authMiddleware, webhooksRoutes);

// API Info endpoint
router.get('/', (req, res) => {
  res.success({
    name: 'BotBuilder API',
    version: 'v2',
    documentation: '/api-docs',
    endpoints: {
      health: '/api/v2/health',
      bots: '/api/v2/bots',
      messages: '/api/v2/bots/:botId/messages',
      agents: '/api/v2/agents',
      knowledge: '/api/v2/bots/:botId/knowledge',
      webhooks: '/api/v2/webhooks'
    },
    features: [
      'Consistent response envelope',
      'Cursor-based pagination',
      'Request ID tracking',
      'Rate limit headers',
      'Idempotency support',
      'HATEOAS links',
      'Webhook signatures'
    ]
  });
});

// V2 Error handler
router.use((err, req, res, next) => {
  console.error('V2 API Error:', err);

  const statusCode = err.status || err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      version: 'v2'
    },
    _wrapped: true
  });
});

module.exports = router;
