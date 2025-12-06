/**
 * Plugin Registry - Core plugin management system
 */

const log = require('../../utils/logger');

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.hooks = new Map();
  }

  /**
   * Register a plugin
   * @param {object} plugin - Plugin configuration
   * @returns {boolean} - Success status
   */
  registerPlugin(plugin) {
    if (!plugin.id || !plugin.name) {
      throw new Error('Plugin must have id and name');
    }

    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin ${plugin.id} is already registered`);
    }

    const pluginInstance = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version || '1.0.0',
      description: plugin.description || '',
      author: plugin.author || 'Unknown',
      permissions: plugin.permissions || [],
      hooks: plugin.hooks || {},
      handlers: plugin.handlers || {},
      enabled: true,
      registeredAt: new Date()
    };

    this.plugins.set(plugin.id, pluginInstance);

    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, handler] of Object.entries(plugin.hooks)) {
        this.registerHook(plugin.id, hookName, handler);
      }
    }

    log.info(`[PluginRegistry] Registered plugin: ${plugin.name} v${pluginInstance.version}`);
    return true;
  }

  /**
   * Unregister a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} - Success status
   */
  unregisterPlugin(pluginId) {
    if (!this.plugins.has(pluginId)) {
      return false;
    }

    // Remove all hooks for this plugin
    for (const [hookName, handlers] of this.hooks.entries()) {
      const filtered = handlers.filter(h => h.pluginId !== pluginId);
      if (filtered.length > 0) {
        this.hooks.set(hookName, filtered);
      } else {
        this.hooks.delete(hookName);
      }
    }

    const plugin = this.plugins.get(pluginId);
    this.plugins.delete(pluginId);

    log.info(`[PluginRegistry] Unregistered plugin: ${plugin.name}`);
    return true;
  }

  /**
   * Get a plugin by ID
   * @param {string} pluginId - Plugin ID
   * @returns {object|null} - Plugin instance
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId) || null;
  }

  /**
   * Get all registered plugins
   * @returns {Array} - Array of plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Search plugins by query
   * @param {string} query - Search query
   * @returns {Array} - Matching plugins
   */
  searchPlugins(query) {
    const searchTerm = query.toLowerCase();
    return this.getAllPlugins().filter(plugin =>
      plugin.name.toLowerCase().includes(searchTerm) ||
      plugin.description.toLowerCase().includes(searchTerm) ||
      plugin.id.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Register a hook handler
   * @param {string} pluginId - Plugin ID
   * @param {string} hookName - Hook name
   * @param {function} handler - Handler function
   */
  registerHook(pluginId, hookName, handler) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    this.hooks.get(hookName).push({
      pluginId,
      handler,
      priority: handler.priority || 10
    });

    // Sort by priority
    this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);
  }

  /**
   * Execute a hook
   * @param {string} hookName - Hook name
   * @param {object} context - Hook context
   * @returns {Promise<object>} - Modified context
   */
  async executeHook(hookName, context = {}) {
    const handlers = this.hooks.get(hookName) || [];
    let result = context;

    for (const { pluginId, handler } of handlers) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.enabled) {
        try {
          result = await handler(result, plugin) || result;
        } catch (error) {
          log.error(`[PluginRegistry] Hook error in ${pluginId}:${hookName}:`, error.message);
        }
      }
    }

    return result;
  }

  /**
   * Enable a plugin
   * @param {string} pluginId - Plugin ID
   */
  enablePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = true;
    }
  }

  /**
   * Disable a plugin
   * @param {string} pluginId - Plugin ID
   */
  disablePlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.enabled = false;
    }
  }

  /**
   * Check if plugin is enabled
   * @param {string} pluginId - Plugin ID
   * @returns {boolean}
   */
  isEnabled(pluginId) {
    const plugin = this.plugins.get(pluginId);
    return plugin ? plugin.enabled : false;
  }

  /**
   * Get plugins by permission
   * @param {string} permission - Permission name
   * @returns {Array} - Plugins with that permission
   */
  getPluginsByPermission(permission) {
    return this.getAllPlugins().filter(plugin =>
      plugin.permissions.includes(permission)
    );
  }

  /**
   * Get plugin count
   * @returns {number}
   */
  getPluginCount() {
    return this.plugins.size;
  }

  /**
   * Clear all plugins
   */
  clear() {
    this.plugins.clear();
    this.hooks.clear();
  }
}

// Singleton instance
const pluginRegistry = new PluginRegistry();

module.exports = pluginRegistry;
