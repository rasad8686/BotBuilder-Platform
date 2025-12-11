/**
 * Agent Core - Core functionality for Autonomous Agents
 * Handles agent CRUD operations and basic agent management
 */

const db = require('../../db');
const log = require('../../utils/logger');

class AgentCore {
  /**
   * Create a new autonomous agent
   */
  static async create(userId, agentData) {
    const {
      name,
      description,
      capabilities = [],
      model = 'gpt-4',
      temperature = 0.7,
      max_tokens = 4096,
      system_prompt,
      settings = {}
    } = agentData;

    if (!name) {
      throw new Error('Agent name is required');
    }

    const result = await db.query(
      `INSERT INTO autonomous_agents
       (user_id, name, description, capabilities, model, temperature, max_tokens, system_prompt, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        name,
        description,
        JSON.stringify(capabilities),
        model,
        temperature,
        max_tokens,
        system_prompt || AgentCore.getDefaultSystemPrompt(),
        JSON.stringify(settings)
      ]
    );

    log.info('AgentCore: Agent created', { agentId: result.rows[0].id, userId });
    return AgentCore.parseAgent(result.rows[0]);
  }

  /**
   * Get default system prompt for agents
   */
  static getDefaultSystemPrompt() {
    return `You are an autonomous AI agent capable of breaking down tasks into steps and executing them.

Your capabilities:
1. THINK - Analyze the task and plan your approach
2. PLAN - Create a step-by-step execution plan
3. EXECUTE - Carry out each step using available tools
4. VERIFY - Check results and adjust if needed
5. COMPLETE - Summarize findings and provide final output

Guidelines:
- Break complex tasks into smaller, manageable steps
- Use available tools when appropriate
- Explain your reasoning at each step
- If you encounter an error, try alternative approaches
- Always provide clear, structured output`;
  }

  /**
   * Find agent by ID
   */
  static async findById(agentId) {
    const result = await db.query(
      `SELECT * FROM autonomous_agents WHERE id = $1`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return AgentCore.parseAgent(result.rows[0]);
  }

  /**
   * Find all agents for a user
   */
  static async findByUser(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = `SELECT * FROM autonomous_agents WHERE user_id = $1`;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows.map(AgentCore.parseAgent);
  }

  /**
   * Update an agent
   */
  static async update(agentId, userId, updateData) {
    const allowedFields = [
      'name', 'description', 'capabilities', 'model',
      'temperature', 'max_tokens', 'system_prompt', 'settings', 'status'
    ];

    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(key === 'capabilities' || key === 'settings' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(agentId, userId);

    const result = await db.query(
      `UPDATE autonomous_agents
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Agent not found or access denied');
    }

    log.info('AgentCore: Agent updated', { agentId });
    return AgentCore.parseAgent(result.rows[0]);
  }

  /**
   * Delete an agent
   */
  static async delete(agentId, userId) {
    const result = await db.query(
      `DELETE FROM autonomous_agents WHERE id = $1 AND user_id = $2 RETURNING id`,
      [agentId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Agent not found or access denied');
    }

    log.info('AgentCore: Agent deleted', { agentId });
    return true;
  }

  /**
   * Update agent statistics
   */
  static async updateStats(agentId, success) {
    const field = success ? 'successful_tasks' : 'failed_tasks';

    await db.query(
      `UPDATE autonomous_agents
       SET total_tasks = total_tasks + 1, ${field} = ${field} + 1
       WHERE id = $1`,
      [agentId]
    );
  }

  /**
   * Get agent statistics
   */
  static async getStats(agentId) {
    const result = await db.query(
      `SELECT
        total_tasks,
        successful_tasks,
        failed_tasks,
        CASE WHEN total_tasks > 0
          THEN ROUND((successful_tasks::decimal / total_tasks) * 100, 2)
          ELSE 0
        END as success_rate
       FROM autonomous_agents WHERE id = $1`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Parse agent row from database
   */
  static parseAgent(row) {
    if (!row) return null;

    return {
      ...row,
      capabilities: typeof row.capabilities === 'string'
        ? JSON.parse(row.capabilities)
        : row.capabilities || [],
      settings: typeof row.settings === 'string'
        ? JSON.parse(row.settings)
        : row.settings || {}
    };
  }

  /**
   * Validate agent ownership
   */
  static async validateOwnership(agentId, userId) {
    const result = await db.query(
      `SELECT id FROM autonomous_agents WHERE id = $1 AND user_id = $2`,
      [agentId, userId]
    );
    return result.rows.length > 0;
  }
}

module.exports = AgentCore;
