/**
 * WorkflowExecution Model - Database operations for workflow executions
 */

const db = require('../db');

const WorkflowExecution = {
  /**
   * Create a new execution
   */
  async create(executionData) {
    const result = await db.query(
      `INSERT INTO workflow_executions (workflow_id, bot_id, status, input, output, total_tokens, total_cost, duration_ms, error, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        executionData.workflow_id,
        executionData.bot_id,
        executionData.status || 'pending',
        JSON.stringify(executionData.input || {}),
        JSON.stringify(executionData.output || {}),
        executionData.total_tokens || 0,
        executionData.total_cost || 0,
        executionData.duration_ms || 0,
        executionData.error || null
      ]
    );
    return this.parseExecution(result.rows[0]);
  },

  /**
   * Find execution by ID
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM workflow_executions WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.parseExecution(result.rows[0]) : null;
  },

  /**
   * Find executions by workflow ID
   */
  async findByWorkflowId(workflowId, limit = 50) {
    const result = await db.query(
      'SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT $2',
      [workflowId, limit]
    );
    return result.rows.map(e => this.parseExecution(e));
  },

  /**
   * Find executions by bot ID with optional filters
   */
  async findByBotId(botId, filters = {}) {
    const { workflow_id, status, start_date, end_date, limit = 50 } = filters;

    let query = 'SELECT * FROM workflow_executions WHERE bot_id = $1';
    const params = [botId];
    let paramIndex = 2;

    if (workflow_id) {
      query += ` AND workflow_id = $${paramIndex++}`;
      params.push(workflow_id);
    }
    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }
    if (start_date) {
      query += ` AND created_at >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await db.query(query, params);
    return result.rows.map(e => this.parseExecution(e));
  },

  /**
   * Update execution
   */
  async update(id, executionData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (executionData.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(executionData.status);
    }
    if (executionData.output !== undefined) {
      fields.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(executionData.output));
    }
    if (executionData.total_tokens !== undefined) {
      fields.push(`total_tokens = $${paramIndex++}`);
      values.push(executionData.total_tokens);
    }
    if (executionData.total_cost !== undefined) {
      fields.push(`total_cost = $${paramIndex++}`);
      values.push(executionData.total_cost);
    }
    if (executionData.duration_ms !== undefined) {
      fields.push(`duration_ms = $${paramIndex++}`);
      values.push(executionData.duration_ms);
    }
    if (executionData.error !== undefined) {
      fields.push(`error = $${paramIndex++}`);
      values.push(executionData.error);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await db.query(
      `UPDATE workflow_executions SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Mark execution as completed
   */
  async complete(id, output, totalTokens, durationMs) {
    // Ensure output is an object for JSON storage
    const outputObj = typeof output === 'string' ? { result: output } : output;
    return this.update(id, {
      status: 'completed',
      output: outputObj,
      total_tokens: totalTokens,
      duration_ms: durationMs
    });
  },

  /**
   * Mark execution as failed
   */
  async fail(id, error, durationMs) {
    return this.update(id, {
      status: 'failed',
      error,
      duration_ms: durationMs
    });
  },

  /**
   * Delete execution
   */
  async delete(id) {
    const result = await db.query(
      'DELETE FROM workflow_executions WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  /**
   * Get execution statistics for a workflow
   */
  async getStats(workflowId) {
    const result = await db.query(
      `SELECT
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        AVG(duration_ms) as avg_duration,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost
       FROM workflow_executions WHERE workflow_id = $1`,
      [workflowId]
    );
    return result.rows[0];
  },

  /**
   * Parse execution from database
   */
  parseExecution(execution) {
    let parsedInput = execution.input || {};
    let parsedOutput = execution.output || {};

    if (typeof execution.input === 'string') {
      try {
        parsedInput = JSON.parse(execution.input);
      } catch (e) {
        parsedInput = { raw: execution.input };
      }
    }

    if (typeof execution.output === 'string') {
      try {
        parsedOutput = JSON.parse(execution.output);
      } catch (e) {
        parsedOutput = { raw: execution.output };
      }
    }

    return {
      ...execution,
      input: parsedInput,
      output: parsedOutput,
      duration: execution.duration_ms
    };
  }
};

module.exports = WorkflowExecution;
