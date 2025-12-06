/**
 * HttpTool - HTTP/REST API tool for making external API calls
 */

class HttpTool {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
  }

  /**
   * Execute HTTP request
   */
  async execute(input, context = {}) {
    const {
      url,
      method = 'GET',
      headers = {},
      queryParams = {},
      body,
      auth
    } = { ...this.config, ...input };

    // Build URL with query params
    const fullUrl = this.buildUrl(url, queryParams);

    // Build headers with authentication
    const finalHeaders = this.buildHeaders(headers, auth);

    // Prepare fetch options
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: finalHeaders
    };

    // Add body for non-GET requests
    if (body && !['GET', 'HEAD'].includes(fetchOptions.method)) {
      if (typeof body === 'object') {
        fetchOptions.body = JSON.stringify(body);
        if (!finalHeaders['Content-Type']) {
          finalHeaders['Content-Type'] = 'application/json';
        }
      } else {
        fetchOptions.body = body;
      }
    }

    // Execute with retry logic
    return await this.executeWithRetry(fullUrl, fetchOptions);
  }

  /**
   * Execute request with retry logic
   */
  async executeWithRetry(url, options) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Parse response
        const result = await this.parseResponse(response);

        return {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          data: result,
          attempt
        };
      } catch (error) {
        lastError = error;

        if (attempt < this.config.retries) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw new Error(`HTTP request failed after ${this.config.retries} attempts: ${lastError.message}`);
  }

  /**
   * Build URL with query parameters
   */
  buildUrl(baseUrl, queryParams) {
    if (!queryParams || Object.keys(queryParams).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    return url.toString();
  }

  /**
   * Build headers with authentication
   */
  buildHeaders(headers, auth) {
    const finalHeaders = { ...headers };

    if (auth) {
      switch (auth.type) {
        case 'bearer':
          finalHeaders['Authorization'] = `Bearer ${auth.token}`;
          break;
        case 'basic':
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          finalHeaders['Authorization'] = `Basic ${credentials}`;
          break;
        case 'api_key':
          if (auth.in === 'header') {
            finalHeaders[auth.name || 'X-API-Key'] = auth.value;
          }
          break;
      }
    }

    return finalHeaders;
  }

  /**
   * Parse response based on content type
   */
  async parseResponse(response) {
    const contentType = response.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        const text = await response.text();
        return { xml: text, parsed: this.parseXml(text) };
      } else {
        return await response.text();
      }
    } catch (error) {
      return await response.text();
    }
  }

  /**
   * Simple XML to object parser
   */
  parseXml(xmlString) {
    // Basic XML parsing - extract tag content
    const result = {};
    const tagRegex = /<(\w+)(?:[^>]*)>([^<]*)<\/\1>/g;
    let match;

    while ((match = tagRegex.exec(xmlString)) !== null) {
      const [, tag, content] = match;
      if (result[tag]) {
        if (!Array.isArray(result[tag])) {
          result[tag] = [result[tag]];
        }
        result[tag].push(content);
      } else {
        result[tag] = content;
      }
    }

    return result;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get input schema
   */
  static getInputSchema() {
    return {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          format: 'uri',
          description: 'The URL to send the request to'
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
          default: 'GET',
          description: 'HTTP method'
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Request headers'
        },
        queryParams: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'URL query parameters'
        },
        body: {
          oneOf: [
            { type: 'object' },
            { type: 'string' }
          ],
          description: 'Request body'
        },
        auth: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['bearer', 'basic', 'api_key']
            },
            token: { type: 'string' },
            username: { type: 'string' },
            password: { type: 'string' },
            name: { type: 'string' },
            value: { type: 'string' },
            in: { type: 'string', enum: ['header', 'query'] }
          },
          description: 'Authentication configuration'
        }
      },
      required: ['url']
    };
  }

  /**
   * Get output schema
   */
  static getOutputSchema() {
    return {
      type: 'object',
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the request was successful (2xx status)'
        },
        status: {
          type: 'integer',
          description: 'HTTP status code'
        },
        statusText: {
          type: 'string',
          description: 'HTTP status text'
        },
        headers: {
          type: 'object',
          description: 'Response headers'
        },
        data: {
          description: 'Response body (parsed JSON, XML object, or text)'
        },
        attempt: {
          type: 'integer',
          description: 'Which attempt succeeded (1-based)'
        }
      }
    };
  }

  /**
   * Get configuration schema
   */
  static getConfigSchema() {
    return {
      type: 'object',
      properties: {
        timeout: {
          type: 'integer',
          default: 30000,
          description: 'Request timeout in milliseconds'
        },
        retries: {
          type: 'integer',
          default: 3,
          minimum: 1,
          maximum: 10,
          description: 'Number of retry attempts'
        },
        retryDelay: {
          type: 'integer',
          default: 1000,
          description: 'Delay between retries in milliseconds'
        },
        baseUrl: {
          type: 'string',
          format: 'uri',
          description: 'Base URL for all requests'
        },
        defaultHeaders: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Default headers for all requests'
        }
      }
    };
  }
}

module.exports = HttpTool;
