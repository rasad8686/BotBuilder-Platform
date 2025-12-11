/**
 * HttpTool Tests
 * Tests for server/tools/types/HttpTool.js
 */

const HttpTool = require('../../../tools/types/HttpTool');

// Mock fetch globally
global.fetch = jest.fn();
global.AbortController = class {
  constructor() {
    this.signal = {};
  }
  abort() {}
};

describe('HttpTool', () => {
  let httpTool;

  beforeEach(() => {
    jest.clearAllMocks();
    httpTool = new HttpTool();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(httpTool.config.timeout).toBe(30000);
      expect(httpTool.config.retries).toBe(3);
      expect(httpTool.config.retryDelay).toBe(1000);
    });

    it('should accept custom config', () => {
      const tool = new HttpTool({ timeout: 5000, retries: 5 });

      expect(tool.config.timeout).toBe(5000);
      expect(tool.config.retries).toBe(5);
    });
  });

  describe('buildUrl', () => {
    it('should return base URL with no params', () => {
      const url = httpTool.buildUrl('https://api.example.com/test', {});

      expect(url).toBe('https://api.example.com/test');
    });

    it('should return base URL with null params', () => {
      const url = httpTool.buildUrl('https://api.example.com/test', null);

      expect(url).toBe('https://api.example.com/test');
    });

    it('should add query params', () => {
      const url = httpTool.buildUrl('https://api.example.com/test', {
        key: 'value',
        num: 123
      });

      expect(url).toContain('key=value');
      expect(url).toContain('num=123');
    });

    it('should skip null/undefined params', () => {
      const url = httpTool.buildUrl('https://api.example.com/test', {
        valid: 'yes',
        empty: null,
        missing: undefined
      });

      expect(url).toContain('valid=yes');
      expect(url).not.toContain('empty');
      expect(url).not.toContain('missing');
    });
  });

  describe('buildHeaders', () => {
    it('should return headers with no auth', () => {
      const headers = httpTool.buildHeaders({ 'Content-Type': 'application/json' });

      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should add bearer auth', () => {
      const headers = httpTool.buildHeaders({}, {
        type: 'bearer',
        token: 'my-token'
      });

      expect(headers['Authorization']).toBe('Bearer my-token');
    });

    it('should add basic auth', () => {
      const headers = httpTool.buildHeaders({}, {
        type: 'basic',
        username: 'user',
        password: 'pass'
      });

      const expected = Buffer.from('user:pass').toString('base64');
      expect(headers['Authorization']).toBe(`Basic ${expected}`);
    });

    it('should add API key header', () => {
      const headers = httpTool.buildHeaders({}, {
        type: 'api_key',
        in: 'header',
        name: 'X-Custom-Key',
        value: 'secret123'
      });

      expect(headers['X-Custom-Key']).toBe('secret123');
    });

    it('should use default API key header name', () => {
      const headers = httpTool.buildHeaders({}, {
        type: 'api_key',
        in: 'header',
        value: 'secret123'
      });

      expect(headers['X-API-Key']).toBe('secret123');
    });
  });

  describe('parseXml', () => {
    it('should parse simple XML', () => {
      const xml = '<name>Test</name><value>123</value>';
      const result = httpTool.parseXml(xml);

      expect(result.name).toBe('Test');
      expect(result.value).toBe('123');
    });

    it('should handle repeated tags as array', () => {
      const xml = '<item>First</item><item>Second</item><item>Third</item>';
      const result = httpTool.parseXml(xml);

      expect(Array.isArray(result.item)).toBe(true);
      expect(result.item).toHaveLength(3);
    });
  });

  describe('parseResponse', () => {
    it('should parse JSON response', async () => {
      const mockResponse = {
        headers: new Map([['content-type', 'application/json']]),
        json: jest.fn().mockResolvedValue({ data: 'test' })
      };
      mockResponse.headers.get = (key) => mockResponse.headers.get(key);

      const result = await httpTool.parseResponse({
        headers: { get: () => 'application/json' },
        json: jest.fn().mockResolvedValue({ data: 'test' })
      });

      expect(result).toEqual({ data: 'test' });
    });

    it('should parse text response', async () => {
      const result = await httpTool.parseResponse({
        headers: { get: () => 'text/plain' },
        text: jest.fn().mockResolvedValue('plain text')
      });

      expect(result).toBe('plain text');
    });

    it('should parse XML response', async () => {
      const xmlText = '<root><name>Test</name></root>';
      const result = await httpTool.parseResponse({
        headers: { get: () => 'application/xml' },
        text: jest.fn().mockResolvedValue(xmlText)
      });

      expect(result.xml).toBe(xmlText);
      expect(result.parsed.name).toBe('Test');
    });

    it('should fallback to text on JSON parse error', async () => {
      const result = await httpTool.parseResponse({
        headers: { get: () => 'application/json' },
        json: jest.fn().mockRejectedValue(new Error('Parse error')),
        text: jest.fn().mockResolvedValue('raw text')
      });

      expect(result).toBe('raw text');
    });
  });

  describe('execute', () => {
    it('should make GET request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { entries: () => [] },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      // Mock headers.get
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          entries: () => [],
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ success: true })
      });

      const result = await httpTool.execute({ url: 'https://api.example.com/test' });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should make POST request with body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: {
          entries: () => [],
          get: () => 'application/json'
        },
        json: jest.fn().mockResolvedValue({ id: 1 })
      });

      const result = await httpTool.execute({
        url: 'https://api.example.com/test',
        method: 'POST',
        body: { name: 'test' }
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' })
        })
      );
    });

    it('should handle string body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          entries: () => [],
          get: () => 'text/plain'
        },
        text: jest.fn().mockResolvedValue('ok')
      });

      await httpTool.execute({
        url: 'https://api.example.com/test',
        method: 'POST',
        body: 'raw string body'
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: 'raw string body'
        })
      );
    });
  });

  describe('executeWithRetry', () => {
    it('should retry on failure', async () => {
      const tool = new HttpTool({ retries: 3, retryDelay: 10 });

      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            entries: () => [],
            get: () => 'application/json'
          },
          json: jest.fn().mockResolvedValue({ data: 'success' })
        });

      const result = await tool.executeWithRetry('https://api.example.com', {});

      expect(result.success).toBe(true);
      expect(result.attempt).toBe(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const tool = new HttpTool({ retries: 2, retryDelay: 10 });

      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(
        tool.executeWithRetry('https://api.example.com', {})
      ).rejects.toThrow('HTTP request failed after 2 attempts');
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await httpTool.delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(45);
    });
  });

  describe('static schemas', () => {
    it('should return input schema', () => {
      const schema = HttpTool.getInputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.url).toBeDefined();
      expect(schema.properties.method).toBeDefined();
      expect(schema.required).toContain('url');
    });

    it('should return output schema', () => {
      const schema = HttpTool.getOutputSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.success).toBeDefined();
      expect(schema.properties.status).toBeDefined();
    });

    it('should return config schema', () => {
      const schema = HttpTool.getConfigSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties.timeout).toBeDefined();
      expect(schema.properties.retries).toBeDefined();
    });
  });
});
