/**
 * IntegrationPlugin Tests
 * Tests for server/plugins/types/IntegrationPlugin.js
 */

jest.useFakeTimers();

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const IntegrationPlugin = require('../../../plugins/types/IntegrationPlugin');

describe('IntegrationPlugin', () => {
  let plugin;

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = new IntegrationPlugin({
      id: 'test-integration',
      name: 'Test Integration',
      integrationType: 'crm',
      syncInterval: 1800000
    });
  });

  afterEach(() => {
    plugin.stopAutoSync();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(plugin.integrationType).toBe('crm');
      expect(plugin.syncInterval).toBe(1800000);
      expect(plugin.connectionStatus).toBe('disconnected');
      expect(plugin.lastSyncAt).toBeNull();
      expect(plugin.credentials).toBeNull();
      expect(plugin.client).toBeNull();
      expect(plugin.syncTimer).toBeNull();
    });

    it('should use defaults for missing config', () => {
      const defaultPlugin = new IntegrationPlugin();
      expect(defaultPlugin.integrationType).toBe('generic');
      expect(defaultPlugin.syncInterval).toBe(3600000);
    });
  });

  describe('getType', () => {
    it('should return integration type', () => {
      expect(plugin.getType()).toBe('integration');
    });
  });

  describe('connect', () => {
    beforeEach(async () => {
      await plugin.install(1);
    });

    it('should throw error if plugin not enabled', async () => {
      plugin.enabled = false;
      await expect(plugin.connect({})).rejects.toThrow('Plugin is not enabled');
    });

    it('should connect successfully', async () => {
      plugin.doConnect = jest.fn().mockResolvedValue({ metadata: { version: '1.0' } });
      plugin.onConnected = jest.fn();

      const result = await plugin.connect({ apiKey: 'test' });

      expect(result.success).toBe(true);
      expect(result.status).toBe('connected');
      expect(result.metadata.version).toBe('1.0');
      expect(plugin.connectionStatus).toBe('connected');
      expect(plugin.credentials).toEqual({ apiKey: 'test' });
      expect(plugin.onConnected).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      plugin.doConnect = jest.fn().mockRejectedValue(new Error('Auth failed'));

      await expect(plugin.connect({})).rejects.toThrow('Auth failed');
      expect(plugin.connectionStatus).toBe('error');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({ apiKey: 'test' });
    });

    it('should disconnect successfully', async () => {
      plugin.doDisconnect = jest.fn().mockResolvedValue();
      plugin.onDisconnected = jest.fn();

      const result = await plugin.disconnect();

      expect(result).toBe(true);
      expect(plugin.connectionStatus).toBe('disconnected');
      expect(plugin.client).toBeNull();
      expect(plugin.onDisconnected).toHaveBeenCalled();
    });

    it('should stop auto sync on disconnect', async () => {
      plugin.startAutoSync();
      expect(plugin.syncTimer).not.toBeNull();

      await plugin.disconnect();

      expect(plugin.syncTimer).toBeNull();
    });

    it('should handle disconnect error', async () => {
      plugin.doDisconnect = jest.fn().mockRejectedValue(new Error('Disconnect failed'));

      await expect(plugin.disconnect()).rejects.toThrow('Disconnect failed');
    });
  });

  describe('sync', () => {
    beforeEach(async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({ apiKey: 'test' });
    });

    it('should throw error if not connected', async () => {
      plugin.connectionStatus = 'disconnected';
      await expect(plugin.sync()).rejects.toThrow('Not connected to service');
    });

    it('should sync data successfully', async () => {
      plugin.doSync = jest.fn().mockResolvedValue({
        recordsProcessed: 100,
        created: 20,
        updated: 30,
        deleted: 5
      });

      const result = await plugin.sync({ type: 'full' });

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(100);
      expect(result.created).toBe(20);
      expect(result.updated).toBe(30);
      expect(result.deleted).toBe(5);
      expect(plugin.lastSyncAt).toBeInstanceOf(Date);
    });

    it('should use incremental sync by default', async () => {
      plugin.doSync = jest.fn().mockResolvedValue({ recordsProcessed: 10 });

      await plugin.sync();

      expect(plugin.doSync).toHaveBeenCalledWith('full', null, {});
    });

    it('should handle sync errors', async () => {
      plugin.doSync = jest.fn().mockRejectedValue(new Error('Sync failed'));

      await expect(plugin.sync()).rejects.toThrow('Sync failed');
    });
  });

  describe('fetchData', () => {
    beforeEach(async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({ apiKey: 'test' });
    });

    it('should throw error if not connected', async () => {
      plugin.connectionStatus = 'disconnected';
      await expect(plugin.fetchData('contacts')).rejects.toThrow('Not connected');
    });

    it('should fetch data successfully', async () => {
      plugin.doFetchData = jest.fn().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        total: 100,
        hasMore: true
      });

      const result = await plugin.fetchData('contacts', { page: 1, limit: 2 });

      expect(result.success).toBe(true);
      expect(result.resource).toBe('contacts');
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it('should use default pagination options', async () => {
      plugin.doFetchData = jest.fn().mockResolvedValue({ data: [] });

      await plugin.fetchData('contacts');

      expect(plugin.doFetchData).toHaveBeenCalledWith('contacts', expect.objectContaining({
        page: 1,
        limit: 100,
        orderBy: 'created_at',
        orderDir: 'desc'
      }));
    });

    it('should handle fetch errors', async () => {
      plugin.doFetchData = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      await expect(plugin.fetchData('contacts')).rejects.toThrow('Fetch failed');
    });
  });

  describe('pushData', () => {
    beforeEach(async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({ apiKey: 'test' });
    });

    it('should throw error if not connected', async () => {
      plugin.connectionStatus = 'disconnected';
      await expect(plugin.pushData('contacts', {})).rejects.toThrow('Not connected');
    });

    it('should push single record', async () => {
      plugin.doPushData = jest.fn().mockResolvedValue({
        processed: 1,
        succeeded: [{ id: 1 }],
        failed: []
      });

      const result = await plugin.pushData('contacts', { name: 'Test' });

      expect(result.success).toBe(true);
      expect(result.operation).toBe('upsert');
      expect(result.processed).toBe(1);
    });

    it('should push multiple records', async () => {
      plugin.doPushData = jest.fn().mockResolvedValue({
        processed: 3,
        succeeded: [{ id: 1 }, { id: 2 }, { id: 3 }]
      });

      const result = await plugin.pushData('contacts', [
        { name: 'A' }, { name: 'B' }, { name: 'C' }
      ]);

      expect(result.processed).toBe(3);
    });

    it('should use specified operation', async () => {
      plugin.doPushData = jest.fn().mockResolvedValue({ processed: 1 });

      await plugin.pushData('contacts', { id: 1 }, { operation: 'delete' });

      expect(plugin.doPushData).toHaveBeenCalledWith(
        'contacts', [{ id: 1 }], 'delete', { operation: 'delete' }
      );
    });

    it('should handle push errors', async () => {
      plugin.doPushData = jest.fn().mockRejectedValue(new Error('Push failed'));

      await expect(plugin.pushData('contacts', {})).rejects.toThrow('Push failed');
    });
  });

  describe('startAutoSync', () => {
    beforeEach(async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({ apiKey: 'test' });
    });

    it('should start auto sync timer', () => {
      plugin.startAutoSync(60000);

      expect(plugin.syncTimer).not.toBeNull();
      expect(plugin.syncInterval).toBe(60000);
    });

    it('should stop existing timer before starting new one', () => {
      plugin.startAutoSync(60000);
      const firstTimer = plugin.syncTimer;

      plugin.startAutoSync(120000);

      expect(plugin.syncTimer).not.toBe(firstTimer);
      expect(plugin.syncInterval).toBe(120000);
    });

    it('should call sync on interval', async () => {
      plugin.doSync = jest.fn().mockResolvedValue({});
      plugin.startAutoSync(1000);

      jest.advanceTimersByTime(1000);

      expect(plugin.doSync).toHaveBeenCalled();
    });
  });

  describe('stopAutoSync', () => {
    it('should stop auto sync timer', async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({ apiKey: 'test' });
      plugin.startAutoSync();

      plugin.stopAutoSync();

      expect(plugin.syncTimer).toBeNull();
    });

    it('should do nothing if no timer', () => {
      expect(() => plugin.stopAutoSync()).not.toThrow();
    });
  });

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      plugin.doTestConnection = jest.fn().mockResolvedValue({
        latency: 50,
        metadata: { server: 'test' }
      });

      const result = await plugin.testConnection();

      expect(result.success).toBe(true);
      expect(result.status).toBe('ok');
      expect(result.latency).toBe(50);
    });

    it('should return error on failed connection', async () => {
      plugin.doTestConnection = jest.fn().mockRejectedValue(new Error('Timeout'));

      const result = await plugin.testConnection();

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toBe('Timeout');
    });
  });

  describe('abstract methods', () => {
    it('doConnect should throw error', async () => {
      await expect(plugin.doConnect({})).rejects.toThrow('doConnect must be implemented');
    });

    it('doDisconnect should be empty', async () => {
      await expect(plugin.doDisconnect()).resolves.toBeUndefined();
    });

    it('doSync should throw error', async () => {
      await expect(plugin.doSync('full', null, {})).rejects.toThrow('doSync must be implemented');
    });

    it('doFetchData should throw error', async () => {
      await expect(plugin.doFetchData('', {})).rejects.toThrow('doFetchData must be implemented');
    });

    it('doPushData should throw error', async () => {
      await expect(plugin.doPushData('', [], 'upsert', {})).rejects.toThrow('doPushData must be implemented');
    });

    it('doTestConnection should return default', async () => {
      const result = await plugin.doTestConnection();
      expect(result.latency).toBe(0);
    });
  });

  describe('getSupportedResources', () => {
    it('should return empty array by default', () => {
      expect(plugin.getSupportedResources()).toEqual([]);
    });
  });

  describe('getConnectionStatus', () => {
    it('should return current status', async () => {
      await plugin.install(1);
      plugin.doConnect = jest.fn().mockResolvedValue({});
      await plugin.connect({});
      plugin.startAutoSync();

      const status = plugin.getConnectionStatus();

      expect(status.status).toBe('connected');
      expect(status.autoSyncEnabled).toBe(true);
    });
  });

  describe('getSettingsSchema', () => {
    it('should return settings schema', () => {
      const schema = plugin.getSettingsSchema();

      expect(schema.apiKey).toBeDefined();
      expect(schema.baseUrl).toBeDefined();
      expect(schema.syncInterval).toBeDefined();
      expect(schema.syncInterval.options).toBeInstanceOf(Array);
    });
  });

  describe('event hooks', () => {
    it('should have empty default implementations', async () => {
      await expect(plugin.onConnected({})).resolves.toBeUndefined();
      await expect(plugin.onDisconnected()).resolves.toBeUndefined();
    });
  });
});
