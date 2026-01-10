/**
 * Ticket Automation Service
 * Rule Engine for processing automation rules on ticket events
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Condition operators
const OPERATORS = {
  equals: (a, b) => String(a).toLowerCase() === String(b).toLowerCase(),
  not_equals: (a, b) => String(a).toLowerCase() !== String(b).toLowerCase(),
  contains: (a, b) => String(a).toLowerCase().includes(String(b).toLowerCase()),
  not_contains: (a, b) => !String(a).toLowerCase().includes(String(b).toLowerCase()),
  starts_with: (a, b) => String(a).toLowerCase().startsWith(String(b).toLowerCase()),
  ends_with: (a, b) => String(a).toLowerCase().endsWith(String(b).toLowerCase()),
  greater_than: (a, b) => Number(a) > Number(b),
  less_than: (a, b) => Number(a) < Number(b),
  greater_than_or_equals: (a, b) => Number(a) >= Number(b),
  less_than_or_equals: (a, b) => Number(a) <= Number(b),
  is_empty: (a) => !a || (typeof a === 'string' && a.trim().length === 0) || (Array.isArray(a) && a.length === 0),
  is_not_empty: (a) => a && ((typeof a === 'string' && a.trim().length > 0) || (Array.isArray(a) && a.length > 0)),
  in_list: (a, b) => {
    const list = Array.isArray(b) ? b : String(b).split(',').map(s => s.trim());
    return list.map(s => String(s).toLowerCase()).includes(String(a).toLowerCase());
  },
  not_in_list: (a, b) => {
    const list = Array.isArray(b) ? b : String(b).split(',').map(s => s.trim());
    return !list.map(s => String(s).toLowerCase()).includes(String(a).toLowerCase());
  },
  regex_match: (a, b) => {
    try {
      const regex = new RegExp(b, 'i');
      return regex.test(String(a));
    } catch {
      return false;
    }
  },
  is_true: (a) => a === true || a === 'true' || a === 1,
  is_false: (a) => a === false || a === 'false' || a === 0 || !a,
  changed: (a, b, oldValue) => oldValue !== undefined && a !== oldValue,
  changed_to: (a, b, oldValue) => oldValue !== undefined && a !== oldValue && a === b,
  changed_from: (a, b, oldValue) => oldValue !== undefined && oldValue === b && a !== b,
};

// Available fields for conditions
const CONDITION_FIELDS = {
  status: { type: 'select', options: ['new', 'open', 'pending', 'on_hold', 'resolved', 'closed'] },
  priority: { type: 'select', options: ['low', 'medium', 'high', 'urgent', 'critical'] },
  category_id: { type: 'select', dynamic: true },
  assignee_id: { type: 'select', dynamic: true },
  team_id: { type: 'select', dynamic: true },
  requester_id: { type: 'select', dynamic: true },
  subject: { type: 'text' },
  description: { type: 'text' },
  tags: { type: 'array' },
  channel: { type: 'select', options: ['email', 'web', 'chat', 'phone', 'api'] },
  is_spam: { type: 'boolean' },
  sla_policy_id: { type: 'select', dynamic: true },
  hours_since_created: { type: 'number' },
  hours_since_updated: { type: 'number' },
  hours_since_assigned: { type: 'number' },
  comment_count: { type: 'number' },
  requester_email_domain: { type: 'text' },
};

class TicketAutomationService {
  /**
   * Process ticket event and execute matching rules
   */
  async processTicketEvent(ticket, eventType, oldTicket = null) {
    const startTime = Date.now();

    try {
      // Get active rules for this event type
      const rules = await this.getActiveRules(ticket.workspace_id, eventType);

      if (rules.length === 0) {
        return { processed: 0, matched: 0, actions: [] };
      }

      let processed = 0;
      let matched = 0;
      const executedActions = [];

      // Sort by priority (lower number = higher priority)
      rules.sort((a, b) => a.priority - b.priority);

      for (const rule of rules) {
        processed++;

        // Evaluate conditions
        const conditionsResult = this.evaluateConditions(ticket, rule.conditions, oldTicket);

        if (conditionsResult.matched) {
          matched++;

          // Execute actions
          const actionsResult = await this.executeActions(ticket, rule.actions);
          executedActions.push(...actionsResult.executed);

          // Log execution
          await this.logExecution(rule.id, ticket.id, eventType, {
            conditionsMatched: conditionsResult.details,
            actionsExecuted: actionsResult.executed,
            status: actionsResult.success ? 'success' : 'failed',
            errorMessage: actionsResult.error,
            executionTime: Date.now() - startTime,
          });

          // Update rule stats
          await this.updateRuleStats(rule.id);

          // Stop processing if rule says so
          if (rule.stop_processing) {
            break;
          }
        }
      }

      return {
        processed,
        matched,
        actions: executedActions,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Error processing ticket event:', error);
      throw error;
    }
  }

  /**
   * Get active rules for a workspace and trigger type
   */
  async getActiveRules(workspaceId, triggerType) {
    return db('ticket_automation_rules')
      .where({
        workspace_id: workspaceId,
        is_active: true,
        trigger_type: triggerType,
      })
      .orderBy('priority', 'asc');
  }

  /**
   * Evaluate conditions against a ticket
   */
  evaluateConditions(ticket, conditions, oldTicket = null) {
    if (!conditions || conditions.length === 0) {
      return { matched: true, details: [] };
    }

    const details = [];
    let allMatched = true;
    let currentGroup = [];
    let groupLogic = 'AND';

    for (const condition of conditions) {
      // Check for group logic operator
      if (condition.logic) {
        // Evaluate previous group
        if (currentGroup.length > 0) {
          const groupResult = this.evaluateConditionGroup(currentGroup, groupLogic);
          allMatched = groupLogic === 'AND' ? allMatched && groupResult : allMatched || groupResult;
          currentGroup = [];
        }
        groupLogic = condition.logic;
        continue;
      }

      const { field, operator, value } = condition;
      const ticketValue = this.getFieldValue(ticket, field);
      const oldValue = oldTicket ? this.getFieldValue(oldTicket, field) : undefined;

      const operatorFn = OPERATORS[operator];
      if (!operatorFn) {
        console.warn(`Unknown operator: ${operator}`);
        continue;
      }

      const matched = operatorFn(ticketValue, value, oldValue);

      details.push({
        field,
        operator,
        value,
        ticketValue,
        matched,
      });

      currentGroup.push(matched);
    }

    // Evaluate final group
    if (currentGroup.length > 0) {
      const groupResult = this.evaluateConditionGroup(currentGroup, groupLogic);
      allMatched = groupLogic === 'AND' ? allMatched && groupResult : allMatched || groupResult;
    }

    return { matched: allMatched, details };
  }

  /**
   * Evaluate a group of conditions with AND/OR logic
   */
  evaluateConditionGroup(results, logic) {
    if (logic === 'OR') {
      return results.some(r => r);
    }
    return results.every(r => r);
  }

  /**
   * Get field value from ticket, supporting nested paths
   */
  getFieldValue(ticket, field) {
    // Handle computed fields
    if (field === 'hours_since_created') {
      return ticket.created_at
        ? (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60)
        : 0;
    }
    if (field === 'hours_since_updated') {
      return ticket.updated_at
        ? (Date.now() - new Date(ticket.updated_at).getTime()) / (1000 * 60 * 60)
        : 0;
    }
    if (field === 'hours_since_assigned') {
      return ticket.assigned_at
        ? (Date.now() - new Date(ticket.assigned_at).getTime()) / (1000 * 60 * 60)
        : 0;
    }
    if (field === 'requester_email_domain') {
      const email = ticket.requester_email || ticket.requester?.email || '';
      const parts = email.split('@');
      return parts.length > 1 ? parts[1] : '';
    }

    // Handle nested paths like "requester.email"
    const parts = field.split('.');
    let value = ticket;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /**
   * Execute actions on a ticket
   */
  async executeActions(ticket, actions) {
    const executed = [];
    let success = true;
    let error = null;

    for (const action of actions) {
      try {
        const result = await this.executeAction(ticket, action);
        executed.push({
          action: action.action,
          params: action.params,
          success: true,
          result,
        });
      } catch (err) {
        success = false;
        error = err.message;
        executed.push({
          action: action.action,
          params: action.params,
          success: false,
          error: err.message,
        });
      }
    }

    return { executed, success, error };
  }

  /**
   * Execute a single action
   */
  async executeAction(ticket, action) {
    const { action: actionType, params } = action;

    switch (actionType) {
      case 'set_status':
        await db('tickets').where('id', ticket.id).update({
          status: params.status,
          updated_at: new Date(),
        });
        return { field: 'status', value: params.status };

      case 'set_priority':
        await db('tickets').where('id', ticket.id).update({
          priority: params.priority,
          updated_at: new Date(),
        });
        return { field: 'priority', value: params.priority };

      case 'assign_to':
        await db('tickets').where('id', ticket.id).update({
          assignee_id: params.assignee_id,
          assigned_at: new Date(),
          updated_at: new Date(),
        });
        return { field: 'assignee_id', value: params.assignee_id };

      case 'assign_to_team':
        // Will be handled by assignment service
        const assignmentService = require('./ticket-assignment.service');
        const assignee = await assignmentService.assignToTeam(ticket.id, params.team_id);
        return { field: 'assignee_id', value: assignee?.id };

      case 'add_tag':
        const currentTags = ticket.tags || [];
        if (!currentTags.includes(params.tag)) {
          await db('tickets').where('id', ticket.id).update({
            tags: JSON.stringify([...currentTags, params.tag]),
            updated_at: new Date(),
          });
        }
        return { field: 'tags', added: params.tag };

      case 'remove_tag':
        const existingTags = ticket.tags || [];
        await db('tickets').where('id', ticket.id).update({
          tags: JSON.stringify(existingTags.filter(t => t !== params.tag)),
          updated_at: new Date(),
        });
        return { field: 'tags', removed: params.tag };

      case 'set_category':
        await db('tickets').where('id', ticket.id).update({
          category_id: params.category_id,
          updated_at: new Date(),
        });
        return { field: 'category_id', value: params.category_id };

      case 'set_sla':
        await db('tickets').where('id', ticket.id).update({
          sla_policy_id: params.sla_policy_id,
          updated_at: new Date(),
        });
        // Recalculate SLA due dates
        const slaService = require('./ticket-sla.service');
        await slaService.calculateAndSetDueDate(ticket.id);
        return { field: 'sla_policy_id', value: params.sla_policy_id };

      case 'send_email':
        // Queue email notification
        await this.queueNotification(ticket.id, 'email', params);
        return { notification: 'email', recipient: params.to };

      case 'send_webhook':
        const webhookService = require('./ticket-webhook.service');
        await webhookService.sendWebhook(params.url, 'automation_trigger', {
          ticket,
          action: actionType,
          params,
        });
        return { webhook: params.url };

      case 'add_internal_note':
        await db('ticket_comments').insert({
          id: uuidv4(),
          ticket_id: ticket.id,
          content: params.note || params.content,
          is_internal: true,
          author_type: 'system',
          created_at: new Date(),
        });
        return { note_added: true };

      case 'escalate':
        const escalationService = require('./ticket-escalation.service');
        await escalationService.escalateTicket(ticket.id, params);
        return { escalated: true, target: params.target };

      case 'close_ticket':
        await db('tickets').where('id', ticket.id).update({
          status: 'closed',
          closed_at: new Date(),
          updated_at: new Date(),
        });
        return { field: 'status', value: 'closed' };

      case 'reopen_ticket':
        await db('tickets').where('id', ticket.id).update({
          status: 'open',
          closed_at: null,
          updated_at: new Date(),
        });
        return { field: 'status', value: 'open' };

      case 'set_custom_field':
        const customFields = ticket.custom_fields || {};
        customFields[params.field_name] = params.value;
        await db('tickets').where('id', ticket.id).update({
          custom_fields: JSON.stringify(customFields),
          updated_at: new Date(),
        });
        return { custom_field: params.field_name, value: params.value };

      case 'copy_to_field':
        const sourceValue = this.getFieldValue(ticket, params.source_field);
        await db('tickets').where('id', ticket.id).update({
          [params.target_field]: sourceValue,
          updated_at: new Date(),
        });
        return { field: params.target_field, value: sourceValue };

      case 'notify_assignee':
        if (ticket.assignee_id) {
          await this.queueNotification(ticket.id, 'assignee_notification', {
            assignee_id: ticket.assignee_id,
            message: params.message,
          });
        }
        return { notified: ticket.assignee_id };

      case 'notify_requester':
        await this.queueNotification(ticket.id, 'requester_notification', {
          ticket_id: ticket.id,
          message: params.message,
        });
        return { notified: 'requester' };

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }
  }

  /**
   * Queue notification for async processing
   */
  async queueNotification(ticketId, type, params) {
    await db('notification_queue').insert({
      id: uuidv4(),
      ticket_id: ticketId,
      type,
      params: JSON.stringify(params),
      status: 'pending',
      created_at: new Date(),
    }).catch(() => {
      // Table might not exist, silently ignore
      console.log('Notification queued (table may not exist):', type);
    });
  }

  /**
   * Log rule execution
   */
  async logExecution(ruleId, ticketId, triggerType, data) {
    await db('ticket_automation_logs').insert({
      id: uuidv4(),
      rule_id: ruleId,
      ticket_id: ticketId,
      trigger_type: triggerType,
      conditions_matched: JSON.stringify(data.conditionsMatched),
      actions_executed: JSON.stringify(data.actionsExecuted),
      status: data.status,
      error_message: data.errorMessage,
      execution_time_ms: data.executionTime,
      executed_at: new Date(),
    });
  }

  /**
   * Update rule execution stats
   */
  async updateRuleStats(ruleId) {
    await db('ticket_automation_rules')
      .where('id', ruleId)
      .update({
        execution_count: db.raw('execution_count + 1'),
        last_executed_at: new Date(),
      });
  }

  /**
   * Create a new automation rule
   */
  async createRule(workspaceId, ruleData, createdBy) {
    const rule = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: ruleData.name,
      description: ruleData.description,
      is_active: ruleData.is_active !== false,
      trigger_type: ruleData.trigger_type,
      conditions: JSON.stringify(ruleData.conditions || []),
      actions: JSON.stringify(ruleData.actions || []),
      priority: ruleData.priority || 0,
      stop_processing: ruleData.stop_processing || false,
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db('ticket_automation_rules').insert(rule);
    return this.getRuleById(rule.id);
  }

  /**
   * Update an automation rule
   */
  async updateRule(ruleId, ruleData) {
    const updates = {
      updated_at: new Date(),
    };

    if (ruleData.name !== undefined) updates.name = ruleData.name;
    if (ruleData.description !== undefined) updates.description = ruleData.description;
    if (ruleData.is_active !== undefined) updates.is_active = ruleData.is_active;
    if (ruleData.trigger_type !== undefined) updates.trigger_type = ruleData.trigger_type;
    if (ruleData.conditions !== undefined) updates.conditions = JSON.stringify(ruleData.conditions);
    if (ruleData.actions !== undefined) updates.actions = JSON.stringify(ruleData.actions);
    if (ruleData.priority !== undefined) updates.priority = ruleData.priority;
    if (ruleData.stop_processing !== undefined) updates.stop_processing = ruleData.stop_processing;

    await db('ticket_automation_rules').where('id', ruleId).update(updates);
    return this.getRuleById(ruleId);
  }

  /**
   * Delete an automation rule
   */
  async deleteRule(ruleId) {
    const deleted = await db('ticket_automation_rules').where('id', ruleId).delete();
    return deleted > 0;
  }

  /**
   * Get rule by ID
   */
  async getRuleById(ruleId) {
    const rule = await db('ticket_automation_rules').where('id', ruleId).first();
    if (rule) {
      rule.conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
      rule.actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
    }
    return rule;
  }

  /**
   * Get all rules for a workspace
   */
  async getRules(workspaceId, options = {}) {
    let query = db('ticket_automation_rules')
      .where('workspace_id', workspaceId)
      .orderBy('priority', 'asc');

    if (options.trigger_type) {
      query = query.where('trigger_type', options.trigger_type);
    }
    if (options.is_active !== undefined) {
      query = query.where('is_active', options.is_active);
    }

    const rules = await query;
    return rules.map(rule => ({
      ...rule,
      conditions: typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions,
      actions: typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions,
    }));
  }

  /**
   * Toggle rule active status
   */
  async toggleRule(ruleId) {
    const rule = await db('ticket_automation_rules').where('id', ruleId).first();
    if (!rule) return null;

    await db('ticket_automation_rules').where('id', ruleId).update({
      is_active: !rule.is_active,
      updated_at: new Date(),
    });

    return this.getRuleById(ruleId);
  }

  /**
   * Test a rule against a sample ticket
   */
  async testRule(ruleId, sampleTicket) {
    const rule = await this.getRuleById(ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }

    const conditionsResult = this.evaluateConditions(sampleTicket, rule.conditions);

    return {
      rule: {
        id: rule.id,
        name: rule.name,
        trigger_type: rule.trigger_type,
      },
      ticket: sampleTicket,
      conditionsMatched: conditionsResult.matched,
      conditionsDetails: conditionsResult.details,
      wouldExecuteActions: conditionsResult.matched ? rule.actions : [],
    };
  }

  /**
   * Get execution logs for a rule
   */
  async getRuleLogs(ruleId, options = {}) {
    const { page = 1, limit = 50, status } = options;
    const offset = (page - 1) * limit;

    let query = db('ticket_automation_logs')
      .where('rule_id', ruleId)
      .orderBy('executed_at', 'desc')
      .offset(offset)
      .limit(limit);

    if (status) {
      query = query.where('status', status);
    }

    const [logs, countResult] = await Promise.all([
      query,
      db('ticket_automation_logs').where('rule_id', ruleId).count('id as count').first(),
    ]);

    return {
      logs: logs.map(log => ({
        ...log,
        conditions_matched: typeof log.conditions_matched === 'string'
          ? JSON.parse(log.conditions_matched)
          : log.conditions_matched,
        actions_executed: typeof log.actions_executed === 'string'
          ? JSON.parse(log.actions_executed)
          : log.actions_executed,
      })),
      total: parseInt(countResult?.count || 0),
      page,
      limit,
    };
  }

  /**
   * Get available condition fields
   */
  getConditionFields() {
    return CONDITION_FIELDS;
  }

  /**
   * Get available operators
   */
  getOperators() {
    return Object.keys(OPERATORS);
  }
}

module.exports = new TicketAutomationService();
