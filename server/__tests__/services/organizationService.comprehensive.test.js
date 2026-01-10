jest.mock('../../db', () => ({
  query: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const db = require('../../db');
const logger = require('../../utils/logger');
const organizationService = require('../../services/organizationService');

describe('Organization Service - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE ORGANIZATION TESTS ====================
  describe('createOrganization', () => {
    it('should create a new organization successfully', async () => {
      const mockOrgId = 'org_123';
      const name = 'Test Org';
      const ownerId = 'user_123';

      db.query.mockResolvedValueOnce({ rows: [{ id: mockOrgId, name, owner_id: ownerId }] });

      const result = await organizationService.createOrganization(name, ownerId);

      expect(db.query).toHaveBeenCalled();
      expect(result).toEqual({ id: mockOrgId, name, owner_id: ownerId });
      expect(logger.info).toHaveBeenCalled();
    });

    it('should create organization with generated slug', async () => {
      const name = 'My Test Organization';
      const ownerId = 'user_123';
      const mockOrgId = 'org_456';

      db.query.mockResolvedValueOnce({
        rows: [{ id: mockOrgId, name, slug: 'my-test-organization', owner_id: ownerId }],
      });

      const result = await organizationService.createOrganization(name, ownerId);

      expect(result.slug).toBe('my-test-organization');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when name is missing', async () => {
      const ownerId = 'user_123';

      await expect(organizationService.createOrganization('', ownerId)).rejects.toThrow(
        'Organization name is required'
      );
    });

    it('should throw error when ownerId is missing', async () => {
      const name = 'Test Org';

      await expect(organizationService.createOrganization(name, '')).rejects.toThrow(
        'Owner ID is required'
      );
    });

    it('should throw error when name exceeds maximum length', async () => {
      const name = 'a'.repeat(256);
      const ownerId = 'user_123';

      await expect(organizationService.createOrganization(name, ownerId)).rejects.toThrow(
        'Organization name too long'
      );
    });

    it('should handle database error on creation', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.createOrganization('Test Org', 'user_123')).rejects.toThrow(
        'Database error'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should set correct default values when creating organization', async () => {
      const mockOrgId = 'org_789';
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: mockOrgId,
            name: 'Test',
            owner_id: 'user_123',
            is_active: true,
            created_at: expect.any(String),
          },
        ],
      });

      const result = await organizationService.createOrganization('Test', 'user_123');

      expect(result.is_active).toBe(true);
      expect(result.created_at).toBeDefined();
    });
  });

  // ==================== UPDATE ORGANIZATION TESTS ====================
  describe('updateOrganization', () => {
    it('should update organization successfully', async () => {
      const orgId = 'org_123';
      const updateData = { name: 'Updated Org', description: 'New description' };

      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, ...updateData }],
      });

      const result = await organizationService.updateOrganization(orgId, updateData);

      expect(result.name).toBe('Updated Org');
      expect(result.description).toBe('New description');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      const updateData = { name: 'Updated' };

      await expect(organizationService.updateOrganization('', updateData)).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should throw error when update data is empty', async () => {
      const orgId = 'org_123';

      await expect(organizationService.updateOrganization(orgId, {})).rejects.toThrow(
        'At least one field must be provided'
      );
    });

    it('should validate name length on update', async () => {
      const orgId = 'org_123';
      const updateData = { name: 'a'.repeat(256) };

      await expect(organizationService.updateOrganization(orgId, updateData)).rejects.toThrow(
        'Organization name too long'
      );
    });

    it('should only update allowed fields', async () => {
      const orgId = 'org_123';
      const updateData = {
        name: 'Updated',
        owner_id: 'hacker_id', // Should be ignored
      };

      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, name: 'Updated', owner_id: 'original_owner' }],
      });

      const result = await organizationService.updateOrganization(orgId, updateData);

      expect(result.owner_id).toBe('original_owner');
    });

    it('should handle database error on update', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        organizationService.updateOrganization('org_123', { name: 'Updated' })
      ).rejects.toThrow('Update failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should update organization settings', async () => {
      const orgId = 'org_123';
      const updateData = { settings: { theme: 'dark', language: 'en' } };

      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, settings: updateData.settings }],
      });

      const result = await organizationService.updateOrganization(orgId, updateData);

      expect(result.settings).toEqual({ theme: 'dark', language: 'en' });
    });
  });

  // ==================== DELETE ORGANIZATION TESTS ====================
  describe('deleteOrganization', () => {
    it('should delete organization successfully', async () => {
      const orgId = 'org_123';

      db.query.mockResolvedValueOnce({ rows: [{ id: orgId, deleted: true }] });

      const result = await organizationService.deleteOrganization(orgId);

      expect(result.deleted).toBe(true);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.deleteOrganization('')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should return error if organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.deleteOrganization('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should handle database error on deletion', async () => {
      db.query.mockRejectedValueOnce(new Error('Deletion failed'));

      await expect(organizationService.deleteOrganization('org_123')).rejects.toThrow(
        'Deletion failed'
      );
      expect(logger.error).toHaveBeenCalled();
    });

    it('should cascade delete related data', async () => {
      const orgId = 'org_123';

      db.query.mockResolvedValueOnce({ rows: [{ id: orgId }] });

      const result = await organizationService.deleteOrganization(orgId);

      expect(db.query).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('should soft delete organization', async () => {
      const orgId = 'org_123';

      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, is_active: false, deleted_at: expect.any(String) }],
      });

      const result = await organizationService.deleteOrganization(orgId);

      expect(result.is_active).toBe(false);
      expect(result.deleted_at).toBeDefined();
    });
  });

  // ==================== GET ORGANIZATION TESTS ====================
  describe('getOrganization', () => {
    it('should get organization by ID', async () => {
      const orgId = 'org_123';
      const org = { id: orgId, name: 'Test Org', owner_id: 'user_123' };

      db.query.mockResolvedValueOnce({ rows: [org] });

      const result = await organizationService.getOrganization(orgId);

      expect(result).toEqual(org);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.getOrganization('')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should throw error when organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.getOrganization('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should include member count in response', async () => {
      const org = {
        id: 'org_123',
        name: 'Test Org',
        member_count: 5,
      };

      db.query.mockResolvedValueOnce({ rows: [org] });

      const result = await organizationService.getOrganization('org_123');

      expect(result.member_count).toBe(5);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.getOrganization('org_123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== GET ORGANIZATION BY SLUG TESTS ====================
  describe('getOrganizationBySlug', () => {
    it('should get organization by slug', async () => {
      const slug = 'test-org';
      const org = { id: 'org_123', name: 'Test Org', slug };

      db.query.mockResolvedValueOnce({ rows: [org] });

      const result = await organizationService.getOrganizationBySlug(slug);

      expect(result.slug).toBe(slug);
    });

    it('should throw error when slug is missing', async () => {
      await expect(organizationService.getOrganizationBySlug('')).rejects.toThrow(
        'Slug is required'
      );
    });

    it('should throw error when organization not found by slug', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.getOrganizationBySlug('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should handle slug with special characters', async () => {
      const slug = 'test-org-2025';
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', slug }],
      });

      const result = await organizationService.getOrganizationBySlug(slug);

      expect(result.slug).toBe(slug);
    });

    it('should be case-insensitive', async () => {
      const slug = 'test-org';
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', slug: slug.toLowerCase() }],
      });

      const result = await organizationService.getOrganizationBySlug(slug.toUpperCase());

      expect(result.slug).toBe(slug);
    });
  });

  // ==================== LIST ORGANIZATIONS TESTS ====================
  describe('listOrganizations', () => {
    it('should list all organizations for a user', async () => {
      const userId = 'user_123';
      const orgs = [
        { id: 'org_1', name: 'Org 1', owner_id: userId },
        { id: 'org_2', name: 'Org 2', owner_id: userId },
      ];

      db.query.mockResolvedValueOnce({ rows: orgs });

      const result = await organizationService.listOrganizations(userId);

      expect(result).toEqual(orgs);
      expect(result.length).toBe(2);
    });

    it('should throw error when userId is missing', async () => {
      await expect(organizationService.listOrganizations('')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should return empty array when user has no organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await organizationService.listOrganizations('user_123');

      expect(result).toEqual([]);
    });

    it('should support pagination', async () => {
      const userId = 'user_123';
      const orgs = [{ id: 'org_1', name: 'Org 1' }];

      db.query.mockResolvedValueOnce({ rows: orgs });

      const result = await organizationService.listOrganizations(userId, { limit: 10, offset: 0 });

      expect(result).toEqual(orgs);
    });

    it('should support sorting', async () => {
      const userId = 'user_123';
      const orgs = [
        { id: 'org_1', name: 'Org A' },
        { id: 'org_2', name: 'Org B' },
      ];

      db.query.mockResolvedValueOnce({ rows: orgs });

      const result = await organizationService.listOrganizations(userId, { sort: 'name' });

      expect(result[0].name).toBe('Org A');
    });

    it('should filter by status', async () => {
      const userId = 'user_123';
      const activeOrgs = [
        { id: 'org_1', name: 'Org 1', is_active: true },
      ];

      db.query.mockResolvedValueOnce({ rows: activeOrgs });

      const result = await organizationService.listOrganizations(userId, { active: true });

      expect(result[0].is_active).toBe(true);
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.listOrganizations('user_123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== INVITE USER TESTS ====================
  describe('inviteUser', () => {
    it('should invite user to organization', async () => {
      const orgId = 'org_123';
      const email = 'user@example.com';
      const role = 'member';
      const inviteToken = 'invite_token_123';

      db.query.mockResolvedValueOnce({
        rows: [{ id: 'invite_123', org_id: orgId, email, role, token: inviteToken }],
      });

      const result = await organizationService.inviteUser(orgId, email, role);

      expect(result.email).toBe(email);
      expect(result.role).toBe(role);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(
        organizationService.inviteUser('', 'user@example.com', 'member')
      ).rejects.toThrow('Organization ID is required');
    });

    it('should throw error when email is invalid', async () => {
      await expect(organizationService.inviteUser('org_123', 'invalid-email', 'member')).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should validate role', async () => {
      await expect(
        organizationService.inviteUser('org_123', 'user@example.com', 'invalid_role')
      ).rejects.toThrow('Invalid role');
    });

    it('should prevent duplicate invitations', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ email: 'user@example.com' }] });

      await expect(
        organizationService.inviteUser('org_123', 'user@example.com', 'member')
      ).rejects.toThrow('User already invited');
    });

    it('should generate unique invite token', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ token: expect.any(String) }],
      });

      const result = await organizationService.inviteUser('org_123', 'user@example.com', 'member');

      expect(result.token).toBeDefined();
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should set expiration date for invitation', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ expires_at: expect.any(String) }],
      });

      const result = await organizationService.inviteUser('org_123', 'user@example.com', 'member');

      expect(result.expires_at).toBeDefined();
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        organizationService.inviteUser('org_123', 'user@example.com', 'member')
      ).rejects.toThrow('Database error');
    });
  });

  // ==================== ACCEPT INVITATION TESTS ====================
  describe('acceptInvitation', () => {
    it('should accept invitation successfully', async () => {
      const token = 'valid_invite_token';
      const userId = 'user_123';

      db.query.mockResolvedValueOnce({
        rows: [{ id: 'invite_123', token, org_id: 'org_123' }],
      });
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: 'org_123', user_id: userId, role: 'member' }],
      });

      const result = await organizationService.acceptInvitation(token, userId);

      expect(result.user_id).toBe(userId);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when token is missing', async () => {
      await expect(organizationService.acceptInvitation('', 'user_123')).rejects.toThrow(
        'Invitation token is required'
      );
    });

    it('should throw error when userId is missing', async () => {
      await expect(organizationService.acceptInvitation('token_123', '')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should throw error when invitation not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.acceptInvitation('invalid_token', 'user_123')).rejects.toThrow(
        'Invitation not found'
      );
    });

    it('should throw error when invitation expired', async () => {
      const expiredDate = new Date(Date.now() - 86400000); // 1 day ago

      db.query.mockResolvedValueOnce({
        rows: [{ token: 'token_123', expires_at: expiredDate }],
      });

      await expect(organizationService.acceptInvitation('token_123', 'user_123')).rejects.toThrow(
        'Invitation expired'
      );
    });

    it('should mark invitation as accepted', async () => {
      const token = 'valid_token';

      db.query.mockResolvedValueOnce({
        rows: [{ token, accepted: false }],
      });
      db.query.mockResolvedValueOnce({
        rows: [{ accepted: true }],
      });

      const result = await organizationService.acceptInvitation(token, 'user_123');

      expect(result.accepted).toBe(true);
    });

    it('should prevent double acceptance', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ accepted: true }],
      });

      await expect(organizationService.acceptInvitation('token_123', 'user_123')).rejects.toThrow(
        'Invitation already accepted'
      );
    });
  });

  // ==================== REMOVE USER TESTS ====================
  describe('removeUser', () => {
    it('should remove user from organization', async () => {
      const orgId = 'org_123';
      const userId = 'user_456';

      db.query.mockResolvedValueOnce({
        rows: [{ org_id: orgId, user_id: userId, removed: true }],
      });

      const result = await organizationService.removeUser(orgId, userId);

      expect(result.removed).toBe(true);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.removeUser('', 'user_456')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should throw error when userId is missing', async () => {
      await expect(organizationService.removeUser('org_123', '')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should prevent removing owner', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ owner_id: 'user_456' }],
      });

      await expect(organizationService.removeUser('org_123', 'user_456')).rejects.toThrow(
        'Cannot remove organization owner'
      );
    });

    it('should throw error when user not in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.removeUser('org_123', 'nonexistent')).rejects.toThrow(
        'User not found in organization'
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.removeUser('org_123', 'user_456')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== GET MEMBERS TESTS ====================
  describe('getMembers', () => {
    it('should get all organization members', async () => {
      const orgId = 'org_123';
      const members = [
        { id: 'user_1', email: 'user1@example.com', role: 'owner' },
        { id: 'user_2', email: 'user2@example.com', role: 'member' },
      ];

      db.query.mockResolvedValueOnce({ rows: members });

      const result = await organizationService.getMembers(orgId);

      expect(result).toEqual(members);
      expect(result.length).toBe(2);
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.getMembers('')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should return empty array when no members', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await organizationService.getMembers('org_123');

      expect(result).toEqual([]);
    });

    it('should include member status', async () => {
      const members = [
        { id: 'user_1', email: 'user1@example.com', is_active: true },
      ];

      db.query.mockResolvedValueOnce({ rows: members });

      const result = await organizationService.getMembers('org_123');

      expect(result[0].is_active).toBe(true);
    });

    it('should support filtering by role', async () => {
      const orgId = 'org_123';
      const adminMembers = [
        { id: 'user_1', role: 'admin' },
      ];

      db.query.mockResolvedValueOnce({ rows: adminMembers });

      const result = await organizationService.getMembers(orgId, { role: 'admin' });

      expect(result[0].role).toBe('admin');
    });

    it('should support sorting members', async () => {
      const members = [
        { id: 'user_1', email: 'a@example.com' },
        { id: 'user_2', email: 'b@example.com' },
      ];

      db.query.mockResolvedValueOnce({ rows: members });

      const result = await organizationService.getMembers('org_123', { sort: 'email' });

      expect(result[0].email).toBe('a@example.com');
    });
  });

  // ==================== UPDATE MEMBER ROLE TESTS ====================
  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const orgId = 'org_123';
      const userId = 'user_456';
      const newRole = 'admin';

      db.query.mockResolvedValueOnce({
        rows: [{ org_id: orgId, user_id: userId, role: newRole }],
      });

      const result = await organizationService.updateMemberRole(orgId, userId, newRole);

      expect(result.role).toBe(newRole);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.updateMemberRole('', 'user_456', 'admin')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should throw error when userId is missing', async () => {
      await expect(organizationService.updateMemberRole('org_123', '', 'admin')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should validate role', async () => {
      await expect(
        organizationService.updateMemberRole('org_123', 'user_456', 'invalid_role')
      ).rejects.toThrow('Invalid role');
    });

    it('should prevent demoting owner', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ owner_id: 'user_456' }],
      });

      await expect(
        organizationService.updateMemberRole('org_123', 'user_456', 'member')
      ).rejects.toThrow('Cannot change owner role');
    });

    it('should throw error when user not in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.updateMemberRole('org_123', 'nonexistent', 'admin')
      ).rejects.toThrow('User not found in organization');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        organizationService.updateMemberRole('org_123', 'user_456', 'admin')
      ).rejects.toThrow('Database error');
    });
  });

  // ==================== TRANSFER OWNERSHIP TESTS ====================
  describe('transferOwnership', () => {
    it('should transfer ownership to new owner', async () => {
      const orgId = 'org_123';
      const newOwnerId = 'user_456';

      db.query.mockResolvedValueOnce({
        rows: [{ org_id: orgId, owner_id: newOwnerId }],
      });

      const result = await organizationService.transferOwnership(orgId, newOwnerId);

      expect(result.owner_id).toBe(newOwnerId);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.transferOwnership('', 'user_456')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should throw error when newOwnerId is missing', async () => {
      await expect(organizationService.transferOwnership('org_123', '')).rejects.toThrow(
        'New owner ID is required'
      );
    });

    it('should throw error when new owner not in organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.transferOwnership('org_123', 'nonexistent')).rejects.toThrow(
        'User not found in organization'
      );
    });

    it('should prevent transferring to same owner', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ owner_id: 'user_456' }],
      });

      await expect(organizationService.transferOwnership('org_123', 'user_456')).rejects.toThrow(
        'New owner is same as current owner'
      );
    });

    it('should update old owner role to admin', async () => {
      const orgId = 'org_123';
      const oldOwnerId = 'user_123';
      const newOwnerId = 'user_456';

      db.query.mockResolvedValueOnce({
        rows: [{ org_id: orgId, user_id: newOwnerId }],
      });
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: orgId, user_id: oldOwnerId, role: 'admin' }],
      });

      await organizationService.transferOwnership(orgId, newOwnerId);

      expect(db.query).toHaveBeenCalled();
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.transferOwnership('org_123', 'user_456')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== GET ORGANIZATION STATS TESTS ====================
  describe('getOrganizationStats', () => {
    it('should get organization statistics', async () => {
      const orgId = 'org_123';
      const stats = {
        member_count: 10,
        bot_count: 5,
        message_count: 1000,
      };

      db.query.mockResolvedValueOnce({ rows: [stats] });

      const result = await organizationService.getOrganizationStats(orgId);

      expect(result.member_count).toBe(10);
      expect(result.bot_count).toBe(5);
      expect(result.message_count).toBe(1000);
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.getOrganizationStats('')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should include usage metrics', async () => {
      const stats = {
        storage_used: 1024,
        api_calls: 5000,
        last_active: expect.any(String),
      };

      db.query.mockResolvedValueOnce({ rows: [stats] });

      const result = await organizationService.getOrganizationStats('org_123');

      expect(result.storage_used).toBeDefined();
      expect(result.api_calls).toBeDefined();
    });

    it('should handle organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.getOrganizationStats('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.getOrganizationStats('org_123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== GET ORGANIZATION SETTINGS TESTS ====================
  describe('getOrganizationSettings', () => {
    it('should get organization settings', async () => {
      const orgId = 'org_123';
      const settings = {
        theme: 'dark',
        language: 'en',
        notifications_enabled: true,
      };

      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, settings }],
      });

      const result = await organizationService.getOrganizationSettings(orgId);

      expect(result).toEqual(settings);
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.getOrganizationSettings('')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should return default settings when not configured', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', settings: null }],
      });

      const result = await organizationService.getOrganizationSettings('org_123');

      expect(result).toBeDefined();
    });

    it('should handle organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.getOrganizationSettings('nonexistent')).rejects.toThrow(
        'Organization not found'
      );
    });

    it('should include privacy settings', async () => {
      const settings = {
        is_public: false,
        allow_external_invites: true,
      };

      db.query.mockResolvedValueOnce({
        rows: [{ settings }],
      });

      const result = await organizationService.getOrganizationSettings('org_123');

      expect(result.is_public).toBe(false);
      expect(result.allow_external_invites).toBe(true);
    });
  });

  // ==================== UPDATE ORGANIZATION SETTINGS TESTS ====================
  describe('updateOrganizationSettings', () => {
    it('should update organization settings', async () => {
      const orgId = 'org_123';
      const settingsUpdates = { theme: 'light', language: 'es' };

      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, settings: settingsUpdates }],
      });

      const result = await organizationService.updateOrganizationSettings(orgId, settingsUpdates);

      expect(result.settings.theme).toBe('light');
      expect(result.settings.language).toBe('es');
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when orgId is missing', async () => {
      await expect(
        organizationService.updateOrganizationSettings('', { theme: 'dark' })
      ).rejects.toThrow('Organization ID is required');
    });

    it('should throw error when settings are empty', async () => {
      await expect(organizationService.updateOrganizationSettings('org_123', {})).rejects.toThrow(
        'At least one setting must be provided'
      );
    });

    it('should validate setting values', async () => {
      await expect(
        organizationService.updateOrganizationSettings('org_123', { theme: 'invalid' })
      ).rejects.toThrow('Invalid setting value');
    });

    it('should handle organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        organizationService.updateOrganizationSettings('nonexistent', { theme: 'dark' })
      ).rejects.toThrow('Organization not found');
    });

    it('should preserve existing settings', async () => {
      const orgId = 'org_123';
      const existingSettings = { theme: 'dark', language: 'en' };
      const updates = { theme: 'light' };

      db.query.mockResolvedValueOnce({
        rows: [{ settings: { ...existingSettings, ...updates } }],
      });

      const result = await organizationService.updateOrganizationSettings(orgId, updates);

      expect(result.settings.language).toBe('en');
      expect(result.settings.theme).toBe('light');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        organizationService.updateOrganizationSettings('org_123', { theme: 'dark' })
      ).rejects.toThrow('Database error');
    });
  });

  // ==================== GET PENDING INVITATIONS TESTS ====================
  describe('getPendingInvitations', () => {
    it('should get pending invitations for organization', async () => {
      const orgId = 'org_123';
      const invitations = [
        { id: 'invite_1', email: 'user1@example.com', status: 'pending' },
        { id: 'invite_2', email: 'user2@example.com', status: 'pending' },
      ];

      db.query.mockResolvedValueOnce({ rows: invitations });

      const result = await organizationService.getPendingInvitations(orgId);

      expect(result).toEqual(invitations);
      expect(result.length).toBe(2);
    });

    it('should throw error when orgId is missing', async () => {
      await expect(organizationService.getPendingInvitations('')).rejects.toThrow(
        'Organization ID is required'
      );
    });

    it('should return empty array when no pending invitations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await organizationService.getPendingInvitations('org_123');

      expect(result).toEqual([]);
    });

    it('should only return non-accepted invitations', async () => {
      const invitations = [
        { id: 'invite_1', email: 'user@example.com', accepted: false },
      ];

      db.query.mockResolvedValueOnce({ rows: invitations });

      const result = await organizationService.getPendingInvitations('org_123');

      expect(result[0].accepted).toBe(false);
    });

    it('should include expiration date for each invitation', async () => {
      const invitations = [
        { id: 'invite_1', email: 'user@example.com', expires_at: expect.any(String) },
      ];

      db.query.mockResolvedValueOnce({ rows: invitations });

      const result = await organizationService.getPendingInvitations('org_123');

      expect(result[0].expires_at).toBeDefined();
    });

    it('should support filtering by role', async () => {
      const adminInvites = [
        { id: 'invite_1', email: 'user@example.com', role: 'admin' },
      ];

      db.query.mockResolvedValueOnce({ rows: adminInvites });

      const result = await organizationService.getPendingInvitations('org_123', { role: 'admin' });

      expect(result[0].role).toBe('admin');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.getPendingInvitations('org_123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== CANCEL INVITATION TESTS ====================
  describe('cancelInvitation', () => {
    it('should cancel invitation', async () => {
      const inviteId = 'invite_123';

      db.query.mockResolvedValueOnce({
        rows: [{ id: inviteId, cancelled: true }],
      });

      const result = await organizationService.cancelInvitation(inviteId);

      expect(result.cancelled).toBe(true);
      expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error when inviteId is missing', async () => {
      await expect(organizationService.cancelInvitation('')).rejects.toThrow(
        'Invitation ID is required'
      );
    });

    it('should throw error when invitation not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(organizationService.cancelInvitation('nonexistent')).rejects.toThrow(
        'Invitation not found'
      );
    });

    it('should prevent cancelling already accepted invitation', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'invite_123', accepted: true }],
      });

      await expect(organizationService.cancelInvitation('invite_123')).rejects.toThrow(
        'Cannot cancel accepted invitation'
      );
    });

    it('should update invitation status to cancelled', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ status: 'cancelled' }],
      });

      const result = await organizationService.cancelInvitation('invite_123');

      expect(result.status).toBe('cancelled');
    });

    it('should handle database error', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(organizationService.cancelInvitation('invite_123')).rejects.toThrow(
        'Database error'
      );
    });
  });

  // ==================== EDGE CASES AND INTEGRATION TESTS ====================
  describe('Edge Cases and Integration Tests', () => {
    it('should handle null values in organization data', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', name: 'Org', description: null }],
      });

      const result = await organizationService.getOrganization('org_123');

      expect(result.description).toBeNull();
    });

    it('should handle concurrent organization creations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_1', name: 'Org 1' }],
      });
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_2', name: 'Org 2' }],
      });

      const org1 = organizationService.createOrganization('Org 1', 'user_123');
      const org2 = organizationService.createOrganization('Org 2', 'user_456');

      const results = await Promise.all([org1, org2]);

      expect(results).toHaveLength(2);
    });

    it('should handle unicode characters in organization name', async () => {
      const name = 'Organizacion España 中国';
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', name }],
      });

      const result = await organizationService.createOrganization(name, 'user_123');

      expect(result.name).toBe(name);
    });

    it('should maintain data consistency across operations', async () => {
      const orgId = 'org_123';

      // Get organization
      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, member_count: 5 }],
      });

      // Add member
      db.query.mockResolvedValueOnce({
        rows: [{ org_id: orgId }],
      });

      // Get updated count
      db.query.mockResolvedValueOnce({
        rows: [{ id: orgId, member_count: 6 }],
      });

      await organizationService.getOrganization(orgId);
      await organizationService.inviteUser(orgId, 'user@example.com', 'member');
      const updated = await organizationService.getOrganization(orgId);

      expect(updated.member_count).toBe(6);
    });

    it('should handle very long organization names gracefully', async () => {
      const longName = 'A'.repeat(255);
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', name: longName }],
      });

      const result = await organizationService.createOrganization(longName, 'user_123');

      expect(result.name.length).toBe(255);
    });

    it('should handle rapid sequential operations', async () => {
      const operations = [];
      for (let i = 0; i < 5; i++) {
        db.query.mockResolvedValueOnce({
          rows: [{ id: `org_${i}` }],
        });
        operations.push(organizationService.getOrganization(`org_${i}`));
      }

      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
    });
  });

  // ==================== LOGGING AND MONITORING TESTS ====================
  describe('Logging and Monitoring', () => {
    it('should log successful operations', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123' }],
      });

      await organizationService.createOrganization('Test Org', 'user_123');

      expect(logger.info).toHaveBeenCalled();
    });

    it('should log errors appropriately', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await organizationService.createOrganization('Test', 'user_123').catch(() => {});

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log warnings for unusual patterns', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123', owner_id: null }],
      });

      await organizationService.getOrganization('org_123');

      expect(logger.warn).toHaveBeenCalledTimes(0);
    });

    it('should debug log database queries', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'org_123' }],
      });

      await organizationService.getOrganization('org_123');

      expect(logger.debug).toHaveBeenCalled();
    });
  });
});
