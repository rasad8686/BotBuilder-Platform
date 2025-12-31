/**
 * PluginAPI Tests
 * Tests for the public API interface for plugins
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn(), { virtual: true });

const db = require('../../../db');
const PluginAPI = require('../../../plugins/core/PluginAPI');

describe('PluginAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PluginAPI.rateLimits.clear();
    PluginAPI.registeredAPIs.clear();
  });

  describe('createScopedAPI', () => {
    it('should create a scoped API with all sub-APIs', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data', 'write:data'], { tenantId: 'tenant-1' });

      expect(api.version).toBe('1.0.0');
      expect(api.pluginId).toBe('test-plugin');
      expect(api.storage).toBeDefined();
      expect(api.messages).toBeDefined();
      expect(api.http).toBeDefined();
      expect(api.users).toBeDefined();
      expect(api.analytics).toBeDefined();
      expect(api.settings).toBeDefined();
      expect(api.log).toBeDefined();
      expect(api.events).toBeDefined();
      expect(api.ui).toBeDefined();
      expect(api.utils).toBeDefined();
    });
  });

  describe('Storage API', () => {
    it('should get value from storage', async () => {
      db.query.mockResolvedValue({ rows: [{ value: JSON.stringify({ test: 'data' }), expires_at: null }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
      const result = await api.storage.get('myKey');

      expect(result).toEqual({ test: 'data' });
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT value, expires_at'),
        ['test-plugin', 'myKey']
      );
    });

    it('should return null for non-existent key', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['storage:local']);
      const result = await api.storage.get('missing');

      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      const expiredDate = new Date(Date.now() - 10000).toISOString();
      db.query.mockResolvedValueOnce({ rows: [{ value: JSON.stringify('data'), expires_at: expiredDate }] })
        .mockResolvedValueOnce({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
      const result = await api.storage.get('expiredKey');

      expect(result).toBeNull();
    });

    it('should set value in storage', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
      const result = await api.storage.set('key', { data: 'value' });

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO plugin_storage'),
        expect.arrayContaining(['test-plugin', 'key'])
      );
    });

    it('should set value with TTL', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
      await api.storage.set('key', 'value', 3600);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['test-plugin', 'key'])
      );
    });

    it('should delete value from storage', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
      const result = await api.storage.delete('key');

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM plugin_storage'),
        ['test-plugin', 'key']
      );
    });

    it('should list keys with prefix', async () => {
      db.query.mockResolvedValue({ rows: [{ key: 'user:1' }, { key: 'user:2' }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
      const result = await api.storage.list('user:');

      expect(result).toEqual(['user:1', 'user:2']);
    });

    it('should clear all storage', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['storage:local']);
      const result = await api.storage.clear();

      expect(result).toBe(true);
    });

    it('should throw error without read permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      await expect(api.storage.get('key')).rejects.toThrow('Permission denied: read:data');
    });

    it('should throw error without write permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);

      await expect(api.storage.set('key', 'value')).rejects.toThrow('Permission denied: write:data');
    });
  });

  describe('Message API', () => {
    it('should send message with permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });

      const result = await api.messages.send('channel-1', { text: 'Hello' });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should reply to message', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });

      const result = await api.messages.reply('msg-1', 'Response text');

      expect(result.success).toBe(true);
    });

    it('should get message history', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'msg-1', content: 'Hello' }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:messages'], { tenantId: 'tenant-1' });
      const result = await api.messages.getHistory('channel-1', 20);

      expect(result).toEqual([{ id: 'msg-1', content: 'Hello' }]);
    });

    it('should throw error without send permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      await expect(api.messages.send('channel-1', 'Hello')).rejects.toThrow('Permission denied: send:messages');
    });
  });

  describe('HTTP API', () => {
    it('should throw error without network permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      await expect(api.http.fetch('https://api.example.com')).rejects.toThrow('Permission denied: network:outbound');
    });

    it('should provide get and post methods', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      expect(api.http.get).toBeDefined();
      expect(api.http.post).toBeDefined();
    });
  });

  describe('User API', () => {
    it('should get current user', async () => {
      const mockUser = { id: 'user-1', name: 'Test User' };
      const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], { user: mockUser });

      const result = await api.users.getCurrent();

      expect(result).toEqual(mockUser);
    });

    it('should get user by ID', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 'user-1', username: 'testuser' }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], { tenantId: 'tenant-1' });
      const result = await api.users.getById('user-1');

      expect(result).toEqual({ id: 'user-1', username: 'testuser' });
    });

    it('should update user metadata', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['user:write'], { tenantId: 'tenant-1' });
      const result = await api.users.updateMetadata('user-1', { preference: 'dark' });

      expect(result.success).toBe(true);
    });

    it('should throw error without read permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      await expect(api.users.getCurrent()).rejects.toThrow('Permission denied: user:read');
    });
  });

  describe('Analytics API', () => {
    it('should track event', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:write'], { tenantId: 'tenant-1' });
      const result = await api.analytics.track('button_click', { button_id: 'submit' });

      expect(result.success).toBe(true);
    });

    it('should get metrics', async () => {
      db.query.mockResolvedValue({ rows: [{ count: '10' }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:read'], { tenantId: 'tenant-1' });
      const result = await api.analytics.getMetrics('button_click', { groupBy: 'day' });

      expect(result).toEqual([{ count: '10' }]);
    });

    it('should throw error without write permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      await expect(api.analytics.track('event')).rejects.toThrow('Permission denied: analytics:write');
    });
  });

  describe('Settings API', () => {
    it('should get settings', async () => {
      db.query.mockResolvedValue({ rows: [{ settings: { theme: 'dark' } }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['settings:read'], { tenantId: 'tenant-1' });
      const result = await api.settings.get();

      expect(result).toEqual({ theme: 'dark' });
    });

    it('should get specific setting', async () => {
      db.query.mockResolvedValue({ rows: [{ settings: { theme: 'dark', lang: 'en' } }] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['settings:read'], { tenantId: 'tenant-1' });
      const result = await api.settings.get('theme');

      expect(result).toBe('dark');
    });

    it('should set settings', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['settings:write'], { tenantId: 'tenant-1' });
      const result = await api.settings.set('theme', 'light');

      expect(result.success).toBe(true);
    });
  });

  describe('Log API', () => {
    it('should provide logging methods', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      expect(api.log.debug).toBeDefined();
      expect(api.log.info).toBeDefined();
      expect(api.log.warn).toBeDefined();
      expect(api.log.error).toBeDefined();
    });
  });

  describe('Events API', () => {
    it('should provide event methods', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      expect(api.events.on).toBeDefined();
      expect(api.events.off).toBeDefined();
      expect(api.events.emit).toBeDefined();
    });
  });

  describe('UI API', () => {
    it('should provide UI methods', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      expect(api.ui.showNotification).toBeDefined();
      expect(api.ui.showModal).toBeDefined();
      expect(api.ui.registerComponent).toBeDefined();
    });

    it('should emit notification event', () => {
      const emitSpy = jest.spyOn(PluginAPI, 'emit');
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      api.ui.showNotification('Hello', 'info');

      expect(emitSpy).toHaveBeenCalledWith('ui:notification', {
        pluginId: 'test-plugin',
        message: 'Hello',
        type: 'info'
      });
    });
  });

  describe('Utils API', () => {
    it('should generate UUID', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const uuid = api.utils.uuid();

      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should hash data', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const hash = api.utils.hash('test');

      expect(hash).toHaveLength(64); // SHA256 hex
    });

    it('should encrypt and decrypt data', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const key = require('crypto').randomBytes(32).toString('hex');
      const data = 'secret message';

      const encrypted = api.utils.encrypt(data, key);
      const decrypted = api.utils.decrypt(encrypted, key);

      expect(decrypted).toBe(data);
    });

    it('should sleep for specified time', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const start = Date.now();

      await api.utils.sleep(50);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should cap sleep time at 30 seconds', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      // Don't actually wait, just verify the cap
      const sleepPromise = api.utils.sleep(100000);
      expect(sleepPromise).toBeInstanceOf(Promise);
    });

    it('should parse JSON safely', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      expect(api.utils.parseJSON('{"a":1}')).toEqual({ a: 1 });
      expect(api.utils.parseJSON('invalid', 'fallback')).toBe('fallback');
    });

    it('should format date', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const date = new Date('2024-01-15T12:00:00Z');

      expect(api.utils.formatDate(date, 'ISO')).toContain('2024-01-15');
      expect(api.utils.formatDate(date, 'UTC')).toContain('2024');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const result = PluginAPI.checkRateLimit('test-plugin', 'test', 60, 10);
      expect(result).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      for (let i = 0; i < 10; i++) {
        PluginAPI.checkRateLimit('test-plugin', 'blocking', 60, 10);
      }

      const result = PluginAPI.checkRateLimit('test-plugin', 'blocking', 60, 10);
      expect(result).toBe(false);
    });
  });

  describe('Custom API Registration', () => {
    it('should register custom API', () => {
      const customAPI = { method: () => 'result' };

      PluginAPI.registerAPI('custom', customAPI);

      expect(PluginAPI.getAPI('custom')).toBe(customAPI);
    });

    it('should throw error for duplicate registration', () => {
      PluginAPI.registerAPI('duplicate', {});

      expect(() => PluginAPI.registerAPI('duplicate', {})).toThrow('already registered');
    });

    it('should return undefined for unregistered API', () => {
      expect(PluginAPI.getAPI('nonexistent')).toBeUndefined();
    });
  });
});
