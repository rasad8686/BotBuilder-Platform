/**
 * Agent Model - Database operations for agents
 */

const db = require('../db');

const Agent = {
  /**
   * Create a new agent
   */
  async create(agentData) {
    const result = await db.query(
      `INSERT INTO agents (bot_id, name, role, system_prompt, model_provider, model_name, temperature, max_tokens, capabilities, tools, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING id`,
      [
        agentData.bot_id,
        agentData.name,
        agentData.role,
        agentData.system_prompt,
        agentData.model_provider || 'openai',
        agentData.model_name || 'gpt-4',
        agentData.temperature ?? 0.7,
        agentData.max_tokens || 2048,
        JSON.stringify(agentData.capabilities || []),
        JSON.stringify(agentData.tools || []),
        agentData.is_active !== false
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find agent by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM agents WHERE id = $1', [id]);
    return result.rows[0] ? this.parseAgent(result.rows[0]) : null;
  },

  /**
   * Find all agents for a bot
   */
  async findByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM agents WHERE bot_id = $1 ORDER BY created_at ASC',
      [botId]
    );
    return result.rows.map(this.parseAgent);
  },

  /**
   * Find all agents for a tenant (via bots)
   */
  async findByTenant(tenantId) {
    const result = await db.query(
      `SELECT a.* FROM agents a
       JOIN bots b ON a.bot_id = b.id
       WHERE b.organization_id = $1
       ORDER BY a.created_at DESC`,
      [tenantId]
    );
    return result.rows.map(this.parseAgent);
  },

  /**
   * Find active agents for a bot
   */
  async findActiveByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM agents WHERE bot_id = $1 AND is_active = true ORDER BY created_at ASC',
      [botId]
    );
    return result.rows.map(this.parseAgent);
  },

  /**
   * Find agents by role
   */
  async findByRole(botId, role) {
    const result = await db.query(
      'SELECT * FROM agents WHERE bot_id = $1 AND role = $2 AND is_active = true ORDER BY created_at ASC',
      [botId, role]
    );
    return result.rows.map(this.parseAgent);
  },

  /**
   * Update an agent
   */
  async update(id, agentData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (agentData.name !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(agentData.name); }
    if (agentData.role !== undefined) { fields.push(`role = $${paramIndex++}`); values.push(agentData.role); }
    if (agentData.system_prompt !== undefined) { fields.push(`system_prompt = $${paramIndex++}`); values.push(agentData.system_prompt); }
    if (agentData.model_provider !== undefined) { fields.push(`model_provider = $${paramIndex++}`); values.push(agentData.model_provider); }
    if (agentData.model_name !== undefined) { fields.push(`model_name = $${paramIndex++}`); values.push(agentData.model_name); }
    if (agentData.temperature !== undefined) { fields.push(`temperature = $${paramIndex++}`); values.push(agentData.temperature); }
    if (agentData.max_tokens !== undefined) { fields.push(`max_tokens = $${paramIndex++}`); values.push(agentData.max_tokens); }
    if (agentData.capabilities !== undefined) { fields.push(`capabilities = $${paramIndex++}`); values.push(JSON.stringify(agentData.capabilities)); }
    if (agentData.tools !== undefined) { fields.push(`tools = $${paramIndex++}`); values.push(JSON.stringify(agentData.tools)); }
    if (agentData.is_active !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(agentData.is_active); }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await db.query(
      `UPDATE agents SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete an agent
   */
  async delete(id) {
    await db.query('DELETE FROM agents WHERE id = $1', [id]);
  },

  /**
   * Parse agent from database
   */
  parseAgent(agent) {
    return {
      ...agent,
      capabilities: typeof agent.capabilities === 'string'
        ? JSON.parse(agent.capabilities)
        : agent.capabilities || [],
      tools: typeof agent.tools === 'string'
        ? JSON.parse(agent.tools)
        : agent.tools || []
    };
  }
};

module.exports = Agent;
