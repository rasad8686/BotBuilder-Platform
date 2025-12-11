/**
 * WriterAgent Tests
 * Tests for server/agents/types/WriterAgent.js
 */

// Mock the base Agent class dependencies
jest.mock('openai', () => jest.fn());
jest.mock('@anthropic-ai/sdk', () => jest.fn());
jest.mock('../../../models/AgentTool', () => ({ findEnabledByAgentId: jest.fn() }));
jest.mock('../../../models/Tool', () => ({ findById: jest.fn() }));
jest.mock('../../../tools/types', () => ({ createTool: jest.fn() }));
jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const WriterAgent = require('../../../agents/types/WriterAgent');

describe('WriterAgent', () => {
  let writerAgent;

  beforeEach(() => {
    writerAgent = new WriterAgent({
      id: 1,
      name: 'ContentWriter'
    });
  });

  describe('constructor', () => {
    it('should set default role to writer', () => {
      expect(writerAgent.role).toBe('writer');
    });

    it('should use custom role if provided', () => {
      const customAgent = new WriterAgent({
        id: 2,
        name: 'Custom',
        role: 'content-creator'
      });

      expect(customAgent.role).toBe('content-creator');
    });

    it('should set default system prompt', () => {
      expect(writerAgent.systemPrompt).toContain('professional writing agent');
    });

    it('should use custom system prompt if provided', () => {
      const customAgent = new WriterAgent({
        id: 2,
        systemPrompt: 'Custom prompt'
      });

      expect(customAgent.systemPrompt).toBe('Custom prompt');
    });

    it('should initialize styleGuide as null', () => {
      expect(writerAgent.styleGuide).toBeNull();
    });

    it('should initialize default tone', () => {
      expect(writerAgent.tone).toBe('professional');
    });

    it('should accept custom styleGuide', () => {
      const agent = new WriterAgent({
        id: 1,
        styleGuide: { brand: 'Tech' }
      });

      expect(agent.styleGuide).toEqual({ brand: 'Tech' });
    });

    it('should accept custom tone', () => {
      const agent = new WriterAgent({
        id: 1,
        tone: 'casual'
      });

      expect(agent.tone).toBe('casual');
    });
  });

  describe('setStyleGuide', () => {
    it('should set style guide', () => {
      writerAgent.setStyleGuide({ brandVoice: 'friendly' });

      expect(writerAgent.styleGuide).toEqual({ brandVoice: 'friendly' });
    });
  });

  describe('setTone', () => {
    it('should set tone', () => {
      writerAgent.setTone('formal');

      expect(writerAgent.tone).toBe('formal');
    });
  });

  describe('buildPrompt', () => {
    it('should include tone in prompt', () => {
      writerAgent.setTone('casual');

      const prompt = writerAgent.buildPrompt('Write something', null);

      const styleMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Default tone: casual')
      );
      expect(styleMessage).toBeDefined();
    });

    it('should include style guide in prompt', () => {
      writerAgent.setStyleGuide({ rule: 'no jargon' });

      const prompt = writerAgent.buildPrompt('Write something', null);

      const styleMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Style guide:')
      );
      expect(styleMessage).toBeDefined();
    });

    it('should include email tools info when available', () => {
      writerAgent.loadedTools = [
        { name: 'send_email', type: 'email', description: 'Send emails' }
      ];

      const prompt = writerAgent.buildPrompt('Write email', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Communication tools available')
      );
      expect(toolsMessage).toBeDefined();
    });

    it('should not include tools info for non-communication tools', () => {
      writerAgent.loadedTools = [
        { name: 'search', type: 'search', description: 'Search web' }
      ];

      const prompt = writerAgent.buildPrompt('Write article', null);

      const toolsMessage = prompt.messages.find(m =>
        m.content && m.content.includes('Communication tools available')
      );
      expect(toolsMessage).toBeUndefined();
    });
  });

  describe('parseContent', () => {
    it('should parse JSON output', () => {
      const output = {
        type: 'json',
        data: {
          contentType: 'article',
          title: 'Test Article',
          content: 'Article body'
        }
      };

      const result = writerAgent.parseContent(output);

      expect(result.valid).toBe(true);
      expect(result.content.contentType).toBe('article');
    });

    it('should parse raw JSON string', () => {
      const output = {
        type: 'text',
        raw: '{"contentType": "email", "content": "Hello"}'
      };

      const result = writerAgent.parseContent(output);

      expect(result.valid).toBe(true);
      expect(result.content.contentType).toBe('email');
    });

    it('should handle non-JSON as text content', () => {
      writerAgent.setTone('friendly');
      const output = {
        type: 'text',
        raw: 'Just a plain text response'
      };

      const result = writerAgent.parseContent(output);

      expect(result.valid).toBe(true);
      expect(result.content.contentType).toBe('text');
      expect(result.content.content).toBe('Just a plain text response');
      expect(result.content.tone).toBe('friendly');
    });
  });
});
