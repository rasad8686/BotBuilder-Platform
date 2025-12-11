/**
 * EntityVersion Model Tests
 * Tests for server/models/EntityVersion.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const EntityVersion = require('../../models/EntityVersion');

describe('EntityVersion Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create version with all fields', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await EntityVersion.create({
        tenantId: 1,
        entityType: 'bot',
        entityId: 5,
        versionNumber: 1,
        versionData: { name: 'Test Bot', prompt: 'Hello' },
        createdBy: 1,
        commitMessage: 'Initial version'
      });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entity_versions'),
        [1, 'bot', 5, 1, '{"name":"Test Bot","prompt":"Hello"}', 1, 'Initial version']
      );
    });

    it('should use null for optional commitMessage', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await EntityVersion.create({
        tenantId: 1,
        entityType: 'bot',
        entityId: 5,
        versionNumber: 1,
        versionData: {},
        createdBy: 1
      });

      expect(db.query.mock.calls[0][1][6]).toBeNull();
    });
  });

  describe('findByEntity()', () => {
    it('should return versions for entity', async () => {
      const mockVersions = [
        { id: 1, version_number: 2 },
        { id: 2, version_number: 1 }
      ];
      db.query.mockResolvedValueOnce({ rows: mockVersions });

      const result = await EntityVersion.findByEntity(1, 'bot', 5);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('entity_type = $2'),
        [1, 'bot', 5, 50, 0]
      );
    });

    it('should use custom limit and offset', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await EntityVersion.findByEntity(1, 'bot', 5, { limit: 10, offset: 20 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 'bot', 5, 10, 20]
      );
    });
  });

  describe('findById()', () => {
    it('should return version by ID', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version_number: 1 }] });

      const result = await EntityVersion.findById(1);

      expect(result.id).toBe(1);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await EntityVersion.findById(999);

      expect(result).toBeUndefined();
    });
  });

  describe('getLatest()', () => {
    it('should return latest version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version_number: 5 }] });

      const result = await EntityVersion.getLatest(1, 'bot', 5);

      expect(result.version_number).toBe(5);
    });

    it('should return undefined if no versions', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await EntityVersion.getLatest(1, 'bot', 999);

      expect(result).toBeUndefined();
    });
  });

  describe('getByVersionNumber()', () => {
    it('should return specific version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, version_number: 3 }] });

      const result = await EntityVersion.getByVersionNumber(1, 'bot', 5, 3);

      expect(result.version_number).toBe(3);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await EntityVersion.getByVersionNumber(1, 'bot', 5, 999);

      expect(result).toBeUndefined();
    });
  });

  describe('compare()', () => {
    it('should compare two versions', async () => {
      const versionA = { id: 1, version_number: 1, data: { name: 'Old' }, created_by_name: 'User 1', created_at: new Date(), commit_message: 'v1' };
      const versionB = { id: 2, version_number: 2, data: { name: 'New' }, created_by_name: 'User 2', created_at: new Date(), commit_message: 'v2' };

      db.query
        .mockResolvedValueOnce({ rows: [versionA] })
        .mockResolvedValueOnce({ rows: [versionB] });

      const result = await EntityVersion.compare(1, 'bot', 5, 1, 2);

      expect(result.versionA.number).toBe(1);
      expect(result.versionB.number).toBe(2);
      expect(result.diff.modified.name).toBeDefined();
    });

    it('should throw error if version not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 2, data: {} }] });

      await expect(EntityVersion.compare(1, 'bot', 5, 1, 2))
        .rejects.toThrow('One or both versions not found');
    });
  });

  describe('computeDiff()', () => {
    it('should detect added fields', () => {
      const diff = EntityVersion.computeDiff({}, { newField: 'value' });

      expect(diff.added.newField).toBe('value');
    });

    it('should detect removed fields', () => {
      const diff = EntityVersion.computeDiff({ oldField: 'value' }, {});

      expect(diff.removed.oldField).toBe('value');
    });

    it('should detect modified fields', () => {
      const diff = EntityVersion.computeDiff({ field: 'old' }, { field: 'new' });

      expect(diff.modified.field.old).toBe('old');
      expect(diff.modified.field.new).toBe('new');
    });

    it('should not include unchanged fields', () => {
      const diff = EntityVersion.computeDiff({ same: 'value' }, { same: 'value' });

      expect(Object.keys(diff.added)).toHaveLength(0);
      expect(Object.keys(diff.removed)).toHaveLength(0);
      expect(Object.keys(diff.modified)).toHaveLength(0);
    });

    it('should handle empty objects', () => {
      const diff = EntityVersion.computeDiff({}, { field: 'value' });

      expect(diff.added.field).toBe('value');
    });

    it('should compare nested objects', () => {
      const diff = EntityVersion.computeDiff(
        { config: { key: 'old' } },
        { config: { key: 'new' } }
      );

      expect(diff.modified.config).toBeDefined();
    });
  });

  describe('countByEntity()', () => {
    it('should return version count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const result = await EntityVersion.countByEntity(1, 'bot', 5);

      expect(result).toBe(10);
    });
  });

  describe('delete()', () => {
    it('should delete version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await EntityVersion.delete(1);

      expect(result.id).toBe(1);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await EntityVersion.delete(999);

      expect(result).toBeUndefined();
    });
  });

  describe('deleteByEntity()', () => {
    it('should delete all versions for entity', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await EntityVersion.deleteByEntity(1, 'bot', 5);

      expect(result).toHaveLength(2);
    });
  });
});
