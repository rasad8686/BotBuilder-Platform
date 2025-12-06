/**
 * PluginSandbox - Secure execution environment for plugins
 * Provides isolation, permission validation, and resource limits
 */

const vm = require('vm');
const log = require('../../utils/logger');

class PluginSandbox {
  constructor(options = {}) {
    this.defaultTimeout = options.timeout || 5000;
    this.maxMemoryMB = options.maxMemoryMB || 128;
    this.allowedModules = options.allowedModules || [
      'crypto', 'util', 'url', 'querystring', 'path'
    ];
    // SECURITY: Comprehensive list of blocked dangerous modules
    this.blockedModules = options.blockedModules || [
      'fs', 'child_process', 'cluster', 'worker_threads',
      'net', 'dgram', 'dns', 'tls', 'http2',
      'vm', 'repl', 'inspector', 'v8', 'perf_hooks',
      'async_hooks', 'trace_events', 'process', 'os',
      'readline', 'stream', 'zlib', 'module', 'require'
    ];
    // SECURITY: Blocked global objects that could be used for sandbox escape
    this.blockedGlobals = [
      'process', 'global', 'globalThis', 'root', 'GLOBAL',
      'eval', 'Function', 'require', 'module', '__dirname', '__filename'
    ];
    this.permissionLevels = {
      'read:data': 1,
      'write:data': 2,
      'network:outbound': 3,
      'network:inbound': 4,
      'storage:local': 2,
      'storage:database': 3,
      'agent:execute': 3,
      'flow:modify': 3,
      'user:read': 2,
      'user:write': 4,
      'admin:settings': 5
    };
    this.executionStats = new Map();
  }

  /**
   * Execute code in sandbox
   * @param {string} code - Code to execute
   * @param {object} context - Execution context
   * @param {object} options - Execution options
   * @returns {Promise<object>}
   */
  async executeInSandbox(code, context = {}, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const pluginId = options.pluginId || 'unknown';

    // SECURITY: Validate code before execution
    const codeValidation = this.validateCode(code);
    if (!codeValidation.valid) {
      log.warn(`[PluginSandbox] Code validation failed for ${pluginId}:`, codeValidation.reason);
      return {
        success: false,
        error: `Security violation: ${codeValidation.reason}`,
        stats: { duration: 0 }
      };
    }

    // Create sandboxed context
    const sandbox = this.createSandbox(context, options);

    // Track execution
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Create VM context
      const vmContext = vm.createContext(sandbox, {
        name: `plugin-${pluginId}`,
        codeGeneration: {
          strings: false,
          wasm: false
        }
      });

      // Compile and run
      const script = new vm.Script(code, {
        filename: `${pluginId}.js`,
        timeout
      });

      const result = await script.runInContext(vmContext, {
        timeout,
        breakOnSigint: true
      });

      // Record stats
      this.recordExecution(pluginId, {
        success: true,
        duration: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory
      });

      return {
        success: true,
        result,
        stats: {
          duration: Date.now() - startTime,
          memoryUsed: process.memoryUsage().heapUsed - startMemory
        }
      };
    } catch (error) {
      this.recordExecution(pluginId, {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        stats: {
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Create sandboxed context
   * @param {object} context
   * @param {object} options
   * @returns {object}
   */
  createSandbox(context, options) {
    const permissions = options.permissions || [];

    // Safe globals
    const sandbox = {
      console: this.createSafeConsole(options.pluginId),
      setTimeout: this.createSafeTimeout(),
      setInterval: null, // Disabled
      setImmediate: null, // Disabled
      clearTimeout,
      Promise,
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      Buffer: this.hasPermission(permissions, 'storage:local') ? Buffer : undefined,

      // Plugin context
      context: { ...context },

      // Safe require
      require: this.createSafeRequire(permissions),

      // Plugin API
      api: this.createPluginAPI(context, permissions)
    };

    return sandbox;
  }

  /**
   * Create safe console
   * @param {string} pluginId
   * @returns {object}
   */
  createSafeConsole(pluginId) {
    const prefix = `[Plugin:${pluginId}]`;
    return {
      log: (...args) => log.info(prefix, ...args),
      info: (...args) => log.info(prefix, ...args),
      warn: (...args) => log.warn(prefix, ...args),
      error: (...args) => log.error(prefix, ...args),
      debug: (...args) => log.debug(prefix, ...args)
    };
  }

  /**
   * Create safe setTimeout
   * @returns {function}
   */
  createSafeTimeout() {
    const maxDelay = 30000;
    return (callback, delay, ...args) => {
      const safeDelay = Math.min(delay || 0, maxDelay);
      return setTimeout(callback, safeDelay, ...args);
    };
  }

  /**
   * Create safe require function
   * @param {Array} permissions
   * @returns {function}
   */
  createSafeRequire(permissions) {
    return (moduleName) => {
      if (this.blockedModules.includes(moduleName)) {
        throw new Error(`Module '${moduleName}' is not allowed`);
      }

      if (moduleName === 'http' || moduleName === 'https') {
        if (!this.hasPermission(permissions, 'network:outbound')) {
          throw new Error(`Permission denied: network:outbound required for ${moduleName}`);
        }
      }

      if (this.allowedModules.includes(moduleName)) {
        return require(moduleName);
      }

      throw new Error(`Module '${moduleName}' is not allowed`);
    };
  }

  /**
   * Create plugin API
   * @param {object} context
   * @param {Array} permissions
   * @returns {object}
   */
  createPluginAPI(context, permissions) {
    return {
      // Data access
      getData: this.hasPermission(permissions, 'read:data')
        ? async (key) => context.data?.[key]
        : () => { throw new Error('Permission denied: read:data'); },

      setData: this.hasPermission(permissions, 'write:data')
        ? async (key, value) => { context.data = context.data || {}; context.data[key] = value; }
        : () => { throw new Error('Permission denied: write:data'); },

      // HTTP requests
      fetch: this.hasPermission(permissions, 'network:outbound')
        ? this.createSafeFetch()
        : () => { throw new Error('Permission denied: network:outbound'); },

      // Logging
      log: (level, message, meta) => {
        log.info(`[Plugin:${context.pluginId}] [${level}]`, message, meta || '');
      }
    };
  }

  /**
   * Create safe fetch function
   * @returns {function}
   */
  createSafeFetch() {
    return async (url, options = {}) => {
      const fetch = (await import('node-fetch')).default;

      // Limit timeout
      const timeout = Math.min(options.timeout || 10000, 30000);

      // Block internal URLs
      const parsedUrl = new URL(url);
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (blockedHosts.includes(parsedUrl.hostname)) {
        throw new Error('Access to internal hosts is not allowed');
      }

      return fetch(url, {
        ...options,
        timeout,
        headers: {
          ...options.headers,
          'User-Agent': 'BotBuilder-Plugin/1.0'
        }
      });
    };
  }

  /**
   * SECURITY: Validate code for dangerous patterns before execution
   * @param {string} code - Code to validate
   * @returns {object} - { valid: boolean, reason?: string }
   */
  validateCode(code) {
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /process\s*\.\s*(exit|kill|abort)/gi, reason: 'Process manipulation not allowed' },
      { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/gi, reason: 'child_process module not allowed' },
      { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/gi, reason: 'fs module not allowed' },
      { pattern: /require\s*\(\s*['"`]vm['"`]\s*\)/gi, reason: 'vm module not allowed' },
      { pattern: /\beval\s*\(/gi, reason: 'eval() not allowed' },
      { pattern: /new\s+Function\s*\(/gi, reason: 'new Function() not allowed' },
      { pattern: /constructor\s*\[\s*['"`]constructor['"`]\s*\]/gi, reason: 'Constructor access not allowed' },
      { pattern: /__proto__/gi, reason: '__proto__ access not allowed' },
      { pattern: /prototype\s*\.\s*constructor/gi, reason: 'Prototype manipulation not allowed' },
      { pattern: /globalThis/gi, reason: 'globalThis access not allowed' },
      { pattern: /Reflect\s*\.\s*(defineProperty|setPrototypeOf)/gi, reason: 'Reflect manipulation not allowed' },
      { pattern: /Object\s*\.\s*(setPrototypeOf|defineProperty)/gi, reason: 'Object prototype manipulation not allowed' }
    ];

    for (const { pattern, reason } of dangerousPatterns) {
      if (pattern.test(code)) {
        return { valid: false, reason };
      }
    }

    // Check code length limit (prevent DoS)
    if (code.length > 1000000) { // 1MB limit
      return { valid: false, reason: 'Code exceeds maximum size limit (1MB)' };
    }

    return { valid: true };
  }

  /**
   * Validate plugin permissions
   * @param {Array} requiredPermissions - Permissions required
   * @param {Array} grantedPermissions - Permissions granted to plugin
   * @returns {object}
   */
  validatePermissions(requiredPermissions, grantedPermissions) {
    const missing = [];
    const denied = [];

    for (const perm of requiredPermissions) {
      if (!grantedPermissions.includes(perm)) {
        missing.push(perm);
        if (this.permissionLevels[perm] >= 4) {
          denied.push(perm);
        }
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      denied,
      message: missing.length > 0
        ? `Missing permissions: ${missing.join(', ')}`
        : 'All permissions granted'
    };
  }

  /**
   * Check if permission is granted
   * @param {Array} permissions
   * @param {string} permission
   * @returns {boolean}
   */
  hasPermission(permissions, permission) {
    return permissions.includes(permission) || permissions.includes('*');
  }

  /**
   * Record execution stats
   * @param {string} pluginId
   * @param {object} stats
   */
  recordExecution(pluginId, stats) {
    if (!this.executionStats.has(pluginId)) {
      this.executionStats.set(pluginId, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalDuration: 0,
        averageDuration: 0,
        lastExecution: null
      });
    }

    const pluginStats = this.executionStats.get(pluginId);
    pluginStats.totalExecutions++;
    pluginStats.totalDuration += stats.duration;
    pluginStats.averageDuration = pluginStats.totalDuration / pluginStats.totalExecutions;
    pluginStats.lastExecution = new Date();

    if (stats.success) {
      pluginStats.successfulExecutions++;
    } else {
      pluginStats.failedExecutions++;
    }
  }

  /**
   * Get execution stats for a plugin
   * @param {string} pluginId
   * @returns {object}
   */
  getStats(pluginId) {
    return this.executionStats.get(pluginId) || null;
  }

  /**
   * Get all execution stats
   * @returns {object}
   */
  getAllStats() {
    const stats = {};
    for (const [id, s] of this.executionStats.entries()) {
      stats[id] = s;
    }
    return stats;
  }

  /**
   * Reset stats for a plugin
   * @param {string} pluginId
   */
  resetStats(pluginId) {
    this.executionStats.delete(pluginId);
  }
}

module.exports = new PluginSandbox();
