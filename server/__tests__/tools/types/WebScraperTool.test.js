/**
 * WebScraperTool Tests
 * Tests for server/tools/types/WebScraperTool.js
 */

jest.mock('cheerio', () => ({
  load: jest.fn()
}));

const cheerio = require('cheerio');
const WebScraperTool = require('../../../tools/types/WebScraperTool');

// Mock fetch
global.fetch = jest.fn();

describe('WebScraperTool', () => {
  let scraper;
  let mock$;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.setSystemTime(new Date('2024-01-01'));

    // Create mock cheerio
    mock$ = jest.fn((selector) => {
      const mockElement = {
        text: jest.fn(() => 'Sample Text'),
        attr: jest.fn((attr) => `mock-${attr}`),
        html: jest.fn(() => '<p>HTML</p>'),
        each: jest.fn((callback) => {
          callback(0, {});
          return mockElement;
        }),
        first: jest.fn(() => mockElement),
        remove: jest.fn(() => mockElement),
        length: 1
      };
      return mockElement;
    });
    mock$.load = cheerio.load;
    cheerio.load.mockReturnValue(mock$);

    global.fetch.mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('<html><head><title>Test</title></head><body><p>Hello</p></body></html>')
    });

    scraper = new WebScraperTool({
      timeout: 5000,
      rateLimit: 100,
      maxRetries: 2
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const tool = new WebScraperTool();
      expect(tool.config.timeout).toBe(30000);
      expect(tool.config.rateLimit).toBe(1000);
      expect(tool.config.maxRetries).toBe(3);
    });

    it('should initialize with custom config', () => {
      const tool = new WebScraperTool({ timeout: 5000 });
      expect(tool.config.timeout).toBe(5000);
    });
  });

  describe('execute', () => {
    it('should scrape page successfully', async () => {
      const result = await scraper.execute({ url: 'http://example.com' });

      expect(result.success).toBe(true);
      expect(result.url).toBe('http://example.com');
    });

    it('should throw error if URL missing', async () => {
      await expect(scraper.execute({})).rejects.toThrow('URL is required');
    });

    it('should extract data with selectors', async () => {
      const mockText = jest.fn().mockReturnValue('Title Text');
      mock$.mockReturnValue({
        text: mockText,
        first: jest.fn().mockReturnValue({ length: 1, text: mockText, attr: jest.fn() }),
        each: jest.fn(),
        length: 1
      });

      await scraper.execute({
        url: 'http://example.com',
        selectors: { title: 'h1' }
      });

      expect(cheerio.load).toHaveBeenCalled();
    });

    it('should extract JSON-LD', async () => {
      await scraper.execute({
        url: 'http://example.com',
        extractJson: true
      });

      expect(cheerio.load).toHaveBeenCalled();
    });

    it('should extract links', async () => {
      await scraper.execute({
        url: 'http://example.com',
        extractLinks: true
      });

      expect(cheerio.load).toHaveBeenCalled();
    });

    it('should extract images', async () => {
      await scraper.execute({
        url: 'http://example.com',
        extractImages: true
      });

      expect(cheerio.load).toHaveBeenCalled();
    });

    it('should extract text', async () => {
      await scraper.execute({
        url: 'http://example.com',
        extractText: true
      });

      expect(cheerio.load).toHaveBeenCalled();
    });
  });

  describe('applyRateLimit', () => {
    it('should apply rate limiting per domain', async () => {
      jest.useRealTimers();

      // First request should not wait
      const start1 = Date.now();
      await scraper.applyRateLimit('http://example.com/page1');
      const duration1 = Date.now() - start1;
      expect(duration1).toBeLessThan(50);

      // Use real timer for this specific test
      scraper.config.rateLimit = 50;
      scraper.lastRequestTime.set('example.com', Date.now());

      // Next request should wait
      const start2 = Date.now();
      await scraper.applyRateLimit('http://example.com/page2');
      const duration2 = Date.now() - start2;
      expect(duration2).toBeGreaterThanOrEqual(40);

      jest.useFakeTimers();
    });

    it('should track different domains separately', async () => {
      await scraper.applyRateLimit('http://example1.com');
      await scraper.applyRateLimit('http://example2.com');

      expect(scraper.lastRequestTime.has('example1.com')).toBe(true);
      expect(scraper.lastRequestTime.has('example2.com')).toBe(true);
    });
  });

  describe('fetchPage', () => {
    it('should fetch page successfully', async () => {
      const html = await scraper.fetchPage('http://example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String)
          })
        })
      );
      expect(html).toBeDefined();
    });

    it('should throw error on HTTP error', async () => {
      jest.useRealTimers(); // Use real timers for this test

      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      // Create scraper with minimal retries and no delay
      const testScraper = new WebScraperTool({
        timeout: 100,
        maxRetries: 1,
        retryDelay: 0
      });

      await expect(testScraper.fetchPage('http://example.com/notfound'))
        .rejects.toThrow('Failed to fetch page');

      jest.useFakeTimers();
    });

    it('should retry on failure', async () => {
      jest.useRealTimers();

      global.fetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('<html></html>') });

      const testScraper = new WebScraperTool({
        timeout: 1000,
        maxRetries: 2,
        retryDelay: 10
      });

      await testScraper.fetchPage('http://example.com');

      expect(global.fetch).toHaveBeenCalledTimes(2);

      jest.useFakeTimers();
    });

    it('should use custom headers', async () => {
      await scraper.fetchPage('http://example.com', { 'X-Custom': 'value' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom': 'value'
          })
        })
      );
    });
  });

  describe('extractMeta', () => {
    it('should extract meta tags', () => {
      // Mock $ function that returns proper element with attr method
      const mock$Local = jest.fn((selector) => {
        if (selector === 'meta') {
          return {
            each: (cb) => {
              // Simulate calling callback for each meta element
            }
          };
        }
        // When called with element (el), return object with attr method
        return {
          attr: jest.fn((attrName) => {
            if (attrName === 'name') return 'description';
            if (attrName === 'content') return 'Test description';
            return null;
          })
        };
      });

      const result = scraper.extractMeta(mock$Local);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('extractBySelectors', () => {
    it('should extract single value', () => {
      const mockElement = {
        text: jest.fn(() => 'Value'),
        attr: jest.fn(),
        first: jest.fn().mockReturnThis(),
        each: jest.fn(),
        length: 1
      };
      const mock$Local = jest.fn(() => mockElement);

      const result = scraper.extractBySelectors(mock$Local, { field: 'div.test' });

      expect(result.field).toBeDefined();
    });

    it('should extract multiple values', () => {
      const mockElement = {
        text: jest.fn(() => 'Value'),
        attr: jest.fn(),
        first: jest.fn().mockReturnThis(),
        each: jest.fn((cb) => {
          cb(0, {});
          cb(1, {});
        }),
        length: 2
      };
      const mock$Local = jest.fn(() => mockElement);

      const result = scraper.extractBySelectors(mock$Local, {
        field: { selector: 'div.test', multiple: true }
      });

      expect(Array.isArray(result.field)).toBe(true);
    });

    it('should extract attribute', () => {
      const mockElement = {
        text: jest.fn(() => ''),
        attr: jest.fn((attr) => `attr-${attr}`),
        first: jest.fn().mockReturnThis(),
        each: jest.fn(),
        length: 1
      };
      const mock$Local = jest.fn(() => mockElement);

      const result = scraper.extractBySelectors(mock$Local, {
        field: { selector: 'a', attribute: 'href' }
      });

      expect(result.field).toBe('attr-href');
    });
  });

  describe('extractValue', () => {
    it('should return null for empty element', () => {
      const mock$Local = jest.fn(() => ({ length: 0 }));
      const result = scraper.extractValue(mock$Local, {}, null);
      expect(result).toBeNull();
    });

    it('should extract attribute', () => {
      const mock$Local = jest.fn(() => ({
        length: 1,
        attr: jest.fn(() => 'value')
      }));
      const result = scraper.extractValue(mock$Local, {}, 'href');
      expect(result).toBe('value');
    });

    it('should extract text', () => {
      const mock$Local = jest.fn(() => ({
        length: 1,
        text: jest.fn(() => '  Text  ')
      }));
      const result = scraper.extractValue(mock$Local, {}, null);
      expect(result).toBe('Text');
    });
  });

  describe('applyTransform', () => {
    it('should return null for null value', () => {
      expect(scraper.applyTransform(null, 'trim')).toBeNull();
    });

    it('should apply trim', () => {
      expect(scraper.applyTransform('  text  ', 'trim')).toBe('text');
    });

    it('should apply lowercase', () => {
      expect(scraper.applyTransform('TEXT', 'lowercase')).toBe('text');
    });

    it('should apply uppercase', () => {
      expect(scraper.applyTransform('text', 'uppercase')).toBe('TEXT');
    });

    it('should apply number transform', () => {
      expect(scraper.applyTransform('$123.45', 'number')).toBe(123.45);
    });

    it('should apply integer transform', () => {
      // Integer removes all non-digit/minus chars, so $123.99 becomes 12399
      expect(scraper.applyTransform('123', 'integer')).toBe(123);
      expect(scraper.applyTransform('$50', 'integer')).toBe(50);
    });

    it('should apply removeWhitespace', () => {
      expect(scraper.applyTransform('a   b   c', 'removeWhitespace')).toBe('a b c');
    });

    it('should return value for unknown transform', () => {
      expect(scraper.applyTransform('text', 'unknown')).toBe('text');
    });
  });

  describe('extractJsonLd', () => {
    it('should extract JSON-LD data', () => {
      const mockScript = {
        each: jest.fn((cb) => {
          cb(0, {});
        })
      };
      const mock$Local = jest.fn(() => mockScript);
      mock$Local.mockImplementation((selector) => ({
        each: (cb) => {
          cb(0, {});
        },
        html: () => '{"@type": "Organization", "name": "Test"}'
      }));

      const result = scraper.extractJsonLd(mock$Local);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('extractLinks', () => {
    it('should extract links', () => {
      const mock$Local = jest.fn(() => ({
        each: jest.fn((cb) => {
          cb(0, {});
        }),
        attr: jest.fn((attr) => attr === 'href' ? 'http://example.com' : null),
        text: jest.fn(() => 'Link Text')
      }));

      const result = scraper.extractLinks(mock$Local, 'http://base.com');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('extractImages', () => {
    it('should extract images', () => {
      const mock$Local = jest.fn(() => ({
        each: jest.fn((cb) => {
          cb(0, {});
        }),
        attr: jest.fn((attr) => attr === 'src' ? 'http://example.com/img.png' : null)
      }));

      const result = scraper.extractImages(mock$Local, 'http://base.com');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('extractText', () => {
    it('should extract text content', () => {
      const mock$Local = jest.fn(() => ({
        remove: jest.fn().mockReturnThis(),
        text: jest.fn(() => '  Hello   World  ')
      }));

      const result = scraper.extractText(mock$Local);

      expect(result).toBe('Hello World');
    });
  });

  describe('resolveUrl', () => {
    it('should resolve relative URL', () => {
      const result = scraper.resolveUrl('/page', 'http://example.com');
      expect(result).toBe('http://example.com/page');
    });

    it('should return absolute URL as-is', () => {
      const result = scraper.resolveUrl('http://other.com/page', 'http://example.com');
      expect(result).toBe('http://other.com/page');
    });

    it('should return null for null href', () => {
      expect(scraper.resolveUrl(null, 'http://example.com')).toBeNull();
    });

    it('should return original href on error', () => {
      const result = scraper.resolveUrl('invalid:url', 'invalid:base');
      expect(result).toBe('invalid:url');
    });
  });

  describe('static schemas', () => {
    it('should return input schema', () => {
      const schema = WebScraperTool.getInputSchema();
      expect(schema.type).toBe('object');
      expect(schema.required).toContain('url');
    });

    it('should return output schema', () => {
      const schema = WebScraperTool.getOutputSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties.success).toBeDefined();
    });

    it('should return config schema', () => {
      const schema = WebScraperTool.getConfigSchema();
      expect(schema.type).toBe('object');
      expect(schema.properties.timeout).toBeDefined();
    });
  });
});
