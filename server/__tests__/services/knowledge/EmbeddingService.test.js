/**
 * EmbeddingService Comprehensive Tests
 * Tests for server/knowledge/EmbeddingService.js
 *
 * Tests cover:
 * - All public methods
 * - Error handling
 * - Edge cases
 * - Different input types
 * - OpenAI API integration
 * - Batch processing
 */

// Set API key before importing to allow lazy initialization
process.env.OPENAI_API_KEY = 'test-api-key-123';

// Mock OpenAI before requiring the module
const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate
    }
  }));
});

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

const log = require('../../../utils/logger');
const embeddingService = require('../../../knowledge/EmbeddingService');

describe('EmbeddingService - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor and initialization', () => {
    it('should initialize with default model', () => {
      expect(embeddingService.getModelName()).toBe('text-embedding-3-small');
    });

    it('should initialize with default dimensions', () => {
      expect(embeddingService.getDimensions()).toBe(1536);
    });

    it('should have model property', () => {
      expect(embeddingService.model).toBe('text-embedding-3-small');
    });

    it('should have dimensions property', () => {
      expect(embeddingService.dimensions).toBe(1536);
    });
  });

  describe('getEmbedding', () => {
    it('should throw error for empty text', async () => {
      await expect(embeddingService.getEmbedding('')).rejects.toThrow('Text cannot be empty');
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(embeddingService.getEmbedding('   ')).rejects.toThrow('Text cannot be empty');
    });

    it('should throw error for null text', async () => {
      await expect(embeddingService.getEmbedding(null)).rejects.toThrow('Text cannot be empty');
    });

    it('should throw error for undefined text', async () => {
      await expect(embeddingService.getEmbedding(undefined)).rejects.toThrow('Text cannot be empty');
    });

    it('should generate embedding for valid text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const result = await embeddingService.getEmbedding('Test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Test text',
        dimensions: 1536
      });
    });

    it('should clean text before embedding', async () => {
      const mockEmbedding = [0.1, 0.2];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      await embeddingService.getEmbedding('Multiple   spaces');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Multiple spaces',
        dimensions: 1536
      });
    });

    it('should handle API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.getEmbedding('Test')).rejects.toThrow('Failed to generate embedding');
      expect(log.error).toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(embeddingService.getEmbedding('Test')).rejects.toThrow('Failed to generate embedding: Rate limit exceeded');
    });

    it('should handle authentication errors', async () => {
      mockCreate.mockRejectedValue(new Error('Invalid API key'));

      await expect(embeddingService.getEmbedding('Test')).rejects.toThrow('Failed to generate embedding: Invalid API key');
    });

    it('should handle long text', async () => {
      const mockEmbedding = [0.1];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const longText = 'word '.repeat(10000);
      await embeddingService.getEmbedding(longText);

      expect(mockCreate).toHaveBeenCalled();
      const callArg = mockCreate.mock.calls[0][0].input;
      expect(callArg.length).toBeLessThanOrEqual(32000);
    });

    it('should handle unicode characters', async () => {
      const mockEmbedding = [0.1];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      await embeddingService.getEmbedding('Hello 世界 🌍');

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should trim text', async () => {
      const mockEmbedding = [0.1];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      await embeddingService.getEmbedding('  Text  ');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Text',
        dimensions: 1536
      });
    });

    it('should handle newlines in text', async () => {
      const mockEmbedding = [0.1];
      mockCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      await embeddingService.getEmbedding('Line 1\nLine 2');

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'Line 1 Line 2',
        dimensions: 1536
      });
    });
  });

  describe('getEmbeddings', () => {
    it('should return empty array for empty input', async () => {
      expect(await embeddingService.getEmbeddings([])).toEqual([]);
    });

    it('should return empty array for null input', async () => {
      expect(await embeddingService.getEmbeddings(null)).toEqual([]);
    });

    it('should return empty array for undefined input', async () => {
      expect(await embeddingService.getEmbeddings(undefined)).toEqual([]);
    });

    it('should return empty array if all texts are empty', async () => {
      const result = await embeddingService.getEmbeddings(['', '   ', null]);
      expect(result).toEqual([]);
    });

    it('should filter out empty strings', async () => {
      mockCreate.mockResolvedValue({
        data: [
          { index: 0, embedding: [0.1, 0.2] }
        ]
      });

      const result = await embeddingService.getEmbeddings(['Valid text', '', null, '   ']);

      expect(result).toHaveLength(1);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['Valid text'],
        dimensions: 1536
      });
    });

    it('should generate embeddings for multiple texts', async () => {
      mockCreate.mockResolvedValue({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] }
        ]
      });

      const result = await embeddingService.getEmbeddings(['Text 1', 'Text 2']);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([0.1, 0.2]);
      expect(result[1]).toEqual([0.3, 0.4]);
    });

    it('should sort embeddings by index', async () => {
      mockCreate.mockResolvedValue({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] }
        ]
      });

      const result = await embeddingService.getEmbeddings(['Text 1', 'Text 2']);

      expect(result[0]).toEqual([0.1, 0.2]);
      expect(result[1]).toEqual([0.3, 0.4]);
    });

    it('should handle API errors in batch', async () => {
      mockCreate.mockRejectedValue(new Error('Batch API Error'));

      await expect(embeddingService.getEmbeddings(['Text'])).rejects.toThrow('Failed to generate embeddings');
      expect(log.error).toHaveBeenCalled();
    });

    it('should process in batches of 100', async () => {
      mockCreate.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({
          index: i,
          embedding: [i * 0.1]
        }))
      });

      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`);
      await embeddingService.getEmbeddings(texts);

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle batches larger than 100', async () => {
      mockCreate
        .mockResolvedValueOnce({
          data: Array.from({ length: 100 }, (_, i) => ({
            index: i,
            embedding: [i * 0.1]
          }))
        })
        .mockResolvedValueOnce({
          data: Array.from({ length: 50 }, (_, i) => ({
            index: i,
            embedding: [(i + 100) * 0.1]
          }))
        });

      const texts = Array.from({ length: 150 }, (_, i) => `Text ${i}`);
      const results = await embeddingService.getEmbeddings(texts);

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(150);
    });

    it('should handle exactly 100 texts', async () => {
      mockCreate.mockResolvedValue({
        data: Array.from({ length: 100 }, (_, i) => ({
          index: i,
          embedding: [i * 0.1]
        }))
      });

      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`);
      const results = await embeddingService.getEmbeddings(texts);

      expect(results).toHaveLength(100);
    });

    it('should clean all texts before embedding', async () => {
      mockCreate.mockResolvedValue({
        data: [
          { index: 0, embedding: [0.1] },
          { index: 1, embedding: [0.2] }
        ]
      });

      await embeddingService.getEmbeddings(['Text  1', '  Text 2  ']);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['Text 1', 'Text 2'],
        dimensions: 1536
      });
    });

    it('should handle batch processing errors with context', async () => {
      mockCreate.mockRejectedValue(new Error('Batch 0 failed'));

      await expect(embeddingService.getEmbeddings(['Text 1', 'Text 2']))
        .rejects.toThrow('Failed to generate embeddings: Batch 0 failed');
    });

    it('should handle single text as array', async () => {
      mockCreate.mockResolvedValue({
        data: [{ index: 0, embedding: [0.1] }]
      });

      const result = await embeddingService.getEmbeddings(['Single text']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0.1]);
    });
  });

  describe('cleanText', () => {
    it('should return empty string for null', () => {
      expect(embeddingService.cleanText(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(embeddingService.cleanText(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(embeddingService.cleanText('')).toBe('');
    });

    it('should collapse whitespace', () => {
      expect(embeddingService.cleanText('multiple   spaces')).toBe('multiple spaces');
    });

    it('should collapse tabs and newlines', () => {
      expect(embeddingService.cleanText('text\t\twith\n\ntabs')).toBe('text with tabs');
    });

    it('should remove null characters', () => {
      expect(embeddingService.cleanText('text\0with\0nulls')).toBe('textwithnulls');
    });

    it('should trim text', () => {
      expect(embeddingService.cleanText('  padded  ')).toBe('padded');
    });

    it('should truncate long text to 32000 chars', () => {
      const longText = 'A'.repeat(50000);
      const cleaned = embeddingService.cleanText(longText);

      expect(cleaned.length).toBe(32000);
    });

    it('should handle text at exactly 32000 chars', () => {
      const text = 'A'.repeat(32000);
      const cleaned = embeddingService.cleanText(text);

      expect(cleaned.length).toBe(32000);
    });

    it('should not truncate text under 32000 chars', () => {
      const text = 'A'.repeat(1000);
      const cleaned = embeddingService.cleanText(text);

      expect(cleaned.length).toBe(1000);
    });

    it('should handle unicode characters', () => {
      const text = 'Hello 世界 🌍';
      const cleaned = embeddingService.cleanText(text);

      expect(cleaned).toBe('Hello 世界 🌍');
    });

    it('should handle mixed whitespace types', () => {
      const text = '  \t\n  Text  \n\t  ';
      const cleaned = embeddingService.cleanText(text);

      expect(cleaned).toBe('Text');
    });

    it('should preserve single spaces', () => {
      expect(embeddingService.cleanText('a b c')).toBe('a b c');
    });
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [0.5, 0.5, 0.5];
      const similarity = embeddingService.cosineSimilarity(vec, vec);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const vecA = [1, 0];
      const vecB = [-1, 0];
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should throw error for vectors of different length', () => {
      expect(() => {
        embeddingService.cosineSimilarity([1, 2], [1, 2, 3]);
      }).toThrow('Vectors must have the same length');
    });

    it('should return 0 for zero vector A', () => {
      const similarity = embeddingService.cosineSimilarity([0, 0], [1, 2]);

      expect(similarity).toBe(0);
    });

    it('should return 0 for zero vector B', () => {
      const similarity = embeddingService.cosineSimilarity([1, 2], [0, 0]);

      expect(similarity).toBe(0);
    });

    it('should return 0 for both zero vectors', () => {
      const similarity = embeddingService.cosineSimilarity([0, 0], [0, 0]);

      expect(similarity).toBe(0);
    });

    it('should calculate similarity correctly for positive vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];
      // dot: 1*4 + 2*5 + 3*6 = 32
      // normA: sqrt(1 + 4 + 9) = sqrt(14)
      // normB: sqrt(16 + 25 + 36) = sqrt(77)
      // similarity: 32 / (sqrt(14) * sqrt(77)) ≈ 0.974

      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeGreaterThan(0.97);
      expect(similarity).toBeLessThan(0.98);
    });

    it('should handle negative values', () => {
      const vecA = [-1, -2, -3];
      const vecB = [1, 2, 3];
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(-1, 5);
    });

    it('should handle mixed positive and negative values', () => {
      const vecA = [1, -1];
      const vecB = [1, 1];
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(0, 5);
    });

    it('should handle fractional values', () => {
      const vecA = [0.1, 0.2, 0.3];
      const vecB = [0.4, 0.5, 0.6];
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should be commutative', () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];

      const sim1 = embeddingService.cosineSimilarity(vecA, vecB);
      const sim2 = embeddingService.cosineSimilarity(vecB, vecA);

      expect(sim1).toBeCloseTo(sim2, 10);
    });

    it('should handle single-element vectors', () => {
      const similarity = embeddingService.cosineSimilarity([5], [10]);
      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle large vectors', () => {
      const vecA = Array(1536).fill(0.1);
      const vecB = Array(1536).fill(0.1);
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should handle very small values', () => {
      const vecA = [1e-10, 2e-10];
      const vecB = [1e-10, 2e-10];
      const similarity = embeddingService.cosineSimilarity(vecA, vecB);

      expect(similarity).toBeCloseTo(1, 5);
    });
  });

  describe('getModelName', () => {
    it('should return model name', () => {
      expect(embeddingService.getModelName()).toBe('text-embedding-3-small');
    });

    it('should return string type', () => {
      expect(typeof embeddingService.getModelName()).toBe('string');
    });
  });

  describe('getDimensions', () => {
    it('should return dimensions', () => {
      expect(embeddingService.getDimensions()).toBe(1536);
    });

    it('should return number type', () => {
      expect(typeof embeddingService.getDimensions()).toBe('number');
    });
  });

  describe('OpenAI client initialization', () => {
    it('should initialize OpenAI client lazily', () => {
      // Access the openai getter
      const client = embeddingService.openai;
      expect(client).toBeDefined();
      expect(client.embeddings).toBeDefined();
    });

    it('should reuse the same client instance', () => {
      const client1 = embeddingService.openai;
      const client2 = embeddingService.openai;
      expect(client1).toBe(client2);
    });
  });

  describe('Error scenarios', () => {
    it('should handle network timeout', async () => {
      mockCreate.mockRejectedValue(new Error('Network timeout'));

      await expect(embeddingService.getEmbedding('Test'))
        .rejects.toThrow('Failed to generate embedding: Network timeout');
    });

    it('should handle invalid response format', async () => {
      mockCreate.mockResolvedValue({
        data: null
      });

      await expect(embeddingService.getEmbedding('Test'))
        .rejects.toThrow();
    });

    it('should handle missing data array', async () => {
      mockCreate.mockResolvedValue({});

      await expect(embeddingService.getEmbedding('Test'))
        .rejects.toThrow();
    });

    it('should log errors appropriately', async () => {
      mockCreate.mockRejectedValue(new Error('Test error'));

      await expect(embeddingService.getEmbedding('Test'))
        .rejects.toThrow();

      expect(log.error).toHaveBeenCalledWith(
        'Error generating embedding:',
        expect.objectContaining({ error: 'Test error' })
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should handle typical embedding workflow', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: Array(1536).fill(0.1) }]
      });

      const text = 'This is a typical document that needs to be embedded for semantic search.';
      const embedding = await embeddingService.getEmbedding(text);

      expect(embedding).toHaveLength(1536);
      expect(embedding.every(val => typeof val === 'number')).toBe(true);
    });

    it('should handle batch document processing', async () => {
      mockCreate.mockResolvedValue({
        data: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          embedding: Array(1536).fill(i * 0.01)
        }))
      });

      const documents = Array.from({ length: 10 }, (_, i) => `Document ${i}`);
      const embeddings = await embeddingService.getEmbeddings(documents);

      expect(embeddings).toHaveLength(10);
      embeddings.forEach((emb, i) => {
        expect(emb).toHaveLength(1536);
      });
    });

    it('should handle similarity comparison workflow', async () => {
      const query = [0.5, 0.5, 0];
      const doc1 = [0.6, 0.4, 0];
      const doc2 = [0.1, 0.9, 0];

      const sim1 = embeddingService.cosineSimilarity(query, doc1);
      const sim2 = embeddingService.cosineSimilarity(query, doc2);

      expect(sim1).toBeGreaterThan(sim2);
    });
  });

  describe('Edge cases', () => {
    it('should handle text with only whitespace after cleaning', async () => {
      // This should be caught by the empty text check
      await expect(embeddingService.getEmbedding('   \n\t   '))
        .rejects.toThrow('Text cannot be empty');
    });

    it('should handle very long single word', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }]
      });

      const longWord = 'A'.repeat(10000);
      await embeddingService.getEmbedding(longWord);

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should handle special characters', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }]
      });

      await embeddingService.getEmbedding('Text with @#$%^&* special chars!');

      expect(mockCreate).toHaveBeenCalled();
    });

    it('should handle emojis and special unicode', async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }]
      });

      await embeddingService.getEmbedding('Hello 👋 World 🌍 Test 🚀');

      expect(mockCreate).toHaveBeenCalled();
    });
  });
});
