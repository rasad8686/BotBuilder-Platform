/**
 * Ticket Automation API Routes
 * Routes for managing automation rules, business hours, escalation policies, and scheduled jobs
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const automationService = require('../services/ticket-automation.service');
const assignmentService = require('../services/ticket-assignment.service');
const slaService = require('../services/ticket-sla.service');
const schedulerService = require('../services/ticket-scheduler.service');
const webhookService = require('../services/ticket-webhook.service');
const { runJob, getJobStatus } = require('../jobs/ticket-jobs');

// Apply authentication
router.use(authenticateToken);

// Get workspace ID helper
const getWorkspaceId = (req) => {
  return req.query.workspace_id ||
         req.body.workspace_id ||
         req.user?.workspace_id ||
         req.user?.organization_id ||
         1;
};

// ==================== Automation Rules ====================

/**
 * GET /api/tickets/automation/rules
 * Get all automation rules
 */
router.get('/rules', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { trigger_type, is_active } = req.query;

    const rules = await automationService.getRules(workspaceId, {
      trigger_type,
      is_active: is_active !== undefined ? is_active === 'true' : undefined,
    });

    res.json({ rules });
  } catch (error) {
    console.error('GET /api/tickets/automation/rules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/automation/rules
 * Create a new automation rule
 */
router.post('/rules', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const rule = await automationService.createRule(workspaceId, req.body, req.user?.id);
    res.status(201).json(rule);
  } catch (error) {
    console.error('POST /api/tickets/automation/rules error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/automation/rules/:id
 * Get a single rule
 */
router.get('/rules/:id', async (req, res) => {
  try {
    const rule = await automationService.getRuleById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(rule);
  } catch (error) {
    console.error('GET /api/tickets/automation/rules/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/automation/rules/:id
 * Update a rule
 */
router.put('/rules/:id', async (req, res) => {
  try {
    const rule = await automationService.updateRule(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(rule);
  } catch (error) {
    console.error('PUT /api/tickets/automation/rules/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/automation/rules/:id
 * Delete a rule
 */
router.delete('/rules/:id', async (req, res) => {
  try {
    const deleted = await automationService.deleteRule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    console.error('DELETE /api/tickets/automation/rules/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/automation/rules/:id/toggle
 * Toggle rule active status
 */
router.post('/rules/:id/toggle', async (req, res) => {
  try {
    const rule = await automationService.toggleRule(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(rule);
  } catch (error) {
    console.error('POST /api/tickets/automation/rules/:id/toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/automation/rules/:id/test
 * Test a rule with sample ticket
 */
router.post('/rules/:id/test', async (req, res) => {
  try {
    const result = await automationService.testRule(req.params.id, req.body.ticket);
    res.json(result);
  } catch (error) {
    console.error('POST /api/tickets/automation/rules/:id/test error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/automation/rules/:id/logs
 * Get execution logs for a rule
 */
router.get('/rules/:id/logs', async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const logs = await automationService.getRuleLogs(req.params.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      status,
    });
    res.json(logs);
  } catch (error) {
    console.error('GET /api/tickets/automation/rules/:id/logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/automation/fields
 * Get available condition fields and operators
 */
router.get('/fields', async (req, res) => {
  try {
    const fields = automationService.getConditionFields();
    const operators = automationService.getOperators();
    res.json({ fields, operators });
  } catch (error) {
    console.error('GET /api/tickets/automation/fields error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Business Hours ====================

/**
 * GET /api/tickets/business-hours
 * Get all business hours configurations
 */
router.get('/business-hours', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const hours = await slaService.getAllBusinessHours(workspaceId);
    res.json({ business_hours: hours });
  } catch (error) {
    console.error('GET /api/tickets/business-hours error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/business-hours
 * Create business hours
 */
router.post('/business-hours', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const hours = await slaService.saveBusinessHours(workspaceId, req.body);
    res.status(201).json(hours);
  } catch (error) {
    console.error('POST /api/tickets/business-hours error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/business-hours/:id
 * Update business hours
 */
router.put('/business-hours/:id', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const hours = await slaService.saveBusinessHours(workspaceId, {
      ...req.body,
      id: req.params.id,
    });
    res.json(hours);
  } catch (error) {
    console.error('PUT /api/tickets/business-hours/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/business-hours/:id
 * Delete business hours
 */
router.delete('/business-hours/:id', async (req, res) => {
  try {
    const deleted = await slaService.deleteBusinessHours(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Business hours not found' });
    }
    res.json({ success: true, message: 'Business hours deleted' });
  } catch (error) {
    console.error('DELETE /api/tickets/business-hours/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Escalation Policies ====================

/**
 * GET /api/tickets/escalation-policies
 * Get all escalation policies
 */
router.get('/escalation-policies', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const db = require('../config/db');

    const policies = await db('escalation_policies')
      .where('workspace_id', workspaceId)
      .orderBy('created_at', 'desc');

    res.json({
      policies: policies.map(p => ({
        ...p,
        rules: typeof p.rules === 'string' ? JSON.parse(p.rules) : p.rules,
      })),
    });
  } catch (error) {
    console.error('GET /api/tickets/escalation-policies error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/escalation-policies
 * Create escalation policy
 */
router.post('/escalation-policies', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const db = require('../config/db');
    const { v4: uuidv4 } = require('uuid');

    const id = uuidv4();
    await db('escalation_policies').insert({
      id,
      workspace_id: workspaceId,
      name: req.body.name,
      description: req.body.description,
      rules: JSON.stringify(req.body.rules || []),
      is_active: req.body.is_active !== false,
      is_default: req.body.is_default || false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const policy = await db('escalation_policies').where('id', id).first();
    res.status(201).json({
      ...policy,
      rules: typeof policy.rules === 'string' ? JSON.parse(policy.rules) : policy.rules,
    });
  } catch (error) {
    console.error('POST /api/tickets/escalation-policies error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/escalation-policies/:id
 * Update escalation policy
 */
router.put('/escalation-policies/:id', async (req, res) => {
  try {
    const db = require('../config/db');

    const updates = { updated_at: new Date() };
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.rules !== undefined) updates.rules = JSON.stringify(req.body.rules);
    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
    if (req.body.is_default !== undefined) updates.is_default = req.body.is_default;

    await db('escalation_policies').where('id', req.params.id).update(updates);

    const policy = await db('escalation_policies').where('id', req.params.id).first();
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }

    res.json({
      ...policy,
      rules: typeof policy.rules === 'string' ? JSON.parse(policy.rules) : policy.rules,
    });
  } catch (error) {
    console.error('PUT /api/tickets/escalation-policies/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/escalation-policies/:id
 * Delete escalation policy
 */
router.delete('/escalation-policies/:id', async (req, res) => {
  try {
    const db = require('../config/db');
    const deleted = await db('escalation_policies').where('id', req.params.id).delete();
    if (!deleted) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    res.json({ success: true, message: 'Policy deleted' });
  } catch (error) {
    console.error('DELETE /api/tickets/escalation-policies/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Scheduled Jobs ====================

/**
 * GET /api/tickets/schedules
 * Get all schedules
 */
router.get('/schedules', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const schedules = await schedulerService.getSchedules(workspaceId);
    res.json({ schedules });
  } catch (error) {
    console.error('GET /api/tickets/schedules error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/schedules
 * Create a schedule
 */
router.post('/schedules', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const schedule = await schedulerService.createSchedule(workspaceId, req.body);
    res.status(201).json(schedule);
  } catch (error) {
    console.error('POST /api/tickets/schedules error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/schedules/:id
 * Update a schedule
 */
router.put('/schedules/:id', async (req, res) => {
  try {
    const schedule = await schedulerService.updateSchedule(req.params.id, req.body);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(schedule);
  } catch (error) {
    console.error('PUT /api/tickets/schedules/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', async (req, res) => {
  try {
    const deleted = await schedulerService.deleteSchedule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    console.error('DELETE /api/tickets/schedules/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/schedules/:id/run-now
 * Run a schedule immediately
 */
router.post('/schedules/:id/run-now', async (req, res) => {
  try {
    const result = await schedulerService.runScheduleNow(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('POST /api/tickets/schedules/:id/run-now error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/jobs/status
 * Get status of all cron jobs
 */
router.get('/jobs/status', async (req, res) => {
  try {
    const status = getJobStatus();
    res.json({ jobs: status });
  } catch (error) {
    console.error('GET /api/tickets/jobs/status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/jobs/:name/run
 * Run a specific job manually
 */
router.post('/jobs/:name/run', async (req, res) => {
  try {
    const result = await runJob(req.params.name);
    res.json(result);
  } catch (error) {
    console.error('POST /api/tickets/jobs/:name/run error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== Assignment Settings ====================

/**
 * GET /api/tickets/assignment/settings
 * Get assignment settings
 */
router.get('/assignment/settings', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const settings = await assignmentService.getAssignmentSettings(workspaceId);
    res.json(settings || { auto_assign_enabled: true, assignment_strategy: 'round_robin' });
  } catch (error) {
    console.error('GET /api/tickets/assignment/settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/assignment/settings
 * Update assignment settings
 */
router.put('/assignment/settings', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const settings = await assignmentService.saveAssignmentSettings(workspaceId, req.body);
    res.json(settings);
  } catch (error) {
    console.error('PUT /api/tickets/assignment/settings error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/assignment/stats
 * Get assignment statistics
 */
router.get('/assignment/stats', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const stats = await assignmentService.getAssignmentStats(workspaceId);
    res.json(stats);
  } catch (error) {
    console.error('GET /api/tickets/assignment/stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/agents/:id/availability
 * Get agent availability
 */
router.get('/agents/:id/availability', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const availability = await assignmentService.getAgentAvailability(req.params.id, workspaceId);
    res.json(availability);
  } catch (error) {
    console.error('GET /api/tickets/agents/:id/availability error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/agents/:id/availability
 * Update agent availability
 */
router.put('/agents/:id/availability', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const availability = await assignmentService.updateAgentAvailability(
      req.params.id,
      workspaceId,
      req.body
    );
    res.json(availability);
  } catch (error) {
    console.error('PUT /api/tickets/agents/:id/availability error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ==================== SLA ====================

/**
 * GET /api/tickets/sla/stats
 * Get SLA statistics
 */
router.get('/sla/stats', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const { startDate, endDate } = req.query;
    const stats = await slaService.getSLAStats(workspaceId, { startDate, endDate });
    res.json(stats);
  } catch (error) {
    console.error('GET /api/tickets/sla/stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/:ticketId/sla
 * Get SLA status for a ticket
 */
router.get('/:ticketId/sla', async (req, res) => {
  try {
    const db = require('../config/db');
    const ticket = await db('tickets').where('id', req.params.ticketId).first();
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const status = await slaService.checkSLAStatus(ticket);
    res.json(status);
  } catch (error) {
    console.error('GET /api/tickets/:ticketId/sla error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== Webhooks ====================

/**
 * GET /api/tickets/webhooks
 * Get all webhooks
 */
router.get('/webhooks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const webhooks = await webhookService.getWebhooks(workspaceId);
    res.json({ webhooks });
  } catch (error) {
    console.error('GET /api/tickets/webhooks error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/webhooks
 * Create a webhook
 */
router.post('/webhooks', async (req, res) => {
  try {
    const workspaceId = getWorkspaceId(req);
    const webhook = await webhookService.createWebhook(workspaceId, req.body);
    res.status(201).json(webhook);
  } catch (error) {
    console.error('POST /api/tickets/webhooks error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * PUT /api/tickets/webhooks/:id
 * Update a webhook
 */
router.put('/webhooks/:id', async (req, res) => {
  try {
    const webhook = await webhookService.updateWebhook(req.params.id, req.body);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json(webhook);
  } catch (error) {
    console.error('PUT /api/tickets/webhooks/:id error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/tickets/webhooks/:id
 * Delete a webhook
 */
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const deleted = await webhookService.deleteWebhook(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    console.error('DELETE /api/tickets/webhooks/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/webhooks/:id/test
 * Test a webhook
 */
router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const result = await webhookService.testWebhook(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('POST /api/tickets/webhooks/:id/test error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tickets/webhooks/:id/regenerate-secret
 * Regenerate webhook secret
 */
router.post('/webhooks/:id/regenerate-secret', async (req, res) => {
  try {
    const result = await webhookService.regenerateSecret(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('POST /api/tickets/webhooks/:id/regenerate-secret error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/webhooks/:id/logs
 * Get webhook delivery logs
 */
router.get('/webhooks/:id/logs', async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const logs = await webhookService.getDeliveryLogs(req.params.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      status,
    });
    res.json(logs);
  } catch (error) {
    console.error('GET /api/tickets/webhooks/:id/logs error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tickets/webhooks/events
 * Get available webhook events
 */
router.get('/webhook-events', async (req, res) => {
  try {
    const events = webhookService.getAvailableEvents();
    res.json({ events });
  } catch (error) {
    console.error('GET /api/tickets/webhooks/events error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
