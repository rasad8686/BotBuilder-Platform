/**
 * Versioned API Router
 * Routes requests to version-specific handlers
 * Supports shared logic with version-specific transforms
 */

const express = require('express');
const router = express.Router();
const apiVersions = require('../../config/apiVersions');
const { apiVersioning, versionedResponse } = require('../../middleware/apiVersioning');
const logger = require('../../utils/logger');

// Apply versioning middleware to all routes
router.use(apiVersioning());

/**
 * Version-specific response transformers
 * Transform responses based on API version
 */
const responseTransforms = {
  v1: (data) => data, // v1 returns data as-is

  v2: (data) => {
    // v2 wraps list responses in data field with meta
    if (data && typeof data === 'object') {
      // If it's a list response (has array property)
      if (data.bots && Array.isArray(data.bots)) {
        return {
          data: data.bots,
          meta: {
            total: data.total || data.bots.length,
            page: data.page,
            limit: data.limit,
            cursor: data.cursor || null
          }
        };
      }
      if (data.conversations && Array.isArray(data.conversations)) {
        return {
          data: data.conversations,
          meta: {
            total: data.total || data.conversations.length,
            cursor: data.cursor || null
          }
        };
      }
      // Transform dates to ISO format
      if (data.created_at && typeof data.created_at === 'string') {
        data.created_at = new Date(data.created_at).toISOString();
      }
      if (data.updated_at && typeof data.updated_at === 'string') {
        data.updated_at = new Date(data.updated_at).toISOString();
      }
    }
    return data;
  }
};

/**
 * Version-specific error formatter
 */
const formatError = (version, error) => {
  if (version === 'v2') {
    return {
      error: {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An error occurred',
        details: error.details || {}
      }
    };
  }
  // v1 format
  return {
    success: false,
    error: error.message || 'An error occurred'
  };
};

/**
 * Apply response transformer middleware
 */
router.use(versionedResponse(responseTransforms));

/**
 * Version info endpoint - available at all version paths
 */
router.get('/info', (req, res) => {
  const version = req.apiVersion;
  const config = apiVersions.versions[version];

  res.json({
    version,
    status: config?.status || 'unknown',
    deprecated: config?.deprecated || false,
    sunset: config?.sunset || null,
    features: apiVersions.features[version] || {},
    rateLimits: apiVersions.rateLimits[version] || {}
  });
});

/**
 * Health check for versioned API
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: req.apiVersion,
    timestamp: new Date().toISOString()
  });
});

/**
 * Example versioned endpoint - Bots list
 * Demonstrates version-specific behavior
 */
router.get('/bots/example', async (req, res) => {
  try {
    const version = req.apiVersion;

    // Shared logic - would normally fetch from database
    const mockBots = [
      { id: 1, name: 'Bot 1', created_at: '2024-01-15 10:30:00' },
      { id: 2, name: 'Bot 2', created_at: '2024-02-20 14:45:00' }
    ];

    // v2 specific: Transform dates and add cursor
    if (version === 'v2') {
      const transformedBots = mockBots.map(bot => ({
        ...bot,
        created_at: new Date(bot.created_at).toISOString()
      }));

      return res.json({
        data: transformedBots,
        meta: {
          total: transformedBots.length,
          cursor: 'next_cursor_token',
          hasMore: false
        }
      });
    }

    // v1 format
    res.json({
      success: true,
      bots: mockBots,
      total: mockBots.length,
      page: 1
    });
  } catch (error) {
    const formattedError = formatError(req.apiVersion, error);
    res.status(500).json(formattedError);
  }
});

/**
 * Batch operations - v2 only
 */
router.post('/batch', (req, res) => {
  const version = req.apiVersion;

  if (version === 'v1') {
    return res.status(400).json({
      success: false,
      error: 'Batch operations are only available in API v2 or higher'
    });
  }

  const { operations } = req.body;

  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Operations array is required',
        details: {}
      }
    });
  }

  // Process batch operations (mock response)
  const results = operations.map((op, index) => ({
    index,
    operation: op.type,
    status: 'completed',
    result: { id: index + 1 }
  }));

  res.json({
    data: results,
    meta: {
      total: results.length,
      successful: results.length,
      failed: 0
    }
  });
});

/**
 * Middleware to handle version-specific routing
 * This can be used to mount version-specific route files
 */
const mountVersionRoutes = (app) => {
  // Mount versioned router at /api/v1 and /api/v2
  apiVersions.supported.forEach(version => {
    app.use(`/api/${version}`, router);
    logger.info(`Mounted versioned API routes at /api/${version}`);
  });
};

module.exports = {
  router,
  mountVersionRoutes,
  responseTransforms,
  formatError
};
