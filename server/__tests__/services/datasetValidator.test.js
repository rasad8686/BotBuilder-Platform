/**
 * Dataset Validator Service Tests
 * Tests for server/services/datasetValidator.js
 */

jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
  readFile: jest.fn()
}));

jest.mock('readline', () => ({
  createInterface: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const fs = require('fs');
const readline = require('readline');
const {
  validateTrainingFormat,
  countTokens,
  estimateCost,
  parseCSVLine
} = require('../../services/datasetValidator');

describe('Dataset Validator Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTrainingFormat', () => {
    it('should validate correct training format', () => {
      const data = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate format with system message', () => {
      const data = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(true);
    });

    it('should reject missing messages array', () => {
      const data = {};

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing or invalid "messages" array');
    });

    it('should reject invalid messages array', () => {
      const data = { messages: 'not an array' };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
    });

    it('should reject less than 2 messages', () => {
      const data = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2 messages');
    });

    it('should reject message without role', () => {
      const data = {
        messages: [
          { content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing "role" field');
    });

    it('should reject invalid role', () => {
      const data = {
        messages: [
          { role: 'invalid', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid role');
    });

    it('should reject message without content', () => {
      const data = {
        messages: [
          { role: 'user' },
          { role: 'assistant', content: 'Hi' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing "content" field');
    });

    it('should allow empty content string', () => {
      const data = {
        messages: [
          { role: 'user', content: '' },
          { role: 'assistant', content: 'Hi' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(true);
    });

    it('should reject missing user message', () => {
      const data = {
        messages: [
          { role: 'system', content: 'System' },
          { role: 'assistant', content: 'Hi' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least one "user" message');
    });

    it('should reject missing assistant message', () => {
      const data = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'user', content: 'Hello again' }
        ]
      };

      const result = validateTrainingFormat(data);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least one "assistant" message');
    });
  });

  describe('countTokens', () => {
    it('should count tokens based on character length', () => {
      const text = 'Hello world'; // 11 characters, ~3 tokens

      const result = countTokens(text);

      expect(result).toBe(3); // Math.ceil(11/4)
    });

    it('should return 0 for empty text', () => {
      expect(countTokens('')).toBe(0);
    });

    it('should return 0 for null text', () => {
      expect(countTokens(null)).toBe(0);
    });

    it('should return 0 for undefined text', () => {
      expect(countTokens(undefined)).toBe(0);
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(1000);

      const result = countTokens(text);

      expect(result).toBe(250); // 1000/4
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost for gpt-3.5-turbo', () => {
      const result = estimateCost(10000, 'gpt-3.5-turbo');

      // 10000 tokens * 3 epochs = 30000 tokens
      // 30000 / 1000 * 0.008 = $0.24
      expect(result.cost).toBe(0.24);
      expect(result.formatted).toBe('$0.24');
      expect(result.breakdown.epochs).toBe(3);
    });

    it('should estimate cost for gpt-4', () => {
      const result = estimateCost(10000, 'gpt-4');

      // 10000 tokens * 3 epochs = 30000 tokens
      // 30000 / 1000 * 0.03 = $0.90
      expect(result.cost).toBe(0.9);
    });

    it('should use default model if unknown', () => {
      const result = estimateCost(10000, 'unknown-model');

      // Uses gpt-3.5-turbo rate
      expect(result.cost).toBe(0.24);
    });

    it('should handle zero tokens', () => {
      const result = estimateCost(0, 'gpt-3.5-turbo');

      expect(result.cost).toBe(0);
    });

    it('should include breakdown details', () => {
      const result = estimateCost(5000, 'gpt-3.5-turbo');

      expect(result.breakdown).toEqual({
        tokens: 5000,
        epochs: 3,
        totalTokens: 15000,
        costPer1K: 0.008
      });
    });
  });

  describe('parseCSVLine', () => {
    it('should parse simple CSV line', () => {
      const line = 'Hello,World,Test';

      const result = parseCSVLine(line);

      expect(result).toEqual(['Hello', 'World', 'Test']);
    });

    it('should handle quoted fields', () => {
      const line = '"Hello, World","Test"';

      const result = parseCSVLine(line);

      expect(result).toEqual(['Hello, World', 'Test']);
    });

    it('should handle escaped quotes', () => {
      const line = '"He said ""Hello""",World';

      const result = parseCSVLine(line);

      expect(result).toEqual(['He said "Hello"', 'World']);
    });

    it('should handle empty fields', () => {
      const line = 'Hello,,World';

      const result = parseCSVLine(line);

      expect(result).toEqual(['Hello', '', 'World']);
    });

    it('should handle single field', () => {
      const line = 'Hello';

      const result = parseCSVLine(line);

      expect(result).toEqual(['Hello']);
    });

    it('should handle empty line', () => {
      const line = '';

      const result = parseCSVLine(line);

      expect(result).toEqual(['']);
    });
  });
});
