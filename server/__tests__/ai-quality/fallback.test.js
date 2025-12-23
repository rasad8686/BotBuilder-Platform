/**
 * AI Fallback Tests
 * Tests bot behavior when primary AI provider fails and needs fallback
 * Ensures proper provider failover and graceful degradation chain
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
// AI PROVIDER SIMULATION
// ========================================

/**
 * Mock AI provider that can succeed or fail
 */
class MockAIProvider {
  constructor(name, options = {}) {
    this.name = name;
    this.isAvailable = options.isAvailable !== false;
    this.responseDelay = options.responseDelay || 0;
    this.failureMode = options.failureMode || null;
    this.successRate = options.successRate || 1.0;
    this.callCount = 0;
    this.lastError = null;
  }

  async chat(messages) {
    this.callCount++;

    // Simulate delay
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }

    // Check if provider should fail
    if (!this.isAvailable || this.failureMode) {
      const error = this.createError();
      this.lastError = error;
      throw error;
    }

    // Random failure based on success rate
    if (Math.random() > this.successRate) {
      const error = new Error('Random failure');
      error.code = 'RANDOM_FAILURE';
      this.lastError = error;
      throw error;
    }

    return {
      content: `Response from ${this.name}`,
      provider: this.name,
      usage: { prompt_tokens: 50, completion_tokens: 25 }
    };
  }

  createError() {
    switch (this.failureMode) {
      case 'timeout':
        const timeoutError = new Error('Request timeout');
        timeoutError.code = 'ETIMEDOUT';
        return timeoutError;

      case 'rate_limit':
        const rateLimitError = new Error('Rate limit exceeded');
        rateLimitError.statusCode = 429;
        return rateLimitError;

      case 'server_error':
        const serverError = new Error('Internal Server Error');
        serverError.statusCode = 500;
        return serverError;

      case 'unavailable':
        const unavailableError = new Error('Service Unavailable');
        unavailableError.statusCode = 503;
        return unavailableError;

      case 'auth_error':
        const authError = new Error('Invalid API key');
        authError.statusCode = 401;
        return authError;

      default:
        const genericError = new Error('Provider unavailable');
        genericError.code = 'PROVIDER_UNAVAILABLE';
        return genericError;
    }
  }

  setAvailable(available) {
    this.isAvailable = available;
    if (available) this.failureMode = null;
  }

  setFailureMode(mode) {
    this.failureMode = mode;
  }

  reset() {
    this.callCount = 0;
    this.lastError = null;
  }
}

/**
 * AI Failover Manager - handles provider fallback chain
 */
class AIFailoverManager {
  constructor(providers, options = {}) {
    this.providers = providers;
    this.primaryProvider = options.primaryProvider || providers[0]?.name;
    this.maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1;
    this.failoverDelay = options.failoverDelay || 0;
    this.circuitBreaker = new Map();
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 3;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 30000;
    this.fallbackMessage = options.fallbackMessage ||
      'Bağışlayın, AI xidməti müvəqqəti əlçatmazdır. Zəhmət olmasa daha sonra cəhd edin.';
    this.lastUsedProvider = null;
    this.failoverHistory = [];
  }

  async processMessage(userMessage) {
    const messages = [{ role: 'user', content: userMessage }];
    let lastError = null;

    for (const provider of this.providers) {
      // Check circuit breaker
      if (this.isCircuitOpen(provider.name)) {
        continue;
      }

      try {
        const response = await this.tryProvider(provider, messages);
        this.lastUsedProvider = provider.name;
        this.recordSuccess(provider.name);

        return {
          success: true,
          content: response.content,
          provider: provider.name,
          usage: response.usage,
          failedProviders: this.getFailedProviders(lastError)
        };
      } catch (error) {
        lastError = error;
        this.recordFailure(provider.name, error);
        this.failoverHistory.push({
          from: provider.name,
          error: error.message,
          timestamp: Date.now()
        });

        // Add failover delay before trying next provider
        if (this.failoverDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.failoverDelay));
        }
      }
    }

    // All providers failed
    return {
      success: false,
      content: this.fallbackMessage,
      error: 'ALL_PROVIDERS_FAILED',
      lastError: lastError?.message,
      failedProviders: this.providers.map(p => p.name)
    };
  }

  async tryProvider(provider, messages) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await provider.chat(messages);
      } catch (error) {
        lastError = error;

        // Don't retry for certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  isNonRetryableError(error) {
    // Auth errors shouldn't be retried
    return error.statusCode === 401 || error.statusCode === 403;
  }

  isCircuitOpen(providerName) {
    const state = this.circuitBreaker.get(providerName);
    if (!state) return false;

    if (state.isOpen) {
      // Check if timeout has passed
      if (Date.now() - state.openedAt > this.circuitBreakerTimeout) {
        state.isOpen = false;
        state.failures = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordFailure(providerName, error) {
    let state = this.circuitBreaker.get(providerName);
    if (!state) {
      state = { failures: 0, isOpen: false };
      this.circuitBreaker.set(providerName, state);
    }

    state.failures++;
    state.lastError = error;

    if (state.failures >= this.circuitBreakerThreshold) {
      state.isOpen = true;
      state.openedAt = Date.now();
    }
  }

  recordSuccess(providerName) {
    const state = this.circuitBreaker.get(providerName);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
    }
  }

  getFailedProviders(lastError) {
    if (!lastError) return [];
    return this.failoverHistory
      .filter(h => Date.now() - h.timestamp < 5000)
      .map(h => h.from);
  }

  getProviderStatus() {
    return this.providers.map(p => ({
      name: p.name,
      isAvailable: p.isAvailable,
      callCount: p.callCount,
      circuitOpen: this.isCircuitOpen(p.name),
      failures: this.circuitBreaker.get(p.name)?.failures || 0
    }));
  }

  resetCircuitBreaker(providerName) {
    this.circuitBreaker.delete(providerName);
  }

  resetAll() {
    this.circuitBreaker.clear();
    this.failoverHistory = [];
    this.providers.forEach(p => p.reset());
  }
}

/**
 * Priority-based fallback configuration
 */
class PriorityFallbackConfig {
  constructor() {
    this.priorityMap = new Map();
  }

  setPriority(providerName, priority) {
    this.priorityMap.set(providerName, priority);
  }

  sortProviders(providers) {
    return [...providers].sort((a, b) => {
      const priorityA = this.priorityMap.get(a.name) || 999;
      const priorityB = this.priorityMap.get(b.name) || 999;
      return priorityA - priorityB;
    });
  }
}

// ========================================
// TESTS
// ========================================

describe('AI Fallback Handling', () => {

  // ----------------------------------------
  // Primary Provider Success
  // ----------------------------------------
  describe('Primary Provider Success', () => {
    it('should use primary provider when available', async () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
      expect(openai.callCount).toBe(1);
      expect(claude.callCount).toBe(0);
    });

    it('should not attempt fallback when primary succeeds', async () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');
      const gemini = new MockAIProvider('gemini');

      const manager = new AIFailoverManager([openai, claude, gemini]);
      await manager.processMessage('Hello');

      expect(openai.callCount).toBe(1);
      expect(claude.callCount).toBe(0);
      expect(gemini.callCount).toBe(0);
    });
  });

  // ----------------------------------------
  // Fallback to Secondary
  // ----------------------------------------
  describe('Fallback to Secondary Provider', () => {
    it('should fallback to secondary when primary fails', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], { maxRetries: 0 });
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
      expect(openai.callCount).toBe(1);
      expect(claude.callCount).toBe(1);
    });

    it('should fallback on timeout', async () => {
      const openai = new MockAIProvider('openai', { failureMode: 'timeout' });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
    });

    it('should fallback on rate limit', async () => {
      const openai = new MockAIProvider('openai', { failureMode: 'rate_limit' });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
    });

    it('should fallback on server error', async () => {
      const openai = new MockAIProvider('openai', { failureMode: 'server_error' });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('claude');
    });

    it('should report failed providers in response', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      const result = await manager.processMessage('Hello');

      expect(result.failedProviders).toContain('openai');
    });
  });

  // ----------------------------------------
  // Multi-Level Fallback
  // ----------------------------------------
  describe('Multi-Level Fallback', () => {
    it('should try all providers in order', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude', { isAvailable: false });
      const gemini = new MockAIProvider('gemini');

      const manager = new AIFailoverManager([openai, claude, gemini], { maxRetries: 0 });
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gemini');
      expect(openai.callCount).toBe(1);
      expect(claude.callCount).toBe(1);
      expect(gemini.callCount).toBe(1);
    });

    it('should fail gracefully when all providers fail', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude', { isAvailable: false });
      const gemini = new MockAIProvider('gemini', { isAvailable: false });

      const manager = new AIFailoverManager([openai, claude, gemini]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALL_PROVIDERS_FAILED');
      expect(result.content).toContain('Bağışlayın');
    });

    it('should list all failed providers when all fail', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude', { isAvailable: false });

      const manager = new AIFailoverManager([openai, claude]);
      const result = await manager.processMessage('Hello');

      expect(result.failedProviders).toEqual(['openai', 'claude']);
    });
  });

  // ----------------------------------------
  // Circuit Breaker
  // ----------------------------------------
  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], {
        circuitBreakerThreshold: 3
      });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        await manager.processMessage('Hello');
      }

      // Circuit should be open
      expect(manager.isCircuitOpen('openai')).toBe(true);
    });

    it('should skip provider with open circuit', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], {
        circuitBreakerThreshold: 2
      });

      // Fail twice to open circuit
      await manager.processMessage('Hello 1');
      await manager.processMessage('Hello 2');

      // Reset call counts
      openai.callCount = 0;
      claude.callCount = 0;

      // This request should skip openai
      await manager.processMessage('Hello 3');

      expect(openai.callCount).toBe(0);
      expect(claude.callCount).toBe(1);
    });

    it('should close circuit after timeout', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], {
        circuitBreakerThreshold: 1,
        circuitBreakerTimeout: 100 // 100ms for testing
      });

      // Open circuit
      await manager.processMessage('Hello');
      expect(manager.isCircuitOpen('openai')).toBe(true);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Circuit should be closed now
      expect(manager.isCircuitOpen('openai')).toBe(false);
    });

    it('should reset circuit breaker on success', async () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], {
        circuitBreakerThreshold: 3
      });

      // Record some failures manually
      manager.recordFailure('openai', new Error('Test'));
      manager.recordFailure('openai', new Error('Test'));

      // Success should reset
      await manager.processMessage('Hello');

      const status = manager.getProviderStatus();
      const openaiStatus = status.find(s => s.name === 'openai');
      expect(openaiStatus.failures).toBe(0);
    });
  });

  // ----------------------------------------
  // Retry Logic
  // ----------------------------------------
  describe('Retry Logic', () => {
    it('should retry provider on failure', async () => {
      let callCount = 0;
      const flaky = {
        name: 'flaky',
        chat: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Temporary failure');
          }
          return { content: 'Success', usage: {} };
        })
      };

      const manager = new AIFailoverManager([flaky], { maxRetries: 2 });
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    });

    it('should not retry auth errors', async () => {
      const openai = new MockAIProvider('openai', { failureMode: 'auth_error' });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], { maxRetries: 3 });
      const result = await manager.processMessage('Hello');

      expect(openai.callCount).toBe(1); // No retries
      expect(result.provider).toBe('claude');
    });

    it('should failover after max retries exceeded', async () => {
      const openai = new MockAIProvider('openai', { failureMode: 'server_error' });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude], { maxRetries: 2 });
      await manager.processMessage('Hello');

      expect(openai.callCount).toBe(3); // Initial + 2 retries
    });
  });

  // ----------------------------------------
  // Provider Status
  // ----------------------------------------
  describe('Provider Status', () => {
    it('should track provider status', async () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      await manager.processMessage('Hello');

      const status = manager.getProviderStatus();

      expect(status).toHaveLength(2);
      expect(status[0].name).toBe('openai');
      expect(status[0].callCount).toBe(1);
    });

    it('should track last used provider', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      await manager.processMessage('Hello');

      expect(manager.lastUsedProvider).toBe('claude');
    });

    it('should track failover history', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);
      await manager.processMessage('Hello');

      expect(manager.failoverHistory).toHaveLength(1);
      expect(manager.failoverHistory[0].from).toBe('openai');
    });
  });

  // ----------------------------------------
  // Priority Configuration
  // ----------------------------------------
  describe('Priority Configuration', () => {
    it('should sort providers by priority', () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');
      const gemini = new MockAIProvider('gemini');

      const config = new PriorityFallbackConfig();
      config.setPriority('gemini', 1);
      config.setPriority('claude', 2);
      config.setPriority('openai', 3);

      const sorted = config.sortProviders([openai, claude, gemini]);

      expect(sorted[0].name).toBe('gemini');
      expect(sorted[1].name).toBe('claude');
      expect(sorted[2].name).toBe('openai');
    });

    it('should handle providers without priority', () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');
      const gemini = new MockAIProvider('gemini');

      const config = new PriorityFallbackConfig();
      config.setPriority('claude', 1);
      // openai and gemini have no priority

      const sorted = config.sortProviders([openai, claude, gemini]);

      expect(sorted[0].name).toBe('claude');
    });
  });

  // ----------------------------------------
  // Fallback Messages
  // ----------------------------------------
  describe('Fallback Messages', () => {
    it('should return Azerbaijani fallback message', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });

      const manager = new AIFailoverManager([openai]);
      const result = await manager.processMessage('Hello');

      expect(result.content).toContain('Bağışlayın');
      expect(result.content).toContain('AI xidməti');
    });

    it('should allow custom fallback message', async () => {
      const customMessage = 'AI service is temporarily unavailable.';
      const openai = new MockAIProvider('openai', { isAvailable: false });

      const manager = new AIFailoverManager([openai], {
        fallbackMessage: customMessage
      });
      const result = await manager.processMessage('Hello');

      expect(result.content).toBe(customMessage);
    });
  });

  // ----------------------------------------
  // Provider Recovery
  // ----------------------------------------
  describe('Provider Recovery', () => {
    it('should use recovered primary provider', async () => {
      const openai = new MockAIProvider('openai', { isAvailable: false });
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);

      // First request uses claude
      let result = await manager.processMessage('Hello 1');
      expect(result.provider).toBe('claude');

      // Recover openai
      openai.setAvailable(true);
      manager.resetCircuitBreaker('openai');

      // Should use openai again
      result = await manager.processMessage('Hello 2');
      expect(result.provider).toBe('openai');
    });

    it('should handle intermittent failures', async () => {
      let failureCount = 0;
      const flaky = {
        name: 'flaky',
        isAvailable: true,
        callCount: 0,
        chat: jest.fn().mockImplementation(() => {
          failureCount++;
          // Fail every other request
          if (failureCount % 2 === 1) {
            const error = new Error('Intermittent failure');
            error.code = 'INTERMITTENT';
            throw error;
          }
          return { content: 'Success', usage: {} };
        }),
        reset: jest.fn()
      };
      const backup = new MockAIProvider('backup');

      const manager = new AIFailoverManager([flaky, backup], { maxRetries: 1 });

      // Should eventually succeed through retry or fallback
      const result = await manager.processMessage('Hello');
      expect(result.success).toBe(true);
    });
  });

  // ----------------------------------------
  // Edge Cases
  // ----------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty provider list', async () => {
      const manager = new AIFailoverManager([]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ALL_PROVIDERS_FAILED');
    });

    it('should handle single provider', async () => {
      const openai = new MockAIProvider('openai');
      const manager = new AIFailoverManager([openai]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('openai');
    });

    it('should handle provider throwing unexpected error', async () => {
      const badProvider = {
        name: 'bad',
        isAvailable: true,
        callCount: 0,
        chat: jest.fn().mockImplementation(() => {
          throw new TypeError('Unexpected error type');
        }),
        reset: jest.fn()
      };
      const backup = new MockAIProvider('backup');

      const manager = new AIFailoverManager([badProvider, backup]);
      const result = await manager.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('backup');
    });

    it('should reset all providers and state', () => {
      const openai = new MockAIProvider('openai');
      const claude = new MockAIProvider('claude');

      const manager = new AIFailoverManager([openai, claude]);

      // Add some state
      manager.recordFailure('openai', new Error('Test'));
      manager.failoverHistory.push({ from: 'openai', error: 'Test', timestamp: Date.now() });

      // Reset
      manager.resetAll();

      expect(manager.circuitBreaker.size).toBe(0);
      expect(manager.failoverHistory).toHaveLength(0);
    });
  });
});
