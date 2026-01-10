/**
 * BotBuilder API Client
 * Handles HTTP requests to the BotBuilder API
 */

const { BotBuilderError, AuthenticationError, NotFoundError, ValidationError, RateLimitError } = require('./utils/errors');

// Use native fetch in Node 18+, fallback to node-fetch
const fetch = globalThis.fetch || require('node-fetch');

class BotBuilderClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || 'http://localhost:5000').replace(/\/$/, '');
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.debug = options.debug || false;

    this._token = options.token || null;
    this._apiKey = options.apiKey || null;
  }

  /**
   * Set JWT token
   */
  setToken(token) {
    this._token = token;
    this._apiKey = null;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey) {
    this._apiKey = apiKey;
    this._token = null;
  }

  /**
   * Get authorization headers
   */
  _getAuthHeaders() {
    const headers = {};

    if (this._token) {
      headers['Authorization'] = `Bearer ${this._token}`;
    } else if (this._apiKey) {
      headers['X-API-Key'] = this._apiKey;
    }

    return headers;
  }

  /**
   * Log debug message
   */
  _debug(...args) {
    if (this.debug) {
      console.log('[BotBuilder SDK]', ...args);
    }
  }

  /**
   * Make HTTP request to API
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {Object} [data] - Request body
   * @param {Object} [options] - Additional options
   * @returns {Promise<Object>} Response data
   */
  async request(method, path, data = null, options = {}) {
    const url = `${this.baseUrl}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...this._getAuthHeaders(),
      ...options.headers
    };

    const fetchOptions = {
      method,
      headers,
      timeout: this.timeout
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = JSON.stringify(data);
    }

    this._debug(`${method} ${url}`, data);

    let lastError;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        fetchOptions.signal = controller.signal;

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        const responseData = await response.json().catch(() => ({}));

        this._debug(`Response ${response.status}:`, responseData);

        if (!response.ok) {
          throw this._handleError(response.status, responseData);
        }

        return responseData;

      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error instanceof AuthenticationError ||
            error instanceof NotFoundError ||
            error instanceof ValidationError) {
          throw error;
        }

        // Don't retry on rate limit
        if (error instanceof RateLimitError) {
          throw error;
        }

        // Retry on network/server errors
        if (attempt < this.retries) {
          const delay = Math.pow(2, attempt) * 100;
          this._debug(`Retry attempt ${attempt + 1} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Handle error response
   */
  _handleError(status, data) {
    const message = data.message || data.error || 'Unknown error';

    switch (status) {
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthenticationError(message);
      case 404:
        return new NotFoundError(message);
      case 400:
      case 422:
        return new ValidationError(message, data);
      case 429:
        return new RateLimitError(message, data);
      default:
        return new BotBuilderError(message, status);
    }
  }

  /**
   * GET request
   */
  get(path, options) {
    return this.request('GET', path, null, options);
  }

  /**
   * POST request
   */
  post(path, data, options) {
    return this.request('POST', path, data, options);
  }

  /**
   * PUT request
   */
  put(path, data, options) {
    return this.request('PUT', path, data, options);
  }

  /**
   * DELETE request
   */
  delete(path, options) {
    return this.request('DELETE', path, null, options);
  }
}

module.exports = BotBuilderClient;
