/**
 * Tool Registry - Manages tool registration and retrieval
 */

const db = require('../../db');

class ToolRegistry {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Register a new tool
   * @param {Object} tool - Tool configuration
   * @returns {Object} - Created tool
   */
  async register(tool) {
    const result = await db.query(
      `INSERT INTO tools (bot_id, name, description, tool_type, configuration, input_schema, output_schema, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        tool.bot_id,
        tool.name,
        tool.description || null,
        tool.tool_type,
        JSON.stringify(tool.configuration || {}),
        JSON.stringify(tool.input_schema || null),
        JSON.stringify(tool.output_schema || null),
        tool.is_active !== false
      ]
    );

    const createdTool = this.parseTool(result.rows[0]);
    this.cache.set(createdTool.id, createdTool);
    return createdTool;
  }

  /**
   * Get tool by ID
   * @param {number} toolId - Tool ID
   * @returns {Object|null} - Tool or null
   */
  async get(toolId) {
    if (this.cache.has(toolId)) {
      return this.cache.get(toolId);
    }

    const result = await db.query('SELECT * FROM tools WHERE id = $1', [toolId]);
    if (result.rows[0]) {
      const tool = this.parseTool(result.rows[0]);
      this.cache.set(toolId, tool);
      return tool;
    }
    return null;
  }

  /**
   * Get all tools for a bot
   * @param {number} botId - Bot ID
   * @returns {Array} - Array of tools
   */
  async getByBot(botId) {
    const result = await db.query(
      'SELECT * FROM tools WHERE bot_id = $1 AND is_active = true ORDER BY name ASC',
      [botId]
    );
    return result.rows.map(row => this.parseTool(row));
  }

  /**
   * Get all tools assigned to an agent
   * @param {number} agentId - Agent ID
   * @returns {Array} - Array of tools with assignment info
   */
  async getByAgent(agentId) {
    const result = await db.query(
      `SELECT t.*, at.is_enabled, at.priority
       FROM tools t
       INNER JOIN agent_tools at ON t.id = at.tool_id
       WHERE at.agent_id = $1 AND t.is_active = true AND at.is_enabled = true
       ORDER BY at.priority DESC, t.name ASC`,
      [agentId]
    );
    return result.rows.map(row => ({
      ...this.parseTool(row),
      is_enabled: row.is_enabled,
      priority: row.priority
    }));
  }

  /**
   * Update a tool
   * @param {number} toolId - Tool ID
   * @param {Object} updates - Fields to update
   * @returns {Object} - Updated tool
   */
  async update(toolId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(updates.name); }
    if (updates.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(updates.description); }
    if (updates.tool_type !== undefined) { fields.push(`tool_type = $${paramIndex++}`); values.push(updates.tool_type); }
    if (updates.configuration !== undefined) { fields.push(`configuration = $${paramIndex++}`); values.push(JSON.stringify(updates.configuration)); }
    if (updates.input_schema !== undefined) { fields.push(`input_schema = $${paramIndex++}`); values.push(JSON.stringify(updates.input_schema)); }
    if (updates.output_schema !== undefined) { fields.push(`output_schema = $${paramIndex++}`); values.push(JSON.stringify(updates.output_schema)); }
    if (updates.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(updates.is_active); }

    fields.push(`updated_at = NOW()`);
    values.push(toolId);

    await db.query(
      `UPDATE tools SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    this.cache.delete(toolId);
    return this.get(toolId);
  }

  /**
   * Delete a tool
   * @param {number} toolId - Tool ID
   */
  async delete(toolId) {
    await db.query('DELETE FROM tools WHERE id = $1', [toolId]);
    this.cache.delete(toolId);
  }

  /**
   * Assign tool to agent
   * @param {number} agentId - Agent ID
   * @param {number} toolId - Tool ID
   * @param {Object} options - Assignment options
   * @returns {Object} - Assignment record
   */
  async assignToAgent(agentId, toolId, options = {}) {
    const result = await db.query(
      `INSERT INTO agent_tools (agent_id, tool_id, is_enabled, priority)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (agent_id, tool_id) DO UPDATE SET is_enabled = $3, priority = $4
       RETURNING *`,
      [agentId, toolId, options.is_enabled !== false, options.priority || 0]
    );
    return result.rows[0];
  }

  /**
   * Remove tool from agent
   * @param {number} agentId - Agent ID
   * @param {number} toolId - Tool ID
   */
  async removeFromAgent(agentId, toolId) {
    await db.query(
      'DELETE FROM agent_tools WHERE agent_id = $1 AND tool_id = $2',
      [agentId, toolId]
    );
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Parse tool from database row
   * @param {Object} row - Database row
   * @returns {Object} - Parsed tool
   */
  parseTool(row) {
    return {
      ...row,
      configuration: typeof row.configuration === 'string'
        ? JSON.parse(row.configuration)
        : row.configuration || {},
      input_schema: typeof row.input_schema === 'string'
        ? JSON.parse(row.input_schema)
        : row.input_schema,
      output_schema: typeof row.output_schema === 'string'
        ? JSON.parse(row.output_schema)
        : row.output_schema
    };
  }
}

module.exports = ToolRegistry;
