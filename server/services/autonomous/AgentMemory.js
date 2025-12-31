/**
 * Agent Memory System - Persistent Memory and Context Management
 * Handles short-term, long-term, and episodic memory for agents
 */

const db = require('../../db');
const log = require('../../utils/logger');

// Memory configuration
const MEMORY_CONFIG = {
  shortTermCapacity: parseInt(process.env.AGENT_SHORT_TERM_CAPACITY) || 100,
  longTermCapacity: parseInt(process.env.AGENT_LONG_TERM_CAPACITY) || 1000,
  episodicCapacity: parseInt(process.env.AGENT_EPISODIC_CAPACITY) || 500,
  embeddingDimension: parseInt(process.env.EMBEDDING_DIMENSION) || 1536,
  similarityThreshold: parseFloat(process.env.MEMORY_SIMILARITY_THRESHOLD) || 0.7,
  consolidationInterval: parseInt(process.env.MEMORY_CONSOLIDATION_INTERVAL) || 3600000 // 1 hour
};

// Memory types
const MEMORY_TYPES = {
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term',
  EPISODIC: 'episodic',
  SEMANTIC: 'semantic',
  PROCEDURAL: 'procedural'
};

// Memory importance levels
const IMPORTANCE_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

class AgentMemory {
  constructor(agentId) {
    this.agentId = agentId;
    this.shortTermMemory = [];
    this.workingMemory = {};
    this.lastConsolidation = null;
    this.accessLog = [];
  }

  /**
   * Store a new memory
   */
  async store(content, options = {}) {
    const {
      type = MEMORY_TYPES.SHORT_TERM,
      importance = IMPORTANCE_LEVELS.MEDIUM,
      tags = [],
      metadata = {},
      embedding = null
    } = options;

    const memory = {
      agent_id: this.agentId,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      memory_type: type,
      importance,
      tags,
      metadata,
      embedding,
      access_count: 0,
      created_at: new Date()
    };

    // Store in database
    const result = await db.query(
      `INSERT INTO agent_memories
       (agent_id, content, memory_type, importance, tags, metadata, embedding, access_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [
        this.agentId,
        memory.content,
        type,
        importance,
        JSON.stringify(tags),
        JSON.stringify(metadata),
        embedding ? JSON.stringify(embedding) : null
      ]
    );

    // Add to short-term cache
    if (type === MEMORY_TYPES.SHORT_TERM) {
      this.shortTermMemory.push(this.parseMemory(result.rows[0]));
      this.enforceCapacity();
    }

    log.debug('AgentMemory: Memory stored', {
      agentId: this.agentId,
      memoryId: result.rows[0].id,
      type
    });

    return this.parseMemory(result.rows[0]);
  }

  /**
   * Retrieve memories by query
   */
  async retrieve(query, options = {}) {
    const {
      type = null,
      limit = 10,
      minImportance = IMPORTANCE_LEVELS.LOW,
      tags = [],
      useEmbedding = false
    } = options;

    let dbQuery = `
      SELECT * FROM agent_memories
      WHERE agent_id = $1 AND importance >= $2
    `;
    const params = [this.agentId, minImportance];
    let paramIndex = 3;

    if (type) {
      dbQuery += ` AND memory_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (tags.length > 0) {
      dbQuery += ` AND tags ?| $${paramIndex}`;
      params.push(tags);
      paramIndex++;
    }

    // Text search if query provided
    if (query && !useEmbedding) {
      dbQuery += ` AND content ILIKE $${paramIndex}`;
      params.push(`%${query}%`);
      paramIndex++;
    }

    dbQuery += ` ORDER BY importance DESC, access_count DESC, created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await db.query(dbQuery, params);

    // Update access counts
    if (result.rows.length > 0) {
      const ids = result.rows.map(r => r.id);
      await db.query(
        `UPDATE agent_memories SET access_count = access_count + 1, last_accessed_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
        [ids]
      );
    }

    return result.rows.map(this.parseMemory);
  }

  /**
   * Retrieve similar memories using embedding similarity
   */
  async retrieveSimilar(embedding, options = {}) {
    const { limit = 5, threshold = MEMORY_CONFIG.similarityThreshold } = options;

    // Simple cosine similarity search
    // In production, use vector database like Pinecone or pgvector
    const result = await db.query(
      `SELECT * FROM agent_memories
       WHERE agent_id = $1 AND embedding IS NOT NULL
       ORDER BY created_at DESC LIMIT 100`,
      [this.agentId]
    );

    const memories = result.rows
      .map(row => ({
        ...this.parseMemory(row),
        similarity: this.cosineSimilarity(embedding, JSON.parse(row.embedding || '[]'))
      }))
      .filter(m => m.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return memories;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Update working memory
   */
  setWorkingMemory(key, value) {
    this.workingMemory[key] = {
      value,
      timestamp: new Date()
    };
  }

  /**
   * Get from working memory
   */
  getWorkingMemory(key) {
    const entry = this.workingMemory[key];
    return entry ? entry.value : null;
  }

  /**
   * Clear working memory
   */
  clearWorkingMemory() {
    this.workingMemory = {};
  }

  /**
   * Consolidate short-term to long-term memory
   */
  async consolidate() {
    const importantMemories = this.shortTermMemory.filter(
      m => m.importance >= IMPORTANCE_LEVELS.HIGH || m.access_count > 3
    );

    for (const memory of importantMemories) {
      await db.query(
        `UPDATE agent_memories SET memory_type = $1 WHERE id = $2`,
        [MEMORY_TYPES.LONG_TERM, memory.id]
      );
    }

    // Clear consolidated memories from short-term
    this.shortTermMemory = this.shortTermMemory.filter(
      m => m.importance < IMPORTANCE_LEVELS.HIGH && m.access_count <= 3
    );

    this.lastConsolidation = new Date();

    log.info('AgentMemory: Consolidation complete', {
      agentId: this.agentId,
      consolidated: importantMemories.length
    });

    return importantMemories.length;
  }

  /**
   * Create episodic memory from a task execution
   */
  async createEpisode(taskId, episode) {
    const { summary, steps, outcome, learnings = [] } = episode;

    const episodeMemory = {
      type: 'task_episode',
      taskId,
      summary,
      stepCount: steps?.length || 0,
      outcome,
      learnings,
      timestamp: new Date()
    };

    return this.store(episodeMemory, {
      type: MEMORY_TYPES.EPISODIC,
      importance: outcome === 'success' ? IMPORTANCE_LEVELS.MEDIUM : IMPORTANCE_LEVELS.HIGH,
      tags: ['episode', outcome],
      metadata: { taskId }
    });
  }

  /**
   * Get recent episodes
   */
  async getRecentEpisodes(limit = 10) {
    return this.retrieve(null, {
      type: MEMORY_TYPES.EPISODIC,
      limit
    });
  }

  /**
   * Store procedural memory (how to do something)
   */
  async storeProcedure(name, steps, options = {}) {
    const procedure = {
      name,
      steps,
      version: options.version || 1,
      lastUsed: null,
      successRate: null
    };

    return this.store(procedure, {
      type: MEMORY_TYPES.PROCEDURAL,
      importance: IMPORTANCE_LEVELS.HIGH,
      tags: ['procedure', name],
      metadata: options.metadata
    });
  }

  /**
   * Get procedure by name
   */
  async getProcedure(name) {
    const memories = await this.retrieve(null, {
      type: MEMORY_TYPES.PROCEDURAL,
      tags: ['procedure', name],
      limit: 1
    });

    return memories.length > 0 ? memories[0] : null;
  }

  /**
   * Store semantic memory (facts and knowledge)
   */
  async storeFact(subject, predicate, object, options = {}) {
    const fact = {
      subject,
      predicate,
      object,
      confidence: options.confidence || 1.0,
      source: options.source || 'learned'
    };

    return this.store(fact, {
      type: MEMORY_TYPES.SEMANTIC,
      importance: options.importance || IMPORTANCE_LEVELS.MEDIUM,
      tags: ['fact', subject],
      metadata: { predicate }
    });
  }

  /**
   * Query semantic memory
   */
  async queryFacts(subject) {
    return this.retrieve(null, {
      type: MEMORY_TYPES.SEMANTIC,
      tags: ['fact', subject]
    });
  }

  /**
   * Forget old, low-importance memories
   */
  async forget(options = {}) {
    const {
      olderThan = 30, // days
      maxImportance = IMPORTANCE_LEVELS.LOW,
      excludeTypes = [MEMORY_TYPES.PROCEDURAL]
    } = options;

    const result = await db.query(
      `DELETE FROM agent_memories
       WHERE agent_id = $1
       AND importance <= $2
       AND memory_type != ALL($3)
       AND created_at < NOW() - INTERVAL '${olderThan} days'
       AND access_count < 3
       RETURNING id`,
      [this.agentId, maxImportance, excludeTypes]
    );

    log.info('AgentMemory: Forgotten memories', {
      agentId: this.agentId,
      count: result.rows.length
    });

    return result.rows.length;
  }

  /**
   * Get memory statistics
   */
  async getStats() {
    const result = await db.query(
      `SELECT
        memory_type,
        COUNT(*) as count,
        AVG(importance) as avg_importance,
        AVG(access_count) as avg_access_count,
        MAX(created_at) as newest,
        MIN(created_at) as oldest
       FROM agent_memories
       WHERE agent_id = $1
       GROUP BY memory_type`,
      [this.agentId]
    );

    const totalResult = await db.query(
      `SELECT COUNT(*) as total FROM agent_memories WHERE agent_id = $1`,
      [this.agentId]
    );

    return {
      total: parseInt(totalResult.rows[0]?.total || 0),
      byType: result.rows.reduce((acc, row) => {
        acc[row.memory_type] = {
          count: parseInt(row.count),
          avgImportance: parseFloat(row.avg_importance || 0),
          avgAccessCount: parseFloat(row.avg_access_count || 0),
          newest: row.newest,
          oldest: row.oldest
        };
        return acc;
      }, {}),
      shortTermSize: this.shortTermMemory.length,
      workingMemoryKeys: Object.keys(this.workingMemory).length,
      lastConsolidation: this.lastConsolidation
    };
  }

  /**
   * Export all memories
   */
  async export() {
    const result = await db.query(
      `SELECT * FROM agent_memories WHERE agent_id = $1 ORDER BY created_at`,
      [this.agentId]
    );

    return result.rows.map(this.parseMemory);
  }

  /**
   * Import memories
   */
  async import(memories) {
    let imported = 0;

    for (const memory of memories) {
      try {
        await this.store(memory.content, {
          type: memory.memory_type,
          importance: memory.importance,
          tags: memory.tags,
          metadata: memory.metadata
        });
        imported++;
      } catch (error) {
        log.error('AgentMemory: Failed to import memory', { error: error.message });
      }
    }

    return imported;
  }

  /**
   * Enforce memory capacity limits
   */
  enforceCapacity() {
    if (this.shortTermMemory.length > MEMORY_CONFIG.shortTermCapacity) {
      // Remove oldest, lowest importance memories
      this.shortTermMemory.sort((a, b) => {
        if (a.importance !== b.importance) return b.importance - a.importance;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      this.shortTermMemory = this.shortTermMemory.slice(0, MEMORY_CONFIG.shortTermCapacity);
    }
  }

  /**
   * Load short-term memory from database
   */
  async loadShortTermMemory() {
    const result = await db.query(
      `SELECT * FROM agent_memories
       WHERE agent_id = $1 AND memory_type = $2
       ORDER BY importance DESC, created_at DESC
       LIMIT $3`,
      [this.agentId, MEMORY_TYPES.SHORT_TERM, MEMORY_CONFIG.shortTermCapacity]
    );

    this.shortTermMemory = result.rows.map(this.parseMemory);
    return this.shortTermMemory;
  }

  /**
   * Get context for decision making
   */
  async getContext(query = '', options = {}) {
    const { maxItems = 20 } = options;

    // Get recent short-term memories
    const recentMemories = this.shortTermMemory.slice(-10);

    // Get relevant long-term memories
    const relevantMemories = await this.retrieve(query, {
      type: MEMORY_TYPES.LONG_TERM,
      limit: 5
    });

    // Get recent episodes
    const episodes = await this.getRecentEpisodes(5);

    return {
      recent: recentMemories,
      relevant: relevantMemories,
      episodes,
      working: { ...this.workingMemory }
    };
  }

  /**
   * Parse memory from database row
   */
  parseMemory(row) {
    if (!row) return null;

    return {
      ...row,
      content: (() => {
        try {
          return JSON.parse(row.content);
        } catch {
          return row.content;
        }
      })(),
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {},
      embedding: row.embedding ? (typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding) : null
    };
  }
}

// Export constants
AgentMemory.TYPES = MEMORY_TYPES;
AgentMemory.IMPORTANCE = IMPORTANCE_LEVELS;
AgentMemory.CONFIG = MEMORY_CONFIG;

module.exports = AgentMemory;
