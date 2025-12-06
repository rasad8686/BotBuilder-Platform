/**
 * AgentTool Model - Database operations for agent-tool relationships
 */

const db = require('../db');

const AgentTool = {
  /**
   * Assign a tool to an agent
   */
  async create(assignmentData) {
    const result = await db.query(
      `INSERT INTO agent_tools (agent_id, tool_id, is_enabled, priority, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (agent_id, tool_id) DO UPDATE SET is_enabled = $3, priority = $4
       RETURNING *`,
      [
        assignmentData.agent_id,
        assignmentData.tool_id,
        assignmentData.is_enabled !== false,
        assignmentData.priority || 0
      ]
    );
    return result.rows[0];
  },

  /**
   * Find assignment by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM agent_tools WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * Find all tool assignments for an agent
   */
  async findByAgentId(agentId) {
    const result = await db.query(
      `SELECT at.*, t.name as tool_name, t.description as tool_description, t.tool_type
       FROM agent_tools at
       INNER JOIN tools t ON at.tool_id = t.id
       WHERE at.agent_id = $1
       ORDER BY at.priority DESC, t.name ASC`,
      [agentId]
    );
    return result.rows;
  },

  /**
   * Find all enabled tool assignments for an agent
   */
  async findEnabledByAgentId(agentId) {
    const result = await db.query(
      `SELECT at.*, t.name as tool_name, t.description as tool_description, t.tool_type
       FROM agent_tools at
       INNER JOIN tools t ON at.tool_id = t.id
       WHERE at.agent_id = $1 AND at.is_enabled = true AND t.is_active = true
       ORDER BY at.priority DESC, t.name ASC`,
      [agentId]
    );
    return result.rows;
  },

  /**
   * Find all agents assigned to a tool
   */
  async findByToolId(toolId) {
    const result = await db.query(
      `SELECT at.*, a.name as agent_name, a.role as agent_role
       FROM agent_tools at
       INNER JOIN agents a ON at.agent_id = a.id
       WHERE at.tool_id = $1
       ORDER BY a.name ASC`,
      [toolId]
    );
    return result.rows;
  },

  /**
   * Check if assignment exists
   */
  async exists(agentId, toolId) {
    const result = await db.query(
      'SELECT id FROM agent_tools WHERE agent_id = $1 AND tool_id = $2',
      [agentId, toolId]
    );
    return result.rows.length > 0;
  },

  /**
   * Update an assignment
   */
  async update(id, assignmentData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (assignmentData.is_enabled !== undefined) { fields.push(`is_enabled = $${paramIndex++}`); values.push(assignmentData.is_enabled); }
    if (assignmentData.priority !== undefined) { fields.push(`priority = $${paramIndex++}`); values.push(assignmentData.priority); }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    await db.query(
      `UPDATE agent_tools SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete an assignment
   */
  async delete(id) {
    await db.query('DELETE FROM agent_tools WHERE id = $1', [id]);
  },

  /**
   * Delete assignment by agent and tool
   */
  async deleteByAgentAndTool(agentId, toolId) {
    await db.query(
      'DELETE FROM agent_tools WHERE agent_id = $1 AND tool_id = $2',
      [agentId, toolId]
    );
  },

  /**
   * Delete all assignments for an agent
   */
  async deleteByAgentId(agentId) {
    await db.query('DELETE FROM agent_tools WHERE agent_id = $1', [agentId]);
  },

  /**
   * Delete all assignments for a tool
   */
  async deleteByToolId(toolId) {
    await db.query('DELETE FROM agent_tools WHERE tool_id = $1', [toolId]);
  },

  /**
   * Bulk assign tools to an agent
   */
  async bulkAssign(agentId, toolIds, options = {}) {
    const results = [];
    for (const toolId of toolIds) {
      const result = await this.create({
        agent_id: agentId,
        tool_id: toolId,
        is_enabled: options.is_enabled !== false,
        priority: options.priority || 0
      });
      results.push(result);
    }
    return results;
  }
};

module.exports = AgentTool;
