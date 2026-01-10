/**
 * BotBuilder A/B Test SDK
 * Client-side SDK for A/B testing integration
 */

import { ABTestEngine } from './ABTestEngine';
import { EventEmitter } from './utils/events';
import { getVisitorId, setVisitorId, getCachedAssignment, cacheAssignment, clearAssignments } from './utils/storage';

class ABTestSDK {
  constructor() {
    this.config = null;
    this.visitorId = null;
    this.userId = null;
    this.userTraits = {};
    this.assignments = new Map();
    this.eventEmitter = new EventEmitter();
    this.engine = null;
    this.initialized = false;
    this.pendingConversions = [];
  }

  /**
   * Initialize the SDK
   * @param {Object} config - Configuration object
   * @param {string} config.workspaceId - Workspace ID (required)
   * @param {string} [config.userId] - User ID (optional)
   * @param {string} [config.visitorId] - Visitor ID (optional, auto-generated)
   * @param {string} [config.apiUrl] - API URL (defaults to production)
   * @param {boolean} [config.debug] - Enable debug mode
   * @returns {ABTestSDK}
   */
  init(config) {
    if (this.initialized) {
      this._log('warn', 'SDK already initialized');
      return this;
    }

    if (!config.workspaceId) {
      throw new Error('[ABTestSDK] workspaceId is required');
    }

    this.config = {
      workspaceId: config.workspaceId,
      userId: config.userId || null,
      visitorId: config.visitorId || getVisitorId(),
      apiUrl: config.apiUrl || 'https://api.botbuilder.app',
      debug: config.debug || false,
    };

    // Save visitor ID
    this.visitorId = this.config.visitorId;
    setVisitorId(this.visitorId);

    if (this.config.userId) {
      this.userId = this.config.userId;
    }

    // Initialize engine
    this.engine = new ABTestEngine(this);

    this.initialized = true;
    this._log('info', 'SDK initialized', this.config);
    this.eventEmitter.emit('sdk:initialized', { config: this.config });

    // Process pending conversions
    this._processPendingConversions();

    return this;
  }

  /**
   * Identify a user
   * @param {string} userId - User ID
   * @param {Object} [traits] - User traits for targeting
   * @returns {ABTestSDK}
   */
  identify(userId, traits = {}) {
    if (!this.initialized) {
      throw new Error('[ABTestSDK] SDK not initialized. Call init() first.');
    }

    this.userId = userId;
    this.userTraits = { ...this.userTraits, ...traits };

    this._log('info', 'User identified', { userId, traits: this.userTraits });
    this.eventEmitter.emit('user:identified', { userId, traits: this.userTraits });

    return this;
  }

  /**
   * Get variant for a test
   * @param {string} testId - Test ID
   * @param {Object} [options] - Options
   * @param {boolean} [options.forceRefresh] - Force refresh from API
   * @returns {Promise<Object>} - { variantId, variantName, content, testId }
   */
  async getVariant(testId, options = {}) {
    if (!this.initialized) {
      throw new Error('[ABTestSDK] SDK not initialized. Call init() first.');
    }

    const { forceRefresh = false } = options;

    // Check memory cache first
    if (!forceRefresh && this.assignments.has(testId)) {
      const cached = this.assignments.get(testId);
      this._log('debug', 'Variant from memory cache', cached);
      return cached;
    }

    // Check localStorage cache
    if (!forceRefresh) {
      const localCached = getCachedAssignment(testId);
      if (localCached) {
        this.assignments.set(testId, localCached);
        this._log('debug', 'Variant from localStorage cache', localCached);
        return localCached;
      }
    }

    // Fetch from API
    try {
      const result = await this.engine.assignVariant(testId);

      if (result && result.variantId) {
        const assignment = {
          testId,
          variantId: result.variantId,
          variantName: result.variantName,
          content: result.content || {},
          assignedAt: new Date().toISOString(),
        };

        // Cache assignment
        this.assignments.set(testId, assignment);
        cacheAssignment(testId, assignment);

        this._log('info', 'Variant assigned', assignment);
        this.eventEmitter.emit('variant:assigned', assignment);

        return assignment;
      }

      return null;
    } catch (error) {
      this._log('error', 'Failed to get variant', { testId, error: error.message });
      this.eventEmitter.emit('error', { type: 'variant_assignment', testId, error });
      throw error;
    }
  }

  /**
   * Track a conversion event
   * @param {string} testId - Test ID
   * @param {Object} [options] - Conversion options
   * @param {string} [options.type='goal'] - Conversion type
   * @param {number} [options.value] - Conversion value (for revenue tracking)
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Promise<boolean>}
   */
  async trackConversion(testId, options = {}) {
    const { type = 'goal', value, metadata } = options;

    if (!this.initialized) {
      // Queue conversion for later
      this.pendingConversions.push({ testId, type, value, metadata, timestamp: Date.now() });
      this._log('warn', 'SDK not initialized, conversion queued');
      return false;
    }

    try {
      const result = await this.engine.trackConversion(testId, {
        type,
        value,
        metadata,
        variantId: this.assignments.get(testId)?.variantId,
      });

      this._log('info', 'Conversion tracked', { testId, type, value });
      this.eventEmitter.emit('conversion:tracked', { testId, type, value, metadata });

      return result.success;
    } catch (error) {
      this._log('error', 'Failed to track conversion', { testId, error: error.message });
      this.eventEmitter.emit('error', { type: 'conversion_tracking', testId, error });
      return false;
    }
  }

  /**
   * Get all active tests for the workspace
   * @returns {Promise<Array>}
   */
  async getActiveTests() {
    if (!this.initialized) {
      throw new Error('[ABTestSDK] SDK not initialized. Call init() first.');
    }

    try {
      const tests = await this.engine.getActiveTests();
      this._log('info', 'Active tests fetched', { count: tests.length });
      return tests;
    } catch (error) {
      this._log('error', 'Failed to get active tests', { error: error.message });
      return [];
    }
  }

  /**
   * Get current assignment for a test (from cache only)
   * @param {string} testId - Test ID
   * @returns {Object|null}
   */
  getAssignment(testId) {
    return this.assignments.get(testId) || getCachedAssignment(testId) || null;
  }

  /**
   * Get all current assignments
   * @returns {Object}
   */
  getAllAssignments() {
    const result = {};
    this.assignments.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * Clear cached assignments
   * @param {string} [testId] - Specific test ID, or all if not provided
   */
  clearAssignments(testId) {
    if (testId) {
      this.assignments.delete(testId);
    } else {
      this.assignments.clear();
      clearAssignments();
    }
    this._log('info', 'Assignments cleared', { testId: testId || 'all' });
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    return this.eventEmitter.on(event, callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    this.eventEmitter.off(event, callback);
  }

  /**
   * Get SDK state
   * @returns {Object}
   */
  getState() {
    return {
      initialized: this.initialized,
      visitorId: this.visitorId,
      userId: this.userId,
      assignmentCount: this.assignments.size,
      config: this.config ? {
        workspaceId: this.config.workspaceId,
        apiUrl: this.config.apiUrl,
      } : null,
    };
  }

  /**
   * Destroy SDK instance
   */
  destroy() {
    this.assignments.clear();
    this.eventEmitter.removeAllListeners();
    this.config = null;
    this.engine = null;
    this.initialized = false;
    this._log('info', 'SDK destroyed');
  }

  // Private methods

  _log(level, message, data = null) {
    if (this.config?.debug || level === 'error') {
      const prefix = '[ABTestSDK]';
      if (data) {
        console[level](`${prefix} ${message}`, data);
      } else {
        console[level](`${prefix} ${message}`);
      }
    }
  }

  async _processPendingConversions() {
    if (this.pendingConversions.length === 0) return;

    const pending = [...this.pendingConversions];
    this.pendingConversions = [];

    for (const conversion of pending) {
      // Only process conversions from last 30 minutes
      if (Date.now() - conversion.timestamp < 30 * 60 * 1000) {
        await this.trackConversion(conversion.testId, {
          type: conversion.type,
          value: conversion.value,
          metadata: conversion.metadata,
        });
      }
    }
  }
}

// Export singleton instance
const instance = new ABTestSDK();

// Export for UMD
if (typeof window !== 'undefined') {
  window.BotBuilderABTest = instance;
}

export default instance;
export { ABTestSDK };
