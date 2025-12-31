/**
 * PluginAPI - Public API interface for plugins
 * Provides safe, controlled access to platform features
 */

const db = require('../../db');
const log = require('../../utils/logger');
const EventEmitter = require('events');

class PluginAPI extends EventEmitter {
  constructor() {
    super();
    this.registeredAPIs = new Map();
    this.rateLimits = new Map();
    this.apiVersion = '1.0.0';
  }

  /**
   * Create a scoped API instance for a plugin
   * @param {string} pluginId - Plugin ID
   * @param {Array} permissions - Granted permissions
   * @param {object} context - Plugin context
   */
  createScopedAPI(pluginId, permissions, context = {}) {
    const self = this;

    return {
      // Version info
      version: this.apiVersion,
      pluginId,

      // Data Storage API
      storage: this.createStorageAPI(pluginId, permissions),

      // Message API
      messages: this.createMessageAPI(pluginId, permissions, context),

      // HTTP API
      http: this.createHTTPAPI(pluginId, permissions),

      // User API
      users: this.createUserAPI(pluginId, permissions, context),

      // Analytics API
      analytics: this.createAnalyticsAPI(pluginId, permissions, context),

      // Settings API
      settings: this.createSettingsAPI(pluginId, permissions, context),

      // Logging API
      log: this.createLogAPI(pluginId),

      // Events API
      events: {
        on: (event, handler) => self.on(`plugin:${pluginId}:${event}`, handler),
        off: (event, handler) => self.off(`plugin:${pluginId}:${event}`, handler),
        emit: (event, data) => self.emit(`plugin:${pluginId}:${event}`, data)
      },

      // UI API (for frontend plugins)
      ui: this.createUIAPI(pluginId, permissions),

      // Utilities
      utils: this.createUtilsAPI()
    };
  }

  /**
   * Create Storage API
   */
  createStorageAPI(pluginId, permissions) {
    const hasRead = permissions.includes('read:data') || permissions.includes('storage:local');
    const hasWrite = permissions.includes('write:data') || permissions.includes('storage:local');

    return {
      get: async (key) => {
        if (!hasRead) throw new Error('Permission denied: read:data');
        return this.storageGet(pluginId, key);
      },

      set: async (key, value, ttl = null) => {
        if (!hasWrite) throw new Error('Permission denied: write:data');
        return this.storageSet(pluginId, key, value, ttl);
      },

      delete: async (key) => {
        if (!hasWrite) throw new Error('Permission denied: write:data');
        return this.storageDelete(pluginId, key);
      },

      list: async (prefix = '') => {
        if (!hasRead) throw new Error('Permission denied: read:data');
        return this.storageList(pluginId, prefix);
      },

      clear: async () => {
        if (!hasWrite) throw new Error('Permission denied: write:data');
        return this.storageClear(pluginId);
      }
    };
  }

  /**
   * Create Message API
   */
  createMessageAPI(pluginId, permissions, context) {
    const canRead = permissions.includes('read:messages');
    const canSend = permissions.includes('send:messages');

    return {
      send: async (channelId, message) => {
        if (!canSend) throw new Error('Permission denied: send:messages');
        return this.sendMessage(pluginId, channelId, message, context);
      },

      reply: async (messageId, response) => {
        if (!canSend) throw new Error('Permission denied: send:messages');
        return this.replyToMessage(pluginId, messageId, response, context);
      },

      getHistory: async (channelId, limit = 50) => {
        if (!canRead) throw new Error('Permission denied: read:messages');
        return this.getMessageHistory(pluginId, channelId, limit, context);
      }
    };
  }

  /**
   * Create HTTP API
   */
  createHTTPAPI(pluginId, permissions) {
    const canFetch = permissions.includes('network:outbound');

    return {
      fetch: async (url, options = {}) => {
        if (!canFetch) throw new Error('Permission denied: network:outbound');
        return this.safeFetch(pluginId, url, options);
      },

      get: async (url, options = {}) => {
        if (!canFetch) throw new Error('Permission denied: network:outbound');
        return this.safeFetch(pluginId, url, { ...options, method: 'GET' });
      },

      post: async (url, body, options = {}) => {
        if (!canFetch) throw new Error('Permission denied: network:outbound');
        return this.safeFetch(pluginId, url, { ...options, method: 'POST', body });
      }
    };
  }

  /**
   * Create User API
   */
  createUserAPI(pluginId, permissions, context) {
    const canRead = permissions.includes('user:read');
    const canWrite = permissions.includes('user:write');

    return {
      getCurrent: async () => {
        if (!canRead) throw new Error('Permission denied: user:read');
        return context.user || null;
      },

      getById: async (userId) => {
        if (!canRead) throw new Error('Permission denied: user:read');
        return this.getUserById(pluginId, userId, context);
      },

      updateMetadata: async (userId, metadata) => {
        if (!canWrite) throw new Error('Permission denied: user:write');
        return this.updateUserMetadata(pluginId, userId, metadata, context);
      }
    };
  }

  /**
   * Create Analytics API
   */
  createAnalyticsAPI(pluginId, permissions, context) {
    const canRead = permissions.includes('analytics:read');
    const canWrite = permissions.includes('analytics:write');

    return {
      track: async (event, properties = {}) => {
        if (!canWrite) throw new Error('Permission denied: analytics:write');
        return this.trackEvent(pluginId, event, properties, context);
      },

      getMetrics: async (metric, options = {}) => {
        if (!canRead) throw new Error('Permission denied: analytics:read');
        return this.getMetrics(pluginId, metric, options, context);
      }
    };
  }

  /**
   * Create Settings API
   */
  createSettingsAPI(pluginId, permissions, context) {
    const canRead = permissions.includes('settings:read');
    const canWrite = permissions.includes('settings:write');

    return {
      get: async (key = null) => {
        if (!canRead) throw new Error('Permission denied: settings:read');
        return this.getSettings(pluginId, key, context);
      },

      set: async (key, value) => {
        if (!canWrite) throw new Error('Permission denied: settings:write');
        return this.setSettings(pluginId, key, value, context);
      }
    };
  }

  /**
   * Create Log API
   */
  createLogAPI(pluginId) {
    const prefix = `[Plugin:${pluginId}]`;
    return {
      debug: (...args) => log.debug(prefix, ...args),
      info: (...args) => log.info(prefix, ...args),
      warn: (...args) => log.warn(prefix, ...args),
      error: (...args) => log.error(prefix, ...args)
    };
  }

  /**
   * Create UI API
   */
  createUIAPI(pluginId, permissions) {
    return {
      showNotification: (message, type = 'info') => {
        this.emit('ui:notification', { pluginId, message, type });
      },

      showModal: (config) => {
        this.emit('ui:modal', { pluginId, config });
      },

      registerComponent: (name, component) => {
        this.emit('ui:component', { pluginId, name, component });
      }
    };
  }

  /**
   * Create Utils API
   */
  createUtilsAPI() {
    return {
      uuid: () => require('crypto').randomUUID(),

      hash: (data, algorithm = 'sha256') => {
        const crypto = require('crypto');
        return crypto.createHash(algorithm).update(data).digest('hex');
      },

      encrypt: (data, key) => {
        const crypto = require('crypto');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      },

      decrypt: (encryptedData, key) => {
        const crypto = require('crypto');
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      },

      sleep: (ms) => new Promise(resolve => setTimeout(resolve, Math.min(ms, 30000))),

      parseJSON: (str, fallback = null) => {
        try {
          return JSON.parse(str);
        } catch {
          return fallback;
        }
      },

      formatDate: (date, format = 'ISO') => {
        const d = new Date(date);
        if (format === 'ISO') return d.toISOString();
        if (format === 'UTC') return d.toUTCString();
        return d.toLocaleString();
      }
    };
  }

  // Storage implementation
  async storageGet(pluginId, key) {
    const result = await db.query(
      `SELECT value, expires_at FROM plugin_storage
       WHERE plugin_id = $1 AND key = $2`,
      [pluginId, key]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      await this.storageDelete(pluginId, key);
      return null;
    }

    return JSON.parse(row.value);
  }

  async storageSet(pluginId, key, value, ttl) {
    const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;

    await db.query(
      `INSERT INTO plugin_storage (plugin_id, key, value, expires_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (plugin_id, key)
       DO UPDATE SET value = $3, expires_at = $4, updated_at = NOW()`,
      [pluginId, key, JSON.stringify(value), expiresAt]
    );

    return true;
  }

  async storageDelete(pluginId, key) {
    await db.query(
      'DELETE FROM plugin_storage WHERE plugin_id = $1 AND key = $2',
      [pluginId, key]
    );
    return true;
  }

  async storageList(pluginId, prefix) {
    const result = await db.query(
      `SELECT key FROM plugin_storage
       WHERE plugin_id = $1 AND key LIKE $2`,
      [pluginId, prefix + '%']
    );
    return result.rows.map(r => r.key);
  }

  async storageClear(pluginId) {
    await db.query(
      'DELETE FROM plugin_storage WHERE plugin_id = $1',
      [pluginId]
    );
    return true;
  }

  // Message implementation
  async sendMessage(pluginId, channelId, message, context) {
    // Rate limiting
    if (!this.checkRateLimit(pluginId, 'messages', 60, 100)) {
      throw new Error('Rate limit exceeded for messages');
    }

    // Log the action
    log.info(`[PluginAPI] Plugin ${pluginId} sending message to channel ${channelId}`);

    // Emit event for message handler
    this.emit('plugin:message:send', {
      pluginId,
      channelId,
      message,
      tenantId: context.tenantId
    });

    return { success: true, messageId: require('crypto').randomUUID() };
  }

  async replyToMessage(pluginId, messageId, response, context) {
    if (!this.checkRateLimit(pluginId, 'messages', 60, 100)) {
      throw new Error('Rate limit exceeded for messages');
    }

    this.emit('plugin:message:reply', {
      pluginId,
      messageId,
      response,
      tenantId: context.tenantId
    });

    return { success: true };
  }

  async getMessageHistory(pluginId, channelId, limit, context) {
    const result = await db.query(
      `SELECT id, content, sender, created_at
       FROM messages
       WHERE channel_id = $1 AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [channelId, context.tenantId, Math.min(limit, 100)]
    );

    return result.rows;
  }

  // HTTP implementation
  async safeFetch(pluginId, url, options) {
    // Rate limiting
    if (!this.checkRateLimit(pluginId, 'http', 60, 50)) {
      throw new Error('Rate limit exceeded for HTTP requests');
    }

    // Validate URL
    const parsedUrl = new URL(url);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
    if (blockedHosts.includes(parsedUrl.hostname)) {
      throw new Error('Access to internal hosts is not allowed');
    }

    try {
      const fetch = (await import('node-fetch')).default;
      const timeout = Math.min(options.timeout || 10000, 30000);

      const response = await fetch(url, {
        ...options,
        timeout,
        headers: {
          ...options.headers,
          'User-Agent': `BotBuilder-Plugin/${this.apiVersion}`
        }
      });

      return {
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers),
        json: () => response.json(),
        text: () => response.text()
      };
    } catch (error) {
      log.warn(`[PluginAPI] HTTP request failed for ${pluginId}:`, error.message);
      throw error;
    }
  }

  // User implementation
  async getUserById(pluginId, userId, context) {
    const result = await db.query(
      `SELECT id, username, email, created_at
       FROM users
       WHERE id = $1 AND current_organization_id = $2`,
      [userId, context.tenantId]
    );

    return result.rows[0] || null;
  }

  async updateUserMetadata(pluginId, userId, metadata, context) {
    await db.query(
      `UPDATE users
       SET metadata = metadata || $1::jsonb
       WHERE id = $2 AND current_organization_id = $3`,
      [JSON.stringify(metadata), userId, context.tenantId]
    );

    return { success: true };
  }

  // Analytics implementation
  async trackEvent(pluginId, event, properties, context) {
    await db.query(
      `INSERT INTO plugin_analytics
       (plugin_id, tenant_id, event_name, properties, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [pluginId, context.tenantId, event, JSON.stringify(properties)]
    );

    return { success: true };
  }

  async getMetrics(pluginId, metric, options, context) {
    const { startDate, endDate, groupBy } = options;

    let query = `
      SELECT
        COUNT(*) as count,
        ${groupBy ? `DATE_TRUNC('${groupBy}', created_at) as period` : ''}
      FROM plugin_analytics
      WHERE plugin_id = $1 AND tenant_id = $2 AND event_name = $3
    `;

    const params = [pluginId, context.tenantId, metric];

    if (startDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    if (groupBy) {
      query += ` GROUP BY period ORDER BY period`;
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  // Settings implementation
  async getSettings(pluginId, key, context) {
    const result = await db.query(
      'SELECT settings FROM plugin_installations WHERE plugin_id = $1 AND tenant_id = $2',
      [pluginId, context.tenantId]
    );

    if (result.rows.length === 0) return null;

    const settings = result.rows[0].settings || {};
    return key ? settings[key] : settings;
  }

  async setSettings(pluginId, key, value, context) {
    await db.query(
      `UPDATE plugin_installations
       SET settings = jsonb_set(COALESCE(settings, '{}'), $3, $4::jsonb)
       WHERE plugin_id = $1 AND tenant_id = $2`,
      [pluginId, context.tenantId, `{${key}}`, JSON.stringify(value)]
    );

    return { success: true };
  }

  // Rate limiting
  checkRateLimit(pluginId, action, windowSeconds, maxRequests) {
    const key = `${pluginId}:${action}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, []);
    }

    const requests = this.rateLimits.get(key);

    // Remove old requests
    const validRequests = requests.filter(t => t > windowStart);
    this.rateLimits.set(key, validRequests);

    if (validRequests.length >= maxRequests) {
      return false;
    }

    validRequests.push(now);
    return true;
  }

  /**
   * Register a custom API extension
   * @param {string} name - API name
   * @param {object} api - API methods
   */
  registerAPI(name, api) {
    if (this.registeredAPIs.has(name)) {
      throw new Error(`API ${name} is already registered`);
    }
    this.registeredAPIs.set(name, api);
  }

  /**
   * Get registered API
   * @param {string} name - API name
   */
  getAPI(name) {
    return this.registeredAPIs.get(name);
  }
}

module.exports = new PluginAPI();
