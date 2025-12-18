/**
 * SCIM Service Unit Tests
 */

const SCIMService = require('../../services/scimService');

// Mock database
jest.mock('../../db', () => {
  const mockKnex = jest.fn(() => mockKnex);
  mockKnex.where = jest.fn().mockReturnThis();
  mockKnex.first = jest.fn();
  mockKnex.insert = jest.fn().mockReturnThis();
  mockKnex.update = jest.fn().mockReturnThis();
  mockKnex.del = jest.fn().mockReturnThis();
  mockKnex.returning = jest.fn();
  mockKnex.select = jest.fn().mockReturnThis();
  mockKnex.orderBy = jest.fn().mockReturnThis();
  mockKnex.join = jest.fn().mockReturnThis();
  mockKnex.offset = jest.fn().mockReturnThis();
  mockKnex.limit = jest.fn().mockReturnThis();
  mockKnex.clone = jest.fn().mockReturnThis();
  mockKnex.count = jest.fn();
  mockKnex.onConflict = jest.fn().mockReturnThis();
  mockKnex.ignore = jest.fn();
  mockKnex.fn = { now: jest.fn(() => new Date()) };
  return mockKnex;
});

const db = require('../../db');

describe('SCIMService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseScimFilter', () => {
    it('should parse simple equality filter', () => {
      const result = SCIMService.parseScimFilter('userName eq "john@example.com"');

      expect(result.userName).toBe('john@example.com');
    });

    it('should parse multiple equality filters', () => {
      const result = SCIMService.parseScimFilter('userName eq "john" and displayName eq "John Doe"');

      expect(result.userName).toBe('john');
      expect(result.displayName).toBe('John Doe');
    });

    it('should parse contains filter', () => {
      const result = SCIMService.parseScimFilter('displayName co "john"');

      expect(result.displayName_contains).toBe('john');
    });

    it('should parse starts with filter', () => {
      const result = SCIMService.parseScimFilter('userName sw "admin"');

      expect(result.userName_startsWith).toBe('admin');
    });

    it('should parse nested attribute filter', () => {
      const result = SCIMService.parseScimFilter('name.givenName eq "John"');

      expect(result.name_givenName).toBe('John');
    });

    it('should return empty object for null filter', () => {
      const result = SCIMService.parseScimFilter(null);

      expect(result).toEqual({});
    });

    it('should return empty object for invalid filter', () => {
      const result = SCIMService.parseScimFilter('invalid filter string');

      expect(result).toEqual({});
    });
  });

  describe('createUserFromScim', () => {
    it('should create user with required fields', async () => {
      const scimUser = {
        userName: 'test@example.com',
        name: {
          givenName: 'Test',
          familyName: 'User'
        },
        emails: [{ value: 'test@example.com', primary: true }]
      };

      const mockConfig = { id: 1, organization_id: 1, default_role_id: 2 };
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };

      db.first.mockResolvedValueOnce(mockConfig); // config lookup
      db.first.mockResolvedValueOnce(null); // user doesn't exist
      db.returning.mockResolvedValue([mockUser]);
      db.insert.mockReturnThis();
      db.ignore.mockResolvedValue();

      const result = await SCIMService.createUser(1, scimUser);

      expect(result.userName).toBe('test@example.com');
      expect(result.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:User');
    });

    it('should throw error for missing email', async () => {
      const scimUser = {
        name: { givenName: 'Test' }
        // Missing userName and emails
      };

      const mockConfig = { id: 1, organization_id: 1 };
      db.first.mockResolvedValueOnce(mockConfig);

      await expect(SCIMService.createUser(1, scimUser)).rejects.toThrow('Email is required');
    });

    it('should skip creation if user already exists', async () => {
      const scimUser = {
        userName: 'existing@example.com',
        externalId: 'ext-123'
      };

      const mockConfig = { id: 1, organization_id: 1 };
      const existingUser = { id: 1, email: 'existing@example.com', name: 'Existing' };

      db.first.mockResolvedValueOnce(mockConfig);
      db.first.mockResolvedValueOnce(existingUser);

      const result = await SCIMService.createUser(1, scimUser);

      expect(result.userName).toBe('existing@example.com');
    });
  });

  describe('updateUserFromScim', () => {
    it('should update user name', async () => {
      const scimUser = {
        displayName: 'Updated Name',
        active: true
      };

      const mockMapping = { id: 1, user_id: 1, external_id: 'ext-123' };
      const mockUser = { id: 1, email: 'test@example.com', name: 'Updated Name' };

      db.first.mockResolvedValueOnce(mockMapping);
      db.update.mockResolvedValue(1);
      db.first.mockResolvedValueOnce(mockUser);

      const result = await SCIMService.updateUser(1, 'ext-123', scimUser);

      expect(result.displayName).toBe('Updated Name');
    });

    it('should deactivate user when active is false', async () => {
      const scimUser = {
        active: false
      };

      const mockMapping = { id: 1, user_id: 1, external_id: 'ext-123' };
      const mockUser = { id: 1, email: 'test@example.com', name: 'Test' };

      db.first.mockResolvedValueOnce(mockMapping);
      db.update.mockResolvedValue(1);
      db.first.mockResolvedValueOnce(mockUser);

      await SCIMService.updateUser(1, 'ext-123', scimUser);

      // Verify team_members update was called with inactive status
      expect(db.update).toHaveBeenCalled();
    });

    it('should throw error for non-existing user', async () => {
      db.first.mockResolvedValue(null);

      await expect(
        SCIMService.updateUser(1, 'non-existing', { displayName: 'Test' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('deactivateUser', () => {
    it('should change user status to inactive', async () => {
      const mockConfig = { id: 1, organization_id: 1, auto_deprovision_users: false };
      const mockMapping = { id: 1, user_id: 1, external_id: 'ext-123' };

      db.first.mockResolvedValueOnce(mockConfig);
      db.first.mockResolvedValueOnce(mockMapping);
      db.update.mockResolvedValue(1);

      const result = await SCIMService.deleteUser(1, 'ext-123');

      expect(result.success).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('should hard delete when auto_deprovision_users is true', async () => {
      const mockConfig = { id: 1, organization_id: 1, auto_deprovision_users: true };
      const mockMapping = { id: 1, user_id: 1, external_id: 'ext-123' };

      db.first.mockResolvedValueOnce(mockConfig);
      db.first.mockResolvedValueOnce(mockMapping);
      db.del.mockResolvedValue(1);

      const result = await SCIMService.deleteUser(1, 'ext-123');

      expect(result.success).toBe(true);
      expect(db.del).toHaveBeenCalled();
    });
  });

  describe('buildScimResponse', () => {
    it('should format user correctly', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02')
      };

      const result = SCIMService.toSCIMUser(user, 'ext-123');

      expect(result.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:User');
      expect(result.id).toBe('ext-123');
      expect(result.userName).toBe('test@example.com');
      expect(result.displayName).toBe('Test User');
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].value).toBe('test@example.com');
      expect(result.meta.resourceType).toBe('User');
    });
  });

  describe('validateScimRequest', () => {
    it('should validate user request with userName', () => {
      const result = SCIMService.validateScimRequest(
        { userName: 'test@example.com' },
        'User'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate user request with emails', () => {
      const result = SCIMService.validateScimRequest(
        { emails: [{ value: 'test@example.com' }] },
        'User'
      );

      expect(result.valid).toBe(true);
    });

    it('should fail validation for user without email', () => {
      const result = SCIMService.validateScimRequest(
        { displayName: 'Test' },
        'User'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('userName or emails is required');
    });

    it('should validate group request with displayName', () => {
      const result = SCIMService.validateScimRequest(
        { displayName: 'Test Group' },
        'Group'
      );

      expect(result.valid).toBe(true);
    });

    it('should fail validation for group without displayName', () => {
      const result = SCIMService.validateScimRequest(
        { members: [] },
        'Group'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('displayName is required');
    });
  });

  describe('generateScimError', () => {
    it('should generate proper error response', () => {
      const error = SCIMService.generateScimError(404, 'User not found');

      expect(error.schemas).toContain('urn:ietf:params:scim:api:messages:2.0:Error');
      expect(error.status).toBe('404');
      expect(error.detail).toBe('User not found');
    });

    it('should include scimType when provided', () => {
      const error = SCIMService.generateScimError(409, 'User exists', 'uniqueness');

      expect(error.scimType).toBe('uniqueness');
    });
  });

  describe('getServiceProviderConfig', () => {
    it('should return valid service provider config', () => {
      const config = SCIMService.getServiceProviderConfig();

      expect(config.schemas).toContain('urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig');
      expect(config.patch.supported).toBe(true);
      expect(config.bulk.supported).toBe(false);
      expect(config.filter.supported).toBe(true);
      expect(config.authenticationSchemes).toHaveLength(1);
    });
  });

  describe('extractEmail', () => {
    it('should extract email from userName', () => {
      const result = SCIMService.extractEmail({ userName: 'test@example.com' });

      expect(result).toBe('test@example.com');
    });

    it('should extract email from emails array', () => {
      const result = SCIMService.extractEmail({
        emails: [
          { value: 'secondary@example.com' },
          { value: 'primary@example.com', primary: true }
        ]
      });

      expect(result).toBe('primary@example.com');
    });

    it('should return first email if no primary', () => {
      const result = SCIMService.extractEmail({
        emails: [{ value: 'first@example.com' }]
      });

      expect(result).toBe('first@example.com');
    });

    it('should return null if no email found', () => {
      const result = SCIMService.extractEmail({ displayName: 'Test' });

      expect(result).toBeNull();
    });
  });

  describe('extractName', () => {
    it('should extract displayName', () => {
      const result = SCIMService.extractName({ displayName: 'Test User' });

      expect(result).toBe('Test User');
    });

    it('should combine givenName and familyName', () => {
      const result = SCIMService.extractName({
        name: { givenName: 'John', familyName: 'Doe' }
      });

      expect(result).toBe('John Doe');
    });

    it('should use formatted name as fallback', () => {
      const result = SCIMService.extractName({
        name: { formatted: 'John Doe Jr.' }
      });

      expect(result).toBe('John Doe Jr.');
    });

    it('should extract from email if no name', () => {
      const result = SCIMService.extractName({ userName: 'john.doe@example.com' });

      expect(result).toBe('john.doe');
    });
  });
});
