/**
 * API Versions Configuration
 * Defines available API versions, their status, and deprecation info
 */

module.exports = {
  // Available versions with their configuration
  versions: {
    v1: {
      status: 'current',      // current, beta, deprecated, sunset
      deprecated: false,
      sunset: null,           // ISO date string when version will be removed
      releaseDate: '2024-01-01',
      description: 'Stable API version with full feature support',
      changelog: [
        'Initial release',
        'Bot management endpoints',
        'Conversation APIs',
        'Analytics endpoints',
        'Webhook integrations'
      ],
      breakingChanges: []
    },
    v2: {
      status: 'beta',
      deprecated: false,
      sunset: null,
      releaseDate: '2025-01-15',
      description: 'Beta API with new features and improved response formats',
      changelog: [
        'Improved error response format',
        'Pagination using cursor-based approach',
        'New batch operations endpoints',
        'Enhanced filtering options',
        'WebSocket real-time events',
        'Rate limit headers on all responses'
      ],
      breakingChanges: [
        {
          endpoint: '/api/v2/bots',
          change: 'Response structure changed - bots now in "data" field',
          migration: 'Access bots via response.data instead of response.bots'
        },
        {
          endpoint: '/api/v2/conversations',
          change: 'Pagination uses cursor instead of page number',
          migration: 'Use "cursor" parameter instead of "page"'
        },
        {
          endpoint: '/api/v2/analytics',
          change: 'Date format changed to ISO 8601',
          migration: 'Use ISO date strings (YYYY-MM-DDTHH:mm:ssZ)'
        }
      ]
    }
  },

  // Default version for requests without version specification
  default: 'v1',

  // List of supported versions (in order of preference)
  supported: ['v1', 'v2'],

  // Migration guides
  migrationGuides: {
    'v1-to-v2': {
      title: 'Migrating from v1 to v2',
      sections: [
        {
          title: 'Response Format Changes',
          description: 'All list endpoints now wrap results in a "data" field',
          before: '{ "bots": [...], "total": 10 }',
          after: '{ "data": [...], "meta": { "total": 10, "cursor": "..." } }'
        },
        {
          title: 'Pagination Changes',
          description: 'Switched from page-based to cursor-based pagination',
          before: 'GET /api/v1/bots?page=2&limit=10',
          after: 'GET /api/v2/bots?cursor=abc123&limit=10'
        },
        {
          title: 'Error Response Format',
          description: 'Error responses now include error code and details',
          before: '{ "error": "Not found" }',
          after: '{ "error": { "code": "NOT_FOUND", "message": "Bot not found", "details": {} } }'
        },
        {
          title: 'Date Format',
          description: 'All dates are now in ISO 8601 format',
          before: '"created_at": "2024-01-15 10:30:00"',
          after: '"created_at": "2024-01-15T10:30:00Z"'
        }
      ]
    }
  },

  // Deprecation policy
  deprecationPolicy: {
    noticePeroid: '6 months',    // Minimum notice before sunset
    supportPeriod: '12 months',  // How long deprecated versions are supported
    description: 'We provide at least 6 months notice before deprecating an API version. Deprecated versions remain functional for at least 12 months after deprecation announcement.'
  },

  // Version-specific rate limits (optional overrides)
  rateLimits: {
    v1: {
      requestsPerMinute: 100,
      requestsPerDay: 10000
    },
    v2: {
      requestsPerMinute: 200,
      requestsPerDay: 20000
    }
  },

  // Feature flags per version
  features: {
    v1: {
      batchOperations: false,
      realTimeEvents: false,
      advancedFiltering: false,
      cursorPagination: false
    },
    v2: {
      batchOperations: true,
      realTimeEvents: true,
      advancedFiltering: true,
      cursorPagination: true
    }
  }
};
