/**
 * AI Token Limit Tests
 * Tests bot behavior when messages exceed AI provider context limits
 * Ensures proper context truncation and token management
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
// TOKEN UTILITIES
// ========================================

/**
 * Simple token counter (approximation for testing)
 * In production, use tiktoken or similar library
 */
class TokenCounter {
  constructor(options = {}) {
    this.averageTokensPerWord = options.averageTokensPerWord || 1.3;
    this.averageTokensPerChar = options.averageTokensPerChar || 0.25;
  }

  countTokens(text) {
    if (!text) return 0;
    // Rough approximation: ~4 chars per token for English
    return Math.ceil(text.length * this.averageTokensPerChar);
  }

  countMessageTokens(messages) {
    let total = 0;
    for (const msg of messages) {
      // Each message has overhead (~4 tokens for role/formatting)
      total += 4;
      total += this.countTokens(msg.content);
      if (msg.name) total += this.countTokens(msg.name);
    }
    // Add 3 tokens for reply priming
    total += 3;
    return total;
  }
}

// ========================================
// AI SERVICE SIMULATION
// ========================================

/**
 * Simulates an AI service with token limits
 */
class MockTokenLimitedAIService {
  constructor(options = {}) {
    this.provider = options.provider || 'openai';
    this.maxContextTokens = options.maxContextTokens || 4096;
    this.maxOutputTokens = options.maxOutputTokens || 1024;
    this.tokenCounter = new TokenCounter();
  }

  async chat(messages, options = {}) {
    const inputTokens = this.tokenCounter.countMessageTokens(messages);
    const maxTokens = options.maxTokens || this.maxOutputTokens;

    // Check if input exceeds context limit
    if (inputTokens > this.maxContextTokens) {
      throw this.createContextLengthError(inputTokens);
    }

    // Check if combined would exceed
    if (inputTokens + maxTokens > this.maxContextTokens) {
      throw this.createContextLengthError(inputTokens + maxTokens);
    }

    // Simulate response
    const responseTokens = Math.min(50, maxTokens);
    return {
      content: 'AI response',
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: responseTokens,
        total_tokens: inputTokens + responseTokens
      }
    };
  }

  createContextLengthError(tokens) {
    const error = new Error(
      `This model's maximum context length is ${this.maxContextTokens} tokens. ` +
      `However, your messages resulted in ${tokens} tokens.`
    );
    error.code = 'context_length_exceeded';
    error.type = 'invalid_request_error';
    error.param = 'messages';
    error.status = 400;
    error.statusCode = 400;
    return error;
  }
}

/**
 * Context manager for handling token limits
 */
class ContextManager {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 4096;
    this.reservedForOutput = options.reservedForOutput || 1024;
    this.tokenCounter = new TokenCounter();
    this.truncationStrategy = options.truncationStrategy || 'middle'; // 'start', 'end', 'middle'
  }

  getAvailableTokens() {
    return this.maxTokens - this.reservedForOutput;
  }

  fitToContext(messages) {
    let totalTokens = this.tokenCounter.countMessageTokens(messages);
    const available = this.getAvailableTokens();

    if (totalTokens <= available) {
      return {
        messages,
        truncated: false,
        originalTokens: totalTokens,
        finalTokens: totalTokens
      };
    }

    // Need to truncate
    const truncatedMessages = this.truncateMessages(messages, available);
    const finalTokens = this.tokenCounter.countMessageTokens(truncatedMessages);

    return {
      messages: truncatedMessages,
      truncated: true,
      originalTokens: totalTokens,
      finalTokens,
      strategy: this.truncationStrategy
    };
  }

  truncateMessages(messages, maxTokens) {
    if (messages.length === 0) return messages;

    switch (this.truncationStrategy) {
      case 'start':
        return this.truncateFromStart(messages, maxTokens);
      case 'end':
        return this.truncateFromEnd(messages, maxTokens);
      case 'middle':
      default:
        return this.truncateMiddle(messages, maxTokens);
    }
  }

  truncateFromStart(messages, maxTokens) {
    // Keep system message (first) and most recent messages
    const result = [];
    let tokens = 0;

    // Always keep system message if present
    if (messages[0]?.role === 'system') {
      result.push(messages[0]);
      tokens += this.tokenCounter.countMessageTokens([messages[0]]);
      messages = messages.slice(1);
    }

    // Add messages from the end until we hit the limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.tokenCounter.countMessageTokens([messages[i]]);
      if (tokens + msgTokens <= maxTokens) {
        result.splice(result.length === 0 ? 0 : 1, 0, messages[i]);
        tokens += msgTokens;
      } else {
        break;
      }
    }

    return result;
  }

  truncateFromEnd(messages, maxTokens) {
    // Keep system message and earliest messages
    const result = [];
    let tokens = 0;

    for (const msg of messages) {
      const msgTokens = this.tokenCounter.countMessageTokens([msg]);
      if (tokens + msgTokens <= maxTokens) {
        result.push(msg);
        tokens += msgTokens;
      } else {
        break;
      }
    }

    return result;
  }

  truncateMiddle(messages, maxTokens) {
    // Keep system message, first few user messages, and most recent messages
    if (messages.length <= 2) return messages;

    const result = [];
    let tokens = 0;

    // Always keep system message
    if (messages[0]?.role === 'system') {
      result.push(messages[0]);
      tokens += this.tokenCounter.countMessageTokens([messages[0]]);
    }

    // Keep first user message for context
    const firstUserIdx = messages.findIndex(m => m.role === 'user');
    if (firstUserIdx > 0) {
      result.push(messages[firstUserIdx]);
      tokens += this.tokenCounter.countMessageTokens([messages[firstUserIdx]]);
    }

    // Add marker for truncation
    result.push({
      role: 'system',
      content: '[Earlier conversation truncated for context limit]'
    });
    tokens += 15; // Approximate tokens for marker

    // Add most recent messages
    for (let i = messages.length - 1; i >= 0; i--) {
      if (i === firstUserIdx || (messages[0]?.role === 'system' && i === 0)) continue;

      const msgTokens = this.tokenCounter.countMessageTokens([messages[i]]);
      if (tokens + msgTokens <= maxTokens) {
        result.push(messages[i]);
        tokens += msgTokens;
      }
    }

    // Sort to maintain conversation order
    return result.sort((a, b) => {
      const aIdx = messages.indexOf(a);
      const bIdx = messages.indexOf(b);
      if (aIdx === -1) return 1; // Truncation marker goes after first messages
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }

  truncateSingleMessage(message, maxTokens) {
    const currentTokens = this.tokenCounter.countTokens(message);
    if (currentTokens <= maxTokens) return message;

    // Approximate character limit
    const charLimit = Math.floor(maxTokens / 0.25);
    return message.substring(0, charLimit) + '... [truncated]';
  }
}

/**
 * AI Handler with token management
 */
class TokenManagedAIHandler {
  constructor(aiService, options = {}) {
    this.aiService = aiService;
    this.contextManager = new ContextManager({
      maxTokens: options.maxTokens || 4096,
      reservedForOutput: options.reservedForOutput || 1024,
      truncationStrategy: options.truncationStrategy || 'middle'
    });
    this.fallbackMessage = options.fallbackMessage ||
      'Bağışlayın, mesajınız çox uzundur. Zəhmət olmasa qısaldın.';
  }

  async processConversation(messages) {
    // Fit messages to context
    const fitted = this.contextManager.fitToContext(messages);

    try {
      const response = await this.aiService.chat(fitted.messages);

      return {
        success: true,
        content: response.content,
        usage: response.usage,
        truncated: fitted.truncated,
        originalTokens: fitted.originalTokens,
        finalTokens: fitted.finalTokens
      };
    } catch (error) {
      if (error.code === 'context_length_exceeded') {
        return {
          success: false,
          content: this.fallbackMessage,
          error: 'CONTEXT_LENGTH_EXCEEDED',
          message: error.message
        };
      }

      throw error;
    }
  }

  estimateTokens(text) {
    return this.contextManager.tokenCounter.countTokens(text);
  }
}

// ========================================
// TESTS
// ========================================

describe('AI Token Limit Handling', () => {

  // ----------------------------------------
  // Token Counting
  // ----------------------------------------
  describe('Token Counting', () => {
    it('should estimate tokens for simple text', () => {
      const counter = new TokenCounter();
      const text = 'Hello, how are you today?';
      const tokens = counter.countTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length); // Tokens should be fewer than chars
    });

    it('should count zero tokens for empty text', () => {
      const counter = new TokenCounter();
      expect(counter.countTokens('')).toBe(0);
      expect(counter.countTokens(null)).toBe(0);
      expect(counter.countTokens(undefined)).toBe(0);
    });

    it('should count message tokens including overhead', () => {
      const counter = new TokenCounter();
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const tokens = counter.countMessageTokens(messages);

      // Should include overhead per message + priming
      expect(tokens).toBeGreaterThan(counter.countTokens('Hello') + counter.countTokens('Hi there!'));
    });

    it('should handle long messages', () => {
      const counter = new TokenCounter();
      const longText = 'a'.repeat(10000);
      const tokens = counter.countTokens(longText);

      expect(tokens).toBeGreaterThan(1000);
    });
  });

  // ----------------------------------------
  // Context Length Exceeded
  // ----------------------------------------
  describe('Context Length Exceeded', () => {
    it('should handle context length error from OpenAI', async () => {
      const aiService = new MockTokenLimitedAIService({
        provider: 'openai',
        maxContextTokens: 100
      });

      const longMessages = [
        { role: 'user', content: 'a'.repeat(1000) }
      ];

      await expect(aiService.chat(longMessages)).rejects.toThrow('maximum context length');
    });

    it('should return proper error code for context exceeded', async () => {
      const aiService = new MockTokenLimitedAIService({
        provider: 'openai',
        maxContextTokens: 100
      });

      const longMessages = [
        { role: 'user', content: 'a'.repeat(1000) }
      ];

      try {
        await aiService.chat(longMessages);
        fail('Should have thrown');
      } catch (error) {
        expect(error.code).toBe('context_length_exceeded');
        expect(error.status).toBe(400);
      }
    });

    it('should succeed with messages under limit', async () => {
      const aiService = new MockTokenLimitedAIService({
        provider: 'openai',
        maxContextTokens: 4096
      });

      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];

      const result = await aiService.chat(messages);

      expect(result.content).toBe('AI response');
      expect(result.usage.prompt_tokens).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------
  // Context Truncation
  // ----------------------------------------
  describe('Context Truncation', () => {
    it('should not truncate messages within limit', () => {
      const manager = new ContextManager({
        maxTokens: 4096,
        reservedForOutput: 1024
      });

      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = manager.fitToContext(messages);

      expect(result.truncated).toBe(false);
      expect(result.messages).toEqual(messages);
    });

    it('should truncate messages exceeding limit', () => {
      const manager = new ContextManager({
        maxTokens: 50,  // Very small limit
        reservedForOutput: 10
      });

      // Create messages that will definitely exceed the 40 available tokens
      const messages = [
        { role: 'system', content: 'You are a very helpful and knowledgeable AI assistant that always provides detailed responses.' },
        { role: 'user', content: 'This is a longer user message that should definitely exceed the token limit we set.' },
        { role: 'assistant', content: 'This is a longer assistant response with additional text content.' },
        { role: 'user', content: 'Another user message with even more content to ensure we exceed limits.' },
        { role: 'assistant', content: 'Final assistant response that adds more tokens to the conversation.' }
      ];

      const result = manager.fitToContext(messages);

      expect(result.truncated).toBe(true);
      expect(result.finalTokens).toBeLessThan(result.originalTokens);
    });

    it('should preserve system message during truncation', () => {
      const manager = new ContextManager({
        maxTokens: 200,
        reservedForOutput: 50,
        truncationStrategy: 'start'
      });

      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
        { role: 'assistant', content: 'Response 2' },
        { role: 'user', content: 'Message 3' }
      ];

      const result = manager.fitToContext(messages);

      // System message should be preserved
      expect(result.messages[0].role).toBe('system');
    });

    it('should use truncation from start strategy', () => {
      const manager = new ContextManager({
        maxTokens: 100,
        reservedForOutput: 20,
        truncationStrategy: 'start'
      });

      const messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
        { role: 'user', content: 'Third message (most recent)' }
      ];

      const result = manager.fitToContext(messages);

      // Most recent messages should be preserved
      expect(result.messages.some(m => m.content.includes('most recent'))).toBe(true);
    });

    it('should use truncation from end strategy', () => {
      const manager = new ContextManager({
        maxTokens: 100,
        reservedForOutput: 20,
        truncationStrategy: 'end'
      });

      const messages = [
        { role: 'user', content: 'First message (oldest)' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Second response' },
        { role: 'user', content: 'Third message' }
      ];

      const result = manager.fitToContext(messages);

      // First messages should be preserved
      expect(result.messages[0].content).toContain('oldest');
    });

    it('should truncate single long message', () => {
      const manager = new ContextManager({
        maxTokens: 100,
        reservedForOutput: 20
      });

      const longMessage = 'a'.repeat(1000);
      const truncated = manager.truncateSingleMessage(longMessage, 50);

      expect(truncated.length).toBeLessThan(longMessage.length);
      expect(truncated).toContain('[truncated]');
    });
  });

  // ----------------------------------------
  // Token Managed Handler
  // ----------------------------------------
  describe('Token Managed Handler', () => {
    it('should process conversation within limits', async () => {
      const aiService = new MockTokenLimitedAIService({
        maxContextTokens: 4096
      });

      const handler = new TokenManagedAIHandler(aiService);
      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];

      const result = await handler.processConversation(messages);

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(false);
    });

    it('should auto-truncate long conversations', async () => {
      const aiService = new MockTokenLimitedAIService({
        maxContextTokens: 4096
      });

      const handler = new TokenManagedAIHandler(aiService, {
        maxTokens: 200,
        reservedForOutput: 50
      });

      // Create many messages
      const messages = Array(20).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message number ${i} with some content`
      }));

      const result = await handler.processConversation(messages);

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(true);
      expect(result.finalTokens).toBeLessThan(result.originalTokens);
    });

    it('should return friendly message when context exceeds even after truncation', async () => {
      const aiService = new MockTokenLimitedAIService({
        maxContextTokens: 50
      });

      const handler = new TokenManagedAIHandler(aiService, {
        maxTokens: 50,
        reservedForOutput: 10
      });

      // Single message that's too long
      const messages = [
        { role: 'user', content: 'a'.repeat(1000) }
      ];

      const result = await handler.processConversation(messages);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CONTEXT_LENGTH_EXCEEDED');
      expect(result.content).toContain('Bağışlayın');
    });

    it('should estimate tokens correctly', () => {
      const aiService = new MockTokenLimitedAIService();
      const handler = new TokenManagedAIHandler(aiService);

      const text = 'Hello, this is a test message for token estimation.';
      const tokens = handler.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });
  });

  // ----------------------------------------
  // Available Tokens Calculation
  // ----------------------------------------
  describe('Available Tokens Calculation', () => {
    it('should calculate available tokens correctly', () => {
      const manager = new ContextManager({
        maxTokens: 4096,
        reservedForOutput: 1024
      });

      expect(manager.getAvailableTokens()).toBe(3072);
    });

    it('should handle different model limits', () => {
      const gpt35 = new ContextManager({ maxTokens: 4096, reservedForOutput: 1024 });
      const gpt4 = new ContextManager({ maxTokens: 8192, reservedForOutput: 2048 });
      const gpt4Large = new ContextManager({ maxTokens: 128000, reservedForOutput: 4096 });

      expect(gpt35.getAvailableTokens()).toBe(3072);
      expect(gpt4.getAvailableTokens()).toBe(6144);
      expect(gpt4Large.getAvailableTokens()).toBe(123904);
    });
  });

  // ----------------------------------------
  // Usage Tracking
  // ----------------------------------------
  describe('Usage Tracking', () => {
    it('should track token usage in response', async () => {
      const aiService = new MockTokenLimitedAIService({
        maxContextTokens: 4096
      });

      const handler = new TokenManagedAIHandler(aiService);
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await handler.processConversation(messages);

      expect(result.usage).toBeDefined();
      expect(result.usage.prompt_tokens).toBeGreaterThan(0);
      expect(result.usage.completion_tokens).toBeGreaterThan(0);
      expect(result.usage.total_tokens).toBe(
        result.usage.prompt_tokens + result.usage.completion_tokens
      );
    });

    it('should report original vs final tokens when truncated', async () => {
      const aiService = new MockTokenLimitedAIService({
        maxContextTokens: 4096
      });

      const handler = new TokenManagedAIHandler(aiService, {
        maxTokens: 100,
        reservedForOutput: 20
      });

      const messages = Array(10).fill(null).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i} with some content here`
      }));

      const result = await handler.processConversation(messages);

      if (result.truncated) {
        expect(result.originalTokens).toBeGreaterThan(result.finalTokens);
      }
    });
  });

  // ----------------------------------------
  // Edge Cases
  // ----------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty message array', () => {
      const manager = new ContextManager({ maxTokens: 4096 });
      const result = manager.fitToContext([]);

      expect(result.messages).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it('should handle single message', () => {
      const manager = new ContextManager({ maxTokens: 4096 });
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = manager.fitToContext(messages);

      expect(result.messages).toEqual(messages);
      expect(result.truncated).toBe(false);
    });

    it('should handle messages with special characters', () => {
      const counter = new TokenCounter();
      const text = '🚀 Hello! こんにちは 你好 Привет';
      const tokens = counter.countTokens(text);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle very long single message by marking as needing truncation', () => {
      const manager = new ContextManager({
        maxTokens: 100,
        reservedForOutput: 20
      });

      const messages = [
        { role: 'user', content: 'x'.repeat(10000) }
      ];

      const result = manager.fitToContext(messages);

      // Single messages cannot be removed, but we mark that truncation was needed
      // The handler would need to use truncateSingleMessage for individual message truncation
      expect(result.truncated).toBe(true);
      // For single messages, the truncation strategies don't reduce token count
      // as they work on message arrays, not individual message content
    });

    it('should handle messages with name field', () => {
      const counter = new TokenCounter();
      const messages = [
        { role: 'user', name: 'John', content: 'Hello' }
      ];

      const tokens = counter.countMessageTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------
  // Provider-Specific Limits
  // ----------------------------------------
  describe('Provider-Specific Limits', () => {
    it('should handle OpenAI GPT-3.5 limits (4K)', async () => {
      const aiService = new MockTokenLimitedAIService({
        provider: 'openai',
        maxContextTokens: 4096,
        maxOutputTokens: 1024
      });

      const handler = new TokenManagedAIHandler(aiService, {
        maxTokens: 4096,
        reservedForOutput: 1024
      });

      expect(handler.contextManager.getAvailableTokens()).toBe(3072);
    });

    it('should handle OpenAI GPT-4 limits (8K)', async () => {
      const aiService = new MockTokenLimitedAIService({
        provider: 'openai',
        maxContextTokens: 8192,
        maxOutputTokens: 2048
      });

      const handler = new TokenManagedAIHandler(aiService, {
        maxTokens: 8192,
        reservedForOutput: 2048
      });

      expect(handler.contextManager.getAvailableTokens()).toBe(6144);
    });

    it('should handle Claude limits (100K)', async () => {
      const aiService = new MockTokenLimitedAIService({
        provider: 'claude',
        maxContextTokens: 100000,
        maxOutputTokens: 4096
      });

      const handler = new TokenManagedAIHandler(aiService, {
        maxTokens: 100000,
        reservedForOutput: 4096
      });

      expect(handler.contextManager.getAvailableTokens()).toBe(95904);
    });
  });
});
