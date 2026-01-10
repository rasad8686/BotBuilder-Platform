/**
 * HttpTool Comprehensive Tests
 * Comprehensive test suite for HTTP request tool for autonomous agents
 */

jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

global.fetch = jest.fn();

class MockAbortController {
  constructor() {
    this.signal = { aborted: false };
  }

  abort() {
    this.signal.aborted = true;
  }
}

global.AbortController = MockAbortController;

const HttpTool = require('../../../../services/autonomous/tools/HttpTool');
const log = require('../../../../utils/logger');

describe('HttpTool - Comprehensive', () => {
  let httpTool;

  beforeEach(() => {
    jest.clearAllMocks();
    httpTool = new HttpTool();
    global.fetch.mockClear();
  });

  // ====================
  // Constructor Tests
  // ====================
  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(httpTool.name).toBe('http_request');
    });

    it('should initialize with correct description', () => {
      expect(httpTool.description).toBe('Make HTTP requests to external APIs and services');
    });

    it('should define method parameter as required string with enum', () => {
      const methodParam = httpTool.parameters.method;
      expect(methodParam.type).toBe('string');
      expect(methodParam.required).toBe(true);
      expect(methodParam.description).toBe('HTTP method (GET, POST, PUT, DELETE, PATCH)');
      expect(methodParam.enum).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);
    });

    it('should define url parameter as required', () => {
      const urlParam = httpTool.parameters.url;
      expect(urlParam.type).toBe('string');
      expect(urlParam.required).toBe(true);
      expect(urlParam.description).toBe('The URL to send the request to');
    });

    it('should define headers parameter as optional object', () => {
      const headersParam = httpTool.parameters.headers;
      expect(headersParam.type).toBe('object');
      expect(headersParam.required).toBe(false);
      expect(headersParam.description).toBe('Request headers');
      expect(headersParam.default).toEqual({});
    });

    it('should define body parameter as optional', () => {
      const bodyParam = httpTool.parameters.body;
      expect(bodyParam.type).toBe('object');
      expect(bodyParam.required).toBe(false);
      expect(bodyParam.description).toBe('Request body for POST/PUT/PATCH requests');
    });

    it('should define timeout parameter with default 30000ms', () => {
      const timeoutParam = httpTool.parameters.timeout;
      expect(timeoutParam.type).toBe('number');
      expect(timeoutParam.required).toBe(false);
      expect(timeoutParam.description).toBe('Request timeout in milliseconds');
      expect(timeoutParam.default).toBe(30000);
    });

    it('should define responseType parameter with default json', () => {
      const responseTypeParam = httpTool.parameters.responseType;
      expect(responseTypeParam.type).toBe('string');
      expect(responseTypeParam.required).toBe(false);
      expect(responseTypeParam.description).toBe('Expected response type (json, text)');
      expect(responseTypeParam.default).toBe('json');
    });
  });

  // ====================
  // Execute - URL Validation
  // ====================
  describe('execute - URL validation', () => {
    it('should return error for missing URL', async () => {
      const result = await httpTool.execute({ method: 'GET' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL provided');
    });

    it('should return error for invalid URL format', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'not a valid url'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL provided');
    });

    it('should return error for FTP URLs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'ftp://example.com/file.txt'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL provided');
    });

    it('should return error for file:// URLs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'file:///etc/passwd'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL provided');
    });

    it('should return error for data: URLs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'data:text/html,<h1>Test</h1>'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL provided');
    });

    it('should return error for javascript: URLs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'javascript:alert("xss")'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL provided');
    });
  });

  // ====================
  // Execute - Blocked URLs
  // ====================
  describe('execute - blocked URLs (security)', () => {
    it('should block localhost', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://localhost:3000/api'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 127.0.0.1', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://127.0.0.1:8080/test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 0.0.0.0', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://0.0.0.0:3000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block IPv6 loopback ::1', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://[::1]:3000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 10.x.x.x private IPs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://10.0.0.1:8080'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 172.16.x.x private IPs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://172.16.0.1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 172.17.x.x private IPs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://172.17.0.1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 172.31.x.x private IPs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://172.31.255.255'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 192.168.x.x private IPs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://192.168.1.1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should block 169.254.x.x link-local IPs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://169.254.1.1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access to internal URLs is not allowed');
    });

    it('should allow public URLs', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ success: true })
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/data'
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  // ====================
  // Execute - HTTP Methods
  // ====================
  describe('execute - HTTP methods', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ result: 'success' })
      });
    });

    it('should execute GET request', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/users'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should execute POST request', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/users',
        body: { name: 'John' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should execute PUT request', async () => {
      await httpTool.execute({
        method: 'PUT',
        url: 'https://api.example.com/users/1',
        body: { name: 'Jane' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should execute DELETE request', async () => {
      await httpTool.execute({
        method: 'DELETE',
        url: 'https://api.example.com/users/1'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should execute PATCH request', async () => {
      await httpTool.execute({
        method: 'PATCH',
        url: 'https://api.example.com/users/1',
        body: { status: 'active' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    it('should convert method to uppercase', async () => {
      await httpTool.execute({
        method: 'get',
        url: 'https://api.example.com/data'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle lowercase post', async () => {
      await httpTool.execute({
        method: 'post',
        url: 'https://api.example.com/data',
        body: { key: 'value' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  // ====================
  // Execute - Request Handling
  // ====================
  describe('execute - request handling', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ data: 'response' })
      });
    });

    it('should include User-Agent header by default', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'BotBuilder-Agent/1.0'
          })
        })
      );
    });

    it('should merge custom headers with default headers', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'BotBuilder-Agent/1.0',
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
          })
        })
      );
    });

    it('should allow overriding User-Agent header', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: {
          'User-Agent': 'CustomAgent/2.0'
        }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'CustomAgent/2.0'
          })
        })
      );
    });

    it('should not include body for GET request', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        body: { should: 'not be sent' }
      });

      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.body).toBeUndefined();
    });

    it('should add Content-Type header for POST with object body', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test',
        body: { name: 'test' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should not override Content-Type if already set', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: { name: 'test' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    it('should stringify object body as JSON', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test',
        body: { name: 'John', age: 30 }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: JSON.stringify({ name: 'John', age: 30 })
        })
      );
    });

    it('should handle string body as-is', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test',
        body: 'raw string body'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: 'raw string body'
        })
      );
    });

    it('should add body for PUT requests', async () => {
      await httpTool.execute({
        method: 'PUT',
        url: 'https://api.example.com/test/1',
        body: { status: 'updated' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test/1',
        expect.objectContaining({
          body: JSON.stringify({ status: 'updated' })
        })
      );
    });

    it('should add body for PATCH requests', async () => {
      await httpTool.execute({
        method: 'PATCH',
        url: 'https://api.example.com/test/1',
        body: { partial: 'update' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test/1',
        expect.objectContaining({
          body: JSON.stringify({ partial: 'update' })
        })
      );
    });

    it('should handle empty body object', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test',
        body: {}
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: '{}'
        })
      );
    });

    it('should not add body to DELETE request', async () => {
      await httpTool.execute({
        method: 'DELETE',
        url: 'https://api.example.com/test/1',
        body: { ignored: 'body' }
      });

      const callArgs = global.fetch.mock.calls[0][1];
      expect(callArgs.body).toBeUndefined();
    });
  });

  // ====================
  // Execute - Response Handling
  // ====================
  describe('execute - response handling', () => {
    it('should parse JSON response', async () => {
      const jsonData = { id: 1, name: 'Test', active: true };
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue(jsonData)
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        responseType: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(jsonData);
    });

    it('should return text response', async () => {
      const textData = 'Plain text response';
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: jest.fn().mockResolvedValue(textData),
        json: jest.fn()
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        responseType: 'text'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(textData);
    });

    it('should auto-detect JSON in text response', async () => {
      const jsonString = '{"key": "value", "number": 123}';
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: jest.fn().mockResolvedValue(jsonString),
        json: jest.fn()
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        responseType: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ key: 'value', number: 123 });
    });

    it('should auto-detect JSON array in text response', async () => {
      const jsonString = '[1, 2, 3, 4]';
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: jest.fn().mockResolvedValue(jsonString),
        json: jest.fn()
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        responseType: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3, 4]);
    });

    it('should handle invalid JSON in text and keep as text', async () => {
      const textData = 'Not valid JSON {broken}';
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/plain']]),
        text: jest.fn().mockResolvedValue(textData),
        json: jest.fn()
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        responseType: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(textData);
    });

    it('should include response status in result', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ id: 123 })
      });

      const result = await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test'
      });

      expect(result.status).toBe(201);
      expect(result.statusText).toBe('Created');
    });

    it('should include response headers in result', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([
          ['content-type', 'application/json'],
          ['x-rate-limit', '100'],
          ['etag', 'abc123']
        ]),
        json: jest.fn().mockResolvedValue({ data: 'test' })
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(result.headers).toBeDefined();
      expect(result.headers['x-rate-limit']).toBe('100');
      expect(result.headers['etag']).toBe('abc123');
    });

    it('should handle non-OK response status', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ error: 'Not found' })
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/notfound'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found');
    });

    it('should handle 500 error response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ error: 'Server error' })
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/error'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
    });

    it('should measure request duration', async () => {
      const startTime = Date.now();
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ data: 'test' })
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(result.duration).toBeDefined();
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ====================
  // Execute - Error Handling
  // ====================
  describe('execute - error handling', () => {
    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network request failed'));

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
      expect(result.duration).toBeDefined();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      global.fetch.mockRejectedValue(timeoutError);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        timeout: 5000
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timeout after 5000ms');
    });

    it('should handle custom timeout value', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      global.fetch.mockRejectedValue(timeoutError);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        timeout: 15000
      });

      expect(result.error).toContain('15000ms');
    });

    it('should use default 30000ms timeout if not specified', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      global.fetch.mockRejectedValue(timeoutError);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(result.error).toContain('30000ms');
    });

    it('should log errors to logger', async () => {
      global.fetch.mockRejectedValue(new Error('Connection refused'));

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(log.error).toHaveBeenCalledWith(
        'HttpTool: Request failed',
        expect.objectContaining({
          error: 'Connection refused'
        })
      );
    });

    it('should handle JSON parse errors gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });

    it('should return duration even on error', async () => {
      global.fetch.mockRejectedValue(new Error('Failed'));

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      });

      expect(result.duration).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });
  });

  // ====================
  // Execute - Context Logging
  // ====================
  describe('execute - context logging (toolLogs)', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ success: true })
      });
    });

    it('should create toolLogs array if not exists', async () => {
      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(context.toolLogs).toBeDefined();
      expect(Array.isArray(context.toolLogs)).toBe(true);
    });

    it('should append to existing toolLogs', async () => {
      const context = {
        toolLogs: [{ previous: 'log' }]
      };

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(context.toolLogs.length).toBe(2);
      expect(context.toolLogs[0].previous).toBe('log');
    });

    it('should log execution with method and url', async () => {
      const context = {};

      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/create',
        body: { name: 'test' }
      }, context);

      expect(context.toolLogs[0]).toEqual(
        expect.objectContaining({
          tool: 'http_request',
          method: 'POST',
          url: 'https://api.example.com/create'
        })
      );
    });

    it('should log response status and success flag', async () => {
      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(context.toolLogs[0]).toEqual(
        expect.objectContaining({
          status: 200,
          success: true
        })
      );
    });

    it('should log duration in milliseconds', async () => {
      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(context.toolLogs[0].duration).toBeDefined();
      expect(typeof context.toolLogs[0].duration).toBe('number');
      expect(context.toolLogs[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should include timestamp in log', async () => {
      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(context.toolLogs[0].timestamp).toBeDefined();
      expect(typeof context.toolLogs[0].timestamp).toBe('string');
    });

    it('should log failed requests', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ error: 'Not found' })
      });

      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/notfound'
      }, context);

      expect(context.toolLogs[0]).toEqual(
        expect.objectContaining({
          status: 404,
          success: false
        })
      );
    });

    it('should log errors in toolLogs', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(context.toolLogs[0]).toEqual(
        expect.objectContaining({
          tool: 'http_request',
          error: 'Network error',
          success: false
        })
      );
    });

    it('should handle multiple executions with context', async () => {
      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/first'
      }, context);

      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/second'
      }, context);

      expect(context.toolLogs.length).toBe(2);
      expect(context.toolLogs[0].url).toContain('first');
      expect(context.toolLogs[1].url).toContain('second');
    });
  });

  // ====================
  // isValidUrl Tests
  // ====================
  describe('isValidUrl', () => {
    it('should accept valid http URL', () => {
      expect(httpTool.isValidUrl('http://example.com')).toBe(true);
    });

    it('should accept valid https URL', () => {
      expect(httpTool.isValidUrl('https://example.com')).toBe(true);
    });

    it('should accept https URL with port', () => {
      expect(httpTool.isValidUrl('https://example.com:8080')).toBe(true);
    });

    it('should accept https URL with path', () => {
      expect(httpTool.isValidUrl('https://example.com/api/v1/users')).toBe(true);
    });

    it('should accept https URL with query string', () => {
      expect(httpTool.isValidUrl('https://example.com/search?q=test&limit=10')).toBe(true);
    });

    it('should accept https URL with fragment', () => {
      expect(httpTool.isValidUrl('https://example.com/docs#section-1')).toBe(true);
    });

    it('should reject ftp URLs', () => {
      expect(httpTool.isValidUrl('ftp://example.com/file.txt')).toBe(false);
    });

    it('should reject file:// URLs', () => {
      expect(httpTool.isValidUrl('file:///etc/passwd')).toBe(false);
    });

    it('should reject data: URLs', () => {
      expect(httpTool.isValidUrl('data:text/html,<h1>Test</h1>')).toBe(false);
    });

    it('should reject javascript: URLs', () => {
      expect(httpTool.isValidUrl('javascript:alert("xss")')).toBe(false);
    });

    it('should reject malformed URLs', () => {
      expect(httpTool.isValidUrl('not a url')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(httpTool.isValidUrl('')).toBe(false);
    });

    it('should reject null', () => {
      expect(httpTool.isValidUrl(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(httpTool.isValidUrl(undefined)).toBe(false);
    });
  });

  // ====================
  // isBlockedUrl Tests
  // ====================
  describe('isBlockedUrl', () => {
    it('should block localhost', () => {
      expect(httpTool.isBlockedUrl('http://localhost')).toBe(true);
    });

    it('should block localhost with port', () => {
      expect(httpTool.isBlockedUrl('http://localhost:3000')).toBe(true);
    });

    it('should block 127.0.0.1', () => {
      expect(httpTool.isBlockedUrl('http://127.0.0.1')).toBe(true);
    });

    it('should block 127.0.0.1 with port', () => {
      expect(httpTool.isBlockedUrl('http://127.0.0.1:8080')).toBe(true);
    });

    it('should block 0.0.0.0', () => {
      expect(httpTool.isBlockedUrl('http://0.0.0.0')).toBe(true);
    });

    it('should block IPv6 loopback ::1', () => {
      expect(httpTool.isBlockedUrl('http://[::1]:3000')).toBe(true);
    });

    it('should block 10.0.0.0/8 addresses', () => {
      expect(httpTool.isBlockedUrl('http://10.0.0.1')).toBe(true);
      expect(httpTool.isBlockedUrl('http://10.255.255.255')).toBe(true);
    });

    it('should block 172.16.0.0/12 addresses', () => {
      expect(httpTool.isBlockedUrl('http://172.16.0.1')).toBe(true);
      expect(httpTool.isBlockedUrl('http://172.31.255.255')).toBe(true);
    });

    it('should block all 172.16-31.x.x ranges', () => {
      expect(httpTool.isBlockedUrl('http://172.16.1.1')).toBe(true);
      expect(httpTool.isBlockedUrl('http://172.20.1.1')).toBe(true);
      expect(httpTool.isBlockedUrl('http://172.31.1.1')).toBe(true);
    });

    it('should block 192.168.0.0/16 addresses', () => {
      expect(httpTool.isBlockedUrl('http://192.168.1.1')).toBe(true);
      expect(httpTool.isBlockedUrl('http://192.168.255.255')).toBe(true);
    });

    it('should block 169.254.x.x link-local addresses', () => {
      expect(httpTool.isBlockedUrl('http://169.254.1.1')).toBe(true);
    });

    it('should allow public IPv4 addresses', () => {
      expect(httpTool.isBlockedUrl('http://8.8.8.8')).toBe(false);
      expect(httpTool.isBlockedUrl('http://1.1.1.1')).toBe(false);
    });

    it('should allow public domain names', () => {
      expect(httpTool.isBlockedUrl('http://example.com')).toBe(false);
      expect(httpTool.isBlockedUrl('https://api.github.com')).toBe(false);
    });

    it('should be case-insensitive for localhost', () => {
      expect(httpTool.isBlockedUrl('http://LOCALHOST')).toBe(true);
      expect(httpTool.isBlockedUrl('http://LocalHost')).toBe(true);
    });

    it('should handle invalid URLs gracefully', () => {
      expect(httpTool.isBlockedUrl('not a valid url')).toBe(true);
    });

    it('should handle null gracefully', () => {
      expect(httpTool.isBlockedUrl(null)).toBe(true);
    });

    it('should handle undefined gracefully', () => {
      expect(httpTool.isBlockedUrl(undefined)).toBe(true);
    });
  });

  // ====================
  // logExecution Tests
  // ====================
  describe('logExecution', () => {
    it('should create toolLogs array if not exists', () => {
      const context = {};

      httpTool.logExecution(context, { method: 'GET', url: 'test' });

      expect(context.toolLogs).toBeDefined();
      expect(Array.isArray(context.toolLogs)).toBe(true);
      expect(context.toolLogs.length).toBe(1);
    });

    it('should append to existing toolLogs', () => {
      const context = {
        toolLogs: [{ existing: 'log' }]
      };

      httpTool.logExecution(context, { method: 'POST', url: 'test' });

      expect(context.toolLogs.length).toBe(2);
      expect(context.toolLogs[0].existing).toBe('log');
    });

    it('should include tool name in log', () => {
      const context = {};

      httpTool.logExecution(context, { method: 'GET' });

      expect(context.toolLogs[0].tool).toBe('http_request');
    });

    it('should include ISO timestamp in log', () => {
      const context = {};
      const beforeTime = new Date().toISOString();

      httpTool.logExecution(context, { method: 'GET' });

      const afterTime = new Date().toISOString();
      const logTimestamp = context.toolLogs[0].timestamp;

      expect(logTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(logTimestamp).toGreaterThanOrEqual(beforeTime);
      expect(logTimestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include all provided details in log', () => {
      const context = {};
      const details = {
        method: 'POST',
        url: 'https://api.example.com/test',
        status: 201,
        duration: 150,
        success: true
      };

      httpTool.logExecution(context, details);

      expect(context.toolLogs[0]).toEqual(
        expect.objectContaining(details)
      );
    });

    it('should handle error details in log', () => {
      const context = {};
      const details = {
        method: 'GET',
        url: 'https://api.example.com/test',
        error: 'Network timeout',
        duration: 5000,
        success: false
      };

      httpTool.logExecution(context, details);

      expect(context.toolLogs[0]).toEqual(
        expect.objectContaining(details)
      );
    });

    it('should handle multiple logs maintaining order', () => {
      const context = {};

      httpTool.logExecution(context, { method: 'GET', order: 1 });
      httpTool.logExecution(context, { method: 'POST', order: 2 });
      httpTool.logExecution(context, { method: 'DELETE', order: 3 });

      expect(context.toolLogs.length).toBe(3);
      expect(context.toolLogs[0].order).toBe(1);
      expect(context.toolLogs[1].order).toBe(2);
      expect(context.toolLogs[2].order).toBe(3);
    });
  });

  // ====================
  // getDefinition Tests
  // ====================
  describe('getDefinition', () => {
    it('should return object with name property', () => {
      const definition = httpTool.getDefinition();

      expect(definition.name).toBe('http_request');
    });

    it('should return object with description property', () => {
      const definition = httpTool.getDefinition();

      expect(definition.description).toBe('Make HTTP requests to external APIs and services');
    });

    it('should return object with parameters property', () => {
      const definition = httpTool.getDefinition();

      expect(definition.parameters).toBeDefined();
      expect(typeof definition.parameters).toBe('object');
    });

    it('should include method parameter in definition', () => {
      const definition = httpTool.getDefinition();

      expect(definition.parameters.method).toBeDefined();
      expect(definition.parameters.method.enum).toContain('GET');
      expect(definition.parameters.method.enum).toContain('POST');
    });

    it('should include url parameter in definition', () => {
      const definition = httpTool.getDefinition();

      expect(definition.parameters.url).toBeDefined();
      expect(definition.parameters.url.required).toBe(true);
    });

    it('should return execute function as bound method', () => {
      const definition = httpTool.getDefinition();

      expect(typeof definition.execute).toBe('function');
    });

    it('should have correct execute binding context', () => {
      const definition = httpTool.getDefinition();
      const originalExecute = httpTool.execute;

      expect(definition.execute.toString()).toContain('bound');
    });
  });

  // ====================
  // Edge Cases
  // ====================
  describe('edge cases', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ success: true })
      });
    });

    it('should handle URL with special characters', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/search?query=hello%20world&category=tech%2Fdev'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/search?query=hello%20world&category=tech%2Fdev',
        expect.any(Object)
      );
    });

    it('should handle URL with Unicode characters', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/search?q=café'
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle very long URLs', async () => {
      const longPath = 'a'.repeat(1000);
      await httpTool.execute({
        method: 'GET',
        url: `https://api.example.com/${longPath}`
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle nested object body', async () => {
      const complexBody = {
        user: {
          name: 'John',
          address: {
            street: '123 Main St',
            city: 'Springfield'
          },
          tags: ['admin', 'user']
        }
      };

      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/users',
        body: complexBody
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          body: JSON.stringify(complexBody)
        })
      );
    });

    it('should handle empty string body', async () => {
      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/test',
        body: ''
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          body: ''
        })
      );
    });

    it('should handle response with empty body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('')
      });

      const result = await httpTool.execute({
        method: 'DELETE',
        url: 'https://api.example.com/resource/1'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(204);
    });

    it('should handle very large response', async () => {
      const largeArray = Array(10000).fill({ id: 1, name: 'test' });
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue(largeArray)
      });

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/items'
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(10000);
    });

    it('should handle zero timeout gracefully', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      global.fetch.mockRejectedValue(timeoutError);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        timeout: 0
      });

      expect(result.error).toContain('0ms');
    });

    it('should handle negative timeout as positive', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';
      global.fetch.mockRejectedValue(timeoutError);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        timeout: -1000
      });

      expect(result.error).toContain('-1000ms');
    });

    it('should handle undefined headers parameter', async () => {
      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: undefined
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'BotBuilder-Agent/1.0'
          })
        })
      );
    });

    it('should handle null context', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, null);

      expect(result.success).toBe(true);
    });

    it('should handle undefined context', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, undefined);

      expect(result.success).toBe(true);
    });
  });

  // ====================
  // Integration Tests
  // ====================
  describe('integration', () => {
    it('should log successful request execution', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ id: 1 })
      });

      const context = {};

      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/items',
        headers: { 'Authorization': 'Bearer token' },
        body: { name: 'test item' }
      }, context);

      expect(log.info).toHaveBeenCalledWith(
        'HttpTool: Executing request',
        expect.objectContaining({ method: 'POST' })
      );

      expect(log.info).toHaveBeenCalledWith(
        'HttpTool: Request completed',
        expect.any(Object)
      );

      expect(context.toolLogs).toBeDefined();
      expect(context.toolLogs[0].success).toBe(true);
    });

    it('should log failed request execution', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/test'
      }, context);

      expect(log.error).toHaveBeenCalledWith(
        'HttpTool: Request failed',
        expect.any(Object)
      );

      expect(context.toolLogs[0].success).toBe(false);
    });

    it('should handle complete HTTP workflow', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([
          ['content-type', 'application/json'],
          ['x-request-id', 'req-123']
        ]),
        json: jest.fn().mockResolvedValue({ id: 999, name: 'Created Item' })
      };

      global.fetch.mockResolvedValue(mockResponse);

      const context = {};

      const result = await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/items',
        headers: { 'Authorization': 'Bearer token123' },
        body: { name: 'Test Item', category: 'test' },
        timeout: 10000,
        responseType: 'json'
      }, context);

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(result.statusText).toBe('Created');
      expect(result.data).toEqual({ id: 999, name: 'Created Item' });
      expect(result.duration).toBeDefined();
      expect(context.toolLogs.length).toBe(1);
      expect(context.toolLogs[0].success).toBe(true);
    });
  });
});
