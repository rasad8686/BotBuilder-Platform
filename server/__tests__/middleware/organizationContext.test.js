/**
 * Organization Context Middleware Tests
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
const { organizationContext, requireOrganization } = require('../../middleware/organizationContext');

describe('organizationContext middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: 1 },
      headers: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should skip if no user', async () => {
    req.user = null;

    await organizationContext(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('should get default organization when none specified', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ org_id: 10, role: 'admin', name: 'Test Org', slug: 'test', owner_id: 1 }]
    });

    await organizationContext(req, res, next);

    expect(req.organization).toBeDefined();
    expect(req.organization.id).toBe(10);
    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when no organization found', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await organizationContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NO_ORGANIZATION'
    }));
  });

  it('should use organization from JWT', async () => {
    req.user.current_organization_id = 20;
    db.query.mockResolvedValueOnce({
      rows: [{ org_id: 20, role: 'member', name: 'JWT Org', owner_id: 2 }]
    });

    await organizationContext(req, res, next);

    expect(req.organization.id).toBe(20);
  });

  it('should use organization from header', async () => {
    req.headers['x-organization-id'] = '30';
    db.query.mockResolvedValueOnce({
      rows: [{ org_id: 30, role: 'viewer', name: 'Header Org', owner_id: 3 }]
    });

    await organizationContext(req, res, next);

    expect(req.organization.id).toBe(30);
  });

  it('should use organization from query param', async () => {
    req.query.organization_id = '40';
    db.query.mockResolvedValueOnce({
      rows: [{ org_id: 40, role: 'admin', name: 'Query Org', owner_id: 1 }]
    });

    await organizationContext(req, res, next);

    expect(req.organization.id).toBe(40);
  });

  it('should check if user is owner when not a member', async () => {
    req.user.current_organization_id = 50;
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ org_id: 50, role: 'admin', name: 'Owner Org', owner_id: 1 }]
      });

    await organizationContext(req, res, next);

    expect(req.organization.is_owner).toBe(true);
  });

  it('should fallback to default org when user has no access', async () => {
    req.user.current_organization_id = 60;
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'member', name: 'Default', owner_id: 2 }]
      })
      .mockResolvedValueOnce({ rows: [] });

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

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should attach hasRole function', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ org_id: 10, role: 'admin', name: 'Test', owner_id: 1 }]
    });

    await organizationContext(req, res, next);

    expect(req.hasRole).toBeDefined();
    expect(req.hasRole('viewer')).toBe(true);
    expect(req.hasRole('admin')).toBe(true);
  });

  it('should handle database connection error', async () => {
    const error = new Error('Connection refused');
    error.code = 'ECONNREFUSED';
    db.query.mockRejectedValue(error);

    await organizationContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'DATABASE_UNAVAILABLE'
    }));
  });

  it('should handle general errors', async () => {
    db.query.mockRejectedValue(new Error('Unknown error'));

    await organizationContext(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ORGANIZATION_CONTEXT_ERROR'
    }));
  });

  describe('hasRole function', () => {
    it('should correctly check role hierarchy', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 10, role: 'member', name: 'Test', owner_id: 2 }]
      });

      await organizationContext(req, res, next);

      expect(req.hasRole('viewer')).toBe(true);
      expect(req.hasRole('member')).toBe(true);
      expect(req.hasRole('admin')).toBe(false);
    });
  });
});

describe('requireOrganization middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should call next when organization exists', () => {
    req.organization = { id: 1 };

    requireOrganization(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 when no organization', () => {
    requireOrganization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ORGANIZATION_REQUIRED'
    }));
  });

  it('should return 403 when organization has no id', () => {
    req.organization = {};

    requireOrganization(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
