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

    it('should skip if user id is undefined', async () => {
      req.user = { id: undefined };

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

    it('should log debug info with path when no user', async () => {
      req.user = null;
      req.path = '/api/test/path';

      await organizationContext(req, res, next);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No user'),
        expect.objectContaining({ path: '/api/test/path' })
      );
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

    it('should query organizations table with owner_id when member check fails', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ org_id: 10, role: 'admin', name: 'Owned', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('FROM organizations'),
        [1]
      );
    });

    it('should filter by status = active in organization_members query', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("om.status = 'active'"),
        [1]
      );
    });

    it('should order by joined_at ASC and limit to 1', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'First Org', slug: 'first', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/ORDER BY.*joined_at.*ASC.*LIMIT 1/s),
        [1]
      );
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

    it('should use numeric JWT organization ID', async () => {
      req.user.current_organization_id = 999;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 999, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 999])
      );
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

    it('should log header organization ID in debug', async () => {
      req.headers['x-organization-id'] = '30';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 30, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Processing'),
        expect.objectContaining({
          headerOrgId: '30'
        })
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

    it('should use numeric query param organization ID', async () => {
      req.query.organization_id = 555;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 555, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([1, 555])
      );
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
        });

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

    it('should check owner query with correct organization ID and user ID', async () => {
      req.user.current_organization_id = 80;
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ org_id: 80, role: 'admin', name: 'Test', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('WHERE id = $1 AND owner_id = $2'),
        [80, 1]
      );
    });

    it('should fallback when user is not owner and check default org as member first', async () => {
      req.user.current_organization_id = 90;
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Not a member of requested org
        .mockResolvedValueOnce({ rows: [] }) // Not owner of requested org
        .mockResolvedValueOnce({ // Default org member check
          rows: [{ org_id: 5, role: 'member', name: 'Default', slug: 'default', owner_id: 3 }]
        });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(5);
      expect(req.organization.role).toBe('member');
    });

    it('should fallback to owned organization when not member of any', async () => {
      req.user.current_organization_id = 95;
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Not a member of requested
        .mockResolvedValueOnce({ rows: [] }) // Not owner of requested
        .mockResolvedValueOnce({ rows: [] }) // Not a member of any
        .mockResolvedValueOnce({ // Owns an organization
          rows: [{ org_id: 6, role: 'admin', name: 'Owned', slug: 'owned', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(6);
      expect(req.organization.role).toBe('admin');
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

    it('should handle undefined user role gracefully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: undefined, name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(false);
      expect(req.hasRole('admin')).toBe(false);
    });

    it('should handle null user role gracefully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: null, name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(false);
    });

    it('should handle invalid role that is not in hierarchy', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'invalid_role', name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(false);
      expect(req.hasRole('member')).toBe(false);
      expect(req.hasRole('admin')).toBe(false);
    });

    it('should use role hierarchy levels correctly', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'member', name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      // member (level 2) >= viewer (level 1)
      expect(req.hasRole('viewer')).toBe(true);
      // member (level 2) >= member (level 2)
      expect(req.hasRole('member')).toBe(true);
      // member (level 2) < admin (level 3)
      expect(req.hasRole('admin')).toBe(false);
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

    it('should include stack trace in error log', async () => {
      const error = new Error('Test error');
      error.stack = 'Full stack trace here';
      db.query.mockRejectedValue(error);

      await organizationContext(req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stack: 'Full stack trace here'
        })
      );
    });

    it('should not call next when database error occurs', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      await organizationContext(req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('should handle error when user exists but undefined', async () => {
      req.user = undefined;
      const error = new Error('Test error');
      db.query.mockRejectedValue(error);

      await organizationContext(req, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: undefined
        })
      );
    });

    it('should return success: false in all error responses', async () => {
      db.query.mockRejectedValue(new Error('Error'));

      await organizationContext(req, res, next);

      expect(res._getJSONData().success).toBe(false);
    });

    it('should handle TypeError gracefully', async () => {
      db.query.mockRejectedValue(new TypeError('Type error'));

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res._getJSONData()).toMatchObject({
        code: 'ORGANIZATION_CONTEXT_ERROR'
      });
    });

    it('should handle ReferenceError gracefully', async () => {
      db.query.mockRejectedValue(new ReferenceError('Reference error'));

      await organizationContext(req, res, next);

      expect(res.statusCode).toBe(403);
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

    it('should include headerOrgId in debug log when present', async () => {
      req.headers['x-organization-id'] = '123';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 123, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headerOrgId: '123'
        })
      );
    });

    it('should include undefined headerOrgId when header not present', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headerOrgId: undefined
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

    it('should handle all organization sources at once', async () => {
      req.user.current_organization_id = 1;
      req.headers['x-organization-id'] = '2';
      req.query.organization_id = '3';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 1, role: 'admin', name: 'JWT Wins', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(1);
    });

    it('should preserve all organization fields from database', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          org_id: 10,
          role: 'admin',
          name: 'Complete Org',
          slug: 'complete',
          owner_id: 1
        }]
      });

      await organizationContext(req, res, next);

      expect(req.organization).toMatchObject({
        org_id: 10,
        role: 'admin',
        name: 'Complete Org',
        slug: 'complete',
        owner_id: 1,
        id: 10,
        is_owner: true
      });
    });

    it('should handle empty string organization ID from header', async () => {
      req.headers['x-organization-id'] = '';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Default', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      // Empty string is falsy, should use default
      expect(req.organization.id).toBe(10);
    });

    it('should handle empty string organization ID from query', async () => {
      req.query.organization_id = '';
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Default', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.id).toBe(10);
    });

    it('should handle zero as organization ID', async () => {
      req.user.current_organization_id = 0;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 0, role: 'admin', name: 'Zero Org', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      // 0 is falsy but should be treated as valid if returned from DB
      expect(req.organization.id).toBe(0);
    });

    it('should attach organization even when member query returns it', async () => {
      req.user.current_organization_id = 100;
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 100, role: 'member', name: 'Member Org', slug: 'member', owner_id: 5 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization).toBeDefined();
      expect(req.organization.id).toBe(100);
    });

    it('should handle organization with all possible roles', async () => {
      const roles = ['viewer', 'member', 'admin'];

      for (const role of roles) {
        jest.clearAllMocks();
        db.query.mockResolvedValueOnce({
          rows: [{ org_id: 10, role, name: 'Test', owner_id: 2 }]
        });

        await organizationContext(req, res, next);

        expect(req.organization.role).toBe(role);
      }
    });

    it('should set correct org_id and id fields', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 999, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.org_id).toBe(999);
      expect(req.organization.id).toBe(999);
    });

    it('should handle special characters in organization name', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: "Test's Org & Co.", slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.name).toBe("Test's Org & Co.");
    });

    it('should handle unicode in organization slug', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', slug: 'test-org-日本', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization.slug).toBe('test-org-日本');
    });
  });

  describe('Database query specifics', () => {
    it('should join organizations table with organization_members', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/JOIN organizations o ON o\.id = om\.org_id/),
        [1]
      );
    });

    it('should select all required fields from member query', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', slug: 'test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT om\.org_id, om\.role, o\.name, o\.slug, o\.owner_id/),
        [1]
      );
    });

    it('should select all required fields from owner query', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ org_id: 10, role: 'admin', name: 'Owned', slug: 'owned', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenNthCalledWith(2,
        expect.stringMatching(/SELECT id as org_id, 'admin' as role, name, slug, owner_id/),
        [1]
      );
    });

    it('should limit owner query to 1 result', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
        });

      await organizationContext(req, res, next);

      expect(db.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('LIMIT 1'),
        [1]
      );
    });
  });

  describe('Request object mutations', () => {
    it('should not modify req.user', async () => {
      const originalUser = { id: 1, email: 'test@example.com' };
      req.user = { ...originalUser };
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.user).toEqual(originalUser);
    });

    it('should add organization object to request', async () => {
      expect(req.organization).toBeUndefined();

      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.organization).toBeDefined();
    });

    it('should add hasRole function to request', async () => {
      expect(req.hasRole).toBeUndefined();

      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole).toBeDefined();
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

  it('should accept organization with valid numeric id', () => {
    req.organization = { id: 456, name: 'Test Org' };

    requireOrganization(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return success: false on failure', () => {
    req.organization = null;

    requireOrganization(req, res, next);

    expect(res._getJSONData().success).toBe(false);
  });

  it('should include error code in response', () => {
    requireOrganization(req, res, next);

    expect(res._getJSONData().code).toBe('ORGANIZATION_REQUIRED');
  });

  it('should not call next when organization is undefined', () => {
    req.organization = undefined;

    requireOrganization(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next when organization is null', () => {
    req.organization = null;

    requireOrganization(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should not call next when organization is empty object', () => {
    req.organization = {};

    requireOrganization(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should accept organization with additional fields', () => {
    req.organization = {
      id: 1,
      name: 'Test Org',
      slug: 'test',
      role: 'admin',
      is_owner: true
    };

    requireOrganization(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should handle empty string id as falsy', () => {
    req.organization = { id: '', name: 'Test' };

    requireOrganization(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('should not modify request or response if successful', () => {
    req.organization = { id: 1, name: 'Test' };
    const reqBefore = { ...req };

    requireOrganization(req, res, next);

    expect(req.organization).toEqual(reqBefore.organization);
  });

  it('should be a synchronous function', () => {
    req.organization = { id: 1 };
    const result = requireOrganization(req, res, next);

    expect(result).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
