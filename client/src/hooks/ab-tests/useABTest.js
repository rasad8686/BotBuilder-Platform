/**
 * useABTest Hook
 * React hook for A/B testing integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import ABTestSDK from '../../sdk/ab-tests/ABTestSDK';

/**
 * Hook for getting variant and tracking conversions
 * @param {string} testId - Test ID
 * @param {Object} [options] - Options
 * @param {boolean} [options.enabled=true] - Enable/disable the test
 * @param {boolean} [options.forceRefresh=false] - Force refresh from API
 * @returns {Object} - { variant, loading, error, trackConversion, isControl }
 */
export function useABTest(testId, options = {}) {
  const { enabled = true, forceRefresh = false } = options;

  const [variant, setVariant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!testId || !enabled) {
      setLoading(false);
      return;
    }

    // Prevent double fetch in strict mode
    if (fetchedRef.current && !forceRefresh) {
      return;
    }

    const fetchVariant = async () => {
      try {
        setLoading(true);
        setError(null);

        // Check if SDK is initialized
        if (!ABTestSDK.initialized) {
          throw new Error('ABTestSDK not initialized. Call ABTestSDK.init() first.');
        }

        const result = await ABTestSDK.getVariant(testId, { forceRefresh });
        setVariant(result);
        fetchedRef.current = true;
      } catch (err) {
        setError(err);
        console.error('[useABTest] Error fetching variant:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVariant();
  }, [testId, enabled, forceRefresh]);

  /**
   * Track a conversion
   * @param {string} [type='goal'] - Conversion type
   * @param {number} [value] - Conversion value
   * @param {Object} [metadata] - Additional metadata
   */
  const trackConversion = useCallback(
    async (type = 'goal', value, metadata) => {
      if (!testId || !enabled) return false;

      try {
        return await ABTestSDK.trackConversion(testId, { type, value, metadata });
      } catch (err) {
        console.error('[useABTest] Error tracking conversion:', err);
        return false;
      }
    },
    [testId, enabled]
  );

  /**
   * Check if current variant is control
   */
  const isControl = variant?.variantName === 'control' || variant?.variantName === 'A';

  return {
    variant,
    variantId: variant?.variantId,
    variantName: variant?.variantName,
    content: variant?.content,
    loading,
    error,
    trackConversion,
    isControl,
  };
}

/**
 * Hook for getting specific variant content
 * @param {string} testId - Test ID
 * @param {*} defaultContent - Default content if no variant
 * @param {Object} [options] - Options
 * @returns {Object} - { content, variantName, loading, error, trackConversion }
 */
export function useABTestVariant(testId, defaultContent, options = {}) {
  const { variant, loading, error, trackConversion, variantName } = useABTest(testId, options);

  const content = variant?.content || defaultContent;

  return {
    content,
    variantName: variantName || 'default',
    loading,
    error,
    trackConversion,
    hasVariant: !!variant,
  };
}

/**
 * Hook for tracking when element is viewed
 * @param {string} testId - Test ID
 * @param {Object} [options] - Options
 * @returns {Object} - { ref, viewed }
 */
export function useABTestImpression(testId, options = {}) {
  const { threshold = 0.5, trackOnce = true } = options;
  const [viewed, setViewed] = useState(false);
  const elementRef = useRef(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!testId || (trackOnce && trackedRef.current)) return;

    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            if (!trackedRef.current || !trackOnce) {
              setViewed(true);
              ABTestSDK.trackConversion(testId, { type: 'impression' });
              trackedRef.current = true;

              if (trackOnce) {
                observer.disconnect();
              }
            }
          }
        });
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [testId, threshold, trackOnce]);

  return { ref: elementRef, viewed };
}

/**
 * Hook for multiple A/B tests
 * @param {string[]} testIds - Array of test IDs
 * @returns {Object} - { variants, loading, errors }
 */
export function useABTests(testIds) {
  const [variants, setVariants] = useState({});
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!testIds || testIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchVariants = async () => {
      setLoading(true);
      const newVariants = {};
      const newErrors = {};

      await Promise.all(
        testIds.map(async (testId) => {
          try {
            const result = await ABTestSDK.getVariant(testId);
            newVariants[testId] = result;
          } catch (err) {
            newErrors[testId] = err;
          }
        })
      );

      setVariants(newVariants);
      setErrors(newErrors);
      setLoading(false);
    };

    fetchVariants();
  }, [testIds?.join(',')]);

  return { variants, loading, errors };
}

export default useABTest;
