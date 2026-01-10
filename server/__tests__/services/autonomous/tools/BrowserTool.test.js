/**
 * BrowserTool Comprehensive Tests
 * Covers: Scraping, Navigation, Form Interaction, Screenshots, Content Extraction
 */

// Mock page object for Puppeteer
const mockPage = {
  setDefaultTimeout: jest.fn(),
  setViewport: jest.fn().mockResolvedValue(undefined),
  goto: jest.fn().mockResolvedValue(undefined),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  click: jest.fn().mockResolvedValue(undefined),
  type: jest.fn().mockResolvedValue(undefined),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('screenshot-data')),
  evaluate: jest.fn().mockResolvedValue('evaluated-result'),
  content: jest.fn().mockResolvedValue('<html><body>Page content</body></html>'),
  close: jest.fn().mockResolvedValue(undefined)
};

// Mock browser object for Puppeteer
const mockBrowser = {
  isConnected: jest.fn().mockReturnValue(true),
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined)
};

// Mock Puppeteer module
const mockPuppeteer = {
  launch: jest.fn().mockResolvedValue(mockBrowser)
};

// Mock puppeteer - needs to be before require
jest.mock('puppeteer', () => mockPuppeteer, { virtual: true });

// Mock cheerio
jest.mock('cheerio', () => ({
  load: jest.fn().mockReturnValue({
    remove: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnValue('Page content'),
    html: jest.fn().mockReturnValue('<div>Content</div>'),
    attr: jest.fn().mockReturnValue('value'),
    each: jest.fn().mockImplementation(function(callback) {
      return this;
    }),
    $: jest.fn()
  })
}));

// Mock logger
jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

const BrowserTool = require('../../../../services/autonomous/tools/BrowserTool');
const cheerio = require('cheerio');
const log = require('../../../../utils/logger');

describe('BrowserTool', () => {
  let browserTool;
  let mockCheerioInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    browserTool = new BrowserTool();

    // Setup cheerio mock
    mockCheerioInstance = {
      remove: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnValue('Page content with words'),
      html: jest.fn().mockReturnValue('<div>Content</div>'),
      attr: jest.fn().mockReturnValue('value'),
      each: jest.fn().mockImplementation(function(callback) {
        return this;
      })
    };

    // Create function that returns element-like object
    const $fn = jest.fn().mockImplementation((selector) => ({
      text: jest.fn().mockReturnValue('Title'),
      html: jest.fn().mockReturnValue('<div>HTML</div>'),
      attr: jest.fn().mockReturnValue('attribute'),
      each: jest.fn(),
      remove: jest.fn()
    }));

    // Add method to itself
    $fn.remove = jest.fn();
    $fn.text = jest.fn().mockReturnValue('Body text');
    $fn.html = jest.fn().mockReturnValue('<body>HTML</body>');

    cheerio.load.mockReturnValue($fn);
  });

  // ==========================================
  // CONSTRUCTOR & CONFIGURATION
  // ==========================================
  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const tool = new BrowserTool();

      expect(tool.name).toBe('browser');
      expect(tool.maxConcurrentPages).toBe(5);
      expect(tool.maxRetries).toBe(3);
      expect(tool.retryDelayMs).toBe(1000);
    });

    it('should accept custom options', () => {
      const tool = new BrowserTool({
        maxConcurrentPages: 10,
        maxRetries: 5,
        retryDelayMs: 2000
      });

      expect(tool.maxConcurrentPages).toBe(10);
      expect(tool.maxRetries).toBe(5);
      expect(tool.retryDelayMs).toBe(2000);
    });

    it('should have correct parameter definitions', () => {
      expect(browserTool.parameters.action).toBeDefined();
      expect(browserTool.parameters.action.required).toBe(true);
      expect(browserTool.parameters.action.enum).toContain('scrape');
      expect(browserTool.parameters.action.enum).toContain('click');
      expect(browserTool.parameters.action.enum).toContain('navigate');
    });
  });

  // ==========================================
  // URL VALIDATION
  // ==========================================
  describe('URL Validation', () => {
    it('should validate correct URLs', () => {
      expect(browserTool.isValidUrl('https://example.com')).toBe(true);
      expect(browserTool.isValidUrl('http://example.com/path')).toBe(true);
      expect(browserTool.isValidUrl('https://sub.example.com:8080/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(browserTool.isValidUrl('not-a-url')).toBe(false);
      expect(browserTool.isValidUrl('ftp://example.com')).toBe(false);
      expect(browserTool.isValidUrl('')).toBe(false);
      expect(browserTool.isValidUrl(null)).toBe(false);
    });
  });

  // ==========================================
  // BLOCKED URL CHECK
  // ==========================================
  describe('Blocked URL Check', () => {
    it('should block localhost URLs', () => {
      expect(browserTool.isBlockedUrl('http://localhost')).toBe(true);
      expect(browserTool.isBlockedUrl('http://localhost:3000')).toBe(true);
    });

    it('should block internal IP addresses', () => {
      expect(browserTool.isBlockedUrl('http://127.0.0.1')).toBe(true);
      expect(browserTool.isBlockedUrl('http://192.168.1.1')).toBe(true);
      expect(browserTool.isBlockedUrl('http://10.0.0.1')).toBe(true);
      expect(browserTool.isBlockedUrl('http://172.16.0.1')).toBe(true);
      expect(browserTool.isBlockedUrl('http://169.254.0.1')).toBe(true);
    });

    it('should allow external URLs', () => {
      expect(browserTool.isBlockedUrl('https://example.com')).toBe(false);
      expect(browserTool.isBlockedUrl('https://google.com')).toBe(false);
    });

    it('should block invalid URLs', () => {
      expect(browserTool.isBlockedUrl('not-a-url')).toBe(true);
    });
  });

  // ==========================================
  // RETRYABLE ERROR CHECK
  // ==========================================
  describe('Retryable Error Check', () => {
    it('should identify retryable errors', () => {
      expect(browserTool.isRetryableError(new Error('ECONNRESET'))).toBe(true);
      expect(browserTool.isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(browserTool.isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(browserTool.isRetryableError(new Error('network error'))).toBe(true);
      expect(browserTool.isRetryableError(new Error('timeout occurred'))).toBe(true);
      expect(browserTool.isRetryableError(new Error('Navigation timeout'))).toBe(true);
      expect(browserTool.isRetryableError(new Error('net::ERR_CONNECTION_REFUSED'))).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(browserTool.isRetryableError(new Error('Invalid selector'))).toBe(false);
      expect(browserTool.isRetryableError(new Error('Element not found'))).toBe(false);
      expect(browserTool.isRetryableError(new Error('Permission denied'))).toBe(false);
    });
  });

  // ==========================================
  // DELAY HELPER
  // ==========================================
  describe('Delay Helper', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await browserTool.delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  // ==========================================
  // SCRAPE ACTION
  // ==========================================
  describe('Scrape Action', () => {
    it('should scrape URL and extract text', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body>Content</body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        extractType: 'text'
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('scrape');
      expect(result.url).toBe('https://example.com');
      expect(result.data).toBeDefined();
    });

    it('should reject invalid URL', async () => {
      const result = await browserTool.execute({
        action: 'scrape',
        url: 'not-a-url'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should reject blocked URLs', async () => {
      const result = await browserTool.execute({
        action: 'scrape',
        url: 'http://localhost:3000'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('internal URLs');
    });

    it('should handle HTTP errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com/notfound'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle network errors with retry', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue('<html><body>Content</body></html>')
        });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should extract HTML content', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body><div>Content</div></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        extractType: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.extractType).toBe('html');
    });

    it('should extract links', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body><a href="/page">Link</a></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        extractType: 'links'
      });

      expect(result.success).toBe(true);
      expect(result.extractType).toBe('links');
    });

    it('should extract images', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body><img src="/image.jpg" alt="Image"></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        extractType: 'images'
      });

      expect(result.success).toBe(true);
      expect(result.extractType).toBe('images');
    });

    it('should extract meta information', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><head><title>Title</title><meta name="description" content="Desc"></head><body></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        extractType: 'meta'
      });

      expect(result.success).toBe(true);
      expect(result.extractType).toBe('meta');
    });

    it('should extract all content', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><head><title>Title</title></head><body><div>Content</div></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        extractType: 'all'
      });

      expect(result.success).toBe(true);
      expect(result.extractType).toBe('all');
    });

    it('should use selector for targeted extraction', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body><div class="target">Target Content</div></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        selector: '.target',
        extractType: 'text'
      });

      expect(result.success).toBe(true);
    });

    it('should respect limit parameter', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body><div>1</div><div>2</div></body></html>')
      });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        limit: 5
      });

      expect(result.success).toBe(true);
    });

    it('should handle timeout', async () => {
      jest.useFakeTimers();
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(abortError), 100);
        });
      });

      const promise = browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        timeout: 50
      });

      jest.runAllTimers();

      const result = await promise;
      expect(result.success).toBe(false);

      jest.useRealTimers();
    });
  });

  // ==========================================
  // NAVIGATE ACTION
  // ==========================================
  describe('Navigate Action', () => {
    it('should navigate to URL', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html><body>Page</body></html>')
      });

      const result = await browserTool.execute({
        action: 'navigate',
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
    });
  });

  // ==========================================
  // PUPPETEER ACTIONS (with mocked Puppeteer)
  // ==========================================
  describe('Puppeteer Actions', () => {
    it('should identify puppeteer-required actions', async () => {
      // Click action requires puppeteer - with mock it should succeed
      const result = await browserTool.execute({
        action: 'click',
        url: 'https://example.com',
        selector: '#button'
      });

      // Should succeed since puppeteer is mocked
      expect(result.success).toBe(true);
    });

    it('should identify type action as puppeteer-required', async () => {
      const result = await browserTool.execute({
        action: 'type',
        url: 'https://example.com',
        selector: '#input',
        value: 'test'
      });

      expect(result.success).toBe(true);
    });

    it('should identify screenshot action as puppeteer-required', async () => {
      const result = await browserTool.execute({
        action: 'screenshot',
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should identify scroll action as puppeteer-required', async () => {
      const result = await browserTool.execute({
        action: 'scroll',
        url: 'https://example.com',
        value: '500'
      });

      expect(result.success).toBe(true);
    });

    it('should identify wait action as puppeteer-required', async () => {
      const result = await browserTool.execute({
        action: 'wait',
        url: 'https://example.com',
        waitFor: '#element'
      });

      expect(result.success).toBe(true);
    });

    it('should identify evaluate action as puppeteer-required', async () => {
      const result = await browserTool.execute({
        action: 'evaluate',
        url: 'https://example.com',
        value: 'document.title'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should identify form_fill action as puppeteer-required', async () => {
      const result = await browserTool.execute({
        action: 'form_fill',
        url: 'https://example.com',
        formData: { '#name': 'John' }
      });

      expect(result.success).toBe(true);
    });

    it('should use puppeteer when usePuppeteer is true', async () => {
      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com',
        usePuppeteer: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  // ==========================================
  // PUPPETEER EXECUTION (Mocked)
  // ==========================================
  describe('Puppeteer Execution - Mocked', () => {
    beforeEach(() => {
      // Reset all mock functions
      mockPage.setDefaultTimeout.mockClear();
      mockPage.setViewport.mockClear();
      mockPage.goto.mockClear();
      mockPage.waitForSelector.mockClear();
      mockPage.click.mockClear();
      mockPage.type.mockClear();
      mockPage.screenshot.mockClear();
      mockPage.evaluate.mockClear();
      mockPage.content.mockClear();
      mockPage.close.mockClear();
      mockBrowser.isConnected.mockClear();
      mockBrowser.newPage.mockClear();
      mockPuppeteer.launch.mockClear();
    });

    describe('executePuppeteerAction - click', () => {
      it('should execute click action', async () => {
        const result = await browserTool.executePuppeteerAction('click', {
          url: 'https://example.com',
          selector: '#button',
          timeout: 5000
        }, {});

        expect(mockPage.setViewport).toHaveBeenCalled();
        expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', expect.any(Object));
        expect(mockPage.click).toHaveBeenCalledWith('#button');
        expect(mockPage.close).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data.clicked).toBe('#button');
      });

      it('should throw error if no selector for click', async () => {
        await expect(browserTool.executePuppeteerAction('click', {
          url: 'https://example.com',
          timeout: 5000
        }, {})).rejects.toThrow('Selector required for click action');
      });
    });

    describe('executePuppeteerAction - type', () => {
      it('should execute type action', async () => {
        const result = await browserTool.executePuppeteerAction('type', {
          url: 'https://example.com',
          selector: '#input',
          value: 'Hello World',
          timeout: 5000
        }, {});

        expect(mockPage.type).toHaveBeenCalledWith('#input', 'Hello World');
        expect(result.success).toBe(true);
        expect(result.data.typed.selector).toBe('#input');
      });

      it('should throw error if no selector or value for type', async () => {
        await expect(browserTool.executePuppeteerAction('type', {
          url: 'https://example.com',
          selector: '#input',
          timeout: 5000
        }, {})).rejects.toThrow('Selector and value required for type action');
      });
    });

    describe('executePuppeteerAction - screenshot', () => {
      it('should take screenshot', async () => {
        const result = await browserTool.executePuppeteerAction('screenshot', {
          url: 'https://example.com',
          timeout: 5000
        }, {});

        expect(mockPage.screenshot).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data.screenshot).toBe('base64');
        expect(result.data.size).toBeGreaterThan(0);
      });

      it('should take fullPage screenshot with path', async () => {
        const result = await browserTool.executePuppeteerAction('screenshot', {
          url: 'https://example.com',
          screenshot: { fullPage: true, path: '/tmp/screenshot.png' },
          timeout: 5000
        }, {});

        expect(mockPage.screenshot).toHaveBeenCalledWith(expect.objectContaining({
          fullPage: true,
          path: '/tmp/screenshot.png'
        }));
        expect(result.data.screenshot).toBe('/tmp/screenshot.png');
        expect(result.data.base64).toBeNull();
      });
    });

    describe('executePuppeteerAction - scroll', () => {
      it('should scroll page', async () => {
        const result = await browserTool.executePuppeteerAction('scroll', {
          url: 'https://example.com',
          value: '500',
          timeout: 5000
        }, {});

        expect(mockPage.evaluate).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data.scrolled).toBe(500);
      });

      it('should use default scroll amount', async () => {
        const result = await browserTool.executePuppeteerAction('scroll', {
          url: 'https://example.com',
          timeout: 5000
        }, {});

        expect(result.data.scrolled).toBe(500);
      });
    });

    describe('executePuppeteerAction - wait', () => {
      it('should wait for selector', async () => {
        const result = await browserTool.executePuppeteerAction('wait', {
          url: 'https://example.com',
          waitFor: '#element',
          timeout: 5000
        }, {});

        expect(mockPage.waitForSelector).toHaveBeenCalledWith('#element', { timeout: 5000 });
        expect(result.success).toBe(true);
        expect(result.data.waited).toBe('#element');
      });

      it('should wait for time delay', async () => {
        const originalDelay = browserTool.delay;
        browserTool.delay = jest.fn().mockResolvedValue(undefined);

        const result = await browserTool.executePuppeteerAction('wait', {
          url: 'https://example.com',
          waitFor: '100',
          timeout: 5000
        }, {});

        expect(browserTool.delay).toHaveBeenCalledWith(100);
        expect(result.data.waited).toBe('100');

        browserTool.delay = originalDelay;
      });
    });

    describe('executePuppeteerAction - evaluate', () => {
      it('should evaluate JavaScript', async () => {
        const result = await browserTool.executePuppeteerAction('evaluate', {
          url: 'https://example.com',
          value: 'document.title',
          timeout: 5000
        }, {});

        expect(mockPage.evaluate).toHaveBeenCalledWith('document.title');
        expect(result.success).toBe(true);
        expect(result.data.evaluated).toBe('evaluated-result');
      });

      it('should throw error if no script value', async () => {
        await expect(browserTool.executePuppeteerAction('evaluate', {
          url: 'https://example.com',
          timeout: 5000
        }, {})).rejects.toThrow('Script value required for evaluate action');
      });
    });

    describe('executePuppeteerAction - form_fill', () => {
      it('should fill form fields', async () => {
        const result = await browserTool.executePuppeteerAction('form_fill', {
          url: 'https://example.com',
          formData: {
            '#name': 'John',
            '#email': 'john@example.com'
          },
          timeout: 5000
        }, {});

        expect(mockPage.type).toHaveBeenCalledWith('#name', 'John');
        expect(mockPage.type).toHaveBeenCalledWith('#email', 'john@example.com');
        expect(result.success).toBe(true);
        expect(result.data.filled).toBe(2);
      });

      it('should throw error if no formData', async () => {
        await expect(browserTool.executePuppeteerAction('form_fill', {
          url: 'https://example.com',
          timeout: 5000
        }, {})).rejects.toThrow('formData required for form_fill action');
      });
    });

    describe('executePuppeteerAction - scrape/navigate', () => {
      it('should scrape with text extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'text',
          timeout: 5000
        }, {});

        expect(mockPage.content).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.usedPuppeteer).toBe(true);
      });

      it('should scrape with html extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'html',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });

      it('should scrape with links extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'links',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });

      it('should scrape with images extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'images',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });

      it('should scrape with meta extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'meta',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });

      it('should scrape with all extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'all',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });

      it('should use default text extraction', async () => {
        const result = await browserTool.executePuppeteerAction('scrape', {
          url: 'https://example.com',
          extractType: 'unknown',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });

      it('should handle navigate action same as scrape', async () => {
        const result = await browserTool.executePuppeteerAction('navigate', {
          url: 'https://example.com',
          extractType: 'text',
          timeout: 5000
        }, {});

        expect(result.success).toBe(true);
      });
    });

    describe('executePuppeteerAction - unknown action', () => {
      it('should throw error for unknown action', async () => {
        await expect(browserTool.executePuppeteerAction('unknown_action', {
          url: 'https://example.com',
          timeout: 5000
        }, {})).rejects.toThrow('Unknown Puppeteer action: unknown_action');
      });
    });

    describe('executePuppeteerAction - URL validation', () => {
      it('should reject invalid URL', async () => {
        await expect(browserTool.executePuppeteerAction('click', {
          url: 'not-a-valid-url',
          selector: '#button',
          timeout: 5000
        }, {})).rejects.toThrow('Invalid URL provided');
      });

      it('should reject blocked URL', async () => {
        await expect(browserTool.executePuppeteerAction('click', {
          url: 'http://localhost:3000',
          selector: '#button',
          timeout: 5000
        }, {})).rejects.toThrow('Access to internal URLs is not allowed');
      });
    });

    describe('executePuppeteerAction - without URL', () => {
      it('should work without URL for some actions', async () => {
        const result = await browserTool.executePuppeteerAction('scroll', {
          value: '300',
          timeout: 5000
        }, {});

        expect(mockPage.goto).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });

    describe('executePuppeteerAction - browser launch', () => {
      it('should launch browser if not connected', async () => {
        mockBrowser.isConnected.mockReturnValueOnce(false);

        const result = await browserTool.executePuppeteerAction('scroll', {
          url: 'https://example.com',
          timeout: 5000
        }, {});

        expect(mockPuppeteer.launch).toHaveBeenCalled();
        expect(result.success).toBe(true);
      });
    });

    describe('executePuppeteerAction - page cleanup', () => {
      it('should close page even on error', async () => {
        mockPage.click.mockRejectedValueOnce(new Error('Click failed'));

        await expect(browserTool.executePuppeteerAction('click', {
          url: 'https://example.com',
          selector: '#button',
          timeout: 5000
        }, {})).rejects.toThrow('Click failed');

        expect(mockPage.close).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // UNKNOWN ACTION
  // ==========================================
  describe('Unknown Action', () => {
    it('should handle unknown action', async () => {
      const result = await browserTool.execute({
        action: 'unknown_action',
        url: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown action');
    });
  });

  // ==========================================
  // EXECUTION LOGGING
  // ==========================================
  describe('Execution Logging', () => {
    it('should log successful execution', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('<html></html>')
      });

      const context = {};
      await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com'
      }, context);

      expect(context.toolLogs).toBeDefined();
      expect(context.toolLogs).toHaveLength(1);
      expect(context.toolLogs[0].success).toBe(true);
    });

    it('should log failed execution', async () => {
      const context = {};
      await browserTool.execute({
        action: 'scrape',
        url: 'not-a-url'
      }, context);

      expect(context.toolLogs).toBeDefined();
      expect(context.toolLogs[0].success).toBe(false);
    });

    it('should get execution logs', () => {
      browserTool.executionLogs = [
        { action: 'scrape', success: true },
        { action: 'click', success: false }
      ];

      const logs = browserTool.getExecutionLogs();
      expect(logs).toHaveLength(2);
    });

    it('should limit execution logs', () => {
      browserTool.executionLogs = Array(150).fill({ action: 'scrape' });

      const logs = browserTool.getExecutionLogs(50);
      expect(logs).toHaveLength(50);
    });

    it('should clear execution logs', () => {
      browserTool.executionLogs = [{ action: 'scrape' }];
      browserTool.clearExecutionLogs();

      expect(browserTool.executionLogs).toHaveLength(0);
    });
  });

  // ==========================================
  // TOOL DEFINITION
  // ==========================================
  describe('Tool Definition', () => {
    it('should return tool definition', () => {
      const definition = browserTool.getDefinition();

      expect(definition.name).toBe('browser');
      expect(definition.description).toBeDefined();
      expect(definition.parameters).toBeDefined();
      expect(typeof definition.execute).toBe('function');
    });
  });

  // ==========================================
  // BROWSER LIFECYCLE
  // ==========================================
  describe('Browser Lifecycle', () => {
    it('should close browser when called', async () => {
      // Since puppeteer is not available, this should not throw
      await expect(browserTool.closeBrowser()).resolves.not.toThrow();
    });
  });

  // ==========================================
  // CONTENT EXTRACTION METHODS
  // ==========================================
  describe('Content Extraction Methods', () => {
    let $;

    beforeEach(() => {
      $ = jest.fn().mockImplementation((selector) => ({
        text: jest.fn().mockReturnValue('Text content'),
        html: jest.fn().mockReturnValue('<div>HTML</div>'),
        attr: jest.fn().mockImplementation((attr) => {
          if (attr === 'href') return '/page';
          if (attr === 'src') return '/image.jpg';
          return 'value';
        }),
        each: jest.fn().mockImplementation((callback) => {}),
        remove: jest.fn()
      }));
      $.html = jest.fn().mockReturnValue('<body>Body</body>');
      $.text = jest.fn().mockReturnValue('Body text');
    });

    it('should extract text with selector', () => {
      const result = browserTool.extractText($, '.content', 10);
      expect(result).toBeDefined();
      expect(result.selector).toBe('.content');
    });

    it('should extract text without selector', () => {
      const result = browserTool.extractText($, null, 10);
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
    });

    it('should extract HTML with selector', () => {
      const result = browserTool.extractHtml($, '.content', 10);
      expect(result).toBeDefined();
      expect(result.selector).toBe('.content');
    });

    it('should extract HTML without selector', () => {
      const result = browserTool.extractHtml($, null, 10);
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
    });

    it('should extract links', () => {
      const result = browserTool.extractLinks($, 'https://example.com', 50);
      expect(result).toBeDefined();
      expect(result.count).toBeDefined();
      expect(result.links).toBeDefined();
    });

    it('should extract images', () => {
      const result = browserTool.extractImages($, 'https://example.com', 20);
      expect(result).toBeDefined();
      expect(result.count).toBeDefined();
      expect(result.images).toBeDefined();
    });

    it('should extract meta information', () => {
      const result = browserTool.extractMeta($);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should extract all information', () => {
      const result = browserTool.extractAll($, 'https://example.com', null, 50);
      expect(result).toBeDefined();
      expect(result.meta).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.images).toBeDefined();
    });
  });

  // ==========================================
  // RETRY MECHANISM
  // ==========================================
  describe('Retry Mechanism', () => {
    it('should retry on retryable errors', async () => {
      global.fetch
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue('<html></html>')
        });

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(log.warn).toHaveBeenCalled();
    });

    it('should not retry on non-retryable errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should give up after max retries', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNRESET'));

      const result = await browserTool.execute({
        action: 'scrape',
        url: 'https://example.com'
      });

      expect(result.success).toBe(false);
      // retryCount includes the final failed attempt
      expect(result.retryCount).toBeGreaterThanOrEqual(browserTool.maxRetries);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  // ==========================================
  // LOG EXECUTION
  // ==========================================
  describe('Log Execution', () => {
    it('should add log to context', () => {
      const context = {};
      browserTool.logExecution(context, {
        action: 'scrape',
        url: 'https://example.com',
        success: true
      });

      expect(context.toolLogs).toHaveLength(1);
      expect(context.toolLogs[0].tool).toBe('browser');
      expect(context.toolLogs[0].timestamp).toBeDefined();
    });

    it('should initialize toolLogs if not exists', () => {
      const context = {};
      browserTool.logExecution(context, { action: 'test' });

      expect(context.toolLogs).toBeDefined();
      expect(Array.isArray(context.toolLogs)).toBe(true);
    });

    it('should append to existing toolLogs', () => {
      const context = { toolLogs: [{ existing: true }] };
      browserTool.logExecution(context, { action: 'test' });

      expect(context.toolLogs).toHaveLength(2);
    });
  });

  // ==========================================
  // EXTRACTION METHODS (Direct Testing)
  // ==========================================
  describe('Extraction Methods', () => {
    // Use real cheerio for extraction tests
    const realCheerio = jest.requireActual('cheerio');

    describe('extractText', () => {
      it('should extract text with selector', () => {
        const html = `
          <html>
            <body>
              <p class="content">First paragraph</p>
              <p class="content">Second paragraph</p>
              <p class="content">Third paragraph</p>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractText($, '.content', 10);

        expect(result.selector).toBe('.content');
        expect(result.count).toBe(3);
        expect(result.content).toContain('First paragraph');
      });

      it('should respect limit for selector extraction', () => {
        const html = `
          <html>
            <body>
              <p class="item">Item 1</p>
              <p class="item">Item 2</p>
              <p class="item">Item 3</p>
              <p class="item">Item 4</p>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractText($, '.item', 2);

        expect(result.count).toBe(2);
      });

      it('should extract text without selector', () => {
        const html = `
          <html>
            <head><title>Test Page</title></head>
            <body>
              <p>Content here</p>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractText($, null, 10);

        expect(result.title).toBe('Test Page');
        expect(result.content).toContain('Content');
        expect(result.wordCount).toBeGreaterThan(0);
      });

      it('should filter empty texts', () => {
        const html = `
          <html>
            <body>
              <p class="item">   </p>
              <p class="item">Real content</p>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractText($, '.item', 10);

        expect(result.content).toEqual(['Real content']);
      });
    });

    describe('extractHtml', () => {
      it('should extract HTML with selector', () => {
        const html = `
          <html>
            <body>
              <div class="box"><span>Inner content</span></div>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractHtml($, '.box', 10);

        expect(result.selector).toBe('.box');
        expect(result.count).toBe(1);
        expect(result.content[0]).toContain('<span>Inner content</span>');
      });

      it('should extract HTML without selector', () => {
        const html = `
          <html>
            <head><title>HTML Page</title></head>
            <body>
              <p>Body content</p>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractHtml($, null, 10);

        expect(result.title).toBe('HTML Page');
        expect(result.html).toContain('Body content');
      });

      it('should respect limit for HTML extraction', () => {
        const html = `
          <html>
            <body>
              <div class="box">Box 1</div>
              <div class="box">Box 2</div>
              <div class="box">Box 3</div>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractHtml($, '.box', 2);

        expect(result.count).toBe(2);
      });
    });

    describe('extractLinks', () => {
      it('should extract all links', () => {
        const html = `
          <html>
            <body>
              <a href="https://example.com/page1">Page 1</a>
              <a href="https://example.com/page2">Page 2</a>
              <a href="https://other.com">External</a>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractLinks($, 'https://example.com', 10);

        expect(result.count).toBe(3);
        expect(result.links[0].url).toBe('https://example.com/page1');
      });

      it('should identify external links', () => {
        const html = `
          <html>
            <body>
              <a href="https://other.com/page">External link</a>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractLinks($, 'https://example.com', 10);

        expect(result.links[0].isExternal).toBe(true);
      });

      it('should respect link limit', () => {
        const html = `
          <html>
            <body>
              <a href="https://example.com/1">1</a>
              <a href="https://example.com/2">2</a>
              <a href="https://example.com/3">3</a>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractLinks($, 'https://example.com', 2);

        expect(result.count).toBe(2);
      });

      it('should skip duplicate links', () => {
        const html = `
          <html>
            <body>
              <a href="https://example.com/page">Link 1</a>
              <a href="https://example.com/page">Link 2</a>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractLinks($, 'https://example.com', 10);

        expect(result.count).toBe(1);
      });

      it('should skip invalid URLs', () => {
        const html = `
          <html>
            <body>
              <a href="javascript:void(0)">JS link</a>
              <a href="https://example.com/valid">Valid</a>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractLinks($, 'https://example.com', 10);

        expect(result.count).toBe(1);
      });

      it('should resolve relative URLs', () => {
        const html = `
          <html>
            <body>
              <a href="/relative/path">Relative</a>
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractLinks($, 'https://example.com', 10);

        expect(result.links[0].url).toBe('https://example.com/relative/path');
      });
    });

    describe('extractImages', () => {
      it('should extract all images', () => {
        const html = `
          <html>
            <body>
              <img src="https://example.com/img1.jpg" alt="Image 1" width="100" height="100">
              <img src="https://example.com/img2.jpg" alt="Image 2">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractImages($, 'https://example.com', 10);

        expect(result.count).toBe(2);
        expect(result.images[0].url).toBe('https://example.com/img1.jpg');
        expect(result.images[0].alt).toBe('Image 1');
        expect(result.images[0].width).toBe('100');
      });

      it('should respect image limit', () => {
        const html = `
          <html>
            <body>
              <img src="https://example.com/1.jpg">
              <img src="https://example.com/2.jpg">
              <img src="https://example.com/3.jpg">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractImages($, 'https://example.com', 2);

        expect(result.count).toBe(2);
      });

      it('should skip duplicate images', () => {
        const html = `
          <html>
            <body>
              <img src="https://example.com/same.jpg">
              <img src="https://example.com/same.jpg">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractImages($, 'https://example.com', 10);

        expect(result.count).toBe(1);
      });

      it('should skip data URLs', () => {
        const html = `
          <html>
            <body>
              <img src="data:image/png;base64,abc123">
              <img src="https://example.com/real.jpg">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractImages($, 'https://example.com', 10);

        expect(result.count).toBe(1);
      });

      it('should resolve relative image URLs', () => {
        const html = `
          <html>
            <body>
              <img src="/images/photo.jpg">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractImages($, 'https://example.com', 10);

        expect(result.images[0].url).toBe('https://example.com/images/photo.jpg');
      });

      it('should handle images without alt', () => {
        const html = `
          <html>
            <body>
              <img src="https://example.com/noalt.jpg">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractImages($, 'https://example.com', 10);

        expect(result.images[0].alt).toBe('');
      });
    });

    describe('extractMeta', () => {
      it('should extract all meta information', () => {
        const html = `
          <html>
            <head>
              <title>Meta Test Page</title>
              <meta name="description" content="Test description">
              <meta name="keywords" content="test, keywords">
              <meta name="author" content="Test Author">
              <link rel="canonical" href="https://example.com/canonical">
              <meta property="og:title" content="OG Title">
              <meta property="og:description" content="OG Description">
              <meta property="og:image" content="https://example.com/og.jpg">
              <meta property="og:type" content="website">
            </head>
            <body></body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractMeta($);

        expect(result.title).toBe('Meta Test Page');
        expect(result.description).toBe('Test description');
        expect(result.keywords).toBe('test, keywords');
        expect(result.author).toBe('Test Author');
        expect(result.canonical).toBe('https://example.com/canonical');
        expect(result.ogTitle).toBe('OG Title');
        expect(result.ogDescription).toBe('OG Description');
        expect(result.ogImage).toBe('https://example.com/og.jpg');
        expect(result.ogType).toBe('website');
      });

      it('should handle missing meta tags', () => {
        const html = `
          <html>
            <head><title>Simple Page</title></head>
            <body></body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractMeta($);

        expect(result.title).toBe('Simple Page');
        // Missing meta tags return undefined
        expect(result.description).toBeUndefined();
        expect(result.ogTitle).toBeUndefined();
      });
    });

    describe('extractAll', () => {
      it('should extract all data types', () => {
        const html = `
          <html>
            <head>
              <title>Full Page</title>
              <meta name="description" content="A full page">
            </head>
            <body>
              <p>Some text content</p>
              <a href="https://example.com/link">A link</a>
              <img src="https://example.com/img.jpg" alt="An image">
            </body>
          </html>
        `;
        const $ = realCheerio.load(html);

        const result = browserTool.extractAll($, 'https://example.com', null, 10);

        expect(result.meta).toBeDefined();
        expect(result.meta.title).toBe('Full Page');
        expect(result.text).toBeDefined();
        expect(result.links).toBeDefined();
        expect(result.images).toBeDefined();
      });
    });
  });

  // ==========================================
  // BROWSER MANAGEMENT
  // ==========================================
  describe('Browser Management', () => {
    describe('closeBrowser', () => {
      it('should close browser if connected', async () => {
        // This just tests the method doesn't throw
        await browserTool.closeBrowser();
      });
    });

    describe('getExecutionLogs', () => {
      it('should return execution logs', () => {
        browserTool.executionLogs = [
          { action: 'test1' },
          { action: 'test2' },
          { action: 'test3' }
        ];

        const logs = browserTool.getExecutionLogs(10);

        expect(logs).toHaveLength(3);
      });

      it('should respect limit', () => {
        browserTool.executionLogs = [
          { action: 'test1' },
          { action: 'test2' },
          { action: 'test3' }
        ];

        const logs = browserTool.getExecutionLogs(2);

        expect(logs).toHaveLength(2);
      });
    });

    describe('clearExecutionLogs', () => {
      it('should clear all logs', () => {
        browserTool.executionLogs = [{ action: 'test' }];

        browserTool.clearExecutionLogs();

        expect(browserTool.executionLogs).toHaveLength(0);
      });
    });
  });

  // ==========================================
  // RETRYABLE ERRORS
  // ==========================================
  describe('isRetryableError', () => {
    it('should identify ECONNRESET as retryable', () => {
      const result = browserTool.isRetryableError(new Error('ECONNRESET'));
      expect(result).toBe(true);
    });

    it('should identify ETIMEDOUT as retryable', () => {
      const result = browserTool.isRetryableError(new Error('ETIMEDOUT'));
      expect(result).toBe(true);
    });

    it('should identify timeout as retryable', () => {
      const result = browserTool.isRetryableError(new Error('Request timeout'));
      expect(result).toBe(true);
    });

    it('should identify network errors as retryable', () => {
      const result = browserTool.isRetryableError(new Error('network failed'));
      expect(result).toBe(true);
    });

    it('should identify net::ERR_ as retryable', () => {
      const result = browserTool.isRetryableError(new Error('net::ERR_CONNECTION_RESET'));
      expect(result).toBe(true);
    });

    it('should not identify permission errors as retryable', () => {
      const result = browserTool.isRetryableError(new Error('Permission denied'));
      expect(result).toBe(false);
    });

    it('should not identify validation errors as retryable', () => {
      const result = browserTool.isRetryableError(new Error('Invalid URL'));
      expect(result).toBe(false);
    });
  });

  // ==========================================
  // DELAY HELPER
  // ==========================================
  describe('delay', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await browserTool.delay(50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
