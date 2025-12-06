/**
 * IntegrationPlugin - Base class for CRM, ERP, Database integrations
 * Supports data sync, webhooks, and bi-directional data flow
 */

const BasePlugin = require('./BasePlugin');
const log = require('../../utils/logger');

class IntegrationPlugin extends BasePlugin {
  constructor(config = {}) {
    super(config);
    this.integrationType = config.integrationType || 'generic';
    this.connectionStatus = 'disconnected';
    this.lastSyncAt = null;
    this.syncInterval = config.syncInterval || 3600000; // 1 hour
    this.credentials = null;
    this.client = null;
    this.syncTimer = null;
  }

  /**
   * Get plugin type
   * @returns {string}
   */
  getType() {
    return 'integration';
  }

  /**
   * Connect to the external service
   * @param {object} credentials - Connection credentials
   * @returns {Promise<object>}
   */
  async connect(credentials) {
    if (!this.isEnabled()) {
      throw new Error('Plugin is not enabled');
    }

    this.credentials = credentials;

    try {
      const result = await this.doConnect(credentials);
      this.connectionStatus = 'connected';
      await this.onConnected(result);

      return {
        success: true,
        status: 'connected',
        metadata: result.metadata || {}
      };
    } catch (error) {
      this.connectionStatus = 'error';
      log.error(`[${this.name}] Connection error:`, error.message);
      throw error;
    }
  }

  /**
   * Disconnect from the external service
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    try {
      await this.doDisconnect();
      this.connectionStatus = 'disconnected';
      this.client = null;
      this.stopAutoSync();
      await this.onDisconnected();
      return true;
    } catch (error) {
      log.error(`[${this.name}] Disconnect error:`, error.message);
      throw error;
    }
  }

  /**
   * Sync data with the external service
   * @param {object} options - Sync options
   * @returns {Promise<object>}
   */
  async sync(options = {}) {
    if (this.connectionStatus !== 'connected') {
      throw new Error('Not connected to service');
    }

    const syncType = options.type || 'full';
    const since = options.since || this.lastSyncAt;

    try {
      const result = await this.doSync(syncType, since, options);
      this.lastSyncAt = new Date();

      return {
        success: true,
        syncedAt: this.lastSyncAt,
        recordsProcessed: result.recordsProcessed || 0,
        created: result.created || 0,
        updated: result.updated || 0,
        deleted: result.deleted || 0,
        errors: result.errors || []
      };
    } catch (error) {
      log.error(`[${this.name}] Sync error:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch data from the external service
   * @param {string} resource - Resource type to fetch
   * @param {object} options - Fetch options (filters, pagination)
   * @returns {Promise<object>}
   */
  async fetchData(resource, options = {}) {
    if (this.connectionStatus !== 'connected') {
      throw new Error('Not connected to service');
    }

    const {
      filters = {},
      page = 1,
      limit = 100,
      orderBy = 'created_at',
      orderDir = 'desc'
    } = options;

    try {
      const result = await this.doFetchData(resource, {
        filters,
        page,
        limit,
        orderBy,
        orderDir
      });

      return {
        success: true,
        resource,
        data: result.data || [],
        total: result.total || result.data?.length || 0,
        page,
        limit,
        hasMore: result.hasMore || false
      };
    } catch (error) {
      log.error(`[${this.name}] Fetch error:`, error.message);
      throw error;
    }
  }

  /**
   * Push data to the external service
   * @param {string} resource - Resource type
   * @param {object|Array} data - Data to push
   * @param {object} options - Push options
   * @returns {Promise<object>}
   */
  async pushData(resource, data, options = {}) {
    if (this.connectionStatus !== 'connected') {
      throw new Error('Not connected to service');
    }

    const records = Array.isArray(data) ? data : [data];
    const operation = options.operation || 'upsert';

    try {
      const result = await this.doPushData(resource, records, operation, options);

      return {
        success: true,
        resource,
        operation,
        processed: result.processed || records.length,
        succeeded: result.succeeded || [],
        failed: result.failed || []
      };
    } catch (error) {
      log.error(`[${this.name}] Push error:`, error.message);
      throw error;
    }
  }

  /**
   * Start automatic sync
   * @param {number} interval - Sync interval in ms
   */
  startAutoSync(interval) {
    this.stopAutoSync();
    this.syncInterval = interval || this.syncInterval;

    this.syncTimer = setInterval(async () => {
      try {
        await this.sync({ type: 'incremental' });
      } catch (error) {
        log.error(`[${this.name}] Auto-sync error:`, error.message);
      }
    }, this.syncInterval);

    log.info(`[${this.name}] Auto-sync started (interval: ${this.syncInterval}ms)`);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      log.info(`[${this.name}] Auto-sync stopped`);
    }
  }

  /**
   * Test the connection
   * @returns {Promise<object>}
   */
  async testConnection() {
    try {
      const result = await this.doTestConnection();
      return {
        success: true,
        status: 'ok',
        latency: result.latency,
        metadata: result.metadata || {}
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  // Implement in subclass
  async doConnect(credentials) {
    throw new Error('doConnect must be implemented in subclass');
  }

  async doDisconnect() {}

  async doSync(type, since, options) {
    throw new Error('doSync must be implemented in subclass');
  }

  async doFetchData(resource, options) {
    throw new Error('doFetchData must be implemented in subclass');
  }

  async doPushData(resource, records, operation, options) {
    throw new Error('doPushData must be implemented in subclass');
  }

  async doTestConnection() {
    return { latency: 0 };
  }

  // Event hooks
  async onConnected(result) {}
  async onDisconnected() {}

  /**
   * Get supported resources
   * @returns {Array}
   */
  getSupportedResources() {
    return [];
  }

  /**
   * Get connection status
   * @returns {object}
   */
  getConnectionStatus() {
    return {
      status: this.connectionStatus,
      lastSyncAt: this.lastSyncAt,
      autoSyncEnabled: !!this.syncTimer
    };
  }

  /**
   * Get settings schema
   * @returns {object}
   */
  getSettingsSchema() {
    return {
      apiKey: {
        type: 'password',
        label: 'API Key',
        required: true
      },
      baseUrl: {
        type: 'text',
        label: 'API URL',
        required: false
      },
      syncInterval: {
        type: 'select',
        label: 'Sync Interval',
        options: [
          { value: 900000, label: '15 minutes' },
          { value: 1800000, label: '30 minutes' },
          { value: 3600000, label: '1 hour' },
          { value: 86400000, label: '24 hours' }
        ],
        default: 3600000
      }
    };
  }
}

module.exports = IntegrationPlugin;
