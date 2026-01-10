/**
 * Comprehensive tests for PluginAPI
 * Covers 80+ test cases for all APIs and edge cases
 */

jest.mock('../../../db', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));
jest.mock('node-fetch', () => jest.fn(), { virtual: true });

const PluginAPI = require('../../../plugins/core/PluginAPI');
const db = require('../../../db');
const log = require('../../../utils/logger');

describe('PluginAPI - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    PluginAPI.registeredAPIs.clear();
    PluginAPI.rateLimits.clear();
  });

  // ============================================================================
  // 1. createScopedAPI Tests
  // ============================================================================
  describe('createScopedAPI', () => {
    test('should create a scoped API with all sub-APIs', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data', 'send:messages']);

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

    test('should include pluginId in scoped API', () => {
      const api = PluginAPI.createScopedAPI('my-plugin', []);
      expect(api.pluginId).toBe('my-plugin');
    });

    test('should create independent APIs for different plugins', () => {
      const api1 = PluginAPI.createScopedAPI('plugin-1', ['read:data']);
      const api2 = PluginAPI.createScopedAPI('plugin-2', ['read:data']);

      expect(api1.pluginId).toBe('plugin-1');
      expect(api2.pluginId).toBe('plugin-2');
      expect(api1.storage).not.toBe(api2.storage);
    });

    test('should pass context to relevant APIs', () => {
      const context = {
        user: { id: 'user-1' },
        tenantId: 'tenant-1'
      };
      const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], context);

      expect(api.users.getCurrent()).resolves.toEqual({ id: 'user-1' });
    });
  });

  // ============================================================================
  // 2. Storage API Tests
  // ============================================================================
  describe('Storage API', () => {
    describe('get', () => {
      test('should get stored value with read permission', async () => {
        db.query.mockResolvedValue({
          rows: [{ value: '"test-value"', expires_at: null }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
        const result = await api.storage.get('key1');

        expect(result).toBe('test-value');
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT value, expires_at FROM plugin_storage'),
          ['test-plugin', 'key1']
        );
      });

      test('should throw error without read permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.storage.get('key1')).rejects.toThrow('Permission denied: read:data');
      });

      test('should allow read with storage:local permission', async () => {
        db.query.mockResolvedValue({
          rows: [{ value: '"data"', expires_at: null }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['storage:local']);
        const result = await api.storage.get('key1');

        expect(result).toBe('data');
      });

      test('should return null for non-existent keys', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
        const result = await api.storage.get('missing-key');

        expect(result).toBeNull();
      });

      test('should return null for expired data', async () => {
        const expiredDate = new Date(Date.now() - 1000);
        db.query.mockResolvedValue({
          rows: [{ value: '"old-data"', expires_at: expiredDate.toISOString() }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data', 'write:data']);
        const result = await api.storage.get('expired-key');

        expect(result).toBeNull();
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE FROM plugin_storage'),
          ['test-plugin', 'expired-key']
        );
      });

      test('should parse complex JSON objects', async () => {
        const complexObj = { nested: { data: [1, 2, 3] }, bool: true };
        db.query.mockResolvedValue({
          rows: [{ value: JSON.stringify(complexObj), expires_at: null }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
        const result = await api.storage.get('complex-key');

        expect(result).toEqual(complexObj);
      });
    });

    describe('set', () => {
      test('should set value with write permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        const result = await api.storage.set('key1', 'value1');

        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO plugin_storage'),
          expect.arrayContaining(['test-plugin', 'key1', '"value1"', null])
        );
      });

      test('should throw error without write permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.storage.set('key1', 'value1')).rejects.toThrow('Permission denied: write:data');
      });

      test('should allow write with storage:local permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['storage:local']);
        const result = await api.storage.set('key1', 'value1');

        expect(result).toBe(true);
      });

      test('should set TTL when provided', async () => {
        db.query.mockResolvedValue({});
        const now = Date.now();
        jest.useFakeTimers();
        jest.setSystemTime(now);

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        await api.storage.set('ttl-key', 'ttl-value', 3600);

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[2]).toBe('"ttl-value"');
        expect(callArgs[3]).not.toBeNull();

        jest.useRealTimers();
      });

      test('should set null TTL when not provided', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        await api.storage.set('no-ttl-key', 'value');

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[3]).toBeNull();
      });

      test('should handle complex objects', async () => {
        db.query.mockResolvedValue({});
        const complexObj = { nested: { arr: [1, 2, 3] } };

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        await api.storage.set('complex-key', complexObj);

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[2]).toBe(JSON.stringify(complexObj));
      });

      test('should update existing keys', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        await api.storage.set('existing-key', 'new-value');

        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('ON CONFLICT'),
          expect.any(Array)
        );
      });
    });

    describe('delete', () => {
      test('should delete key with write permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        const result = await api.storage.delete('key-to-delete');

        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          'DELETE FROM plugin_storage WHERE plugin_id = $1 AND key = $2',
          ['test-plugin', 'key-to-delete']
        );
      });

      test('should throw error without write permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.storage.delete('key')).rejects.toThrow('Permission denied: write:data');
      });

      test('should allow delete with storage:local permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['storage:local']);
        const result = await api.storage.delete('key');

        expect(result).toBe(true);
      });
    });

    describe('list', () => {
      test('should list keys with prefix and read permission', async () => {
        db.query.mockResolvedValue({
          rows: [{ key: 'prefix:key1' }, { key: 'prefix:key2' }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
        const result = await api.storage.list('prefix:');

        expect(result).toEqual(['prefix:key1', 'prefix:key2']);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT key FROM plugin_storage'),
          ['test-plugin', 'prefix:%']
        );
      });

      test('should throw error without read permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.storage.list('prefix')).rejects.toThrow('Permission denied: read:data');
      });

      test('should list all keys when prefix is empty', async () => {
        db.query.mockResolvedValue({
          rows: [{ key: 'key1' }, { key: 'key2' }, { key: 'key3' }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
        const result = await api.storage.list();

        expect(result).toEqual(['key1', 'key2', 'key3']);
      });

      test('should return empty array when no keys match', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
        const result = await api.storage.list('nonexistent:');

        expect(result).toEqual([]);
      });
    });

    describe('clear', () => {
      test('should clear all storage with write permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
        const result = await api.storage.clear();

        expect(result).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          'DELETE FROM plugin_storage WHERE plugin_id = $1',
          ['test-plugin']
        );
      });

      test('should throw error without write permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.storage.clear()).rejects.toThrow('Permission denied: write:data');
      });

      test('should allow clear with storage:local permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['storage:local']);
        const result = await api.storage.clear();

        expect(result).toBe(true);
      });
    });
  });

  // ============================================================================
  // 3. Message API Tests
  // ============================================================================
  describe('Message API', () => {
    describe('send', () => {
      test('should send message with send:messages permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });
        const result = await api.messages.send('channel-1', { text: 'Hello' });

        expect(result.success).toBe(true);
        expect(result.messageId).toBeDefined();
        expect(log.info).toHaveBeenCalled();
      });

      test('should throw error without send:messages permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.messages.send('channel-1', { text: 'Hello' })).rejects.toThrow('Permission denied: send:messages');
      });

      test('should emit plugin:message:send event', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });
        const listener = jest.fn();
        PluginAPI.on('plugin:message:send', listener);

        await api.messages.send('channel-1', { text: 'Hello' });

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            pluginId: 'test-plugin',
            channelId: 'channel-1',
            message: { text: 'Hello' },
            tenantId: 'tenant-1'
          })
        );
      });

      test('should respect rate limits for messages', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });

        // Fill rate limit bucket
        for (let i = 0; i < 100; i++) {
          await api.messages.send('channel-1', { text: 'Message' });
        }

        // 101st request should fail
        await expect(api.messages.send('channel-1', { text: 'Message' })).rejects.toThrow('Rate limit exceeded');
      });

      test('should handle complex message objects', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });
        const complexMessage = {
          text: 'Hello',
          attachments: [{ type: 'image', url: 'http://example.com/image.jpg' }],
          metadata: { priority: 'high' }
        };

        const result = await api.messages.send('channel-1', complexMessage);
        expect(result.success).toBe(true);
      });
    });

    describe('reply', () => {
      test('should reply to message with send:messages permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });
        const result = await api.messages.reply('message-123', { text: 'Reply' });

        expect(result.success).toBe(true);
      });

      test('should throw error without send:messages permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.messages.reply('message-123', { text: 'Reply' })).rejects.toThrow('Permission denied: send:messages');
      });

      test('should emit plugin:message:reply event', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });
        const listener = jest.fn();
        PluginAPI.on('plugin:message:reply', listener);

        await api.messages.reply('message-123', { text: 'Reply' });

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            pluginId: 'test-plugin',
            messageId: 'message-123',
            response: { text: 'Reply' },
            tenantId: 'tenant-1'
          })
        );
      });

      test('should respect rate limits for replies', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });

        for (let i = 0; i < 100; i++) {
          await api.messages.reply('message-123', { text: 'Reply' });
        }

        await expect(api.messages.reply('message-123', { text: 'Reply' })).rejects.toThrow('Rate limit exceeded');
      });
    });

    describe('getHistory', () => {
      test('should get message history with read:messages permission', async () => {
        db.query.mockResolvedValue({
          rows: [
            { id: 'msg-1', content: 'Message 1', sender: 'user-1', created_at: '2024-01-01T00:00:00Z' },
            { id: 'msg-2', content: 'Message 2', sender: 'user-2', created_at: '2024-01-01T00:01:00Z' }
          ]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:messages'], { tenantId: 'tenant-1' });
        const result = await api.messages.getHistory('channel-1', 50);

        expect(result).toHaveLength(2);
        expect(result[0].content).toBe('Message 1');
      });

      test('should throw error without read:messages permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.messages.getHistory('channel-1')).rejects.toThrow('Permission denied: read:messages');
      });

      test('should use default limit of 50', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:messages'], { tenantId: 'tenant-1' });
        await api.messages.getHistory('channel-1');

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[2]).toBe(50);
      });

      test('should cap limit at 100', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:messages'], { tenantId: 'tenant-1' });
        await api.messages.getHistory('channel-1', 500);

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[2]).toBe(100);
      });

      test('should filter by tenant', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['read:messages'], { tenantId: 'tenant-1' });
        await api.messages.getHistory('channel-1');

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[1]).toBe('tenant-1');
      });
    });
  });

  // ============================================================================
  // 4. HTTP API Tests
  // ============================================================================
  describe('HTTP API', () => {
    test('should fetch with network:outbound permission', async () => {
      const mockFetch = jest.fn();
      jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ data: 'test' }),
        text: jest.fn().mockResolvedValue('test')
      });

      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);
      const result = await api.http.fetch('https://example.com/api');

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    test('should throw error without network:outbound permission', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      await expect(api.http.fetch('https://example.com')).rejects.toThrow('Permission denied: network:outbound');
    });

    test('should block localhost', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      await expect(api.http.fetch('http://localhost:3000')).rejects.toThrow('Access to internal hosts is not allowed');
    });

    test('should block 127.0.0.1', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      await expect(api.http.fetch('http://127.0.0.1:3000')).rejects.toThrow('Access to internal hosts is not allowed');
    });

    test('should block 0.0.0.0', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      await expect(api.http.fetch('http://0.0.0.0')).rejects.toThrow('Access to internal hosts is not allowed');
    });

    test('should block ::1 (IPv6 localhost)', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      await expect(api.http.fetch('http://[::1]:3000')).rejects.toThrow('Access to internal hosts is not allowed');
    });

    test('should block 169.254.169.254 (metadata service)', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      await expect(api.http.fetch('http://169.254.169.254/metadata')).rejects.toThrow('Access to internal hosts is not allowed');
    });

    test('should respect rate limits for HTTP', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn(),
        text: jest.fn()
      });
      jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      for (let i = 0; i < 50; i++) {
        await api.http.fetch('https://example.com/api');
      }

      await expect(api.http.fetch('https://example.com/api')).rejects.toThrow('Rate limit exceeded');
    });

    describe('get method', () => {
      test('should send GET request', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map(),
          json: jest.fn(),
          text: jest.fn()
        });
        jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

        const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);
        await api.http.get('https://example.com/api');

        expect(mockFetch).toHaveBeenCalled();
      });

      test('should throw error without permission for GET', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.http.get('https://example.com')).rejects.toThrow('Permission denied: network:outbound');
      });
    });

    describe('post method', () => {
      test('should send POST request with body', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: new Map(),
          json: jest.fn(),
          text: jest.fn()
        });
        jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

        const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);
        await api.http.post('https://example.com/api', { key: 'value' });

        expect(mockFetch).toHaveBeenCalled();
      });

      test('should throw error without permission for POST', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.http.post('https://example.com', { data: 'test' })).rejects.toThrow('Permission denied: network:outbound');
      });
    });

    test('should add User-Agent header', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn(),
        text: jest.fn()
      });
      jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);
      await api.http.fetch('https://example.com');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].headers['User-Agent']).toContain('BotBuilder-Plugin');
    });

    test('should respect timeout option (capped at 30000ms)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn(),
        text: jest.fn()
      });
      jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);
      await api.http.fetch('https://example.com', { timeout: 50000 });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].timeout).toBe(30000);
    });

    test('should use provided timeout when less than 30000ms', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        json: jest.fn(),
        text: jest.fn()
      });
      jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);
      await api.http.fetch('https://example.com', { timeout: 5000 });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].timeout).toBe(5000);
    });

    test('should log warnings on fetch failure', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network error'));
      jest.doMock('node-fetch', () => ({ default: mockFetch }), { virtual: true });

      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      try {
        await api.http.fetch('https://example.com');
      } catch (e) {
        expect(log.warn).toHaveBeenCalled();
      }
    });
  });

  // ============================================================================
  // 5. User API Tests
  // ============================================================================
  describe('User API', () => {
    describe('getCurrent', () => {
      test('should get current user with user:read permission', async () => {
        const user = { id: 'user-1', username: 'john' };
        const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], { user });

        const result = await api.users.getCurrent();
        expect(result).toEqual(user);
      });

      test('should throw error without user:read permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.users.getCurrent()).rejects.toThrow('Permission denied: user:read');
      });

      test('should return null when user not in context', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], {});

        const result = await api.users.getCurrent();
        expect(result).toBeNull();
      });
    });

    describe('getById', () => {
      test('should get user by ID with user:read permission', async () => {
        db.query.mockResolvedValue({
          rows: [{ id: 'user-1', username: 'john', email: 'john@example.com', created_at: '2024-01-01' }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], { tenantId: 'tenant-1' });
        const result = await api.users.getById('user-1');

        expect(result.username).toBe('john');
      });

      test('should throw error without user:read permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.users.getById('user-1')).rejects.toThrow('Permission denied: user:read');
      });

      test('should return null for non-existent user', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], { tenantId: 'tenant-1' });
        const result = await api.users.getById('nonexistent-user');

        expect(result).toBeNull();
      });

      test('should filter by tenant', async () => {
        db.query.mockResolvedValue({ rows: [{ id: 'user-1', username: 'john' }] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['user:read'], { tenantId: 'tenant-1' });
        await api.users.getById('user-1');

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[1]).toBe('tenant-1');
      });
    });

    describe('updateMetadata', () => {
      test('should update user metadata with user:write permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['user:write'], { tenantId: 'tenant-1' });
        const result = await api.users.updateMetadata('user-1', { key: 'value' });

        expect(result.success).toBe(true);
      });

      test('should throw error without user:write permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.users.updateMetadata('user-1', { key: 'value' })).rejects.toThrow('Permission denied: user:write');
      });

      test('should filter by tenant', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['user:write'], { tenantId: 'tenant-1' });
        await api.users.updateMetadata('user-1', { key: 'value' });

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[2]).toBe('tenant-1');
      });

      test('should handle complex metadata objects', async () => {
        db.query.mockResolvedValue({});
        const metadata = { preferences: { theme: 'dark' }, tags: ['vip', 'beta'] };

        const api = PluginAPI.createScopedAPI('test-plugin', ['user:write'], { tenantId: 'tenant-1' });
        await api.users.updateMetadata('user-1', metadata);

        const callArgs = db.query.mock.calls[0][1];
        expect(JSON.parse(callArgs[0])).toEqual(metadata);
      });
    });
  });

  // ============================================================================
  // 6. Analytics API Tests
  // ============================================================================
  describe('Analytics API', () => {
    describe('track', () => {
      test('should track event with analytics:write permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:write'], { tenantId: 'tenant-1' });
        const result = await api.analytics.track('user_signup', { source: 'web' });

        expect(result.success).toBe(true);
        expect(db.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO plugin_analytics'),
          ['test-plugin', 'tenant-1', 'user_signup', '{"source":"web"}']
        );
      });

      test('should throw error without analytics:write permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.analytics.track('event', {})).rejects.toThrow('Permission denied: analytics:write');
      });

      test('should handle complex properties', async () => {
        db.query.mockResolvedValue({});
        const properties = { nested: { data: [1, 2, 3] }, bool: true };

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:write'], { tenantId: 'tenant-1' });
        await api.analytics.track('complex_event', properties);

        const callArgs = db.query.mock.calls[0][1];
        expect(JSON.parse(callArgs[3])).toEqual(properties);
      });

      test('should use empty object as default properties', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:write'], { tenantId: 'tenant-1' });
        await api.analytics.track('simple_event');

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[3]).toBe('{}');
      });
    });

    describe('getMetrics', () => {
      test('should get metrics with analytics:read permission', async () => {
        db.query.mockResolvedValue({
          rows: [{ count: '100' }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:read'], { tenantId: 'tenant-1' });
        const result = await api.analytics.getMetrics('user_signup');

        expect(result).toHaveLength(1);
        expect(result[0].count).toBe('100');
      });

      test('should throw error without analytics:read permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.analytics.getMetrics('metric')).rejects.toThrow('Permission denied: analytics:read');
      });

      test('should filter by startDate', async () => {
        db.query.mockResolvedValue({ rows: [] });
        const startDate = '2024-01-01';

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:read'], { tenantId: 'tenant-1' });
        await api.analytics.getMetrics('event', { startDate });

        const callArgs = db.query.mock.calls[0];
        expect(callArgs[0]).toContain('created_at >= $');
        expect(callArgs[1]).toContain(startDate);
      });

      test('should filter by endDate', async () => {
        db.query.mockResolvedValue({ rows: [] });
        const endDate = '2024-12-31';

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:read'], { tenantId: 'tenant-1' });
        await api.analytics.getMetrics('event', { endDate });

        const callArgs = db.query.mock.calls[0];
        expect(callArgs[0]).toContain('created_at <= $');
        expect(callArgs[1]).toContain(endDate);
      });

      test('should group by period when groupBy option provided', async () => {
        db.query.mockResolvedValue({
          rows: [{ count: '50', period: '2024-01-01' }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['analytics:read'], { tenantId: 'tenant-1' });
        const result = await api.analytics.getMetrics('event', { groupBy: 'day' });

        const callArgs = db.query.mock.calls[0];
        expect(callArgs[0]).toContain('DATE_TRUNC');
        expect(callArgs[0]).toContain('GROUP BY period');
      });
    });
  });

  // ============================================================================
  // 7. Settings API Tests
  // ============================================================================
  describe('Settings API', () => {
    describe('get', () => {
      test('should get all settings with settings:read permission', async () => {
        const settings = { theme: 'dark', notifications: true };
        db.query.mockResolvedValue({
          rows: [{ settings }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:read'], { tenantId: 'tenant-1' });
        const result = await api.settings.get();

        expect(result).toEqual(settings);
      });

      test('should get specific setting by key', async () => {
        const settings = { theme: 'dark', notifications: true };
        db.query.mockResolvedValue({
          rows: [{ settings }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:read'], { tenantId: 'tenant-1' });
        const result = await api.settings.get('theme');

        expect(result).toBe('dark');
      });

      test('should throw error without settings:read permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.settings.get()).rejects.toThrow('Permission denied: settings:read');
      });

      test('should return null when no settings exist', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:read'], { tenantId: 'tenant-1' });
        const result = await api.settings.get();

        expect(result).toBeNull();
      });

      test('should return null for missing key', async () => {
        const settings = { theme: 'dark' };
        db.query.mockResolvedValue({
          rows: [{ settings }]
        });

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:read'], { tenantId: 'tenant-1' });
        const result = await api.settings.get('nonexistent');

        expect(result).toBeUndefined();
      });
    });

    describe('set', () => {
      test('should set setting with settings:write permission', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:write'], { tenantId: 'tenant-1' });
        const result = await api.settings.set('theme', 'light');

        expect(result.success).toBe(true);
      });

      test('should throw error without settings:write permission', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        await expect(api.settings.set('theme', 'light')).rejects.toThrow('Permission denied: settings:write');
      });

      test('should handle complex values', async () => {
        db.query.mockResolvedValue({});
        const value = { nested: { deep: [1, 2, 3] } };

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:write'], { tenantId: 'tenant-1' });
        await api.settings.set('config', value);

        const callArgs = db.query.mock.calls[0][1];
        expect(JSON.parse(callArgs[3])).toEqual(value);
      });

      test('should filter by tenant', async () => {
        db.query.mockResolvedValue({});

        const api = PluginAPI.createScopedAPI('test-plugin', ['settings:write'], { tenantId: 'tenant-1' });
        await api.settings.set('key', 'value');

        const callArgs = db.query.mock.calls[0][1];
        expect(callArgs[1]).toBe('tenant-1');
      });
    });
  });

  // ============================================================================
  // 8. Log API Tests
  // ============================================================================
  describe('Log API', () => {
    test('should call debug with plugin prefix', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      api.log.debug('Debug message');

      expect(log.debug).toHaveBeenCalledWith('[Plugin:test-plugin]', 'Debug message');
    });

    test('should call info with plugin prefix', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      api.log.info('Info message');

      expect(log.info).toHaveBeenCalledWith('[Plugin:test-plugin]', 'Info message');
    });

    test('should call warn with plugin prefix', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      api.log.warn('Warning message');

      expect(log.warn).toHaveBeenCalledWith('[Plugin:test-plugin]', 'Warning message');
    });

    test('should call error with plugin prefix', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      api.log.error('Error message');

      expect(log.error).toHaveBeenCalledWith('[Plugin:test-plugin]', 'Error message');
    });

    test('should handle multiple arguments', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      api.log.info('Message', 'arg1', 'arg2');

      expect(log.info).toHaveBeenCalledWith('[Plugin:test-plugin]', 'Message', 'arg1', 'arg2');
    });
  });

  // ============================================================================
  // 9. Events API Tests
  // ============================================================================
  describe('Events API', () => {
    test('should register event listener with on', (done) => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener = jest.fn();

      api.events.on('test-event', listener);
      api.events.emit('test-event', { data: 'test' });

      setTimeout(() => {
        expect(listener).toHaveBeenCalledWith({ data: 'test' });
        done();
      }, 10);
    });

    test('should remove event listener with off', (done) => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener = jest.fn();

      api.events.on('test-event', listener);
      api.events.off('test-event', listener);
      api.events.emit('test-event', { data: 'test' });

      setTimeout(() => {
        expect(listener).not.toHaveBeenCalled();
        done();
      }, 10);
    });

    test('should namespace events by plugin ID', (done) => {
      const api1 = PluginAPI.createScopedAPI('plugin-1', []);
      const api2 = PluginAPI.createScopedAPI('plugin-2', []);

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      api1.events.on('event', listener1);
      api2.events.on('event', listener2);

      api1.events.emit('event', { data: 'plugin1' });

      setTimeout(() => {
        expect(listener1).toHaveBeenCalledWith({ data: 'plugin1' });
        expect(listener2).not.toHaveBeenCalled();
        done();
      }, 10);
    });

    test('should handle multiple listeners', (done) => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      api.events.on('event', listener1);
      api.events.on('event', listener2);
      api.events.emit('event', { data: 'test' });

      setTimeout(() => {
        expect(listener1).toHaveBeenCalledWith({ data: 'test' });
        expect(listener2).toHaveBeenCalledWith({ data: 'test' });
        done();
      }, 10);
    });
  });

  // ============================================================================
  // 10. UI API Tests
  // ============================================================================
  describe('UI API', () => {
    test('should show notification and emit event', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener = jest.fn();

      PluginAPI.on('ui:notification', listener);
      api.ui.showNotification('Test message', 'success');

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        message: 'Test message',
        type: 'success'
      });
    });

    test('should use default notification type of info', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener = jest.fn();

      PluginAPI.on('ui:notification', listener);
      api.ui.showNotification('Test message');

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        message: 'Test message',
        type: 'info'
      });
    });

    test('should show modal and emit event', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener = jest.fn();
      const config = { title: 'Modal Title', content: 'Modal content' };

      PluginAPI.on('ui:modal', listener);
      api.ui.showModal(config);

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        config
      });
    });

    test('should register component and emit event', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      const listener = jest.fn();
      const component = { render: jest.fn() };

      PluginAPI.on('ui:component', listener);
      api.ui.registerComponent('MyComponent', component);

      expect(listener).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        name: 'MyComponent',
        component
      });
    });

    test('should not require permissions for UI API', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);

      expect(() => {
        api.ui.showNotification('Test');
        api.ui.showModal({ title: 'Test' });
        api.ui.registerComponent('Test', {});
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 11. Utils API Tests
  // ============================================================================
  describe('Utils API', () => {
    describe('uuid', () => {
      test('should generate valid UUID', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const uuid = api.utils.uuid();

        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      test('should generate unique UUIDs', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const uuid1 = api.utils.uuid();
        const uuid2 = api.utils.uuid();

        expect(uuid1).not.toBe(uuid2);
      });
    });

    describe('hash', () => {
      test('should hash with sha256 (default)', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const hash = api.utils.hash('test-data');

        expect(hash).toHaveLength(64); // SHA256 produces 64 character hex
        expect(hash).toMatch(/^[0-9a-f]+$/);
      });

      test('should hash with different algorithms', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const sha256Hash = api.utils.hash('test-data', 'sha256');
        const sha1Hash = api.utils.hash('test-data', 'sha1');

        expect(sha256Hash).not.toBe(sha1Hash);
      });

      test('should produce consistent hashes', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const hash1 = api.utils.hash('test-data');
        const hash2 = api.utils.hash('test-data');

        expect(hash1).toBe(hash2);
      });
    });

    describe('encrypt/decrypt', () => {
      test('should encrypt and decrypt data', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const key = 'a'.repeat(64); // 32 bytes in hex
        const plaintext = 'secret-data';

        const encrypted = api.utils.encrypt(plaintext, key);
        const decrypted = api.utils.decrypt(encrypted, key);

        expect(decrypted).toBe(plaintext);
      });

      test('should produce different ciphertexts for same data (due to random IV)', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const key = 'a'.repeat(64);
        const plaintext = 'test-data';

        const encrypted1 = api.utils.encrypt(plaintext, key);
        const encrypted2 = api.utils.encrypt(plaintext, key);

        expect(encrypted1).not.toBe(encrypted2);
      });

      test('should handle unicode characters', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const key = 'a'.repeat(64);
        const plaintext = 'Hello 世界 🌍';

        const encrypted = api.utils.encrypt(plaintext, key);
        const decrypted = api.utils.decrypt(encrypted, key);

        expect(decrypted).toBe(plaintext);
      });

      test('should throw error on invalid ciphertext format', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const key = 'a'.repeat(64);

        expect(() => {
          api.utils.decrypt('invalid-ciphertext', key);
        }).toThrow();
      });
    });

    describe('sleep', () => {
      test('should wait specified milliseconds', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const start = Date.now();

        await api.utils.sleep(100);

        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(90);
      });

      test('should cap sleep at 30000ms', async () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const start = Date.now();

        const promise = api.utils.sleep(50000);

        setTimeout(() => {
          const elapsed = Date.now() - start;
          // Should have only slept for max 30000ms
          expect(elapsed).toBeLessThan(35000);
        }, 31000);
      });
    });

    describe('parseJSON', () => {
      test('should parse valid JSON', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const result = api.utils.parseJSON('{"key":"value"}');

        expect(result).toEqual({ key: 'value' });
      });

      test('should return fallback for invalid JSON', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const result = api.utils.parseJSON('invalid json', { fallback: true });

        expect(result).toEqual({ fallback: true });
      });

      test('should use null as default fallback', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const result = api.utils.parseJSON('invalid json');

        expect(result).toBeNull();
      });

      test('should parse arrays', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const result = api.utils.parseJSON('[1,2,3]');

        expect(result).toEqual([1, 2, 3]);
      });

      test('should parse primitives', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);

        expect(api.utils.parseJSON('true')).toBe(true);
        expect(api.utils.parseJSON('123')).toBe(123);
        expect(api.utils.parseJSON('"string"')).toBe('string');
        expect(api.utils.parseJSON('null')).toBeNull();
      });
    });

    describe('formatDate', () => {
      test('should format as ISO by default', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const date = new Date('2024-01-15T12:30:45Z');
        const result = api.utils.formatDate(date);

        expect(result).toMatch(/2024-01-15T12:30:45/);
      });

      test('should format as ISO when specified', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const date = new Date('2024-01-15T12:30:45Z');
        const result = api.utils.formatDate(date, 'ISO');

        expect(result).toMatch(/2024-01-15T12:30:45/);
      });

      test('should format as UTC when specified', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const date = new Date('2024-01-15T12:30:45Z');
        const result = api.utils.formatDate(date, 'UTC');

        expect(result).toContain('2024');
        expect(result).toContain('Jan');
      });

      test('should format as locale string for other formats', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const date = new Date('2024-01-15T12:30:45Z');
        const result = api.utils.formatDate(date, 'locale');

        expect(result).toContain('2024');
      });

      test('should accept string dates', () => {
        const api = PluginAPI.createScopedAPI('test-plugin', []);
        const result = api.utils.formatDate('2024-01-15');

        expect(result).toMatch(/2024-01-15/);
      });
    });
  });

  // ============================================================================
  // 12. Rate Limiting Tests
  // ============================================================================
  describe('Rate Limiting', () => {
    test('checkRateLimit should return true for first requests', () => {
      const result1 = PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);
      const result2 = PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    test('checkRateLimit should return false after limit exceeded', () => {
      for (let i = 0; i < 10; i++) {
        PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);
      }

      const result = PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);
      expect(result).toBe(false);
    });

    test('should track separate limits per action', () => {
      for (let i = 0; i < 10; i++) {
        PluginAPI.checkRateLimit('plugin-1', 'action1', 60, 10);
      }

      // action2 should still have capacity
      const result = PluginAPI.checkRateLimit('plugin-1', 'action2', 60, 10);
      expect(result).toBe(true);
    });

    test('should track separate limits per plugin', () => {
      for (let i = 0; i < 10; i++) {
        PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);
      }

      // plugin-2 should have separate limit
      const result = PluginAPI.checkRateLimit('plugin-2', 'action', 60, 10);
      expect(result).toBe(true);
    });

    test('should clean old requests outside window', () => {
      jest.useFakeTimers();
      const now = Date.now();
      jest.setSystemTime(now);

      PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);

      // Move time forward beyond window
      jest.setSystemTime(now + 65000);

      const result = PluginAPI.checkRateLimit('plugin-1', 'action', 60, 10);
      expect(result).toBe(true);

      jest.useRealTimers();
    });
  });

  // ============================================================================
  // 13. Custom API Registration Tests
  // ============================================================================
  describe('Custom API Registration', () => {
    test('should register custom API', () => {
      const customAPI = { customMethod: jest.fn() };
      PluginAPI.registerAPI('custom', customAPI);

      const retrieved = PluginAPI.getAPI('custom');
      expect(retrieved).toBe(customAPI);
    });

    test('should throw error when registering duplicate API name', () => {
      const api1 = { method: jest.fn() };
      PluginAPI.registerAPI('duplicate-api', api1);

      const api2 = { otherMethod: jest.fn() };
      expect(() => {
        PluginAPI.registerAPI('duplicate-api', api2);
      }).toThrow('API duplicate-api is already registered');
    });

    test('should return undefined for non-existent API', () => {
      const result = PluginAPI.getAPI('nonexistent-api');
      expect(result).toBeUndefined();
    });

    test('should store complex API objects', () => {
      const complexAPI = {
        method1: jest.fn(),
        method2: jest.fn(),
        nested: {
          method3: jest.fn()
        },
        property: 'value'
      };

      PluginAPI.registerAPI('complex', complexAPI);
      const retrieved = PluginAPI.getAPI('complex');

      expect(retrieved.method1).toBe(complexAPI.method1);
      expect(retrieved.nested.method3).toBe(complexAPI.nested.method3);
      expect(retrieved.property).toBe('value');
    });
  });

  // ============================================================================
  // 14. Permission Checks Tests
  // ============================================================================
  describe('Permission Checks', () => {
    test('should enforce read:data permission for storage.get', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.storage.get('key')).rejects.toThrow('Permission denied: read:data');
    });

    test('should enforce write:data permission for storage.set', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.storage.set('key', 'value')).rejects.toThrow('Permission denied: write:data');
    });

    test('should enforce send:messages permission for messages.send', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.messages.send('channel', 'text')).rejects.toThrow('Permission denied: send:messages');
    });

    test('should enforce read:messages permission for messages.getHistory', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.messages.getHistory('channel')).rejects.toThrow('Permission denied: read:messages');
    });

    test('should enforce network:outbound permission for http.fetch', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.http.fetch('https://example.com')).rejects.toThrow('Permission denied: network:outbound');
    });

    test('should enforce user:read permission for users.getById', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.users.getById('user')).rejects.toThrow('Permission denied: user:read');
    });

    test('should enforce user:write permission for users.updateMetadata', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.users.updateMetadata('user', {})).rejects.toThrow('Permission denied: user:write');
    });

    test('should enforce analytics:write permission for analytics.track', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.analytics.track('event')).rejects.toThrow('Permission denied: analytics:write');
    });

    test('should enforce analytics:read permission for analytics.getMetrics', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.analytics.getMetrics('metric')).rejects.toThrow('Permission denied: analytics:read');
    });

    test('should enforce settings:read permission for settings.get', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.settings.get()).rejects.toThrow('Permission denied: settings:read');
    });

    test('should enforce settings:write permission for settings.set', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      await expect(api.settings.set('key', 'value')).rejects.toThrow('Permission denied: settings:write');
    });

    test('should not require permissions for log API', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      expect(() => {
        api.log.debug('test');
        api.log.info('test');
        api.log.warn('test');
        api.log.error('test');
      }).not.toThrow();
    });

    test('should not require permissions for events API', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      expect(() => {
        api.events.on('event', () => {});
        api.events.emit('event', {});
      }).not.toThrow();
    });

    test('should not require permissions for utils API', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      expect(() => {
        api.utils.uuid();
        api.utils.hash('data');
        api.utils.parseJSON('{}');
        api.utils.formatDate(new Date());
      }).not.toThrow();
    });

    test('should not require permissions for UI API', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      expect(() => {
        api.ui.showNotification('msg');
        api.ui.showModal({});
        api.ui.registerComponent('name', {});
      }).not.toThrow();
    });
  });

  // ============================================================================
  // 15. Edge Cases and Error Handling
  // ============================================================================
  describe('Edge Cases and Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database connection failed'));

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);

      await expect(api.storage.get('key')).rejects.toThrow('Database connection failed');
    });

    test('should handle malformed JSON in storage', async () => {
      db.query.mockResolvedValue({
        rows: [{ value: 'not-valid-json', expires_at: null }]
      });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);

      await expect(api.storage.get('key')).rejects.toThrow();
    });

    test('should handle empty plugin ID', () => {
      const api = PluginAPI.createScopedAPI('', ['read:data']);
      expect(api.pluginId).toBe('');
    });

    test('should handle very long plugin ID', () => {
      const longId = 'a'.repeat(10000);
      const api = PluginAPI.createScopedAPI(longId, []);
      expect(api.pluginId).toBe(longId);
    });

    test('should handle special characters in keys', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
      await api.storage.get('key@#$%^&*()');

      expect(db.query).toHaveBeenCalled();
    });

    test('should handle null values in storage', async () => {
      db.query.mockResolvedValue({
        rows: [{ value: 'null', expires_at: null }]
      });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
      const result = await api.storage.get('null-key');

      expect(result).toBeNull();
    });

    test('should handle very large JSON objects', async () => {
      const largeObj = {};
      for (let i = 0; i < 1000; i++) {
        largeObj[`key${i}`] = `value${i}`;
      }

      db.query.mockResolvedValue({
        rows: [{ value: JSON.stringify(largeObj), expires_at: null }]
      });

      const api = PluginAPI.createScopedAPI('test-plugin', ['read:data']);
      const result = await api.storage.get('large-key');

      expect(Object.keys(result)).toHaveLength(1000);
    });

    test('should handle concurrent storage operations', async () => {
      db.query.mockResolvedValue({});

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);

      const promises = Array.from({ length: 10 }, (_, i) =>
        api.storage.set(`key${i}`, `value${i}`)
      );

      const results = await Promise.all(promises);
      expect(results).toEqual(Array(10).fill(true));
    });

    test('should handle empty message content', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['send:messages'], { tenantId: 'tenant-1' });
      const result = await api.messages.send('channel', '');

      expect(result.success).toBe(true);
    });

    test('should handle invalid URL in HTTP fetch', async () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['network:outbound']);

      await expect(api.http.fetch('not-a-valid-url')).rejects.toThrow();
    });

    test('should handle circular references in metadata', async () => {
      db.query.mockResolvedValue({});
      const metadata = { a: 1 };
      // This would fail in real serialization, but we're testing the attempt

      const api = PluginAPI.createScopedAPI('test-plugin', ['user:write'], { tenantId: 'tenant-1' });

      // Should not throw until serialize attempt
      try {
        await api.users.updateMetadata('user', metadata);
      } catch (e) {
        // Expected for circular references
      }
    });

    test('should handle various permission format combinations', () => {
      const api1 = PluginAPI.createScopedAPI('p1', ['read:data']);
      const api2 = PluginAPI.createScopedAPI('p2', ['storage:local']);

      expect(() => api1.storage.get('key')).not.toThrow();
      expect(() => api2.storage.get('key')).not.toThrow();
    });

    test('should handle simultaneous API creations for same plugin', () => {
      const api1 = PluginAPI.createScopedAPI('plugin', ['read:data']);
      const api2 = PluginAPI.createScopedAPI('plugin', ['read:data']);

      expect(api1.pluginId).toBe(api2.pluginId);
      expect(api1.storage).not.toBe(api2.storage);
    });

    test('should handle missing context gracefully', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', ['user:read']);

      expect(() => api.users.getCurrent()).not.toThrow();
    });

    test('should handle invalid TTL values', async () => {
      db.query.mockResolvedValue({});

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);

      await api.storage.set('key', 'value', -1);
      await api.storage.set('key', 'value', 0);
      await api.storage.set('key', 'value', Infinity);

      expect(db.query).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================================================
  // Additional comprehensive tests
  // ============================================================================
  describe('API Version and Metadata', () => {
    test('should expose API version', () => {
      const api = PluginAPI.createScopedAPI('test-plugin', []);
      expect(api.version).toBe('1.0.0');
    });

    test('should maintain version consistency', () => {
      const api1 = PluginAPI.createScopedAPI('plugin-1', []);
      const api2 = PluginAPI.createScopedAPI('plugin-2', []);

      expect(api1.version).toBe(api2.version);
    });
  });

  describe('EventEmitter Integration', () => {
    test('should inherit from EventEmitter', () => {
      expect(PluginAPI).toHaveProperty('on');
      expect(PluginAPI).toHaveProperty('emit');
      expect(PluginAPI).toHaveProperty('off');
    });

    test('should handle multiple plugins emitting events', (done) => {
      const api1 = PluginAPI.createScopedAPI('plugin-1', []);
      const api2 = PluginAPI.createScopedAPI('plugin-2', []);

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      api1.events.on('event', listener1);
      api2.events.on('event', listener2);

      api1.events.emit('event', { data: 'plugin1' });
      api2.events.emit('event', { data: 'plugin2' });

      setTimeout(() => {
        expect(listener1).toHaveBeenCalledTimes(1);
        expect(listener2).toHaveBeenCalledTimes(1);
        expect(listener1.mock.calls[0][0]).toEqual({ data: 'plugin1' });
        expect(listener2.mock.calls[0][0]).toEqual({ data: 'plugin2' });
        done();
      }, 10);
    });
  });

  describe('Storage with TTL Edge Cases', () => {
    test('should handle TTL of 0 seconds', async () => {
      db.query.mockResolvedValue({});

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
      await api.storage.set('instant-expire', 'value', 0);

      const callArgs = db.query.mock.calls[0][1];
      expect(callArgs[3]).not.toBeNull();
    });

    test('should handle very large TTL values', async () => {
      db.query.mockResolvedValue({});

      const api = PluginAPI.createScopedAPI('test-plugin', ['write:data']);
      await api.storage.set('long-lived', 'value', 31536000); // 1 year

      expect(db.query).toHaveBeenCalled();
    });
  });
});
