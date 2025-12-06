const db = require('../db');
const WorkflowExecution = require('../models/WorkflowExecution');

// In-memory session variable storage
const sessionVariables = new Map();

class OrchestrationManager {
  // ==================== ORCHESTRATION METHODS ====================

  async createOrchestration(botId, name, entryFlowId, description = '') {
    const result = await db.query(
      `INSERT INTO flow_orchestrations (bot_id, name, description, entry_flow_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [botId, name, description, entryFlowId]
    );
    return result.rows[0];
  }

  async getOrchestration(id) {
    const result = await db.query(
      `SELECT * FROM flow_orchestrations WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async listOrchestrations(botId) {
    const result = await db.query(
      `SELECT * FROM flow_orchestrations WHERE bot_id = $1 ORDER BY created_at DESC`,
      [botId]
    );
    return result.rows;
  }

  async updateOrchestration(id, data) {
    const { name, description, is_active, entry_flow_id } = data;
    const result = await db.query(
      `UPDATE flow_orchestrations
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           entry_flow_id = COALESCE($5, entry_flow_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, name, description, is_active, entry_flow_id]
    );
    return result.rows[0] || null;
  }

  async deleteOrchestration(id) {
    const result = await db.query(
      `DELETE FROM flow_orchestrations WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount > 0;
  }

  // ==================== TRANSITION METHODS ====================

  async addTransition(orchestrationId, fromFlowId, toFlowId, triggerType, triggerValue, priority = 0) {
    const result = await db.query(
      `INSERT INTO flow_transitions (orchestration_id, from_flow_id, to_flow_id, trigger_type, trigger_value, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orchestrationId, fromFlowId, toFlowId, triggerType, JSON.stringify(triggerValue), priority]
    );
    return result.rows[0];
  }

  async removeTransition(id) {
    const result = await db.query(
      `DELETE FROM flow_transitions WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount > 0;
  }

  async getTransitions(orchestrationId) {
    const result = await db.query(
      `SELECT * FROM flow_transitions WHERE orchestration_id = $1 ORDER BY priority DESC`,
      [orchestrationId]
    );
    return result.rows;
  }

  // ==================== VARIABLE METHODS ====================

  async addVariable(orchestrationId, name, type, defaultValue, scope = 'session') {
    const result = await db.query(
      `INSERT INTO flow_variables (orchestration_id, name, type, default_value, scope)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orchestrationId, name, type, defaultValue, scope]
    );
    return result.rows[0];
  }

  async getVariables(orchestrationId) {
    const result = await db.query(
      `SELECT * FROM flow_variables WHERE orchestration_id = $1 ORDER BY name`,
      [orchestrationId]
    );
    return result.rows;
  }

  setVariableValue(sessionId, variableName, value) {
    if (!sessionVariables.has(sessionId)) {
      sessionVariables.set(sessionId, new Map());
    }
    sessionVariables.get(sessionId).set(variableName, value);
    return true;
  }

  getVariableValue(sessionId, variableName) {
    if (!sessionVariables.has(sessionId)) {
      return undefined;
    }
    return sessionVariables.get(sessionId).get(variableName);
  }

  // ==================== EXECUTION METHODS ====================

  async executeOrchestration(orchestrationId, sessionId, input) {
    // Ensure orchestrationId is an integer
    const orchId = parseInt(orchestrationId, 10);
    const orchestration = await this.getOrchestration(orchId);
    if (!orchestration) {
      throw new Error('Orchestration not found');
    }

    // Auto-activate orchestration on first run
    if (!orchestration.is_active) {
      await this.updateOrchestration(orchId, { is_active: true });
      orchestration.is_active = true;
    }

    // Initialize session variables if not exists
    if (!sessionVariables.has(sessionId)) {
      sessionVariables.set(sessionId, new Map());

      // Load default variable values
      const variables = await this.getVariables(orchId);
      for (const variable of variables) {
        if (variable.default_value !== null) {
          this.setVariableValue(sessionId, variable.name, variable.default_value);
        }
      }
    }

    // Get current flow from session or use entry flow
    let currentFlowId = this.getVariableValue(sessionId, '_current_flow_id');
    if (!currentFlowId) {
      currentFlowId = orchestration.entry_flow_id;
      this.setVariableValue(sessionId, '_current_flow_id', currentFlowId);
    }

    // Build context for flow execution
    const context = {
      sessionId,
      orchestrationId: orchId,
      currentFlowId,
      input,
      variables: Object.fromEntries(sessionVariables.get(sessionId) || [])
    };

    // Create execution record
    // Note: workflow_id is null for orchestrations since they don't use agent_workflows
    // Store orchestration info in input for tracking
    const startTime = Date.now();
    const execution = await WorkflowExecution.create({
      workflow_id: null,
      bot_id: orchestration.bot_id,
      status: 'running',
      input: {
        ...(input || {}),
        orchestration_id: orchId,
        orchestration_name: orchestration.name
      }
    });

    // Mark execution as completed since orchestration setup is done
    const durationMs = Date.now() - startTime;
    try {
      await WorkflowExecution.complete(execution.id, {
        orchestration_id: orchId,
        orchestration_name: orchestration.name,
        currentFlowId,
        message: 'Orchestration executed successfully'
      }, 0, durationMs);
    } catch (err) {
      console.error('Failed to complete execution:', err);
    }

    return {
      success: true,
      executionId: execution.id,
      orchestration,
      currentFlowId,
      context
    };
  }

  async determineNextFlow(orchestrationId, currentFlowId, context) {
    // Get all transitions from current flow
    const result = await db.query(
      `SELECT * FROM flow_transitions
       WHERE orchestration_id = $1 AND from_flow_id = $2
       ORDER BY priority DESC`,
      [orchestrationId, currentFlowId]
    );

    const transitions = result.rows;

    for (const transition of transitions) {
      const shouldTransition = await this.evaluateTransition(transition, context);
      if (shouldTransition) {
        // Update current flow in session
        if (context.sessionId) {
          this.setVariableValue(context.sessionId, '_current_flow_id', transition.to_flow_id);
        }
        return {
          shouldTransition: true,
          nextFlowId: transition.to_flow_id,
          transition
        };
      }
    }

    return {
      shouldTransition: false,
      nextFlowId: null,
      transition: null
    };
  }

  async evaluateTransition(transition, context) {
    const { trigger_type, trigger_value } = transition;
    const triggerData = typeof trigger_value === 'string' ? JSON.parse(trigger_value) : trigger_value;

    switch (trigger_type) {
      case 'on_complete':
        return context.flowCompleted === true;

      case 'on_condition':
        return this.evaluateCondition(triggerData, context);

      case 'on_intent':
        return context.detectedIntent === triggerData.intent;

      case 'on_keyword':
        const keywords = triggerData.keywords || [];
        const input = (context.input || '').toLowerCase();
        return keywords.some(keyword => input.includes(keyword.toLowerCase()));

      default:
        return false;
    }
  }

  evaluateCondition(conditionData, context) {
    const { variable, operator, value } = conditionData;
    const actualValue = context.variables?.[variable];

    switch (operator) {
      case 'equals':
        return actualValue == value;
      case 'not_equals':
        return actualValue != value;
      case 'contains':
        return String(actualValue).includes(value);
      case 'greater_than':
        return Number(actualValue) > Number(value);
      case 'less_than':
        return Number(actualValue) < Number(value);
      case 'is_empty':
        return !actualValue || actualValue === '';
      case 'is_not_empty':
        return actualValue && actualValue !== '';
      default:
        return false;
    }
  }

  // ==================== UTILITY METHODS ====================

  clearSessionVariables(sessionId) {
    sessionVariables.delete(sessionId);
  }

  getAllSessionVariables(sessionId) {
    if (!sessionVariables.has(sessionId)) {
      return {};
    }
    return Object.fromEntries(sessionVariables.get(sessionId));
  }
}

module.exports = new OrchestrationManager();
