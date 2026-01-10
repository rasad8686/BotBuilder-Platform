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
export function initApi(apiUrl, workspaceId) {
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
    'X-Workspace-ID': WORKSPACE_ID,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
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
export async function initSession(workspaceId, options = {}) {
  const { visitorId, userId } = options;

  return request('/api/public/tours/init', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId,
      visitorId,
      userId,
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    }),
  });
}

/**
 * Fetch active tours for a workspace
 * @param {string} workspaceId - Workspace ID
 * @param {Object} options - Options
 * @returns {Promise<Array>}
 */
export async function fetchActiveTours(workspaceId, options = {}) {
  const { visitorId, userId } = options;

  const params = new URLSearchParams({
    workspaceId,
    url: window.location.pathname,
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
export async function fetchTour(tourId) {
  const response = await request(`/api/public/tours/${tourId}`);
  return response.tour || response;
}

/**
 * Track an analytics event
 * @param {Object} eventData - Event data
 * @returns {Promise}
 */
export async function trackEvent(eventData) {
  const payload = {
    ...eventData,
    workspaceId: WORKSPACE_ID,
    timestamp: eventData.timestamp || new Date().toISOString(),
    sessionId: getSessionId(),
    pageUrl: window.location.href,
    pageTitle: document.title,
  };

  // Use sendBeacon for reliability (especially on page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(`${API_URL}/api/public/tours/event`, blob);
    return;
  }

  // Fallback to fetch
  return request('/api/public/tours/event', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Sync progress with server
 * @param {Object} progressData - Progress data
 * @returns {Promise}
 */
export async function syncProgress(progressData) {
  return request('/api/public/tours/progress', {
    method: 'POST',
    body: JSON.stringify({
      ...progressData,
      workspaceId: WORKSPACE_ID,
    }),
  });
}

/**
 * Get user progress from server
 * @param {string} tourId - Tour ID
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<Object>}
 */
export async function fetchProgress(tourId, visitorId) {
  const params = new URLSearchParams({
    tourId,
    visitorId,
  });

  return request(`/api/public/tours/progress?${params.toString()}`);
}

/**
 * Batch track multiple events
 * @param {Array} events - Array of event data
 * @returns {Promise}
 */
export async function batchTrackEvents(events) {
  return request('/api/public/tours/events/batch', {
    method: 'POST',
    body: JSON.stringify({
      events,
      workspaceId: WORKSPACE_ID,
    }),
  });
}

/**
 * Report an error
 * @param {Object} errorData - Error data
 * @returns {Promise}
 */
export async function reportError(errorData) {
  try {
    return request('/api/public/tours/error', {
      method: 'POST',
      body: JSON.stringify({
        ...errorData,
        workspaceId: WORKSPACE_ID,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
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
export function queueEvent(eventData) {
  eventQueue.push({
    ...eventData,
    queuedAt: new Date().toISOString(),
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
      const blob = new Blob(
        [JSON.stringify({ events: eventQueue, workspaceId: WORKSPACE_ID })],
        { type: 'application/json' }
      );
      navigator.sendBeacon(`${API_URL}/api/public/tours/events/batch`, blob);
    }
  });
}
