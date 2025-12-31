/**
 * PluginManager - Unified plugin management service
 * Coordinates plugin lifecycle, installation, updates, and configuration
 */

const pluginRegistry = require('./PluginRegistry');
const pluginLoader = require('./PluginLoader');
const pluginSandbox = require('./PluginSandbox');
const pluginHooks = require('./PluginHooks');
const Plugin = require('../../models/Plugin');
const PluginInstallation = require('../../models/PluginInstallation');
const log = require('../../utils/logger');
const db = require('../../db');

class PluginManager {
  constructor() {
    this.initialized = false;
    this.startupPlugins = [];
    this.pluginConfigs = new Map();
    this.pluginStates = new Map();
  }

  /**
   * Initialize plugin manager
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      log.info('[PluginManager] Initializing plugin system...');

      // Load system plugins
      await this.loadSystemPlugins();

      // Register event handlers
      this.registerEventHandlers();

      this.initialized = true;
      log.info('[PluginManager] Plugin system initialized successfully');
    } catch (error) {
      log.error('[PluginManager] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Load system/core plugins
   */
  async loadSystemPlugins() {
    const systemPlugins = [
      // Add paths to system plugins if any
    ];

    for (const pluginPath of systemPlugins) {
      try {
        await pluginLoader.loadPlugin(pluginPath);
      } catch (error) {
        log.warn(`[PluginManager] Failed to load system plugin: ${pluginPath}`, error.message);
      }
    }
  }

  /**
   * Register event handlers for plugin lifecycle
   */
  registerEventHandlers() {
    pluginHooks.on('plugin:installed', this.onPluginInstalled.bind(this));
    pluginHooks.on('plugin:uninstalled', this.onPluginUninstalled.bind(this));
    pluginHooks.on('plugin:enabled', this.onPluginEnabled.bind(this));
    pluginHooks.on('plugin:disabled', this.onPluginDisabled.bind(this));
    pluginHooks.on('plugin:error', this.onPluginError.bind(this));
  }

  /**
   * Install a plugin for a tenant
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   * @param {object} options - Installation options
   */
  async installPlugin(pluginId, tenantId, options = {}) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // Get plugin details
      const plugin = await Plugin.findById(pluginId);
      if (!plugin) {
        throw new Error('Plugin not found');
      }

      if (plugin.status !== 'published') {
        throw new Error('Plugin is not available for installation');
      }

      // Check if already installed
      const isInstalled = await PluginInstallation.isInstalled(pluginId, tenantId);
      if (isInstalled) {
        throw new Error('Plugin is already installed');
      }

      // Validate permissions
      if (options.validatePermissions !== false) {
        const permissionCheck = pluginSandbox.validatePermissions(
          plugin.permissions || [],
          options.grantedPermissions || []
        );

        if (!permissionCheck.valid && permissionCheck.denied.length > 0) {
          throw new Error(`Dangerous permissions required: ${permissionCheck.denied.join(', ')}`);
        }
      }

      // Create installation record
      const installation = await PluginInstallation.install(
        pluginId,
        tenantId,
        plugin.version,
        options.settings || {}
      );

      // Update download count
      await Plugin.incrementDownloads(pluginId);

      // Load plugin if autoLoad is enabled
      if (options.autoLoad !== false && plugin.manifest?.main) {
        try {
          await this.loadInstalledPlugin(plugin, installation);
        } catch (loadError) {
          log.warn(`[PluginManager] Plugin installed but failed to load:`, loadError.message);
        }
      }

      await client.query('COMMIT');

      // Emit event
      pluginHooks.emit('plugin:installed', {
        pluginId,
        tenantId,
        plugin,
        installation
      });

      log.info(`[PluginManager] Installed plugin ${plugin.name} for tenant ${tenantId}`);

      return {
        success: true,
        installation,
        plugin: {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      log.error('[PluginManager] Install failed:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Uninstall a plugin
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   */
  async uninstallPlugin(pluginId, tenantId) {
    try {
      // Get installation
      const installation = await PluginInstallation.getInstallation(pluginId, tenantId);
      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      // Get plugin details
      const plugin = await Plugin.findById(pluginId);

      // Unload plugin if loaded
      const runtimeId = `${pluginId}_${tenantId}`;
      if (pluginLoader.isLoaded(runtimeId)) {
        await pluginLoader.unloadPlugin(runtimeId);
      }

      // Remove installation
      await PluginInstallation.uninstall(pluginId, tenantId);

      // Clear cached config
      this.pluginConfigs.delete(runtimeId);
      this.pluginStates.delete(runtimeId);

      // Emit event
      pluginHooks.emit('plugin:uninstalled', {
        pluginId,
        tenantId,
        plugin
      });

      log.info(`[PluginManager] Uninstalled plugin ${pluginId} for tenant ${tenantId}`);

      return { success: true };
    } catch (error) {
      log.error('[PluginManager] Uninstall failed:', error.message);
      throw error;
    }
  }

  /**
   * Enable a plugin
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   */
  async enablePlugin(pluginId, tenantId) {
    try {
      const installation = await PluginInstallation.getInstallation(pluginId, tenantId);
      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      await PluginInstallation.enable(pluginId, tenantId);

      const runtimeId = `${pluginId}_${tenantId}`;
      pluginRegistry.enablePlugin(runtimeId);

      this.pluginStates.set(runtimeId, 'enabled');

      pluginHooks.emit('plugin:enabled', { pluginId, tenantId });

      return { success: true };
    } catch (error) {
      log.error('[PluginManager] Enable failed:', error.message);
      throw error;
    }
  }

  /**
   * Disable a plugin
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   */
  async disablePlugin(pluginId, tenantId) {
    try {
      const installation = await PluginInstallation.getInstallation(pluginId, tenantId);
      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      await PluginInstallation.disable(pluginId, tenantId);

      const runtimeId = `${pluginId}_${tenantId}`;
      pluginRegistry.disablePlugin(runtimeId);

      this.pluginStates.set(runtimeId, 'disabled');

      pluginHooks.emit('plugin:disabled', { pluginId, tenantId });

      return { success: true };
    } catch (error) {
      log.error('[PluginManager] Disable failed:', error.message);
      throw error;
    }
  }

  /**
   * Update plugin settings
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   * @param {object} settings - New settings
   */
  async updatePluginSettings(pluginId, tenantId, settings) {
    try {
      const installation = await PluginInstallation.getInstallation(pluginId, tenantId);
      if (!installation) {
        throw new Error('Plugin is not installed');
      }

      // Validate settings against schema
      const plugin = await Plugin.findById(pluginId);
      if (plugin.manifest?.config) {
        this.validateSettings(settings, plugin.manifest.config);
      }

      // Update settings
      const updated = await PluginInstallation.updateSettings(pluginId, tenantId, settings);

      // Update cached config
      const runtimeId = `${pluginId}_${tenantId}`;
      this.pluginConfigs.set(runtimeId, settings);

      return updated;
    } catch (error) {
      log.error('[PluginManager] Settings update failed:', error.message);
      throw error;
    }
  }

  /**
   * Get plugin settings
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   */
  async getPluginSettings(pluginId, tenantId) {
    const runtimeId = `${pluginId}_${tenantId}`;

    // Check cache
    if (this.pluginConfigs.has(runtimeId)) {
      return this.pluginConfigs.get(runtimeId);
    }

    const installation = await PluginInstallation.getInstallation(pluginId, tenantId);
    if (!installation) {
      return null;
    }

    const settings = installation.settings || {};
    this.pluginConfigs.set(runtimeId, settings);

    return settings;
  }

  /**
   * Validate settings against schema
   * @param {object} settings - Settings to validate
   * @param {object} schema - Settings schema
   */
  validateSettings(settings, schema) {
    for (const [key, config] of Object.entries(schema)) {
      if (config.required && (settings[key] === undefined || settings[key] === null)) {
        throw new Error(`Required setting missing: ${key}`);
      }

      if (settings[key] !== undefined) {
        const value = settings[key];
        const type = config.type;

        if (type === 'string' && typeof value !== 'string') {
          throw new Error(`Setting ${key} must be a string`);
        }
        if (type === 'number' && typeof value !== 'number') {
          throw new Error(`Setting ${key} must be a number`);
        }
        if (type === 'boolean' && typeof value !== 'boolean') {
          throw new Error(`Setting ${key} must be a boolean`);
        }
        if (type === 'array' && !Array.isArray(value)) {
          throw new Error(`Setting ${key} must be an array`);
        }

        if (config.enum && !config.enum.includes(value)) {
          throw new Error(`Setting ${key} must be one of: ${config.enum.join(', ')}`);
        }

        if (config.min !== undefined && value < config.min) {
          throw new Error(`Setting ${key} must be at least ${config.min}`);
        }

        if (config.max !== undefined && value > config.max) {
          throw new Error(`Setting ${key} must be at most ${config.max}`);
        }
      }
    }
  }

  /**
   * Load an installed plugin into runtime
   * @param {object} plugin - Plugin data
   * @param {object} installation - Installation data
   */
  async loadInstalledPlugin(plugin, installation) {
    const runtimeId = `${plugin.id}_${installation.tenant_id}`;

    // Load plugin with tenant-specific config
    await pluginLoader.loadPlugin(plugin.manifest.main, {
      config: installation.settings,
      pluginId: runtimeId
    });

    this.pluginStates.set(runtimeId, 'loaded');
  }

  /**
   * Execute plugin code in sandbox
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   * @param {string} code - Code to execute
   * @param {object} context - Execution context
   */
  async executePluginCode(pluginId, tenantId, code, context = {}) {
    const plugin = await Plugin.findById(pluginId);
    if (!plugin) {
      throw new Error('Plugin not found');
    }

    const installation = await PluginInstallation.getInstallation(pluginId, tenantId);
    if (!installation || !installation.is_active) {
      throw new Error('Plugin is not installed or not active');
    }

    return pluginSandbox.executeInSandbox(code, context, {
      pluginId: `${pluginId}_${tenantId}`,
      permissions: plugin.permissions || [],
      timeout: 5000
    });
  }

  /**
   * Get installed plugins for tenant
   * @param {number} tenantId - Tenant/Organization ID
   */
  async getInstalledPlugins(tenantId) {
    return PluginInstallation.getByTenant(tenantId);
  }

  /**
   * Get plugin statistics
   * @param {number} pluginId - Plugin ID
   */
  async getPluginStats(pluginId) {
    const result = await db.query(
      `SELECT
        COUNT(DISTINCT pi.tenant_id) as install_count,
        COUNT(DISTINCT CASE WHEN pi.is_active THEN pi.tenant_id END) as active_count,
        COALESCE(AVG(pr.rating), 0) as avg_rating,
        COUNT(pr.id) as review_count
       FROM plugins p
       LEFT JOIN plugin_installations pi ON p.id = pi.plugin_id
       LEFT JOIN plugin_reviews pr ON p.id = pr.plugin_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [pluginId]
    );

    return result.rows[0] || {
      install_count: 0,
      active_count: 0,
      avg_rating: 0,
      review_count: 0
    };
  }

  /**
   * Check plugin health
   * @param {number} pluginId - Plugin ID
   * @param {number} tenantId - Tenant/Organization ID
   */
  async checkPluginHealth(pluginId, tenantId) {
    const runtimeId = `${pluginId}_${tenantId}`;
    const stats = pluginSandbox.getStats(runtimeId);

    return {
      isLoaded: pluginLoader.isLoaded(runtimeId),
      isEnabled: pluginRegistry.isEnabled(runtimeId),
      state: this.pluginStates.get(runtimeId) || 'unknown',
      executionStats: stats || null
    };
  }

  // Event handlers
  onPluginInstalled(data) {
    log.debug('[PluginManager] Plugin installed event:', data.pluginId);
  }

  onPluginUninstalled(data) {
    log.debug('[PluginManager] Plugin uninstalled event:', data.pluginId);
  }

  onPluginEnabled(data) {
    log.debug('[PluginManager] Plugin enabled event:', data.pluginId);
  }

  onPluginDisabled(data) {
    log.debug('[PluginManager] Plugin disabled event:', data.pluginId);
  }

  onPluginError(data) {
    log.error('[PluginManager] Plugin error event:', data.error);
  }

  /**
   * Shutdown plugin manager
   */
  async shutdown() {
    log.info('[PluginManager] Shutting down plugin system...');

    // Unload all plugins
    const loadedPlugins = pluginLoader.getLoadedPlugins();
    for (const plugin of loadedPlugins) {
      try {
        await pluginLoader.unloadPlugin(plugin.id);
      } catch (error) {
        log.warn(`[PluginManager] Error unloading plugin ${plugin.id}:`, error.message);
      }
    }

    this.pluginConfigs.clear();
    this.pluginStates.clear();
    this.initialized = false;

    log.info('[PluginManager] Plugin system shut down');
  }
}

module.exports = new PluginManager();
