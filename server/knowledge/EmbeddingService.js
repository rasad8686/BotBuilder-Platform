const OpenAI = require('openai');
const log = require('../utils/logger');

class EmbeddingService {
  constructor() {
    // Lazy initialization - only create OpenAI client when API key is available
    this._openai = null;
    this.model = 'text-embedding-3-small';
    this.dimensions = 1536;
  }

  get openai() {
    if (!this._openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is not set');
      }
      this._openai = new OpenAI({ apiKey });
    }
    return this._openai;
  }

  /**
   * Get embedding for a single text
   * @param {string} text - Text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async getEmbedding(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Clean and truncate text if needed (max ~8000 tokens for this model)
    const cleanedText = this.cleanText(text);

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: cleanedText,
        dimensions: this.dimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      log.error('Error generating embedding:', { error: error.message });
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Get embeddings for multiple texts in batch
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async getEmbeddings(texts) {
    if (!texts || texts.length === 0) {
      return [];
    }

    // Filter out empty texts and clean
    const cleanedTexts = texts
      .map(text => this.cleanText(text))
      .filter(text => text.length > 0);

    if (cleanedTexts.length === 0) {
      return [];
    }

    // Process in batches of 100 (OpenAI limit)
    const batchSize = 100;
    const allEmbeddings = [];

    for (let i = 0; i < cleanedTexts.length; i += batchSize) {
      const batch = cleanedTexts.slice(i, i + batchSize);

      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: this.dimensions
        });

        const embeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map(item => item.embedding);

        allEmbeddings.push(...embeddings);
      } catch (error) {
        log.error(`Error generating embeddings for batch ${i / batchSize}:`, { error: error.message, batchIndex: i / batchSize });
        throw new Error(`Failed to generate embeddings: ${error.message}`);
      }
    }

    return allEmbeddings;
  }

  /**
   * Clean text for embedding
   * @param {string} text - Raw text
   * @returns {string} - Cleaned text
   */
  cleanText(text) {
    if (!text) return '';

    return text
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Remove null characters
      .replace(/\0/g, '')
      // Trim
      .trim()
      // Truncate to approximately 8000 tokens (~32000 characters)
      .substring(0, 32000);
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} - Similarity score (0-1)
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get the embedding model name
   * @returns {string} - Model name
   */
  getModelName() {
    return this.model;
  }

  /**
   * Get embedding dimensions
   * @returns {number} - Dimensions
   */
  getDimensions() {
    return this.dimensions;
  }
}

module.exports = new EmbeddingService();
