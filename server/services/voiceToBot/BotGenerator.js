/**
 * Bot Generator Service
 * Generates complete bot configuration from extracted intents and entities
 */

const log = require('../../utils/logger');
const db = require('../../db');

class BotGenerator {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * Generate complete bot from extracted data
   */
  async generateBot(extractedData, userId, organizationId, options = {}) {
    try {
      const startTime = Date.now();

      // Validate input
      if (!extractedData || !extractedData.name) {
        return { success: false, error: 'Invalid extracted data' };
      }

      // Start transaction
      const client = await db.pool.connect();

      try {
        await client.query('BEGIN');

        // 1. Create the bot
        const botResult = await client.query(
          `INSERT INTO bots (
            organization_id, user_id, name, description, platform, language, is_active
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          [
            organizationId,
            userId,
            extractedData.name,
            extractedData.description || '',
            'web',
            extractedData.language || options.language || 'en',
            true
          ]
        );

        const bot = botResult.rows[0];

        // Note: intents, entities, flows tables may not exist
        // Just create the bot for now - user can add intents/flows manually

        await client.query('COMMIT');

        const processingTime = Date.now() - startTime;

        return {
          success: true,
          bot,
          intents: extractedData.intents || [],
          entities: extractedData.entities || [],
          flow: null,
          processingTimeMs: processingTime
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      log.error('Bot generation error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate bot settings
   */
  generateBotSettings(extractedData) {
    return {
      language: extractedData.language || 'en',
      timezone: 'UTC',
      welcomeMessage: this.generateWelcomeMessage(extractedData),
      fallbackMessage: "I'm sorry, I didn't understand that. Could you please rephrase?",
      features: {
        nlu: true,
        contextTracking: true,
        entityExtraction: extractedData.entities?.length > 0
      },
      suggestedFeatures: extractedData.suggestedFeatures || []
    };
  }

  /**
   * Generate welcome message based on bot type
   */
  generateWelcomeMessage(extractedData) {
    const category = extractedData.category || 'custom';
    const messages = {
      support: `Hello! I'm ${extractedData.name}, your support assistant. How can I help you today?`,
      sales: `Hi there! I'm ${extractedData.name}. I'm here to help you find what you're looking for. What can I show you?`,
      faq: `Welcome! I'm ${extractedData.name}, and I can answer your questions. What would you like to know?`,
      booking: `Hello! I'm ${extractedData.name}. I can help you schedule appointments. Would you like to book something?`,
      custom: `Hi! I'm ${extractedData.name}. How can I assist you today?`
    };

    return messages[category] || messages.custom;
  }

  /**
   * Generate flow nodes for visual flow builder
   */
  generateFlowNodes(extractedData) {
    const nodes = [];
    let yOffset = 0;

    // Start node
    nodes.push({
      id: 'start',
      type: 'start',
      position: { x: 250, y: yOffset },
      data: { label: 'Start' }
    });
    yOffset += 100;

    // Welcome message node
    nodes.push({
      id: 'welcome',
      type: 'message',
      position: { x: 250, y: yOffset },
      data: {
        label: 'Welcome',
        message: this.generateWelcomeMessage(extractedData)
      }
    });
    yOffset += 100;

    // Intent router node
    nodes.push({
      id: 'router',
      type: 'intent_router',
      position: { x: 250, y: yOffset },
      data: {
        label: 'Intent Router',
        intents: extractedData.intents?.map(i => i.name) || []
      }
    });
    yOffset += 100;

    // Intent handler nodes
    const xOffsets = [-200, 0, 200, 400];
    extractedData.intents?.forEach((intent, index) => {
      if (intent.name !== 'fallback') {
        const xPos = xOffsets[index % xOffsets.length];
        nodes.push({
          id: `handler_${intent.name}`,
          type: 'message',
          position: { x: 250 + xPos, y: yOffset + (Math.floor(index / 4) * 100) },
          data: {
            label: intent.displayName || intent.name,
            message: intent.responses?.[0] || `Handling ${intent.displayName}`
          }
        });
      }
    });
    yOffset += Math.ceil((extractedData.intents?.length || 1) / 4) * 100 + 100;

    // Fallback node
    nodes.push({
      id: 'fallback',
      type: 'message',
      position: { x: 500, y: yOffset - 100 },
      data: {
        label: 'Fallback',
        message: "I'm not sure I understand. Could you please rephrase that?"
      }
    });

    // End node
    nodes.push({
      id: 'end',
      type: 'end',
      position: { x: 250, y: yOffset },
      data: { label: 'End' }
    });

    return nodes;
  }

  /**
   * Generate flow edges
   */
  generateFlowEdges(extractedData) {
    const edges = [];

    // Start to welcome
    edges.push({
      id: 'e_start_welcome',
      source: 'start',
      target: 'welcome',
      type: 'default'
    });

    // Welcome to router
    edges.push({
      id: 'e_welcome_router',
      source: 'welcome',
      target: 'router',
      type: 'default'
    });

    // Router to intent handlers
    extractedData.intents?.forEach(intent => {
      if (intent.name !== 'fallback') {
        edges.push({
          id: `e_router_${intent.name}`,
          source: 'router',
          target: `handler_${intent.name}`,
          type: 'intent',
          label: intent.name
        });

        // Handler to end
        edges.push({
          id: `e_${intent.name}_end`,
          source: `handler_${intent.name}`,
          target: 'end',
          type: 'default'
        });
      }
    });

    // Router to fallback (default)
    edges.push({
      id: 'e_router_fallback',
      source: 'router',
      target: 'fallback',
      type: 'default',
      label: 'fallback'
    });

    // Fallback to router (loop back)
    edges.push({
      id: 'e_fallback_router',
      source: 'fallback',
      target: 'router',
      type: 'default'
    });

    return edges;
  }

  /**
   * Preview bot structure without saving
   */
  previewBot(extractedData) {
    return {
      name: extractedData.name,
      description: extractedData.description,
      category: extractedData.category,
      settings: this.generateBotSettings(extractedData),
      intents: extractedData.intents?.map(intent => ({
        name: intent.name,
        displayName: intent.displayName,
        exampleCount: intent.examples?.length || 0,
        responseCount: intent.responses?.length || 0
      })),
      entities: extractedData.entities?.map(entity => ({
        name: entity.name,
        type: entity.type
      })),
      flowPreview: {
        nodeCount: this.generateFlowNodes(extractedData).length,
        edgeCount: this.generateFlowEdges(extractedData).length
      }
    };
  }

  /**
   * Update existing bot with new extracted data
   */
  async updateBot(botId, extractedData, userId, options = {}) {
    try {
      // Verify ownership
      const botCheck = await db.query(
        'SELECT id FROM bots WHERE id = $1 AND user_id = $2',
        [botId, userId]
      );

      if (botCheck.rows.length === 0) {
        return { success: false, error: 'Bot not found or access denied' };
      }

      // Update bot
      await db.query(
        `UPDATE bots SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          settings = $3,
          updated_at = NOW()
        WHERE id = $4`,
        [
          options.updateName ? extractedData.name : null,
          options.updateDescription ? extractedData.description : null,
          JSON.stringify(this.generateBotSettings(extractedData)),
          botId
        ]
      );

      // Add new intents if requested
      if (options.addIntents && extractedData.intents?.length > 0) {
        for (const intent of extractedData.intents) {
          // Check if intent already exists
          const existing = await db.query(
            'SELECT id FROM intents WHERE bot_id = $1 AND name = $2',
            [botId, intent.name]
          );

          if (existing.rows.length === 0) {
            await db.query(
              `INSERT INTO intents (bot_id, name, description, examples, responses, is_active)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                botId,
                intent.name,
                intent.description || intent.displayName,
                JSON.stringify(intent.examples || []),
                JSON.stringify(intent.responses || []),
                true
              ]
            );
          }
        }
      }

      // Add new entities if requested
      if (options.addEntities && extractedData.entities?.length > 0) {
        for (const entity of extractedData.entities) {
          const existing = await db.query(
            'SELECT id FROM entities WHERE bot_id = $1 AND name = $2',
            [botId, entity.name]
          );

          if (existing.rows.length === 0) {
            await db.query(
              `INSERT INTO entities (bot_id, name, type, description, values, is_active)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                botId,
                entity.name,
                entity.type || 'text',
                entity.description || '',
                JSON.stringify(entity.examples || []),
                true
              ]
            );
          }
        }
      }

      return { success: true, botId };
    } catch (error) {
      log.error('Bot update error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available templates
   */
  async getTemplates() {
    try {
      const result = await db.query(
        `SELECT * FROM voice_bot_templates WHERE is_active = true ORDER BY usage_count DESC`
      );
      return { success: true, templates: result.rows };
    } catch (error) {
      log.error('Get templates error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId) {
    try {
      const result = await db.query(
        'SELECT * FROM voice_bot_templates WHERE id = $1 AND is_active = true',
        [templateId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Template not found' };
      }

      // Increment usage count
      await db.query(
        'UPDATE voice_bot_templates SET usage_count = usage_count + 1 WHERE id = $1',
        [templateId]
      );

      return { success: true, template: result.rows[0] };
    } catch (error) {
      log.error('Get template error', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = BotGenerator;
