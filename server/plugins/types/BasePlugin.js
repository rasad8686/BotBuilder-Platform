/**
 * BasePlugin - Base class for all plugins
 */

const log = require('../../utils/logger');

class BasePlugin {
  constructor(config = {}) {
    this.id = config.id || this.constructor.name;
    this.name = config.name || 'Unnamed Plugin';
    this.version = config.version || '1.0.0';
    this.description = config.description || '';
    this.author = config.author || 'Unknown';
    this.permissions = config.permissions || [];
    this.settings = config.settings || {};
    this.enabled = false;
    this.installed = false;
    this.tenantId = null;
  }

  /**
   * Install the plugin for a tenant
   * @param {number} tenantId - Tenant ID
   * @param {object} options - Installation options
   * @returns {Promise<boolean>}
   */
  async install(tenantId, options = {}) {
    this.tenantId = tenantId;
    this.settings = { ...this.settings, ...options };

    try {
      await this.onInstall(tenantId, options);
      this.installed = true;
      this.enabled = true;
      log.info(`[${this.name}] Installed for tenant ${tenantId}`);
      return true;
    } catch (error) {
      log.error(`[${this.name}] Installation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Uninstall the plugin
   * @param {number} tenantId - Tenant ID
   * @returns {Promise<boolean>}
   */
  async uninstall(tenantId) {
    try {
      await this.onUninstall(tenantId);
      this.installed = false;
      this.enabled = false;
      this.tenantId = null;
      log.info(`[${this.name}] Uninstalled for tenant ${tenantId}`);
      return true;
    } catch (error) {
      log.error(`[${this.name}] Uninstallation failed:`, error.message);
      throw error;
    }
  }

  /**
   * Configure the plugin
   * @param {object} settings - New settings
   * @returns {Promise<object>}
   */
  async configure(settings) {
    const validated = await this.validateSettings(settings);
    this.settings = { ...this.settings, ...validated };
    await this.onConfigure(this.settings);
    return this.settings;
  }

  /**
   * Get plugin manifest
   * @returns {object}
   */
  getManifest() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      permissions: this.permissions,
      type: this.getType(),
      settings: this.getSettingsSchema(),
      hooks: this.getHooks(),
      dependencies: this.getDependencies()
    };
  }

  /**
   * Get plugin type
   * @returns {string}
   */
  getType() {
    return 'base';
  }

  /**
   * Get settings schema for UI
   * @returns {object}
   */
  getSettingsSchema() {
    return {};
  }

  /**
   * Get available hooks
   * @returns {Array}
   */
  getHooks() {
    return [];
  }

  /**
   * Get plugin dependencies
   * @returns {Array}
   */
  getDependencies() {
    return [];
  }

  /**
   * Validate settings
   * @param {object} settings
   * @returns {Promise<object>}
   */
  async validateSettings(settings) {
    return settings;
  }

  /**
   * Enable the plugin
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable the plugin
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if plugin is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled && this.installed;
  }

  // Lifecycle hooks - override in subclasses
  async onInstall(tenantId, options) {}
  async onUninstall(tenantId) {}
  async onConfigure(settings) {}
  async onEnable() {}
  async onDisable() {}
}

module.exports = BasePlugin;
