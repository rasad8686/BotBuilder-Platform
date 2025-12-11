/**
 * HTTP Tool for Autonomous Agents
 * Performs HTTP requests (GET, POST, PUT, DELETE)
 */

const log = require('../../../utils/logger');

class HttpTool {
  constructor() {
    this.name = 'http_request';
    this.description = 'Make HTTP requests to external APIs and services';
    this.parameters = {
      method: {
        type: 'string',
        required: true,
        description: 'HTTP method (GET, POST, PUT, DELETE, PATCH)',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      },
      url: {
        type: 'string',
        required: true,
        description: 'The URL to send the request to'
      },
      headers: {
        type: 'object',
        required: false,
        description: 'Request headers',
        default: {}
      },
      body: {
        type: 'object',
        required: false,
        description: 'Request body for POST/PUT/PATCH requests'
      },
      timeout: {
        type: 'number',
        required: false,
        description: 'Request timeout in milliseconds',
        default: 30000
      },
      responseType: {
        type: 'string',
        required: false,
        description: 'Expected response type (json, text)',
        default: 'json'
      }
    };
  }

  /**
   * Execute HTTP request
   */
  async execute(params, context = {}) {
    const {
      method,
      url,
      headers = {},
      body,
      timeout = 30000,
      responseType = 'json'
    } = params;

    // Validate URL
    if (!url || !this.isValidUrl(url)) {
      return {
        success: false,
        error: 'Invalid URL provided'
      };
    }

    // Security check - block internal/localhost URLs
    if (this.isBlockedUrl(url)) {
      return {
        success: false,
        error: 'Access to internal URLs is not allowed'
      };
    }

    const startTime = Date.now();

    try {
      log.info('HttpTool: Executing request', { method, url });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions = {
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'BotBuilder-Agent/1.0',
          ...headers
        },
        signal: controller.signal
      };

      // Add body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body) {
        if (!headers['Content-Type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // Get response data
      let data;
      const contentType = response.headers.get('content-type') || '';

      if (responseType === 'json' && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
        // Try to parse as JSON if it looks like JSON
        if (responseType === 'json' && data.startsWith('{') || data.startsWith('[')) {
          try {
            data = JSON.parse(data);
          } catch {
            // Keep as text
          }
        }
      }

      // Log execution
      this.logExecution(context, {
        method,
        url,
        status: response.status,
        duration,
        success: response.ok
      });

      log.info('HttpTool: Request completed', {
        method,
        url,
        status: response.status,
        duration
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      log.error('HttpTool: Request failed', {
        method,
        url,
        error: error.message,
        duration
      });

      // Log failed execution
      this.logExecution(context, {
        method,
        url,
        error: error.message,
        duration,
        success: false
      });

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `Request timeout after ${timeout}ms`,
          duration
        };
      }

      return {
        success: false,
        error: error.message,
        duration
      };
    }
  }

  /**
   * Validate URL format
   */
  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Check if URL is blocked (internal/localhost)
   */
  isBlockedUrl(urlString) {
    try {
      const url = new URL(urlString);
      const hostname = url.hostname.toLowerCase();

      // Block localhost and internal IPs
      const blockedPatterns = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '10.',
        '172.16.',
        '172.17.',
        '172.18.',
        '172.19.',
        '172.20.',
        '172.21.',
        '172.22.',
        '172.23.',
        '172.24.',
        '172.25.',
        '172.26.',
        '172.27.',
        '172.28.',
        '172.29.',
        '172.30.',
        '172.31.',
        '192.168.',
        '169.254.'
      ];

      return blockedPatterns.some(pattern => hostname.startsWith(pattern));
    } catch {
      return true;
    }
  }

  /**
   * Log tool execution
   */
  logExecution(context, details) {
    if (!context.toolLogs) {
      context.toolLogs = [];
    }

    context.toolLogs.push({
      tool: this.name,
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Get tool definition for registry
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      execute: this.execute.bind(this)
    };
  }
}

module.exports = HttpTool;
