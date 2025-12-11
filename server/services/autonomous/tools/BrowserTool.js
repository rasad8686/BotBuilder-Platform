/**
 * Browser Tool for Autonomous Agents
 * Web scraping and content extraction
 */

const cheerio = require('cheerio');
const log = require('../../../utils/logger');

class BrowserTool {
  constructor() {
    this.name = 'web_scrape';
    this.description = 'Scrape and extract content from web pages';
    this.parameters = {
      url: {
        type: 'string',
        required: true,
        description: 'The URL to scrape'
      },
      selector: {
        type: 'string',
        required: false,
        description: 'CSS selector to extract specific elements'
      },
      extractType: {
        type: 'string',
        required: false,
        description: 'Type of extraction: text, html, links, images, meta, all',
        default: 'text',
        enum: ['text', 'html', 'links', 'images', 'meta', 'all']
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
        description: 'Request timeout in milliseconds',
        default: 30000
      }
    };
  }

  /**
   * Execute web scraping
   */
  async execute(params, context = {}) {
    const {
      url,
      selector,
      extractType = 'text',
      limit = 100,
      timeout = 30000
    } = params;

    // Validate URL
    if (!url || !this.isValidUrl(url)) {
      return {
        success: false,
        error: 'Invalid URL provided'
      };
    }

    // Security check
    if (this.isBlockedUrl(url)) {
      return {
        success: false,
        error: 'Access to internal URLs is not allowed'
      };
    }

    const startTime = Date.now();

    try {
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

      // Log execution
      this.logExecution(context, {
        url,
        extractType,
        duration,
        success: true
      });

      log.info('BrowserTool: Scraping completed', { url, duration });

      return {
        success: true,
        url,
        extractType,
        data: result,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      log.error('BrowserTool: Scraping failed', {
        url,
        error: error.message,
        duration
      });

      // Log failed execution
      this.logExecution(context, {
        url,
        extractType,
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
