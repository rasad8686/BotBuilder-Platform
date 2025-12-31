/**
 * EmbeddingService Tests
 * Tests for server/knowledge/EmbeddingService.js
 */

// Set API key before importing to allow lazy initialization
process.env.OPENAI_API_KEY = 'test-api-key';

// Mock OpenAI before requiring the module
const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    embeddings: {
      create: mockCreate
    }
  }));
});

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

const embeddingService = require('../../knowledge/EmbeddingService');

describe('EmbeddingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default model', () => {
      expect(embeddingService.getModelName()).toBe('text-embedding-3-small');
    });

    it('should initialize with default dimensions', () => {
      expect(embeddingService.getDimensions()).toBe(1536);
    });
  });

  describe('getEmbedding', () => {
    it('should throw error for empty text', async () => {
      await expect(embeddingService.getEmbedding('')).rejects.toThrow('Text cannot be empty');
      await expect(embeddingService.getEmbedding('   ')).rejects.toThrow('Text cannot be empty');
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

    it('should handle API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.getEmbedding('Test')).rejects.toThrow('Failed to generate embedding');
    });
  });

  describe('getEmbeddings', () => {
    it('should return empty array for empty input', async () => {
      expect(await embeddingService.getEmbeddings([])).toEqual([]);
      expect(await embeddingService.getEmbeddings(null)).toEqual([]);
    });

    it('should return empty array if all texts are empty', async () => {
      const result = await embeddingService.getEmbeddings(['', '   ', null]);

      expect(result).toEqual([]);
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
    });
  });

  describe('cleanText', () => {
    it('should return empty string for null', () => {
      expect(embeddingService.cleanText(null)).toBe('');
    });

    it('should collapse whitespace', () => {
      expect(embeddingService.cleanText('multiple   spaces')).toBe('multiple spaces');
    });

    it('should remove null characters', () => {
      expect(embeddingService.cleanText('text\0with\0nulls')).toBe('textwithnulls');
    });

    it('should trim text', () => {
      expect(embeddingService.cleanText('  padded  ')).toBe('padded');
    });

    it('should truncate long text', () => {
      const longText = 'A'.repeat(50000);
      const cleaned = embeddingService.cleanText(longText);

      expect(cleaned.length).toBe(32000);
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

    it('should throw error for vectors of different length', () => {
      expect(() => {
        embeddingService.cosineSimilarity([1, 2], [1, 2, 3]);
      }).toThrow('Vectors must have the same length');
    });

    it('should return 0 for zero vectors', () => {
      const similarity = embeddingService.cosineSimilarity([0, 0], [1, 2]);

      expect(similarity).toBe(0);
    });

    it('should calculate similarity correctly', () => {
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
  });

  describe('getModelName', () => {
    it('should return model name', () => {
      expect(embeddingService.getModelName()).toBe('text-embedding-3-small');
    });
  });

  describe('getDimensions', () => {
    it('should return dimensions', () => {
      expect(embeddingService.getDimensions()).toBe(1536);
    });
  });
});
