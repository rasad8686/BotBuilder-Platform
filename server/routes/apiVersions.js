/**
 * API Versions Routes
 * Endpoints for listing API versions and accessing version specs
 */

const express = require('express');
const router = express.Router();
const apiVersions = require('../config/apiVersions');
const logger = require('../utils/logger');

/**
 * GET /api/api-versions
 * List all available API versions with their status
 */
router.get('/', (req, res) => {
  try {
    const versions = Object.entries(apiVersions.versions).map(([version, config]) => ({
      version,
      status: config.status,
      deprecated: config.deprecated,
      sunset: config.sunset,
      releaseDate: config.releaseDate,
      description: config.description,
      isDefault: version === apiVersions.default,
      isSupported: apiVersions.supported.includes(version)
    }));

    res.json({
      success: true,
      versions,
      default: apiVersions.default,
      supported: apiVersions.supported,
      deprecationPolicy: apiVersions.deprecationPolicy
    });
  } catch (error) {
    logger.error('Error fetching versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch API versions'
    });
  }
});

/**
 * GET /api/api-versions/:version
 * Get detailed information about a specific version
 */
router.get('/:version', (req, res) => {
  try {
    const { version } = req.params;
    const normalizedVersion = version.toLowerCase().startsWith('v') ? version.toLowerCase() : `v${version}`;

    const config = apiVersions.versions[normalizedVersion];

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `API version '${normalizedVersion}' not found`,
        available_versions: apiVersions.supported
      });
    }

    res.json({
      success: true,
      version: normalizedVersion,
      ...config,
      isDefault: normalizedVersion === apiVersions.default,
      isSupported: apiVersions.supported.includes(normalizedVersion),
      features: apiVersions.features[normalizedVersion] || {},
      rateLimits: apiVersions.rateLimits[normalizedVersion] || {}
    });
  } catch (error) {
    logger.error('Error fetching version details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version details'
    });
  }
});

/**
 * GET /api/api-versions/:version/spec
 * Get OpenAPI specification for a specific version
 */
router.get('/:version/spec', (req, res) => {
  try {
    const { version } = req.params;
    const normalizedVersion = version.toLowerCase().startsWith('v') ? version.toLowerCase() : `v${version}`;

    if (!apiVersions.versions[normalizedVersion]) {
      return res.status(404).json({
        success: false,
        error: `API version '${normalizedVersion}' not found`
      });
    }

    // Generate OpenAPI spec for the version
    const spec = generateOpenAPISpec(normalizedVersion);

    res.json(spec);
  } catch (error) {
    logger.error('Error generating OpenAPI spec:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate OpenAPI specification'
    });
  }
});

/**
 * GET /api/api-versions/:version/changelog
 * Get changelog for a specific version
 */
router.get('/:version/changelog', (req, res) => {
  try {
    const { version } = req.params;
    const normalizedVersion = version.toLowerCase().startsWith('v') ? version.toLowerCase() : `v${version}`;

    const config = apiVersions.versions[normalizedVersion];

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `API version '${normalizedVersion}' not found`
      });
    }

    res.json({
      success: true,
      version: normalizedVersion,
      releaseDate: config.releaseDate,
      changelog: config.changelog || [],
      breakingChanges: config.breakingChanges || []
    });
  } catch (error) {
    logger.error('Error fetching changelog:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch changelog'
    });
  }
});

/**
 * GET /api/api-versions/migration/:from/:to
 * Get migration guide between versions
 */
router.get('/migration/:from/:to', (req, res) => {
  try {
    const { from, to } = req.params;
    const fromVersion = from.toLowerCase().startsWith('v') ? from.toLowerCase() : `v${from}`;
    const toVersion = to.toLowerCase().startsWith('v') ? to.toLowerCase() : `v${to}`;

    const migrationKey = `${fromVersion}-to-${toVersion}`;
    const guide = apiVersions.migrationGuides[migrationKey];

    if (!guide) {
      return res.status(404).json({
        success: false,
        error: `Migration guide from ${fromVersion} to ${toVersion} not found`,
        available_migrations: Object.keys(apiVersions.migrationGuides)
      });
    }

    res.json({
      success: true,
      from: fromVersion,
      to: toVersion,
      ...guide
    });
  } catch (error) {
    logger.error('Error fetching migration guide:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch migration guide'
    });
  }
});

/**
 * GET /api/api-versions/compare/features
 * Compare features between versions
 */
router.get('/compare/features', (req, res) => {
  try {
    const { versions: requestedVersions } = req.query;

    let versionsToCompare = apiVersions.supported;
    if (requestedVersions) {
      versionsToCompare = requestedVersions.split(',').map(v =>
        v.trim().toLowerCase().startsWith('v') ? v.trim().toLowerCase() : `v${v.trim()}`
      );
    }

    const comparison = {};

    // Get all unique features
    const allFeatures = new Set();
    Object.values(apiVersions.features).forEach(features => {
      Object.keys(features).forEach(f => allFeatures.add(f));
    });

    // Build comparison matrix
    allFeatures.forEach(feature => {
      comparison[feature] = {};
      versionsToCompare.forEach(version => {
        comparison[feature][version] = apiVersions.features[version]?.[feature] || false;
      });
    });

    res.json({
      success: true,
      versions: versionsToCompare,
      features: comparison,
      rateLimits: versionsToCompare.reduce((acc, v) => {
        acc[v] = apiVersions.rateLimits[v] || {};
        return acc;
      }, {})
    });
  } catch (error) {
    logger.error('Error comparing versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare versions'
    });
  }
});

/**
 * Generate OpenAPI specification for a version
 * @param {string} version - API version
 * @returns {Object} OpenAPI spec
 */
function generateOpenAPISpec(version) {
  const config = apiVersions.versions[version];
  const features = apiVersions.features[version] || {};

  const spec = {
    openapi: '3.0.3',
    info: {
      title: `BotBuilder API ${version.toUpperCase()}`,
      version: version,
      description: config.description,
      contact: {
        name: 'API Support',
        email: 'api@botbuilder.com'
      }
    },
    servers: [
      {
        url: `/api/${version}`,
        description: `${config.status} API`
      }
    ],
    paths: {
      '/bots': {
        get: {
          summary: 'List all bots',
          tags: ['Bots'],
          parameters: version === 'v2' ? [
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
          ] : [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
          ],
          responses: {
            '200': {
              description: 'List of bots',
              content: {
                'application/json': {
                  schema: version === 'v2' ? {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Bot' } },
                      meta: { $ref: '#/components/schemas/CursorMeta' }
                    }
                  } : {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      bots: { type: 'array', items: { $ref: '#/components/schemas/Bot' } },
                      total: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        Bot: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' },
            created_at: { type: 'string', format: version === 'v2' ? 'date-time' : 'string' },
            updated_at: { type: 'string', format: version === 'v2' ? 'date-time' : 'string' }
          }
        },
        CursorMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            cursor: { type: 'string', nullable: true },
            hasMore: { type: 'boolean' }
          }
        },
        Error: version === 'v2' ? {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' }
              }
            }
          }
        } : {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      }
    },
    security: [
      { bearerAuth: [] },
      { apiKey: [] }
    ],
    tags: [
      { name: 'Bots', description: 'Bot management endpoints' },
      { name: 'Conversations', description: 'Conversation endpoints' },
      { name: 'Analytics', description: 'Analytics and metrics' }
    ]
  };

  // Add batch operations for v2
  if (features.batchOperations) {
    spec.paths['/batch'] = {
      post: {
        summary: 'Execute batch operations',
        tags: ['Batch'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  operations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string' },
                        resource: { type: 'string' },
                        data: { type: 'object' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Batch operation results' }
        }
      }
    };
  }

  return spec;
}

module.exports = router;
