/**
 * Storage Utilities
 * Handles localStorage operations for visitor ID and progress
 */

const STORAGE_PREFIX = 'bbt_tours_';
const VISITOR_ID_KEY = `${STORAGE_PREFIX}visitor_id`;
const PROGRESS_KEY = `${STORAGE_PREFIX}progress_`;
const SESSION_KEY = `${STORAGE_PREFIX}session`;

/**
 * Generate a unique visitor ID
 * @returns {string}
 */
function generateVisitorId() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `v_${timestamp}_${randomPart}`;
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
    console.warn('[TourSDK] localStorage not available, using session visitor ID');
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
    console.warn('[TourSDK] Failed to save visitor ID');
  }
}

/**
 * Get progress for a tour
 * @param {string} tourId
 * @returns {Object|null}
 */
export function getProgress(tourId) {
  try {
    const data = localStorage.getItem(`${PROGRESS_KEY}${tourId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn('[TourSDK] Failed to get progress');
    return null;
  }
}

/**
 * Set progress for a tour
 * @param {string} tourId
 * @param {Object} data
 */
export function setProgress(tourId, data) {
  try {
    localStorage.setItem(`${PROGRESS_KEY}${tourId}`, JSON.stringify(data));
  } catch (error) {
    console.warn('[TourSDK] Failed to save progress');
  }
}

/**
 * Clear progress for a tour
 * @param {string} tourId
 */
export function clearProgress(tourId) {
  try {
    localStorage.removeItem(`${PROGRESS_KEY}${tourId}`);
  } catch (error) {
    console.warn('[TourSDK] Failed to clear progress');
  }
}

/**
 * Clear all tour progress
 */
export function clearAllProgress() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(PROGRESS_KEY)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn('[TourSDK] Failed to clear all progress');
  }
}

/**
 * Get all tour progress
 * @returns {Object}
 */
export function getAllProgress() {
  try {
    const progress = {};
    const keys = Object.keys(localStorage);

    keys.forEach((key) => {
      if (key.startsWith(PROGRESS_KEY)) {
        const tourId = key.replace(PROGRESS_KEY, '');
        const data = localStorage.getItem(key);
        if (data) {
          progress[tourId] = JSON.parse(data);
        }
      }
    });

    return progress;
  } catch (error) {
    console.warn('[TourSDK] Failed to get all progress');
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
    console.warn('[TourSDK] Failed to save session data');
  }
}

/**
 * Clear session data
 */
export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.warn('[TourSDK] Failed to clear session');
  }
}

/**
 * Check if a tour has been completed
 * @param {string} tourId
 * @returns {boolean}
 */
export function isTourCompleted(tourId) {
  const progress = getProgress(tourId);
  return progress?.status === 'completed';
}

/**
 * Check if a tour has been skipped
 * @param {string} tourId
 * @returns {boolean}
 */
export function isTourSkipped(tourId) {
  const progress = getProgress(tourId);
  return progress?.status === 'skipped';
}

/**
 * Get the current step for a tour
 * @param {string} tourId
 * @returns {number}
 */
export function getCurrentStep(tourId) {
  const progress = getProgress(tourId);
  return progress?.currentStep ?? 0;
}

/**
 * Mark a tour as seen (started at least once)
 * @param {string} tourId
 */
export function markTourAsSeen(tourId) {
  const progress = getProgress(tourId) || {};
  setProgress(tourId, {
    ...progress,
    seen: true,
    seenAt: new Date().toISOString(),
  });
}

/**
 * Check if a tour has been seen
 * @param {string} tourId
 * @returns {boolean}
 */
export function hasTourBeenSeen(tourId) {
  const progress = getProgress(tourId);
  return !!progress?.seen;
}

/**
 * Store dismissed tours for the session
 * @param {string} tourId
 */
export function dismissTourForSession(tourId) {
  const session = getSession();
  const dismissed = session.dismissed || [];

  if (!dismissed.includes(tourId)) {
    dismissed.push(tourId);
    setSession({ dismissed });
  }
}

/**
 * Check if a tour is dismissed for this session
 * @param {string} tourId
 * @returns {boolean}
 */
export function isTourDismissedForSession(tourId) {
  const session = getSession();
  return session.dismissed?.includes(tourId) || false;
}

/**
 * Get storage usage info
 * @returns {Object}
 */
export function getStorageInfo() {
  try {
    let totalSize = 0;
    let tourDataSize = 0;

    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const size = localStorage[key].length * 2; // UTF-16
        totalSize += size;

        if (key.startsWith(STORAGE_PREFIX)) {
          tourDataSize += size;
        }
      }
    }

    return {
      totalSize,
      tourDataSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      tourDataSizeKB: (tourDataSize / 1024).toFixed(2),
    };
  } catch (error) {
    return { error: 'Unable to calculate storage info' };
  }
}
