/**
 * PluginHooks - Event hook system for plugins
 * Provides lifecycle hooks and runtime event hooks
 */

const log = require('../../utils/logger');

class PluginHooks {
  constructor() {
    this.hooks = new Map();
    this.hookHistory = [];
    this.maxHistorySize = 1000;

    // Define available hooks
    this.availableHooks = {
      // Lifecycle hooks
      'beforeInstall': { async: true, description: 'Before plugin installation' },
      'afterInstall': { async: true, description: 'After plugin installation' },
      'beforeUninstall': { async: true, description: 'Before plugin uninstallation' },
      'afterUninstall': { async: true, description: 'After plugin uninstallation' },
      'beforeEnable': { async: true, description: 'Before plugin is enabled' },
      'afterEnable': { async: true, description: 'After plugin is enabled' },
      'beforeDisable': { async: true, description: 'Before plugin is disabled' },
      'afterDisable': { async: true, description: 'After plugin is disabled' },

      // Message hooks
      'onMessage': { async: true, description: 'When a message is received' },
      'beforeMessageProcess': { async: true, description: 'Before message processing' },
      'afterMessageProcess': { async: true, description: 'After message processing' },
      'onMessageSend': { async: true, description: 'When sending a message' },

      // Agent hooks
      'onAgentStart': { async: true, description: 'When agent starts execution' },
      'onAgentResponse': { async: true, description: 'When agent generates response' },
      'onAgentError': { async: true, description: 'When agent encounters error' },
      'onAgentComplete': { async: true, description: 'When agent completes execution' },
      'beforeAgentTool': { async: true, description: 'Before agent uses a tool' },
      'afterAgentTool': { async: true, description: 'After agent uses a tool' },

      // Flow hooks
      'onFlowStart': { async: true, description: 'When flow execution starts' },
      'onFlowEnd': { async: true, description: 'When flow execution ends' },
      'onFlowNodeEnter': { async: true, description: 'When entering a flow node' },
      'onFlowNodeExit': { async: true, description: 'When exiting a flow node' },
      'onFlowError': { async: true, description: 'When flow encounters error' },
      'onFlowBranch': { async: true, description: 'When flow branches' },

      // Bot hooks
      'onBotCreate': { async: true, description: 'When bot is created' },
      'onBotUpdate': { async: true, description: 'When bot is updated' },
      'onBotDelete': { async: true, description: 'When bot is deleted' },
      'onBotActivate': { async: true, description: 'When bot is activated' },
      'onBotDeactivate': { async: true, description: 'When bot is deactivated' },

      // User hooks
      'onUserCreate': { async: true, description: 'When user is created' },
      'onUserLogin': { async: true, description: 'When user logs in' },
      'onUserLogout': { async: true, description: 'When user logs out' },

      // Data hooks
      'onDataChange': { async: true, description: 'When data changes' },
      'beforeDataSave': { async: true, description: 'Before data is saved' },
      'afterDataSave': { async: true, description: 'After data is saved' }
    };
  }

  /**
   * Register a hook handler
   * @param {string} hookName - Name of the hook
   * @param {string} pluginId - Plugin ID
   * @param {function} handler - Handler function
   * @param {object} options - Handler options
   */
  register(hookName, pluginId, handler, options = {}) {
    if (!this.availableHooks[hookName]) {
      throw new Error(`Unknown hook: ${hookName}`);
    }

    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const hookHandler = {
      pluginId,
      handler,
      priority: options.priority || 10,
      once: options.once || false,
      enabled: true,
      registeredAt: new Date()
    };

    this.hooks.get(hookName).push(hookHandler);

    // Sort by priority
    this.hooks.get(hookName).sort((a, b) => a.priority - b.priority);

    log.info(`[PluginHooks] Registered ${hookName} handler for ${pluginId}`);
  }

  /**
   * Unregister hook handlers for a plugin
   * @param {string} pluginId - Plugin ID
   * @param {string} hookName - Optional specific hook name
   */
  unregister(pluginId, hookName = null) {
    if (hookName) {
      const handlers = this.hooks.get(hookName);
      if (handlers) {
        const filtered = handlers.filter(h => h.pluginId !== pluginId);
        this.hooks.set(hookName, filtered);
      }
    } else {
      // Unregister from all hooks
      for (const [name, handlers] of this.hooks.entries()) {
        const filtered = handlers.filter(h => h.pluginId !== pluginId);
        this.hooks.set(name, filtered);
      }
    }

    log.info(`[PluginHooks] Unregistered handlers for ${pluginId}`);
  }

  /**
   * Execute a hook
   * @param {string} hookName - Hook name
   * @param {object} context - Hook context
   * @returns {Promise<object>}
   */
  async execute(hookName, context = {}) {
    const handlers = this.hooks.get(hookName) || [];
    const hookDef = this.availableHooks[hookName];

    if (!hookDef) {
      log.warn(`[PluginHooks] Unknown hook: ${hookName}`);
      return context;
    }

    let result = { ...context };
    const executedHandlers = [];
    const errors = [];

    for (const hookHandler of handlers) {
      if (!hookHandler.enabled) continue;

      try {
        const startTime = Date.now();

        if (hookDef.async) {
          const handlerResult = await hookHandler.handler(result);
          if (handlerResult !== undefined) {
            result = { ...result, ...handlerResult };
          }
        } else {
          const handlerResult = hookHandler.handler(result);
          if (handlerResult !== undefined) {
            result = { ...result, ...handlerResult };
          }
        }

        executedHandlers.push({
          pluginId: hookHandler.pluginId,
          duration: Date.now() - startTime
        });

        // Remove if once
        if (hookHandler.once) {
          hookHandler.enabled = false;
        }
      } catch (error) {
        log.error(`[PluginHooks] Error in ${hookName} handler (${hookHandler.pluginId}):`, error.message);
        errors.push({
          pluginId: hookHandler.pluginId,
          error: error.message
        });
      }
    }

    // Record in history
    this.recordHookExecution(hookName, executedHandlers, errors);

    return result;
  }

  /**
   * Execute hook and allow cancellation
   * @param {string} hookName
   * @param {object} context
   * @returns {Promise<object>}
   */
  async executeWithCancel(hookName, context = {}) {
    const result = await this.execute(hookName, { ...context, cancelled: false });

    return {
      ...result,
      shouldProceed: !result.cancelled
    };
  }

  /**
   * Record hook execution in history
   * @param {string} hookName
   * @param {Array} handlers
   * @param {Array} errors
   */
  recordHookExecution(hookName, handlers, errors) {
    this.hookHistory.push({
      hookName,
      timestamp: new Date(),
      handlers,
      errors,
      success: errors.length === 0
    });

    // Trim history
    if (this.hookHistory.length > this.maxHistorySize) {
      this.hookHistory = this.hookHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get registered handlers for a hook
   * @param {string} hookName
   * @returns {Array}
   */
  getHandlers(hookName) {
    return this.hooks.get(hookName) || [];
  }

  /**
   * Get all available hooks
   * @returns {object}
   */
  getAvailableHooks() {
    return { ...this.availableHooks };
  }

  /**
   * Get hooks registered by a plugin
   * @param {string} pluginId
   * @returns {Array}
   */
  getPluginHooks(pluginId) {
    const pluginHooks = [];

    for (const [hookName, handlers] of this.hooks.entries()) {
      const pluginHandlers = handlers.filter(h => h.pluginId === pluginId);
      if (pluginHandlers.length > 0) {
        pluginHooks.push({
          hookName,
          handlers: pluginHandlers.length
        });
      }
    }

    return pluginHooks;
  }

  /**
   * Get hook execution history
   * @param {object} options
   * @returns {Array}
   */
  getHistory(options = {}) {
    let history = [...this.hookHistory];

    if (options.hookName) {
      history = history.filter(h => h.hookName === options.hookName);
    }

    if (options.pluginId) {
      history = history.filter(h =>
        h.handlers.some(handler => handler.pluginId === options.pluginId)
      );
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Check if hook has handlers
   * @param {string} hookName
   * @returns {boolean}
   */
  hasHandlers(hookName) {
    const handlers = this.hooks.get(hookName);
    return handlers && handlers.some(h => h.enabled);
  }

  /**
   * Enable/disable a handler
   * @param {string} hookName
   * @param {string} pluginId
   * @param {boolean} enabled
   */
  setHandlerEnabled(hookName, pluginId, enabled) {
    const handlers = this.hooks.get(hookName);
    if (handlers) {
      for (const handler of handlers) {
        if (handler.pluginId === pluginId) {
          handler.enabled = enabled;
        }
      }
    }
  }

  /**
   * Clear all hooks
   */
  clear() {
    this.hooks.clear();
    this.hookHistory = [];
  }
}

// Export singleton and hook names for convenience
const pluginHooks = new PluginHooks();

module.exports = pluginHooks;
module.exports.HOOKS = Object.keys(pluginHooks.availableHooks);
