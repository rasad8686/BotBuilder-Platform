/**
 * @fileoverview Banner management hook for fetching and dismissing banners
 * @module hooks/useBanners
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import useApi from './useApi';
import useLocalStorage from './useLocalStorage';

const DISMISSED_BANNERS_KEY = 'dismissed_banners';
const BANNERS_CACHE_KEY = 'banners_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Custom hook for managing in-app banners
 * @returns {Object} Banner state and operations
 * @property {Array} banners - List of active banners
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message
 * @property {Function} dismissBanner - Dismiss a banner
 * @property {Function} refreshBanners - Refresh banners from API
 * @property {Function} isBannerDismissed - Check if banner is dismissed
 */
const useBanners = () => {
  const { get, post, loading, error } = useApi();
  const [banners, setBanners] = useState([]);
  const [dismissedBanners, setDismissedBanners] = useLocalStorage(DISMISSED_BANNERS_KEY, []);
  const [networkError, setNetworkError] = useState(null);
  const lastFetchRef = useRef(0);

  /**
   * Get cached banners from localStorage
   * @returns {Object|null} Cached data or null if expired/missing
   */
  const getCachedBanners = useCallback(() => {
    try {
      const cached = localStorage.getItem(BANNERS_CACHE_KEY);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < CACHE_DURATION) {
        return data;
      }

      // Cache expired, remove it
      localStorage.removeItem(BANNERS_CACHE_KEY);
      return null;
    } catch (err) {
      console.warn('Failed to read banner cache:', err);
      return null;
    }
  }, []);

  /**
   * Save banners to cache
   * @param {Array} data - Banners to cache
   */
  const setCachedBanners = useCallback((data) => {
    try {
      localStorage.setItem(BANNERS_CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.warn('Failed to cache banners:', err);
    }
  }, []);

  /**
   * Process and filter banners
   * @param {Array} activeBanners - Raw banners from API or cache
   * @returns {Array} Processed visible banners
   */
  const processBanners = useCallback((activeBanners) => {
    // Filter out dismissed banners
    const visibleBanners = Array.isArray(activeBanners)
      ? activeBanners.filter(banner => !dismissedBanners.includes(banner.id))
      : [];

    // Sort by priority (higher priority first)
    visibleBanners.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return visibleBanners;
  }, [dismissedBanners]);

  /**
   * Fetch active banners from API with caching
   * @param {boolean} forceRefresh - Skip cache and fetch from API
   */
  const fetchBanners = useCallback(async (forceRefresh = false) => {
    // Debounce rapid calls
    const now = Date.now();
    if (!forceRefresh && now - lastFetchRef.current < 1000) {
      return;
    }
    lastFetchRef.current = now;

    // Try cache first if not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedBanners();
      if (cached) {
        setBanners(processBanners(cached));
        setNetworkError(null);
        return;
      }
    }

    try {
      const response = await get('/banners');
      const activeBanners = response?.banners || response?.data || response || [];

      // Cache the response
      setCachedBanners(activeBanners);

      // Process and set banners
      setBanners(processBanners(activeBanners));
      setNetworkError(null);
    } catch (err) {
      console.error('Failed to fetch banners:', err);
      setNetworkError(err.message || 'Network error');

      // Try to use stale cache on error
      const cached = getCachedBanners();
      if (cached) {
        setBanners(processBanners(cached));
      } else {
        setBanners([]);
      }
    }
  }, [get, getCachedBanners, setCachedBanners, processBanners]);

  /**
   * Dismiss a banner
   * @param {string|number} bannerId - Banner ID to dismiss
   */
  const dismissBanner = useCallback(async (bannerId) => {
    try {
      // Call API to record dismissal
      await post(`/banners/${bannerId}/dismiss`);
    } catch (err) {
      // Continue even if API fails - still dismiss locally
      console.warn('Failed to record banner dismissal:', err);
    }

    // Add to dismissed list in localStorage
    setDismissedBanners(prev => {
      if (!prev.includes(bannerId)) {
        return [...prev, bannerId];
      }
      return prev;
    });

    // Remove from current banners
    setBanners(prev => prev.filter(banner => banner.id !== bannerId));
  }, [post, setDismissedBanners]);

  /**
   * Check if a banner is dismissed
   * @param {string|number} bannerId - Banner ID to check
   * @returns {boolean} Whether banner is dismissed
   */
  const isBannerDismissed = useCallback((bannerId) => {
    return dismissedBanners.includes(bannerId);
  }, [dismissedBanners]);

  /**
   * Refresh banners from API (forces cache bypass)
   */
  const refreshBanners = useCallback(() => {
    fetchBanners(true);
  }, [fetchBanners]);

  /**
   * Retry fetching banners after network error
   */
  const retryFetch = useCallback(() => {
    setNetworkError(null);
    fetchBanners(true);
  }, [fetchBanners]);

  /**
   * Invalidate cache (useful after admin changes)
   */
  const invalidateCache = useCallback(() => {
    try {
      localStorage.removeItem(BANNERS_CACHE_KEY);
    } catch (err) {
      console.warn('Failed to invalidate banner cache:', err);
    }
  }, []);

  /**
   * Clear all dismissed banners (useful for testing)
   */
  const clearDismissed = useCallback(() => {
    setDismissedBanners([]);
  }, [setDismissedBanners]);

  // Fetch banners on mount
  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  return {
    banners,
    loading,
    error,
    networkError,
    dismissBanner,
    refreshBanners,
    retryFetch,
    isBannerDismissed,
    clearDismissed,
    invalidateCache
  };
};

export default useBanners;
