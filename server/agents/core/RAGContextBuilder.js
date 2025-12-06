const VectorStore = require('../../knowledge/VectorStore');
const EmbeddingService = require('../../knowledge/EmbeddingService');
const pool = require('../../db');
const log = require('../../utils/logger');

class RAGContextBuilder {
  constructor() {
    this.defaultLimit = 5;
    this.defaultThreshold = 0.6;
  }

  /**
   * Get relevant context for an agent based on user query
   * @param {number} agentId - Agent ID
   * @param {string} userQuery - User's query
   * @param {object} options - Optional settings
   * @returns {Promise<object>} - Context with chunks and metadata
   */
  async getContextForAgent(agentId, userQuery, options = {}) {
    const {
      limit = this.defaultLimit,
      threshold = this.defaultThreshold,
      includeMetadata = true
    } = options;

    try {
      // Get knowledge bases assigned to this agent
      const knowledgeBases = await VectorStore.getAgentKnowledgeBases(agentId);

      if (!knowledgeBases || knowledgeBases.length === 0) {
        return {
          hasContext: false,
          chunks: [],
          message: 'No knowledge bases assigned to this agent'
        };
      }

      // Generate embedding for the query
      const queryEmbedding = await EmbeddingService.getEmbedding(userQuery);

      // Get knowledge base IDs sorted by priority
      const kbIds = knowledgeBases
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .map(kb => kb.id);

      // Search across all knowledge bases
      const results = await VectorStore.multiKnowledgeBaseSearch(
        kbIds,
        queryEmbedding,
        { limit, threshold }
      );

      if (results.length === 0) {
        return {
          hasContext: false,
          chunks: [],
          message: 'No relevant context found for this query'
        };
      }

      // Format chunks for context
      const chunks = results.map(result => ({
        content: result.content,
        similarity: result.similarity,
        source: {
          documentName: result.document_name,
          documentType: result.document_type,
          knowledgeBaseName: result.knowledge_base_name,
          chunkIndex: result.chunk_index
        },
        metadata: includeMetadata ? result.metadata : undefined
      }));

      // Build context string
      const contextString = this.buildContextString(chunks);

      return {
        hasContext: true,
        chunks,
        contextString,
        metadata: {
          totalChunks: chunks.length,
          knowledgeBasesSearched: knowledgeBases.length,
          averageSimilarity: chunks.reduce((sum, c) => sum + c.similarity, 0) / chunks.length
        }
      };

    } catch (error) {
      log.error('Error building RAG context:', { error: error.message, agentId });
      throw new Error(`Failed to build context: ${error.message}`);
    }
  }

  /**
   * Build a formatted context string from chunks
   * @param {Array} chunks - Array of chunk objects
   * @returns {string} - Formatted context string
   */
  buildContextString(chunks) {
    if (!chunks || chunks.length === 0) {
      return '';
    }

    const contextParts = chunks.map((chunk, index) => {
      const source = chunk.source;
      const header = `[Source ${index + 1}: ${source.documentName} (${(chunk.similarity * 100).toFixed(1)}% match)]`;
      return `${header}\n${chunk.content}`;
    });

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Build a system prompt with RAG context
   * @param {string} basePrompt - Original system prompt
   * @param {object} context - Context from getContextForAgent
   * @returns {string} - Enhanced system prompt
   */
  buildRAGSystemPrompt(basePrompt, context) {
    if (!context.hasContext) {
      return basePrompt;
    }

    const ragSection = `
## Relevant Knowledge Base Context

The following information from the knowledge base may be relevant to the user's query.
Use this context to provide accurate and informed responses.

${context.contextString}

## Instructions
- Use the above context to answer questions accurately
- If the context doesn't contain relevant information, acknowledge this
- Cite sources when directly using information from the context
- Do not make up information not present in the context

---

`;

    return ragSection + basePrompt;
  }

  /**
   * Get agent's knowledge base IDs
   * @param {number} agentId - Agent ID
   * @returns {Promise<number[]>} - Array of knowledge base IDs
   */
  async getAgentKnowledgeBaseIds(agentId) {
    const result = await pool.query(
      `SELECT knowledge_base_id FROM agent_knowledge_bases
       WHERE agent_id = $1
       ORDER BY priority DESC`,
      [agentId]
    );

    return result.rows.map(row => row.knowledge_base_id);
  }

  /**
   * Check if agent has any knowledge bases
   * @param {number} agentId - Agent ID
   * @returns {Promise<boolean>}
   */
  async agentHasKnowledgeBases(agentId) {
    const result = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM agent_knowledge_bases WHERE agent_id = $1) as has_kb`,
      [agentId]
    );

    return result.rows[0].has_kb;
  }

  /**
   * Quick relevance check without full context building
   * @param {number} agentId - Agent ID
   * @param {string} query - User query
   * @returns {Promise<boolean>} - Whether relevant context exists
   */
  async hasRelevantContext(agentId, query) {
    try {
      const hasKB = await this.agentHasKnowledgeBases(agentId);
      if (!hasKB) return false;

      const kbIds = await this.getAgentKnowledgeBaseIds(agentId);
      const queryEmbedding = await EmbeddingService.getEmbedding(query);

      const results = await VectorStore.multiKnowledgeBaseSearch(
        kbIds,
        queryEmbedding,
        { limit: 1, threshold: this.defaultThreshold }
      );

      return results.length > 0;
    } catch (error) {
      log.error('Error checking context relevance:', { error: error.message, agentId });
      return false;
    }
  }
}

module.exports = new RAGContextBuilder();
