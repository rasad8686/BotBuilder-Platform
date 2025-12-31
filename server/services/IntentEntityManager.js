/**
 * Intent & Entity Manager Service
 * NLU (Natural Language Understanding) for chatbots
 */

const db = require('../db');
const OpenAI = require('openai');
const log = require('../utils/logger');

class IntentEntityManager {
  constructor() {
    // Lazy initialization - only create OpenAI client when API key is available
    this._openai = null;
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

  // ==================== INTENT CRUD ====================

  /**
   * Create a new intent
   * @param {number} botId - Bot ID
   * @param {object} data - Intent data
   * @returns {Promise<object>} - Created intent
   */
  async createIntent(botId, { name, displayName, description, confidenceThreshold = 0.7 }) {
    const result = await db.query(
      `INSERT INTO intents (bot_id, name, display_name, description, confidence_threshold)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [botId, name, displayName, description, confidenceThreshold]
    );
    return result.rows[0];
  }

  /**
   * Get all intents for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise<array>} - List of intents
   */
  async getIntents(botId) {
    const result = await db.query(
      `SELECT i.*,
              (SELECT COUNT(*) FROM intent_examples WHERE intent_id = i.id) as example_count
       FROM intents i
       WHERE i.bot_id = $1
       ORDER BY i.created_at DESC`,
      [botId]
    );
    return result.rows;
  }

  /**
   * Get a single intent by ID
   * @param {number} intentId - Intent ID
   * @returns {Promise<object>} - Intent
   */
  async getIntent(intentId) {
    const result = await db.query(
      `SELECT * FROM intents WHERE id = $1`,
      [intentId]
    );
    return result.rows[0];
  }

  /**
   * Update an intent
   * @param {number} intentId - Intent ID
   * @param {object} data - Update data
   * @returns {Promise<object>} - Updated intent
   */
  async updateIntent(intentId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(data.displayName);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }
    if (data.confidenceThreshold !== undefined) {
      fields.push(`confidence_threshold = $${paramIndex++}`);
      values.push(data.confidenceThreshold);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(intentId);

    const result = await db.query(
      `UPDATE intents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Delete an intent
   * @param {number} intentId - Intent ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteIntent(intentId) {
    const result = await db.query(
      `DELETE FROM intents WHERE id = $1 RETURNING id`,
      [intentId]
    );
    return result.rowCount > 0;
  }

  // ==================== INTENT EXAMPLES ====================

  /**
   * Add an example to an intent
   * @param {number} intentId - Intent ID
   * @param {object} data - Example data
   * @returns {Promise<object>} - Created example
   */
  async addExample(intentId, { text, language = 'az' }) {
    const result = await db.query(
      `INSERT INTO intent_examples (intent_id, text, language)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [intentId, text, language]
    );
    return result.rows[0];
  }

  /**
   * Get all examples for an intent
   * @param {number} intentId - Intent ID
   * @returns {Promise<array>} - List of examples
   */
  async getExamples(intentId) {
    const result = await db.query(
      `SELECT * FROM intent_examples WHERE intent_id = $1 ORDER BY created_at DESC`,
      [intentId]
    );
    return result.rows;
  }

  /**
   * Delete an example
   * @param {number} exampleId - Example ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteExample(exampleId) {
    const result = await db.query(
      `DELETE FROM intent_examples WHERE id = $1 RETURNING id`,
      [exampleId]
    );
    return result.rowCount > 0;
  }

  /**
   * Bulk add examples to an intent
   * @param {number} intentId - Intent ID
   * @param {array} examples - Array of { text, language }
   * @returns {Promise<array>} - Created examples
   */
  async bulkAddExamples(intentId, examples) {
    if (!examples || examples.length === 0) return [];

    const values = examples.map((ex, i) => {
      const offset = i * 3;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(', ');

    const params = examples.flatMap(ex => [intentId, ex.text, ex.language || 'az']);

    const result = await db.query(
      `INSERT INTO intent_examples (intent_id, text, language)
       VALUES ${values}
       RETURNING *`,
      params
    );
    return result.rows;
  }

  // ==================== ENTITY CRUD ====================

  /**
   * Create a new entity
   * @param {number} botId - Bot ID
   * @param {object} data - Entity data
   * @returns {Promise<object>} - Created entity
   */
  async createEntity(botId, { name, displayName, type = 'text' }) {
    const result = await db.query(
      `INSERT INTO entities (bot_id, name, display_name, type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [botId, name, displayName, type]
    );
    return result.rows[0];
  }

  /**
   * Get all entities for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise<array>} - List of entities
   */
  async getEntities(botId) {
    const result = await db.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM entity_values WHERE entity_id = e.id) as value_count
       FROM entities e
       WHERE e.bot_id = $1
       ORDER BY e.is_system DESC, e.created_at DESC`,
      [botId]
    );
    return result.rows;
  }

  /**
   * Get a single entity by ID
   * @param {number} entityId - Entity ID
   * @returns {Promise<object>} - Entity
   */
  async getEntity(entityId) {
    const result = await db.query(
      `SELECT * FROM entities WHERE id = $1`,
      [entityId]
    );
    return result.rows[0];
  }

  /**
   * Update an entity
   * @param {number} entityId - Entity ID
   * @param {object} data - Update data
   * @returns {Promise<object>} - Updated entity
   */
  async updateEntity(entityId, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(data.displayName);
    }
    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(entityId);

    const result = await db.query(
      `UPDATE entities SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Delete an entity
   * @param {number} entityId - Entity ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteEntity(entityId) {
    const result = await db.query(
      `DELETE FROM entities WHERE id = $1 AND is_system = false RETURNING id`,
      [entityId]
    );
    return result.rowCount > 0;
  }

  // ==================== ENTITY VALUES ====================

  /**
   * Add a value to an entity
   * @param {number} entityId - Entity ID
   * @param {object} data - Value data
   * @returns {Promise<object>} - Created value
   */
  async addValue(entityId, { value, synonyms = [] }) {
    const result = await db.query(
      `INSERT INTO entity_values (entity_id, value, synonyms)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [entityId, value, JSON.stringify(synonyms)]
    );
    return result.rows[0];
  }

  /**
   * Get all values for an entity
   * @param {number} entityId - Entity ID
   * @returns {Promise<array>} - List of values
   */
  async getValues(entityId) {
    const result = await db.query(
      `SELECT * FROM entity_values WHERE entity_id = $1 ORDER BY created_at DESC`,
      [entityId]
    );
    return result.rows;
  }

  /**
   * Delete a value
   * @param {number} valueId - Value ID
   * @returns {Promise<boolean>} - Success
   */
  async deleteValue(valueId) {
    const result = await db.query(
      `DELETE FROM entity_values WHERE id = $1 RETURNING id`,
      [valueId]
    );
    return result.rowCount > 0;
  }

  // ==================== NLU ANALYSIS ====================

  /**
   * Analyze a message using OpenAI
   * @param {number} botId - Bot ID
   * @param {string} message - User message
   * @returns {Promise<object>} - { intent: { name, confidence }, entities: [{ name, value }] }
   */
  async analyzeMessage(botId, message) {
    // Get intents with examples
    const intents = await this.getIntents(botId);
    const entities = await this.getEntities(botId);

    if (intents.length === 0) {
      return {
        intent: { name: null, confidence: 0 },
        entities: []
      };
    }

    // Build intent descriptions with examples
    const intentDescriptions = [];
    for (const intent of intents) {
      if (!intent.is_active) continue;
      const examples = await this.getExamples(intent.id);
      const exampleTexts = examples.slice(0, 5).map(e => `"${e.text}"`).join(', ');
      intentDescriptions.push(
        `- ${intent.name}: ${intent.description || intent.display_name || intent.name}${exampleTexts ? ` (nümunələr: ${exampleTexts})` : ''}`
      );
    }

    // Build entity descriptions
    const entityDescriptions = entities.map(e =>
      `- ${e.name} (${e.type}): ${e.display_name || e.name}`
    ).join('\n');

    const systemPrompt = `Sən NLU (Natural Language Understanding) analiz sistemisin.
İstifadəçi mesajını analiz et və intent (niyyət) və entity (obyekt) tap.

Mövcud intentlər:
${intentDescriptions.join('\n')}

Mövcud entitylər:
${entityDescriptions || 'Heç bir entity yoxdur'}

CAVAB FORMATI (JSON):
{
  "intent": {
    "name": "intent_name_or_null",
    "confidence": 0.0-1.0
  },
  "entities": [
    { "name": "entity_name", "value": "extracted_value" }
  ]
}

Əgər heç bir intent uyğun gəlmirsə, confidence 0 olsun.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content);

      // Validate confidence threshold
      if (result.intent && result.intent.name) {
        const matchedIntent = intents.find(i => i.name === result.intent.name);
        if (matchedIntent && result.intent.confidence < matchedIntent.confidence_threshold) {
          result.intent = { name: null, confidence: result.intent.confidence };
        }
      }

      return result;
    } catch (error) {
      log.error('NLU analysis error:', { error: error.message, botId });
      return {
        intent: { name: null, confidence: 0 },
        entities: [],
        error: error.message
      };
    }
  }

  // ==================== SYSTEM ENTITIES ====================

  /**
   * Create system (built-in) entities for a bot
   * @param {number} botId - Bot ID
   * @returns {Promise<array>} - Created system entities
   */
  async createSystemEntities(botId) {
    const systemEntities = [
      { name: 'sys_date', displayName: 'Tarix', type: 'date' },
      { name: 'sys_time', displayName: 'Vaxt', type: 'time' },
      { name: 'sys_number', displayName: 'Rəqəm', type: 'number' },
      { name: 'sys_email', displayName: 'Email', type: 'regex' },
      { name: 'sys_phone', displayName: 'Telefon', type: 'regex' },
      { name: 'sys_url', displayName: 'URL', type: 'regex' }
    ];

    const createdEntities = [];

    for (const entity of systemEntities) {
      // Check if already exists
      const existing = await db.query(
        `SELECT id FROM entities WHERE bot_id = $1 AND name = $2`,
        [botId, entity.name]
      );

      if (existing.rows.length === 0) {
        const result = await db.query(
          `INSERT INTO entities (bot_id, name, display_name, type, is_system)
           VALUES ($1, $2, $3, $4, true)
           RETURNING *`,
          [botId, entity.name, entity.displayName, entity.type]
        );
        createdEntities.push(result.rows[0]);
      }
    }

    return createdEntities;
  }
}

module.exports = IntentEntityManager;
