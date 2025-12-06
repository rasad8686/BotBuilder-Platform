/**
 * AgentExecutionStep Model - Database operations for execution steps
 */

const db = require('../db');

const AgentExecutionStep = {
  /**
   * Create a new execution step
   */
  async create(stepData) {
    const result = await db.query(
      `INSERT INTO agent_execution_steps (execution_id, agent_id, step_order, status, input, output, reasoning, tokens_used, duration_ms, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        stepData.execution_id,
        stepData.agent_id,
        stepData.step_order || 0,
        stepData.status || 'pending',
        JSON.stringify(stepData.input || {}),
        JSON.stringify(stepData.output || {}),
        stepData.reasoning || null,
        stepData.tokens_used || 0,
        stepData.duration_ms || 0
      ]
    );
    return this.parseStep(result.rows[0]);
  },

  /**
   * Find step by ID
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM agent_execution_steps WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.parseStep(result.rows[0]) : null;
  },

  /**
   * Find steps by execution ID
   */
  async findByExecutionId(executionId) {
    const result = await db.query(
      'SELECT * FROM agent_execution_steps WHERE execution_id = $1 ORDER BY step_order ASC',
      [executionId]
    );
    return result.rows.map(s => this.parseStep(s));
  },

  /**
   * Find steps by agent ID
   */
  async findByAgentId(agentId, limit = 50) {
    const result = await db.query(
      'SELECT * FROM agent_execution_steps WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2',
      [agentId, limit]
    );
    return result.rows.map(s => this.parseStep(s));
  },

  /**
   * Update step
   */
  async update(id, stepData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (stepData.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(stepData.status);
    }
    if (stepData.output !== undefined) {
      fields.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(stepData.output));
    }
    if (stepData.reasoning !== undefined) {
      fields.push(`reasoning = $${paramIndex++}`);
      values.push(stepData.reasoning);
    }
    if (stepData.tokens_used !== undefined) {
      fields.push(`tokens_used = $${paramIndex++}`);
      values.push(stepData.tokens_used);
    }
    if (stepData.duration_ms !== undefined) {
      fields.push(`duration_ms = $${paramIndex++}`);
      values.push(stepData.duration_ms);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await db.query(
      `UPDATE agent_execution_steps SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Mark step as completed
   */
  async complete(id, output, reasoning, tokensUsed, durationMs) {
    return this.update(id, {
      status: 'completed',
      output,
      reasoning,
      tokens_used: tokensUsed,
      duration_ms: durationMs
    });
  },

  /**
   * Mark step as failed
   */
  async fail(id, error, durationMs) {
    return this.update(id, {
      status: 'failed',
      output: { error },
      duration_ms: durationMs
    });
  },

  /**
   * Delete step
   */
  async delete(id) {
    const result = await db.query(
      'DELETE FROM agent_execution_steps WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  /**
   * Delete all steps for an execution
   */
  async deleteByExecutionId(executionId) {
    const result = await db.query(
      'DELETE FROM agent_execution_steps WHERE execution_id = $1',
      [executionId]
    );
    return result.rowCount;
  },

  /**
   * Parse step from database
   */
  parseStep(step) {
    return {
      ...step,
      input: typeof step.input === 'string'
        ? JSON.parse(step.input)
        : step.input || {},
      output: typeof step.output === 'string'
        ? JSON.parse(step.output)
        : step.output || {}
    };
  }
};

module.exports = AgentExecutionStep;
