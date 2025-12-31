/**
 * Browser Tool for Autonomous Agents
 * Full browser automation with Puppeteer support
 * Web scraping, form interaction, screenshots, and content extraction
 */

const cheerio = require('cheerio');
const log = require('../../../utils/logger');

// Puppeteer lazy loading for optional browser automation
let puppeteer = null;
let browserInstance = null;

const loadPuppeteer = async () => {
  if (!puppeteer) {
    try {
      puppeteer = require('puppeteer');
    } catch (e) {
      log.warn('Puppeteer not available, browser automation features disabled');
      return null;
    }
  }
  return puppeteer;
};

class BrowserTool {
  constructor(options = {}) {
    this.name = 'browser';
    this.description = 'Full browser automation - scrape pages, fill forms, click buttons, take screenshots';

    // Browser pool settings
    this.maxConcurrentPages = options.maxConcurrentPages || 5;
    this.pagePool = [];
    this.browserLaunchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    };

    // Retry settings
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 1000;

    // Execution logging
    this.executionLogs = [];

    this.parameters = {
      action: {
        type: 'string',
        required: true,
        description: 'Action to perform: scrape, click, type, screenshot, navigate, scroll, wait, evaluate',
        enum: ['scrape', 'click', 'type', 'screenshot', 'navigate', 'scroll', 'wait', 'evaluate', 'form_fill']
      },
      url: {
        type: 'string',
        required: false,
        description: 'The URL to navigate to (required for navigate/scrape)'
      },
      selector: {
        type: 'string',
        required: false,
        description: 'CSS selector for element interaction'
      },
      value: {
        type: 'string',
        required: false,
        description: 'Value to type or script to evaluate'
      },
      extractType: {
        type: 'string',
        required: false,
        description: 'Type of extraction: text, html, links, images, meta, all',
        default: 'text',
        enum: ['text', 'html', 'links', 'images', 'meta', 'all']
      },
      waitFor: {
        type: 'string',
        required: false,
        description: 'Wait for selector, navigation, or timeout (ms)'
      },
      screenshot: {
        type: 'object',
        required: false,
        description: 'Screenshot options: { fullPage: boolean, path: string }'
      },
      formData: {
        type: 'object',
        required: false,
        description: 'Form data for form_fill action: { selector: value, ... }'
      },
      usePuppeteer: {
        type: 'boolean',
        required: false,
        description: 'Force Puppeteer for dynamic content (default: auto-detect)',
        default: false
      },
      limit: {
        type: 'number',
        required: false,
        description: 'Maximum number of elements to extract',
        default: 100
      },
      timeout: {
        type: 'number',
        required: false,
        description: 'Request/page timeout in milliseconds',
        default: 30000
      }
    };
  }

  /**
   * Execute browser action with retry support
   */
  async execute(params, context = {}) {
    const {
      action = 'scrape',
      url,
      selector,
      value,
      extractType = 'text',
      waitFor,
      screenshot,
      formData,
      usePuppeteer = false,
      limit = 100,
      timeout = 30000
    } = params;

    const startTime = Date.now();
    let retryCount = 0;
    let lastError = null;

    // Retry loop
    while (retryCount <= this.maxRetries) {
      try {
        const result = await this.executeAction(
          action, { url, selector, value, extractType, waitFor, screenshot, formData, usePuppeteer, limit, timeout },
          context
        );

        // Log successful execution
        this.logExecution(context, {
          action,
          url,
          duration: Date.now() - startTime,
          success: true,
          retryCount
        });

        return result;

      } catch (error) {
        lastError = error;
        retryCount++;

        // Determine if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || retryCount > this.maxRetries) {
          break;
        }

        log.warn('BrowserTool: Retrying action', {
          action,
          url,
          attempt: retryCount,
          error: error.message
        });

        // Wait before retry with exponential backoff
        await this.delay(this.retryDelayMs * retryCount);
      }
    }

    // All retries exhausted
    const duration = Date.now() - startTime;

    log.error('BrowserTool: Action failed after retries', {
      action,
      url,
      error: lastError.message,
      retryCount,
      duration
    });

    this.logExecution(context, {
      action,
      url,
      error: lastError.message,
      duration,
      success: false,
      retryCount
    });

    return {
      success: false,
      error: lastError.message,
      duration,
      retryCount
    };
  }

  /**
   * Execute specific action
   */
  async executeAction(action, params, context) {
    const { url, selector, value, extractType, waitFor, screenshot, formData, usePuppeteer, limit, timeout } = params;

    // Actions that require Puppeteer
    const puppeteerActions = ['click', 'type', 'screenshot', 'scroll', 'wait', 'evaluate', 'form_fill'];
    const needsPuppeteer = usePuppeteer || puppeteerActions.includes(action);

    if (needsPuppeteer) {
      return await this.executePuppeteerAction(action, params, context);
    }

    // Simple fetch-based actions
    switch (action) {
      case 'navigate':
      case 'scrape':
        return await this.executeScrapeAction(params, context);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Execute scrape action with fetch
   */
  async executeScrapeAction(params, context) {
    const { url, selector, extractType, limit, timeout } = params;

    // Validate URL
    if (!url || !this.isValidUrl(url)) {
      throw new Error('Invalid URL provided');
    }

    // Security check
    if (this.isBlockedUrl(url)) {
      throw new Error('Access to internal URLs is not allowed');
    }

    const startTime = Date.now();

    log.info('BrowserTool: Scraping URL', { url, extractType });

    // Fetch the page
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const duration = Date.now() - startTime;

    let result;

    // Extract based on type
    switch (extractType) {
      case 'text':
        result = this.extractText($, selector, limit);
        break;
      case 'html':
        result = this.extractHtml($, selector, limit);
        break;
      case 'links':
        result = this.extractLinks($, url, limit);
        break;
      case 'images':
        result = this.extractImages($, url, limit);
        break;
      case 'meta':
        result = this.extractMeta($);
        break;
      case 'all':
        result = this.extractAll($, url, selector, limit);
        break;
      default:
        result = this.extractText($, selector, limit);
    }

    log.info('BrowserTool: Scraping completed', { url, duration });

    return {
      success: true,
      action: 'scrape',
      url,
      extractType,
      data: result,
      duration
    };
  }

  /**
   * Execute Puppeteer-based action
   */
  async executePuppeteerAction(action, params, context) {
    const { url, selector, value, extractType, waitFor, screenshot, formData, limit, timeout } = params;

    const pptr = await loadPuppeteer();
    if (!pptr) {
      throw new Error('Puppeteer not available. Install with: npm install puppeteer');
    }

    // Get or create browser instance
    if (!browserInstance || !browserInstance.isConnected()) {
      browserInstance = await pptr.launch(this.browserLaunchOptions);
    }

    const page = await browserInstance.newPage();
    const startTime = Date.now();

    try {
      // Set timeout
      page.setDefaultTimeout(timeout);

      // Set viewport
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate if URL provided
      if (url) {
        if (!this.isValidUrl(url)) {
          throw new Error('Invalid URL provided');
        }
        if (this.isBlockedUrl(url)) {
          throw new Error('Access to internal URLs is not allowed');
        }

        await page.goto(url, { waitUntil: 'networkidle2', timeout });
      }

      // Wait for element or time if specified
      if (waitFor) {
        if (!isNaN(waitFor)) {
          await this.delay(parseInt(waitFor));
        } else {
          await page.waitForSelector(waitFor, { timeout });
        }
      }

      let result;

      switch (action) {
        case 'click':
          if (!selector) throw new Error('Selector required for click action');
          await page.click(selector);
          result = { clicked: selector };
          break;

        case 'type':
          if (!selector || !value) throw new Error('Selector and value required for type action');
          await page.type(selector, value);
          result = { typed: { selector, value: value.substring(0, 20) + '...' } };
          break;

        case 'screenshot':
          const screenshotOptions = {
            fullPage: screenshot?.fullPage || false,
            type: 'png'
          };
          if (screenshot?.path) {
            screenshotOptions.path = screenshot.path;
          }
          const screenshotBuffer = await page.screenshot(screenshotOptions);
          result = {
            screenshot: screenshot?.path || 'base64',
            size: screenshotBuffer.length,
            base64: screenshot?.path ? null : screenshotBuffer.toString('base64').substring(0, 100) + '...'
          };
          break;

        case 'scroll':
          const scrollAmount = parseInt(value) || 500;
          await page.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
          result = { scrolled: scrollAmount };
          break;

        case 'wait':
          // Already handled above
          result = { waited: waitFor };
          break;

        case 'evaluate':
          if (!value) throw new Error('Script value required for evaluate action');
          const evalResult = await page.evaluate(value);
          result = { evaluated: evalResult };
          break;

        case 'form_fill':
          if (!formData) throw new Error('formData required for form_fill action');
          for (const [fieldSelector, fieldValue] of Object.entries(formData)) {
            await page.type(fieldSelector, String(fieldValue));
          }
          result = { filled: Object.keys(formData).length };
          break;

        case 'scrape':
        case 'navigate':
          // Get page content and extract
          const html = await page.content();
          const $ = cheerio.load(html);

          switch (extractType) {
            case 'text':
              result = this.extractText($, selector, limit);
              break;
            case 'html':
              result = this.extractHtml($, selector, limit);
              break;
            case 'links':
              result = this.extractLinks($, url, limit);
              break;
            case 'images':
              result = this.extractImages($, url, limit);
              break;
            case 'meta':
              result = this.extractMeta($);
              break;
            case 'all':
              result = this.extractAll($, url, selector, limit);
              break;
            default:
              result = this.extractText($, selector, limit);
          }
          break;

        default:
          throw new Error(`Unknown Puppeteer action: ${action}`);
      }

      const duration = Date.now() - startTime;

      log.info('BrowserTool: Puppeteer action completed', { action, url, duration });

      return {
        success: true,
        action,
        url,
        data: result,
        duration,
        usedPuppeteer: true
      };

    } finally {
      // Close the page
      await page.close();
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'network',
      'timeout',
      'Navigation timeout',
      'net::ERR_'
    ];

    return retryablePatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (browserInstance && browserInstance.isConnected()) {
      await browserInstance.close();
      browserInstance = null;
    }
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(limit = 100) {
    return this.executionLogs.slice(-limit);
  }

  /**
   * Clear execution logs
   */
  clearExecutionLogs() {
    this.executionLogs = [];
  }

  /**
   * Extract text content
   */
  extractText($, selector, limit) {
    // Remove scripts and styles
    $('script, style, noscript').remove();

    if (selector) {
      const elements = $(selector);
      const texts = [];
      elements.each((i, el) => {
        if (i < limit) {
          texts.push($(el).text().trim());
        }
      });
      return {
        selector,
        count: texts.length,
        content: texts.filter(t => t.length > 0)
      };
    }

    // Get main content
    const body = $('body');
    const text = body.text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000);

    return {
      title: $('title').text().trim(),
      content: text,
      wordCount: text.split(/\s+/).length
    };
  }

  /**
   * Extract HTML content
   */
  extractHtml($, selector, limit) {
    if (selector) {
      const elements = $(selector);
      const htmls = [];
      elements.each((i, el) => {
        if (i < limit) {
          htmls.push($(el).html());
        }
      });
      return {
        selector,
        count: htmls.length,
        content: htmls
      };
    }

    return {
      title: $('title').text().trim(),
      html: $('body').html()?.substring(0, 50000)
    };
  }

  /**
   * Extract all links
   */
  extractLinks($, baseUrl, limit) {
    const links = [];
    const seen = new Set();

    $('a[href]').each((i, el) => {
      if (links.length >= limit) return false;

      let href = $(el).attr('href');
      const text = $(el).text().trim();

      // Resolve relative URLs
      try {
        href = new URL(href, baseUrl).href;
      } catch {
        return; // Skip invalid URLs
      }

      // Skip duplicates and non-http links
      if (seen.has(href) || !href.startsWith('http')) return;
      seen.add(href);

      links.push({
        url: href,
        text: text.substring(0, 100),
        isExternal: !href.includes(new URL(baseUrl).hostname)
      });
    });

    return {
      count: links.length,
      links
    };
  }

  /**
   * Extract all images
   */
  extractImages($, baseUrl, limit) {
    const images = [];
    const seen = new Set();

    $('img[src]').each((i, el) => {
      if (images.length >= limit) return false;

      let src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';

      // Resolve relative URLs
      try {
        src = new URL(src, baseUrl).href;
      } catch {
        return; // Skip invalid URLs
      }

      // Skip duplicates and data URLs
      if (seen.has(src) || src.startsWith('data:')) return;
      seen.add(src);

      images.push({
        url: src,
        alt: alt.substring(0, 200),
        width: $(el).attr('width'),
        height: $(el).attr('height')
      });
    });

    return {
      count: images.length,
      images
    };
  }

  /**
   * Extract meta information
   */
  extractMeta($) {
    const meta = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      keywords: $('meta[name="keywords"]').attr('content') || '',
      author: $('meta[name="author"]').attr('content') || '',
      canonical: $('link[rel="canonical"]').attr('href') || '',
      ogTitle: $('meta[property="og:title"]').attr('content') || '',
      ogDescription: $('meta[property="og:description"]').attr('content') || '',
      ogImage: $('meta[property="og:image"]').attr('content') || '',
      ogType: $('meta[property="og:type"]').attr('content') || '',
      twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
      twitterTitle: $('meta[name="twitter:title"]').attr('content') || '',
      twitterDescription: $('meta[name="twitter:description"]').attr('content') || '',
      favicon: $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || ''
    };

    // Remove empty values
    Object.keys(meta).forEach(key => {
      if (!meta[key]) delete meta[key];
    });

    return meta;
  }

  /**
   * Extract all information
   */
  extractAll($, baseUrl, selector, limit) {
    return {
      meta: this.extractMeta($),
      text: this.extractText($, selector, limit),
      links: this.extractLinks($, baseUrl, Math.min(limit, 50)),
      images: this.extractImages($, baseUrl, Math.min(limit, 20))
    };
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
   * Check if URL is blocked
   */
  isBlockedUrl(urlString) {
    try {
      const url = new URL(urlString);
      const hostname = url.hostname.toLowerCase();

      const blockedPatterns = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '10.',
        '172.16.',
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

module.exports = BrowserTool;
