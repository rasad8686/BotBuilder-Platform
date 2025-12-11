/**
 * AI Provider Factory Tests
 * Tests for server/services/ai/aiProviderFactory.js
 */

jest.mock('../../../services/ai/openaiService', () => {
  return jest.fn().mockImplementation((apiKey, model) => ({
    apiKey,
    model,
    chat: jest.fn(),
    testConnection: jest.fn()
  }));
});

jest.mock('../../../services/ai/claudeService', () => {
  return jest.fn().mockImplementation((apiKey, model) => ({
    apiKey,
    model,
    chat: jest.fn(),
    testConnection: jest.fn()
  }));
});

const AIProviderFactory = require('../../../services/ai/aiProviderFactory');

describe('AIProviderFactory', () => {
  describe('getProvider', () => {
    it('should return OpenAI service for openai provider', () => {
      const provider = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'sk-test-key',
        model: 'gpt-4o'
      });

      expect(provider).toBeDefined();
      expect(provider.apiKey).toBe('sk-test-key');
      expect(provider.model).toBe('gpt-4o');
    });

    it('should return Claude service for claude provider', () => {
      const provider = AIProviderFactory.getProvider({
        provider: 'claude',
        apiKey: 'sk-ant-test-key',
        model: 'claude-sonnet-4-5'
      });

      expect(provider).toBeDefined();
      expect(provider.apiKey).toBe('sk-ant-test-key');
    });

    it('should handle case-insensitive provider names', () => {
      const provider = AIProviderFactory.getProvider({
        provider: 'OPENAI',
        apiKey: 'sk-test-key',
        model: 'gpt-4o'
      });

      expect(provider).toBeDefined();
    });

    it('should throw for missing provider', () => {
      expect(() => AIProviderFactory.getProvider({
        apiKey: 'sk-test-key',
        model: 'gpt-4o'
      })).toThrow('AI provider is required');
    });

    it('should throw for missing apiKey', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'openai',
        model: 'gpt-4o'
      })).toThrow('API key is required');
    });

    it('should throw for missing model', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'sk-test-key'
      })).toThrow('Model is required');
    });

    it('should throw for unsupported provider', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'unsupported',
        apiKey: 'test-key',
        model: 'test-model'
      })).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('getSupportedProviders', () => {
    it('should return list of supported providers', () => {
      const providers = AIProviderFactory.getSupportedProviders();

      expect(providers).toContain('openai');
      expect(providers).toContain('claude');
      expect(providers.length).toBe(2);
    });
  });

  describe('getModelsForProvider', () => {
    it('should return OpenAI models', () => {
      const models = AIProviderFactory.getModelsForProvider('openai');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('description');
      expect(models[0]).toHaveProperty('pricing');
    });

    it('should return Claude models', () => {
      const models = AIProviderFactory.getModelsForProvider('claude');

      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
    });

    it('should handle case-insensitive provider names', () => {
      const models = AIProviderFactory.getModelsForProvider('OPENAI');
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown provider', () => {
      const models = AIProviderFactory.getModelsForProvider('unknown');
      expect(models).toEqual([]);
    });
  });

  describe('getModelConfig', () => {
    it('should return model config for valid model', () => {
      const config = AIProviderFactory.getModelConfig('openai', 'gpt-4o');

      expect(config).not.toBeNull();
      expect(config.id).toBe('gpt-4o');
      expect(config.name).toBe('GPT-4o');
    });

    it('should return null for invalid model', () => {
      const config = AIProviderFactory.getModelConfig('openai', 'invalid-model');
      expect(config).toBeNull();
    });

    it('should return null for invalid provider', () => {
      const config = AIProviderFactory.getModelConfig('invalid', 'gpt-4o');
      expect(config).toBeNull();
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 1000,
        context_window: 10
      });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject missing provider', () => {
      const result = AIProviderFactory.validateConfig({
        model: 'gpt-4o'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider is required');
    });

    it('should reject invalid provider', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'invalid',
        model: 'gpt-4o'
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid provider');
    });

    it('should reject missing model', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Model is required');
    });

    it('should reject invalid model for provider', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'invalid-model'
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid model');
    });

    it('should reject invalid temperature (too low)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: -0.5
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Temperature');
    });

    it('should reject invalid temperature (too high)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 2.5
      });

      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric temperature', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 'invalid'
      });

      expect(result.valid).toBe(false);
    });

    it('should reject invalid max_tokens (too low)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 0
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('max_tokens');
    });

    it('should reject invalid max_tokens (too high)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 200000
      });

      expect(result.valid).toBe(false);
    });

    it('should reject invalid context_window (too low)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        context_window: -1
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('context_window');
    });

    it('should reject invalid context_window (too high)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        context_window: 150
      });

      expect(result.valid).toBe(false);
    });

    it('should collect multiple errors', () => {
      const result = AIProviderFactory.validateConfig({
        temperature: -1,
        max_tokens: 0,
        context_window: -1
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
