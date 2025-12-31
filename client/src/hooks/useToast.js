/**
 * @fileoverview Toast notification hook for displaying alerts
 * @module hooks/useToast
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Toast notification types
 * @typedef {'success' | 'error' | 'warning' | 'info'} ToastType
 */

/**
 * Toast notification object
 * @typedef {Object} Toast
 * @property {string} id - Unique toast ID
 * @property {string} message - Toast message
 * @property {ToastType} type - Toast type
 * @property {number} duration - Display duration in ms
 * @property {boolean} dismissible - Whether toast can be dismissed
 */

/**
 * Custom hook for managing toast notifications
 * @param {Object} options - Configuration options
 * @param {number} options.defaultDuration - Default duration in ms (default: 5000)
 * @param {number} options.maxToasts - Maximum simultaneous toasts (default: 5)
 * @param {string} options.position - Toast position (default: 'top-right')
 * @returns {Object} Toast state and methods
 * @property {Toast[]} toasts - Array of active toasts
 * @property {Function} show - Show a toast (message, options) => id
 * @property {Function} success - Show success toast (message, options) => id
 * @property {Function} error - Show error toast (message, options) => id
 * @property {Function} warning - Show warning toast (message, options) => id
 * @property {Function} info - Show info toast (message, options) => id
 * @property {Function} dismiss - Dismiss a toast by ID
 * @property {Function} dismissAll - Dismiss all toasts
 *
 * @example
 * const { toasts, success, error, dismiss } = useToast();
 *
 * const handleSave = async () => {
 *   try {
 *     await saveData();
 *     success('Data saved successfully!');
 *   } catch (err) {
 *     error('Failed to save data');
 *   }
 * };
 *
 * // Render toasts
 * <ToastContainer toasts={toasts} onDismiss={dismiss} />
 */
const useToast = (options = {}) => {
  const {
    defaultDuration = 5000,
    maxToasts = 5,
    position = 'top-right'
  } = options;

  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const timeoutRefs = useRef({});

  /**
   * Generate unique toast ID
   * @returns {string} Unique ID
   */
  const generateId = useCallback(() => {
    toastIdRef.current += 1;
    return `toast-${toastIdRef.current}-${Date.now()}`;
  }, []);

  /**
   * Dismiss a toast by ID
   * @param {string} id - Toast ID to dismiss
   */
  const dismiss = useCallback((id) => {
    // Clear timeout if exists
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }

    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  /**
   * Dismiss all toasts
   */
  const dismissAll = useCallback(() => {
    // Clear all timeouts
    Object.values(timeoutRefs.current).forEach(clearTimeout);
    timeoutRefs.current = {};

    setToasts([]);
  }, []);

  /**
   * Show a toast notification
   * @param {string} message - Toast message
   * @param {Object} toastOptions - Toast options
   * @param {ToastType} toastOptions.type - Toast type
   * @param {number} toastOptions.duration - Display duration
   * @param {boolean} toastOptions.dismissible - Whether dismissible
   * @returns {string} Toast ID
   */
  const show = useCallback((message, toastOptions = {}) => {
    const {
      type = 'info',
      duration = defaultDuration,
      dismissible = true,
      title,
      action
    } = toastOptions;

    const id = generateId();

    const toast = {
      id,
      message,
      type,
      duration,
      dismissible,
      title,
      action,
      position,
      createdAt: Date.now()
    };

    setToasts(prev => {
      // Remove oldest if at max
      const newToasts = prev.length >= maxToasts
        ? prev.slice(1)
        : prev;
      return [...newToasts, toast];
    });

    // Auto dismiss after duration
    if (duration > 0) {
      timeoutRefs.current[id] = setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, [defaultDuration, maxToasts, position, generateId, dismiss]);

  /**
   * Show a success toast
   * @param {string} message - Toast message
   * @param {Object} toastOptions - Additional options
   * @returns {string} Toast ID
   */
  const success = useCallback((message, toastOptions = {}) => {
    return show(message, { ...toastOptions, type: 'success' });
  }, [show]);

  /**
   * Show an error toast
   * @param {string} message - Toast message
   * @param {Object} toastOptions - Additional options
   * @returns {string} Toast ID
   */
  const error = useCallback((message, toastOptions = {}) => {
    return show(message, {
      ...toastOptions,
      type: 'error',
      duration: toastOptions.duration || 8000 // Longer duration for errors
    });
  }, [show]);

  /**
   * Show a warning toast
   * @param {string} message - Toast message
   * @param {Object} toastOptions - Additional options
   * @returns {string} Toast ID
   */
  const warning = useCallback((message, toastOptions = {}) => {
    return show(message, { ...toastOptions, type: 'warning' });
  }, [show]);

  /**
   * Show an info toast
   * @param {string} message - Toast message
   * @param {Object} toastOptions - Additional options
   * @returns {string} Toast ID
   */
  const info = useCallback((message, toastOptions = {}) => {
    return show(message, { ...toastOptions, type: 'info' });
  }, [show]);

  /**
   * Show a promise-based toast (loading -> success/error)
   * @param {Promise} promise - Promise to track
   * @param {Object} messages - Toast messages
   * @param {string} messages.loading - Loading message
   * @param {string} messages.success - Success message
   * @param {string|Function} messages.error - Error message or function
   * @returns {Promise} Original promise result
   */
  const promise = useCallback(async (promiseToTrack, messages = {}) => {
    const {
      loading = 'Loading...',
      success: successMsg = 'Success!',
      error: errorMsg = 'Something went wrong'
    } = messages;

    const id = show(loading, { type: 'info', duration: 0 });

    try {
      const result = await promiseToTrack;
      dismiss(id);
      success(typeof successMsg === 'function' ? successMsg(result) : successMsg);
      return result;
    } catch (err) {
      dismiss(id);
      const errMessage = typeof errorMsg === 'function' ? errorMsg(err) : errorMsg;
      error(errMessage);
      throw err;
    }
  }, [show, dismiss, success, error]);

  return {
    toasts,
    show,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
    promise
  };
};

export default useToast;
