/**
 * @fileoverview Debounce hook for delaying value updates
 * @module hooks/useDebounce
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for debouncing a value
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds (default: 500)
 * @returns {any} Debounced value
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     searchApi(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 */
const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Hook for creating a debounced callback function
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 500)
 * @param {Array} deps - Dependencies array
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSave = useDebouncedCallback(
 *   (data) => saveToServer(data),
 *   1000,
 *   []
 * );
 *
 * <input onChange={(e) => debouncedSave(e.target.value)} />
 */
export const useDebouncedCallback = (callback, delay = 500, deps = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay, ...deps]);

  // Cancel function
  debouncedCallback.cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Flush function (execute immediately)
  debouncedCallback.flush = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    callbackRef.current(...args);
  }, []);

  return debouncedCallback;
};

/**
 * Hook for debounced state that also provides immediate value
 * @param {any} initialValue - Initial value
 * @param {number} delay - Delay in milliseconds
 * @returns {Object} State object with immediate and debounced values
 *
 * @example
 * const { value, debouncedValue, setValue } = useDebouncedState('', 300);
 *
 * // value updates immediately (for UI)
 * // debouncedValue updates after delay (for API calls)
 * <input value={value} onChange={(e) => setValue(e.target.value)} />
 */
export const useDebouncedState = (initialValue, delay = 500) => {
  const [value, setValue] = useState(initialValue);
  const debouncedValue = useDebounce(value, delay);

  return {
    value,
    debouncedValue,
    setValue
  };
};

/**
 * Hook for debounced effect - runs effect after value stops changing
 * @param {Function} effect - Effect function to run
 * @param {Array} deps - Dependencies array
 * @param {number} delay - Delay in milliseconds
 *
 * @example
 * useDebouncedEffect(() => {
 *   console.log('Search:', searchTerm);
 *   performSearch(searchTerm);
 * }, [searchTerm], 500);
 */
export const useDebouncedEffect = (effect, deps, delay = 500) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      effect();
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
};

export default useDebounce;
