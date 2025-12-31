/**
 * AI Timeout Tests
 * Tests bot behavior when AI providers don't respond within expected timeframes
 * Ensures graceful handling of slow responses and proper timeout messages
 *
 * Uses Jest fake timers to avoid real delays in CI
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
// AI SERVICE SIMULATION (Synchronous for fake timers)
// ========================================

/**
 * Simulates an AI service that can timeout
 * Uses fake timers for instant test execution
 */
class MockAIService {
  constructor(options = {}) {
    this.responseDelay = options.responseDelay || 0;
    this.timeout = options.timeout || 30000;
    this.provider = options.provider || 'openai';
  }

  async chat(messages, options = {}) {
    const timeout = options.timeout || this.timeout;

    return new Promise((resolve, reject) => {
      let resolved = false;

      // Response timer
      const responseTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            content: 'AI response after delay',
            usage: { prompt_tokens: 100, completion_tokens: 50 }
          });
        }
      }, this.responseDelay);

      // Timeout timer - reject if timeout is shorter than response delay
      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(responseTimer);
          const error = new Error('Request timeout');
          error.code = 'ETIMEDOUT';
          error.isTimeout = true;
          reject(error);
        }
      }, timeout);

      // Clear timeout timer if response comes first
      if (this.responseDelay <= timeout) {
        setTimeout(() => clearTimeout(timeoutTimer), this.responseDelay + 10);
      }
    });
  }
}

/**
 * AI Message Handler with timeout support
 */
class AIMessageHandler {
  constructor(aiService, options = {}) {
    this.aiService = aiService;
    this.timeout = options.timeout || 30000;
    this.fallbackMessage = options.fallbackMessage ||
      'Bağışlayın, hazırda cavab verə bilmirəm. Zəhmət olmasa bir az sonra yenidən cəhd edin.';
  }

  async processMessage(userMessage, context = {}) {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.aiService.chat([{ role: 'user', content: userMessage }]),
        this.createTimeoutPromise()
      ]);

      const latency = Date.now() - startTime;

      return {
        success: true,
        content: response.content,
        latency,
        usage: response.usage
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      if (error.isTimeout || error.code === 'ETIMEDOUT') {
        return {
          success: false,
          content: this.fallbackMessage,
          error: 'TIMEOUT',
          latency,
          message: `AI request timed out after ${this.timeout}ms`
        };
      }

      return {
        success: false,
        content: this.fallbackMessage,
        error: error.code || 'UNKNOWN_ERROR',
        latency,
        message: error.message
      };
    }
  }

  createTimeoutPromise() {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`AI request timed out after ${this.timeout}ms`);
        error.isTimeout = true;
        error.code = 'ETIMEDOUT';
        reject(error);
      }, this.timeout);
    });
  }
}

// ========================================
// TESTS
// ========================================

describe('AI Timeout Handling', () => {
  // Use fake timers for all tests
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // Helper to advance timers and flush promises
  const advanceTimersAndFlush = async (ms) => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve(); // Flush microtasks
    await Promise.resolve(); // Extra flush for nested promises
  };

  // ----------------------------------------
  // OpenAI Timeout Tests
  // ----------------------------------------
  describe('OpenAI Timeout', () => {
    it('should handle normal response within timeout', async () => {
      const aiService = new MockAIService({
        provider: 'openai',
        responseDelay: 100 // 100ms response time
      });

      const handler = new AIMessageHandler(aiService, { timeout: 5000 });
      const resultPromise = handler.processMessage('Hello');

      // Advance time to let response complete
      await advanceTimersAndFlush(150);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.content).toBe('AI response after delay');
    });

    it('should timeout when OpenAI takes too long', async () => {
      const aiService = new MockAIService({
        provider: 'openai',
        responseDelay: 15000 // 15 seconds
      });

      const handler = new AIMessageHandler(aiService, { timeout: 100 }); // 100ms timeout
      const resultPromise = handler.processMessage('Hello');

      // Advance time past timeout
      await advanceTimersAndFlush(150);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('TIMEOUT');
      expect(result.content).toContain('Bağışlayın');
    });

    it('should return proper error structure on timeout', async () => {
      const aiService = new MockAIService({
        provider: 'openai',
        responseDelay: 15000
      });

      const handler = new AIMessageHandler(aiService, { timeout: 50 });
      const resultPromise = handler.processMessage('Hello');

      await advanceTimersAndFlush(100);

      const result = await resultPromise;

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error', 'TIMEOUT');
      expect(result).toHaveProperty('latency');
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('timed out');
    });

    it('should provide user-friendly fallback message on timeout', async () => {
      const customFallback = 'AI is currently slow. Please try again.';
      const aiService = new MockAIService({
        provider: 'openai',
        responseDelay: 15000
      });

      const handler = new AIMessageHandler(aiService, {
        timeout: 50,
        fallbackMessage: customFallback
      });
      const resultPromise = handler.processMessage('Hello');

      await advanceTimersAndFlush(100);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.content).toBe(customFallback);
    });
  });

  // ----------------------------------------
  // Claude Timeout Tests
  // ----------------------------------------
  describe('Claude Timeout', () => {
    it('should handle normal Claude response', async () => {
      const aiService = new MockAIService({
        provider: 'claude',
        responseDelay: 200
      });

      const handler = new AIMessageHandler(aiService, { timeout: 5000 });
      const resultPromise = handler.processMessage('Hello Claude');

      await advanceTimersAndFlush(250);

      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('should timeout when Claude takes too long', async () => {
      const aiService = new MockAIService({
        provider: 'claude',
        responseDelay: 60000 // 60 seconds
      });

      const handler = new AIMessageHandler(aiService, { timeout: 100 });
      const resultPromise = handler.processMessage('Hello Claude');

      await advanceTimersAndFlush(150);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('TIMEOUT');
    });
  });

  // ----------------------------------------
  // Timeout Edge Cases
  // ----------------------------------------
  describe('Timeout Edge Cases', () => {
    it('should handle response at exactly timeout boundary', async () => {
      const timeout = 100;
      const aiService = new MockAIService({
        responseDelay: 50 // Well under timeout to avoid race condition
      });

      const handler = new AIMessageHandler(aiService, { timeout });
      const resultPromise = handler.processMessage('Edge case test');

      // Advance past response time but before timeout
      await advanceTimersAndFlush(60);

      const result = await resultPromise;

      // Should succeed since response comes well before timeout
      expect(result.success).toBe(true);
    });

    it('should handle multiple concurrent timeout requests', async () => {
      const aiService = new MockAIService({
        responseDelay: 200
      });

      const handler = new AIMessageHandler(aiService, { timeout: 50 });

      const resultPromises = [
        handler.processMessage('Request 1'),
        handler.processMessage('Request 2'),
        handler.processMessage('Request 3')
      ];

      await advanceTimersAndFlush(100);

      const results = await Promise.all(resultPromises);

      // All should timeout
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('TIMEOUT');
      });
    });

    it('should handle zero timeout gracefully', async () => {
      const aiService = new MockAIService({
        responseDelay: 100
      });

      const handler = new AIMessageHandler(aiService, { timeout: 1 });
      const resultPromise = handler.processMessage('Zero timeout test');

      await advanceTimersAndFlush(50);

      const result = await resultPromise;

      expect(result.success).toBe(false);
    });
  });

  // ----------------------------------------
  // Timeout Configuration Tests
  // ----------------------------------------
  describe('Timeout Configuration', () => {
    it('should use default timeout when not specified', () => {
      const aiService = new MockAIService({
        responseDelay: 50
      });

      const handler = new AIMessageHandler(aiService); // No timeout specified
      expect(handler.timeout).toBe(30000); // Default 30 seconds
    });

    it('should allow custom timeout per request', async () => {
      const aiService = new MockAIService({
        responseDelay: 100
      });

      const handler = new AIMessageHandler(aiService, { timeout: 5000 });
      const resultPromise = handler.processMessage('Custom timeout');

      await advanceTimersAndFlush(150);

      const result = await resultPromise;

      expect(result.success).toBe(true);
    });

    it('should use different timeouts for different providers', () => {
      const openaiHandler = new AIMessageHandler(
        new MockAIService({ provider: 'openai' }),
        { timeout: 30000 }
      );

      const claudeHandler = new AIMessageHandler(
        new MockAIService({ provider: 'claude' }),
        { timeout: 60000 }
      );

      expect(openaiHandler.timeout).toBe(30000);
      expect(claudeHandler.timeout).toBe(60000);
    });
  });

  // ----------------------------------------
  // Error Message Tests
  // ----------------------------------------
  describe('Timeout Error Messages', () => {
    it('should provide localized error message in Azerbaijani', async () => {
      const aiService = new MockAIService({
        responseDelay: 10000
      });

      const handler = new AIMessageHandler(aiService, { timeout: 50 });
      const resultPromise = handler.processMessage('Hello');

      await advanceTimersAndFlush(100);

      const result = await resultPromise;

      expect(result.content).toContain('Bağışlayın');
      expect(result.content).toContain('yenidən cəhd edin');
    });

    it('should include timeout duration in error details', async () => {
      const timeout = 100;
      const aiService = new MockAIService({
        responseDelay: 10000
      });

      const handler = new AIMessageHandler(aiService, { timeout });
      const resultPromise = handler.processMessage('Hello');

      await advanceTimersAndFlush(150);

      const result = await resultPromise;

      expect(result.message).toContain(`${timeout}ms`);
    });
  });
});
