/**
 * BasePlugin Tests
 * Tests for server/plugins/types/BasePlugin.js
 */

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const BasePlugin = require('../../../plugins/types/BasePlugin');
const log = require('../../../utils/logger');

describe('BasePlugin', () => {
  let plugin;

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = new BasePlugin({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      permissions: ['read', 'write'],
      settings: { key: 'value' }
    });
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(plugin.id).toBe('test-plugin');
      expect(plugin.name).toBe('Test Plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBe('A test plugin');
      expect(plugin.author).toBe('Test Author');
      expect(plugin.permissions).toEqual(['read', 'write']);
      expect(plugin.settings).toEqual({ key: 'value' });
    });

    it('should use defaults for missing config', () => {
      const defaultPlugin = new BasePlugin();

      expect(defaultPlugin.name).toBe('Unnamed Plugin');
      expect(defaultPlugin.version).toBe('1.0.0');
      expect(defaultPlugin.author).toBe('Unknown');
      expect(defaultPlugin.permissions).toEqual([]);
      expect(defaultPlugin.settings).toEqual({});
    });

    it('should start disabled and not installed', () => {
      expect(plugin.enabled).toBe(false);
      expect(plugin.installed).toBe(false);
      expect(plugin.tenantId).toBeNull();
    });
  });

  describe('install', () => {
    it('should install plugin for tenant', async () => {
      await plugin.install(123, { newSetting: 'value' });

      expect(plugin.tenantId).toBe(123);
      expect(plugin.installed).toBe(true);
      expect(plugin.enabled).toBe(true);
      expect(plugin.settings.newSetting).toBe('value');
      expect(log.info).toHaveBeenCalled();
    });

    it('should call onInstall hook', async () => {
      plugin.onInstall = jest.fn();

      await plugin.install(123);

      expect(plugin.onInstall).toHaveBeenCalledWith(123, {});
    });

    it('should handle installation errors', async () => {
      plugin.onInstall = jest.fn().mockRejectedValue(new Error('Install failed'));

      await expect(plugin.install(123)).rejects.toThrow('Install failed');
      expect(plugin.installed).toBe(false);
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('uninstall', () => {
    it('should uninstall plugin', async () => {
      plugin.installed = true;
      plugin.enabled = true;
      plugin.tenantId = 123;

      await plugin.uninstall(123);

      expect(plugin.installed).toBe(false);
      expect(plugin.enabled).toBe(false);
      expect(plugin.tenantId).toBeNull();
      expect(log.info).toHaveBeenCalled();
    });

    it('should call onUninstall hook', async () => {
      plugin.onUninstall = jest.fn();

      await plugin.uninstall(123);

      expect(plugin.onUninstall).toHaveBeenCalledWith(123);
    });

    it('should handle uninstallation errors', async () => {
      plugin.onUninstall = jest.fn().mockRejectedValue(new Error('Uninstall failed'));

      await expect(plugin.uninstall(123)).rejects.toThrow('Uninstall failed');
      expect(log.error).toHaveBeenCalled();
    });
  });

  describe('configure', () => {
    it('should update settings', async () => {
      await plugin.configure({ newKey: 'newValue' });

      expect(plugin.settings.newKey).toBe('newValue');
    });

    it('should call validateSettings', async () => {
      plugin.validateSettings = jest.fn().mockResolvedValue({ validated: true });

      await plugin.configure({ key: 'value' });

      expect(plugin.validateSettings).toHaveBeenCalledWith({ key: 'value' });
      expect(plugin.settings.validated).toBe(true);
    });

    it('should call onConfigure hook', async () => {
      plugin.onConfigure = jest.fn();

      await plugin.configure({ key: 'value' });

      expect(plugin.onConfigure).toHaveBeenCalled();
    });

    it('should return updated settings', async () => {
      const result = await plugin.configure({ newKey: 'newValue' });

      expect(result).toEqual(expect.objectContaining({ newKey: 'newValue' }));
    });
  });

  describe('getManifest', () => {
    it('should return plugin manifest', () => {
      const manifest = plugin.getManifest();

      expect(manifest).toEqual({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        permissions: ['read', 'write'],
        type: 'base',
        settings: {},
        hooks: [],
        dependencies: []
      });
    });
  });

  describe('getType', () => {
    it('should return base type', () => {
      expect(plugin.getType()).toBe('base');
    });
  });

  describe('getSettingsSchema', () => {
    it('should return empty schema by default', () => {
      expect(plugin.getSettingsSchema()).toEqual({});
    });
  });

  describe('getHooks', () => {
    it('should return empty array by default', () => {
      expect(plugin.getHooks()).toEqual([]);
    });
  });

  describe('getDependencies', () => {
    it('should return empty array by default', () => {
      expect(plugin.getDependencies()).toEqual([]);
    });
  });

  describe('validateSettings', () => {
    it('should return settings as-is by default', async () => {
      const settings = { key: 'value' };
      const result = await plugin.validateSettings(settings);

      expect(result).toBe(settings);
    });
  });

  describe('enable/disable', () => {
    it('should enable plugin', () => {
      plugin.enable();

      expect(plugin.enabled).toBe(true);
    });

    it('should disable plugin', () => {
      plugin.enabled = true;
      plugin.disable();

      expect(plugin.enabled).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true only if enabled AND installed', () => {
      expect(plugin.isEnabled()).toBe(false);

      plugin.enabled = true;
      expect(plugin.isEnabled()).toBe(false);

      plugin.installed = true;
      expect(plugin.isEnabled()).toBe(true);

      plugin.enabled = false;
      expect(plugin.isEnabled()).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    it('should have empty default implementations', async () => {
      await expect(plugin.onInstall(1, {})).resolves.toBeUndefined();
      await expect(plugin.onUninstall(1)).resolves.toBeUndefined();
      await expect(plugin.onConfigure({})).resolves.toBeUndefined();
      await expect(plugin.onEnable()).resolves.toBeUndefined();
      await expect(plugin.onDisable()).resolves.toBeUndefined();
    });
  });
});
