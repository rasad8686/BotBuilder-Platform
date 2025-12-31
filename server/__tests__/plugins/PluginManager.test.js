/**
 * PluginManager Tests
 */

const PluginManager = require('../../plugins/core/PluginManager');

// Mock dependencies
jest.mock('../../db', () => ({
  connect: jest.fn(() => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn()
  })),
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

jest.mock('../../models/Plugin', () => ({
  findById: jest.fn(),
  incrementDownloads: jest.fn()
}));

jest.mock('../../models/PluginInstallation', () => ({
  isInstalled: jest.fn(),
  install: jest.fn(),
  uninstall: jest.fn(),
  getInstallation: jest.fn(),
  getByTenant: jest.fn(),
  enable: jest.fn(),
  disable: jest.fn(),
  updateSettings: jest.fn()
}));

jest.mock('../../plugins/core/PluginRegistry', () => ({
  enablePlugin: jest.fn(),
  disablePlugin: jest.fn(),
  isEnabled: jest.fn()
}));

jest.mock('../../plugins/core/PluginLoader', () => ({
  isLoaded: jest.fn(),
  unloadPlugin: jest.fn(),
  loadPlugin: jest.fn(),
  getLoadedPlugins: jest.fn(() => [])
}));

jest.mock('../../plugins/core/PluginSandbox', () => ({
  validatePermissions: jest.fn(() => ({ valid: true, missing: [], denied: [] })),
  executeInSandbox: jest.fn(),
  getStats: jest.fn()
}));

jest.mock('../../plugins/core/PluginHooks', () => ({
  on: jest.fn(),
  emit: jest.fn()
}));

const Plugin = require('../../models/Plugin');
const PluginInstallation = require('../../models/PluginInstallation');
const db = require('../../db');

describe('PluginManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('installPlugin', () => {
    it('should install a published plugin', async () => {
      const mockPlugin = {
        id: 1,
        name: 'Test Plugin',
        version: '1.0.0',
        status: 'published',
        permissions: ['read:data']
      };

      const mockInstallation = {
        id: 1,
        plugin_id: 1,
        tenant_id: 100,
        version: '1.0.0'
      };

      Plugin.findById.mockResolvedValue(mockPlugin);
      PluginInstallation.isInstalled.mockResolvedValue(false);
      PluginInstallation.install.mockResolvedValue(mockInstallation);
      Plugin.incrementDownloads.mockResolvedValue(1);

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      const result = await PluginManager.installPlugin(1, 100);

      expect(result.success).toBe(true);
      expect(result.installation).toEqual(mockInstallation);
      expect(Plugin.incrementDownloads).toHaveBeenCalledWith(1);
    });

    it('should throw error if plugin not found', async () => {
      Plugin.findById.mockResolvedValue(null);

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      await expect(PluginManager.installPlugin(999, 100))
        .rejects.toThrow('Plugin not found');
    });

    it('should throw error if plugin not published', async () => {
      Plugin.findById.mockResolvedValue({
        id: 1,
        status: 'pending'
      });

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      await expect(PluginManager.installPlugin(1, 100))
        .rejects.toThrow('Plugin is not available for installation');
    });

    it('should throw error if already installed', async () => {
      Plugin.findById.mockResolvedValue({
        id: 1,
        status: 'published'
      });
      PluginInstallation.isInstalled.mockResolvedValue(true);

      const mockClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      db.connect.mockResolvedValue(mockClient);

      await expect(PluginManager.installPlugin(1, 100))
        .rejects.toThrow('Plugin is already installed');
    });
  });

  describe('uninstallPlugin', () => {
    it('should uninstall an installed plugin', async () => {
      const mockInstallation = {
        plugin_id: 1,
        tenant_id: 100
      };

      PluginInstallation.getInstallation.mockResolvedValue(mockInstallation);
      Plugin.findById.mockResolvedValue({ id: 1, name: 'Test' });
      PluginInstallation.uninstall.mockResolvedValue(true);

      const result = await PluginManager.uninstallPlugin(1, 100);

      expect(result.success).toBe(true);
      expect(PluginInstallation.uninstall).toHaveBeenCalledWith(1, 100);
    });

    it('should throw error if not installed', async () => {
      PluginInstallation.getInstallation.mockResolvedValue(null);

      await expect(PluginManager.uninstallPlugin(1, 100))
        .rejects.toThrow('Plugin is not installed');
    });
  });

  describe('enablePlugin', () => {
    it('should enable a disabled plugin', async () => {
      PluginInstallation.getInstallation.mockResolvedValue({
        plugin_id: 1,
        tenant_id: 100,
        is_active: false
      });

      const result = await PluginManager.enablePlugin(1, 100);

      expect(result.success).toBe(true);
      expect(PluginInstallation.enable).toHaveBeenCalledWith(1, 100);
    });

    it('should throw error if not installed', async () => {
      PluginInstallation.getInstallation.mockResolvedValue(null);

      await expect(PluginManager.enablePlugin(1, 100))
        .rejects.toThrow('Plugin is not installed');
    });
  });

  describe('disablePlugin', () => {
    it('should disable an enabled plugin', async () => {
      PluginInstallation.getInstallation.mockResolvedValue({
        plugin_id: 1,
        tenant_id: 100,
        is_active: true
      });

      const result = await PluginManager.disablePlugin(1, 100);

      expect(result.success).toBe(true);
      expect(PluginInstallation.disable).toHaveBeenCalledWith(1, 100);
    });
  });

  describe('updatePluginSettings', () => {
    it('should update plugin settings', async () => {
      const mockInstallation = {
        plugin_id: 1,
        tenant_id: 100,
        settings: {}
      };

      const newSettings = { apiKey: 'test-key' };

      PluginInstallation.getInstallation.mockResolvedValue(mockInstallation);
      Plugin.findById.mockResolvedValue({
        id: 1,
        manifest: { config: {} }
      });
      PluginInstallation.updateSettings.mockResolvedValue({
        ...mockInstallation,
        settings: newSettings
      });

      const result = await PluginManager.updatePluginSettings(1, 100, newSettings);

      expect(result.settings).toEqual(newSettings);
    });
  });

  describe('validateSettings', () => {
    it('should validate required settings', () => {
      const schema = {
        apiKey: { type: 'string', required: true }
      };
      const settings = {};

      expect(() => PluginManager.validateSettings(settings, schema))
        .toThrow('Required setting missing: apiKey');
    });

    it('should validate string type', () => {
      const schema = {
        apiKey: { type: 'string' }
      };
      const settings = { apiKey: 123 };

      expect(() => PluginManager.validateSettings(settings, schema))
        .toThrow('Setting apiKey must be a string');
    });

    it('should validate number type', () => {
      const schema = {
        maxRetries: { type: 'number' }
      };
      const settings = { maxRetries: 'three' };

      expect(() => PluginManager.validateSettings(settings, schema))
        .toThrow('Setting maxRetries must be a number');
    });

    it('should validate enum values', () => {
      const schema = {
        mode: { type: 'string', enum: ['fast', 'slow'] }
      };
      const settings = { mode: 'medium' };

      expect(() => PluginManager.validateSettings(settings, schema))
        .toThrow('Setting mode must be one of: fast, slow');
    });

    it('should validate min/max for numbers', () => {
      const schema = {
        count: { type: 'number', min: 1, max: 10 }
      };

      expect(() => PluginManager.validateSettings({ count: 0 }, schema))
        .toThrow('Setting count must be at least 1');

      expect(() => PluginManager.validateSettings({ count: 15 }, schema))
        .toThrow('Setting count must be at most 10');
    });

    it('should pass valid settings', () => {
      const schema = {
        apiKey: { type: 'string', required: true },
        maxRetries: { type: 'number', min: 1, max: 10 }
      };
      const settings = {
        apiKey: 'test-key',
        maxRetries: 5
      };

      expect(() => PluginManager.validateSettings(settings, schema)).not.toThrow();
    });
  });

  describe('getInstalledPlugins', () => {
    it('should return installed plugins for tenant', async () => {
      const mockPlugins = [
        { plugin_id: 1, name: 'Plugin 1' },
        { plugin_id: 2, name: 'Plugin 2' }
      ];

      PluginInstallation.getByTenant.mockResolvedValue(mockPlugins);

      const result = await PluginManager.getInstalledPlugins(100);

      expect(result).toEqual(mockPlugins);
      expect(PluginInstallation.getByTenant).toHaveBeenCalledWith(100);
    });
  });
});
