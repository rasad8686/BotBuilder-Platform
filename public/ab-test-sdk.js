/**
 * BotBuilder A/B Test SDK - Standalone Build
 * For use via script tag on customer websites
 *
 * Usage:
 * <script src="https://cdn.botbuilder.app/ab-test-sdk.js"></script>
 * <script>
 *   BotBuilderABTest.init({ workspaceId: 'ws_xxx' });
 *   const variant = await BotBuilderABTest.getVariant('test_123');
 * </script>
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? (module.exports = factory())
    : typeof define === 'function' && define.amd
      ? define(factory)
      : ((global = typeof globalThis !== 'undefined' ? globalThis : global || self),
        (global.BotBuilderABTest = factory()));
})(this, function () {
  'use strict';

  // Storage utilities
  const STORAGE_PREFIX = 'bb_ab_';
  const VISITOR_ID_KEY = `${STORAGE_PREFIX}visitor_id`;
  const ASSIGNMENT_PREFIX = `${STORAGE_PREFIX}assignment_`;

  function generateVisitorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `v_${timestamp}_${random}`;
  }

  function getVisitorId() {
    try {
      let visitorId = localStorage.getItem(VISITOR_ID_KEY);
      if (!visitorId) {
        visitorId = generateVisitorId();
        localStorage.setItem(VISITOR_ID_KEY, visitorId);
      }
      return visitorId;
    } catch (e) {
      return generateVisitorId();
    }
  }

  function setVisitorId(id) {
    try {
      localStorage.setItem(VISITOR_ID_KEY, id);
    } catch (e) {
      console.warn('[ABTestSDK] Could not save visitor ID');
    }
  }

  function getCachedAssignment(testId) {
    try {
      const cached = localStorage.getItem(`${ASSIGNMENT_PREFIX}${testId}`);
      if (!cached) return null;
      const data = JSON.parse(cached);
      // Check expiry (24 hours)
      if (data.cachedAt && Date.now() - data.cachedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`${ASSIGNMENT_PREFIX}${testId}`);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function cacheAssignment(testId, assignment) {
    try {
      localStorage.setItem(
        `${ASSIGNMENT_PREFIX}${testId}`,
        JSON.stringify({ ...assignment, cachedAt: Date.now() })
      );
    } catch (e) {
      console.warn('[ABTestSDK] Could not cache assignment');
    }
  }

  function clearAssignments() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(ASSIGNMENT_PREFIX))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[ABTestSDK] Could not clear assignments');
    }
  }

  // Event emitter
  class EventEmitter {
    constructor() {
      this.events = {};
    }

    on(event, callback) {
      if (!this.events[event]) this.events[event] = [];
      this.events[event].push(callback);
      return () => this.off(event, callback);
    }

    off(event, callback) {
      if (!this.events[event]) return;
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    }

    emit(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('[ABTestSDK] Event handler error:', e);
        }
      });
    }

    removeAllListeners() {
      this.events = {};
    }
  }

  // API helpers
  async function apiRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[ABTestSDK] API request failed:', error);
      throw error;
    }
  }

  // Main SDK class
  class ABTestSDK {
    constructor() {
      this.config = null;
      this.visitorId = null;
      this.userId = null;
      this.userTraits = {};
      this.assignments = new Map();
      this.eventEmitter = new EventEmitter();
      this.initialized = false;
      this.debug = false;
    }

    /**
     * Initialize the SDK
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
      };

      this.visitorId = this.config.visitorId;
      this.userId = this.config.userId;
      this.debug = config.debug || false;

      setVisitorId(this.visitorId);

      this.initialized = true;
      this._log('info', 'SDK initialized', this.config);
      this.eventEmitter.emit('sdk:initialized', { config: this.config });

      return this;
    }

    /**
     * Identify user
     */
    identify(userId, traits = {}) {
      this._checkInit();
      this.userId = userId;
      this.userTraits = { ...this.userTraits, ...traits };
      this._log('info', 'User identified', { userId, traits });
      this.eventEmitter.emit('user:identified', { userId, traits });
      return this;
    }

    /**
     * Get variant for a test
     */
    async getVariant(testId, options = {}) {
      this._checkInit();

      const { forceRefresh = false } = options;

      // Check cache
      if (!forceRefresh) {
        if (this.assignments.has(testId)) {
          return this.assignments.get(testId);
        }
        const cached = getCachedAssignment(testId);
        if (cached) {
          this.assignments.set(testId, cached);
          return cached;
        }
      }

      // Fetch from API
      try {
        const result = await apiRequest(`${this.config.apiUrl}/api/public/ab-tests/assign`, {
          method: 'POST',
          body: JSON.stringify({
            testId,
            workspaceId: this.config.workspaceId,
            visitorId: this.visitorId,
            userId: this.userId,
            traits: this.userTraits,
            context: this._getContext(),
          }),
        });

        if (result && result.variantId) {
          const assignment = {
            testId,
            variantId: result.variantId,
            variantName: result.variantName,
            content: result.content || {},
            assignedAt: new Date().toISOString(),
          };

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
     * Track conversion
     */
    async trackConversion(testId, options = {}) {
      const { type = 'goal', value, metadata } = options;

      if (!this.initialized) {
        this._log('warn', 'SDK not initialized, cannot track conversion');
        return false;
      }

      const data = {
        testId,
        workspaceId: this.config.workspaceId,
        visitorId: this.visitorId,
        userId: this.userId,
        type,
        value,
        variantId: this.assignments.get(testId)?.variantId,
        metadata,
        timestamp: new Date().toISOString(),
        context: this._getContext(),
      };

      // Use sendBeacon if page is being unloaded
      if (navigator.sendBeacon && document.visibilityState === 'hidden') {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(`${this.config.apiUrl}/api/public/ab-tests/convert`, blob);
        return true;
      }

      try {
        await apiRequest(`${this.config.apiUrl}/api/public/ab-tests/convert`, {
          method: 'POST',
          body: JSON.stringify(data),
        });

        this._log('info', 'Conversion tracked', { testId, type });
        this.eventEmitter.emit('conversion:tracked', { testId, type, value });

        return true;
      } catch (error) {
        this._log('error', 'Failed to track conversion', { testId, error: error.message });
        return false;
      }
    }

    /**
     * Get active tests
     */
    async getActiveTests() {
      this._checkInit();

      try {
        const params = new URLSearchParams({
          workspaceId: this.config.workspaceId,
          visitorId: this.visitorId,
        });
        if (this.userId) params.append('userId', this.userId);

        const result = await apiRequest(
          `${this.config.apiUrl}/api/public/ab-tests?${params.toString()}`
        );
        return result.tests || [];
      } catch (error) {
        this._log('error', 'Failed to get active tests');
        return [];
      }
    }

    /**
     * Get assignment from cache
     */
    getAssignment(testId) {
      return this.assignments.get(testId) || getCachedAssignment(testId) || null;
    }

    /**
     * Get all assignments
     */
    getAllAssignments() {
      const result = {};
      this.assignments.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }

    /**
     * Clear assignments
     */
    clearAssignments(testId) {
      if (testId) {
        this.assignments.delete(testId);
      } else {
        this.assignments.clear();
        clearAssignments();
      }
    }

    /**
     * Add event listener
     */
    on(event, callback) {
      return this.eventEmitter.on(event, callback);
    }

    /**
     * Remove event listener
     */
    off(event, callback) {
      this.eventEmitter.off(event, callback);
    }

    /**
     * Get SDK state
     */
    getState() {
      return {
        initialized: this.initialized,
        visitorId: this.visitorId,
        userId: this.userId,
        assignmentCount: this.assignments.size,
      };
    }

    /**
     * Destroy SDK
     */
    destroy() {
      this.assignments.clear();
      this.eventEmitter.removeAllListeners();
      this.config = null;
      this.initialized = false;
    }

    // Private methods

    _checkInit() {
      if (!this.initialized) {
        throw new Error('[ABTestSDK] SDK not initialized. Call init() first.');
      }
    }

    _log(level, message, data) {
      if (this.debug || level === 'error') {
        if (data) {
          console[level](`[ABTestSDK] ${message}`, data);
        } else {
          console[level](`[ABTestSDK] ${message}`);
        }
      }
    }

    _getContext() {
      return {
        url: window.location.href,
        pathname: window.location.pathname,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        language: navigator.language,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Create and return singleton instance
  return new ABTestSDK();
});
