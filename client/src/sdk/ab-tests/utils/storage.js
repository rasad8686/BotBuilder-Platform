/**
 * Storage Utilities for A/B Test SDK
 * Handles localStorage operations for visitor ID and assignment caching
 */

const STORAGE_PREFIX = 'bb_ab_';
const VISITOR_ID_KEY = `${STORAGE_PREFIX}visitor_id`;
const ASSIGNMENT_PREFIX = `${STORAGE_PREFIX}assignment_`;
const SESSION_KEY = `${STORAGE_PREFIX}session`;

/**
 * Generate a unique visitor ID
 * @returns {string}
 */
function generateVisitorId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 6);
  return `v_${timestamp}_${randomPart}${randomPart2}`;
}

/**
 * Get or generate visitor ID
 * @returns {string}
 */
export function getVisitorId() {
  try {
    let visitorId = localStorage.getItem(VISITOR_ID_KEY);

    if (!visitorId) {
      visitorId = generateVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }

    return visitorId;
  } catch (error) {
    // localStorage might be disabled
    console.warn('[ABTestSDK] localStorage not available, using session visitor ID');
    return generateVisitorId();
  }
}

/**
 * Set visitor ID
 * @param {string} visitorId
 */
export function setVisitorId(visitorId) {
  try {
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  } catch (error) {
    console.warn('[ABTestSDK] Failed to save visitor ID');
  }
}

/**
 * Cache an assignment
 * @param {string} testId - Test ID
 * @param {Object} assignment - Assignment data
 */
export function cacheAssignment(testId, assignment) {
  try {
    const key = `${ASSIGNMENT_PREFIX}${testId}`;
    const data = {
      ...assignment,
      cachedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('[ABTestSDK] Failed to cache assignment');
  }
}

/**
 * Get cached assignment
 * @param {string} testId - Test ID
 * @param {number} [maxAge] - Maximum age in milliseconds (default: 24 hours)
 * @returns {Object|null}
 */
export function getCachedAssignment(testId, maxAge = 24 * 60 * 60 * 1000) {
  try {
    const key = `${ASSIGNMENT_PREFIX}${testId}`;
    const cached = localStorage.getItem(key);

    if (!cached) return null;

    const data = JSON.parse(cached);

    // Check if cache is expired
    if (data.cachedAt && Date.now() - data.cachedAt > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.warn('[ABTestSDK] Failed to get cached assignment');
    return null;
  }
}

/**
 * Clear assignment cache for a specific test
 * @param {string} testId - Test ID
 */
export function clearAssignment(testId) {
  try {
    const key = `${ASSIGNMENT_PREFIX}${testId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('[ABTestSDK] Failed to clear assignment');
  }
}

/**
 * Clear all assignment caches
 */
export function clearAssignments() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(ASSIGNMENT_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('[ABTestSDK] Failed to clear assignments');
  }
}

/**
 * Get all cached assignments
 * @returns {Object}
 */
export function getAllCachedAssignments() {
  try {
    const assignments = {};
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(ASSIGNMENT_PREFIX)) {
        const testId = key.replace(ASSIGNMENT_PREFIX, '');
        const data = localStorage.getItem(key);
        if (data) {
          assignments[testId] = JSON.parse(data);
        }
      }
    });

    return assignments;
  } catch (error) {
    console.warn('[ABTestSDK] Failed to get all cached assignments');
    return {};
  }
}

/**
 * Get session data
 * @returns {Object}
 */
export function getSession() {
  try {
    const data = sessionStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    return {};
  }
}

/**
 * Set session data
 * @param {Object} data
 */
export function setSession(data) {
  try {
    const existing = getSession();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...existing, ...data }));
  } catch (error) {
    console.warn('[ABTestSDK] Failed to save session data');
  }
}

/**
 * Track session event
 * @param {string} testId - Test ID
 * @param {string} event - Event type
 */
export function trackSessionEvent(testId, event) {
  const session = getSession();
  const events = session.events || {};

  if (!events[testId]) {
    events[testId] = [];
  }

  events[testId].push({
    event,
    timestamp: Date.now(),
  });

  setSession({ events });
}

/**
 * Check if event was tracked in session
 * @param {string} testId - Test ID
 * @param {string} event - Event type
 * @returns {boolean}
 */
export function hasSessionEvent(testId, event) {
  const session = getSession();
  const events = session.events?.[testId] || [];
  return events.some((e) => e.event === event);
}

/**
 * Get storage info
 * @returns {Object}
 */
export function getStorageInfo() {
  try {
    let totalSize = 0;
    let abTestSize = 0;

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const size = localStorage[key].length * 2; // UTF-16
        totalSize += size;

        if (key.startsWith(STORAGE_PREFIX)) {
          abTestSize += size;
        }
      }
    }

    return {
      totalSize,
      abTestSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      abTestSizeKB: (abTestSize / 1024).toFixed(2),
    };
  } catch (error) {
    return { error: 'Unable to calculate storage info' };
  }
}
