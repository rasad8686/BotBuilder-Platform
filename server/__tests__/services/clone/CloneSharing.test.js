/**
 * CloneSharing Service Tests
 */

const CloneSharing = require('../../../services/clone/CloneSharing');

// Mock dependencies
jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: () => 'mock-share-token-123'
  })),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'hashed-password')
  }))
}));

const db = require('../../../config/database');

describe('CloneSharing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shareWithUser', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'owner-456',
      name: 'Test Clone'
    };

    it('should share clone with another user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [{ id: 'target-user' }] })
        .mockResolvedValueOnce({ rows: [] }) // No existing share
        .mockResolvedValueOnce({ rows: [{ id: 'share-1', clone_id: 'clone-123' }] });

      const result = await CloneSharing.shareWithUser(
        'clone-123',
        'owner-456',
        'target-user',
        { permission: 'view' }
      );

      expect(result.success).toBe(true);
      expect(result.share).toBeDefined();
    });

    it('should reject sharing with self', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockClone] });

      const result = await CloneSharing.shareWithUser(
        'clone-123',
        'owner-456',
        'owner-456',
        { permission: 'view' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('yourself');
    });

    it('should reject sharing non-owned clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ ...mockClone, user_id: 'other-user' }] });

      const result = await CloneSharing.shareWithUser(
        'clone-123',
        'owner-456',
        'target-user',
        { permission: 'view' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should update existing share', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [{ id: 'target-user' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-share' }] }) // Existing share
        .mockResolvedValueOnce({ rows: [{ id: 'existing-share', permission: 'edit' }] });

      const result = await CloneSharing.shareWithUser(
        'clone-123',
        'owner-456',
        'target-user',
        { permission: 'edit' }
      );

      expect(result.success).toBe(true);
    });

    it('should reject sharing with non-existent user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [] }); // User not found

      const result = await CloneSharing.shareWithUser(
        'clone-123',
        'owner-456',
        'invalid-user',
        { permission: 'view' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('shareWithOrganization', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'owner-456',
      organization_id: 'org-789'
    };

    it('should share clone with organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [{ id: 'org-789' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'share-1' }] });

      const result = await CloneSharing.shareWithOrganization(
        'clone-123',
        'owner-456',
        'org-789',
        { permission: 'view' }
      );

      expect(result.success).toBe(true);
    });

    it('should reject sharing with non-existent organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [] }); // Org not found

      const result = await CloneSharing.shareWithOrganization(
        'clone-123',
        'owner-456',
        'invalid-org',
        { permission: 'view' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('createShareLink', () => {
    const mockClone = {
      id: 'clone-123',
      user_id: 'owner-456'
    };

    it('should create share link', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [{ id: 'link-1', token: 'mock-share-token-123' }] });

      const result = await CloneSharing.createShareLink(
        'clone-123',
        'owner-456',
        { expiresIn: 7 }
      );

      expect(result.success).toBe(true);
      expect(result.link).toBeDefined();
      expect(result.link.token).toBe('mock-share-token-123');
    });

    it('should create password-protected link', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockClone] })
        .mockResolvedValueOnce({ rows: [{ id: 'link-1', token: 'mock-share-token-123', password_hash: 'hashed-password' }] });

      const result = await CloneSharing.createShareLink(
        'clone-123',
        'owner-456',
        { password: 'secret123' }
      );

      expect(result.success).toBe(true);
      expect(result.link.hasPassword).toBe(true);
    });

    it('should reject for non-owned clone', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await CloneSharing.createShareLink(
        'clone-123',
        'wrong-owner',
        {}
      );

      expect(result.success).toBe(false);
    });
  });

  describe('getShares', () => {
    it('should return all shares for a clone', async () => {
      const mockShares = [
        { id: 'share-1', shared_with_user_id: 'user-1', permission: 'view' },
        { id: 'share-2', shared_with_user_id: 'user-2', permission: 'edit' }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'owner-456' }] })
        .mockResolvedValueOnce({ rows: mockShares });

      const result = await CloneSharing.getShares('clone-123', 'owner-456');

      expect(result.success).toBe(true);
      expect(result.shares).toHaveLength(2);
    });
  });

  describe('revokeShare', () => {
    it('should revoke a share', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'owner-456' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'share-1' }] });

      const result = await CloneSharing.revokeShare('clone-123', 'share-1', 'owner-456');

      expect(result.success).toBe(true);
    });

    it('should return error for non-existent share', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', user_id: 'owner-456' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await CloneSharing.revokeShare('clone-123', 'invalid-share', 'owner-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('accessSharedClone', () => {
    it('should grant access via share link', async () => {
      const mockLink = {
        id: 'link-1',
        clone_id: 'clone-123',
        expires_at: new Date(Date.now() + 86400000),
        password_hash: null
      };

      db.query
        .mockResolvedValueOnce({ rows: [mockLink] })
        .mockResolvedValueOnce({ rows: [{ id: 'clone-123', name: 'Test Clone' }] });

      const result = await CloneSharing.accessSharedClone('mock-token', {});

      expect(result.success).toBe(true);
      expect(result.clone).toBeDefined();
    });

    it('should reject expired link', async () => {
      const expiredLink = {
        id: 'link-1',
        clone_id: 'clone-123',
        expires_at: new Date(Date.now() - 86400000) // Expired
      };

      db.query.mockResolvedValueOnce({ rows: [expiredLink] });

      const result = await CloneSharing.accessSharedClone('mock-token', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('should reject invalid password', async () => {
      const protectedLink = {
        id: 'link-1',
        clone_id: 'clone-123',
        expires_at: new Date(Date.now() + 86400000),
        password_hash: 'correct-hash'
      };

      db.query.mockResolvedValueOnce({ rows: [protectedLink] });

      const result = await CloneSharing.accessSharedClone('mock-token', { password: 'wrong' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('password');
    });
  });
});
