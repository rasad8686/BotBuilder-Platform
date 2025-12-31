/**
 * @fileoverview API hook for making HTTP requests with automatic error handling
 * @module hooks/useApi
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Custom hook for making API requests with loading and error states
 * @param {Object} options - Configuration options
 * @param {string} options.baseUrl - Base URL for API requests (default: '/api')
 * @param {Object} options.defaultHeaders - Default headers for all requests
 * @returns {Object} API methods and state
 * @property {any} data - Response data from last successful request
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message if request fails
 * @property {Function} get - GET request (url, config) => Promise
 * @property {Function} post - POST request (url, body, config) => Promise
 * @property {Function} put - PUT request (url, body, config) => Promise
 * @property {Function} patch - PATCH request (url, body, config) => Promise
 * @property {Function} del - DELETE request (url, config) => Promise
 * @property {Function} reset - Reset data, loading, and error states
 * @property {Function} clearError - Clear error state
 *
 * @example
 * const { data, loading, error, get, post } = useApi();
 *
 * useEffect(() => {
 *   get('/users');
 * }, []);
 *
 * const handleSubmit = async (userData) => {
 *   await post('/users', userData);
 * };
 */
const useApi = (options = {}) => {
  const {
    baseUrl = '/api',
    defaultHeaders = {}
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track active requests for cancellation
  const abortControllerRef = useRef(null);

  /**
   * Get auth token from localStorage
   * @returns {string|null} JWT token
   */
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, []);

  /**
   * Make an HTTP request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL (relative to baseUrl)
   * @param {Object|null} body - Request body for POST/PUT/PATCH
   * @param {Object} config - Additional configuration
   * @returns {Promise<any>} Response data
   */
  const request = useCallback(async (method, url, body = null, config = {}) => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

    const headers = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
      ...getAuthHeaders(),
      ...config.headers
    };

    const fetchOptions = {
      method,
      headers,
      signal: abortControllerRef.current.signal,
      ...config
    };

    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(fullUrl, fetchOptions);

      // Handle no content responses
      if (response.status === 204) {
        setData(null);
        return null;
      }

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.message || responseData.error || `Request failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      setData(responseData);
      return responseData;
    } catch (err) {
      // Don't set error for aborted requests
      if (err.name === 'AbortError') {
        return;
      }

      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [baseUrl, defaultHeaders, getAuthHeaders]);

  /**
   * Make a GET request
   * @param {string} url - Request URL
   * @param {Object} config - Additional configuration
   * @returns {Promise<any>} Response data
   */
  const get = useCallback((url, config = {}) => {
    return request('GET', url, null, config);
  }, [request]);

  /**
   * Make a POST request
   * @param {string} url - Request URL
   * @param {Object} body - Request body
   * @param {Object} config - Additional configuration
   * @returns {Promise<any>} Response data
   */
  const post = useCallback((url, body, config = {}) => {
    return request('POST', url, body, config);
  }, [request]);

  /**
   * Make a PUT request
   * @param {string} url - Request URL
   * @param {Object} body - Request body
   * @param {Object} config - Additional configuration
   * @returns {Promise<any>} Response data
   */
  const put = useCallback((url, body, config = {}) => {
    return request('PUT', url, body, config);
  }, [request]);

  /**
   * Make a PATCH request
   * @param {string} url - Request URL
   * @param {Object} body - Request body
   * @param {Object} config - Additional configuration
   * @returns {Promise<any>} Response data
   */
  const patch = useCallback((url, body, config = {}) => {
    return request('PATCH', url, body, config);
  }, [request]);

  /**
   * Make a DELETE request
   * @param {string} url - Request URL
   * @param {Object} config - Additional configuration
   * @returns {Promise<any>} Response data
   */
  const del = useCallback((url, config = {}) => {
    return request('DELETE', url, null, config);
  }, [request]);

  /**
   * Reset all states
   */
  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    get,
    post,
    put,
    patch,
    del,
    delete: del,
    reset,
    clearError
  };
};

export default useApi;
