/**
 * CheckPermission Middleware Tests
 * Tests for server/middleware/checkPermission.js
 */

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const { checkPermission, checkSpecificPermission } = require('../../middleware/checkPermission');

describe('CheckPermission Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      organization: { role: 'member' }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('checkPermission()', () => {
    it('should return 403 if no organization context', () => {
      mockReq.organization = null;

      const middleware = checkPermission('viewer');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'ORGANIZATION_CONTEXT_MISSING'
        })
      );
    });

    it('should return 403 if no role in organization', () => {
      mockReq.organization = { id: 1 };

      const middleware = checkPermission('viewer');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    describe('owner permission', () => {
      it('should allow owner to proceed', () => {
        mockReq.organization = { role: 'admin', is_owner: true };

        const middleware = checkPermission('owner');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should deny non-owner', () => {
        mockReq.organization = { role: 'admin', is_owner: false };

        const middleware = checkPermission('owner');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'OWNER_REQUIRED'
          })
        );
      });
    });

    describe('role hierarchy', () => {
      it('should allow admin for admin role', () => {
        mockReq.organization = { role: 'admin' };

        const middleware = checkPermission('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should allow admin for member role', () => {
        mockReq.organization = { role: 'admin' };

        const middleware = checkPermission('member');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should allow admin for viewer role', () => {
        mockReq.organization = { role: 'admin' };

        const middleware = checkPermission('viewer');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should allow member for member role', () => {
        mockReq.organization = { role: 'member' };

        const middleware = checkPermission('member');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should allow member for viewer role', () => {
        mockReq.organization = { role: 'member' };

        const middleware = checkPermission('viewer');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });

      it('should deny member for admin role', () => {
        mockReq.organization = { role: 'member' };

        const middleware = checkPermission('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'INSUFFICIENT_PERMISSIONS'
          })
        );
      });

      it('should deny viewer for member role', () => {
        mockReq.organization = { role: 'viewer' };

        const middleware = checkPermission('member');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      it('should deny viewer for admin role', () => {
        mockReq.organization = { role: 'viewer' };

        const middleware = checkPermission('admin');
        middleware(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(403);
      });

      it('should allow viewer for viewer role', () => {
        mockReq.organization = { role: 'viewer' };

        const middleware = checkPermission('viewer');
        middleware(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
      });
    });

    it('should handle unknown user role', () => {
      mockReq.organization = { role: 'unknown' };

      const middleware = checkPermission('viewer');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle unknown required role', () => {
      mockReq.organization = { role: 'admin' };

      const middleware = checkPermission('superadmin');
      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkSpecificPermission()', () => {
    it('should return 403 if no organization context', async () => {
      mockReq.organization = null;

      const middleware = checkSpecificPermission('bots', 'create');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should allow if user has permission', async () => {
      mockReq.organization = { role: 'admin' };
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: ['create', 'read', 'update', 'delete'] } }]
      });

      const middleware = checkSpecificPermission('bots', 'create');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny if user lacks permission', async () => {
      mockReq.organization = { role: 'viewer' };
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: ['read'] } }]
      });

      const middleware = checkSpecificPermission('bots', 'delete');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PERMISSION_DENIED'
        })
      );
    });

    it('should return 403 for invalid role', async () => {
      mockReq.organization = { role: 'nonexistent' };
      db.query.mockResolvedValueOnce({ rows: [] });

      const middleware = checkSpecificPermission('bots', 'create');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid role'
        })
      );
    });

    it('should handle database errors', async () => {
      mockReq.organization = { role: 'admin' };
      db.query.mockRejectedValueOnce(new Error('Database error'));

      const middleware = checkSpecificPermission('bots', 'create');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should deny if resource not in permissions', async () => {
      mockReq.organization = { role: 'member' };
      db.query.mockResolvedValueOnce({
        rows: [{ permissions: { bots: ['read'] } }]
      });

      const middleware = checkSpecificPermission('users', 'delete');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
