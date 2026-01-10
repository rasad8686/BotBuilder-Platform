/**
 * Event Emitter
 * Simple event emitter for SDK events
 */

export class EventEmitter {
  constructor() {
    this._events = {};
    this._onceEvents = {};
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {this}
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this._events[event]) {
      this._events[event] = [];
    }

    this._events[event].push(callback);
    return this;
  }

  /**
   * Add a one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {this}
   */
  once(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this._onceEvents[event]) {
      this._onceEvents[event] = [];
    }

    this._onceEvents[event].push(callback);
    return this;
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   * @returns {this}
   */
  off(event, callback) {
    if (this._events[event]) {
      this._events[event] = this._events[event].filter((cb) => cb !== callback);
    }

    if (this._onceEvents[event]) {
      this._onceEvents[event] = this._onceEvents[event].filter((cb) => cb !== callback);
    }

    return this;
  }

  /**
   * Remove all listeners for an event (or all events)
   * @param {string} [event] - Event name (optional)
   * @returns {this}
   */
  removeAllListeners(event) {
    if (event) {
      delete this._events[event];
      delete this._onceEvents[event];
    } else {
      this._events = {};
      this._onceEvents = {};
    }

    return this;
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to callbacks
   * @returns {boolean} - Whether event had listeners
   */
  emit(event, ...args) {
    let hasListeners = false;

    // Regular listeners
    if (this._events[event]) {
      hasListeners = true;
      this._events[event].forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} listener:`, error);
        }
      });
    }

    // One-time listeners
    if (this._onceEvents[event]) {
      hasListeners = true;
      const callbacks = [...this._onceEvents[event]];
      this._onceEvents[event] = [];

      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} once listener:`, error);
        }
      });
    }

    // Wildcard listeners
    if (this._events['*']) {
      this._events['*'].forEach((callback) => {
        try {
          callback(event, ...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in wildcard listener:`, error);
        }
      });
    }

    return hasListeners;
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    const regular = this._events[event]?.length || 0;
    const once = this._onceEvents[event]?.length || 0;
    return regular + once;
  }

  /**
   * Get all event names
   * @returns {string[]}
   */
  eventNames() {
    const events = new Set([
      ...Object.keys(this._events),
      ...Object.keys(this._onceEvents),
    ]);
    return Array.from(events);
  }

  /**
   * Get listeners for an event
   * @param {string} event - Event name
   * @returns {Function[]}
   */
  listeners(event) {
    return [
      ...(this._events[event] || []),
      ...(this._onceEvents[event] || []),
    ];
  }
}

/**
 * SDK Event Types
 */
export const EVENTS = {
  // SDK lifecycle
  SDK_INITIALIZED: 'sdk:initialized',
  SDK_DESTROYED: 'sdk:destroyed',

  // User events
  USER_IDENTIFIED: 'user:identified',

  // Tour events
  TOUR_STARTED: 'tour:started',
  TOUR_COMPLETED: 'tour:completed',
  TOUR_DISMISSED: 'tour:dismissed',
  TOUR_ERROR: 'tour:error',

  // Step events
  STEP_VIEWED: 'step:viewed',
  STEP_COMPLETED: 'step:completed',
  STEP_SKIPPED: 'step:skipped',

  // Progress events
  PROGRESS_SAVED: 'progress:saved',
  PROGRESS_RESET: 'progress:reset',
};

/**
 * Create a typed event emitter with predefined events
 */
export function createTypedEmitter() {
  const emitter = new EventEmitter();

  // Add type hints for IDE autocomplete
  return {
    on: (event, callback) => emitter.on(event, callback),
    once: (event, callback) => emitter.once(event, callback),
    off: (event, callback) => emitter.off(event, callback),
    emit: (event, ...args) => emitter.emit(event, ...args),
    removeAllListeners: (event) => emitter.removeAllListeners(event),
    EVENTS,
  };
}

/**
 * Debounce helper
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle helper
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
