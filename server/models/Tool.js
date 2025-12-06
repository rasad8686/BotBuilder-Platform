/**
 * Tool Model - Database operations for tools
 */

const db = require('../db');

const Tool = {
  /**
   * Create a new tool
   */
  async create(toolData) {
    const result = await db.query(
      `INSERT INTO tools (bot_id, name, description, tool_type, configuration, input_schema, output_schema, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        toolData.bot_id,
        toolData.name,
        toolData.description || null,
        toolData.tool_type,
        JSON.stringify(toolData.configuration || {}),
        JSON.stringify(toolData.input_schema || null),
        JSON.stringify(toolData.output_schema || null),
        toolData.is_active !== false
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find tool by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM tools WHERE id = $1', [id]);
    return result.rows[0] ? this.parseTool(result.rows[0]) : null;
  },

  /**
   * Find all tools for a bot
   */
  async findByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM tools WHERE bot_id = $1 ORDER BY name ASC',
      [botId]
    );
    return result.rows.map(this.parseTool);
  },

  /**
   * Find active tools for a bot
   */
  async findActiveByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM tools WHERE bot_id = $1 AND is_active = true ORDER BY name ASC',
      [botId]
    );
    return result.rows.map(this.parseTool);
  },

  /**
   * Find tools by type
   */
  async findByType(botId, toolType) {
    const result = await db.query(
      'SELECT * FROM tools WHERE bot_id = $1 AND tool_type = $2 AND is_active = true ORDER BY name ASC',
      [botId, toolType]
    );
    return result.rows.map(this.parseTool);
  },

  /**
   * Update a tool
   */
  async update(id, toolData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (toolData.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(toolData.name); }
    if (toolData.description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(toolData.description); }
    if (toolData.tool_type !== undefined) { fields.push(`tool_type = $${paramIndex++}`); values.push(toolData.tool_type); }
    if (toolData.configuration !== undefined) { fields.push(`configuration = $${paramIndex++}`); values.push(JSON.stringify(toolData.configuration)); }
    if (toolData.input_schema !== undefined) { fields.push(`input_schema = $${paramIndex++}`); values.push(JSON.stringify(toolData.input_schema)); }
    if (toolData.output_schema !== undefined) { fields.push(`output_schema = $${paramIndex++}`); values.push(JSON.stringify(toolData.output_schema)); }
    if (toolData.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(toolData.is_active); }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await db.query(
      `UPDATE tools SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete a tool
   */
  async delete(id) {
    await db.query('DELETE FROM tools WHERE id = $1', [id]);
  },

  /**
   * Parse tool from database
   */
  parseTool(tool) {
    return {
      ...tool,
      configuration: typeof tool.configuration === 'string'
        ? JSON.parse(tool.configuration)
        : tool.configuration || {},
      input_schema: typeof tool.input_schema === 'string'
        ? JSON.parse(tool.input_schema)
        : tool.input_schema,
      output_schema: typeof tool.output_schema === 'string'
        ? JSON.parse(tool.output_schema)
        : tool.output_schema
    };
  }
};

module.exports = Tool;
