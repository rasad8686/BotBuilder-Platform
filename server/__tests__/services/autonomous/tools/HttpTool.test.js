/**
 * HttpTool Tests
 * Tests for the HTTP request tool for autonomous agents
 */

jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock global fetch
global.fetch = jest.fn();

// Mock AbortController
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

describe('HttpTool', () => {
  let httpTool;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    httpTool = new HttpTool();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(httpTool.name).toBe('http_request');
      expect(httpTool.description).toContain('HTTP requests');
    });

    it('should define required parameters', () => {
      expect(httpTool.parameters.method.required).toBe(true);
      expect(httpTool.parameters.url.required).toBe(true);
    });

    it('should define optional parameters', () => {
      expect(httpTool.parameters.headers.required).toBe(false);
      expect(httpTool.parameters.body.required).toBe(false);
      expect(httpTool.parameters.timeout.required).toBe(false);
      expect(httpTool.parameters.responseType.required).toBe(false);
    });

    it('should define allowed HTTP methods', () => {
      expect(httpTool.parameters.method.enum).toContain('GET');
      expect(httpTool.parameters.method.enum).toContain('POST');
      expect(httpTool.parameters.method.enum).toContain('PUT');
      expect(httpTool.parameters.method.enum).toContain('DELETE');
      expect(httpTool.parameters.method.enum).toContain('PATCH');
    });
  });

  describe('execute', () => {
    it('should return error for invalid URL', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'invalid-url'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should return error for missing URL', async () => {
      const result = await httpTool.execute({
        method: 'GET'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should block localhost URLs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://localhost:3000/api'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal URLs');
    });

    it('should block 127.0.0.1 URLs', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://127.0.0.1/api'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal URLs');
    });

    it('should block private IP addresses (10.x.x.x)', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://10.0.0.1/api'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal URLs');
    });

    it('should block private IP addresses (192.168.x.x)', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://192.168.1.1/api'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal URLs');
    });

    it('should block private IP addresses (172.16.x.x)', async () => {
      const result = await httpTool.execute({
        method: 'GET',
        url: 'http://172.16.0.1/api'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal URLs');
    });

    it('should make successful GET request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ data: 'test' })
      };
      mockResponse.headers.get = jest.fn((key) => {
        if (key === 'content-type') return 'application/json';
        return null;
      });
      mockResponse.headers.entries = jest.fn().mockReturnValue([['content-type', 'application/json']]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/data'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ data: 'test' });
    });

    it('should make POST request with body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ id: '123' })
      };
      mockResponse.headers.get = jest.fn(() => 'application/json');
      mockResponse.headers.entries = jest.fn().mockReturnValue([['content-type', 'application/json']]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/data',
        body: { name: 'Test' }
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' })
        })
      );
    });

    it('should include custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('OK')
      };
      mockResponse.headers.get = jest.fn(() => 'text/plain');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: { 'Authorization': 'Bearer token123' }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123'
          })
        })
      );
    });

    it('should handle text response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('Plain text response')
      };
      mockResponse.headers.get = jest.fn(() => 'text/plain');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/text',
        responseType: 'text'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Plain text response');
    });

    it('should try parsing JSON-like text responses', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('{"parsed": true}')
      };
      mockResponse.headers.get = jest.fn(() => 'text/plain');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/data',
        responseType: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ parsed: true });
    });

    it('should handle non-OK responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('Not found')
      };
      mockResponse.headers.get = jest.fn(() => 'text/plain');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/notfound'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/error'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      global.fetch.mockRejectedValue(abortError);

      const result = await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/slow',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

    it('should log execution to context', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('OK')
      };
      mockResponse.headers.get = jest.fn(() => 'text/plain');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const context = {};

      await httpTool.execute({
        method: 'GET',
        url: 'https://api.example.com/data'
      }, context);

      expect(context.toolLogs).toBeDefined();
      expect(context.toolLogs[0].tool).toBe('http_request');
      expect(context.toolLogs[0].method).toBe('GET');
    });

    it('should set Content-Type for POST requests without explicit header', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({})
      };
      mockResponse.headers.get = jest.fn(() => 'application/json');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      await httpTool.execute({
        method: 'POST',
        url: 'https://api.example.com/data',
        body: { test: true }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle PUT request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ updated: true })
      };
      mockResponse.headers.get = jest.fn(() => 'application/json');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'PUT',
        url: 'https://api.example.com/data/1',
        body: { name: 'Updated' }
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });

    it('should handle DELETE request', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: new Map(),
        text: jest.fn().mockResolvedValue('')
      };
      mockResponse.headers.get = jest.fn(() => null);
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'DELETE',
        url: 'https://api.example.com/data/1'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(204);
    });

    it('should handle PATCH request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map(),
        json: jest.fn().mockResolvedValue({ patched: true })
      };
      mockResponse.headers.get = jest.fn(() => 'application/json');
      mockResponse.headers.entries = jest.fn().mockReturnValue([]);

      global.fetch.mockResolvedValue(mockResponse);

      const result = await httpTool.execute({
        method: 'PATCH',
        url: 'https://api.example.com/data/1',
        body: { field: 'value' }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('isValidUrl', () => {
    it('should validate https URLs', () => {
      expect(httpTool.isValidUrl('https://example.com')).toBe(true);
      expect(httpTool.isValidUrl('https://api.example.com/path')).toBe(true);
    });

    it('should validate http URLs', () => {
      expect(httpTool.isValidUrl('http://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(httpTool.isValidUrl('not-a-url')).toBe(false);
      expect(httpTool.isValidUrl('')).toBe(false);
      expect(httpTool.isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('isBlockedUrl', () => {
    it('should block localhost', () => {
      expect(httpTool.isBlockedUrl('http://localhost/api')).toBe(true);
      expect(httpTool.isBlockedUrl('http://localhost:3000/api')).toBe(true);
    });

    it('should block loopback addresses', () => {
      expect(httpTool.isBlockedUrl('http://127.0.0.1/api')).toBe(true);
      expect(httpTool.isBlockedUrl('http://0.0.0.0/api')).toBe(true);
    });

    it('should block private IP ranges', () => {
      expect(httpTool.isBlockedUrl('http://10.0.0.1/api')).toBe(true);
      expect(httpTool.isBlockedUrl('http://172.16.0.1/api')).toBe(true);
      expect(httpTool.isBlockedUrl('http://192.168.0.1/api')).toBe(true);
      expect(httpTool.isBlockedUrl('http://169.254.0.1/api')).toBe(true);
    });

    it('should allow public URLs', () => {
      expect(httpTool.isBlockedUrl('https://api.example.com')).toBe(false);
      expect(httpTool.isBlockedUrl('https://google.com')).toBe(false);
    });

    it('should return true for invalid URLs', () => {
      expect(httpTool.isBlockedUrl('not-a-url')).toBe(true);
    });
  });

  describe('logExecution', () => {
    it('should create toolLogs array if not exists', () => {
      const context = {};

      httpTool.logExecution(context, { method: 'GET', url: 'test' });

      expect(context.toolLogs).toBeDefined();
      expect(Array.isArray(context.toolLogs)).toBe(true);
    });

    it('should append to existing toolLogs', () => {
      const context = {
        toolLogs: [{ existing: 'log' }]
      };

      httpTool.logExecution(context, { method: 'GET' });

      expect(context.toolLogs.length).toBe(2);
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const definition = httpTool.getDefinition();

      expect(definition.name).toBe('http_request');
      expect(definition.description).toBeDefined();
      expect(definition.parameters).toBeDefined();
      expect(typeof definition.execute).toBe('function');
    });
  });
});
