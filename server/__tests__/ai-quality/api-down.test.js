/**
 * AI API Down Tests
 * Tests bot behavior when AI providers are completely unavailable
 * Ensures graceful degradation and proper error handling
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
 * Simulates various API failure scenarios
 */
class MockFailingAIService {
  constructor(options = {}) {
    this.provider = options.provider || 'openai';
    this.failureMode = options.failureMode || 'none';
    this.errorCode = options.errorCode || 500;
    this.errorMessage = options.errorMessage || 'Internal Server Error';
  }

  async chat(messages) {
    switch (this.failureMode) {
      case 'connection_refused':
        throw this.createConnectionError();

      case 'dns_failure':
        throw this.createDNSError();

      case 'ssl_error':
        throw this.createSSLError();

      case 'server_error':
        throw this.createServerError(500, 'Internal Server Error');

      case 'bad_gateway':
        throw this.createServerError(502, 'Bad Gateway');

      case 'service_unavailable':
        throw this.createServerError(503, 'Service Temporarily Unavailable');

      case 'gateway_timeout':
        throw this.createServerError(504, 'Gateway Timeout');

      case 'network_error':
        throw this.createNetworkError();

      case 'success':
      default:
        return {
          content: 'AI response',
          usage: { prompt_tokens: 50, completion_tokens: 25 }
        };
    }
  }

  createConnectionError() {
    const error = new Error('connect ECONNREFUSED api.openai.com:443');
    error.code = 'ECONNREFUSED';
    error.syscall = 'connect';
    error.address = 'api.openai.com';
    error.port = 443;
    return error;
  }

  createDNSError() {
    const error = new Error('getaddrinfo ENOTFOUND api.openai.com');
    error.code = 'ENOTFOUND';
    error.syscall = 'getaddrinfo';
    error.hostname = 'api.openai.com';
    return error;
  }

  createSSLError() {
    const error = new Error('SSL certificate problem: unable to get local issuer certificate');
    error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    return error;
  }

  createServerError(statusCode, message) {
    const error = new Error(message);
    error.status = statusCode;
    error.statusCode = statusCode;
    error.response = {
      status: statusCode,
      data: { error: { message, type: 'server_error' } }
    };
    return error;
  }

  createNetworkError() {
    const error = new Error('Network Error');
    error.code = 'ENETUNREACH';
    error.isNetworkError = true;
    return error;
  }
}

/**
 * AI Handler with graceful degradation
 */
class ResilientAIHandler {
  constructor(aiService, options = {}) {
    this.aiService = aiService;
    this.fallbackMessage = options.fallbackMessage ||
      'Bağışlayın, AI xidməti hazırda əlçatmazdır. Zəhmət olmasa daha sonra yenidən cəhd edin.';
    this.healthStatus = 'healthy';
    this.lastError = null;
  }

  async processMessage(userMessage) {
    try {
      const response = await this.aiService.chat([
        { role: 'user', content: userMessage }
      ]);

      this.healthStatus = 'healthy';
      this.lastError = null;

      return {
        success: true,
        content: response.content,
        provider: this.aiService.provider
      };
    } catch (error) {
      this.healthStatus = 'unhealthy';
      this.lastError = error;

      return {
        success: false,
        content: this.fallbackMessage,
        error: this.categorizeError(error),
        errorCode: error.code || error.statusCode || 'UNKNOWN',
        isRecoverable: this.isRecoverable(error),
        retryAfter: this.getRetryDelay(error)
      };
    }
  }

  categorizeError(error) {
    if (error.code === 'ECONNREFUSED') return 'API_UNREACHABLE';
    if (error.code === 'ENOTFOUND') return 'DNS_FAILURE';
    if (error.code === 'ENETUNREACH') return 'NETWORK_ERROR';
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return 'SSL_ERROR';
    if (error.statusCode === 500) return 'SERVER_ERROR';
    if (error.statusCode === 502) return 'BAD_GATEWAY';
    if (error.statusCode === 503) return 'SERVICE_UNAVAILABLE';
    if (error.statusCode === 504) return 'GATEWAY_TIMEOUT';
    return 'UNKNOWN_ERROR';
  }

  isRecoverable(error) {
    // These errors might resolve themselves
    const recoverableCodes = ['ECONNREFUSED', 'ENETUNREACH', 502, 503, 504];
    return recoverableCodes.includes(error.code) ||
           recoverableCodes.includes(error.statusCode);
  }

  getRetryDelay(error) {
    if (error.statusCode === 503) return 60000; // 1 minute
    if (error.statusCode === 502 || error.statusCode === 504) return 30000; // 30 seconds
    if (error.code === 'ECONNREFUSED') return 10000; // 10 seconds
    return 5000; // Default 5 seconds
  }

  getHealthStatus() {
    return {
      status: this.healthStatus,
      lastError: this.lastError ? {
        code: this.lastError.code || this.lastError.statusCode,
        message: this.lastError.message
      } : null
    };
  }
}

// ========================================
// TESTS
// ========================================

describe('AI API Down Handling', () => {

  // ----------------------------------------
  // OpenAI API Down
  // ----------------------------------------
  describe('OpenAI API Unavailable', () => {
    it('should handle connection refused error', async () => {
      const aiService = new MockFailingAIService({
        provider: 'openai',
        failureMode: 'connection_refused'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API_UNREACHABLE');
      expect(result.errorCode).toBe('ECONNREFUSED');
      expect(result.isRecoverable).toBe(true);
    });

    it('should handle DNS failure', async () => {
      const aiService = new MockFailingAIService({
        provider: 'openai',
        failureMode: 'dns_failure'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DNS_FAILURE');
      expect(result.errorCode).toBe('ENOTFOUND');
    });

    it('should handle 500 Internal Server Error', async () => {
      const aiService = new MockFailingAIService({
        provider: 'openai',
        failureMode: 'server_error'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVER_ERROR');
    });

    it('should handle 502 Bad Gateway', async () => {
      const aiService = new MockFailingAIService({
        provider: 'openai',
        failureMode: 'bad_gateway'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('BAD_GATEWAY');
      expect(result.isRecoverable).toBe(true);
      expect(result.retryAfter).toBe(30000);
    });

    it('should handle 503 Service Unavailable', async () => {
      const aiService = new MockFailingAIService({
        provider: 'openai',
        failureMode: 'service_unavailable'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVICE_UNAVAILABLE');
      expect(result.isRecoverable).toBe(true);
      expect(result.retryAfter).toBe(60000);
    });

    it('should handle 504 Gateway Timeout', async () => {
      const aiService = new MockFailingAIService({
        provider: 'openai',
        failureMode: 'gateway_timeout'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('GATEWAY_TIMEOUT');
    });
  });

  // ----------------------------------------
  // Claude API Down
  // ----------------------------------------
  describe('Claude API Unavailable', () => {
    it('should handle Claude connection refused', async () => {
      const aiService = new MockFailingAIService({
        provider: 'claude',
        failureMode: 'connection_refused'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello Claude');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API_UNREACHABLE');
    });

    it('should handle Claude service unavailable', async () => {
      const aiService = new MockFailingAIService({
        provider: 'claude',
        failureMode: 'service_unavailable'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello Claude');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVICE_UNAVAILABLE');
    });
  });

  // ----------------------------------------
  // Graceful Degradation
  // ----------------------------------------
  describe('Graceful Degradation', () => {
    it('should return user-friendly message when API is down', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'connection_refused'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.content).toContain('Bağışlayın');
      expect(result.content).toContain('əlçatmazdır');
    });

    it('should allow custom fallback message', async () => {
      const customMessage = 'AI is currently offline. Please try later.';
      const aiService = new MockFailingAIService({
        failureMode: 'service_unavailable'
      });

      const handler = new ResilientAIHandler(aiService, {
        fallbackMessage: customMessage
      });
      const result = await handler.processMessage('Hello');

      expect(result.content).toBe(customMessage);
    });

    it('should update health status on failure', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'server_error'
      });

      const handler = new ResilientAIHandler(aiService);

      // Initially healthy
      expect(handler.getHealthStatus().status).toBe('healthy');

      // After failure
      await handler.processMessage('Hello');

      const health = handler.getHealthStatus();
      expect(health.status).toBe('unhealthy');
      expect(health.lastError).not.toBeNull();
    });

    it('should recover health status on success', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'success'
      });

      const handler = new ResilientAIHandler(aiService);
      handler.healthStatus = 'unhealthy'; // Simulate previous failure

      await handler.processMessage('Hello');

      expect(handler.getHealthStatus().status).toBe('healthy');
    });
  });

  // ----------------------------------------
  // Network Issues
  // ----------------------------------------
  describe('Network Issues', () => {
    it('should handle network unreachable', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'network_error'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('NETWORK_ERROR');
    });

    it('should handle SSL certificate errors', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'ssl_error'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(false);
      expect(result.error).toBe('SSL_ERROR');
    });
  });

  // ----------------------------------------
  // Retry Information
  // ----------------------------------------
  describe('Retry Information', () => {
    it('should provide retry delay for recoverable errors', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'connection_refused'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.retryAfter).toBe(10000);
    });

    it('should indicate if error is recoverable', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'service_unavailable'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.isRecoverable).toBe(true);
    });

    it('should indicate non-recoverable errors', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'ssl_error'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.isRecoverable).toBe(false);
    });
  });

  // ----------------------------------------
  // Success Case
  // ----------------------------------------
  describe('Successful Response', () => {
    it('should return success when API is available', async () => {
      const aiService = new MockFailingAIService({
        failureMode: 'success'
      });

      const handler = new ResilientAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.success).toBe(true);
      expect(result.content).toBe('AI response');
    });
  });
});
