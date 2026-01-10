/**
 * A/B Test Engine
 * Handles API communication, variant assignment, and conversion tracking
 */

import { assignVariant, trackConversion, getActiveTests, getVariant } from './utils/api';

export class ABTestEngine {
  constructor(sdk) {
    this.sdk = sdk;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  /**
   * Assign a variant to the visitor
   * @param {string} testId - Test ID
   * @returns {Promise<Object>}
   */
  async assignVariant(testId) {
    const { apiUrl, workspaceId } = this.sdk.config;
    const { visitorId, userId, userTraits } = this.sdk;

    try {
      const result = await this._retryRequest(() =>
        assignVariant(apiUrl, {
          testId,
          workspaceId,
          visitorId,
          userId,
          traits: userTraits,
          context: this._getContext(),
        })
      );

      return result;
    } catch (error) {
      console.error('[ABTestEngine] Failed to assign variant:', error);
      throw error;
    }
  }

  /**
   * Track a conversion
   * @param {string} testId - Test ID
   * @param {Object} data - Conversion data
   * @returns {Promise<Object>}
   */
  async trackConversion(testId, data) {
    const { apiUrl, workspaceId } = this.sdk.config;
    const { visitorId, userId } = this.sdk;

    const conversionData = {
      testId,
      workspaceId,
      visitorId,
      userId,
      type: data.type || 'goal',
      value: data.value,
      variantId: data.variantId,
      metadata: data.metadata,
      timestamp: new Date().toISOString(),
      context: this._getContext(),
    };

    // Use sendBeacon for reliability on page unload
    if (navigator.sendBeacon && document.visibilityState === 'hidden') {
      const blob = new Blob([JSON.stringify(conversionData)], { type: 'application/json' });
      navigator.sendBeacon(`${apiUrl}/api/public/ab-tests/convert`, blob);
      return { success: true, method: 'beacon' };
    }

    try {
      const result = await this._retryRequest(() =>
        trackConversion(apiUrl, conversionData)
      );
      return result;
    } catch (error) {
      // Queue for retry later
      this._queueRequest({
        type: 'conversion',
        data: conversionData,
        attempts: 0,
      });
      console.error('[ABTestEngine] Failed to track conversion, queued for retry:', error);
      return { success: false, queued: true };
    }
  }

  /**
   * Get all active tests
   * @returns {Promise<Array>}
   */
  async getActiveTests() {
    const { apiUrl, workspaceId } = this.sdk.config;
    const { visitorId, userId } = this.sdk;

    try {
      const result = await getActiveTests(apiUrl, {
        workspaceId,
        visitorId,
        userId,
        url: window.location.href,
      });
      return result.tests || [];
    } catch (error) {
      console.error('[ABTestEngine] Failed to get active tests:', error);
      return [];
    }
  }

  /**
   * Get existing variant assignment
   * @param {string} testId - Test ID
   * @returns {Promise<Object|null>}
   */
  async getExistingVariant(testId) {
    const { apiUrl } = this.sdk.config;
    const { visitorId } = this.sdk;

    try {
      const result = await getVariant(apiUrl, testId, visitorId);
      return result.variant || null;
    } catch (error) {
      console.error('[ABTestEngine] Failed to get existing variant:', error);
      return null;
    }
  }

  // Private methods

  _getContext() {
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString(),
    };
  }

  async _retryRequest(requestFn, attempts = 0) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempts < this.retryAttempts) {
        await this._delay(this.retryDelay * Math.pow(2, attempts));
        return this._retryRequest(requestFn, attempts + 1);
      }
      throw error;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _queueRequest(request) {
    this.requestQueue.push(request);
    this._processQueue();
  }

  async _processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();

      if (request.attempts >= this.retryAttempts) continue;

      try {
        if (request.type === 'conversion') {
          await trackConversion(this.sdk.config.apiUrl, request.data);
        }
      } catch (error) {
        request.attempts++;
        if (request.attempts < this.retryAttempts) {
          this.requestQueue.push(request);
          await this._delay(this.retryDelay * Math.pow(2, request.attempts));
        }
      }
    }

    this.isProcessingQueue = false;
  }
}
