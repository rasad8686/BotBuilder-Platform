/**
 * CloneEngine Service Tests
 */

const CloneEngine = require('../../../services/clone/CloneEngine');

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());

// Mock StyleAnalyzer
jest.mock('../../../services/clone/StyleAnalyzer', () => {
  return jest.fn().mockImplementation(() => ({
    analyzeStyle: jest.fn().mockResolvedValue({
      success: true,
      analysis: {
        formality: { level: 'formal' },
        tone: { dominant: 'positive' },
        avgWordsPerSentence: 12
      }
    })
  }));
});

describe('CloneEngine', () => {
  let engine;
  let mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = require('node-fetch');
    engine = new CloneEngine({
      openaiApiKey: 'test-openai-key',
      anthropicApiKey: 'test-anthropic-key'
    });
  });

  describe('constructor', () => {
    it('should create instance with config', () => {
      expect(engine).toBeDefined();
      expect(engine.openaiApiKey).toBe('test-openai-key');
      expect(engine.anthropicApiKey).toBe('test-anthropic-key');
    });

    it('should use environment variables as fallback', () => {
      process.env.OPENAI_API_KEY = 'env-openai-key';
      process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';

      const engineWithEnv = new CloneEngine();
      expect(engineWithEnv.openaiApiKey).toBe('env-openai-key');
      expect(engineWithEnv.anthropicApiKey).toBe('env-anthropic-key');

      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });
  });

  describe('selectProvider', () => {
    it('should return openai by default', () => {
      expect(engine.selectProvider()).toBe('openai');
      expect(engine.selectProvider('gpt-4')).toBe('openai');
      expect(engine.selectProvider('gpt-3.5-turbo')).toBe('openai');
    });

    it('should return anthropic for claude models', () => {
      expect(engine.selectProvider('claude-3')).toBe('anthropic');
      expect(engine.selectProvider('Claude-3-sonnet')).toBe('anthropic');
      expect(engine.selectProvider('CLAUDE-2')).toBe('anthropic');
    });
  });

  describe('buildSystemPrompt', () => {
    it('should build basic prompt', () => {
      const clone = {};
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('helpful writing assistant');
    });

    it('should include base_system_prompt', () => {
      const clone = { base_system_prompt: 'You are a professional writer.' };
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('professional writer');
    });

    it('should include personality_prompt', () => {
      const clone = { personality_prompt: 'Be friendly and helpful.' };
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('Personality');
      expect(prompt).toContain('Be friendly');
    });

    it('should include writing_style_prompt', () => {
      const clone = { writing_style_prompt: 'Use formal language.' };
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('Writing Style');
      expect(prompt).toContain('formal language');
    });

    it('should include style_profile', () => {
      const clone = {
        style_profile: {
          formality: { level: 'formal' },
          tone: { dominant: 'professional' },
          avgWordsPerSentence: 15
        }
      };
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('Style Profile');
      expect(prompt).toContain('formal');
      expect(prompt).toContain('professional');
      expect(prompt).toContain('15');
    });

    it('should include tone_settings', () => {
      const clone = {
        tone_settings: {
          friendliness: 8,
          formality: 6,
          enthusiasm: 7,
          directness: 5
        }
      };
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('Tone Settings');
      expect(prompt).toContain('Friendliness: 8');
      expect(prompt).toContain('Formality: 6');
    });

    it('should include response_patterns', () => {
      const clone = {
        response_patterns: {
          greetings: ['Hello', 'Hi there'],
          closings: ['Best regards', 'Thank you']
        }
      };
      const prompt = engine.buildSystemPrompt(clone);
      expect(prompt).toContain('Common Phrases');
      expect(prompt).toContain('Hello, Hi there');
      expect(prompt).toContain('Best regards, Thank you');
    });
  });

  describe('generateWithOpenAI', () => {
    it('should return error if no API key', async () => {
      const engineNoKey = new CloneEngine();
      const result = await engineNoKey.generateWithOpenAI('system', 'user', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API key');
    });

    it('should make API call successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Generated response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      });

      const result = await engine.generateWithOpenAI(
        'You are helpful',
        'Write something',
        { ai_model: 'gpt-4', temperature: 0.7, max_tokens: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('Generated response');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(20);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('API Error')
      });

      const result = await engine.generateWithOpenAI('system', 'user', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });

    it('should use clone settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Test' } }],
          usage: {}
        })
      });

      await engine.generateWithOpenAI('system', 'user', {
        ai_model: 'gpt-3.5-turbo',
        temperature: 0.9,
        max_tokens: 500
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.model).toBe('gpt-3.5-turbo');
      expect(callBody.temperature).toBe(0.9);
    });
  });

  describe('generateWithAnthropic', () => {
    it('should return error if no API key', async () => {
      const engineNoKey = new CloneEngine();
      const result = await engineNoKey.generateWithAnthropic('system', 'user', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Anthropic API key');
    });

    it('should make API call successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Claude response' }],
          usage: { input_tokens: 15, output_tokens: 25 }
        })
      });

      const result = await engine.generateWithAnthropic(
        'You are helpful',
        'Write something',
        { ai_model: 'claude-3-sonnet', max_tokens: 1000 }
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('Claude response');
      expect(result.inputTokens).toBe(15);
      expect(result.outputTokens).toBe(25);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Anthropic Error')
      });

      const result = await engine.generateWithAnthropic('system', 'user', {});
      expect(result.success).toBe(false);
    });
  });

  describe('generateResponse', () => {
    it('should use OpenAI for GPT models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'GPT response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 }
        })
      });

      const clone = { ai_model: 'gpt-4' };
      const result = await engine.generateResponse(clone, 'Test prompt');

      expect(result.success).toBe(true);
      expect(result.response).toBe('GPT response');
      expect(result.model).toBe('gpt-4');
    });

    it('should use Anthropic for Claude models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          content: [{ text: 'Claude response' }],
          usage: { input_tokens: 10, output_tokens: 20 }
        })
      });

      const clone = { ai_model: 'claude-3-sonnet' };
      const result = await engine.generateResponse(clone, 'Test prompt');

      expect(result.success).toBe(true);
      expect(result.response).toBe('Claude response');
    });

    it('should return error for unsupported model', async () => {
      engine.selectProvider = jest.fn().mockReturnValue('unknown');
      const result = await engine.generateResponse({ ai_model: 'unknown' }, 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });

    it('should include latency in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Test' } }],
          usage: {}
        })
      });

      const result = await engine.generateResponse({ ai_model: 'gpt-4' }, 'Test');
      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe('number');
    });
  });

  describe('buildEmailPrompt', () => {
    it('should build reply prompt', () => {
      const context = { replyTo: 'Original email content' };
      const prompt = engine.buildEmailPrompt(context);
      expect(prompt).toContain('reply');
      expect(prompt).toContain('Original email content');
    });

    it('should include recipient', () => {
      const context = { recipient: 'John' };
      const prompt = engine.buildEmailPrompt(context);
      expect(prompt).toContain('to John');
    });

    it('should include subject', () => {
      const context = { subject: 'Meeting Tomorrow' };
      const prompt = engine.buildEmailPrompt(context);
      expect(prompt).toContain('Meeting Tomorrow');
    });

    it('should include key points', () => {
      const context = { keyPoints: ['Point 1', 'Point 2', 'Point 3'] };
      const prompt = engine.buildEmailPrompt(context);
      expect(prompt).toContain('Key points');
      expect(prompt).toContain('1. Point 1');
      expect(prompt).toContain('2. Point 2');
    });

    it('should include tone', () => {
      const context = { tone: 'professional' };
      const prompt = engine.buildEmailPrompt(context);
      expect(prompt).toContain('Tone: professional');
    });

    it('should include additional instructions', () => {
      const context = { additionalInstructions: 'Keep it brief' };
      const prompt = engine.buildEmailPrompt(context);
      expect(prompt).toContain('Keep it brief');
    });
  });

  describe('buildMessagePrompt', () => {
    it('should build reply prompt', () => {
      const context = { replyTo: 'Hello there' };
      const prompt = engine.buildMessagePrompt(context);
      expect(prompt).toContain('Reply to');
      expect(prompt).toContain('Hello there');
    });

    it('should include topic', () => {
      const context = { topic: 'Project update' };
      const prompt = engine.buildMessagePrompt(context);
      expect(prompt).toContain('Topic: Project update');
    });

    it('should include intent', () => {
      const context = { intent: 'inform' };
      const prompt = engine.buildMessagePrompt(context);
      expect(prompt).toContain('Intent: inform');
    });

    it('should include max length', () => {
      const context = { maxLength: 280 };
      const prompt = engine.buildMessagePrompt(context);
      expect(prompt).toContain('280 characters');
    });
  });

  describe('buildDocumentPrompt', () => {
    it('should build basic document prompt', () => {
      const context = {};
      const prompt = engine.buildDocumentPrompt(context);
      expect(prompt).toContain('Write a document');
    });

    it('should include document type', () => {
      const context = { documentType: 'report' };
      const prompt = engine.buildDocumentPrompt(context);
      expect(prompt).toContain('Write a report');
    });

    it('should include title', () => {
      const context = { title: 'Annual Review' };
      const prompt = engine.buildDocumentPrompt(context);
      expect(prompt).toContain('Annual Review');
    });

    it('should include outline', () => {
      const context = { outline: ['Introduction', 'Body', 'Conclusion'] };
      const prompt = engine.buildDocumentPrompt(context);
      expect(prompt).toContain('outline');
      expect(prompt).toContain('1. Introduction');
      expect(prompt).toContain('2. Body');
    });

    it('should include target audience', () => {
      const context = { targetAudience: 'executives' };
      const prompt = engine.buildDocumentPrompt(context);
      expect(prompt).toContain('Target audience: executives');
    });

    it('should include length', () => {
      const context = { length: '500 words' };
      const prompt = engine.buildDocumentPrompt(context);
      expect(prompt).toContain('Target length: 500 words');
    });
  });

  describe('generateEmail', () => {
    it('should call generateResponse with email prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Email content' } }],
          usage: {}
        })
      });

      const clone = { ai_model: 'gpt-4' };
      const context = { subject: 'Test', recipient: 'John' };

      const result = await engine.generateEmail(clone, context);
      expect(result.success).toBe(true);
    });
  });

  describe('generateMessage', () => {
    it('should call generateResponse with message prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Message content' } }],
          usage: {}
        })
      });

      const clone = { ai_model: 'gpt-4' };
      const context = { topic: 'Greeting' };

      const result = await engine.generateMessage(clone, context);
      expect(result.success).toBe(true);
    });
  });

  describe('generateDocument', () => {
    it('should call generateResponse with document prompt and higher max tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Document content' } }],
          usage: {}
        })
      });

      const clone = { ai_model: 'gpt-4' };
      const context = { documentType: 'report', title: 'Q4 Review' };

      const result = await engine.generateDocument(clone, context);
      expect(result.success).toBe(true);
    });
  });

  describe('refineText', () => {
    it('should generate refinement prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: 'Refined text' } }],
          usage: {}
        })
      });

      const clone = { ai_model: 'gpt-4' };
      const result = await engine.refineText(clone, 'Original text', 'Make it shorter');

      expect(result.success).toBe(true);
      expect(result.response).toBe('Refined text');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return default similarity without style profile', async () => {
      const clone = {};
      const similarity = await engine.calculateSimilarity(clone, 'Test text');
      expect(similarity).toBe(0.5);
    });

    it('should compare formality levels', async () => {
      const clone = {
        style_profile: {
          formality: { level: 'formal' },
          tone: { dominant: 'positive' }
        }
      };

      const similarity = await engine.calculateSimilarity(clone, 'Test text');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should compare tone', async () => {
      const clone = {
        style_profile: {
          tone: { dominant: 'positive' }
        }
      };

      const similarity = await engine.calculateSimilarity(clone, 'Great wonderful text!');
      expect(similarity).toBeGreaterThanOrEqual(0);
    });

    it('should compare sentence length', async () => {
      const clone = {
        style_profile: {
          avgWordsPerSentence: 12
        }
      };

      const similarity = await engine.calculateSimilarity(clone, 'Test text with similar length.');
      expect(similarity).toBeGreaterThanOrEqual(0);
    });
  });
});
