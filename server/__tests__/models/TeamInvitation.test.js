/**
 * TeamInvitation Model Tests
 * Tests for server/models/TeamInvitation.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const TeamInvitation = require('../../models/TeamInvitation');

describe('TeamInvitation Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken()', () => {
    it('should generate a 64-character hex token', () => {
      const token = TeamInvitation.generateToken();

      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens', () => {
      const token1 = TeamInvitation.generateToken();
      const token2 = TeamInvitation.generateToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('create()', () => {
    it('should create invitation with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, email: 'test@example.com' }] });

      const result = await TeamInvitation.create({
        tenantId: 1,
        email: 'Test@Example.com',
        roleId: 2,
        invitedBy: 1
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO team_invitations'),
        expect.arrayContaining([1, 'test@example.com', 2])
      );
    });

    it('should lowercase email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await TeamInvitation.create({
        tenantId: 1,
        email: 'TEST@EXAMPLE.COM',
        roleId: 2,
        invitedBy: 1
      });

      expect(db.query.mock.calls[0][1][1]).toBe('test@example.com');
    });

    it('should use default expiration hours', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await TeamInvitation.create({
        tenantId: 1,
        email: 'test@example.com',
        roleId: 2,
        invitedBy: 1
      });

      // Check that expires_at is set (72 hours from now)
      const expiresAt = db.query.mock.calls[0][1][4];
      expect(expiresAt).toBeInstanceOf(Date);
    });

    it('should use custom expiration hours', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await TeamInvitation.create({
        tenantId: 1,
        email: 'test@example.com',
        roleId: 2,
        invitedBy: 1,
        expiresInHours: 24
      });

      const expiresAt = db.query.mock.calls[0][1][4];
      expect(expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('findByToken()', () => {
    it('should return invitation by token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, token: 'abc123' }] });

      const result = await TeamInvitation.findByToken('abc123');

      expect(result.token).toBe('abc123');
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamInvitation.findByToken('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('findById()', () => {
    it('should return invitation by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await TeamInvitation.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamInvitation.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('findPendingByTenant()', () => {
    it('should return pending invitations for tenant', async () => {
      const mockInvitations = [{ id: 1, status: 'pending' }, { id: 2, status: 'pending' }];
      db.query.mockResolvedValueOnce({ rows: mockInvitations });

      const result = await TeamInvitation.findPendingByTenant(1);

      expect(result).toHaveLength(2);
      expect(db.query.mock.calls[0][0]).toContain("status = 'pending'");
    });
  });

  describe('findByEmail()', () => {
    it('should return all invitations for email without tenant filter', async () => {
      const mockInvitations = [{ id: 1, tenant_id: 1 }, { id: 2, tenant_id: 2 }];
      db.query.mockResolvedValueOnce({ rows: mockInvitations });

      const result = await TeamInvitation.findByEmail('test@example.com');

      expect(result).toHaveLength(2);
    });

    it('should return single invitation when tenant specified', async () => {
      const mockInvitation = { id: 1, tenant_id: 1 };
      db.query.mockResolvedValueOnce({ rows: [mockInvitation] });

      const result = await TeamInvitation.findByEmail('test@example.com', 1);

      expect(result.id).toBe(1);
    });

    it('should lowercase email in query', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await TeamInvitation.findByEmail('TEST@EXAMPLE.COM');

      expect(db.query.mock.calls[0][1][0]).toBe('test@example.com');
    });
  });

  describe('accept()', () => {
    it('should accept valid invitation', async () => {
      const mockInvitation = {
        id: 1,
        token: 'abc123',
        status: 'pending',
        expires_at: new Date(Date.now() + 86400000),
        tenant_id: 1,
        role_id: 2,
        email: 'test@example.com'
      };
      db.query
        .mockResolvedValueOnce({ rows: [mockInvitation] })
        .mockResolvedValueOnce({ rows: [{ ...mockInvitation, status: 'accepted' }] });

      const result = await TeamInvitation.accept('abc123');

      expect(result.invitation.status).toBe('accepted');
      expect(result.tenantId).toBe(1);
      expect(result.roleId).toBe(2);
    });

    it('should throw error if invitation not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(TeamInvitation.accept('nonexistent'))
        .rejects.toThrow('Invitation not found');
    });

    it('should throw error if invitation already accepted', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'accepted' }] });

      await expect(TeamInvitation.accept('abc123'))
        .rejects.toThrow('Invitation already accepted');
    });

    it('should throw error if invitation expired', async () => {
      const mockInvitation = {
        id: 1,
        status: 'pending',
        expires_at: new Date(Date.now() - 86400000)
      };
      db.query
        .mockResolvedValueOnce({ rows: [mockInvitation] })
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'expired' }] });

      await expect(TeamInvitation.accept('abc123'))
        .rejects.toThrow('Invitation has expired');
    });
  });

  describe('reject()', () => {
    it('should reject invitation by token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'rejected' }] });

      const result = await TeamInvitation.reject('abc123token456token');

      expect(result.status).toBe('rejected');
      expect(db.query.mock.calls[0][0]).toContain('token = $1');
    });

    it('should reject invitation by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'rejected' }] });

      const result = await TeamInvitation.reject(1);

      expect(result.status).toBe('rejected');
      expect(db.query.mock.calls[0][0]).toContain('id = $1');
    });
  });

  describe('expire()', () => {
    it('should expire invitation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'expired' }] });

      const result = await TeamInvitation.expire(1);

      expect(result.status).toBe('expired');
    });
  });

  describe('expireOld()', () => {
    it('should expire all old pending invitations', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await TeamInvitation.expireOld();

      expect(result).toHaveLength(2);
      expect(db.query.mock.calls[0][0]).toContain("status = 'pending'");
    });
  });

  describe('delete()', () => {
    it('should delete invitation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await TeamInvitation.delete(1);

      expect(result.id).toBe(1);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await TeamInvitation.delete(999);

      expect(result).toBeUndefined();
    });
  });

  describe('hasPendingInvitation()', () => {
    it('should return true if pending invitation exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      const result = await TeamInvitation.hasPendingInvitation('test@example.com', 1);

      expect(result).toBe(true);
    });

    it('should return false if no pending invitation', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      const result = await TeamInvitation.hasPendingInvitation('test@example.com', 1);

      expect(result).toBe(false);
    });

    it('should lowercase email', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

      await TeamInvitation.hasPendingInvitation('TEST@EXAMPLE.COM', 1);

      expect(db.query.mock.calls[0][1][0]).toBe('test@example.com');
    });
  });

  describe('resend()', () => {
    it('should resend invitation with new token', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] });

      const result = await TeamInvitation.resend(1);

      expect(result.status).toBe('pending');
      expect(db.query.mock.calls[0][1][0]).toHaveLength(64);
    });

    it('should use custom expiration hours', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await TeamInvitation.resend(1, 24);

      const expiresAt = db.query.mock.calls[0][1][1];
      expect(expiresAt).toBeInstanceOf(Date);
    });
  });
});
