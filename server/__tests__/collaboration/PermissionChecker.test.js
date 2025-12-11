/**
 * PermissionChecker Tests
 * Tests for server/collaboration/core/PermissionChecker.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const { PermissionChecker, PERMISSIONS, requirePermission, requireAllPermissions, requireAnyPermission } = require('../../collaboration/core/PermissionChecker');

describe('PermissionChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PERMISSIONS constants', () => {
    it('should have all bot permissions', () => {
      expect(PERMISSIONS.BOTS_VIEW).toBe('bots_view');
      expect(PERMISSIONS.BOTS_EDIT).toBe('bots_edit');
      expect(PERMISSIONS.BOTS_DELETE).toBe('bots_delete');
      expect(PERMISSIONS.BOTS_CREATE).toBe('bots_create');
    });

    it('should have all team permissions', () => {
      expect(PERMISSIONS.TEAM_MANAGE).toBe('team_manage');
      expect(PERMISSIONS.TEAM_VIEW).toBe('team_view');
      expect(PERMISSIONS.TEAM_INVITE).toBe('team_invite');
    });

    it('should have billing permissions', () => {
      expect(PERMISSIONS.BILLING_VIEW).toBe('billing_view');
      expect(PERMISSIONS.BILLING_MANAGE).toBe('billing_manage');
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions', async () => {
      const permissions = { bots_view: true, bots_edit: true };
      db.query.mockResolvedValue({
        rows: [{ permissions }]
      });

      const result = await PermissionChecker.getUserPermissions(1, 10);

      expect(result).toEqual(permissions);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('team_members'),
        [1, 10]
      );
    });

    it('should return null if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PermissionChecker.getUserPermissions(1, 10);

      expect(result).toBeNull();
    });
  });

  describe('hasPermission', () => {
    it('should return true when user has permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true } }]
      });

      const result = await PermissionChecker.hasPermission(1, 10, 'bots_view');

      expect(result).toBe(true);
    });

    it('should return false when user lacks permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: false } }]
      });

      const result = await PermissionChecker.hasPermission(1, 10, 'bots_edit');

      expect(result).toBe(false);
    });

    it('should return true for user with all permissions', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { all: true } }]
      });

      const result = await PermissionChecker.hasPermission(1, 10, 'any_permission');

      expect(result).toBe(true);
    });

    it('should check organization ownership when not in team', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 10 }] });

      const result = await PermissionChecker.hasPermission(1, 10, 'bots_view');

      expect(result).toBe(true);
    });

    it('should return false if not owner and not in team', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await PermissionChecker.hasPermission(1, 10, 'bots_view');

      expect(result).toBe(false);
    });
  });

  describe('requirePermission middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: { id: 1, current_organization_id: 10 } };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should call next when user has permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true } }]
      });

      const middleware = requirePermission('bots_view');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when not authenticated', async () => {
      req.user = null;

      const middleware = requirePermission('bots_view');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 403 when permission denied', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: {} }]
      });

      const middleware = requirePermission('bots_delete');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Permission denied',
        required: 'bots_delete'
      });
    });

    it('should handle errors', async () => {
      db.query.mockRejectedValue(new Error('DB error'));

      const middleware = requirePermission('bots_view');
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should use organization_id as fallback', async () => {
      req.user = { id: 1, organization_id: 10 };
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true } }]
      });

      const middleware = requirePermission('bots_view');
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAllPermissions middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: { id: 1, current_organization_id: 10 } };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should call next when user has all permissions', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true, bots_edit: true } }]
      });

      const middleware = requireAllPermissions(['bots_view', 'bots_edit']);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when missing any permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true, bots_edit: false } }]
      });

      const middleware = requireAllPermissions(['bots_view', 'bots_edit']);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Permission denied',
        required: ['bots_view', 'bots_edit'],
        missing: 'bots_edit'
      });
    });
  });

  describe('requireAnyPermission middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { user: { id: 1, current_organization_id: 10 } };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should call next when user has any permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: false, bots_edit: true } }]
      });

      const middleware = requireAnyPermission(['bots_view', 'bots_edit']);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 when missing all permissions', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: {} }]
      });

      const middleware = requireAnyPermission(['bots_view', 'bots_edit']);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Permission denied',
        required: 'One of: bots_view, bots_edit'
      });
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true, bots_edit: true, bots_delete: false, bots_create: true } }]
      });
    });

    it('canView should check view permission', async () => {
      const result = await PermissionChecker.canView(1, 10, 'bots');

      expect(result).toBe(true);
    });

    it('canEdit should check edit permission', async () => {
      const result = await PermissionChecker.canEdit(1, 10, 'bots');

      expect(result).toBe(true);
    });

    it('canDelete should check delete permission', async () => {
      const result = await PermissionChecker.canDelete(1, 10, 'bots');

      expect(result).toBe(false);
    });

    it('canCreate should check create permission', async () => {
      const result = await PermissionChecker.canCreate(1, 10, 'bots');

      expect(result).toBe(true);
    });
  });

  describe('team-specific methods', () => {
    it('canManageTeam should check team_manage permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { team_manage: true } }]
      });

      const result = await PermissionChecker.canManageTeam(1, 10);

      expect(result).toBe(true);
    });

    it('canViewBilling should check billing_view permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { billing_view: true } }]
      });

      const result = await PermissionChecker.canViewBilling(1, 10);

      expect(result).toBe(true);
    });

    it('canManageBilling should check billing_manage permission', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { billing_manage: false } }]
      });

      const result = await PermissionChecker.canManageBilling(1, 10);

      expect(result).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('should return true for owner', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { all: true } }]
      });

      const result = await PermissionChecker.isOwner(1, 10);

      expect(result).toBe(true);
    });

    it('should return false for non-owner', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { bots_view: true } }]
      });

      const result = await PermissionChecker.isOwner(1, 10);

      expect(result).toBeFalsy();
    });

    it('should return falsy when no permissions', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PermissionChecker.isOwner(1, 10);

      expect(result).toBeFalsy();
    });
  });

  describe('getAllUserPermissions', () => {
    it('should return all permissions for owner', async () => {
      db.query.mockResolvedValue({
        rows: [{ permissions: { all: true } }]
      });

      const result = await PermissionChecker.getAllUserPermissions(1, 10);

      expect(result.hasAccess).toBe(true);
      expect(result.isOwner).toBe(true);
      expect(result.permissions.bots_view).toBe(true);
      expect(result.permissions.team_manage).toBe(true);
    });

    it('should return specific permissions for non-owner', async () => {
      const permissions = { bots_view: true, bots_edit: false };
      db.query.mockResolvedValue({
        rows: [{ permissions }]
      });

      const result = await PermissionChecker.getAllUserPermissions(1, 10);

      expect(result.hasAccess).toBe(true);
      expect(result.isOwner).toBe(false);
      expect(result.permissions).toEqual(permissions);
    });

    it('should return no access when user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PermissionChecker.getAllUserPermissions(1, 10);

      expect(result.hasAccess).toBe(false);
      expect(result.permissions).toEqual({});
    });
  });
});
