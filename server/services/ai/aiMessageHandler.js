const db = require('../../db');

/**
 * AI Message Handler
 * Manages conversation context and message formatting
 */
class AIMessageHandler {
  /**
   * Build messages array with context from conversation history
   * @param {Object} params - Parameters
   * @param {number} params.botId - Bot ID
   * @param {string} params.sessionId - Session identifier
   * @param {string} params.userMessage - Current user message
   * @param {string} params.systemPrompt - System prompt
   * @param {number} params.contextWindow - Number of previous messages to include
   * @returns {Promise<Array>} Messages array for AI API
   */
  static async buildMessagesWithContext(params) {
    const {
      botId,
      sessionId,
      userMessage,
      systemPrompt = 'You are a helpful assistant.',
      contextWindow = 10
    } = params;

    const messages = [];

    // Add system message
    messages.push({
      role: 'system',
      content: systemPrompt
    });

    // Get conversation history if context window > 0
    if (contextWindow > 0 && sessionId) {
      try {
        const historyQuery = `
          SELECT role, content, created_at
          FROM ai_conversations
          WHERE bot_id = $1 AND session_id = $2
          ORDER BY created_at DESC
          LIMIT $3
        `;

        const historyResult = await db.query(historyQuery, [
          botId,
          sessionId,
          contextWindow
        ]);

        // Add history in chronological order (oldest first)
        const history = historyResult.rows.reverse();

        for (const msg of history) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      } catch (error) {
        console.error('Error fetching conversation history:', error);
        // Continue without history
      }
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: userMessage
    });

    return messages;
  }

  /**
   * Save message to conversation history
   * @param {Object} params - Parameters
   * @param {number} params.botId - Bot ID
   * @param {string} params.sessionId - Session identifier
   * @param {string} params.role - Message role ('user' or 'assistant')
   * @param {string} params.content - Message content
   * @returns {Promise<Object>} Saved message
   */
  static async saveMessage(params) {
    const { botId, sessionId, role, content } = params;

    if (!botId || !sessionId || !role || !content) {
      throw new Error('botId, sessionId, role, and content are required');
    }

    try {
      const query = `
        INSERT INTO ai_conversations (bot_id, session_id, role, content, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, bot_id, session_id, role, content, created_at
      `;

      const result = await db.query(query, [botId, sessionId, role, content]);

      return result.rows[0];
    } catch (error) {
      console.error('Error saving message to conversation history:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history for a session
   * @param {number} botId - Bot ID
   * @param {string} sessionId - Session identifier
   * @returns {Promise<number>} Number of deleted messages
   */
  static async clearConversation(botId, sessionId) {
    try {
      const query = `
        DELETE FROM ai_conversations
        WHERE bot_id = $1 AND session_id = $2
      `;

      const result = await db.query(query, [botId, sessionId]);

      return result.rowCount;
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      throw error;
    }
  }

  /**
   * Get conversation history
   * @param {number} botId - Bot ID
   * @param {string} sessionId - Session identifier
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Promise<Array>} Conversation history
   */
  static async getConversationHistory(botId, sessionId, limit = 50) {
    try {
      const query = `
        SELECT id, role, content, created_at
        FROM ai_conversations
        WHERE bot_id = $1 AND session_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `;

      const result = await db.query(query, [botId, sessionId, limit]);

      // Return in chronological order (oldest first)
      return result.rows.reverse();
    } catch (error) {
      console.error('Error getting conversation history:', error);
      throw error;
    }
  }

  /**
   * Clean up old conversations (for maintenance)
   * @param {number} daysOld - Delete conversations older than X days
   * @returns {Promise<number>} Number of deleted conversations
   */
  static async cleanupOldConversations(daysOld = 30) {
    try {
      const query = `
        DELETE FROM ai_conversations
        WHERE created_at < NOW() - INTERVAL '${daysOld} days'
      `;

      const result = await db.query(query);

      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old conversations:', error);
      throw error;
    }
  }

  /**
   * Get conversation statistics
   * @param {number} botId - Bot ID
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<Object>} Statistics
   */
  static async getConversationStats(botId, sessionId = null) {
    try {
      let query, params;

      if (sessionId) {
        query = `
          SELECT
            COUNT(*) as total_messages,
            COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
            COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages,
            MIN(created_at) as first_message,
            MAX(created_at) as last_message
          FROM ai_conversations
          WHERE bot_id = $1 AND session_id = $2
        `;
        params = [botId, sessionId];
      } else {
        query = `
          SELECT
            COUNT(*) as total_messages,
            COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
            COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages,
            COUNT(DISTINCT session_id) as unique_sessions,
            MIN(created_at) as first_message,
            MAX(created_at) as last_message
          FROM ai_conversations
          WHERE bot_id = $1
        `;
        params = [botId];
      }

      const result = await db.query(query, params);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  /**
   * Format message for display
   * @param {string} content - Message content
   * @param {number} maxLength - Maximum length (truncate if longer)
   * @returns {string} Formatted message
   */
  static formatMessage(content, maxLength = null) {
    if (!content) return '';

    let formatted = content.trim();

    if (maxLength && formatted.length > maxLength) {
      formatted = formatted.substring(0, maxLength) + '...';
    }

    return formatted;
  }

  /**
   * Validate message content
   * @param {string} content - Message to validate
   * @param {Object} options - Validation options
   * @returns {Object} { valid: boolean, error: string }
   */
  static validateMessage(content, options = {}) {
    const {
      minLength = 1,
      maxLength = 50000,
      allowEmpty = false
    } = options;

    if (!content && !allowEmpty) {
      return { valid: false, error: 'Message content is required' };
    }

    if (content && content.length < minLength) {
      return { valid: false, error: `Message must be at least ${minLength} characters` };
    }

    if (content && content.length > maxLength) {
      return { valid: false, error: `Message cannot exceed ${maxLength} characters` };
    }

    return { valid: true };
  }
}

module.exports = AIMessageHandler;
