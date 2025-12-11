/**
 * PluginSandbox Tests
 * Tests for server/plugins/core/PluginSandbox.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('PluginSandbox', () => {
  let sandbox;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    sandbox = require('../../../plugins/core/PluginSandbox');
    // Reset stats
    sandbox.executionStats.clear();
  });

  describe('constructor defaults', () => {
    it('should have default timeout', () => {
      expect(sandbox.defaultTimeout).toBe(5000);
    });

    it('should have default maxMemoryMB', () => {
      expect(sandbox.maxMemoryMB).toBe(128);
    });

    it('should have allowed modules', () => {
      expect(sandbox.allowedModules).toContain('crypto');
      expect(sandbox.allowedModules).toContain('url');
    });

    it('should have blocked modules for security', () => {
      expect(sandbox.blockedModules).toContain('fs');
      expect(sandbox.blockedModules).toContain('child_process');
      expect(sandbox.blockedModules).toContain('vm');
    });

    it('should have blocked globals for security', () => {
      expect(sandbox.blockedGlobals).toContain('process');
      expect(sandbox.blockedGlobals).toContain('eval');
      expect(sandbox.blockedGlobals).toContain('Function');
    });

    it('should have permission levels', () => {
      expect(sandbox.permissionLevels['read:data']).toBe(1);
      expect(sandbox.permissionLevels['admin:settings']).toBe(5);
    });
  });

  describe('validateCode', () => {
    it('should allow safe code', () => {
      const result = sandbox.validateCode('const x = 1 + 2;');
      expect(result.valid).toBe(true);
    });

    it('should block process manipulation', () => {
      const result = sandbox.validateCode('process.exit(1)');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Process manipulation');
    });

    it('should block child_process require', () => {
      const result = sandbox.validateCode('require("child_process")');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('child_process');
    });

    it('should block fs require', () => {
      const result = sandbox.validateCode('require("fs")');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('fs module');
    });

    it('should block vm require', () => {
      const result = sandbox.validateCode('require("vm")');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('vm module');
    });

    it('should block eval', () => {
      const result = sandbox.validateCode('eval("code")');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('eval()');
    });

    it('should block new Function', () => {
      const result = sandbox.validateCode('new Function("code")');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('new Function()');
    });

    it('should block __proto__ access', () => {
      const result = sandbox.validateCode('obj.__proto__');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('__proto__');
    });

    it('should block globalThis access', () => {
      const result = sandbox.validateCode('globalThis.something');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('globalThis');
    });

    it('should block code exceeding size limit', () => {
      const largeCode = 'x'.repeat(1000001);
      const result = sandbox.validateCode(largeCode);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('maximum size');
    });

    it('should block prototype manipulation', () => {
      const result = sandbox.validateCode('Object.prototype.constructor');
      expect(result.valid).toBe(false);
    });

    it('should block Object.setPrototypeOf', () => {
      const result = sandbox.validateCode('Object.setPrototypeOf({}, null)');
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePermissions', () => {
    it('should pass when all permissions granted', () => {
      const result = sandbox.validatePermissions(
        ['read:data', 'write:data'],
        ['read:data', 'write:data', 'network:outbound']
      );
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should fail when permissions missing', () => {
      const result = sandbox.validatePermissions(
        ['read:data', 'write:data'],
        ['read:data']
      );
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('write:data');
    });

    it('should identify denied high-level permissions', () => {
      const result = sandbox.validatePermissions(
        ['admin:settings'],
        []
      );
      expect(result.valid).toBe(false);
      expect(result.denied).toContain('admin:settings');
    });

    it('should provide descriptive message', () => {
      const result = sandbox.validatePermissions(['read:data'], ['read:data']);
      expect(result.message).toBe('All permissions granted');
    });

    it('should list missing permissions in message', () => {
      const result = sandbox.validatePermissions(['read:data'], []);
      expect(result.message).toContain('read:data');
    });
  });

  describe('hasPermission', () => {
    it('should return true for granted permission', () => {
      expect(sandbox.hasPermission(['read:data'], 'read:data')).toBe(true);
    });

    it('should return false for missing permission', () => {
      expect(sandbox.hasPermission(['read:data'], 'write:data')).toBe(false);
    });

    it('should return true for wildcard permission', () => {
      expect(sandbox.hasPermission(['*'], 'any:permission')).toBe(true);
    });
  });

  describe('createSafeConsole', () => {
    it('should create console with prefixed methods', () => {
      const logger = require('../../../utils/logger');
      const safeConsole = sandbox.createSafeConsole('test-plugin');

      safeConsole.log('test message');
      expect(logger.info).toHaveBeenCalledWith('[Plugin:test-plugin]', 'test message');
    });

    it('should have all console methods', () => {
      const safeConsole = sandbox.createSafeConsole('test-plugin');

      expect(typeof safeConsole.log).toBe('function');
      expect(typeof safeConsole.info).toBe('function');
      expect(typeof safeConsole.warn).toBe('function');
      expect(typeof safeConsole.error).toBe('function');
      expect(typeof safeConsole.debug).toBe('function');
    });
  });

  describe('createSafeTimeout', () => {
    it('should return a function', () => {
      const safeTimeout = sandbox.createSafeTimeout();
      expect(typeof safeTimeout).toBe('function');
    });
  });

  describe('createSafeRequire', () => {
    it('should allow allowed modules', () => {
      const safeRequire = sandbox.createSafeRequire([]);
      expect(() => safeRequire('crypto')).not.toThrow();
    });

    it('should block blocked modules', () => {
      const safeRequire = sandbox.createSafeRequire([]);
      expect(() => safeRequire('fs')).toThrow("Module 'fs' is not allowed");
    });

    it('should block child_process', () => {
      const safeRequire = sandbox.createSafeRequire([]);
      expect(() => safeRequire('child_process')).toThrow("Module 'child_process' is not allowed");
    });

    it('should require network permission for http', () => {
      const safeRequire = sandbox.createSafeRequire([]);
      expect(() => safeRequire('http')).toThrow('Permission denied: network:outbound');
    });

    it('should block unallowed modules', () => {
      const safeRequire = sandbox.createSafeRequire([]);
      expect(() => safeRequire('some-random-module')).toThrow("Module 'some-random-module' is not allowed");
    });
  });

  describe('createPluginAPI', () => {
    it('should create API with permitted methods', () => {
      const api = sandbox.createPluginAPI(
        { pluginId: 'test' },
        ['read:data', 'write:data', 'network:outbound']
      );

      expect(typeof api.getData).toBe('function');
      expect(typeof api.setData).toBe('function');
      expect(typeof api.fetch).toBe('function');
      expect(typeof api.log).toBe('function');
    });

    it('should block getData without permission', () => {
      const api = sandbox.createPluginAPI({ pluginId: 'test' }, []);
      expect(() => api.getData('key')).toThrow('Permission denied');
    });

    it('should block setData without permission', () => {
      const api = sandbox.createPluginAPI({ pluginId: 'test' }, []);
      expect(() => api.setData('key', 'value')).toThrow('Permission denied');
    });

    it('should block fetch without permission', () => {
      const api = sandbox.createPluginAPI({ pluginId: 'test' }, []);
      expect(() => api.fetch('http://example.com')).toThrow('Permission denied');
    });

    it('should allow getData with permission', async () => {
      const api = sandbox.createPluginAPI(
        { pluginId: 'test', data: { key: 'value' } },
        ['read:data']
      );
      const result = await api.getData('key');
      expect(result).toBe('value');
    });

    it('should allow setData with permission', async () => {
      const context = { pluginId: 'test' };
      const api = sandbox.createPluginAPI(context, ['write:data']);
      await api.setData('key', 'value');
      expect(context.data.key).toBe('value');
    });
  });

  describe('createSandbox', () => {
    it('should create sandbox with safe globals', () => {
      const result = sandbox.createSandbox({}, { pluginId: 'test' });

      expect(result.console).toBeDefined();
      expect(result.setTimeout).toBeDefined();
      expect(result.setInterval).toBeNull();
      expect(result.setImmediate).toBeNull();
      expect(result.Promise).toBe(Promise);
      expect(result.JSON).toBe(JSON);
      expect(result.Math).toBe(Math);
    });

    it('should include Buffer with storage permission', () => {
      const result = sandbox.createSandbox({}, {
        pluginId: 'test',
        permissions: ['storage:local']
      });

      expect(result.Buffer).toBe(Buffer);
    });

    it('should exclude Buffer without permission', () => {
      const result = sandbox.createSandbox({}, {
        pluginId: 'test',
        permissions: []
      });

      expect(result.Buffer).toBeUndefined();
    });

    it('should include require function', () => {
      const result = sandbox.createSandbox({}, { pluginId: 'test' });
      expect(typeof result.require).toBe('function');
    });

    it('should include API object', () => {
      const result = sandbox.createSandbox({}, { pluginId: 'test' });
      expect(result.api).toBeDefined();
    });
  });

  describe('recordExecution', () => {
    it('should create new stats for new plugin', () => {
      sandbox.recordExecution('new-plugin', {
        success: true,
        duration: 100
      });

      const stats = sandbox.getStats('new-plugin');
      expect(stats.totalExecutions).toBe(1);
      expect(stats.successfulExecutions).toBe(1);
    });

    it('should update existing stats', () => {
      sandbox.recordExecution('test-plugin', { success: true, duration: 100 });
      sandbox.recordExecution('test-plugin', { success: true, duration: 200 });

      const stats = sandbox.getStats('test-plugin');
      expect(stats.totalExecutions).toBe(2);
      expect(stats.totalDuration).toBe(300);
      expect(stats.averageDuration).toBe(150);
    });

    it('should track failed executions', () => {
      sandbox.recordExecution('fail-plugin', { success: false, duration: 50, error: 'test' });

      const stats = sandbox.getStats('fail-plugin');
      expect(stats.failedExecutions).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return null for unknown plugin', () => {
      expect(sandbox.getStats('unknown-plugin')).toBeNull();
    });

    it('should return stats for known plugin', () => {
      sandbox.recordExecution('known-plugin', { success: true, duration: 100 });
      expect(sandbox.getStats('known-plugin')).not.toBeNull();
    });
  });

  describe('getAllStats', () => {
    it('should return all plugin stats', () => {
      sandbox.recordExecution('plugin-1', { success: true, duration: 100 });
      sandbox.recordExecution('plugin-2', { success: true, duration: 200 });

      const allStats = sandbox.getAllStats();
      expect(allStats['plugin-1']).toBeDefined();
      expect(allStats['plugin-2']).toBeDefined();
    });
  });

  describe('resetStats', () => {
    it('should remove stats for plugin', () => {
      sandbox.recordExecution('reset-plugin', { success: true, duration: 100 });
      expect(sandbox.getStats('reset-plugin')).not.toBeNull();

      sandbox.resetStats('reset-plugin');
      expect(sandbox.getStats('reset-plugin')).toBeNull();
    });
  });

  describe('executeInSandbox', () => {
    it('should return error for invalid code', async () => {
      const result = await sandbox.executeInSandbox('eval("bad")', {}, { pluginId: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Security violation');
    });

    it('should execute valid code', async () => {
      const result = await sandbox.executeInSandbox('1 + 1', {}, { pluginId: 'test' });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.duration).toBeGreaterThanOrEqual(0);
    });

    it('should record execution stats', async () => {
      await sandbox.executeInSandbox('1 + 1', {}, { pluginId: 'stats-test' });

      const stats = sandbox.getStats('stats-test');
      expect(stats).not.toBeNull();
      expect(stats.totalExecutions).toBeGreaterThan(0);
    });
  });
});
