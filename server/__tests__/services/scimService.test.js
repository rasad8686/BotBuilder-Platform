/**
 * SCIM Service Tests
 * Tests for server/services/scimService.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');
const SCIMService = require('../../services/scimService');

describe('SCIM Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate SCIM token', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          name: 'API Token',
          token_prefix: 'scim_abc',
          created_at: new Date()
        }]
      });

      const result = await SCIMService.generateToken(1, 'API Token');

      expect(result.token).toMatch(/^scim_/);
      expect(result.tokenInfo.name).toBe('API Token');
    });

    it('should generate token with expiration', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }]
      });

      const result = await SCIMService.generateToken(1, 'API Token', 30);

      expect(result.tokenInfo.expires_at).toBeDefined();
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            sso_configuration_id: 1,
            is_active: true,
            expires_at: null
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Update last_used_at
        .mockResolvedValueOnce({
          rows: [{ id: 1, organization_id: 1 }]
        });

      const result = await SCIMService.validateToken('scim_validtoken123');

      expect(result).not.toBeNull();
    });

    it('should return null for invalid token format', async () => {
      const result = await SCIMService.validateToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for null token', async () => {
      const result = await SCIMService.validateToken(null);
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      db.query.mockResolvedValue({
        rows: [{
          id: 1,
          is_active: true,
          expires_at: new Date(Date.now() - 86400000) // Expired
        }]
      });

      const result = await SCIMService.validateToken('scim_expiredtoken');
      expect(result).toBeNull();
    });

    it('should return null for inactive token', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SCIMService.validateToken('scim_inactivetoken');
      expect(result).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke token', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const result = await SCIMService.revokeToken(1, 1);

      expect(result.success).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('is_active = false'),
        [1, 1]
      );
    });
  });

  describe('listTokens', () => {
    it('should list tokens for config', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, name: 'Token 1', is_active: true },
          { id: 2, name: 'Token 2', is_active: false }
        ]
      });

      const result = await SCIMService.listTokens(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('createUser', () => {
    it('should create new user via SCIM', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, organization_id: 1, default_role_id: 2 }] }) // Get config
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({ rows: [{ id: 100, email: 'user@test.com', name: 'Test User' }] }) // Insert user
        .mockResolvedValueOnce({ rows: [] }) // Insert team member
        .mockResolvedValueOnce({ rows: [] }) // Update mapping - check existing
        .mockResolvedValueOnce({ rows: [] }) // Insert mapping
        .mockResolvedValueOnce({ rows: [] }); // Log sync

      const scimUser = {
        userName: 'user@test.com',
        name: { givenName: 'Test', familyName: 'User' },
        displayName: 'Test User'
      };

      const result = await SCIMService.createUser(1, scimUser);

      expect(result.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:User');
      expect(result.userName).toBe('user@test.com');
    });

    it('should return existing user if already exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Get config
        .mockResolvedValueOnce({ rows: [{ id: 100, email: 'user@test.com', name: 'Test' }] }) // Existing user
        .mockResolvedValueOnce({ rows: [] }) // Update mapping
        .mockResolvedValueOnce({ rows: [] }) // Log sync
        .mockResolvedValueOnce({ rows: [] });

      const result = await SCIMService.createUser(1, { userName: 'user@test.com' });

      expect(result.userName).toBe('user@test.com');
    });

    it('should throw if config not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SCIMService.createUser(999, { userName: 'test@test.com' }))
        .rejects.toThrow('SSO configuration not found');
    });

    it('should throw if email missing', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await expect(SCIMService.createUser(1, {}))
        .rejects.toThrow('Email is required');
    });
  });

  describe('getUser', () => {
    it('should get user by external ID', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ user_id: 100, external_id: 'ext-123' }] })
        .mockResolvedValueOnce({ rows: [{ id: 100, email: 'user@test.com', name: 'Test' }] });

      const result = await SCIMService.getUser(1, 'ext-123');

      expect(result.id).toBe('ext-123');
    });

    it('should return null if mapping not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SCIMService.getUser(1, 'unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ user_id: 100, external_id: 'ext-123' }] })
        .mockResolvedValueOnce({ rows: [] }) // Update name
        .mockResolvedValueOnce({ rows: [] }) // Update mapping - check existing
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Update mapping
        .mockResolvedValueOnce({ rows: [] }) // Log sync
        .mockResolvedValueOnce({ rows: [{ id: 100, email: 'user@test.com', name: 'Updated Name' }] });

      const result = await SCIMService.updateUser(1, 'ext-123', {
        displayName: 'Updated Name'
      });

      expect(result.displayName).toBe('Updated Name');
    });

    it('should deactivate user when active=false', async () => {
      const mockUser = { id: 100, name: 'Test User', email: 'test@test.com', created_at: new Date(), updated_at: new Date() };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 100 }] }) // 1. Get mapping
        .mockResolvedValueOnce({ rows: [] }) // 2. Update team member status (active=false)
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // 3. updateUserMapping: Check existing mapping
        .mockResolvedValueOnce({ rows: [] }) // 4. updateUserMapping: Update mapping
        .mockResolvedValueOnce({ rows: [] }) // 5. Log sync
        .mockResolvedValueOnce({ rows: [mockUser] }) // 6. Get user for response
        .mockResolvedValue({ rows: [mockUser] }); // Fallback for any additional calls

      await SCIMService.updateUser(1, 'ext-123', { active: false });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'inactive'"),
        expect.any(Array)
      );
    });

    it('should throw if user not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SCIMService.updateUser(1, 'unknown', {}))
        .rejects.toThrow('User not found');
    });
  });

  describe('deleteUser', () => {
    it('should deprovision user', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ organization_id: 1, auto_deprovision_users: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 100 }] })
        .mockResolvedValueOnce({ rows: [] }) // Update team member
        .mockResolvedValueOnce({ rows: [] }); // Log sync

      const result = await SCIMService.deleteUser(1, 'ext-123');

      expect(result.success).toBe(true);
    });

    it('should fully delete user when auto_deprovision enabled', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ organization_id: 1, auto_deprovision_users: true }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 100 }] })
        .mockResolvedValueOnce({ rows: [] }) // Delete team member
        .mockResolvedValueOnce({ rows: [] }) // Delete mapping
        .mockResolvedValueOnce({ rows: [] }); // Log sync

      await SCIMService.deleteUser(1, 'ext-123');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM team_members'),
        expect.any(Array)
      );
    });

    it('should throw if user not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ organization_id: 1 }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(SCIMService.deleteUser(1, 'unknown'))
        .rejects.toThrow('User not found');
    });
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '10' }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, email: 'user1@test.com', external_id: 'ext-1' },
            { id: 2, email: 'user2@test.com', external_id: 'ext-2' }
          ]
        });

      const result = await SCIMService.listUsers(1, { startIndex: 1, count: 10 });

      expect(result.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:ListResponse');
      expect(result.totalResults).toBe(10);
      expect(result.Resources).toHaveLength(2);
    });

    it('should filter by userName', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, email: 'user@test.com' }] });

      await SCIMService.listUsers(1, { filter: 'userName eq "user@test.com"' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('u.email = $'),
        expect.arrayContaining(['user@test.com'])
      );
    });
  });

  describe('createGroup', () => {
    it('should create group', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, default_role_id: 2 }] })
        .mockResolvedValueOnce({ rows: [] }) // No existing group
        .mockResolvedValueOnce({ rows: [{ id: 1, external_group_id: 'grp-123', external_group_name: 'Admins' }] })
        .mockResolvedValueOnce({ rows: [] }) // Log sync
        .mockResolvedValueOnce({ rows: [] }); // Get members for toSCIMGroup

      const result = await SCIMService.createGroup(1, {
        displayName: 'Admins',
        externalId: 'grp-123'
      });

      expect(result.displayName).toBe('Admins');
    });

    it('should throw if displayName missing', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      await expect(SCIMService.createGroup(1, {}))
        .rejects.toThrow('displayName is required');
    });

    it('should throw if group already exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Existing group

      await expect(SCIMService.createGroup(1, { displayName: 'Existing', externalId: 'grp-1' }))
        .rejects.toThrow('Group already exists');
    });
  });

  describe('getGroup', () => {
    it('should return group', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{ id: 1, external_group_id: 'grp-123', external_group_name: 'Admins', role_id: 1 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Members

      const result = await SCIMService.getGroup(1, 'grp-123');

      expect(result.displayName).toBe('Admins');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await SCIMService.getGroup(1, 'unknown');

      expect(result).toBeNull();
    });
  });

  describe('updateGroup', () => {
    it('should update group name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] }) // Update name
        .mockResolvedValueOnce({ rows: [] }) // Log sync
        .mockResolvedValueOnce({ rows: [{ id: 1, external_group_name: 'New Name' }] })
        .mockResolvedValueOnce({ rows: [] }); // Members

      const result = await SCIMService.updateGroup(1, 'grp-123', {
        displayName: 'New Name'
      });

      expect(result.displayName).toBe('New Name');
    });

    it('should throw if group not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SCIMService.updateGroup(1, 'unknown', {}))
        .rejects.toThrow('Group not found');
    });
  });

  describe('deleteGroup', () => {
    it('should delete group', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [] }) // Delete
        .mockResolvedValueOnce({ rows: [] }); // Log sync

      const result = await SCIMService.deleteGroup(1, 'grp-123');

      expect(result.success).toBe(true);
    });

    it('should throw if group not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(SCIMService.deleteGroup(1, 'unknown'))
        .rejects.toThrow('Group not found');
    });
  });

  describe('listGroups', () => {
    it('should return paginated groups', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, external_group_id: 'grp-1', external_group_name: 'Group 1', role_id: 1 }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Members

      const result = await SCIMService.listGroups(1, { startIndex: 1, count: 10 });

      expect(result.totalResults).toBe(5);
      expect(result.Resources).toHaveLength(1);
    });
  });

  describe('extractEmail', () => {
    it('should extract email from userName', () => {
      const result = SCIMService.extractEmail({ userName: 'user@test.com' });
      expect(result).toBe('user@test.com');
    });

    it('should extract email from emails array', () => {
      const result = SCIMService.extractEmail({
        emails: [{ value: 'user@test.com', primary: true }]
      });
      expect(result).toBe('user@test.com');
    });

    it('should return null if no email', () => {
      const result = SCIMService.extractEmail({});
      expect(result).toBeNull();
    });
  });

  describe('extractName', () => {
    it('should extract displayName', () => {
      const result = SCIMService.extractName({ displayName: 'John Doe' });
      expect(result).toBe('John Doe');
    });

    it('should combine given and family name', () => {
      const result = SCIMService.extractName({
        name: { givenName: 'John', familyName: 'Doe' }
      });
      expect(result).toBe('John Doe');
    });

    it('should use formatted name', () => {
      const result = SCIMService.extractName({
        name: { formatted: 'John Doe' }
      });
      expect(result).toBe('John Doe');
    });

    it('should fallback to email username', () => {
      const result = SCIMService.extractName({ userName: 'john@test.com' });
      expect(result).toBe('john');
    });
  });

  describe('toSCIMUser', () => {
    it('should convert user to SCIM format', () => {
      const user = {
        id: 1,
        email: 'user@test.com',
        name: 'Test User',
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = SCIMService.toSCIMUser(user, 'ext-123');

      expect(result.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:User');
      expect(result.id).toBe('ext-123');
      expect(result.userName).toBe('user@test.com');
      expect(result.meta.resourceType).toBe('User');
    });
  });

  describe('parseScimFilter', () => {
    it('should parse eq filter', () => {
      const result = SCIMService.parseScimFilter('userName eq "user@test.com"');
      expect(result.userName).toBe('user@test.com');
    });

    it('should parse co filter', () => {
      const result = SCIMService.parseScimFilter('displayName co "test"');
      expect(result.displayName_contains).toBe('test');
    });

    it('should parse sw filter', () => {
      const result = SCIMService.parseScimFilter('userName sw "user"');
      expect(result.userName_startsWith).toBe('user');
    });

    it('should parse nested filter', () => {
      const result = SCIMService.parseScimFilter('name.familyName eq "Doe"');
      expect(result.name_familyName).toBe('Doe');
    });
  });

  describe('validateScimRequest', () => {
    it('should validate user request', () => {
      const result = SCIMService.validateScimRequest({ userName: 'user@test.com' }, 'User');
      expect(result.valid).toBe(true);
    });

    it('should invalidate user without email', () => {
      const result = SCIMService.validateScimRequest({}, 'User');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('userName or emails is required');
    });

    it('should validate group request', () => {
      const result = SCIMService.validateScimRequest({ displayName: 'Group' }, 'Group');
      expect(result.valid).toBe(true);
    });

    it('should invalidate group without displayName', () => {
      const result = SCIMService.validateScimRequest({}, 'Group');
      expect(result.valid).toBe(false);
    });
  });

  describe('generateScimError', () => {
    it('should generate SCIM error response', () => {
      const result = SCIMService.generateScimError(404, 'Not found', 'notFound');

      expect(result.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:Error');
      expect(result.status).toBe('404');
      expect(result.detail).toBe('Not found');
      expect(result.scimType).toBe('notFound');
    });
  });

  describe('getServiceProviderConfig', () => {
    it('should return service provider config', () => {
      const result = SCIMService.getServiceProviderConfig();

      expect(result.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig');
      expect(result.patch.supported).toBe(true);
      expect(result.filter.supported).toBe(true);
    });
  });

  describe('getResourceTypes', () => {
    it('should return resource types', () => {
      const result = SCIMService.getResourceTypes();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('User');
    });
  });

  describe('getSchemas', () => {
    it('should return schemas', () => {
      const result = SCIMService.getSchemas();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('urn:ietf:params:scim:schemas:core:2.0:User');
    });
  });
});
