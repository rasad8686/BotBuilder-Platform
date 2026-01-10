/**
 * Event Emitter for A/B Test SDK
 * Simple pub/sub implementation
 */

export class EventEmitter {
  constructor() {
    this.events = {};
    this.onceEvents = {};
  }

  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Add a one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} - Unsubscribe function
   */
  once(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.onceEvents[event]) {
      this.onceEvents[event] = [];
    }

    this.onceEvents[event].push(callback);

    return () => {
      this.onceEvents[event] = this.onceEvents[event].filter((cb) => cb !== callback);
    };
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((cb) => cb !== callback);
    }

    if (this.onceEvents[event]) {
      this.onceEvents[event] = this.onceEvents[event].filter((cb) => cb !== callback);
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    // Regular listeners
    if (this.events[event]) {
      this.events[event].forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} listener:`, error);
        }
      });
    }

    // One-time listeners
    if (this.onceEvents[event]) {
      const callbacks = [...this.onceEvents[event]];
      this.onceEvents[event] = [];

      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} once listener:`, error);
        }
      });
    }

    // Wildcard listeners
    if (this.events['*']) {
      this.events['*'].forEach((callback) => {
        try {
          callback(event, data);
        } catch (error) {
          console.error('[EventEmitter] Error in wildcard listener:', error);
        }
      });
    }
  }

  /**
   * Remove all listeners
   * @param {string} [event] - Event name (optional, removes all if not provided)
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
      delete this.onceEvents[event];
    } else {
      this.events = {};
      this.onceEvents = {};
    }
  }

  /**
   * Get listener count for an event
   * @param {string} event - Event name
   * @returns {number}
   */
  listenerCount(event) {
    const regular = this.events[event]?.length || 0;
    const once = this.onceEvents[event]?.length || 0;
    return regular + once;
  }

  /**
   * Get all event names
   * @returns {string[]}
   */
  eventNames() {
    const events = new Set([
      ...Object.keys(this.events),
      ...Object.keys(this.onceEvents),
    ]);
    return Array.from(events);
  }
}

/**
 * A/B Test SDK Event Types
 */
export const EVENTS = {
  SDK_INITIALIZED: 'sdk:initialized',
  USER_IDENTIFIED: 'user:identified',
  VARIANT_ASSIGNED: 'variant:assigned',
  CONVERSION_TRACKED: 'conversion:tracked',
  ERROR: 'error',
};

/**
 * Create a typed event emitter
 * @returns {EventEmitter}
 */
export function createEventEmitter() {
  return new EventEmitter();
}
