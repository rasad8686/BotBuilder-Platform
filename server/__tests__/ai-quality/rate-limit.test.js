/**
 * AI Rate Limit Tests
 * Tests bot behavior when AI providers return 429 Too Many Requests
 * Ensures proper retry mechanisms and backoff strategies
 */

// ========================================
// MOCKS
// ========================================

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// ========================================
// AI SERVICE SIMULATION
// ========================================

/**
 * Simulates an AI service with rate limiting
 */
class MockRateLimitedAIService {
  constructor(options = {}) {
    this.provider = options.provider || 'openai';
    this.rateLimitAfter = options.rateLimitAfter !== undefined ? options.rateLimitAfter : Infinity; // Requests before rate limit (0 = immediate)
    this.retryAfter = options.retryAfter || 60; // Seconds to wait
    this.requestCount = 0;
    this.resetTime = null;
  }

  async chat(messages) {
    this.requestCount++;

    // Check if we should rate limit (rateLimitAfter: 0 means rate limit on first request)
    if (this.requestCount > this.rateLimitAfter) {
      throw this.createRateLimitError();
    }

    // Simulate successful response
    return {
      content: `Response #${this.requestCount}`,
      usage: { prompt_tokens: 50, completion_tokens: 25 }
    };
  }

  createRateLimitError() {
    const error = new Error('Rate limit exceeded');
    error.status = 429;
    error.statusCode = 429;
    error.code = 'rate_limit_exceeded';
    error.response = {
      status: 429,
      headers: {
        'retry-after': String(this.retryAfter),
        'x-ratelimit-limit-requests': '60',
        'x-ratelimit-limit-tokens': '150000',
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-remaining-tokens': '0',
        'x-ratelimit-reset-requests': '1s',
        'x-ratelimit-reset-tokens': '6s'
      },
      data: {
        error: {
          message: 'Rate limit reached for requests',
          type: 'requests',
          code: 'rate_limit_exceeded'
        }
      }
    };
    return error;
  }

  reset() {
    this.requestCount = 0;
    this.resetTime = null;
  }
}

/**
 * AI Handler with rate limit handling and retry logic
 */
class RateLimitHandler {
  constructor(aiService, options = {}) {
    this.aiService = aiService;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 3;
    this.baseDelay = options.baseDelay !== undefined ? options.baseDelay : 1000; // 1 second
    this.maxDelay = options.maxDelay || 60000; // 60 seconds
    this.retryCount = 0;
    this.lastRateLimitTime = null;
    this.fallbackMessage = options.fallbackMessage ||
      'Bağışlayın, hazırda çox sorğu göndərilir. Zəhmət olmasa bir az gözləyin.';
  }

  async processMessage(userMessage) {
    try {
      const response = await this.executeWithRetry(() =>
        this.aiService.chat([{ role: 'user', content: userMessage }])
      );

      return {
        success: true,
        content: response.content,
        usage: response.usage,
        retryCount: this.retryCount
      };
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.lastRateLimitTime = Date.now();

        return {
          success: false,
          content: this.fallbackMessage,
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: this.parseRetryAfter(error),
          rateLimitInfo: this.extractRateLimitInfo(error),
          retryCount: this.retryCount
        };
      }

      return {
        success: false,
        content: this.fallbackMessage,
        error: error.code || 'UNKNOWN_ERROR',
        message: error.message
      };
    }
  }

  async executeWithRetry(fn) {
    this.retryCount = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        if (!this.isRateLimitError(error) || this.retryCount >= this.maxRetries) {
          throw error;
        }

        this.retryCount++;
        const delay = this.calculateBackoff(error);
        await this.sleep(delay);
      }
    }
  }

  isRateLimitError(error) {
    return error.status === 429 ||
           error.statusCode === 429 ||
           error.code === 'rate_limit_exceeded';
  }

  parseRetryAfter(error) {
    if (error.response?.headers?.['retry-after']) {
      return parseInt(error.response.headers['retry-after'], 10) * 1000;
    }
    return this.baseDelay;
  }

  extractRateLimitInfo(error) {
    const headers = error.response?.headers || {};
    return {
      limitRequests: parseInt(headers['x-ratelimit-limit-requests'] || '0', 10),
      limitTokens: parseInt(headers['x-ratelimit-limit-tokens'] || '0', 10),
      remainingRequests: parseInt(headers['x-ratelimit-remaining-requests'] || '0', 10),
      remainingTokens: parseInt(headers['x-ratelimit-remaining-tokens'] || '0', 10),
      resetRequests: headers['x-ratelimit-reset-requests'] || null,
      resetTokens: headers['x-ratelimit-reset-tokens'] || null
    };
  }

  calculateBackoff(error) {
    // Use retry-after header if available
    const retryAfter = this.parseRetryAfter(error);
    if (retryAfter > this.baseDelay) {
      return Math.min(retryAfter, this.maxDelay);
    }

    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, this.retryCount);
    // Jitter is proportional to base delay (max 10% of base delay or 1000ms, whichever is smaller)
    const jitterMax = Math.min(this.baseDelay * 0.1, 1000);
    const jitter = Math.random() * jitterMax;
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      lastRateLimitTime: this.lastRateLimitTime,
      retryCount: this.retryCount,
      isRateLimited: this.lastRateLimitTime !== null &&
                     Date.now() - this.lastRateLimitTime < 60000
    };
  }
}

/**
 * Token bucket rate limiter for client-side rate limiting
 */
class TokenBucketRateLimiter {
  constructor(options = {}) {
    this.capacity = options.capacity || 60; // Max tokens
    this.refillRate = options.refillRate || 1; // Tokens per second
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  async acquire() {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, remaining: this.tokens };
    }

    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((1 - this.tokens) / this.refillRate) * 1000
    };
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  getStatus() {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      capacity: this.capacity,
      refillRate: this.refillRate
    };
  }
}

// ========================================
// TESTS
// ========================================

describe('AI Rate Limit Handling', () => {

  // ----------------------------------------
  // OpenAI Rate Limits
  // ----------------------------------------
  describe('OpenAI Rate Limiting', () => {
    it('should handle 429 Too Many Requests', async () => {
      const aiService = new MockRateLimitedAIService({
        provider: 'openai',
        rateLimitAfter: 0 // Rate limit immediately
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should extract retry-after header', async () => {
      const aiService = new MockRateLimitedAIService({
        provider: 'openai',
        rateLimitAfter: 0,
        retryAfter: 30
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });
      const result = await handler.processMessage('Hello');

      expect(result.retryAfter).toBe(30000); // 30 seconds in ms
    });

    it('should extract rate limit info from headers', async () => {
      const aiService = new MockRateLimitedAIService({
        provider: 'openai',
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });
      const result = await handler.processMessage('Hello');

      expect(result.rateLimitInfo).toEqual({
        limitRequests: 60,
        limitTokens: 150000,
        remainingRequests: 0,
        remainingTokens: 0,
        resetRequests: '1s',
        resetTokens: '6s'
      });
    });

    it('should succeed before hitting rate limit', async () => {
      const aiService = new MockRateLimitedAIService({
        provider: 'openai',
        rateLimitAfter: 5
      });

      const handler = new RateLimitHandler(aiService);

      // First 5 requests should succeed
      for (let i = 0; i < 5; i++) {
        const result = await handler.processMessage(`Message ${i}`);
        expect(result.success).toBe(true);
      }
    });

    it('should fail after hitting rate limit', async () => {
      const aiService = new MockRateLimitedAIService({
        provider: 'openai',
        rateLimitAfter: 2
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });

      // First 2 succeed
      await handler.processMessage('Message 1');
      await handler.processMessage('Message 2');

      // Third should fail
      const result = await handler.processMessage('Message 3');
      expect(result.success).toBe(false);
      expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // ----------------------------------------
  // Claude Rate Limits
  // ----------------------------------------
  describe('Claude Rate Limiting', () => {
    it('should handle Claude 429 response', async () => {
      const aiService = new MockRateLimitedAIService({
        provider: 'claude',
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });
      const result = await handler.processMessage('Hello Claude');

      expect(result.success).toBe(false);
      expect(result.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // ----------------------------------------
  // Retry Mechanism
  // ----------------------------------------
  describe('Retry Mechanism', () => {
    it('should retry on rate limit with configurable max retries', async () => {
      jest.useFakeTimers();

      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, {
        maxRetries: 3,
        baseDelay: 10 // Small delay for testing
      });

      const resultPromise = handler.processMessage('Hello');

      // Fast-forward through all retry delays
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(3); // Should have retried 3 times

      jest.useRealTimers();
    });

    it('should succeed if rate limit clears during retry', async () => {
      let callCount = 0;
      const mockService = {
        chat: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            const error = new Error('Rate limit');
            error.statusCode = 429;
            throw error;
          }
          return { content: 'Success!', usage: {} };
        })
      };

      const handler = new RateLimitHandler(mockService, {
        maxRetries: 3,
        baseDelay: 10
      });

      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.content).toBe('Success!');
      expect(result.retryCount).toBe(2); // Succeeded on 3rd attempt
    });

    it('should calculate exponential backoff', () => {
      const aiService = new MockRateLimitedAIService();
      const handler = new RateLimitHandler(aiService, {
        baseDelay: 1000,
        maxDelay: 60000
      });

      const error = { statusCode: 429, response: { headers: {} } };

      // First retry
      handler.retryCount = 0;
      const delay1 = handler.calculateBackoff(error);
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(2000); // Base + jitter

      // Second retry
      handler.retryCount = 1;
      const delay2 = handler.calculateBackoff(error);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(3000); // 2^1 * base + jitter

      // Third retry
      handler.retryCount = 2;
      const delay3 = handler.calculateBackoff(error);
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(5000); // 2^2 * base + jitter
    });

    it('should respect max delay limit', () => {
      const aiService = new MockRateLimitedAIService();
      const handler = new RateLimitHandler(aiService, {
        baseDelay: 10000,
        maxDelay: 30000
      });

      const error = { statusCode: 429, response: { headers: {} } };

      handler.retryCount = 5; // Would be 320000ms without cap
      const delay = handler.calculateBackoff(error);

      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('should use retry-after header when available', () => {
      const aiService = new MockRateLimitedAIService();
      const handler = new RateLimitHandler(aiService, {
        baseDelay: 1000,
        maxDelay: 60000
      });

      const error = {
        statusCode: 429,
        response: {
          headers: {
            'retry-after': '45'
          }
        }
      };

      const delay = handler.calculateBackoff(error);
      expect(delay).toBe(45000); // 45 seconds
    });
  });

  // ----------------------------------------
  // Token Bucket Rate Limiter
  // ----------------------------------------
  describe('Token Bucket Rate Limiter', () => {
    it('should allow requests when tokens available', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 10,
        refillRate: 1
      });

      const result = await limiter.acquire();

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should deny requests when no tokens available', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 2,
        refillRate: 0.001 // Very slow refill
      });

      await limiter.acquire();
      await limiter.acquire();
      const result = await limiter.acquire();

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should refill tokens over time', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 10,
        refillRate: 1000 // 1000 tokens per second for testing
      });

      // Use all tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      // Access tokens directly without triggering refill
      // Note: tokens may be slightly above 0 due to micro-timing between acquires
      expect(Math.floor(limiter.tokens)).toBeLessThanOrEqual(1);

      // Wait a bit for refill
      await new Promise(resolve => setTimeout(resolve, 50));

      const status = limiter.getStatus();
      expect(status.tokens).toBeGreaterThan(0);
    });

    it('should not exceed capacity', async () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 5,
        refillRate: 1000
      });

      // Wait for potential over-refill
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = limiter.getStatus();
      expect(status.tokens).toBeLessThanOrEqual(5);
    });

    it('should return correct status', () => {
      const limiter = new TokenBucketRateLimiter({
        capacity: 60,
        refillRate: 1
      });

      const status = limiter.getStatus();

      expect(status).toEqual({
        tokens: 60,
        capacity: 60,
        refillRate: 1
      });
    });
  });

  // ----------------------------------------
  // Fallback Messages
  // ----------------------------------------
  describe('Fallback Messages', () => {
    it('should return user-friendly message on rate limit', async () => {
      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });
      const result = await handler.processMessage('Hello');

      expect(result.content).toContain('Bağışlayın');
      expect(result.content).toContain('gözləyin');
    });

    it('should allow custom fallback message', async () => {
      const customMessage = 'Too many requests. Please wait and try again.';
      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, {
        maxRetries: 0,
        fallbackMessage: customMessage
      });

      const result = await handler.processMessage('Hello');

      expect(result.content).toBe(customMessage);
    });
  });

  // ----------------------------------------
  // Status Tracking
  // ----------------------------------------
  describe('Status Tracking', () => {
    it('should track rate limit status', async () => {
      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });

      // Initially not rate limited
      expect(handler.getStatus().isRateLimited).toBe(false);

      // After rate limit hit
      await handler.processMessage('Hello');

      const status = handler.getStatus();
      expect(status.isRateLimited).toBe(true);
      expect(status.lastRateLimitTime).not.toBeNull();
    });

    it('should track retry count', async () => {
      jest.useFakeTimers();

      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 0
      });

      const handler = new RateLimitHandler(aiService, {
        maxRetries: 2,
        baseDelay: 10
      });

      const resultPromise = handler.processMessage('Hello');

      // Fast-forward through all retry delays
      await jest.runAllTimersAsync();

      await resultPromise;

      expect(handler.getStatus().retryCount).toBe(2);

      jest.useRealTimers();
    });
  });

  // ----------------------------------------
  // Concurrent Requests
  // ----------------------------------------
  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent rate-limited requests', async () => {
      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 2
      });

      const handler = new RateLimitHandler(aiService, { maxRetries: 0 });

      const results = await Promise.all([
        handler.processMessage('Request 1'),
        handler.processMessage('Request 2'),
        handler.processMessage('Request 3'),
        handler.processMessage('Request 4'),
        handler.processMessage('Request 5')
      ]);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      expect(successCount).toBe(2);
      expect(failCount).toBe(3);
    });
  });

  // ----------------------------------------
  // Edge Cases
  // ----------------------------------------
  describe('Edge Cases', () => {
    it('should handle missing retry-after header', async () => {
      const aiService = {
        chat: jest.fn().mockImplementation(() => {
          const error = new Error('Rate limit');
          error.statusCode = 429;
          error.response = { headers: {} };
          throw error;
        })
      };

      const handler = new RateLimitHandler(aiService, {
        maxRetries: 0,
        baseDelay: 5000
      });

      const result = await handler.processMessage('Hello');

      expect(result.retryAfter).toBe(5000); // Falls back to baseDelay
    });

    it('should handle zero max retries with always failing service', async () => {
      // Service that always fails with rate limit
      const alwaysFailService = {
        chat: jest.fn().mockImplementation(() => {
          const error = new Error('Rate limit');
          error.statusCode = 429;
          error.code = 'rate_limit_exceeded';
          throw error;
        })
      };

      const handler = new RateLimitHandler(alwaysFailService, { maxRetries: 0 });
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(0);
    });

    it('should handle service reset after rate limit', async () => {
      const aiService = new MockRateLimitedAIService({
        rateLimitAfter: 1
      });

      const handler = new RateLimitHandler(aiService, {
        maxRetries: 0,
        baseDelay: 10
      });

      // First request succeeds
      let result = await handler.processMessage('Hello 1');
      expect(result.success).toBe(true);

      // Second request fails (rate limited)
      result = await handler.processMessage('Hello 2');
      expect(result.success).toBe(false);

      // Reset the service
      aiService.reset();

      // Should work again
      result = await handler.processMessage('Hello 3');
      expect(result.success).toBe(true);
    });
  });
});
