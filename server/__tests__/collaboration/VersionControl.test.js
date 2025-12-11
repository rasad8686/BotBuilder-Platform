/**
 * VersionControl Tests
 * Tests for server/collaboration/core/VersionControl.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const VersionControl = require('../../collaboration/core/VersionControl');

describe('VersionControl', () => {
  let versionControl;

  beforeEach(() => {
    jest.clearAllMocks();
    versionControl = new VersionControl(1);
  });

  describe('constructor', () => {
    it('should set tenant id', () => {
      expect(versionControl.tenantId).toBe(1);
    });
  });

  describe('createVersion', () => {
    it('should create a new version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ max_version: 3 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, version_number: 4, data: { name: 'Test' } }]
        });

      const result = await versionControl.createVersion('flow', 10, { name: 'Test' }, 100, 'Updated flow');

      expect(result.version_number).toBe(4);
      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO entity_versions'),
        expect.arrayContaining([1, 'flow', 10, 4, '{"name":"Test"}', 100, 'Updated flow'])
      );
    });
  });

  describe('getVersions', () => {
    it('should return versions for entity', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, version_number: 2 },
          { id: 2, version_number: 1 }
        ]
      });

      const result = await versionControl.getVersions('flow', 10);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY ev.version_number DESC'),
        [1, 'flow', 10, 50, 0]
      );
    });

    it('should apply pagination', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await versionControl.getVersions('flow', 10, { limit: 10, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 'flow', 10, 10, 5]
      );
    });
  });

  describe('getVersion', () => {
    it('should return specific version', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, version_number: 2, data: { test: true } }]
      });

      const result = await versionControl.getVersion('flow', 10, 2);

      expect(result.version_number).toBe(2);
    });

    it('should return undefined if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await versionControl.getVersion('flow', 10, 999);

      expect(result).toBeUndefined();
    });
  });

  describe('getLatestVersionNumber', () => {
    it('should return latest version number', async () => {
      db.query.mockResolvedValue({
        rows: [{ max_version: 5 }]
      });

      const result = await versionControl.getLatestVersionNumber('flow', 10);

      expect(result).toBe(5);
    });

    it('should return 0 if no versions', async () => {
      db.query.mockResolvedValue({
        rows: [{ max_version: 0 }]
      });

      const result = await versionControl.getLatestVersionNumber('flow', 10);

      expect(result).toBe(0);
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 1, data: { a: 1 } }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 2, data: { a: 2, b: 1 } }] });

      const result = await versionControl.compareVersions('flow', 10, 1, 2);

      expect(result.versionA.version_number).toBe(1);
      expect(result.versionB.version_number).toBe(2);
      expect(result.diff).toBeDefined();
    });

    it('should throw error if version not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 2 }] });

      await expect(versionControl.compareVersions('flow', 10, 1, 2))
        .rejects.toThrow('One or both versions not found');
    });
  });

  describe('computeDiff', () => {
    it('should detect added keys', () => {
      const diff = versionControl.computeDiff({ a: 1 }, { a: 1, b: 2 });

      expect(diff.added.b).toBe(2);
    });

    it('should detect removed keys', () => {
      const diff = versionControl.computeDiff({ a: 1, b: 2 }, { a: 1 });

      expect(diff.removed.b).toBe(2);
    });

    it('should detect modified keys', () => {
      const diff = versionControl.computeDiff({ a: 1 }, { a: 2 });

      expect(diff.modified.a).toEqual({ old: 1, new: 2 });
    });

    it('should handle no changes', () => {
      const diff = versionControl.computeDiff({ a: 1 }, { a: 1 });

      expect(Object.keys(diff.added)).toHaveLength(0);
      expect(Object.keys(diff.removed)).toHaveLength(0);
      expect(Object.keys(diff.modified)).toHaveLength(0);
    });
  });

  describe('createBranch', () => {
    it('should create a branch', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, branch_name: 'feature-x' }]
      });

      const result = await versionControl.createBranch('flow', 10, 'feature-x', 5, 100);

      expect(result.branch_name).toBe('feature-x');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entity_branches'),
        [1, 'flow', 10, 'feature-x', 5, 100]
      );
    });
  });

  describe('getBranches', () => {
    it('should return all branches', async () => {
      db.query.mockResolvedValue({
        rows: [
          { id: 1, branch_name: 'main' },
          { id: 2, branch_name: 'develop' }
        ]
      });

      const result = await versionControl.getBranches('flow', 10);

      expect(result).toHaveLength(2);
    });
  });

  describe('getBranch', () => {
    it('should return specific branch', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, branch_name: 'main' }]
      });

      const result = await versionControl.getBranch('flow', 10, 'main');

      expect(result.branch_name).toBe('main');
    });
  });

  describe('mergeBranch', () => {
    it('should merge source branch into target', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, branch_name: 'feature', base_version_id: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5, data: { merged: true } }] })
        .mockResolvedValueOnce({ rows: [{ max_version: 3 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, version_number: 4 }] });

      const result = await versionControl.mergeBranch('flow', 10, 'feature', 'main', 100);

      expect(result.message).toContain('Successfully merged');
      expect(result.mergedVersion).toBeDefined();
    });

    it('should throw error if source branch not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(versionControl.mergeBranch('flow', 10, 'nonexistent', 'main', 100))
        .rejects.toThrow("Source branch 'nonexistent' not found");
    });

    it('should throw error if source version not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, branch_name: 'feature', base_version_id: 5 }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(versionControl.mergeBranch('flow', 10, 'feature', 'main', 100))
        .rejects.toThrow('Source version not found');
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, branch_name: 'feature', is_main: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await versionControl.deleteBranch('flow', 10, 'feature');

      expect(result).toBeDefined();
    });

    it('should throw error if branch not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(versionControl.deleteBranch('flow', 10, 'nonexistent'))
        .rejects.toThrow("Branch 'nonexistent' not found");
    });

    it('should throw error if trying to delete main branch', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 1, branch_name: 'main', is_main: true }]
      });

      await expect(versionControl.deleteBranch('flow', 10, 'main'))
        .rejects.toThrow('Cannot delete main branch');
    });
  });

  describe('rollback', () => {
    it('should rollback to target version', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 2, data: { old: true } }] })
        .mockResolvedValueOnce({ rows: [{ max_version: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, version_number: 6 }] })
        .mockResolvedValueOnce({ rows: [{ max_version: 6 }] });

      const result = await versionControl.rollback('flow', 10, 2, 100);

      expect(result.rolledBackTo).toBe(2);
      expect(result.newVersion).toBeDefined();
    });

    it('should throw error if target version not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(versionControl.rollback('flow', 10, 999, 100))
        .rejects.toThrow('Version 999 not found');
    });
  });

  describe('getDiff', () => {
    it('should get diff between versions', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ max_version: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 3, data: { a: 1 } }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 4, data: { a: 2 } }] });

      const result = await versionControl.getDiff('flow', 10, 3, 4);

      expect(result.diff).toBeDefined();
    });

    it('should return message for same version', async () => {
      db.query.mockResolvedValue({ rows: [{ max_version: 5 }] });

      const result = await versionControl.getDiff('flow', 10, 5, 5);

      expect(result.message).toBe('Same version');
    });

    it('should use defaults when versions not specified', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ max_version: 5 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, version_number: 4, data: {} }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, version_number: 5, data: {} }] });

      await versionControl.getDiff('flow', 10);

      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('getVersionById', () => {
    it('should return version by id', async () => {
      db.query.mockResolvedValue({
        rows: [{ id: 100, version_number: 3 }]
      });

      const result = await versionControl.getVersionById(100);

      expect(result.id).toBe(100);
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [100, 1]
      );
    });
  });
});
