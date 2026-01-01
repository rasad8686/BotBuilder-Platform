/**
 * Organization Model Tests
 * Tests for server/models/Organization.js
 */

// Mock the database BEFORE importing the model
jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const Organization = require('../../models/Organization');

describe('Organization Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // create()
  // ========================================
  describe('create()', () => {
    it('should create a new organization with all required fields', async () => {
      const mockOrgRow = {
        id: 1,
        name: 'Acme Corp',
        slug: 'acme-corp',
        owner_id: 10,
        plan_tier: 'free',
        settings: '{}'
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockOrgRow] }); // SELECT for findById

      const result = await Organization.create({
        name: 'Acme Corp',
        slug: 'acme-corp',
        owner_id: 10
      });

      expect(result.id).toBe(1);
      expect(result.name).toBe('Acme Corp');
      expect(result.slug).toBe('acme-corp');
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    it('should set plan_tier to free by default', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'free', settings: '{}' }] });

      await Organization.create({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][3]).toBe('free'); // plan_tier should be free
    });

    it('should allow custom plan_tier', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'enterprise', settings: '{}' }] });

      await Organization.create({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10,
        plan_tier: 'enterprise'
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][3]).toBe('enterprise');
    });

    it('should stringify settings object', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"key":"value"}' }] });

      await Organization.create({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10,
        settings: { key: 'value' }
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe('{"key":"value"}');
    });

    it('should use empty object for settings if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Organization.create({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10
      });

      const insertCall = db.query.mock.calls[0];
      expect(insertCall[1][4]).toBe('{}');
    });
  });

  // ========================================
  // findById()
  // ========================================
  describe('findById()', () => {
    it('should return organization if found', async () => {
      const mockOrg = {
        id: 1,
        name: 'Acme Corp',
        slug: 'acme-corp',
        settings: '{"theme":"dark"}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockOrg] });

      const result = await Organization.findById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Acme Corp');
      expect(result.settings).toEqual({ theme: 'dark' });
      expect(db.query).toHaveBeenCalledWith('SELECT * FROM organizations WHERE id = $1', [1]);
    });

    it('should return null if organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Organization.findById(999);

      expect(result).toBeNull();
    });

    it('should parse JSON settings', async () => {
      const mockOrg = {
        id: 1,
        name: 'Test Org',
        settings: '{"a":1,"b":2}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockOrg] });

      const result = await Organization.findById(1);

      expect(result.settings).toEqual({ a: 1, b: 2 });
      expect(typeof result.settings).toBe('object');
    });
  });

  // ========================================
  // findBySlug()
  // ========================================
  describe('findBySlug()', () => {
    it('should return organization if found by slug', async () => {
      const mockOrg = {
        id: 1,
        name: 'Acme Corp',
        slug: 'acme-corp',
        settings: '{}'
      };
      db.query.mockResolvedValueOnce({ rows: [mockOrg] });

      const result = await Organization.findBySlug('acme-corp');

      expect(result.id).toBe(1);
      expect(result.slug).toBe('acme-corp');
      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM organizations WHERE slug = $1',
        ['acme-corp']
      );
    });

    it('should return null if slug not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Organization.findBySlug('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ========================================
  // findAll()
  // ========================================
  describe('findAll()', () => {
    it('should return all organizations with default pagination', async () => {
      const mockOrgs = [
        { id: 1, name: 'Org 1', settings: '{}' },
        { id: 2, name: 'Org 2', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrgs });

      const result = await Organization.findAll();

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [10, 0] // default limit and offset
      );
    });

    it('should support custom pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.findAll({ limit: 20, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [20, 10]
      );
    });

    it('should return empty array if no organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Organization.findAll();

      expect(result).toEqual([]);
    });

    it('should parse settings for all organizations', async () => {
      const mockOrgs = [
        { id: 1, settings: '{"a":1}' },
        { id: 2, settings: '{"b":2}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrgs });

      const result = await Organization.findAll();

      expect(result[0].settings).toEqual({ a: 1 });
      expect(result[1].settings).toEqual({ b: 2 });
    });
  });

  // ========================================
  // findByOwner()
  // ========================================
  describe('findByOwner()', () => {
    it('should return organizations for a specific owner', async () => {
      const mockOrgs = [
        { id: 1, owner_id: 10, name: 'Org 1', settings: '{}' },
        { id: 2, owner_id: 10, name: 'Org 2', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrgs });

      const result = await Organization.findByOwner(10);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('owner_id = $1'),
        [10, 10, 0]
      );
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.findByOwner(10, { limit: 15, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 15, 5]
      );
    });

    it('should return empty array if owner has no organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Organization.findByOwner(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // findByUser()
  // ========================================
  describe('findByUser()', () => {
    it('should return organizations where user is a member', async () => {
      const mockOrgs = [
        { id: 1, name: 'Org 1', settings: '{}' },
        { id: 2, name: 'Org 2', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrgs });

      const result = await Organization.findByUser(10);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('om.user_id = $1'),
        [10, 10, 0]
      );
    });

    it('should join with organization_members table', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.findByUser(10);

      expect(db.query.mock.calls[0][0]).toContain('JOIN organization_members');
    });

    it('should support pagination', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.findByUser(10, { limit: 25, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 25, 10]
      );
    });

    it('should return empty array if user is not a member of any organization', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Organization.findByUser(999);

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // search()
  // ========================================
  describe('search()', () => {
    it('should search organizations by name', async () => {
      const mockOrgs = [
        { id: 1, name: 'Acme Corporation', settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockOrgs });

      const result = await Organization.search('acme');

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE $1'),
        ['%acme%', 10, 0]
      );
    });

    it('should be case-insensitive', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.search('ACME');

      expect(db.query.mock.calls[0][1][0]).toBe('%ACME%');
    });

    it('should support pagination for search results', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await Organization.search('test', { limit: 5, offset: 2 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        ['%test%', 5, 2]
      );
    });

    it('should return empty array if no matches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await Organization.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  // ========================================
  // update()
  // ========================================
  describe('update()', () => {
    it('should update organization name', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Org', settings: '{}' }] }); // SELECT

      const result = await Organization.update(1, { name: 'Updated Org' });

      expect(result.name).toBe('Updated Org');
      expect(db.query.mock.calls[0][0]).toContain('name = $1');
    });

    it('should update organization slug', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, slug: 'new-slug', settings: '{}' }] });

      await Organization.update(1, { slug: 'new-slug' });

      expect(db.query.mock.calls[0][0]).toContain('slug = $1');
    });

    it('should update plan_tier', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, plan_tier: 'premium', settings: '{}' }] });

      await Organization.update(1, { plan_tier: 'premium' });

      expect(db.query.mock.calls[0][0]).toContain('plan_tier = $1');
    });

    it('should update settings', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"new":"settings"}' }] });

      await Organization.update(1, { settings: { new: 'settings' } });

      expect(db.query.mock.calls[0][1]).toContain('{"new":"settings"}');
    });

    it('should update multiple fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Organization.update(1, {
        name: 'Updated',
        slug: 'updated-slug',
        plan_tier: 'enterprise'
      });

      const updateQuery = db.query.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
      expect(updateQuery).toContain('slug = $2');
      expect(updateQuery).toContain('plan_tier = $3');
    });

    it('should not update if no fields provided', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Organization.update(1, {});

      expect(db.query).toHaveBeenCalledTimes(1); // Only SELECT, no UPDATE
    });

    it('should always update updated_at timestamp', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{}' }] });

      await Organization.update(1, { name: 'Test' });

      expect(db.query.mock.calls[0][0]).toContain('updated_at = NOW()');
    });
  });

  // ========================================
  // delete()
  // ========================================
  describe('delete()', () => {
    it('should delete organization by id', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1 });

      await Organization.delete(1);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM organizations WHERE id = $1',
        [1]
      );
    });

    it('should handle deletion of non-existent organization', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 0 });

      await Organization.delete(999);

      expect(db.query).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // count()
  // ========================================
  describe('count()', () => {
    it('should return total count of organizations', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '25' }] });

      const result = await Organization.count();

      expect(result).toBe(25);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM organizations'
      );
    });

    it('should return 0 if no organizations exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await Organization.count();

      expect(result).toBe(0);
    });
  });

  // ========================================
  // parseOrganization()
  // ========================================
  describe('parseOrganization()', () => {
    it('should parse JSON string settings', () => {
      const raw = {
        id: 1,
        name: 'Test Org',
        settings: '{"key":"value"}'
      };

      const result = Organization.parseOrganization(raw);

      expect(result.settings).toEqual({ key: 'value' });
      expect(typeof result.settings).toBe('object');
    });

    it('should handle already parsed settings', () => {
      const raw = {
        id: 1,
        name: 'Test Org',
        settings: { key: 'value' }
      };

      const result = Organization.parseOrganization(raw);

      expect(result.settings).toEqual({ key: 'value' });
    });

    it('should default to empty object for null/undefined settings', () => {
      const raw = {
        id: 1,
        name: 'Test Org',
        settings: null
      };

      const result = Organization.parseOrganization(raw);

      expect(result.settings).toEqual({});
    });

    it('should preserve all other fields', () => {
      const raw = {
        id: 1,
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10,
        plan_tier: 'free',
        settings: '{}'
      };

      const result = Organization.parseOrganization(raw);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Test Org');
      expect(result.slug).toBe('test-org');
      expect(result.owner_id).toBe(10);
      expect(result.plan_tier).toBe('free');
    });
  });

  // ========================================
  // Error Handling
  // ========================================
  describe('Error Handling', () => {
    it('should propagate database errors on create', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(Organization.create({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10
      })).rejects.toThrow('Database error');
    });

    it('should propagate database errors on findById', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection error'));

      await expect(Organization.findById(1)).rejects.toThrow('Connection error');
    });

    it('should propagate database errors on findBySlug', async () => {
      db.query.mockRejectedValueOnce(new Error('Query error'));

      await expect(Organization.findBySlug('test-slug')).rejects.toThrow('Query error');
    });

    it('should propagate database errors on update', async () => {
      db.query.mockRejectedValueOnce(new Error('Update failed'));

      await expect(Organization.update(1, { name: 'Test' })).rejects.toThrow('Update failed');
    });

    it('should propagate database errors on delete', async () => {
      db.query.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(Organization.delete(1)).rejects.toThrow('Delete failed');
    });
  });

  // ========================================
  // Validation Tests
  // ========================================
  describe('Validation', () => {
    it('should handle empty name gracefully', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: '', settings: '{}' }] });

      const result = await Organization.create({
        name: '',
        slug: 'test-org',
        owner_id: 10
      });

      expect(result.name).toBe('');
    });

    it('should handle special characters in name', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Org <>&"', settings: '{}' }] });

      const result = await Organization.create({
        name: 'Org <>&"',
        slug: 'org',
        owner_id: 10
      });

      expect(result.name).toBe('Org <>&"');
    });

    it('should handle complex settings object', async () => {
      const complexSettings = {
        branding: { logo: 'url', colors: ['#fff', '#000'] },
        features: { chat: true, voice: false },
        limits: { bots: 10, users: 100 }
      };

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, settings: JSON.stringify(complexSettings) }] });

      const result = await Organization.create({
        name: 'Test Org',
        slug: 'test-org',
        owner_id: 10,
        settings: complexSettings
      });

      expect(result.settings).toEqual(complexSettings);
    });

    it('should handle slug with hyphens and numbers', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, slug: 'org-123-test', settings: '{}' }] });

      const result = await Organization.create({
        name: 'Test Org',
        slug: 'org-123-test',
        owner_id: 10
      });

      expect(result.slug).toBe('org-123-test');
    });
  });
});
