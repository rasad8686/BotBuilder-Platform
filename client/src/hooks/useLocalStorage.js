/**
 * @fileoverview Local storage hook with automatic JSON serialization
 * @module hooks/useLocalStorage
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing localStorage with automatic JSON parsing
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value if key doesn't exist
 * @param {Object} options - Configuration options
 * @param {boolean} options.serialize - Use JSON serialization (default: true)
 * @param {Function} options.onError - Error handler callback
 * @returns {Array} [storedValue, setValue, removeValue]
 * @property {any} 0 - Current stored value
 * @property {Function} 1 - Set value function
 * @property {Function} 2 - Remove value function
 *
 * @example
 * const [theme, setTheme, removeTheme] = useLocalStorage('theme', 'light');
 * const [user, setUser] = useLocalStorage('user', null);
 *
 * setTheme('dark');
 * setUser({ name: 'John', email: 'john@example.com' });
 */
const useLocalStorage = (key, initialValue, options = {}) => {
  const {
    serialize = true,
    onError
  } = options;

  /**
   * Get value from localStorage
   * @returns {any} Stored value or initial value
   */
  const readValue = useCallback(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);

      if (item === null) {
        return initialValue;
      }

      return serialize ? JSON.parse(item) : item;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      onError?.(error);
      return initialValue;
    }
  }, [key, initialValue, serialize, onError]);

  const [storedValue, setStoredValue] = useState(readValue);

  /**
   * Set value in localStorage
   * @param {any|Function} value - Value to store or updater function
   */
  const setValue = useCallback((value) => {
    if (typeof window === 'undefined') {
      console.warn('localStorage is not available');
      return;
    }

    try {
      // Handle function updates
      const valueToStore = value instanceof Function
        ? value(storedValue)
        : value;

      // Save to state
      setStoredValue(valueToStore);

      // Save to localStorage
      const serializedValue = serialize
        ? JSON.stringify(valueToStore)
        : valueToStore;

      window.localStorage.setItem(key, serializedValue);

      // Dispatch storage event for other tabs/windows
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: serializedValue
      }));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
      onError?.(error);
    }
  }, [key, storedValue, serialize, onError]);

  /**
   * Remove value from localStorage
   */
  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') {
      console.warn('localStorage is not available');
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);

      // Dispatch storage event
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: null
      }));
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
      onError?.(error);
    }
  }, [key, initialValue, onError]);

  // Listen for changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const newValue = serialize
            ? JSON.parse(event.newValue)
            : event.newValue;
          setStoredValue(newValue);
        } catch (error) {
          console.warn('Error parsing storage event:', error);
        }
      } else if (event.key === key && event.newValue === null) {
        setStoredValue(initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue, serialize]);

  return [storedValue, setValue, removeValue];
};

/**
 * Hook for managing multiple localStorage keys
 * @param {Object} keys - Object with key names and initial values
 * @returns {Object} Storage operations
 *
 * @example
 * const storage = useLocalStorageState({
 *   theme: 'light',
 *   language: 'en',
 *   notifications: true
 * });
 *
 * storage.get('theme'); // 'light'
 * storage.set('theme', 'dark');
 * storage.remove('theme');
 */
export const useLocalStorageState = (keys) => {
  const [state, setState] = useState(() => {
    const initial = {};
    Object.entries(keys).forEach(([key, defaultValue]) => {
      try {
        const item = localStorage.getItem(key);
        initial[key] = item ? JSON.parse(item) : defaultValue;
      } catch {
        initial[key] = defaultValue;
      }
    });
    return initial;
  });

  const get = useCallback((key) => state[key], [state]);

  const set = useCallback((key, value) => {
    setState(prev => {
      const newState = { ...prev, [key]: value };
      localStorage.setItem(key, JSON.stringify(value));
      return newState;
    });
  }, []);

  const remove = useCallback((key) => {
    setState(prev => {
      const { [key]: removed, ...rest } = prev;
      localStorage.removeItem(key);
      return { ...rest, [key]: keys[key] };
    });
  }, [keys]);

  const clear = useCallback(() => {
    Object.keys(keys).forEach(key => localStorage.removeItem(key));
    setState(keys);
  }, [keys]);

  return { state, get, set, remove, clear };
};

export default useLocalStorage;
