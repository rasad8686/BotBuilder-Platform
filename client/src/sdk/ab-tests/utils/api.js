/**
 * API Utilities for A/B Test SDK
 * Handles all API communication
 */

/**
 * Make an API request
 * @param {string} url - Full URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>}
 */
async function request(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
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
    console.error(`[ABTestSDK API] Request failed: ${url}`, error);
    throw error;
  }
}

/**
 * Assign a variant to a visitor
 * @param {string} apiUrl - API base URL
 * @param {Object} data - Assignment data
 * @returns {Promise<Object>}
 */
export async function assignVariant(apiUrl, data) {
  const { testId, workspaceId, visitorId, userId, traits, context } = data;

  return request(`${apiUrl}/api/public/ab-tests/assign`, {
    method: 'POST',
    body: JSON.stringify({
      testId,
      workspaceId,
      visitorId,
      userId,
      traits,
      context,
      timestamp: new Date().toISOString(),
    }),
  });
}

/**
 * Track a conversion
 * @param {string} apiUrl - API base URL
 * @param {Object} data - Conversion data
 * @returns {Promise<Object>}
 */
export async function trackConversion(apiUrl, data) {
  return request(`${apiUrl}/api/public/ab-tests/convert`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get existing variant assignment
 * @param {string} apiUrl - API base URL
 * @param {string} testId - Test ID
 * @param {string} visitorId - Visitor ID
 * @returns {Promise<Object>}
 */
export async function getVariant(apiUrl, testId, visitorId) {
  const params = new URLSearchParams({ testId, visitorId });
  return request(`${apiUrl}/api/public/ab-tests/variant?${params.toString()}`);
}

/**
 * Get all active tests
 * @param {string} apiUrl - API base URL
 * @param {Object} data - Request data
 * @returns {Promise<Object>}
 */
export async function getActiveTests(apiUrl, data) {
  const { workspaceId, visitorId, userId, url } = data;

  const params = new URLSearchParams({
    workspaceId,
    visitorId,
  });

  if (userId) params.append('userId', userId);
  if (url) params.append('url', url);

  return request(`${apiUrl}/api/public/ab-tests?${params.toString()}`);
}

/**
 * Get test details
 * @param {string} apiUrl - API base URL
 * @param {string} testId - Test ID
 * @returns {Promise<Object>}
 */
export async function getTestDetails(apiUrl, testId) {
  return request(`${apiUrl}/api/public/ab-tests/${testId}`);
}

/**
 * Batch track multiple conversions
 * @param {string} apiUrl - API base URL
 * @param {Array} conversions - Array of conversion data
 * @returns {Promise<Object>}
 */
export async function batchTrackConversions(apiUrl, conversions) {
  return request(`${apiUrl}/api/public/ab-tests/conversions/batch`, {
    method: 'POST',
    body: JSON.stringify({ conversions }),
  });
}

/**
 * Report an error
 * @param {string} apiUrl - API base URL
 * @param {Object} errorData - Error data
 * @returns {Promise<Object>}
 */
export async function reportError(apiUrl, errorData) {
  try {
    return request(`${apiUrl}/api/public/ab-tests/error`, {
      method: 'POST',
      body: JSON.stringify({
        ...errorData,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    // Silently fail - don't want error reporting to cause more errors
    console.error('[ABTestSDK] Failed to report error:', error);
    return { success: false };
  }
}

/**
 * Send beacon for page unload events
 * @param {string} apiUrl - API base URL
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Data to send
 * @returns {boolean}
 */
export function sendBeacon(apiUrl, endpoint, data) {
  if (!navigator.sendBeacon) return false;

  try {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    return navigator.sendBeacon(`${apiUrl}${endpoint}`, blob);
  } catch (error) {
    console.error('[ABTestSDK] Failed to send beacon:', error);
    return false;
  }
}
