/**
 * AIPlugin Tests
 * Tests for server/plugins/types/AIPlugin.js
 */

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const AIPlugin = require('../../../plugins/types/AIPlugin');

describe('AIPlugin', () => {
  let plugin;

  beforeEach(() => {
    jest.clearAllMocks();
    plugin = new AIPlugin({
      id: 'test-ai-plugin',
      name: 'Test AI Plugin',
      modelProvider: 'openai',
      modelName: 'gpt-4',
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com',
      maxTokens: 8192,
      temperature: 0.8
    });
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(plugin.modelProvider).toBe('openai');
      expect(plugin.modelName).toBe('gpt-4');
      expect(plugin.apiKey).toBe('test-key');
      expect(plugin.baseUrl).toBe('https://api.openai.com');
      expect(plugin.maxTokens).toBe(8192);
      expect(plugin.temperature).toBe(0.8);
      expect(plugin.client).toBeNull();
    });

    it('should use defaults for missing config', () => {
      const defaultPlugin = new AIPlugin();
      expect(defaultPlugin.modelProvider).toBe('custom');
      expect(defaultPlugin.modelName).toBe('default');
      expect(defaultPlugin.apiKey).toBeNull();
      expect(defaultPlugin.baseUrl).toBeNull();
      expect(defaultPlugin.maxTokens).toBe(4096);
      expect(defaultPlugin.temperature).toBe(0.7);
    });
  });

  describe('getType', () => {
    it('should return ai type', () => {
      expect(plugin.getType()).toBe('ai');
    });
  });

  describe('generateResponse', () => {
    it('should throw error if plugin not enabled', async () => {
      await expect(plugin.generateResponse('Hello')).rejects.toThrow('Plugin is not enabled');
    });

    it('should generate response when enabled', async () => {
      await plugin.install(1);

      plugin.doGenerate = jest.fn().mockResolvedValue({
        content: 'Hello, how can I help?',
        model: 'gpt-4',
        usage: { promptTokens: 10, completionTokens: 20 },
        finishReason: 'stop'
      });

      const result = await plugin.generateResponse('Hello');

      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello, how can I help?');
      expect(result.model).toBe('gpt-4');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should accept string message', async () => {
      await plugin.install(1);
      plugin.doGenerate = jest.fn().mockResolvedValue({ content: 'Response' });

      await plugin.generateResponse('Hello');

      expect(plugin.doGenerate).toHaveBeenCalledWith(expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello' }]
      }));
    });

    it('should accept array of messages', async () => {
      await plugin.install(1);
      plugin.doGenerate = jest.fn().mockResolvedValue({ content: 'Response' });

      await plugin.generateResponse([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' }
      ]);

      expect(plugin.doGenerate).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' }
        ])
      }));
    });

    it('should use custom options', async () => {
      await plugin.install(1);
      plugin.doGenerate = jest.fn().mockResolvedValue({ content: 'Response' });

      await plugin.generateResponse('Hello', {
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.5
      });

      expect(plugin.doGenerate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-3.5-turbo',
        maxTokens: 1000,
        temperature: 0.5
      }));
    });

    it('should handle generation errors', async () => {
      await plugin.install(1);
      plugin.doGenerate = jest.fn().mockRejectedValue(new Error('API error'));

      await expect(plugin.generateResponse('Hello')).rejects.toThrow('API error');
    });
  });

  describe('trainModel', () => {
    it('should throw error if plugin not enabled', async () => {
      await expect(plugin.trainModel([{ input: 'test' }])).rejects.toThrow('Plugin is not enabled');
    });

    it('should throw error if no training data', async () => {
      await plugin.install(1);
      await expect(plugin.trainModel([])).rejects.toThrow('Training data is required');
      await expect(plugin.trainModel(null)).rejects.toThrow('Training data is required');
    });

    it('should train model with data', async () => {
      await plugin.install(1);
      plugin.doTrain = jest.fn().mockResolvedValue({
        jobId: 'job_123',
        status: 'started',
        estimatedTime: 3600
      });

      const result = await plugin.trainModel([
        { input: 'Hello', output: 'Hi there!' }
      ]);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job_123');
      expect(result.status).toBe('started');
    });

    it('should handle training errors', async () => {
      await plugin.install(1);
      plugin.doTrain = jest.fn().mockRejectedValue(new Error('Training failed'));

      await expect(plugin.trainModel([{ input: 'test' }])).rejects.toThrow('Training failed');
    });
  });

  describe('embeddings', () => {
    it('should throw error if plugin not enabled', async () => {
      await expect(plugin.embeddings('test')).rejects.toThrow('Plugin is not enabled');
    });

    it('should generate embeddings for string', async () => {
      await plugin.install(1);
      plugin.doEmbeddings = jest.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        model: 'text-embedding-ada-002',
        dimensions: 3
      });

      const result = await plugin.embeddings('test text');

      expect(result.success).toBe(true);
      expect(result.embeddings).toHaveLength(1);
      expect(result.dimensions).toBe(3);
    });

    it('should generate embeddings for array', async () => {
      await plugin.install(1);
      plugin.doEmbeddings = jest.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2], [0.3, 0.4]],
        dimensions: 2
      });

      const result = await plugin.embeddings(['text1', 'text2']);

      expect(result.embeddings).toHaveLength(2);
    });

    it('should handle embedding errors', async () => {
      await plugin.install(1);
      plugin.doEmbeddings = jest.fn().mockRejectedValue(new Error('Embedding failed'));

      await expect(plugin.embeddings('test')).rejects.toThrow('Embedding failed');
    });
  });

  describe('normalizeMessages', () => {
    it('should convert string to message array', () => {
      const result = plugin.normalizeMessages('Hello');
      expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should normalize message objects', () => {
      const result = plugin.normalizeMessages([
        { role: 'system', content: 'System' },
        { text: 'User text' },
        'String message'
      ]);

      expect(result).toEqual([
        { role: 'system', content: 'System' },
        { role: 'user', content: 'User text' },
        { role: 'user', content: 'String message' }
      ]);
    });

    it('should handle empty content', () => {
      const result = plugin.normalizeMessages([{ role: 'user' }]);
      expect(result[0].content).toBe('');
    });
  });

  describe('formatTrainingData', () => {
    it('should format training data with messages', async () => {
      const data = [{ messages: [{ role: 'user', content: 'Hi' }] }];
      const result = await plugin.formatTrainingData(data);
      expect(result[0].messages).toEqual([{ role: 'user', content: 'Hi' }]);
    });

    it('should format training data with input/output', async () => {
      const data = [{ input: 'Hello', output: 'Hi!' }];
      const result = await plugin.formatTrainingData(data);
      expect(result[0].messages).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' }
      ]);
    });

    it('should format training data with prompt/completion', async () => {
      const data = [{ prompt: 'Question?', completion: 'Answer!' }];
      const result = await plugin.formatTrainingData(data);
      expect(result[0].messages).toEqual([
        { role: 'user', content: 'Question?' },
        { role: 'assistant', content: 'Answer!' }
      ]);
    });
  });

  describe('abstract methods', () => {
    it('doGenerate should throw error', async () => {
      await expect(plugin.doGenerate({})).rejects.toThrow('doGenerate must be implemented');
    });

    it('doTrain should throw error', async () => {
      await expect(plugin.doTrain([], {})).rejects.toThrow('doTrain must be implemented');
    });

    it('doEmbeddings should throw error', async () => {
      await expect(plugin.doEmbeddings([])).rejects.toThrow('doEmbeddings must be implemented');
    });
  });

  describe('getAvailableModels', () => {
    it('should return empty array by default', async () => {
      const models = await plugin.getAvailableModels();
      expect(models).toEqual([]);
    });
  });

  describe('getCapabilities', () => {
    it('should return default capabilities', () => {
      const caps = plugin.getCapabilities();

      expect(caps.chat).toBe(true);
      expect(caps.completion).toBe(false);
      expect(caps.embeddings).toBe(false);
      expect(caps.training).toBe(false);
      expect(caps.streaming).toBe(false);
      expect(caps.functionCalling).toBe(false);
      expect(caps.vision).toBe(false);
      expect(caps.audio).toBe(false);
    });
  });

  describe('getSettingsSchema', () => {
    it('should return settings schema', () => {
      const schema = plugin.getSettingsSchema();

      expect(schema.apiKey).toBeDefined();
      expect(schema.apiKey.type).toBe('password');
      expect(schema.apiKey.required).toBe(true);

      expect(schema.modelName).toBeDefined();
      expect(schema.temperature).toBeDefined();
      expect(schema.maxTokens).toBeDefined();
    });
  });
});

describe('AIPlugin subclass', () => {
  class CustomAIPlugin extends AIPlugin {
    async doGenerate(params) {
      return { content: `Generated: ${params.messages[0].content}` };
    }

    async doTrain(data, options) {
      return { jobId: 'custom_job', status: 'queued' };
    }

    async doEmbeddings(texts, options) {
      return {
        embeddings: texts.map(() => [0.1, 0.2, 0.3]),
        dimensions: 3
      };
    }

    getCapabilities() {
      return {
        ...super.getCapabilities(),
        embeddings: true,
        training: true,
        streaming: true
      };
    }
  }

  it('should work with implemented methods', async () => {
    const custom = new CustomAIPlugin({ name: 'Custom AI' });
    await custom.install(1);

    const response = await custom.generateResponse('Hello');
    expect(response.content).toBe('Generated: Hello');

    const embeddings = await custom.embeddings(['text']);
    expect(embeddings.embeddings[0]).toEqual([0.1, 0.2, 0.3]);

    const training = await custom.trainModel([{ input: 'test', output: 'result' }]);
    expect(training.jobId).toBe('custom_job');
  });

  it('should override capabilities', () => {
    const custom = new CustomAIPlugin({ name: 'Custom AI' });
    const caps = custom.getCapabilities();

    expect(caps.embeddings).toBe(true);
    expect(caps.training).toBe(true);
    expect(caps.streaming).toBe(true);
  });
});
