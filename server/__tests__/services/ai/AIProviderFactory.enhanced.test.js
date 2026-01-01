/**
 * Enhanced AI Provider Factory Tests
 * Comprehensive tests for provider creation, switching, and validation
 */

jest.mock('../../../services/ai/openaiService', () => {
  return jest.fn().mockImplementation((apiKey, model) => ({
    apiKey,
    model,
    provider: 'openai',
    chat: jest.fn(),
    chatStream: jest.fn(),
    testConnection: jest.fn()
  }));
});

jest.mock('../../../services/ai/claudeService', () => {
  return jest.fn().mockImplementation((apiKey, model) => ({
    apiKey,
    model,
    provider: 'claude',
    chat: jest.fn(),
    chatStream: jest.fn(),
    testConnection: jest.fn()
  }));
});

const AIProviderFactory = require('../../../services/ai/aiProviderFactory');
const OpenAIService = require('../../../services/ai/openaiService');
const ClaudeService = require('../../../services/ai/claudeService');

describe('AIProviderFactory - Enhanced Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider Creation and Instantiation', () => {
    it('should create OpenAI provider with correct configuration', () => {
      const config = {
        provider: 'openai',
        apiKey: 'sk-test-openai-key-123',
        model: 'gpt-4o'
      };

      const provider = AIProviderFactory.getProvider(config);

      expect(OpenAIService).toHaveBeenCalledWith('sk-test-openai-key-123', 'gpt-4o');
      expect(provider.apiKey).toBe('sk-test-openai-key-123');
      expect(provider.model).toBe('gpt-4o');
    });

    it('should create Claude provider with correct configuration', () => {
      const config = {
        provider: 'claude',
        apiKey: 'sk-ant-api-key-123',
        model: 'claude-sonnet-4-5'
      };

      const provider = AIProviderFactory.getProvider(config);

      expect(ClaudeService).toHaveBeenCalledWith('sk-ant-api-key-123', 'claude-sonnet-4-5');
      expect(provider.apiKey).toBe('sk-ant-api-key-123');
    });

    it('should handle provider names with mixed case', () => {
      const providers = ['OpenAI', 'OPENAI', 'openai', 'OpEnAi'];

      providers.forEach(providerName => {
        const provider = AIProviderFactory.getProvider({
          provider: providerName,
          apiKey: 'test-key',
          model: 'gpt-4o'
        });
        expect(provider).toBeDefined();
      });
    });

    it('should handle whitespace in provider names', () => {
      const provider = AIProviderFactory.getProvider({
        provider: '  openai  ',
        apiKey: 'test-key',
        model: 'gpt-4o'
      });
      expect(provider).toBeDefined();
    });

    it('should create multiple provider instances independently', () => {
      const openai1 = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'key1',
        model: 'gpt-4o'
      });

      const claude1 = AIProviderFactory.getProvider({
        provider: 'claude',
        apiKey: 'key2',
        model: 'claude-sonnet-4-5'
      });

      const openai2 = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'key3',
        model: 'gpt-4o-mini'
      });

      expect(OpenAIService).toHaveBeenCalledTimes(2);
      expect(ClaudeService).toHaveBeenCalledTimes(1);
      expect(openai1).not.toBe(openai2);
    });
  });

  describe('Provider Validation Errors', () => {
    it('should throw detailed error for null provider', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: null,
        apiKey: 'key',
        model: 'model'
      })).toThrow('AI provider is required');
    });

    it('should throw detailed error for undefined provider', () => {
      expect(() => AIProviderFactory.getProvider({
        apiKey: 'key',
        model: 'model'
      })).toThrow('AI provider is required');
    });

    it('should throw detailed error for empty string provider', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: '',
        apiKey: 'key',
        model: 'model'
      })).toThrow('AI provider is required');
    });

    it('should throw for null apiKey', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: null,
        model: 'gpt-4o'
      })).toThrow('API key is required');
    });

    it('should throw for empty apiKey', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o'
      })).toThrow('API key is required');
    });

    it('should throw for null model', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'key',
        model: null
      })).toThrow('Model is required');
    });

    it('should throw for empty model', () => {
      expect(() => AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'key',
        model: ''
      })).toThrow('Model is required');
    });

    it('should throw for unsupported providers', () => {
      const unsupportedProviders = ['gemini', 'cohere', 'llama', 'mistral', 'gpt'];

      unsupportedProviders.forEach(provider => {
        expect(() => AIProviderFactory.getProvider({
          provider,
          apiKey: 'key',
          model: 'model'
        })).toThrow(/Unsupported AI provider/);
      });
    });

    it('should include provider name in error message for unsupported provider', () => {
      try {
        AIProviderFactory.getProvider({
          provider: 'gemini',
          apiKey: 'key',
          model: 'model'
        });
      } catch (error) {
        expect(error.message).toContain('gemini');
      }
    });
  });

  describe('Supported Providers List', () => {
    it('should return exactly 2 supported providers', () => {
      const providers = AIProviderFactory.getSupportedProviders();
      expect(providers).toHaveLength(2);
    });

    it('should include openai in supported providers', () => {
      const providers = AIProviderFactory.getSupportedProviders();
      expect(providers).toContain('openai');
    });

    it('should include claude in supported providers', () => {
      const providers = AIProviderFactory.getSupportedProviders();
      expect(providers).toContain('claude');
    });

    it('should return array of strings', () => {
      const providers = AIProviderFactory.getSupportedProviders();
      providers.forEach(provider => {
        expect(typeof provider).toBe('string');
      });
    });

    it('should return new array instance each time', () => {
      const providers1 = AIProviderFactory.getSupportedProviders();
      const providers2 = AIProviderFactory.getSupportedProviders();
      expect(providers1).not.toBe(providers2);
    });
  });

  describe('Model Information and Metadata', () => {
    it('should return all OpenAI models with complete metadata', () => {
      const models = AIProviderFactory.getModelsForProvider('openai');

      expect(models.length).toBeGreaterThan(0);
      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('description');
        expect(model).toHaveProperty('contextWindow');
        expect(model).toHaveProperty('maxTokens');
        expect(model).toHaveProperty('pricing');
        expect(model.pricing).toHaveProperty('input');
        expect(model.pricing).toHaveProperty('output');
      });
    });

    it('should return all Claude models with complete metadata', () => {
      const models = AIProviderFactory.getModelsForProvider('claude');

      expect(models.length).toBeGreaterThan(0);
      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('description');
        expect(model).toHaveProperty('contextWindow');
        expect(model).toHaveProperty('maxTokens');
        expect(model).toHaveProperty('pricing');
      });
    });

    it('should include specific OpenAI models', () => {
      const models = AIProviderFactory.getModelsForProvider('openai');
      const modelIds = models.map(m => m.id);

      expect(modelIds).toContain('gpt-4o');
      expect(modelIds).toContain('gpt-4o-mini');
      expect(modelIds).toContain('gpt-4-turbo');
    });

    it('should include specific Claude models', () => {
      const models = AIProviderFactory.getModelsForProvider('claude');
      const modelIds = models.map(m => m.id);

      expect(modelIds).toContain('claude-sonnet-4-5');
      expect(modelIds).toContain('claude-haiku-4-5');
    });

    it('should have consistent pricing structure', () => {
      const providers = ['openai', 'claude'];

      providers.forEach(provider => {
        const models = AIProviderFactory.getModelsForProvider(provider);
        models.forEach(model => {
          expect(typeof model.pricing.input).toBe('number');
          expect(typeof model.pricing.output).toBe('number');
          expect(model.pricing.input).toBeGreaterThan(0);
          expect(model.pricing.output).toBeGreaterThan(0);
        });
      });
    });

    it('should handle case-insensitive provider lookup for models', () => {
      const modelsLower = AIProviderFactory.getModelsForProvider('openai');
      const modelsUpper = AIProviderFactory.getModelsForProvider('OPENAI');
      const modelsMixed = AIProviderFactory.getModelsForProvider('OpEnAi');

      expect(modelsLower.length).toBe(modelsUpper.length);
      expect(modelsLower.length).toBe(modelsMixed.length);
    });

    it('should return empty array for unsupported provider', () => {
      const models = AIProviderFactory.getModelsForProvider('gemini');
      expect(models).toEqual([]);
      expect(Array.isArray(models)).toBe(true);
    });

    it('should return empty array for null provider', () => {
      const models = AIProviderFactory.getModelsForProvider(null);
      expect(models).toEqual([]);
    });
  });

  describe('Model Configuration Lookup', () => {
    it('should find gpt-4o configuration', () => {
      const config = AIProviderFactory.getModelConfig('openai', 'gpt-4o');

      expect(config).not.toBeNull();
      expect(config.id).toBe('gpt-4o');
      expect(config.name).toBe('GPT-4o');
      expect(config.contextWindow).toBe(128000);
    });

    it('should find claude-sonnet-4-5 configuration', () => {
      const config = AIProviderFactory.getModelConfig('claude', 'claude-sonnet-4-5');

      expect(config).not.toBeNull();
      expect(config.id).toBe('claude-sonnet-4-5');
      expect(config.contextWindow).toBe(200000);
    });

    it('should return null for non-existent model', () => {
      const config = AIProviderFactory.getModelConfig('openai', 'gpt-99');
      expect(config).toBeNull();
    });

    it('should return null for wrong provider-model combination', () => {
      const config = AIProviderFactory.getModelConfig('openai', 'claude-sonnet-4-5');
      expect(config).toBeNull();
    });

    it('should return null for invalid provider', () => {
      const config = AIProviderFactory.getModelConfig('invalid-provider', 'gpt-4o');
      expect(config).toBeNull();
    });

    it('should handle case-sensitive model IDs', () => {
      const config1 = AIProviderFactory.getModelConfig('openai', 'gpt-4o');
      const config2 = AIProviderFactory.getModelConfig('openai', 'GPT-4O');

      expect(config1).not.toBeNull();
      expect(config2).toBeNull(); // Model IDs are case-sensitive
    });
  });

  describe('Configuration Validation', () => {
    it('should validate complete valid configuration', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        max_tokens: 1000,
        context_window: 50
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate minimal valid configuration', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'claude',
        model: 'claude-sonnet-4-5'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept temperature at lower boundary (0)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0
      });

      expect(result.valid).toBe(true);
    });

    it('should accept temperature at upper boundary (2.0)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 2.0
      });

      expect(result.valid).toBe(true);
    });

    it('should reject temperature below 0', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: -0.1
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Temperature'))).toBe(true);
    });

    it('should reject temperature above 2.0', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 2.1
      });

      expect(result.valid).toBe(false);
    });

    it('should accept string temperature that can be parsed', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: '0.7'
      });

      expect(result.valid).toBe(true);
    });

    it('should reject non-numeric temperature', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 'hot'
      });

      expect(result.valid).toBe(false);
    });

    it('should accept max_tokens at minimum (1)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 1
      });

      expect(result.valid).toBe(true);
    });

    it('should accept max_tokens at maximum (100000)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 100000
      });

      expect(result.valid).toBe(true);
    });

    it('should reject max_tokens of 0', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 0
      });

      expect(result.valid).toBe(false);
    });

    it('should reject max_tokens above 100000', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: 100001
      });

      expect(result.valid).toBe(false);
    });

    it('should accept string max_tokens that can be parsed', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        max_tokens: '1000'
      });

      expect(result.valid).toBe(true);
    });

    it('should accept context_window at minimum (0)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        context_window: 0
      });

      expect(result.valid).toBe(true);
    });

    it('should accept context_window at maximum (100)', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        context_window: 100
      });

      expect(result.valid).toBe(true);
    });

    it('should reject negative context_window', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        context_window: -1
      });

      expect(result.valid).toBe(false);
    });

    it('should reject context_window above 100', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai',
        model: 'gpt-4o',
        context_window: 101
      });

      expect(result.valid).toBe(false);
    });

    it('should collect multiple validation errors', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'invalid',
        model: 'invalid',
        temperature: 3,
        max_tokens: -100,
        context_window: 200
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });

    it('should handle missing provider gracefully', () => {
      const result = AIProviderFactory.validateConfig({
        model: 'gpt-4o'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider is required');
    });

    it('should handle missing model gracefully', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'openai'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Model is required');
    });

    it('should validate provider before model', () => {
      const result = AIProviderFactory.validateConfig({
        provider: 'invalid-provider',
        model: 'gpt-4o'
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid provider');
    });
  });

  describe('Provider Switching Scenarios', () => {
    it('should switch from OpenAI to Claude', () => {
      const openaiProvider = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'openai-key',
        model: 'gpt-4o'
      });

      const claudeProvider = AIProviderFactory.getProvider({
        provider: 'claude',
        apiKey: 'claude-key',
        model: 'claude-sonnet-4-5'
      });

      expect(openaiProvider.provider).toBe('openai');
      expect(claudeProvider.provider).toBe('claude');
    });

    it('should allow switching models within same provider', () => {
      const gpt4o = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'key',
        model: 'gpt-4o'
      });

      const gpt4oMini = AIProviderFactory.getProvider({
        provider: 'openai',
        apiKey: 'key',
        model: 'gpt-4o-mini'
      });

      expect(gpt4o.model).toBe('gpt-4o');
      expect(gpt4oMini.model).toBe('gpt-4o-mini');
    });
  });
});
