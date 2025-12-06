/**
 * PluginLoader - Load, unload, and manage plugin lifecycle
 */

const path = require('path');
const fs = require('fs').promises;
const pluginRegistry = require('./PluginRegistry');
const log = require('../../utils/logger');

class PluginLoader {
  constructor() {
    this.loadedPlugins = new Map();
    this.pluginPaths = new Map();
    this.dependencyGraph = new Map();
  }

  /**
   * Load a plugin from file or directory
   * @param {string} pluginPath - Path to plugin file or directory
   * @param {object} options - Load options
   * @returns {Promise<object>}
   */
  async loadPlugin(pluginPath, options = {}) {
    const absolutePath = path.resolve(pluginPath);

    try {
      // Check if plugin exists
      const stats = await fs.stat(absolutePath);
      let mainFile = absolutePath;

      // If directory, look for index.js or package.json
      if (stats.isDirectory()) {
        mainFile = await this.resolvePluginEntry(absolutePath);
      }

      // Check if already loaded
      const existingPlugin = this.getPluginByPath(mainFile);
      if (existingPlugin && !options.force) {
        throw new Error(`Plugin already loaded: ${existingPlugin.id}`);
      }

      // Clear require cache for hot reload
      if (options.force) {
        this.clearRequireCache(mainFile);
      }

      // Load the plugin module
      const PluginClass = require(mainFile);
      const plugin = typeof PluginClass === 'function'
        ? new PluginClass(options.config || {})
        : PluginClass;

      // Validate plugin structure
      this.validatePlugin(plugin);

      // Resolve dependencies
      await this.resolveDependencies(plugin);

      // Initialize plugin
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize();
      }

      // Register with registry
      pluginRegistry.registerPlugin(plugin);

      // Store plugin info
      this.loadedPlugins.set(plugin.id, plugin);
      this.pluginPaths.set(plugin.id, mainFile);

      log.info(`[PluginLoader] Loaded plugin: ${plugin.name} v${plugin.version}`);

      return {
        success: true,
        plugin: {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          type: plugin.getType ? plugin.getType() : 'unknown'
        }
      };
    } catch (error) {
      log.error(`[PluginLoader] Failed to load plugin:`, error.message);
      throw error;
    }
  }

  /**
   * Unload a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<boolean>}
   */
  async unloadPlugin(pluginId) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    try {
      // Check for dependent plugins
      const dependents = this.getDependentPlugins(pluginId);
      if (dependents.length > 0) {
        throw new Error(`Cannot unload: plugins depend on this: ${dependents.join(', ')}`);
      }

      // Call shutdown hook
      if (typeof plugin.shutdown === 'function') {
        await plugin.shutdown();
      }

      // Unregister from registry
      pluginRegistry.unregisterPlugin(pluginId);

      // Clear from cache
      const pluginPath = this.pluginPaths.get(pluginId);
      if (pluginPath) {
        this.clearRequireCache(pluginPath);
      }

      // Remove from maps
      this.loadedPlugins.delete(pluginId);
      this.pluginPaths.delete(pluginId);
      this.dependencyGraph.delete(pluginId);

      log.info(`[PluginLoader] Unloaded plugin: ${pluginId}`);
      return true;
    } catch (error) {
      log.error(`[PluginLoader] Failed to unload plugin:`, error.message);
      throw error;
    }
  }

  /**
   * Reload a plugin
   * @param {string} pluginId - Plugin ID
   * @returns {Promise<object>}
   */
  async reloadPlugin(pluginId) {
    const pluginPath = this.pluginPaths.get(pluginId);
    if (!pluginPath) {
      throw new Error(`Plugin path not found: ${pluginId}`);
    }

    const plugin = this.loadedPlugins.get(pluginId);
    const config = plugin?.settings || {};

    // Unload
    await this.unloadPlugin(pluginId);

    // Reload
    return this.loadPlugin(pluginPath, { force: true, config });
  }

  /**
   * Resolve plugin entry point
   * @param {string} dirPath - Plugin directory
   * @returns {Promise<string>}
   */
  async resolvePluginEntry(dirPath) {
    // Check for package.json
    const packagePath = path.join(dirPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      if (packageJson.main) {
        return path.join(dirPath, packageJson.main);
      }
    } catch (e) {
      // No package.json
    }

    // Check for index.js
    const indexPath = path.join(dirPath, 'index.js');
    try {
      await fs.access(indexPath);
      return indexPath;
    } catch (e) {
      // No index.js
    }

    // Check for plugin.js
    const pluginPath = path.join(dirPath, 'plugin.js');
    try {
      await fs.access(pluginPath);
      return pluginPath;
    } catch (e) {
      throw new Error(`No entry point found in ${dirPath}`);
    }
  }

  /**
   * Validate plugin structure
   * @param {object} plugin
   */
  validatePlugin(plugin) {
    if (!plugin.id) {
      throw new Error('Plugin must have an id');
    }
    if (!plugin.name) {
      throw new Error('Plugin must have a name');
    }
    if (!plugin.version) {
      plugin.version = '1.0.0';
    }
  }

  /**
   * Resolve and load plugin dependencies
   * @param {object} plugin
   */
  async resolveDependencies(plugin) {
    const dependencies = plugin.getDependencies ? plugin.getDependencies() : [];
    this.dependencyGraph.set(plugin.id, dependencies);

    for (const dep of dependencies) {
      const depId = typeof dep === 'string' ? dep : dep.id;
      const depVersion = typeof dep === 'object' ? dep.version : null;

      if (!this.loadedPlugins.has(depId)) {
        throw new Error(`Missing dependency: ${depId}${depVersion ? ` v${depVersion}` : ''}`);
      }

      // Version check
      if (depVersion) {
        const loadedDep = this.loadedPlugins.get(depId);
        if (!this.checkVersion(loadedDep.version, depVersion)) {
          throw new Error(`Dependency version mismatch: ${depId} requires ${depVersion}`);
        }
      }
    }
  }

  /**
   * Get plugins that depend on a given plugin
   * @param {string} pluginId
   * @returns {Array}
   */
  getDependentPlugins(pluginId) {
    const dependents = [];
    for (const [id, deps] of this.dependencyGraph.entries()) {
      if (deps.some(d => (typeof d === 'string' ? d : d.id) === pluginId)) {
        dependents.push(id);
      }
    }
    return dependents;
  }

  /**
   * Check version compatibility
   * @param {string} actual
   * @param {string} required
   * @returns {boolean}
   */
  checkVersion(actual, required) {
    // Simple semver check
    const actualParts = actual.split('.').map(Number);
    const requiredParts = required.replace(/[^0-9.]/g, '').split('.').map(Number);

    if (required.startsWith('^')) {
      return actualParts[0] === requiredParts[0] && actualParts[1] >= requiredParts[1];
    }
    if (required.startsWith('~')) {
      return actualParts[0] === requiredParts[0] && actualParts[1] === requiredParts[1];
    }
    return actual === required;
  }

  /**
   * Clear require cache for a module
   * @param {string} modulePath
   */
  clearRequireCache(modulePath) {
    const resolved = require.resolve(modulePath);
    delete require.cache[resolved];

    // Clear child modules
    Object.keys(require.cache).forEach(key => {
      if (key.startsWith(path.dirname(resolved))) {
        delete require.cache[key];
      }
    });
  }

  /**
   * Get plugin by path
   * @param {string} pluginPath
   * @returns {object|null}
   */
  getPluginByPath(pluginPath) {
    for (const [id, p] of this.pluginPaths.entries()) {
      if (p === pluginPath) {
        return this.loadedPlugins.get(id);
      }
    }
    return null;
  }

  /**
   * Get all loaded plugins
   * @returns {Array}
   */
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Check if plugin is loaded
   * @param {string} pluginId
   * @returns {boolean}
   */
  isLoaded(pluginId) {
    return this.loadedPlugins.has(pluginId);
  }
}

module.exports = new PluginLoader();
