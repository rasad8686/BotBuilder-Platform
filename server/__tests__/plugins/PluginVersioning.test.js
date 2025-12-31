/**
 * PluginVersioning Tests
 */

const PluginVersioning = require('../../plugins/core/PluginVersioning');

// Mock database
jest.mock('../../db', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));

const db = require('../../db');

describe('PluginVersioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUpdateType', () => {
    it('should detect major updates', () => {
      expect(PluginVersioning.getUpdateType('1.0.0', '2.0.0')).toBe('major');
      expect(PluginVersioning.getUpdateType('1.5.3', '2.0.0')).toBe('major');
    });

    it('should detect minor updates', () => {
      expect(PluginVersioning.getUpdateType('1.0.0', '1.1.0')).toBe('minor');
      expect(PluginVersioning.getUpdateType('1.0.5', '1.2.0')).toBe('minor');
    });

    it('should detect patch updates', () => {
      expect(PluginVersioning.getUpdateType('1.0.0', '1.0.1')).toBe('patch');
      expect(PluginVersioning.getUpdateType('1.2.3', '1.2.4')).toBe('patch');
    });
  });

  describe('compareVersions', () => {
    it('should compare versions correctly', () => {
      expect(PluginVersioning.compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(PluginVersioning.compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(PluginVersioning.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should handle complex versions', () => {
      expect(PluginVersioning.compareVersions('1.10.0', '1.9.0')).toBe(1);
      expect(PluginVersioning.compareVersions('1.0.10', '1.0.9')).toBe(1);
    });
  });

  describe('suggestNextVersions', () => {
    it('should suggest correct next versions', () => {
      const suggestions = PluginVersioning.suggestNextVersions('1.2.3');

      expect(suggestions.patch).toBe('1.2.4');
      expect(suggestions.minor).toBe('1.3.0');
      expect(suggestions.major).toBe('2.0.0');
    });

    it('should handle edge cases', () => {
      const suggestions = PluginVersioning.suggestNextVersions('0.0.0');

      expect(suggestions.patch).toBe('0.0.1');
      expect(suggestions.minor).toBe('0.1.0');
      expect(suggestions.major).toBe('1.0.0');
    });
  });

  describe('checkForUpdates', () => {
    it('should detect available update', async () => {
      db.query.mockResolvedValue({
        rows: [{
          version: '2.0.0',
          changelog: 'New features',
          breaking_changes: false,
          published_at: new Date()
        }]
      });

      const result = await PluginVersioning.checkForUpdates(1, '1.0.0');

      expect(result.hasUpdate).toBe(true);
      expect(result.latestVersion).toBe('2.0.0');
      expect(result.updateType).toBe('major');
    });

    it('should return no update when on latest', async () => {
      db.query.mockResolvedValue({
        rows: [{
          version: '1.0.0',
          changelog: '',
          breaking_changes: false,
          published_at: new Date()
        }]
      });

      const result = await PluginVersioning.checkForUpdates(1, '1.0.0');

      expect(result.hasUpdate).toBe(false);
    });

    it('should return no update when no versions exist', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PluginVersioning.checkForUpdates(1, '1.0.0');

      expect(result.hasUpdate).toBe(false);
    });
  });

  describe('createVersion', () => {
    it('should create new version', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // Check existing
          .mockResolvedValueOnce({ rows: [{ version: '1.0.0' }] }) // Get current
          .mockResolvedValueOnce({ rows: [{ id: 1, version: '1.1.0' }] }), // Insert
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      const versionData = {
        version: '1.1.0',
        changelog: 'Bug fixes',
        manifest: {}
      };

      const result = await PluginVersioning.createVersion(1, versionData);

      expect(result.version).toBe('1.1.0');
    });

    it('should reject invalid version format', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      const versionData = {
        version: 'invalid',
        changelog: 'Test'
      };

      await expect(PluginVersioning.createVersion(1, versionData))
        .rejects.toThrow('Invalid version format');
    });

    it('should reject duplicate version', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 1 }] }), // Existing version
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      const versionData = {
        version: '1.0.0',
        changelog: 'Test'
      };

      await expect(PluginVersioning.createVersion(1, versionData))
        .rejects.toThrow('Version 1.0.0 already exists');
    });

    it('should reject lower version number', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // No existing
          .mockResolvedValueOnce({ rows: [{ version: '2.0.0' }] }), // Current is higher
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      const versionData = {
        version: '1.0.0',
        changelog: 'Test'
      };

      await expect(PluginVersioning.createVersion(1, versionData))
        .rejects.toThrow('New version must be greater than current version');
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history', async () => {
      const mockVersions = [
        { id: 2, version: '1.1.0', created_at: new Date() },
        { id: 1, version: '1.0.0', created_at: new Date() }
      ];

      db.query.mockResolvedValue({ rows: mockVersions });

      const result = await PluginVersioning.getVersionHistory(1);

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe('1.1.0');
    });

    it('should limit results', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await PluginVersioning.getVersionHistory(1, { limit: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT $2'),
        [1, 5]
      );
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible when no constraints', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await PluginVersioning.checkCompatibility('1.0.0', '2.0.0');

      expect(result.compatible).toBe(true);
    });

    it('should detect min version incompatibility', async () => {
      db.query.mockResolvedValue({
        rows: [{
          min_app_version: '3.0.0',
          max_app_version: null
        }]
      });

      const result = await PluginVersioning.checkCompatibility('1.0.0', '2.0.0');

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('3.0.0 or higher');
    });

    it('should detect max version incompatibility', async () => {
      db.query.mockResolvedValue({
        rows: [{
          min_app_version: null,
          max_app_version: '1.5.0'
        }]
      });

      const result = await PluginVersioning.checkCompatibility('1.0.0', '2.0.0');

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('1.5.0');
    });
  });
});
