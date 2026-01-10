/*!
 * BotBuilder Tours SDK v1.0.0
 * (c) 2026 BotBuilder
 * Released under the MIT License
 *
 * Usage:
 * <script src="https://yourdomain.com/tours-sdk.min.js"></script>
 * <script>
 *   BotBuilderTours.init({ apiKey: 'your-api-key' });
 *   BotBuilderTours.startTour('tour-id');
 * </script>
 */
/**
 * API Utilities
 * Handles communication with the BotBuilder Tours API
 */

let API_URL = 'https://api.botbuilder.app';
let WORKSPACE_ID = null;

/**
 * Initialize API configuration
 * @param {string} apiUrl - API base URL
 * @param {string} workspaceId - Workspace ID
 */
function initApi(apiUrl, workspaceId) {
  API_URL = apiUrl;
  WORKSPACE_ID = workspaceId;
}

/**
 * Make an API request
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>}
 */
async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Workspace-ID': WORKSPACE_ID
  };
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[TourSDK API] Request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Initialize session and fetch active tours
 * @param {string} workspaceId - Workspace ID
 * @param {Object} options - Options
 * @returns {Promise<Object>}
 */
async function initSession(workspaceId, options = {}) {
  const {
    visitorId,
    userId
  } = options;
  return request('/api/public/tours/init', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId,
      visitorId,
      userId,
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    })
  });
}

/**
 * Fetch active tours for a workspace
 * @param {string} workspaceId - Workspace ID
 * @param {Object} options - Options
 * @returns {Promise<Array>}
 */
async function fetchActiveTours(workspaceId, options = {}) {
  const {
    visitorId,
    userId
  } = options;
  const params = new URLSearchParams({
    workspaceId,
    url: window.location.pathname
  });
  if (visitorId) params.append('visitorId', visitorId);
  if (userId) params.append('userId', userId);
  const response = await request(`/api/public/tours?${params.toString()}`);
  return response.tours || [];
}

/**
 * Fetch a specific tour
 * @param {string} tourId - Tour ID
 * @returns {Promise<Object>}
 */
async function fetchTour(tourId) {
  const response = await request(`/api/public/tours/${tourId}`);
  return response.tour || response;
}

/**
 * Track an analytics event
 * @param {Object} eventData - Event data
 * @returns {Promise}
 */
async function trackEvent(eventData) {
  const payload = {
    ...eventData,
    workspaceId: WORKSPACE_ID,
    timestamp: eventData.timestamp || new Date().toISOString(),
    sessionId: getSessionId(),
    pageUrl: window.location.href,
    pageTitle: document.title
  };

  // Use sendBeacon for reliability (especially on page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], {
      type: 'application/json'
    });
    navigator.sendBeacon(`${API_URL}/api/public/tours/event`, blob);
    return;
  }

  // Fallback to fetch
  return request('/api/public/tours/event', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Sync progress with server
 * @param {Object} progressData - Progress data
 * @returns {Promise}
 */
async function syncProgress(progressData) {
  return request('/api/public/tours/progress', {
    method: 'POST',
    body: JSON.stringify({
      ...progressData,
      workspaceId: WORKSPACE_ID
    })
  });
}

/**
 * Get user progress from server
 * @param {string} tourId - Tour ID
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<Object>}
 */
async function fetchProgress(tourId, visitorId) {
  const params = new URLSearchParams({
    tourId,
    visitorId
  });
  return request(`/api/public/tours/progress?${params.toString()}`);
}

/**
 * Batch track multiple events
 * @param {Array} events - Array of event data
 * @returns {Promise}
 */
async function batchTrackEvents(events) {
  return request('/api/public/tours/events/batch', {
    method: 'POST',
    body: JSON.stringify({
      events,
      workspaceId: WORKSPACE_ID
    })
  });
}

/**
 * Report an error
 * @param {Object} errorData - Error data
 * @returns {Promise}
 */
async function reportError(errorData) {
  try {
    return request('/api/public/tours/error', {
      method: 'POST',
      body: JSON.stringify({
        ...errorData,
        workspaceId: WORKSPACE_ID,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      })
    });
  } catch (error) {
    // Silently fail - don't want error reporting to cause more errors
    console.error('[TourSDK] Failed to report error:', error);
  }
}

// Session management

let sessionId = null;
function getSessionId() {
  if (!sessionId) {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }
  return sessionId;
}

/**
 * Event queue for offline support
 */
const eventQueue = [];
let isOnline = navigator.onLine;

// Monitor online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    flushEventQueue();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
  });
}

/**
 * Queue an event for later sending
 * @param {Object} eventData
 */
function queueEvent(eventData) {
  eventQueue.push({
    ...eventData,
    queuedAt: new Date().toISOString()
  });

  // Try to flush immediately if online
  if (isOnline) {
    flushEventQueue();
  }
}

/**
 * Flush the event queue
 */
async function flushEventQueue() {
  if (eventQueue.length === 0 || !isOnline) return;
  const events = [...eventQueue];
  eventQueue.length = 0;
  try {
    await batchTrackEvents(events);
  } catch (error) {
    // Re-queue failed events
    eventQueue.push(...events);
    console.error('[TourSDK] Failed to flush event queue:', error);
  }
}

// Flush queue before page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0 && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({
        events: eventQueue,
        workspaceId: WORKSPACE_ID
      })], {
        type: 'application/json'
      });
      navigator.sendBeacon(`${API_URL}/api/public/tours/events/batch`, blob);
    }
  });
}

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
function getVisitorId() {
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
function setVisitorId(visitorId) {
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
function getProgress(tourId) {
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
function setProgress(tourId, data) {
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
function clearProgress(tourId) {
  try {
    localStorage.removeItem(`${PROGRESS_KEY}${tourId}`);
  } catch (error) {
    console.warn('[TourSDK] Failed to clear progress');
  }
}

/**
 * Clear all tour progress
 */
function clearAllProgress() {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
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
function getAllProgress() {
  try {
    const progress = {};
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
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
function getSession() {
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
function setSession(data) {
  try {
    const existing = getSession();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      ...existing,
      ...data
    }));
  } catch (error) {
    console.warn('[TourSDK] Failed to save session data');
  }
}

/**
 * Clear session data
 */
function clearSession() {
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
function isTourCompleted(tourId) {
  const progress = getProgress(tourId);
  return progress?.status === 'completed';
}

/**
 * Check if a tour has been skipped
 * @param {string} tourId
 * @returns {boolean}
 */
function isTourSkipped(tourId) {
  const progress = getProgress(tourId);
  return progress?.status === 'skipped';
}

/**
 * Get the current step for a tour
 * @param {string} tourId
 * @returns {number}
 */
function getCurrentStep(tourId) {
  const progress = getProgress(tourId);
  return progress?.currentStep ?? 0;
}

/**
 * Mark a tour as seen (started at least once)
 * @param {string} tourId
 */
function markTourAsSeen(tourId) {
  const progress = getProgress(tourId) || {};
  setProgress(tourId, {
    ...progress,
    seen: true,
    seenAt: new Date().toISOString()
  });
}

/**
 * Check if a tour has been seen
 * @param {string} tourId
 * @returns {boolean}
 */
function hasTourBeenSeen(tourId) {
  const progress = getProgress(tourId);
  return !!progress?.seen;
}

/**
 * Store dismissed tours for the session
 * @param {string} tourId
 */
function dismissTourForSession(tourId) {
  const session = getSession();
  const dismissed = session.dismissed || [];
  if (!dismissed.includes(tourId)) {
    dismissed.push(tourId);
    setSession({
      dismissed
    });
  }
}

/**
 * Check if a tour is dismissed for this session
 * @param {string} tourId
 * @returns {boolean}
 */
function isTourDismissedForSession(tourId) {
  const session = getSession();
  return session.dismissed?.includes(tourId) || false;
}

/**
 * Get storage usage info
 * @returns {Object}
 */
function getStorageInfo() {
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
      tourDataSizeKB: (tourDataSize / 1024).toFixed(2)
    };
  } catch (error) {
    return {
      error: 'Unable to calculate storage info'
    };
  }
}

/**
 * TourEngine - Handles tour logic, targeting, and API communication
 */

class TourEngine {
  constructor(sdk) {
    this.sdk = sdk;
    this.toursCache = new Map();
    this.activeToursCache = null;
    this.lastFetch = 0;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load all active tours for the workspace
   */
  async loadActiveTours() {
    const now = Date.now();

    // Use cache if valid
    if (this.activeToursCache && now - this.lastFetch < this.cacheDuration) {
      return this.activeToursCache;
    }
    try {
      const tours = await fetchActiveTours(this.sdk.config.workspaceId, {
        visitorId: this.sdk.visitorId,
        userId: this.sdk.userId
      });
      this.activeToursCache = tours;
      this.lastFetch = now;

      // Cache individual tours
      tours.forEach(tour => {
        this.toursCache.set(tour.id, tour);
      });
      return tours;
    } catch (error) {
      console.error('[TourEngine] Failed to load active tours:', error);
      return [];
    }
  }

  /**
   * Load a specific tour by ID
   * @param {string} tourId - Tour ID
   */
  async loadTour(tourId) {
    // Check cache first
    if (this.toursCache.has(tourId)) {
      return this.toursCache.get(tourId);
    }
    try {
      const tour = await fetchTour(tourId);
      this.toursCache.set(tourId, tour);
      return tour;
    } catch (error) {
      console.error(`[TourEngine] Failed to load tour ${tourId}:`, error);
      return null;
    }
  }

  /**
   * Check if targeting rules match current context
   * @param {Object} tour - Tour object
   * @returns {boolean}
   */
  checkTargeting(tour) {
    if (!tour.targeting || !tour.targeting.rules || tour.targeting.rules.length === 0) {
      return true; // No targeting rules = show to everyone
    }
    const context = {
      url: window.location.href,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      search: window.location.search,
      hash: window.location.hash,
      referrer: document.referrer,
      userId: this.sdk.userId,
      visitorId: this.sdk.visitorId,
      userTraits: this.sdk.userTraits,
      device: this._getDeviceInfo(),
      timestamp: Date.now()
    };
    const {
      operator = 'AND',
      rules
    } = tour.targeting;
    if (operator === 'AND') {
      return rules.every(rule => this._evaluateRule(rule, context));
    } else if (operator === 'OR') {
      return rules.some(rule => this._evaluateRule(rule, context));
    }
    return true;
  }

  /**
   * Determine if a tour should be shown
   * @param {Object} tour - Tour object
   * @param {Object} context - Current context
   * @returns {boolean}
   */
  shouldShowTour(tour, context) {
    // Check if tour is active
    if (tour.status !== 'active') {
      return false;
    }

    // Check date range
    if (tour.startDate && new Date(tour.startDate) > new Date()) {
      return false;
    }
    if (tour.endDate && new Date(tour.endDate) < new Date()) {
      return false;
    }

    // Check frequency limits
    const progress = this.getUserProgress(tour.id);
    if (progress) {
      // Already completed
      if (progress.status === 'completed' && !tour.settings?.allowReplay) {
        return false;
      }

      // Skipped and skip cooldown not passed
      if (progress.status === 'skipped' && tour.settings?.skipCooldown) {
        const cooldownEnd = new Date(progress.updatedAt).getTime() + tour.settings.skipCooldown;
        if (Date.now() < cooldownEnd) {
          return false;
        }
      }
    }

    // Check targeting rules
    if (!this.checkTargeting(tour)) {
      return false;
    }

    // Check page URL matching
    if (tour.pageUrl) {
      const currentUrl = window.location.pathname;
      if (tour.pageUrlMatch === 'exact') {
        if (currentUrl !== tour.pageUrl) return false;
      } else if (tour.pageUrlMatch === 'contains') {
        if (!currentUrl.includes(tour.pageUrl)) return false;
      } else if (tour.pageUrlMatch === 'regex') {
        try {
          const regex = new RegExp(tour.pageUrl);
          if (!regex.test(currentUrl)) return false;
        } catch {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Track an analytics event
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  async trackEvent(eventType, data) {
    try {
      await trackEvent({
        eventType,
        ...data,
        visitorId: this.sdk.visitorId,
        userId: this.sdk.userId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('[TourEngine] Failed to track event:', error);
    }
  }

  /**
   * Get user progress for a tour
   * @param {string} tourId - Tour ID
   * @returns {Object|null}
   */
  getUserProgress(tourId) {
    return getProgress(tourId);
  }

  /**
   * Save user progress
   * @param {string} tourId - Tour ID
   * @param {number} currentStep - Current step index
   * @param {string} status - Status: 'in_progress', 'completed', 'skipped'
   */
  async saveProgress(tourId, currentStep, status) {
    const data = {
      tourId,
      currentStep,
      status,
      visitorId: this.sdk.visitorId,
      userId: this.sdk.userId,
      updatedAt: new Date().toISOString()
    };

    // Save locally
    setProgress(tourId, data);

    // Sync with server
    try {
      await syncProgress(data);
    } catch (error) {
      console.error('[TourEngine] Failed to sync progress:', error);
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.toursCache.clear();
    this.activeToursCache = null;
    this.lastFetch = 0;
  }

  // Private methods

  _evaluateRule(rule, context) {
    const {
      type,
      field,
      operator,
      value
    } = rule;
    let fieldValue;
    switch (type) {
      case 'url':
        fieldValue = this._getUrlField(field, context);
        break;
      case 'user':
        fieldValue = this._getUserField(field, context);
        break;
      case 'device':
        fieldValue = context.device[field];
        break;
      case 'custom':
        fieldValue = context.userTraits[field];
        break;
      default:
        return true;
    }
    return this._compareValues(fieldValue, operator, value);
  }
  _getUrlField(field, context) {
    switch (field) {
      case 'pathname':
        return context.pathname;
      case 'hostname':
        return context.hostname;
      case 'search':
        return context.search;
      case 'hash':
        return context.hash;
      case 'full':
        return context.url;
      case 'referrer':
        return context.referrer;
      default:
        return context.url;
    }
  }
  _getUserField(field, context) {
    switch (field) {
      case 'id':
        return context.userId;
      case 'visitorId':
        return context.visitorId;
      default:
        return context.userTraits[field];
    }
  }
  _compareValues(fieldValue, operator, targetValue) {
    if (fieldValue === undefined || fieldValue === null) {
      return operator === 'not_exists' || operator === 'is_empty';
    }
    const strValue = String(fieldValue).toLowerCase();
    const strTarget = String(targetValue).toLowerCase();
    switch (operator) {
      case 'equals':
        return strValue === strTarget;
      case 'not_equals':
        return strValue !== strTarget;
      case 'contains':
        return strValue.includes(strTarget);
      case 'not_contains':
        return !strValue.includes(strTarget);
      case 'starts_with':
        return strValue.startsWith(strTarget);
      case 'ends_with':
        return strValue.endsWith(strTarget);
      case 'matches_regex':
        try {
          return new RegExp(targetValue, 'i').test(fieldValue);
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(fieldValue) > Number(targetValue);
      case 'less_than':
        return Number(fieldValue) < Number(targetValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      case 'is_empty':
        return strValue === '';
      case 'is_not_empty':
        return strValue !== '';
      case 'in_list':
        const list = Array.isArray(targetValue) ? targetValue : targetValue.split(',');
        return list.map(v => v.trim().toLowerCase()).includes(strValue);
      case 'not_in_list':
        const notList = Array.isArray(targetValue) ? targetValue : targetValue.split(',');
        return !notList.map(v => v.trim().toLowerCase()).includes(strValue);
      default:
        return true;
    }
  }
  _getDeviceInfo() {
    const ua = navigator.userAgent;
    return {
      type: this._getDeviceType(ua),
      browser: this._getBrowser(ua),
      os: this._getOS(ua),
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language
    };
  }
  _getDeviceType(ua) {
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }
  _getBrowser(ua) {
    if (/edge/i.test(ua)) return 'edge';
    if (/chrome/i.test(ua)) return 'chrome';
    if (/firefox/i.test(ua)) return 'firefox';
    if (/safari/i.test(ua)) return 'safari';
    if (/msie|trident/i.test(ua)) return 'ie';
    return 'unknown';
  }
  _getOS(ua) {
    if (/windows/i.test(ua)) return 'windows';
    if (/macintosh|mac os x/i.test(ua)) return 'macos';
    if (/linux/i.test(ua)) return 'linux';
    if (/android/i.test(ua)) return 'android';
    if (/ios|iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'unknown';
  }
}

/**
 * Positioning Utilities
 * Handles tooltip/modal positioning and viewport adjustments
 */

const SPACING = 12;

/**
 * Calculate position for tooltip relative to target element
 * @param {DOMRect} targetRect - Target element bounding rect
 * @param {DOMRect} tooltipRect - Tooltip element bounding rect
 * @param {string} preferredPosition - Preferred position (top, bottom, left, right, auto)
 * @returns {Object} - { top, left, actualPosition }
 */
function calculatePosition(targetRect, tooltipRect, preferredPosition = 'bottom') {
  const positions = {
    top: {
      top: targetRect.top - tooltipRect.height - SPACING,
      left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
    },
    bottom: {
      top: targetRect.bottom + SPACING,
      left: targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
    },
    left: {
      top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
      left: targetRect.left - tooltipRect.width - SPACING
    },
    right: {
      top: targetRect.top + targetRect.height / 2 - tooltipRect.height / 2,
      left: targetRect.right + SPACING
    }
  };

  // Auto position - find best fit
  if (preferredPosition === 'auto') {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check which positions fit in viewport
    const fits = {
      top: positions.top.top >= 0,
      bottom: positions.bottom.top + tooltipRect.height <= viewportHeight,
      left: positions.left.left >= 0,
      right: positions.right.left + tooltipRect.width <= viewportWidth
    };

    // Priority: bottom > top > right > left
    if (fits.bottom) preferredPosition = 'bottom';else if (fits.top) preferredPosition = 'top';else if (fits.right) preferredPosition = 'right';else if (fits.left) preferredPosition = 'left';else preferredPosition = 'bottom'; // Default fallback
  }
  const position = positions[preferredPosition] || positions.bottom;
  return {
    top: position.top,
    left: position.left,
    actualPosition: preferredPosition
  };
}

/**
 * Adjust position to fit within viewport
 * @param {Object} position - { top, left }
 * @param {Object} dimensions - { width, height }
 * @returns {Object} - Adjusted { top, left }
 */
function adjustForViewport(position, dimensions) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = 10; // Minimum distance from viewport edge

  let {
    top,
    left
  } = position;
  const {
    width,
    height
  } = dimensions;

  // Horizontal adjustment
  if (left < padding) {
    left = padding;
  } else if (left + width > viewportWidth - padding) {
    left = viewportWidth - width - padding;
  }

  // Vertical adjustment
  if (top < padding) {
    top = padding;
  } else if (top + height > viewportHeight - padding) {
    top = viewportHeight - height - padding;
  }
  return {
    top,
    left
  };
}

/**
 * Get arrow position class based on tooltip position
 * @param {string} position - Tooltip position (top, bottom, left, right)
 * @returns {string} - Arrow position class
 */
function getArrowPosition(position) {
  // Arrow points opposite to tooltip position
  const arrowPositions = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left'
  };
  return arrowPositions[position] || 'top';
}

/**
 * Calculate arrow offset for centered alignment
 * @param {DOMRect} targetRect - Target element rect
 * @param {DOMRect} tooltipRect - Tooltip element rect
 * @param {string} position - Tooltip position
 * @returns {Object} - { offset, direction }
 */
function calculateArrowOffset(targetRect, tooltipRect, position) {
  const tooltipCenter = position === 'top' || position === 'bottom' ? tooltipRect.left + tooltipRect.width / 2 : tooltipRect.top + tooltipRect.height / 2;
  const targetCenter = position === 'top' || position === 'bottom' ? targetRect.left + targetRect.width / 2 : targetRect.top + targetRect.height / 2;
  return {
    offset: targetCenter - tooltipCenter,
    direction: position === 'top' || position === 'bottom' ? 'horizontal' : 'vertical'
  };
}

/**
 * Get optimal position based on available space
 * @param {DOMRect} targetRect - Target element rect
 * @param {Object} tooltipSize - { width, height }
 * @returns {string} - Best position
 */
function getOptimalPosition(targetRect, tooltipSize) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceAbove = targetRect.top;
  const spaceBelow = viewportHeight - targetRect.bottom;
  const spaceLeft = targetRect.left;
  const spaceRight = viewportWidth - targetRect.right;
  const spaces = {
    top: {
      space: spaceAbove,
      fits: spaceAbove >= tooltipSize.height + SPACING
    },
    bottom: {
      space: spaceBelow,
      fits: spaceBelow >= tooltipSize.height + SPACING
    },
    left: {
      space: spaceLeft,
      fits: spaceLeft >= tooltipSize.width + SPACING
    },
    right: {
      space: spaceRight,
      fits: spaceRight >= tooltipSize.width + SPACING
    }
  };

  // Find positions that fit
  const fittingPositions = Object.entries(spaces).filter(([, data]) => data.fits).sort(([, a], [, b]) => b.space - a.space);
  if (fittingPositions.length > 0) {
    return fittingPositions[0][0];
  }

  // If nothing fits perfectly, return position with most space
  const allPositions = Object.entries(spaces).sort(([, a], [, b]) => b.space - a.space);
  return allPositions[0][0];
}

/**
 * Calculate position for modal dialog
 * @param {Object} modalSize - { width, height }
 * @param {string} alignment - 'center', 'top', 'bottom'
 * @returns {Object} - { top, left }
 */
function calculateModalPosition(modalSize, alignment = 'center') {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const left = (viewportWidth - modalSize.width) / 2;
  let top;
  switch (alignment) {
    case 'top':
      top = 60;
      break;
    case 'bottom':
      top = viewportHeight - modalSize.height - 60;
      break;
    case 'center':
    default:
      top = (viewportHeight - modalSize.height) / 2;
      break;
  }
  return {
    top,
    left
  };
}

/**
 * Calculate position for slideout panel
 * @param {number} width - Panel width
 * @param {string} side - 'left' or 'right'
 * @returns {Object} - CSS properties
 */
function calculateSlideoutPosition(width, side = 'right') {
  return {
    top: 0,
    bottom: 0,
    [side]: 0,
    width: `${width}px`,
    [side === 'right' ? 'left' : 'right']: 'auto'
  };
}

/**
 * Check if position would cause overflow
 * @param {Object} position - { top, left }
 * @param {Object} dimensions - { width, height }
 * @returns {Object} - { overflowTop, overflowRight, overflowBottom, overflowLeft }
 */
function checkOverflow(position, dimensions) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return {
    overflowTop: position.top < 0,
    overflowRight: position.left + dimensions.width > viewportWidth,
    overflowBottom: position.top + dimensions.height > viewportHeight,
    overflowLeft: position.left < 0
  };
}

/**
 * Get centered position in viewport
 * @param {Object} dimensions - { width, height }
 * @returns {Object} - { top, left }
 */
function getCenteredPosition(dimensions) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  return {
    top: (viewportHeight - dimensions.height) / 2,
    left: (viewportWidth - dimensions.width) / 2
  };
}

/**
 * Tooltip Component
 * Displays a tooltip attached to a target element
 */

class Tooltip {
  constructor(options) {
    this.options = {
      title: '',
      content: '',
      position: 'bottom',
      // top, bottom, left, right, auto
      targetElement: null,
      media: null,
      // { type: 'image'|'video', src: '...', alt: '...' }
      buttons: null,
      // Custom buttons
      stepIndex: 0,
      totalSteps: 1,
      showBackButton: false,
      showSkipButton: true,
      onNext: () => {},
      onPrev: () => {},
      onSkip: () => {},
      onClose: () => {},
      theme: 'light',
      primaryColor: null,
      ...options
    };
    this.element = null;
    this.arrowElement = null;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }
  render(container) {
    this._createTooltip();
    container.appendChild(this.element);
    this._positionTooltip();
    this._setupListeners();
    this._animateIn();
  }
  destroy() {
    this._removeListeners();
    if (this.element && this.element.parentNode) {
      this.element.classList.add('bbt-tooltip--exit');
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 200);
    }
    this.element = null;
    this.arrowElement = null;
  }
  _createTooltip() {
    const {
      title,
      content,
      media,
      buttons,
      stepIndex,
      totalSteps,
      showBackButton,
      showSkipButton,
      theme,
      primaryColor
    } = this.options;
    this.element = document.createElement('div');
    this.element.className = `bbt-tooltip bbt-tooltip--${theme}`;
    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Arrow
    this.arrowElement = document.createElement('div');
    this.arrowElement.className = 'bbt-tooltip__arrow';
    this.element.appendChild(this.arrowElement);

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'bbt-tooltip__wrapper';

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-tooltip__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = e => {
      e.preventDefault();
      this.options.onClose();
    };
    wrapper.appendChild(closeBtn);

    // Media
    if (media) {
      const mediaEl = this._createMedia(media);
      wrapper.appendChild(mediaEl);
    }

    // Header with title
    if (title) {
      const header = document.createElement('div');
      header.className = 'bbt-tooltip__header';
      const titleEl = document.createElement('h4');
      titleEl.className = 'bbt-tooltip__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);
      wrapper.appendChild(header);
    }

    // Content
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'bbt-tooltip__content';
      contentEl.innerHTML = content;
      wrapper.appendChild(contentEl);
    }

    // Footer with actions
    const footer = document.createElement('div');
    footer.className = 'bbt-tooltip__footer';

    // Progress indicator
    if (totalSteps > 1) {
      const progress = document.createElement('span');
      progress.className = 'bbt-tooltip__progress';
      progress.textContent = `${stepIndex + 1} / ${totalSteps}`;
      footer.appendChild(progress);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bbt-tooltip__actions';
    if (buttons) {
      // Custom buttons
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `bbt-btn bbt-btn--${btn.variant || 'secondary'}`;
        button.textContent = btn.text;
        button.onclick = e => {
          e.preventDefault();
          if (btn.action === 'next') this.options.onNext();else if (btn.action === 'prev') this.options.onPrev();else if (btn.action === 'skip') this.options.onSkip();else if (btn.action === 'close') this.options.onClose();else if (btn.onClick) btn.onClick();
        };
        actions.appendChild(button);
      });
    } else {
      // Default buttons
      if (showSkipButton && stepIndex < totalSteps - 1) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'bbt-btn bbt-btn--text';
        skipBtn.textContent = 'Skip';
        skipBtn.onclick = e => {
          e.preventDefault();
          this.options.onSkip();
        };
        actions.appendChild(skipBtn);
      }
      if (showBackButton) {
        const backBtn = document.createElement('button');
        backBtn.className = 'bbt-btn bbt-btn--secondary';
        backBtn.textContent = 'Back';
        backBtn.onclick = e => {
          e.preventDefault();
          this.options.onPrev();
        };
        actions.appendChild(backBtn);
      }
      const nextBtn = document.createElement('button');
      nextBtn.className = 'bbt-btn bbt-btn--primary';
      nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Done' : 'Next';
      nextBtn.onclick = e => {
        e.preventDefault();
        this.options.onNext();
      };
      actions.appendChild(nextBtn);
    }
    footer.appendChild(actions);
    wrapper.appendChild(footer);
    this.element.appendChild(wrapper);
  }
  _createMedia(media) {
    const container = document.createElement('div');
    container.className = 'bbt-tooltip__media';
    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.src;
      img.alt = media.alt || '';
      img.className = 'bbt-tooltip__image';
      container.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.controls = true;
      video.autoplay = media.autoplay || false;
      video.muted = media.muted || true;
      video.loop = media.loop || false;
      video.className = 'bbt-tooltip__video';
      container.appendChild(video);
    } else if (media.type === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.src = media.src;
      iframe.className = 'bbt-tooltip__embed';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }
    return container;
  }
  _positionTooltip() {
    const {
      targetElement,
      position
    } = this.options;
    if (!targetElement) {
      // Center in viewport if no target
      this.element.style.position = 'fixed';
      this.element.style.top = '50%';
      this.element.style.left = '50%';
      this.element.style.transform = 'translate(-50%, -50%)';
      this.arrowElement.style.display = 'none';
      return;
    }
    const targetRect = targetElement.getBoundingClientRect();
    const tooltipRect = this.element.getBoundingClientRect();
    const {
      top,
      left,
      actualPosition
    } = calculatePosition(targetRect, tooltipRect, position);
    const adjusted = adjustForViewport({
      top,
      left
    }, {
      width: tooltipRect.width,
      height: tooltipRect.height
    });
    this.element.style.position = 'fixed';
    this.element.style.top = `${adjusted.top}px`;
    this.element.style.left = `${adjusted.left}px`;

    // Position arrow
    const arrowPosition = getArrowPosition(actualPosition);
    this.arrowElement.className = `bbt-tooltip__arrow bbt-tooltip__arrow--${arrowPosition}`;
  }
  _setupListeners() {
    // Reposition on resize and scroll
    this._resizeHandler = () => this._positionTooltip();
    this._scrollHandler = () => this._positionTooltip();
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);

    // Keyboard navigation
    this._keyHandler = e => {
      if (e.key === 'Escape') {
        this.options.onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        this.options.onNext();
      } else if (e.key === 'ArrowLeft') {
        this.options.onPrev();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }
  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-tooltip--enter');
    });
  }
}

/**
 * Modal Component
 * Displays a centered modal dialog
 */

class Modal {
  constructor(options) {
    this.options = {
      title: '',
      content: '',
      size: 'medium',
      // small, medium, large
      media: null,
      buttons: null,
      stepIndex: 0,
      totalSteps: 1,
      showBackButton: false,
      showSkipButton: true,
      onNext: () => {},
      onPrev: () => {},
      onSkip: () => {},
      onClose: () => {},
      theme: 'light',
      primaryColor: null,
      closeOnBackdrop: true,
      closeOnEscape: true,
      ...options
    };
    this.element = null;
    this.backdropElement = null;
    this._keyHandler = null;
  }
  render(container) {
    this._createBackdrop();
    this._createModal();
    container.appendChild(this.backdropElement);
    container.appendChild(this.element);
    this._setupListeners();
    this._animateIn();

    // Focus trap
    this.element.focus();
  }
  destroy() {
    this._removeListeners();
    if (this.element) {
      this.element.classList.add('bbt-modal--exit');
    }
    if (this.backdropElement) {
      this.backdropElement.classList.add('bbt-modal-backdrop--exit');
    }
    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      if (this.backdropElement && this.backdropElement.parentNode) {
        this.backdropElement.parentNode.removeChild(this.backdropElement);
      }
    }, 200);
    this.element = null;
    this.backdropElement = null;
  }
  _createBackdrop() {
    this.backdropElement = document.createElement('div');
    this.backdropElement.className = `bbt-modal-backdrop bbt-modal-backdrop--${this.options.theme}`;
    if (this.options.closeOnBackdrop) {
      this.backdropElement.onclick = e => {
        if (e.target === this.backdropElement) {
          this.options.onClose();
        }
      };
    }
  }
  _createModal() {
    const {
      title,
      content,
      size,
      media,
      buttons,
      stepIndex,
      totalSteps,
      showBackButton,
      showSkipButton,
      theme,
      primaryColor
    } = this.options;
    this.element = document.createElement('div');
    this.element.className = `bbt-modal bbt-modal--${size} bbt-modal--${theme}`;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('tabindex', '-1');
    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-modal__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = e => {
      e.preventDefault();
      this.options.onClose();
    };
    this.element.appendChild(closeBtn);

    // Media
    if (media) {
      const mediaEl = this._createMedia(media);
      this.element.appendChild(mediaEl);
    }

    // Header
    if (title) {
      const header = document.createElement('div');
      header.className = 'bbt-modal__header';
      const titleEl = document.createElement('h3');
      titleEl.className = 'bbt-modal__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);
      this.element.appendChild(header);
    }

    // Body
    if (content) {
      const body = document.createElement('div');
      body.className = 'bbt-modal__body';
      body.innerHTML = content;
      this.element.appendChild(body);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'bbt-modal__footer';

    // Progress
    if (totalSteps > 1) {
      const progress = document.createElement('div');
      progress.className = 'bbt-modal__progress';
      for (let i = 0; i < totalSteps; i++) {
        const dot = document.createElement('span');
        dot.className = `bbt-modal__progress-dot ${i === stepIndex ? 'bbt-modal__progress-dot--active' : ''} ${i < stepIndex ? 'bbt-modal__progress-dot--completed' : ''}`;
        progress.appendChild(dot);
      }
      footer.appendChild(progress);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bbt-modal__actions';
    if (buttons) {
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `bbt-btn bbt-btn--${btn.variant || 'secondary'}`;
        button.textContent = btn.text;
        button.onclick = e => {
          e.preventDefault();
          if (btn.action === 'next') this.options.onNext();else if (btn.action === 'prev') this.options.onPrev();else if (btn.action === 'skip') this.options.onSkip();else if (btn.action === 'close') this.options.onClose();else if (btn.onClick) btn.onClick();
        };
        actions.appendChild(button);
      });
    } else {
      if (showSkipButton && stepIndex < totalSteps - 1) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'bbt-btn bbt-btn--text';
        skipBtn.textContent = 'Skip tour';
        skipBtn.onclick = e => {
          e.preventDefault();
          this.options.onSkip();
        };
        actions.appendChild(skipBtn);
      }
      if (showBackButton) {
        const backBtn = document.createElement('button');
        backBtn.className = 'bbt-btn bbt-btn--secondary';
        backBtn.textContent = 'Back';
        backBtn.onclick = e => {
          e.preventDefault();
          this.options.onPrev();
        };
        actions.appendChild(backBtn);
      }
      const nextBtn = document.createElement('button');
      nextBtn.className = 'bbt-btn bbt-btn--primary';
      nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Get Started' : 'Next';
      nextBtn.onclick = e => {
        e.preventDefault();
        this.options.onNext();
      };
      actions.appendChild(nextBtn);
    }
    footer.appendChild(actions);
    this.element.appendChild(footer);
  }
  _createMedia(media) {
    const container = document.createElement('div');
    container.className = 'bbt-modal__media';
    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.src;
      img.alt = media.alt || '';
      img.className = 'bbt-modal__image';
      container.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.controls = true;
      video.autoplay = media.autoplay || false;
      video.muted = media.muted !== false;
      video.loop = media.loop || false;
      video.className = 'bbt-modal__video';
      container.appendChild(video);
    } else if (media.type === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.src = media.src;
      iframe.className = 'bbt-modal__embed';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    } else if (media.type === 'lottie') {
      const lottieContainer = document.createElement('div');
      lottieContainer.className = 'bbt-modal__lottie';
      lottieContainer.setAttribute('data-lottie-src', media.src);
      container.appendChild(lottieContainer);
    }
    return container;
  }
  _setupListeners() {
    if (this.options.closeOnEscape) {
      this._keyHandler = e => {
        if (e.key === 'Escape') {
          this.options.onClose();
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          this.options.onNext();
        } else if (e.key === 'ArrowLeft') {
          this.options.onPrev();
        }
      };
      document.addEventListener('keydown', this._keyHandler);
    }
  }
  _removeListeners() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      this.backdropElement.classList.add('bbt-modal-backdrop--enter');
      this.element.classList.add('bbt-modal--enter');
    });
  }
}

/**
 * Hotspot Component
 * Displays a pulsing dot that reveals a tooltip on click/hover
 */

class Hotspot {
  constructor(options) {
    this.options = {
      targetElement: null,
      title: '',
      content: '',
      position: 'right',
      // top, bottom, left, right
      color: null,
      // Custom color
      pulse: true,
      triggerOn: 'click',
      // click, hover
      stepIndex: 0,
      totalSteps: 1,
      showBackButton: false,
      showSkipButton: true,
      onNext: () => {},
      onPrev: () => {},
      onSkip: () => {},
      onClose: () => {},
      theme: 'light',
      primaryColor: null,
      ...options
    };
    this.hotspotElement = null;
    this.tooltipElement = null;
    this.isTooltipVisible = false;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }
  render(container) {
    this._createHotspot();
    this._createTooltip();
    container.appendChild(this.hotspotElement);
    container.appendChild(this.tooltipElement);
    this._positionHotspot();
    this._setupListeners();
    this._animateIn();
  }
  destroy() {
    this._removeListeners();
    if (this.hotspotElement) {
      this.hotspotElement.classList.add('bbt-hotspot--exit');
    }
    if (this.tooltipElement) {
      this.tooltipElement.classList.add('bbt-hotspot-tooltip--exit');
    }
    setTimeout(() => {
      if (this.hotspotElement && this.hotspotElement.parentNode) {
        this.hotspotElement.parentNode.removeChild(this.hotspotElement);
      }
      if (this.tooltipElement && this.tooltipElement.parentNode) {
        this.tooltipElement.parentNode.removeChild(this.tooltipElement);
      }
    }, 200);
    this.hotspotElement = null;
    this.tooltipElement = null;
  }
  _createHotspot() {
    const {
      color,
      pulse,
      theme,
      primaryColor
    } = this.options;
    this.hotspotElement = document.createElement('div');
    this.hotspotElement.className = `bbt-hotspot bbt-hotspot--${theme}`;
    if (pulse) {
      this.hotspotElement.classList.add('bbt-hotspot--pulse');
    }

    // Inner dot
    const dot = document.createElement('div');
    dot.className = 'bbt-hotspot__dot';
    if (color || primaryColor) {
      dot.style.backgroundColor = color || primaryColor;
    }

    // Pulse ring
    const ring = document.createElement('div');
    ring.className = 'bbt-hotspot__ring';
    if (color || primaryColor) {
      ring.style.borderColor = color || primaryColor;
    }
    this.hotspotElement.appendChild(dot);
    this.hotspotElement.appendChild(ring);
  }
  _createTooltip() {
    const {
      title,
      content,
      stepIndex,
      totalSteps,
      showBackButton,
      showSkipButton,
      theme,
      primaryColor
    } = this.options;
    this.tooltipElement = document.createElement('div');
    this.tooltipElement.className = `bbt-hotspot-tooltip bbt-hotspot-tooltip--${theme}`;
    this.tooltipElement.style.display = 'none';
    if (primaryColor) {
      this.tooltipElement.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'bbt-hotspot-tooltip__arrow';
    this.tooltipElement.appendChild(arrow);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-hotspot-tooltip__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      this.options.onClose();
    };
    this.tooltipElement.appendChild(closeBtn);

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'bbt-hotspot-tooltip__wrapper';
    if (title) {
      const titleEl = document.createElement('h4');
      titleEl.className = 'bbt-hotspot-tooltip__title';
      titleEl.textContent = title;
      wrapper.appendChild(titleEl);
    }
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'bbt-hotspot-tooltip__content';
      contentEl.innerHTML = content;
      wrapper.appendChild(contentEl);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'bbt-hotspot-tooltip__footer';
    if (totalSteps > 1) {
      const progress = document.createElement('span');
      progress.className = 'bbt-hotspot-tooltip__progress';
      progress.textContent = `${stepIndex + 1} / ${totalSteps}`;
      footer.appendChild(progress);
    }
    const actions = document.createElement('div');
    actions.className = 'bbt-hotspot-tooltip__actions';
    if (showSkipButton && stepIndex < totalSteps - 1) {
      const skipBtn = document.createElement('button');
      skipBtn.className = 'bbt-btn bbt-btn--text bbt-btn--sm';
      skipBtn.textContent = 'Skip';
      skipBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.options.onSkip();
      };
      actions.appendChild(skipBtn);
    }
    if (showBackButton) {
      const backBtn = document.createElement('button');
      backBtn.className = 'bbt-btn bbt-btn--secondary bbt-btn--sm';
      backBtn.textContent = 'Back';
      backBtn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.options.onPrev();
      };
      actions.appendChild(backBtn);
    }
    const nextBtn = document.createElement('button');
    nextBtn.className = 'bbt-btn bbt-btn--primary bbt-btn--sm';
    nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Done' : 'Next';
    nextBtn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      this.options.onNext();
    };
    actions.appendChild(nextBtn);
    footer.appendChild(actions);
    wrapper.appendChild(footer);
    this.tooltipElement.appendChild(wrapper);
  }
  _positionHotspot() {
    const {
      targetElement,
      position
    } = this.options;
    if (!targetElement) return;
    const targetRect = targetElement.getBoundingClientRect();

    // Position hotspot relative to target element
    let top, left;
    switch (position) {
      case 'top':
        top = targetRect.top - 12;
        left = targetRect.left + targetRect.width / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + 12;
        left = targetRect.left + targetRect.width / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.left - 12;
        break;
      case 'right':
      default:
        top = targetRect.top + targetRect.height / 2;
        left = targetRect.right + 12;
        break;
    }
    this.hotspotElement.style.position = 'fixed';
    this.hotspotElement.style.top = `${top}px`;
    this.hotspotElement.style.left = `${left}px`;
  }
  _positionTooltip() {
    if (!this.isTooltipVisible) return;
    const hotspotRect = this.hotspotElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    // Position tooltip relative to hotspot
    const {
      top,
      left,
      actualPosition
    } = calculatePosition(hotspotRect, tooltipRect, this.options.position === 'right' ? 'right' : 'bottom');
    const adjusted = adjustForViewport({
      top,
      left
    }, {
      width: tooltipRect.width,
      height: tooltipRect.height
    });
    this.tooltipElement.style.position = 'fixed';
    this.tooltipElement.style.top = `${adjusted.top}px`;
    this.tooltipElement.style.left = `${adjusted.left}px`;

    // Update arrow position
    const arrow = this.tooltipElement.querySelector('.bbt-hotspot-tooltip__arrow');
    if (arrow) {
      arrow.className = `bbt-hotspot-tooltip__arrow bbt-hotspot-tooltip__arrow--${getArrowPosition(actualPosition)}`;
    }
  }
  _showTooltip() {
    if (this.isTooltipVisible) return;
    this.isTooltipVisible = true;
    this.tooltipElement.style.display = 'block';
    requestAnimationFrame(() => {
      this._positionTooltip();
      this.tooltipElement.classList.add('bbt-hotspot-tooltip--enter');
    });
  }
  _hideTooltip() {
    if (!this.isTooltipVisible) return;
    this.isTooltipVisible = false;
    this.tooltipElement.classList.remove('bbt-hotspot-tooltip--enter');
    this.tooltipElement.classList.add('bbt-hotspot-tooltip--exit');
    setTimeout(() => {
      this.tooltipElement.style.display = 'none';
      this.tooltipElement.classList.remove('bbt-hotspot-tooltip--exit');
    }, 200);
  }
  _toggleTooltip() {
    if (this.isTooltipVisible) {
      this._hideTooltip();
    } else {
      this._showTooltip();
    }
  }
  _setupListeners() {
    const {
      triggerOn
    } = this.options;

    // Hotspot click/hover
    if (triggerOn === 'click') {
      this.hotspotElement.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleTooltip();
      };
    } else if (triggerOn === 'hover') {
      this.hotspotElement.onmouseenter = () => this._showTooltip();
      this.hotspotElement.onmouseleave = () => {
        // Delay to allow moving to tooltip
        setTimeout(() => {
          if (!this.tooltipElement.matches(':hover')) {
            this._hideTooltip();
          }
        }, 100);
      };
      this.tooltipElement.onmouseleave = () => this._hideTooltip();
    }

    // Reposition on resize/scroll
    this._resizeHandler = () => {
      this._positionHotspot();
      this._positionTooltip();
    };
    this._scrollHandler = () => {
      this._positionHotspot();
      this._positionTooltip();
    };
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);

    // Click outside to close
    this._clickOutsideHandler = e => {
      if (this.isTooltipVisible && !this.tooltipElement.contains(e.target) && !this.hotspotElement.contains(e.target)) {
        this._hideTooltip();
      }
    };
    document.addEventListener('click', this._clickOutsideHandler);

    // Keyboard
    this._keyHandler = e => {
      if (e.key === 'Escape') {
        if (this.isTooltipVisible) {
          this._hideTooltip();
        } else {
          this.options.onClose();
        }
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Auto-show tooltip after animation
    setTimeout(() => {
      this._showTooltip();
    }, 500);
  }
  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
    if (this._clickOutsideHandler) {
      document.removeEventListener('click', this._clickOutsideHandler);
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      this.hotspotElement.classList.add('bbt-hotspot--enter');
    });
  }
}

/**
 * Slideout Component
 * Displays a side panel that slides in from left or right
 */

class Slideout {
  constructor(options) {
    this.options = {
      title: '',
      content: '',
      position: 'right',
      // left, right
      width: 400,
      // Width in pixels
      media: null,
      buttons: null,
      stepIndex: 0,
      totalSteps: 1,
      showBackButton: false,
      showSkipButton: true,
      onNext: () => {},
      onPrev: () => {},
      onSkip: () => {},
      onClose: () => {},
      theme: 'light',
      primaryColor: null,
      showOverlay: true,
      closeOnOverlay: true,
      ...options
    };
    this.element = null;
    this.overlayElement = null;
    this._keyHandler = null;
  }
  render(container) {
    if (this.options.showOverlay) {
      this._createOverlay();
      container.appendChild(this.overlayElement);
    }
    this._createSlideout();
    container.appendChild(this.element);
    this._setupListeners();
    this._animateIn();
  }
  destroy() {
    this._removeListeners();
    if (this.element) {
      this.element.classList.remove('bbt-slideout--enter');
      this.element.classList.add('bbt-slideout--exit');
    }
    if (this.overlayElement) {
      this.overlayElement.classList.remove('bbt-slideout-overlay--enter');
      this.overlayElement.classList.add('bbt-slideout-overlay--exit');
    }
    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      if (this.overlayElement && this.overlayElement.parentNode) {
        this.overlayElement.parentNode.removeChild(this.overlayElement);
      }
    }, 300);
    this.element = null;
    this.overlayElement = null;
  }
  _createOverlay() {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = `bbt-slideout-overlay bbt-slideout-overlay--${this.options.theme}`;
    if (this.options.closeOnOverlay) {
      this.overlayElement.onclick = () => this.options.onClose();
    }
  }
  _createSlideout() {
    const {
      title,
      content,
      position,
      width,
      media,
      buttons,
      stepIndex,
      totalSteps,
      showBackButton,
      showSkipButton,
      theme,
      primaryColor
    } = this.options;
    this.element = document.createElement('div');
    this.element.className = `bbt-slideout bbt-slideout--${position} bbt-slideout--${theme}`;
    this.element.style.width = `${width}px`;
    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Header
    const header = document.createElement('div');
    header.className = 'bbt-slideout__header';
    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'bbt-slideout__title';
      titleEl.textContent = title;
      header.appendChild(titleEl);
    }
    const closeBtn = document.createElement('button');
    closeBtn.className = 'bbt-slideout__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.onclick = e => {
      e.preventDefault();
      this.options.onClose();
    };
    header.appendChild(closeBtn);
    this.element.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'bbt-slideout__body';

    // Media
    if (media) {
      const mediaEl = this._createMedia(media);
      body.appendChild(mediaEl);
    }

    // Content
    if (content) {
      const contentEl = document.createElement('div');
      contentEl.className = 'bbt-slideout__content';
      contentEl.innerHTML = content;
      body.appendChild(contentEl);
    }
    this.element.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'bbt-slideout__footer';

    // Progress
    if (totalSteps > 1) {
      const progress = document.createElement('div');
      progress.className = 'bbt-slideout__progress';
      const progressBar = document.createElement('div');
      progressBar.className = 'bbt-slideout__progress-bar';
      const progressFill = document.createElement('div');
      progressFill.className = 'bbt-slideout__progress-fill';
      progressFill.style.width = `${(stepIndex + 1) / totalSteps * 100}%`;
      progressBar.appendChild(progressFill);
      progress.appendChild(progressBar);
      const progressText = document.createElement('span');
      progressText.className = 'bbt-slideout__progress-text';
      progressText.textContent = `Step ${stepIndex + 1} of ${totalSteps}`;
      progress.appendChild(progressText);
      footer.appendChild(progress);
    }

    // Actions
    const actions = document.createElement('div');
    actions.className = 'bbt-slideout__actions';
    if (buttons) {
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `bbt-btn bbt-btn--${btn.variant || 'secondary'}`;
        button.textContent = btn.text;
        button.onclick = e => {
          e.preventDefault();
          if (btn.action === 'next') this.options.onNext();else if (btn.action === 'prev') this.options.onPrev();else if (btn.action === 'skip') this.options.onSkip();else if (btn.action === 'close') this.options.onClose();else if (btn.onClick) btn.onClick();
        };
        actions.appendChild(button);
      });
    } else {
      if (showSkipButton && stepIndex < totalSteps - 1) {
        const skipBtn = document.createElement('button');
        skipBtn.className = 'bbt-btn bbt-btn--text';
        skipBtn.textContent = 'Skip tour';
        skipBtn.onclick = e => {
          e.preventDefault();
          this.options.onSkip();
        };
        actions.appendChild(skipBtn);
      }
      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'bbt-slideout__button-group';
      if (showBackButton) {
        const backBtn = document.createElement('button');
        backBtn.className = 'bbt-btn bbt-btn--secondary';
        backBtn.textContent = 'Back';
        backBtn.onclick = e => {
          e.preventDefault();
          this.options.onPrev();
        };
        buttonGroup.appendChild(backBtn);
      }
      const nextBtn = document.createElement('button');
      nextBtn.className = 'bbt-btn bbt-btn--primary';
      nextBtn.textContent = stepIndex >= totalSteps - 1 ? 'Finish' : 'Continue';
      nextBtn.onclick = e => {
        e.preventDefault();
        this.options.onNext();
      };
      buttonGroup.appendChild(nextBtn);
      actions.appendChild(buttonGroup);
    }
    footer.appendChild(actions);
    this.element.appendChild(footer);
  }
  _createMedia(media) {
    const container = document.createElement('div');
    container.className = 'bbt-slideout__media';
    if (media.type === 'image') {
      const img = document.createElement('img');
      img.src = media.src;
      img.alt = media.alt || '';
      img.className = 'bbt-slideout__image';
      container.appendChild(img);
    } else if (media.type === 'video') {
      const video = document.createElement('video');
      video.src = media.src;
      video.controls = true;
      video.autoplay = media.autoplay || false;
      video.muted = media.muted !== false;
      video.loop = media.loop || false;
      video.className = 'bbt-slideout__video';
      container.appendChild(video);
    } else if (media.type === 'embed') {
      const iframe = document.createElement('iframe');
      iframe.src = media.src;
      iframe.className = 'bbt-slideout__embed';
      iframe.allowFullscreen = true;
      container.appendChild(iframe);
    }
    return container;
  }
  _setupListeners() {
    this._keyHandler = e => {
      if (e.key === 'Escape') {
        this.options.onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        this.options.onNext();
      } else if (e.key === 'ArrowLeft') {
        this.options.onPrev();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }
  _removeListeners() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      if (this.overlayElement) {
        this.overlayElement.classList.add('bbt-slideout-overlay--enter');
      }
      this.element.classList.add('bbt-slideout--enter');
    });
  }
}

/**
 * Overlay Component
 * Creates a dark overlay with a spotlight on the target element
 */

class Overlay {
  constructor(options) {
    this.options = {
      targetElement: null,
      onClick: null,
      padding: 8,
      // Padding around highlighted element
      opacity: 0.5,
      theme: 'light',
      borderRadius: 4,
      ...options
    };
    this.element = null;
    this.spotlightElement = null;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }
  render(container) {
    this._createOverlay();
    container.appendChild(this.element);
    this._updateSpotlight();
    this._setupListeners();
    this._animateIn();
  }
  destroy() {
    this._removeListeners();
    if (this.element) {
      this.element.classList.remove('bbt-overlay--enter');
      this.element.classList.add('bbt-overlay--exit');
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 200);
    }
    this.element = null;
    this.spotlightElement = null;
  }
  _createOverlay() {
    const {
      theme,
      opacity,
      onClick
    } = this.options;

    // SVG-based overlay for smooth spotlight cutout
    this.element = document.createElement('div');
    this.element.className = `bbt-overlay bbt-overlay--${theme}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'bbt-overlay__svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    // Defs for the mask
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const mask = document.createElementNS('http://www.w3.org/2000/svg', 'mask');
    mask.setAttribute('id', 'bbt-spotlight-mask');

    // White rectangle (visible area)
    const maskRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    maskRect.setAttribute('x', '0');
    maskRect.setAttribute('y', '0');
    maskRect.setAttribute('width', '100%');
    maskRect.setAttribute('height', '100%');
    maskRect.setAttribute('fill', 'white');
    mask.appendChild(maskRect);

    // Black rectangle for spotlight (cutout)
    this.spotlightElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    this.spotlightElement.setAttribute('class', 'bbt-overlay__spotlight');
    this.spotlightElement.setAttribute('fill', 'black');
    this.spotlightElement.setAttribute('rx', this.options.borderRadius);
    this.spotlightElement.setAttribute('ry', this.options.borderRadius);
    mask.appendChild(this.spotlightElement);
    defs.appendChild(mask);
    svg.appendChild(defs);

    // Overlay rectangle with mask
    const overlayRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    overlayRect.setAttribute('x', '0');
    overlayRect.setAttribute('y', '0');
    overlayRect.setAttribute('width', '100%');
    overlayRect.setAttribute('height', '100%');
    overlayRect.setAttribute('fill', theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : `rgba(0, 0, 0, ${opacity})`);
    overlayRect.setAttribute('mask', 'url(#bbt-spotlight-mask)');
    svg.appendChild(overlayRect);
    this.element.appendChild(svg);

    // Click handler
    if (onClick) {
      this.element.onclick = e => {
        if (e.target === this.element || e.target.tagName === 'svg' || e.target.tagName === 'rect') {
          onClick();
        }
      };
    }
  }
  _updateSpotlight() {
    const {
      targetElement,
      padding
    } = this.options;
    if (!targetElement || !this.spotlightElement) {
      // Hide spotlight if no target
      this.spotlightElement.setAttribute('width', '0');
      this.spotlightElement.setAttribute('height', '0');
      return;
    }
    const rect = targetElement.getBoundingClientRect();
    this.spotlightElement.setAttribute('x', rect.left - padding);
    this.spotlightElement.setAttribute('y', rect.top - padding);
    this.spotlightElement.setAttribute('width', rect.width + padding * 2);
    this.spotlightElement.setAttribute('height', rect.height + padding * 2);
  }
  _setupListeners() {
    this._resizeHandler = () => this._updateSpotlight();
    this._scrollHandler = () => this._updateSpotlight();
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);
  }
  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-overlay--enter');
    });
  }
}

/**
 * Simple highlight border around element (alternative to overlay)
 */
class Highlight {
  constructor(options) {
    this.options = {
      targetElement: null,
      color: '#3B82F6',
      borderWidth: 2,
      padding: 4,
      borderRadius: 4,
      pulse: false,
      ...options
    };
    this.element = null;
    this._resizeHandler = null;
    this._scrollHandler = null;
  }
  render(container) {
    this._createHighlight();
    container.appendChild(this.element);
    this._updatePosition();
    this._setupListeners();
    this._animateIn();
  }
  destroy() {
    this._removeListeners();
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
  _createHighlight() {
    const {
      color,
      borderWidth,
      borderRadius,
      pulse
    } = this.options;
    this.element = document.createElement('div');
    this.element.className = 'bbt-highlight';
    if (pulse) {
      this.element.classList.add('bbt-highlight--pulse');
    }
    this.element.style.border = `${borderWidth}px solid ${color}`;
    this.element.style.borderRadius = `${borderRadius}px`;
    this.element.style.boxShadow = `0 0 0 4px ${color}33`;
  }
  _updatePosition() {
    const {
      targetElement,
      padding,
      borderWidth
    } = this.options;
    if (!targetElement) return;
    const rect = targetElement.getBoundingClientRect();
    this.element.style.position = 'fixed';
    this.element.style.top = `${rect.top - padding - borderWidth}px`;
    this.element.style.left = `${rect.left - padding - borderWidth}px`;
    this.element.style.width = `${rect.width + padding * 2}px`;
    this.element.style.height = `${rect.height + padding * 2}px`;
  }
  _setupListeners() {
    this._resizeHandler = () => this._updatePosition();
    this._scrollHandler = () => this._updatePosition();
    window.addEventListener('resize', this._resizeHandler);
    window.addEventListener('scroll', this._scrollHandler, true);
  }
  _removeListeners() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-highlight--enter');
    });
  }
}

/**
 * ProgressBar Component
 * Shows tour progress at the bottom of the screen
 */

class ProgressBar {
  constructor(options) {
    this.options = {
      current: 0,
      total: 1,
      theme: 'light',
      position: 'bottom',
      // top, bottom
      showStepNumbers: true,
      primaryColor: null,
      ...options
    };
    this.element = null;
  }
  render(container) {
    this._createProgressBar();
    container.appendChild(this.element);
    this._animateIn();
  }
  destroy() {
    if (this.element) {
      this.element.classList.remove('bbt-progress-bar--enter');
      this.element.classList.add('bbt-progress-bar--exit');
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 200);
    }
    this.element = null;
  }
  update(current) {
    this.options.current = current;
    this._updateProgress();
  }
  _createProgressBar() {
    const {
      current,
      total,
      theme,
      position,
      showStepNumbers,
      primaryColor
    } = this.options;
    this.element = document.createElement('div');
    this.element.className = `bbt-progress-bar bbt-progress-bar--${position} bbt-progress-bar--${theme}`;
    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }

    // Progress track
    const track = document.createElement('div');
    track.className = 'bbt-progress-bar__track';

    // Step dots
    for (let i = 0; i < total; i++) {
      const step = document.createElement('div');
      step.className = 'bbt-progress-bar__step';
      if (i < current) {
        step.classList.add('bbt-progress-bar__step--completed');
      } else if (i === current) {
        step.classList.add('bbt-progress-bar__step--active');
      }

      // Connector line (except for last step)
      if (i < total - 1) {
        const connector = document.createElement('div');
        connector.className = 'bbt-progress-bar__connector';
        if (i < current) {
          connector.classList.add('bbt-progress-bar__connector--completed');
        }
        step.appendChild(connector);
      }

      // Step dot
      const dot = document.createElement('div');
      dot.className = 'bbt-progress-bar__dot';
      if (showStepNumbers) {
        dot.textContent = i + 1;
      }
      step.appendChild(dot);
      track.appendChild(step);
    }
    this.element.appendChild(track);

    // Text indicator
    const text = document.createElement('div');
    text.className = 'bbt-progress-bar__text';
    text.textContent = `Step ${current + 1} of ${total}`;
    this.element.appendChild(text);
  }
  _updateProgress() {
    const {
      current,
      total
    } = this.options;

    // Update steps
    const steps = this.element.querySelectorAll('.bbt-progress-bar__step');
    steps.forEach((step, i) => {
      step.classList.remove('bbt-progress-bar__step--completed', 'bbt-progress-bar__step--active');
      if (i < current) {
        step.classList.add('bbt-progress-bar__step--completed');
      } else if (i === current) {
        step.classList.add('bbt-progress-bar__step--active');
      }
    });

    // Update connectors
    const connectors = this.element.querySelectorAll('.bbt-progress-bar__connector');
    connectors.forEach((connector, i) => {
      connector.classList.toggle('bbt-progress-bar__connector--completed', i < current);
    });

    // Update text
    const text = this.element.querySelector('.bbt-progress-bar__text');
    if (text) {
      text.textContent = `Step ${current + 1} of ${total}`;
    }
  }
  _animateIn() {
    requestAnimationFrame(() => {
      this.element.classList.add('bbt-progress-bar--enter');
    });
  }
}

/**
 * Minimal progress indicator (dots only)
 */
class ProgressDots {
  constructor(options) {
    this.options = {
      current: 0,
      total: 1,
      theme: 'light',
      primaryColor: null,
      ...options
    };
    this.element = null;
  }
  render(container) {
    this._createDots();
    container.appendChild(this.element);
  }
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
  update(current) {
    this.options.current = current;
    this._updateDots();
  }
  _createDots() {
    const {
      current,
      total,
      theme,
      primaryColor
    } = this.options;
    this.element = document.createElement('div');
    this.element.className = `bbt-progress-dots bbt-progress-dots--${theme}`;
    if (primaryColor) {
      this.element.style.setProperty('--bbt-primary-color', primaryColor);
    }
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      dot.className = 'bbt-progress-dots__dot';
      if (i < current) {
        dot.classList.add('bbt-progress-dots__dot--completed');
      } else if (i === current) {
        dot.classList.add('bbt-progress-dots__dot--active');
      }
      this.element.appendChild(dot);
    }
  }
  _updateDots() {
    const {
      current
    } = this.options;
    const dots = this.element.querySelectorAll('.bbt-progress-dots__dot');
    dots.forEach((dot, i) => {
      dot.classList.remove('bbt-progress-dots__dot--completed', 'bbt-progress-dots__dot--active');
      if (i < current) {
        dot.classList.add('bbt-progress-dots__dot--completed');
      } else if (i === current) {
        dot.classList.add('bbt-progress-dots__dot--active');
      }
    });
  }
}

/**
 * DOM Utilities
 * Helper functions for DOM manipulation and element finding
 */

/**
 * Find an element by selector
 * @param {string} selector - CSS selector
 * @returns {Element|null}
 */
function findElement(selector) {
  if (!selector) return null;
  try {
    // Handle special selectors
    if (selector.startsWith('data-tour=')) {
      const value = selector.replace('data-tour=', '');
      return document.querySelector(`[data-tour="${value}"]`);
    }
    if (selector.startsWith('data-tour-id=')) {
      const value = selector.replace('data-tour-id=', '');
      return document.querySelector(`[data-tour-id="${value}"]`);
    }
    return document.querySelector(selector);
  } catch (error) {
    console.error('[TourSDK] Invalid selector:', selector, error);
    return null;
  }
}

/**
 * Check if an element is visible in the viewport
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function isElementVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  // Check if element has dimensions
  if (rect.width === 0 || rect.height === 0) return false;

  // Check CSS visibility
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Check if in viewport
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return rect.top >= -rect.height && rect.left >= -rect.width && rect.bottom <= viewportHeight + rect.height && rect.right <= viewportWidth + rect.width;
}

/**
 * Check if element is fully visible in viewport
 * @param {Element} element - DOM element
 * @returns {boolean}
 */
function isElementFullyVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return rect.top >= 0 && rect.left >= 0 && rect.bottom <= viewportHeight && rect.right <= viewportWidth;
}

/**
 * Get element position and dimensions
 * @param {Element} element - DOM element
 * @returns {Object}
 */
function getElementPosition(element) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
    absoluteTop: rect.top + scrollTop,
    absoluteLeft: rect.left + scrollLeft,
    centerX: rect.left + rect.width / 2,
    centerY: rect.top + rect.height / 2
  };
}

/**
 * Scroll to an element
 * @param {Element} element - DOM element
 * @param {Object} options - Scroll options
 * @returns {Promise}
 */
function scrollToElement(element, options = {}) {
  return new Promise(resolve => {
    if (!element) {
      resolve();
      return;
    }
    const {
      behavior = 'smooth',
      block = 'center',
      inline = 'nearest',
      offset = 0
    } = options;

    // Check if element is already visible
    if (isElementFullyVisible(element)) {
      resolve();
      return;
    }

    // Use native scrollIntoView
    element.scrollIntoView({
      behavior,
      block,
      inline
    });

    // Apply additional offset if needed
    if (offset !== 0) {
      setTimeout(() => {
        window.scrollBy({
          top: offset,
          behavior: 'smooth'
        });
      }, 100);
    }

    // Wait for scroll to complete
    const scrollTimeout = behavior === 'smooth' ? 500 : 100;
    setTimeout(resolve, scrollTimeout);
  });
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element|null>}
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise(resolve => {
    // Check if element already exists
    const existing = findElement(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const startTime = Date.now();

    // Use MutationObserver for better performance
    const observer = new MutationObserver((mutations, obs) => {
      const element = findElement(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      } else if (Date.now() - startTime >= timeout) {
        obs.disconnect();
        resolve(null);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Fallback timeout
    setTimeout(() => {
      observer.disconnect();
      resolve(findElement(selector));
    }, timeout);
  });
}

/**
 * Wait for element to be visible
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Element|null>}
 */
async function waitForElementVisible(selector, timeout = 5000) {
  const element = await waitForElement(selector, timeout);
  if (!element) return null;

  // Wait for visibility
  const startTime = Date.now();
  while (!isElementVisible(element) && Date.now() - startTime < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return isElementVisible(element) ? element : null;
}

/**
 * Add highlight effect to an element
 * @param {Element} element - DOM element
 * @param {Object} options - Highlight options
 * @returns {Function} - Cleanup function
 */
function highlightElement(element, options = {}) {
  if (!element) return () => {};
  const {
    color = '#3B82F6',
    duration = 0,
    // 0 = permanent until cleanup
    pulse = false
  } = options;
  const originalOutline = element.style.outline;
  const originalTransition = element.style.transition;
  element.style.outline = `3px solid ${color}`;
  element.style.transition = 'outline 0.3s ease';
  if (pulse) {
    element.classList.add('bbt-pulse-highlight');
  }
  const cleanup = () => {
    element.style.outline = originalOutline;
    element.style.transition = originalTransition;
    element.classList.remove('bbt-pulse-highlight');
  };
  if (duration > 0) {
    setTimeout(cleanup, duration);
  }
  return cleanup;
}

/**
 * Get all focusable elements within a container
 * @param {Element} container - Container element
 * @returns {Element[]}
 */
function getFocusableElements(container) {
  const focusableSelectors = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'].join(', ');
  return Array.from(container.querySelectorAll(focusableSelectors));
}

/**
 * Create focus trap within a container
 * @param {Element} container - Container element
 * @returns {Function} - Cleanup function
 */
function createFocusTrap(container) {
  const focusableElements = getFocusableElements(container);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const handleKeyDown = e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };
  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Get the z-index of an element
 * @param {Element} element - DOM element
 * @returns {number}
 */
function getZIndex(element) {
  let el = element;
  let zIndex = 0;
  while (el) {
    const style = window.getComputedStyle(el);
    const z = parseInt(style.zIndex, 10);
    if (!isNaN(z) && z > zIndex) {
      zIndex = z;
    }
    el = el.parentElement;
  }
  return zIndex;
}

/**
 * TourRenderer - Handles rendering of tour steps and UI components
 */

class TourRenderer {
  constructor(sdk) {
    this.sdk = sdk;
    this.container = null;
    this.currentComponent = null;
    this.overlay = null;
    this.progressBar = null;
    this.hotspots = [];
    this._createContainer();
  }

  /**
   * Render a step
   * @param {Object} step - Step configuration
   * @param {Object} options - Render options
   */
  async renderStep(step, options) {
    // Cleanup previous step
    this._cleanup();
    const {
      tour,
      stepIndex,
      totalSteps,
      onNext,
      onPrev,
      onSkip,
      onClose
    } = options;

    // Wait for target element if needed
    let targetElement = null;
    if (step.targetSelector) {
      targetElement = await waitForElement(step.targetSelector, step.waitTimeout || 5000);
      if (!targetElement) {
        console.warn(`[TourRenderer] Target element not found: ${step.targetSelector}`);
        // Show modal instead if target not found
        step.type = 'modal';
      }
    }

    // Scroll to element if needed
    if (targetElement && step.scrollTo !== false) {
      await scrollToElement(targetElement, {
        behavior: step.scrollBehavior || 'smooth',
        block: step.scrollBlock || 'center'
      });
    }

    // Show overlay if configured
    if (step.overlay !== false && targetElement) {
      this.overlay = new Overlay({
        targetElement,
        onClick: step.overlayClickClose ? onClose : null,
        padding: step.overlayPadding || 8,
        opacity: step.overlayOpacity || 0.5,
        theme: this.sdk.config.theme
      });
      this.overlay.render(this.container);
    }

    // Show progress bar if configured
    if (tour.settings?.showProgress !== false && totalSteps > 1) {
      this.progressBar = new ProgressBar({
        current: stepIndex,
        total: totalSteps,
        theme: this.sdk.config.theme
      });
      this.progressBar.render(this.container);
    }

    // Render the appropriate component based on step type
    const componentOptions = {
      step,
      targetElement,
      stepIndex,
      totalSteps,
      onNext,
      onPrev,
      onSkip,
      onClose,
      showBackButton: stepIndex > 0 && tour.settings?.showBackButton !== false,
      showSkipButton: tour.settings?.showSkipButton !== false,
      theme: this.sdk.config.theme,
      primaryColor: tour.settings?.primaryColor
    };
    switch (step.type) {
      case 'tooltip':
        this._renderTooltip(componentOptions);
        break;
      case 'modal':
        this._renderModal(componentOptions);
        break;
      case 'hotspot':
        this._renderHotspot(componentOptions);
        break;
      case 'slideout':
        this._renderSlideout(componentOptions);
        break;
      default:
        this._renderTooltip(componentOptions);
    }

    // Handle step actions/triggers
    this._setupStepTriggers(step, targetElement, onNext);
  }

  /**
   * Render tooltip component
   */
  _renderTooltip(options) {
    const {
      step,
      targetElement,
      ...rest
    } = options;
    this.currentComponent = new Tooltip({
      title: step.title,
      content: step.content,
      position: step.position || 'bottom',
      targetElement,
      media: step.media,
      buttons: step.buttons,
      ...rest
    });
    this.currentComponent.render(this.container);
  }

  /**
   * Render modal component
   */
  _renderModal(options) {
    const {
      step,
      ...rest
    } = options;
    this.currentComponent = new Modal({
      title: step.title,
      content: step.content,
      size: step.size || 'medium',
      media: step.media,
      buttons: step.buttons,
      ...rest
    });
    this.currentComponent.render(this.container);
  }

  /**
   * Render hotspot component
   */
  _renderHotspot(options) {
    const {
      step,
      targetElement,
      ...rest
    } = options;
    if (!targetElement) {
      console.warn('[TourRenderer] Hotspot requires a target element');
      this._renderModal(options);
      return;
    }
    this.currentComponent = new Hotspot({
      targetElement,
      title: step.title,
      content: step.content,
      position: step.position || 'right',
      color: step.hotspotColor,
      pulse: step.pulse !== false,
      ...rest
    });
    this.currentComponent.render(this.container);
  }

  /**
   * Render slideout component
   */
  _renderSlideout(options) {
    const {
      step,
      ...rest
    } = options;
    this.currentComponent = new Slideout({
      title: step.title,
      content: step.content,
      position: step.slidePosition || 'right',
      width: step.slideWidth,
      media: step.media,
      buttons: step.buttons,
      ...rest
    });
    this.currentComponent.render(this.container);
  }

  /**
   * Setup step-specific triggers
   */
  _setupStepTriggers(step, targetElement, onNext) {
    if (!step.trigger || !targetElement) return;
    const {
      type,
      event
    } = step.trigger;
    switch (type) {
      case 'click':
        const clickHandler = () => {
          targetElement.removeEventListener('click', clickHandler);
          onNext();
        };
        targetElement.addEventListener('click', clickHandler);
        this._triggerCleanup = () => targetElement.removeEventListener('click', clickHandler);
        break;
      case 'input':
        const inputHandler = () => {
          if (targetElement.value.length > 0) {
            targetElement.removeEventListener('input', inputHandler);
            onNext();
          }
        };
        targetElement.addEventListener('input', inputHandler);
        this._triggerCleanup = () => targetElement.removeEventListener('input', inputHandler);
        break;
      case 'custom':
        // Custom event listener
        if (event) {
          const customHandler = () => {
            document.removeEventListener(event, customHandler);
            onNext();
          };
          document.addEventListener(event, customHandler);
          this._triggerCleanup = () => document.removeEventListener(event, customHandler);
        }
        break;
    }
  }

  /**
   * Destroy all rendered components
   */
  destroy() {
    this._cleanup();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }

  // Private methods

  _createContainer() {
    // Remove existing container if any
    const existing = document.getElementById('botbuilder-tours-container');
    if (existing) {
      existing.parentNode.removeChild(existing);
    }
    this.container = document.createElement('div');
    this.container.id = 'botbuilder-tours-container';
    this.container.className = 'botbuilder-tours';
    document.body.appendChild(this.container);
  }
  _cleanup() {
    if (this.currentComponent) {
      this.currentComponent.destroy();
      this.currentComponent = null;
    }
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
    if (this.progressBar) {
      this.progressBar.destroy();
      this.progressBar = null;
    }
    this.hotspots.forEach(hotspot => hotspot.destroy());
    this.hotspots = [];
    if (this._triggerCleanup) {
      this._triggerCleanup();
      this._triggerCleanup = null;
    }
  }
}

/**
 * Event Emitter
 * Simple event emitter for SDK events
 */

class EventEmitter {
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
      this._events[event] = this._events[event].filter(cb => cb !== callback);
    }
    if (this._onceEvents[event]) {
      this._onceEvents[event] = this._onceEvents[event].filter(cb => cb !== callback);
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
      this._events[event].forEach(callback => {
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
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} once listener:`, error);
        }
      });
    }

    // Wildcard listeners
    if (this._events['*']) {
      this._events['*'].forEach(callback => {
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
    const events = new Set([...Object.keys(this._events), ...Object.keys(this._onceEvents)]);
    return Array.from(events);
  }

  /**
   * Get listeners for an event
   * @param {string} event - Event name
   * @returns {Function[]}
   */
  listeners(event) {
    return [...(this._events[event] || []), ...(this._onceEvents[event] || [])];
  }
}

/**
 * SDK Event Types
 */
const EVENTS = {
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
  PROGRESS_RESET: 'progress:reset'
};

/**
 * Create a typed event emitter with predefined events
 */
function createTypedEmitter() {
  const emitter = new EventEmitter();

  // Add type hints for IDE autocomplete
  return {
    on: (event, callback) => emitter.on(event, callback),
    once: (event, callback) => emitter.once(event, callback),
    off: (event, callback) => emitter.off(event, callback),
    emit: (event, ...args) => emitter.emit(event, ...args),
    removeAllListeners: event => emitter.removeAllListeners(event),
    EVENTS
  };
}

/**
 * Debounce helper
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
function debounce(func, wait) {
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
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * BotBuilder Tours SDK
 * Product tours for customer websites
 */

class TourSDK extends EventEmitter {
  constructor() {
    super();
    this.config = null;
    this.engine = null;
    this.renderer = null;
    this.currentTour = null;
    this.currentStepIndex = 0;
    this.initialized = false;
    this.visitorId = null;
    this.userId = null;
    this.userTraits = {};
  }

  /**
   * Initialize the SDK
   * @param {Object} config - Configuration object
   * @param {string} config.workspaceId - Workspace ID (required)
   * @param {string} [config.userId] - User ID (optional)
   * @param {string} [config.visitorId] - Visitor ID (optional, auto-generated if not provided)
   * @param {string} [config.apiUrl] - API URL (optional, defaults to production)
   * @param {boolean} [config.autoStart=true] - Auto start tours based on targeting
   * @param {string} [config.theme='light'] - Theme: 'light' or 'dark'
   */
  init(config) {
    if (this.initialized) {
      console.warn('[BotBuilderTours] SDK already initialized');
      return this;
    }
    if (!config.workspaceId) {
      throw new Error('[BotBuilderTours] workspaceId is required');
    }
    this.config = {
      workspaceId: config.workspaceId,
      userId: config.userId || null,
      visitorId: config.visitorId || getVisitorId(),
      apiUrl: config.apiUrl || 'https://api.botbuilder.app',
      autoStart: config.autoStart !== false,
      theme: config.theme || 'light'
    };

    // Save visitor ID
    this.visitorId = this.config.visitorId;
    setVisitorId(this.visitorId);
    if (this.config.userId) {
      this.userId = this.config.userId;
    }

    // Initialize API
    initApi(this.config.apiUrl, this.config.workspaceId);

    // Initialize engine and renderer
    this.engine = new TourEngine(this);
    this.renderer = new TourRenderer(this);

    // Apply theme
    this._applyTheme(this.config.theme);
    this.initialized = true;
    this.emit('sdk:initialized', {
      config: this.config
    });

    // Auto-load and start tours if enabled
    if (this.config.autoStart) {
      this._autoStartTours();
    }
    return this;
  }

  /**
   * Identify a user
   * @param {string} userId - User ID
   * @param {Object} [traits] - User traits for targeting
   */
  identify(userId, traits = {}) {
    if (!this.initialized) {
      throw new Error('[BotBuilderTours] SDK not initialized. Call init() first.');
    }
    this.userId = userId;
    this.userTraits = {
      ...this.userTraits,
      ...traits
    };
    this.emit('user:identified', {
      userId,
      traits: this.userTraits
    });

    // Re-check targeting after identification
    if (this.config.autoStart) {
      this._autoStartTours();
    }
    return this;
  }

  /**
   * Manually start a tour
   * @param {string} tourId - Tour ID
   */
  async startTour(tourId) {
    if (!this.initialized) {
      throw new Error('[BotBuilderTours] SDK not initialized. Call init() first.');
    }
    if (this.currentTour) {
      console.warn('[BotBuilderTours] A tour is already running. End it first.');
      return;
    }
    try {
      const tour = await this.engine.loadTour(tourId);
      if (!tour) {
        console.error(`[BotBuilderTours] Tour ${tourId} not found`);
        return;
      }
      this.currentTour = tour;
      this.currentStepIndex = 0;

      // Check for saved progress
      const progress = getProgress(tourId);
      if (progress && progress.currentStep > 0) {
        this.currentStepIndex = progress.currentStep;
      }
      this.emit('tour:started', {
        tour: this.currentTour,
        stepIndex: this.currentStepIndex
      });
      this.engine.trackEvent('tour_started', {
        tourId
      });
      this._showCurrentStep();
    } catch (error) {
      console.error('[BotBuilderTours] Failed to start tour:', error);
      this.emit('tour:error', {
        tourId,
        error
      });
    }
  }

  /**
   * End the current tour
   * @param {boolean} [completed=true] - Whether tour was completed or dismissed
   */
  endTour(completed = true) {
    if (!this.currentTour) {
      return;
    }
    const tour = this.currentTour;
    const eventType = completed ? 'tour:completed' : 'tour:dismissed';
    this.renderer.destroy();
    this.engine.trackEvent(completed ? 'tour_completed' : 'tour_dismissed', {
      tourId: tour.id,
      completedSteps: this.currentStepIndex + 1,
      totalSteps: tour.steps.length
    });
    if (completed) {
      this.engine.saveProgress(tour.id, tour.steps.length - 1, 'completed');
    }
    this.emit(eventType, {
      tour,
      completedSteps: this.currentStepIndex + 1
    });
    this.currentTour = null;
    this.currentStepIndex = 0;
  }

  /**
   * Go to next step
   */
  nextStep() {
    if (!this.currentTour) {
      return;
    }
    const tour = this.currentTour;
    if (this.currentStepIndex >= tour.steps.length - 1) {
      // Last step, complete the tour
      this.endTour(true);
      return;
    }
    this.emit('step:completed', {
      tour,
      step: tour.steps[this.currentStepIndex],
      stepIndex: this.currentStepIndex
    });
    this.currentStepIndex++;
    this.engine.saveProgress(tour.id, this.currentStepIndex, 'in_progress');
    this._showCurrentStep();
  }

  /**
   * Go to previous step
   */
  prevStep() {
    if (!this.currentTour || this.currentStepIndex === 0) {
      return;
    }
    this.currentStepIndex--;
    this._showCurrentStep();
  }

  /**
   * Skip the current tour
   */
  skipTour() {
    if (!this.currentTour) {
      return;
    }
    this.engine.saveProgress(this.currentTour.id, this.currentStepIndex, 'skipped');
    this.endTour(false);
  }

  /**
   * Go to a specific step
   * @param {number} stepIndex - Step index (0-based)
   */
  goToStep(stepIndex) {
    if (!this.currentTour) {
      return;
    }
    if (stepIndex < 0 || stepIndex >= this.currentTour.steps.length) {
      console.warn('[BotBuilderTours] Invalid step index');
      return;
    }
    this.currentStepIndex = stepIndex;
    this._showCurrentStep();
  }

  /**
   * Get current tour state
   */
  getState() {
    return {
      initialized: this.initialized,
      currentTour: this.currentTour,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.currentTour?.steps.length || 0,
      userId: this.userId,
      visitorId: this.visitorId
    };
  }

  /**
   * Reset progress for a tour
   * @param {string} tourId - Tour ID
   */
  resetProgress(tourId) {
    clearProgress(tourId);
    this.emit('progress:reset', {
      tourId
    });
  }

  /**
   * Destroy the SDK instance
   */
  destroy() {
    if (this.currentTour) {
      this.endTour(false);
    }
    if (this.renderer) {
      this.renderer.destroy();
    }
    this.removeAllListeners();
    this.initialized = false;
    this.config = null;
    this.engine = null;
    this.renderer = null;
    this.emit('sdk:destroyed');
  }

  // Private methods

  _showCurrentStep() {
    const step = this.currentTour.steps[this.currentStepIndex];
    this.renderer.renderStep(step, {
      tour: this.currentTour,
      stepIndex: this.currentStepIndex,
      totalSteps: this.currentTour.steps.length,
      onNext: () => this.nextStep(),
      onPrev: () => this.prevStep(),
      onSkip: () => this.skipTour(),
      onClose: () => this.endTour(false)
    });
    this.emit('step:viewed', {
      tour: this.currentTour,
      step,
      stepIndex: this.currentStepIndex
    });
    this.engine.trackEvent('step_viewed', {
      tourId: this.currentTour.id,
      stepId: step.id,
      stepIndex: this.currentStepIndex
    });
  }
  async _autoStartTours() {
    try {
      const tours = await this.engine.loadActiveTours();
      for (const tour of tours) {
        const context = {
          url: window.location.href,
          pathname: window.location.pathname,
          userId: this.userId,
          visitorId: this.visitorId,
          userTraits: this.userTraits
        };
        if (this.engine.shouldShowTour(tour, context)) {
          await this.startTour(tour.id);
          break; // Only start one tour at a time
        }
      }
    } catch (error) {
      console.error('[BotBuilderTours] Failed to auto-start tours:', error);
    }
  }
  _applyTheme(theme) {
    document.documentElement.setAttribute('data-botbuilder-theme', theme);
  }
}

// Create singleton instance
const instance = new TourSDK();

// Export as global for UMD
if (typeof window !== 'undefined') {
  window.BotBuilderTours = instance;
}

/**
 * BotBuilder Tours SDK
 * Entry point for the SDK
 *
 * Usage:
 * <script src="https://yourdomain.com/tours-sdk.min.js"></script>
 * <script>
 *   BotBuilderTours.init({ apiKey: 'xxx' });
 *   BotBuilderTours.startTour('tour-id');
 * </script>
 *
 * SDK Methods:
 * - init(config)        Initialize the SDK
 * - startTour(tourId)   Start a specific tour
 * - stopTour()          Stop the current tour
 * - nextStep()          Go to next step
 * - prevStep()          Go to previous step
 * - goToStep(index)     Go to a specific step
 * - onComplete(cb)      Register completion callback
 * - onSkip(cb)          Register skip callback
 */


// SDK instance (singleton)
const sdk = instance;

// ==========================================
// PUBLIC API METHODS
// ==========================================

/**
 * Initialize the SDK
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - API key (alias for workspaceId)
 * @param {string} [config.workspaceId] - Workspace ID
 * @param {string} [config.userId] - User ID for targeting
 * @param {boolean} [config.autoStart=true] - Auto start tours
 * @param {string} [config.theme='light'] - Theme: 'light' or 'dark'
 */
function init(config) {
  // Support apiKey as alias for workspaceId
  const normalizedConfig = {
    ...config,
    workspaceId: config.workspaceId || config.apiKey
  };
  return sdk.init(normalizedConfig);
}

/**
 * Start a specific tour
 * @param {string} tourId - Tour ID to start
 */
function startTour(tourId) {
  return sdk.startTour(tourId);
}

/**
 * Stop the current tour
 * Alias for endTour(false)
 */
function stopTour() {
  return sdk.endTour(false);
}

/**
 * Go to the next step
 */
function nextStep() {
  return sdk.nextStep();
}

/**
 * Go to the previous step
 */
function prevStep() {
  return sdk.prevStep();
}

/**
 * Go to a specific step
 * @param {number} index - Step index (0-based)
 */
function goToStep(index) {
  return sdk.goToStep(index);
}

/**
 * Register a callback for tour completion
 * @param {Function} callback - Callback function
 */
function onComplete(callback) {
  sdk.on('tour:completed', callback);
  return sdk;
}

/**
 * Register a callback for tour skip
 * @param {Function} callback - Callback function
 */
function onSkip(callback) {
  sdk.on('tour:dismissed', callback);
  return sdk;
}

/**
 * Register a callback for step viewed
 * @param {Function} callback - Callback function
 */
function onStepViewed(callback) {
  sdk.on('step:viewed', callback);
  return sdk;
}

/**
 * Register a callback for step completed
 * @param {Function} callback - Callback function
 */
function onStepComplete(callback) {
  sdk.on('step:completed', callback);
  return sdk;
}

/**
 * Register a callback for tour started
 * @param {Function} callback - Callback function
 */
function onStart(callback) {
  sdk.on('tour:started', callback);
  return sdk;
}

/**
 * Identify a user
 * @param {string} userId - User ID
 * @param {Object} [traits] - User traits for targeting
 */
function identify(userId, traits) {
  return sdk.identify(userId, traits);
}

/**
 * Get current tour state
 */
function getState() {
  return sdk.getState();
}

/**
 * Reset progress for a tour
 * @param {string} tourId - Tour ID
 */
function resetProgress(tourId) {
  return sdk.resetProgress(tourId);
}

/**
 * Destroy the SDK instance
 */
function destroy() {
  return sdk.destroy();
}

/**
 * End tour (alias with completion status)
 * @param {boolean} [completed=true] - Whether tour was completed
 */
function endTour(completed = true) {
  return sdk.endTour(completed);
}

/**
 * Skip current tour
 */
function skipTour() {
  return sdk.skipTour();
}

// Default export - SDK instance with all methods
var index = {
  // SDK instance
  sdk,
  // Public API methods
  init,
  startTour,
  stopTour,
  nextStep,
  prevStep,
  goToStep,
  onComplete,
  onSkip,
  onStepViewed,
  onStepComplete,
  onStart,
  identify,
  getState,
  resetProgress,
  destroy,
  endTour,
  skipTour,
  // Classes
  TourSDK,
  TourEngine,
  TourRenderer,
  EventEmitter,
  EVENTS
};

export { EVENTS, EventEmitter, Highlight, Hotspot, Modal, Overlay, ProgressBar, ProgressDots, Slideout, Tooltip, TourEngine, TourRenderer, TourSDK, adjustForViewport, batchTrackEvents, calculateArrowOffset, calculateModalPosition, calculatePosition, calculateSlideoutPosition, checkOverflow, clearAllProgress, clearProgress, clearSession, createFocusTrap, createTypedEmitter, debounce, index as default, destroy, dismissTourForSession, endTour, fetchActiveTours, fetchProgress, fetchTour, findElement, getAllProgress, getArrowPosition, getCenteredPosition, getCurrentStep, getElementPosition, getFocusableElements, getOptimalPosition, getProgress, getSession, getState, getStorageInfo, getVisitorId, getZIndex, goToStep, hasTourBeenSeen, highlightElement, identify, init, initApi, initSession, isElementFullyVisible, isElementVisible, isTourCompleted, isTourDismissedForSession, isTourSkipped, markTourAsSeen, nextStep, onComplete, onSkip, onStart, onStepComplete, onStepViewed, prevStep, queueEvent, reportError, resetProgress, scrollToElement, setProgress, setSession, setVisitorId, skipTour, startTour, stopTour, syncProgress, throttle, trackEvent, waitForElement, waitForElementVisible };
//# sourceMappingURL=tours-sdk.esm.js.map
