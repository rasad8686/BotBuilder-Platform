/**
 * WebScraperTool - Web scraping tool with HTML parsing and rate limiting
 */

const cheerio = require('cheerio');

class WebScraperTool {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 30000,
      rateLimit: config.rateLimit || 1000, // ms between requests
      maxRetries: config.maxRetries || 3,
      userAgent: config.userAgent || 'BotBuilder WebScraper/1.0',
      ...config
    };
    this.lastRequestTime = new Map(); // Domain -> timestamp
  }

  /**
   * Execute web scraping
   */
  async execute(input, context = {}) {
    const {
      url,
      selectors = {},
      extractJson = false,
      extractLinks = false,
      extractImages = false,
      extractText = false,
      waitForSelector,
      headers = {}
    } = input;

    if (!url) {
      throw new Error('URL is required');
    }

    // Apply rate limiting
    await this.applyRateLimit(url);

    // Fetch the page
    const html = await this.fetchPage(url, headers);

    // Parse HTML
    const $ = cheerio.load(html);

    const result = {
      url,
      title: $('title').text().trim(),
      meta: this.extractMeta($),
      data: {}
    };

    // Extract data using CSS selectors
    if (selectors && Object.keys(selectors).length > 0) {
      result.data = this.extractBySelectors($, selectors);
    }

    // Extract JSON-LD data
    if (extractJson) {
      result.jsonLd = this.extractJsonLd($);
    }

    // Extract links
    if (extractLinks) {
      result.links = this.extractLinks($, url);
    }

    // Extract images
    if (extractImages) {
      result.images = this.extractImages($, url);
    }

    // Extract full text
    if (extractText) {
      result.text = this.extractText($);
    }

    return {
      success: true,
      ...result
    };
  }

  /**
   * Apply rate limiting per domain
   */
  async applyRateLimit(url) {
    const domain = new URL(url).hostname;
    const lastRequest = this.lastRequestTime.get(domain) || 0;
    const timeSinceLastRequest = Date.now() - lastRequest;

    if (timeSinceLastRequest < this.config.rateLimit) {
      const waitTime = this.config.rateLimit - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime.set(domain, Date.now());
  }

  /**
   * Fetch page with retries
   */
  async fetchPage(url, headers = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            ...headers
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
      } catch (error) {
        lastError = error;
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw new Error(`Failed to fetch page after ${this.config.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Extract meta tags
   */
  extractMeta($) {
    const meta = {};

    $('meta').each((_, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');

      if (name && content) {
        meta[name] = content;
      }
    });

    return meta;
  }

  /**
   * Extract data using CSS selectors
   */
  extractBySelectors($, selectors) {
    const data = {};

    for (const [key, selectorConfig] of Object.entries(selectors)) {
      let selector, attribute, multiple, transform;

      if (typeof selectorConfig === 'string') {
        selector = selectorConfig;
      } else {
        selector = selectorConfig.selector;
        attribute = selectorConfig.attribute;
        multiple = selectorConfig.multiple;
        transform = selectorConfig.transform;
      }

      const elements = $(selector);

      if (multiple) {
        data[key] = [];
        elements.each((_, el) => {
          let value = this.extractValue($, el, attribute);
          if (transform) {
            value = this.applyTransform(value, transform);
          }
          data[key].push(value);
        });
      } else {
        let value = this.extractValue($, elements.first(), attribute);
        if (transform) {
          value = this.applyTransform(value, transform);
        }
        data[key] = value;
      }
    }

    return data;
  }

  /**
   * Extract value from element
   */
  extractValue($, element, attribute) {
    const $el = $(element);

    if (!$el.length) {
      return null;
    }

    if (attribute) {
      return $el.attr(attribute);
    }

    return $el.text().trim();
  }

  /**
   * Apply transform to value
   */
  applyTransform(value, transform) {
    if (!value) return value;

    switch (transform) {
      case 'trim':
        return value.trim();
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'number':
        return parseFloat(value.replace(/[^0-9.-]/g, ''));
      case 'integer':
        return parseInt(value.replace(/[^0-9-]/g, ''), 10);
      case 'removeWhitespace':
        return value.replace(/\s+/g, ' ').trim();
      default:
        return value;
    }
  }

  /**
   * Extract JSON-LD structured data
   */
  extractJsonLd($) {
    const jsonLd = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html());
        jsonLd.push(data);
      } catch (e) {
        // Invalid JSON, skip
      }
    });

    return jsonLd;
  }

  /**
   * Extract all links
   */
  extractLinks($, baseUrl) {
    const links = [];
    const seen = new Set();

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();

      if (href && !seen.has(href)) {
        seen.add(href);
        links.push({
          href: this.resolveUrl(href, baseUrl),
          text: text || null,
          rel: $(el).attr('rel') || null
        });
      }
    });

    return links;
  }

  /**
   * Extract all images
   */
  extractImages($, baseUrl) {
    const images = [];
    const seen = new Set();

    $('img[src]').each((_, el) => {
      const src = $(el).attr('src');

      if (src && !seen.has(src)) {
        seen.add(src);
        images.push({
          src: this.resolveUrl(src, baseUrl),
          alt: $(el).attr('alt') || null,
          title: $(el).attr('title') || null,
          width: $(el).attr('width') || null,
          height: $(el).attr('height') || null
        });
      }
    });

    return images;
  }

  /**
   * Extract full text content
   */
  extractText($) {
    // Remove script and style elements
    $('script, style, noscript').remove();

    // Get text content
    return $('body').text()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Resolve relative URLs
   */
  resolveUrl(href, baseUrl) {
    if (!href) return null;

    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return href;
    }
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
          description: 'URL to scrape'
        },
        selectors: {
          type: 'object',
          additionalProperties: {
            oneOf: [
              { type: 'string' },
              {
                type: 'object',
                properties: {
                  selector: { type: 'string' },
                  attribute: { type: 'string' },
                  multiple: { type: 'boolean' },
                  transform: {
                    type: 'string',
                    enum: ['trim', 'lowercase', 'uppercase', 'number', 'integer', 'removeWhitespace']
                  }
                }
              }
            ]
          },
          description: 'CSS selectors to extract data'
        },
        extractJson: {
          type: 'boolean',
          default: false,
          description: 'Extract JSON-LD structured data'
        },
        extractLinks: {
          type: 'boolean',
          default: false,
          description: 'Extract all links'
        },
        extractImages: {
          type: 'boolean',
          default: false,
          description: 'Extract all images'
        },
        extractText: {
          type: 'boolean',
          default: false,
          description: 'Extract full text content'
        },
        headers: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Custom request headers'
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
        success: { type: 'boolean' },
        url: { type: 'string' },
        title: { type: 'string' },
        meta: { type: 'object' },
        data: { type: 'object' },
        jsonLd: { type: 'array' },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              href: { type: 'string' },
              text: { type: 'string' },
              rel: { type: 'string' }
            }
          }
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              src: { type: 'string' },
              alt: { type: 'string' },
              title: { type: 'string' }
            }
          }
        },
        text: { type: 'string' }
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
        rateLimit: {
          type: 'integer',
          default: 1000,
          description: 'Minimum time between requests to same domain (ms)'
        },
        maxRetries: {
          type: 'integer',
          default: 3,
          description: 'Maximum retry attempts'
        },
        userAgent: {
          type: 'string',
          description: 'User-Agent header'
        }
      }
    };
  }
}

module.exports = WebScraperTool;
