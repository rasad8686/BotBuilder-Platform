/**
 * AI Services Index Tests
 * Tests for server/services/ai/index.js
 */

describe('AI Services Index', () => {
  let aiServices;

  beforeEach(() => {
    jest.resetModules();
  });

  it('should export AIProviderFactory', () => {
    aiServices = require('../../../services/ai/index');
    expect(aiServices.AIProviderFactory).toBeDefined();
  });

  it('should export OpenAIService', () => {
    aiServices = require('../../../services/ai/index');
    expect(aiServices.OpenAIService).toBeDefined();
  });

  it('should export ClaudeService', () => {
    aiServices = require('../../../services/ai/index');
    expect(aiServices.ClaudeService).toBeDefined();
  });

  it('should export AIMessageHandler', () => {
    aiServices = require('../../../services/ai/index');
    expect(aiServices.AIMessageHandler).toBeDefined();
  });

  it('should export AICostCalculator', () => {
    aiServices = require('../../../services/ai/index');
    expect(aiServices.AICostCalculator).toBeDefined();
  });

  it('should export EncryptionHelper', () => {
    aiServices = require('../../../services/ai/index');
    expect(aiServices.EncryptionHelper).toBeDefined();
  });

  it('should export all 6 services', () => {
    aiServices = require('../../../services/ai/index');
    const keys = Object.keys(aiServices);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('AIProviderFactory');
    expect(keys).toContain('OpenAIService');
    expect(keys).toContain('ClaudeService');
    expect(keys).toContain('AIMessageHandler');
    expect(keys).toContain('AICostCalculator');
    expect(keys).toContain('EncryptionHelper');
  });
});
