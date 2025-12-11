/**
 * Test Setup Helper
 * Provides utilities for testing real route handlers with mocked dependencies
 */

const express = require('express');

// Mock user and organization for tests
const mockUser = {
  id: 1,
  email: 'test@example.com',
  username: 'testuser',
  current_organization_id: 1,
  organization_id: 1
};

const mockOrganization = {
  id: 1,
  org_id: 1,
  name: 'Test Organization',
  slug: 'test-org',
  role: 'admin',
  owner_id: 1,
  is_owner: true
};

// Mock admin user
const mockAdminUser = {
  id: 1,
  email: 'admin@example.com',
  username: 'admin',
  current_organization_id: 1,
  organization_id: 1,
  isAdmin: true
};

/**
 * Create mock authentication middleware
 * @param {Object} options - { user, organization }
 */
function createMockAuth(options = {}) {
  const user = options.user || mockUser;
  const organization = options.organization || mockOrganization;

  return (req, res, next) => {
    req.user = { ...user };
    req.organization = { ...organization };
    req.hasRole = function(requiredRole) {
      const roleHierarchy = { viewer: 1, member: 2, admin: 3 };
      const userRoleLevel = roleHierarchy[req.organization.role] || 0;
      const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
      return userRoleLevel >= requiredRoleLevel;
    };
    next();
  };
}

/**
 * Create an Express app with real routes for testing
 * Routes must be provided as router objects
 * @param {Object} options - Configuration options
 * @returns {Express.Application}
 */
function createTestApp(options = {}) {
  const app = express();
  app.use(express.json());

  // Add mock auth middleware
  const mockAuth = createMockAuth(options);
  app.use(mockAuth);

  return app;
}

/**
 * Setup common Jest mocks for route testing
 * Call this BEFORE requiring route modules
 */
function setupJestMocks() {
  // These should be called in the test file before imports
  jest.mock('../db', () => ({
    query: jest.fn(),
    pool: { query: jest.fn() }
  }));

  jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn()
  }));
}

/**
 * Create mock DB response helper
 * @param {Array} rows - Array of row objects to return
 * @returns {Object} Mock query result
 */
function mockDbResponse(rows = []) {
  return { rows, rowCount: rows.length };
}

/**
 * Create mock error for testing error handling
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @returns {Error}
 */
function mockDbError(message = 'Database error', code = 'DB_ERROR') {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = {
  mockUser,
  mockOrganization,
  mockAdminUser,
  createMockAuth,
  createTestApp,
  setupJestMocks,
  mockDbResponse,
  mockDbError
};
