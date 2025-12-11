/**
 * PluginHooks Tests
 * Tests for server/plugins/core/PluginHooks.js
 */

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const pluginHooks = require('../../../plugins/core/PluginHooks');

describe('PluginHooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pluginHooks.clear();
  });

  describe('constructor/initialization', () => {
    it('should have hooks map', () => {
      expect(pluginHooks.hooks).toBeInstanceOf(Map);
    });

    it('should have hookHistory array', () => {
      expect(pluginHooks.hookHistory).toEqual([]);
    });

    it('should have maxHistorySize', () => {
      expect(pluginHooks.maxHistorySize).toBe(1000);
    });

    it('should have availableHooks defined', () => {
      expect(pluginHooks.availableHooks).toBeDefined();
      expect(pluginHooks.availableHooks.onMessage).toBeDefined();
      expect(pluginHooks.availableHooks.onAgentStart).toBeDefined();
    });
  });

  describe('register', () => {
    it('should throw error for unknown hook', () => {
      expect(() => {
        pluginHooks.register('unknownHook', 'plugin1', jest.fn());
      }).toThrow('Unknown hook: unknownHook');
    });

    it('should throw error if handler is not a function', () => {
      expect(() => {
        pluginHooks.register('onMessage', 'plugin1', 'not a function');
      }).toThrow('Handler must be a function');
    });

    it('should register handler', () => {
      const handler = jest.fn();
      pluginHooks.register('onMessage', 'plugin1', handler);

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers).toHaveLength(1);
      expect(handlers[0].pluginId).toBe('plugin1');
    });

    it('should set default priority', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].priority).toBe(10);
    });

    it('should accept custom priority', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn(), { priority: 5 });

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].priority).toBe(5);
    });

    it('should sort handlers by priority', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn(), { priority: 20 });
      pluginHooks.register('onMessage', 'plugin2', jest.fn(), { priority: 5 });
      pluginHooks.register('onMessage', 'plugin3', jest.fn(), { priority: 10 });

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].pluginId).toBe('plugin2');
      expect(handlers[1].pluginId).toBe('plugin3');
      expect(handlers[2].pluginId).toBe('plugin1');
    });

    it('should set once option', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn(), { once: true });

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].once).toBe(true);
    });

    it('should enable handler by default', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].enabled).toBe(true);
    });
  });

  describe('unregister', () => {
    beforeEach(() => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      pluginHooks.register('onMessage', 'plugin2', jest.fn());
      pluginHooks.register('onAgentStart', 'plugin1', jest.fn());
    });

    it('should unregister from specific hook', () => {
      pluginHooks.unregister('plugin1', 'onMessage');

      const messageHandlers = pluginHooks.getHandlers('onMessage');
      const agentHandlers = pluginHooks.getHandlers('onAgentStart');

      expect(messageHandlers).toHaveLength(1);
      expect(messageHandlers[0].pluginId).toBe('plugin2');
      expect(agentHandlers).toHaveLength(1);
    });

    it('should unregister from all hooks', () => {
      pluginHooks.unregister('plugin1');

      const messageHandlers = pluginHooks.getHandlers('onMessage');
      const agentHandlers = pluginHooks.getHandlers('onAgentStart');

      expect(messageHandlers).toHaveLength(1);
      expect(agentHandlers).toHaveLength(0);
    });
  });

  describe('execute', () => {
    it('should return context for unknown hook', async () => {
      const result = await pluginHooks.execute('unknownHook', { data: 'test' });

      expect(result).toEqual({ data: 'test' });
    });

    it('should execute handlers in order', async () => {
      const order = [];
      pluginHooks.register('onMessage', 'p1', () => { order.push(1); }, { priority: 1 });
      pluginHooks.register('onMessage', 'p2', () => { order.push(2); }, { priority: 2 });

      await pluginHooks.execute('onMessage', {});

      expect(order).toEqual([1, 2]);
    });

    it('should pass context to handlers', async () => {
      const handler = jest.fn().mockResolvedValue({});
      pluginHooks.register('onMessage', 'plugin1', handler);

      await pluginHooks.execute('onMessage', { message: 'test' });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ message: 'test' }));
    });

    it('should merge handler results', async () => {
      pluginHooks.register('onMessage', 'p1', () => ({ extra1: 'value1' }));
      pluginHooks.register('onMessage', 'p2', () => ({ extra2: 'value2' }));

      const result = await pluginHooks.execute('onMessage', { original: 'data' });

      expect(result.original).toBe('data');
      expect(result.extra1).toBe('value1');
      expect(result.extra2).toBe('value2');
    });

    it('should skip disabled handlers', async () => {
      const handler = jest.fn();
      pluginHooks.register('onMessage', 'plugin1', handler);
      pluginHooks.setHandlerEnabled('onMessage', 'plugin1', false);

      await pluginHooks.execute('onMessage', {});

      expect(handler).not.toHaveBeenCalled();
    });

    it('should disable handler after once execution', async () => {
      const handler = jest.fn();
      pluginHooks.register('onMessage', 'plugin1', handler, { once: true });

      await pluginHooks.execute('onMessage', {});
      await pluginHooks.execute('onMessage', {});

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle handler errors gracefully', async () => {
      pluginHooks.register('onMessage', 'p1', () => { throw new Error('Test error'); });
      pluginHooks.register('onMessage', 'p2', () => ({ success: true }));

      const result = await pluginHooks.execute('onMessage', {});

      expect(result.success).toBe(true);
    });

    it('should record execution in history', async () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());

      await pluginHooks.execute('onMessage', {});

      const history = pluginHooks.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].hookName).toBe('onMessage');
    });
  });

  describe('executeWithCancel', () => {
    it('should return shouldProceed true by default', async () => {
      const result = await pluginHooks.executeWithCancel('onMessage', {});

      expect(result.shouldProceed).toBe(true);
    });

    it('should return shouldProceed false when cancelled', async () => {
      pluginHooks.register('onMessage', 'plugin1', () => ({ cancelled: true }));

      const result = await pluginHooks.executeWithCancel('onMessage', {});

      expect(result.shouldProceed).toBe(false);
    });
  });

  describe('recordHookExecution', () => {
    it('should record execution', () => {
      pluginHooks.recordHookExecution('onMessage', [{ pluginId: 'p1' }], []);

      const history = pluginHooks.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
    });

    it('should mark as unsuccessful when errors exist', () => {
      pluginHooks.recordHookExecution('onMessage', [], [{ error: 'test' }]);

      const history = pluginHooks.getHistory();
      expect(history[0].success).toBe(false);
    });

    it('should trim history when exceeds max size', () => {
      const originalMax = pluginHooks.maxHistorySize;
      pluginHooks.maxHistorySize = 3;

      for (let i = 0; i < 5; i++) {
        pluginHooks.recordHookExecution('onMessage', [], []);
      }

      expect(pluginHooks.hookHistory).toHaveLength(3);
      pluginHooks.maxHistorySize = originalMax;
    });
  });

  describe('getHandlers', () => {
    it('should return empty array for unregistered hook', () => {
      expect(pluginHooks.getHandlers('onBotCreate')).toEqual([]);
    });

    it('should return registered handlers', () => {
      pluginHooks.register('onMessage', 'p1', jest.fn());

      expect(pluginHooks.getHandlers('onMessage')).toHaveLength(1);
    });
  });

  describe('getAvailableHooks', () => {
    it('should return all available hooks', () => {
      const hooks = pluginHooks.getAvailableHooks();

      expect(hooks.onMessage).toBeDefined();
      expect(hooks.onAgentStart).toBeDefined();
      expect(hooks.onFlowStart).toBeDefined();
    });
  });

  describe('getPluginHooks', () => {
    it('should return empty array if plugin has no hooks', () => {
      expect(pluginHooks.getPluginHooks('nonexistent')).toEqual([]);
    });

    it('should return hooks for plugin', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      pluginHooks.register('onAgentStart', 'plugin1', jest.fn());
      pluginHooks.register('onMessage', 'plugin2', jest.fn());

      const hooks = pluginHooks.getPluginHooks('plugin1');

      expect(hooks).toHaveLength(2);
      expect(hooks.find(h => h.hookName === 'onMessage')).toBeDefined();
      expect(hooks.find(h => h.hookName === 'onAgentStart')).toBeDefined();
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      pluginHooks.recordHookExecution('onMessage', [{ pluginId: 'p1' }], []);
      pluginHooks.recordHookExecution('onAgentStart', [{ pluginId: 'p2' }], []);
      pluginHooks.recordHookExecution('onMessage', [{ pluginId: 'p1' }], []);
    });

    it('should return all history', () => {
      expect(pluginHooks.getHistory()).toHaveLength(3);
    });

    it('should filter by hookName', () => {
      const history = pluginHooks.getHistory({ hookName: 'onMessage' });
      expect(history).toHaveLength(2);
    });

    it('should filter by pluginId', () => {
      const history = pluginHooks.getHistory({ pluginId: 'p1' });
      expect(history).toHaveLength(2);
    });

    it('should limit results', () => {
      const history = pluginHooks.getHistory({ limit: 2 });
      expect(history).toHaveLength(2);
    });
  });

  describe('hasHandlers', () => {
    it('should return falsy for hook without handlers', () => {
      expect(pluginHooks.hasHandlers('onBotCreate')).toBeFalsy();
    });

    it('should return true when has enabled handlers', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      expect(pluginHooks.hasHandlers('onMessage')).toBe(true);
    });

    it('should return false when all handlers disabled', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      pluginHooks.setHandlerEnabled('onMessage', 'plugin1', false);

      expect(pluginHooks.hasHandlers('onMessage')).toBe(false);
    });
  });

  describe('setHandlerEnabled', () => {
    it('should enable handler', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      pluginHooks.setHandlerEnabled('onMessage', 'plugin1', false);
      pluginHooks.setHandlerEnabled('onMessage', 'plugin1', true);

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].enabled).toBe(true);
    });

    it('should disable handler', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      pluginHooks.setHandlerEnabled('onMessage', 'plugin1', false);

      const handlers = pluginHooks.getHandlers('onMessage');
      expect(handlers[0].enabled).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all hooks and history', () => {
      pluginHooks.register('onMessage', 'plugin1', jest.fn());
      pluginHooks.recordHookExecution('onMessage', [], []);

      pluginHooks.clear();

      expect(pluginHooks.hooks.size).toBe(0);
      expect(pluginHooks.hookHistory).toHaveLength(0);
    });
  });

  describe('HOOKS export', () => {
    it('should export hook names', () => {
      const { HOOKS } = require('../../../plugins/core/PluginHooks');

      expect(HOOKS).toContain('onMessage');
      expect(HOOKS).toContain('onAgentStart');
      expect(HOOKS).toContain('beforeInstall');
    });
  });
});
