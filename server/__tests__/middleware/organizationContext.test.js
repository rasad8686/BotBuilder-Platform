/**
 * Organization Context Middleware Tests
 * Comprehensive tests for server/middleware/organizationContext.js
 */

const httpMocks = require('node-mocks-http');

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const db = require('../../db');
const logger = require('../../utils/logger');
const { organizationContext, requireOrganization } = require('../../middleware/organizationContext');

describe('organizationContext middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = httpMocks.createRequest({
      user: { id: 1 },
      headers: {},
      query: {},
      path: '/api/bots'
    });
    res = httpMocks.createResponse();
    next = jest.fn();
  });

  describe('User validation', () => {
    it('should skip if no user', async () => {
      req.user = null;

      await organizationContext(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No user'),
        expect.any(Object)
      );
    });

    it('should skip if user has no id', async () => {
      req.user = { email: 'test@example.com' };

      await organizationContext(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(db.query).not.toHaveBeenCalled();
    });

    it('should process when user has valid id', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test Org', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Default organization (no specified org)', () => {
    it('should get default organization when none specified', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test Org', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization).toBeDefined();
      expect(req.organization.id).toBe(10);
      expect(req.organization.org_id).toBe(10);
      expect(req.organization.name).toBe('Test Org');
      expect(next).toHaveBeenCalled();
    });

    it('should set is_owner flag when user owns organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test Org', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.is_owner).toBe(true);
    });

    it('should set is_owner to false when user does not own organization', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'member', name: 'Test Org', slug: 'test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.is_owner).toBe(false);
    });

    it('should return 403 when no organization found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res._getJSONData()).toMatchObject({
        success: false,
        code: 'NO_ORGANIZATION',
        message: expect.stringContaining('No organization found')
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should check organization_members first', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test Org', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM organization_members om'),
        [1]
      );
    });

    it('should fallback to owned organizations when not a member', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Not a member
        .mockResolvedValueOnce({ // Owner check
          rows: [{ org_id: 10, role: 'admin', name: 'Owned Org', slug: 'owned', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(10);
      expect(req.organization.name).toBe('Owned Org');
    });
  });

  describe('Organization from JWT', () => {
    it('should use organization from JWT', async () => {
      req.user.current_organization_id = 20;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 20, role: 'member', name: 'JWT Org', slug: 'jwt', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(20);
      expect(req.organization.name).toBe('JWT Org');
    });

    it('should verify user is member of JWT organization', async () => {
      req.user.current_organization_id = 20;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 20, role: 'member', name: 'JWT Org', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE om.user_id = $1 AND om.org_id = $2'),
        [1, 20]
      );
    });

    it('should check if user owns JWT organization when not a member', async () => {
      req.user.current_organization_id = 20;
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Not a member
        .mockResolvedValueOnce({ // Owner check
          rows: [{ org_id: 20, role: 'admin', name: 'Owned', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(20);
      expect(req.organization.is_owner).toBe(true);
    });
  });

  describe('Organization from header', () => {
    it('should use organization from header', async () => {
      req.headers['x-organization-id'] = '30';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 30, role: 'viewer', name: 'Header Org', slug: 'header', owner_id: 3 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(30);
      expect(req.organization.name).toBe('Header Org');
    });

    it('should convert header string to number', async () => {
      req.headers['x-organization-id'] = '42';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 42, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, '42'])
      );
    });
  });

  describe('Organization from query param', () => {
    it('should use organization from query param', async () => {
      req.query.organization_id = '40';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 40, role: 'admin', name: 'Query Org', slug: 'query', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(40);
      expect(req.organization.name).toBe('Query Org');
    });
  });

  describe('Organization access fallback', () => {
    it('should check if user is owner when not a member', async () => {
      req.user.current_organization_id = 50;
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ org_id: 50, role: 'admin', name: 'Owner Org', slug: 'owner', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(req.organization.is_owner).toBe(true);
    });

    it('should fallback to default org when user has no access', async () => {
      req.user.current_organization_id = 60;
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Not a member
        .mockResolvedValueOnce({ rows: [] }) // Not owner
        .mockResolvedValueOnce({ // Default org (member)
          rows: [{ org_id: 10, role: 'member', name: 'Default', slug: 'default', owner_id: 2 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Not owner of default

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(10);
    });

    it('should return 403 when no access and no default org', async () => {
      req.user.current_organization_id = 70;
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res._getJSONData()).toMatchObject({
        code: 'NO_ORGANIZATION_ACCESS'
      });
    });
  });

  describe('hasRole function', () => {
    it('should attach hasRole function', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole).toBeDefined();
      expect(typeof req.hasRole).toBe('function');
    });

    it('should correctly check viewer role for admin', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(true);
      expect(req.hasRole('member')).toBe(true);
      expect(req.hasRole('admin')).toBe(true);
    });

    it('should correctly check role hierarchy for member', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'member', name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(true);
      expect(req.hasRole('member')).toBe(true);
      expect(req.hasRole('admin')).toBe(false);
    });

    it('should correctly check role hierarchy for viewer', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'viewer', name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(true);
      expect(req.hasRole('member')).toBe(false);
      expect(req.hasRole('admin')).toBe(false);
    });

    it('should return false for unknown roles', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'viewer', name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('superadmin')).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle database connection error', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      db.query.mockRejectedValue(error);

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(res._getJSONData()).toMatchObject({
        code: 'DATABASE_UNAVAILABLE',
        message: expect.stringContaining('Database temporarily unavailable')
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle database termination error', async () => {
      const error = new Error('Database terminated');
      error.code = '57P01';
      db.query.mockRejectedValue(error);

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(503);
      expect(res._getJSONData()).toMatchObject({
        code: 'DATABASE_UNAVAILABLE'
      });
    });

    it('should handle general errors', async () => {
      db.query.mockRejectedValue(new Error('Unknown error'));

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res._getJSONData()).toMatchObject({
        code: 'ORGANIZATION_CONTEXT_ERROR',
        message: expect.stringContaining('Unable to load organization context')
      });
    });

    it('should log error details', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      db.query.mockRejectedValue(error);

      await organizationContext(req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        'Organization context error',
        expect.objectContaining({
          error: 'Test error',
          userId: 1
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log debug info on processing', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Processing'),
        expect.objectContaining({
          path: '/api/bots',
          userId: 1
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle numeric organization ID from header', async () => {
      req.headers['x-organization-id'] = 123;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 123, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(123);
    });

    it('should handle numeric organization ID from query', async () => {
      req.query.organization_id = 456;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 456, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(456);
    });

    it('should prioritize JWT org over header', async () => {
      req.user.current_organization_id = 100;
      req.headers['x-organization-id'] = '200';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 100, role: 'admin', name: 'JWT Priority', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(100);
    });

    it('should prioritize header over query param', async () => {
      req.headers['x-organization-id'] = '100';
      req.query.organization_id = '200';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 100, role: 'admin', name: 'Header Priority', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(100);
    });
  });
});

describe('requireOrganization middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
  });

  it('should call next when organization exists', () => {
    req.organization = { id: 1, name: 'Test Org' };

    requireOrganization(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('should return 403 when no organization', () => {
    requireOrganization(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res._getJSONData()).toMatchObject({
      success: false,
      code: 'ORGANIZATION_REQUIRED',
      message: expect.stringContaining('Organization context required')
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when organization has no id', () => {
    req.organization = { name: 'Test Org' };

    requireOrganization(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept organization with id of 0', () => {
    req.organization = { id: 0, name: 'Default Org' };

    requireOrganization(req, res, next);

    expect(next).not.toHaveBeenCalled(); // 0 is falsy
  });

  it('should accept organization with valid string id', () => {
    req.organization = { id: 'org-123', name: 'Test Org' };

    requireOrganization(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
