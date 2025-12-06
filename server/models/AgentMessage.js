/**
 * AgentMessage Model - Database operations for agent-to-agent messages
 */

const db = require('../db');

const AgentMessage = {
  /**
   * Create a new message
   */
  async create(messageData) {
    const result = await db.query(
      `INSERT INTO agent_messages (execution_id, from_agent_id, to_agent_id, message_type, content, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        messageData.execution_id,
        messageData.from_agent_id,
        messageData.to_agent_id,
        messageData.message_type || 'data',
        JSON.stringify(messageData.content || {}),
        JSON.stringify(messageData.metadata || {})
      ]
    );
    return this.parseMessage(result.rows[0]);
  },

  /**
   * Find message by ID
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM agent_messages WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.parseMessage(result.rows[0]) : null;
  },

  /**
   * Find messages by execution ID
   */
  async findByExecutionId(executionId) {
    const result = await db.query(
      'SELECT * FROM agent_messages WHERE execution_id = $1 ORDER BY timestamp ASC',
      [executionId]
    );
    return result.rows.map(m => this.parseMessage(m));
  },

  /**
   * Find messages from a specific agent
   */
  async findByFromAgentId(executionId, fromAgentId) {
    const result = await db.query(
      'SELECT * FROM agent_messages WHERE execution_id = $1 AND from_agent_id = $2 ORDER BY timestamp ASC',
      [executionId, fromAgentId]
    );
    return result.rows.map(m => this.parseMessage(m));
  },

  /**
   * Find messages to a specific agent
   */
  async findByToAgentId(executionId, toAgentId) {
    const result = await db.query(
      'SELECT * FROM agent_messages WHERE execution_id = $1 AND to_agent_id = $2 ORDER BY timestamp ASC',
      [executionId, toAgentId]
    );
    return result.rows.map(m => this.parseMessage(m));
  },

  /**
   * Find messages by type
   */
  async findByType(executionId, messageType) {
    const result = await db.query(
      'SELECT * FROM agent_messages WHERE execution_id = $1 AND message_type = $2 ORDER BY timestamp ASC',
      [executionId, messageType]
    );
    return result.rows.map(m => this.parseMessage(m));
  },

  /**
   * Delete message
   */
  async delete(id) {
    const result = await db.query(
      'DELETE FROM agent_messages WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  /**
   * Delete all messages for an execution
   */
  async deleteByExecutionId(executionId) {
    const result = await db.query(
      'DELETE FROM agent_messages WHERE execution_id = $1',
      [executionId]
    );
    return result.rowCount;
  },

  /**
   * Get message count for an execution
   */
  async countByExecutionId(executionId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM agent_messages WHERE execution_id = $1',
      [executionId]
    );
    return parseInt(result.rows[0]?.count || 0);
  },

  /**
   * Parse message from database
   */
  parseMessage(message) {
    return {
      ...message,
      content: typeof message.content === 'string'
        ? JSON.parse(message.content)
        : message.content || {},
      metadata: typeof message.metadata === 'string'
        ? JSON.parse(message.metadata)
        : message.metadata || {}
    };
  }
};

module.exports = AgentMessage;
