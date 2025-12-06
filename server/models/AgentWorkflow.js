/**
 * AgentWorkflow Model - Database operations for workflows
 */

const db = require('../db');

const AgentWorkflow = {
  /**
   * Create a new workflow
   */
  async create(workflowData) {
    const result = await db.query(
      `INSERT INTO agent_workflows (bot_id, name, workflow_type, agents_config, flow_config, entry_agent_id, is_default, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        workflowData.bot_id,
        workflowData.name,
        workflowData.workflow_type || 'sequential',
        JSON.stringify(workflowData.agents_config || []),
        JSON.stringify(workflowData.flow_config || {}),
        workflowData.entry_agent_id || null,
        workflowData.is_default || false,
        workflowData.is_active !== false
      ]
    );
    return this.parseWorkflow(result.rows[0]);
  },

  /**
   * Find workflow by ID
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM agent_workflows WHERE id = $1',
      [id]
    );
    return result.rows[0] ? this.parseWorkflow(result.rows[0]) : null;
  },

  /**
   * Find all workflows for a bot
   */
  async findByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM agent_workflows WHERE bot_id = $1 ORDER BY created_at ASC',
      [botId]
    );
    return result.rows.map(w => this.parseWorkflow(w));
  },

  /**
   * Find active workflows for a bot
   */
  async findActiveByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM agent_workflows WHERE bot_id = $1 AND is_active = true ORDER BY created_at ASC',
      [botId]
    );
    return result.rows.map(w => this.parseWorkflow(w));
  },

  /**
   * Find default workflow for a bot
   */
  async findDefaultByBotId(botId) {
    const result = await db.query(
      'SELECT * FROM agent_workflows WHERE bot_id = $1 AND is_default = true AND is_active = true LIMIT 1',
      [botId]
    );
    return result.rows[0] ? this.parseWorkflow(result.rows[0]) : null;
  },

  /**
   * Update a workflow
   */
  async update(id, workflowData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (workflowData.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(workflowData.name);
    }
    if (workflowData.workflow_type !== undefined) {
      fields.push(`workflow_type = $${paramIndex++}`);
      values.push(workflowData.workflow_type);
    }
    if (workflowData.agents_config !== undefined) {
      fields.push(`agents_config = $${paramIndex++}`);
      values.push(JSON.stringify(workflowData.agents_config));
    }
    if (workflowData.flow_config !== undefined) {
      fields.push(`flow_config = $${paramIndex++}`);
      values.push(JSON.stringify(workflowData.flow_config));
    }
    if (workflowData.entry_agent_id !== undefined) {
      fields.push(`entry_agent_id = $${paramIndex++}`);
      values.push(workflowData.entry_agent_id);
    }
    if (workflowData.is_default !== undefined) {
      fields.push(`is_default = $${paramIndex++}`);
      values.push(workflowData.is_default);
    }
    if (workflowData.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(workflowData.is_active);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await db.query(
      `UPDATE agent_workflows SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
    return this.findById(id);
  },

  /**
   * Set as default workflow (unset others)
   */
  async setAsDefault(id, botId) {
    await db.query(
      'UPDATE agent_workflows SET is_default = false WHERE bot_id = $1',
      [botId]
    );
    await db.query(
      'UPDATE agent_workflows SET is_default = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    return this.findById(id);
  },

  /**
   * Delete a workflow
   */
  async delete(id) {
    const result = await db.query(
      'DELETE FROM agent_workflows WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  },

  /**
   * Parse workflow from database
   */
  parseWorkflow(workflow) {
    return {
      ...workflow,
      agents_config: typeof workflow.agents_config === 'string'
        ? JSON.parse(workflow.agents_config)
        : workflow.agents_config || [],
      flow_config: typeof workflow.flow_config === 'string'
        ? JSON.parse(workflow.flow_config)
        : workflow.flow_config || {}
    };
  }
};

module.exports = AgentWorkflow;
