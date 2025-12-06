/**
 * ToolExecution Model - Database operations for tool execution history
 */

const db = require('../db');

const ToolExecution = {
  /**
   * Create a new execution record
   */
  async create(executionData) {
    const result = await db.query(
      `INSERT INTO tool_executions (tool_id, agent_id, execution_id, input, output, status, error, duration_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING id`,
      [
        executionData.tool_id,
        executionData.agent_id || null,
        executionData.execution_id || null,
        JSON.stringify(executionData.input || {}),
        JSON.stringify(executionData.output || null),
        executionData.status || 'pending',
        executionData.error || null,
        executionData.duration_ms || null
      ]
    );
    return this.findById(result.rows[0].id);
  },

  /**
   * Find execution by ID
   */
  async findById(id) {
    const result = await db.query('SELECT * FROM tool_executions WHERE id = $1', [id]);
    return result.rows[0] ? this.parseExecution(result.rows[0]) : null;
  },

  /**
   * Find all executions for a tool
   */
  async findByToolId(toolId, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT te.*, t.name as tool_name, t.tool_type
       FROM tool_executions te
       INNER JOIN tools t ON te.tool_id = t.id
       WHERE te.tool_id = $1
       ORDER BY te.created_at DESC
       LIMIT $2 OFFSET $3`,
      [toolId, limit, offset]
    );
    return result.rows.map(this.parseExecution);
  },

  /**
   * Find all executions for an agent
   */
  async findByAgentId(agentId, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT te.*, t.name as tool_name, t.tool_type
       FROM tool_executions te
       INNER JOIN tools t ON te.tool_id = t.id
       WHERE te.agent_id = $1
       ORDER BY te.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );
    return result.rows.map(this.parseExecution);
  },

  /**
   * Find all executions for a workflow execution
   */
  async findByExecutionId(executionId, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT te.*, t.name as tool_name, t.tool_type
       FROM tool_executions te
       INNER JOIN tools t ON te.tool_id = t.id
       WHERE te.execution_id = $1
       ORDER BY te.created_at ASC
       LIMIT $2 OFFSET $3`,
      [executionId, limit, offset]
    );
    return result.rows.map(this.parseExecution);
  },

  /**
   * Find executions by status
   */
  async findByStatus(status, options = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const result = await db.query(
      `SELECT te.*, t.name as tool_name, t.tool_type
       FROM tool_executions te
       INNER JOIN tools t ON te.tool_id = t.id
       WHERE te.status = $1
       ORDER BY te.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    return result.rows.map(this.parseExecution);
  },

  /**
   * Update execution status
   */
  async updateStatus(id, status, additionalData = {}) {
    const fields = ['status = $1'];
    const values = [status];
    let paramIndex = 2;

    if (additionalData.output !== undefined) {
      fields.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(additionalData.output));
    }
    if (additionalData.error !== undefined) {
      fields.push(`error = $${paramIndex++}`);
      values.push(additionalData.error);
    }
    if (additionalData.duration_ms !== undefined) {
      fields.push(`duration_ms = $${paramIndex++}`);
      values.push(additionalData.duration_ms);
    }

    values.push(id);

    await db.query(
      `UPDATE tool_executions SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Delete an execution record
   */
  async delete(id) {
    await db.query('DELETE FROM tool_executions WHERE id = $1', [id]);
  },

  /**
   * Delete old executions
   */
  async deleteOlderThan(days) {
    const result = await db.query(
      `DELETE FROM tool_executions WHERE created_at < NOW() - INTERVAL '${days} days' RETURNING id`
    );
    return result.rowCount;
  },

  /**
   * Get execution statistics for a tool
   */
  async getStatsByToolId(toolId, options = {}) {
    const days = options.days || 30;

    const result = await db.query(
      `SELECT
         COUNT(*) as total_executions,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         AVG(duration_ms) as avg_duration_ms,
         MIN(duration_ms) as min_duration_ms,
         MAX(duration_ms) as max_duration_ms
       FROM tool_executions
       WHERE tool_id = $1 AND created_at > NOW() - INTERVAL '${days} days'`,
      [toolId]
    );
    return result.rows[0];
  },

  /**
   * Get execution statistics for an agent
   */
  async getStatsByAgentId(agentId, options = {}) {
    const days = options.days || 30;

    const result = await db.query(
      `SELECT
         COUNT(*) as total_executions,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         AVG(duration_ms) as avg_duration_ms
       FROM tool_executions
       WHERE agent_id = $1 AND created_at > NOW() - INTERVAL '${days} days'`,
      [agentId]
    );
    return result.rows[0];
  },

  /**
   * Parse execution from database
   */
  parseExecution(execution) {
    return {
      ...execution,
      input: typeof execution.input === 'string'
        ? JSON.parse(execution.input)
        : execution.input || {},
      output: typeof execution.output === 'string'
        ? JSON.parse(execution.output)
        : execution.output
    };
  }
};

module.exports = ToolExecution;
