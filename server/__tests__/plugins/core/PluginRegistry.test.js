/**
 * PluginRegistry Tests
 * Tests for server/plugins/core/PluginRegistry.js
 */

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const pluginRegistry = require('../../../plugins/core/PluginRegistry');
const log = require('../../../utils/logger');

describe('PluginRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pluginRegistry.clear();
  });

  describe('registerPlugin', () => {
    it('should register a plugin', () => {
      const plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        permissions: ['read', 'write']
      };

      const result = pluginRegistry.registerPlugin(plugin);

      expect(result).toBe(true);
      expect(pluginRegistry.getPlugin('test-plugin')).toBeDefined();
      expect(log.info).toHaveBeenCalled();
    });

    it('should throw if plugin has no id', () => {
      expect(() => {
        pluginRegistry.registerPlugin({ name: 'No ID' });
      }).toThrow('Plugin must have id and name');
    });

    it('should throw if plugin has no name', () => {
      expect(() => {
        pluginRegistry.registerPlugin({ id: 'no-name' });
      }).toThrow('Plugin must have id and name');
    });

    it('should throw if plugin already registered', () => {
      pluginRegistry.registerPlugin({ id: 'dup', name: 'First' });

      expect(() => {
        pluginRegistry.registerPlugin({ id: 'dup', name: 'Second' });
      }).toThrow('Plugin dup is already registered');
    });

    it('should register plugin hooks', () => {
      const handler = jest.fn();
      pluginRegistry.registerPlugin({
        id: 'hook-plugin',
        name: 'Hook Plugin',
        hooks: {
          'beforeProcess': handler
        }
      });

      expect(pluginRegistry.hooks.has('beforeProcess')).toBe(true);
    });

    it('should use default values for optional fields', () => {
      pluginRegistry.registerPlugin({ id: 'minimal', name: 'Minimal' });

      const plugin = pluginRegistry.getPlugin('minimal');

      expect(plugin.version).toBe('1.0.0');
      expect(plugin.author).toBe('Unknown');
      expect(plugin.permissions).toEqual([]);
      expect(plugin.enabled).toBe(true);
    });
  });

  describe('unregisterPlugin', () => {
    it('should unregister a plugin', () => {
      pluginRegistry.registerPlugin({ id: 'to-remove', name: 'Remove Me' });

      const result = pluginRegistry.unregisterPlugin('to-remove');

      expect(result).toBe(true);
      expect(pluginRegistry.getPlugin('to-remove')).toBeNull();
    });

    it('should return false for non-existent plugin', () => {
      expect(pluginRegistry.unregisterPlugin('non-existent')).toBe(false);
    });

    it('should remove plugin hooks', () => {
      const handler = jest.fn();
      pluginRegistry.registerPlugin({
        id: 'hook-plugin',
        name: 'Hook Plugin',
        hooks: { 'onProcess': handler }
      });

      pluginRegistry.unregisterPlugin('hook-plugin');

      expect(pluginRegistry.hooks.has('onProcess')).toBe(false);
    });
  });

  describe('getPlugin', () => {
    it('should return plugin by id', () => {
      pluginRegistry.registerPlugin({ id: 'test', name: 'Test' });

      const plugin = pluginRegistry.getPlugin('test');

      expect(plugin).toBeDefined();
      expect(plugin.id).toBe('test');
    });

    it('should return null for non-existent plugin', () => {
      expect(pluginRegistry.getPlugin('non-existent')).toBeNull();
    });
  });

  describe('getAllPlugins', () => {
    it('should return all plugins', () => {
      pluginRegistry.registerPlugin({ id: 'p1', name: 'Plugin 1' });
      pluginRegistry.registerPlugin({ id: 'p2', name: 'Plugin 2' });

      const all = pluginRegistry.getAllPlugins();

      expect(all).toHaveLength(2);
    });

    it('should return empty array when no plugins', () => {
      expect(pluginRegistry.getAllPlugins()).toEqual([]);
    });
  });

  describe('searchPlugins', () => {
    beforeEach(() => {
      pluginRegistry.registerPlugin({ id: 'ai-chat', name: 'AI Chat', description: 'Chat with AI' });
      pluginRegistry.registerPlugin({ id: 'email-tool', name: 'Email Tool', description: 'Send emails' });
    });

    it('should search by name', () => {
      const results = pluginRegistry.searchPlugins('chat');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ai-chat');
    });

    it('should search by description', () => {
      const results = pluginRegistry.searchPlugins('emails');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('email-tool');
    });

    it('should search by id', () => {
      const results = pluginRegistry.searchPlugins('ai-');

      expect(results).toHaveLength(1);
    });

    it('should be case-insensitive', () => {
      const results = pluginRegistry.searchPlugins('EMAIL');

      expect(results).toHaveLength(1);
    });
  });

  describe('registerHook', () => {
    it('should register a hook handler', () => {
      const handler = jest.fn();

      pluginRegistry.registerHook('test-plugin', 'onProcess', handler);

      expect(pluginRegistry.hooks.has('onProcess')).toBe(true);
    });

    it('should sort handlers by priority', () => {
      const lowPriorityHandler = jest.fn();
      lowPriorityHandler.priority = 20;

      const highPriorityHandler = jest.fn();
      highPriorityHandler.priority = 5;

      pluginRegistry.registerHook('p1', 'hook', lowPriorityHandler);
      pluginRegistry.registerHook('p2', 'hook', highPriorityHandler);

      const handlers = pluginRegistry.hooks.get('hook');
      expect(handlers[0].priority).toBeLessThan(handlers[1].priority);
    });
  });

  describe('executeHook', () => {
    it('should execute hook handlers', async () => {
      const handler = jest.fn().mockReturnValue({ modified: true });
      pluginRegistry.registerPlugin({
        id: 'hook-plugin',
        name: 'Hook Plugin',
        hooks: { 'onProcess': handler }
      });

      const result = await pluginRegistry.executeHook('onProcess', { data: 'test' });

      expect(handler).toHaveBeenCalled();
      expect(result.modified).toBe(true);
    });

    it('should pass context through handlers', async () => {
      const handler1 = jest.fn().mockReturnValue({ step: 1 });
      const handler2 = jest.fn().mockImplementation((ctx) => ({ ...ctx, step: 2 }));

      pluginRegistry.registerPlugin({
        id: 'p1',
        name: 'Plugin 1',
        hooks: { 'chain': handler1 }
      });
      pluginRegistry.registerPlugin({
        id: 'p2',
        name: 'Plugin 2',
        hooks: { 'chain': handler2 }
      });

      const result = await pluginRegistry.executeHook('chain', {});

      expect(result.step).toBe(2);
    });

    it('should handle hook errors gracefully', async () => {
      const badHandler = jest.fn().mockRejectedValue(new Error('Hook failed'));
      pluginRegistry.registerPlugin({
        id: 'bad-plugin',
        name: 'Bad Plugin',
        hooks: { 'error-hook': badHandler }
      });

      const result = await pluginRegistry.executeHook('error-hook', { data: 'test' });

      expect(log.error).toHaveBeenCalled();
      expect(result).toEqual({ data: 'test' }); // Original context returned
    });

    it('should skip disabled plugins', async () => {
      const handler = jest.fn();
      pluginRegistry.registerPlugin({
        id: 'disabled-plugin',
        name: 'Disabled Plugin',
        hooks: { 'skip-hook': handler }
      });
      pluginRegistry.disablePlugin('disabled-plugin');

      await pluginRegistry.executeHook('skip-hook', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should return context for non-existent hook', async () => {
      const result = await pluginRegistry.executeHook('non-existent', { data: 'test' });

      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('enablePlugin/disablePlugin', () => {
    beforeEach(() => {
      pluginRegistry.registerPlugin({ id: 'toggle', name: 'Toggle Plugin' });
    });

    it('should enable plugin', () => {
      pluginRegistry.disablePlugin('toggle');
      pluginRegistry.enablePlugin('toggle');

      expect(pluginRegistry.isEnabled('toggle')).toBe(true);
    });

    it('should disable plugin', () => {
      pluginRegistry.disablePlugin('toggle');

      expect(pluginRegistry.isEnabled('toggle')).toBe(false);
    });

    it('should handle non-existent plugin', () => {
      expect(() => {
        pluginRegistry.enablePlugin('non-existent');
        pluginRegistry.disablePlugin('non-existent');
      }).not.toThrow();
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled plugin', () => {
      pluginRegistry.registerPlugin({ id: 'enabled', name: 'Enabled' });

      expect(pluginRegistry.isEnabled('enabled')).toBe(true);
    });

    it('should return false for disabled plugin', () => {
      pluginRegistry.registerPlugin({ id: 'disabled', name: 'Disabled' });
      pluginRegistry.disablePlugin('disabled');

      expect(pluginRegistry.isEnabled('disabled')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      expect(pluginRegistry.isEnabled('non-existent')).toBe(false);
    });
  });

  describe('getPluginsByPermission', () => {
    beforeEach(() => {
      pluginRegistry.registerPlugin({ id: 'p1', name: 'Plugin 1', permissions: ['read', 'write'] });
      pluginRegistry.registerPlugin({ id: 'p2', name: 'Plugin 2', permissions: ['read'] });
      pluginRegistry.registerPlugin({ id: 'p3', name: 'Plugin 3', permissions: ['admin'] });
    });

    it('should return plugins with specific permission', () => {
      const readPlugins = pluginRegistry.getPluginsByPermission('read');

      expect(readPlugins).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      const noPlugins = pluginRegistry.getPluginsByPermission('superadmin');

      expect(noPlugins).toEqual([]);
    });
  });

  describe('getPluginCount', () => {
    it('should return plugin count', () => {
      pluginRegistry.registerPlugin({ id: 'p1', name: 'Plugin 1' });
      pluginRegistry.registerPlugin({ id: 'p2', name: 'Plugin 2' });

      expect(pluginRegistry.getPluginCount()).toBe(2);
    });

    it('should return 0 when no plugins', () => {
      expect(pluginRegistry.getPluginCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all plugins and hooks', () => {
      pluginRegistry.registerPlugin({
        id: 'p1',
        name: 'Plugin 1',
        hooks: { 'hook1': jest.fn() }
      });

      pluginRegistry.clear();

      expect(pluginRegistry.getPluginCount()).toBe(0);
      expect(pluginRegistry.hooks.size).toBe(0);
    });
  });
});
