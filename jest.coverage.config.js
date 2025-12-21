/**
 * Jest Coverage Configuration for BotBuilder Platform
 * 100% Test Coverage Target
 *
 * Usage: npm test -- --config jest.coverage.config.js
 */

const baseConfig = require('./jest.config.js');

module.exports = {
  ...baseConfig,

  // Override coverage settings for 100% target
  collectCoverage: true,

  // Coverage thresholds - 100% target
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    // Per-file thresholds for critical files
    './server/routes/auth.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './server/routes/bots.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './server/routes/organizations.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './server/middleware/auth.js': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './server/services/*.js': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },

  // Additional coverage reporters for detailed reports
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'json-summary',
    'cobertura'  // For CI/CD integration
  ],

  // Fail tests if coverage thresholds not met
  // Note: This ensures builds fail if coverage drops below 100%
  bail: false,

  // Collect coverage from all source files
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/__tests__/**',
    '!server/tests/**',
    '!server/server.js',
    '!server/migrations/**',
    '!server/seeds/**',
    '!server/scripts/**',
    '!server/config/**',
    '!**/node_modules/**'
  ],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage path ignore patterns
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/tests/',
    '/migrations/',
    '/seeds/',
    '/scripts/',
    '/config/',
    '.config.js$'
  ]
};
