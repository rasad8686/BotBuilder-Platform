/**
 * TourEngine - Handles tour logic, targeting, and API communication
 */

import { fetchActiveTours, fetchTour, trackEvent as apiTrackEvent, syncProgress } from './utils/api';
import { getProgress, setProgress } from './utils/storage';

export class TourEngine {
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
        userId: this.sdk.userId,
      });

      this.activeToursCache = tours;
      this.lastFetch = now;

      // Cache individual tours
      tours.forEach((tour) => {
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
      timestamp: Date.now(),
    };

    const { operator = 'AND', rules } = tour.targeting;

    if (operator === 'AND') {
      return rules.every((rule) => this._evaluateRule(rule, context));
    } else if (operator === 'OR') {
      return rules.some((rule) => this._evaluateRule(rule, context));
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
      await apiTrackEvent({
        eventType,
        ...data,
        visitorId: this.sdk.visitorId,
        userId: this.sdk.userId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
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
      updatedAt: new Date().toISOString(),
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
    const { type, field, operator, value } = rule;

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
        return list.map((v) => v.trim().toLowerCase()).includes(strValue);
      case 'not_in_list':
        const notList = Array.isArray(targetValue) ? targetValue : targetValue.split(',');
        return !notList.map((v) => v.trim().toLowerCase()).includes(strValue);
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
      language: navigator.language,
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
