/**
 * PluginInstallation Model Tests
 * Tests for server/models/PluginInstallation.js
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

const db = require('../../db');
const PluginInstallation = require('../../models/PluginInstallation');

describe('PluginInstallation Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('install()', () => {
    it('should install plugin for tenant', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, plugin_id: 1, tenant_id: 1 }] });

      const result = await PluginInstallation.install(1, 1, '1.0.0', { config: 'value' });

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plugin_installations'),
        [1, 1, '1.0.0', '{"config":"value"}']
      );
    });

    it('should use empty settings by default', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await PluginInstallation.install(1, 1, '1.0.0');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, 1, '1.0.0', '{}']
      );
    });

    it('should handle upsert on conflict', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      await PluginInstallation.install(1, 1, '1.0.0');

      expect(db.query.mock.calls[0][0]).toContain('ON CONFLICT');
    });
  });

  describe('uninstall()', () => {
    it('should uninstall plugin', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await PluginInstallation.uninstall(1, 1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM plugin_installations'),
        [1, 1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PluginInstallation.uninstall(999, 999);

      expect(result).toBeNull();
    });
  });

  describe('getByTenant()', () => {
    it('should return all installations for tenant', async () => {
      const mockInstallations = [
        { id: 1, plugin_name: 'Plugin 1', settings: '{}' },
        { id: 2, plugin_name: 'Plugin 2', settings: '{"key":"value"}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockInstallations });

      const result = await PluginInstallation.getByTenant(1);

      expect(result).toHaveLength(2);
      expect(result[1].settings).toEqual({ key: 'value' });
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await PluginInstallation.getByTenant(1, { status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $2'),
        [1, 'active']
      );
    });

    it('should parse settings string', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"parsed":true}' }] });

      const result = await PluginInstallation.getByTenant(1);

      expect(result[0].settings).toEqual({ parsed: true });
    });
  });

  describe('getByPlugin()', () => {
    it('should return all installations for plugin', async () => {
      const mockInstallations = [
        { id: 1, tenant_id: 1, settings: '{}' },
        { id: 2, tenant_id: 2, settings: '{}' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockInstallations });

      const result = await PluginInstallation.getByPlugin(1);

      expect(result).toHaveLength(2);
    });
  });

  describe('updateSettings()', () => {
    it('should update settings', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"new":"settings"}' }] });

      const result = await PluginInstallation.updateSettings(1, 1, { new: 'settings' });

      expect(result.settings).toEqual({ new: 'settings' });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('settings = $3'),
        [1, 1, '{"new":"settings"}']
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PluginInstallation.updateSettings(999, 999, {});

      expect(result).toBeNull();
    });
  });

  describe('updateStatus()', () => {
    it('should update status to active', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'active' }] });

      const result = await PluginInstallation.updateStatus(1, 1, 'active');

      expect(result.status).toBe('active');
    });

    it('should update status to disabled', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'disabled' }] });

      const result = await PluginInstallation.updateStatus(1, 1, 'disabled');

      expect(result.status).toBe('disabled');
    });

    it('should throw error for invalid status', async () => {
      await expect(PluginInstallation.updateStatus(1, 1, 'invalid'))
        .rejects.toThrow('Invalid status: invalid');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PluginInstallation.updateStatus(1, 1, 'active');

      expect(result).toBeNull();
    });
  });

  describe('isInstalled()', () => {
    it('should return true if installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ installed: true }] });

      const result = await PluginInstallation.isInstalled(1, 1);

      expect(result).toBe(true);
    });

    it('should return false if not installed', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ installed: false }] });

      const result = await PluginInstallation.isInstalled(999, 999);

      expect(result).toBe(false);
    });
  });

  describe('getInstallation()', () => {
    it('should return installation details', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, plugin_name: 'Test', settings: '{}' }] });

      const result = await PluginInstallation.getInstallation(1, 1);

      expect(result.plugin_name).toBe('Test');
    });

    it('should parse settings', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, settings: '{"key":"value"}' }] });

      const result = await PluginInstallation.getInstallation(1, 1);

      expect(result.settings).toEqual({ key: 'value' });
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PluginInstallation.getInstallation(999, 999);

      expect(result).toBeNull();
    });
  });

  describe('getInstallCount()', () => {
    it('should return installation count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] });

      const result = await PluginInstallation.getInstallCount(1);

      expect(result).toBe(10);
    });
  });

  describe('getActiveCount()', () => {
    it('should return active installation count', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await PluginInstallation.getActiveCount(1);

      expect(result).toBe(5);
    });
  });

  describe('updateVersion()', () => {
    it('should update installed version', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, installed_version: '2.0.0' }] });

      const result = await PluginInstallation.updateVersion(1, 1, '2.0.0');

      expect(result.installed_version).toBe('2.0.0');
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PluginInstallation.updateVersion(999, 999, '2.0.0');

      expect(result).toBeNull();
    });
  });

  describe('getNeedingUpdate()', () => {
    it('should return installations needing update', async () => {
      const mockInstallations = [
        { id: 1, installed_version: '1.0.0', latest_version: '2.0.0' }
      ];
      db.query.mockResolvedValueOnce({ rows: mockInstallations });

      const result = await PluginInstallation.getNeedingUpdate(1);

      expect(result).toHaveLength(1);
      expect(result[0].installed_version).not.toBe(result[0].latest_version);
    });
  });
});
