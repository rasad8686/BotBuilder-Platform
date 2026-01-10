/**
 * Ticket Scheduler Service
 * Handles scheduled jobs for ticket automation
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class TicketSchedulerService {
  /**
   * Auto-close stale tickets
   */
  async autoCloseStaleTickets(workspaceId = null) {
    try {
      const schedules = await this.getActiveSchedules('auto_close', workspaceId);
      const results = [];

      for (const schedule of schedules) {
        const config = typeof schedule.config === 'string'
          ? JSON.parse(schedule.config)
          : schedule.config;

        const daysInactive = config.days_inactive || 7;
        const targetStatus = config.from_status || ['resolved', 'pending'];
        const cutoffDate = new Date(Date.now() - daysInactive * 24 * 60 * 60 * 1000);

        // Find stale tickets
        const staleTickets = await db('tickets')
          .where('workspace_id', schedule.workspace_id)
          .whereIn('status', targetStatus)
          .where('updated_at', '<', cutoffDate)
          .select('id', 'subject', 'requester_id');

        // Close each ticket
        for (const ticket of staleTickets) {
          await db('tickets')
            .where('id', ticket.id)
            .update({
              status: 'closed',
              closed_at: new Date(),
              updated_at: new Date(),
            });

          // Add system note
          await db('ticket_comments').insert({
            id: uuidv4(),
            ticket_id: ticket.id,
            content: `Ticket automatically closed after ${daysInactive} days of inactivity.`,
            is_internal: true,
            author_type: 'system',
            created_at: new Date(),
          });

          // Send notification to requester if configured
          if (config.notify_requester) {
            await this.queueNotification(ticket.id, 'auto_close', {
              requester_id: ticket.requester_id,
              ticket_subject: ticket.subject,
            });
          }
        }

        results.push({
          schedule_id: schedule.id,
          workspace_id: schedule.workspace_id,
          tickets_closed: staleTickets.length,
        });

        // Update schedule last run
        await this.updateScheduleRun(schedule.id, 'success', null);
      }

      return {
        success: true,
        results,
        total_closed: results.reduce((sum, r) => sum + r.tickets_closed, 0),
      };
    } catch (error) {
      console.error('Error in autoCloseStaleTickets:', error);
      throw error;
    }
  }

  /**
   * Send SLA breach alerts
   */
  async sendSLABreachAlerts(workspaceId = null) {
    try {
      const slaService = require('./ticket-sla.service');
      const workspaces = workspaceId
        ? [{ id: workspaceId }]
        : await db('workspaces').select('id');

      const results = [];

      for (const workspace of workspaces) {
        // Find tickets approaching breach (within 30 minutes)
        const approachingBreach = await slaService.findApproachingBreach(workspace.id, 30);

        for (const ticket of approachingBreach) {
          // Check if we already sent an alert recently
          const recentAlert = await db('ticket_notifications')
            .where('ticket_id', ticket.id)
            .where('type', 'sla_warning')
            .where('created_at', '>', new Date(Date.now() - 60 * 60 * 1000))
            .first()
            .catch(() => null);

          if (!recentAlert) {
            // Send warning to assignee
            if (ticket.assignee_id) {
              await this.queueNotification(ticket.id, 'sla_warning', {
                assignee_id: ticket.assignee_id,
                warning_type: 'approaching_breach',
                ticket_id: ticket.id,
                ticket_subject: ticket.subject,
              });
            }

            // Record notification sent
            await db('ticket_notifications').insert({
              id: uuidv4(),
              ticket_id: ticket.id,
              type: 'sla_warning',
              sent_to: ticket.assignee_id,
              created_at: new Date(),
            }).catch(() => {});
          }
        }

        results.push({
          workspace_id: workspace.id,
          alerts_sent: approachingBreach.length,
        });
      }

      return {
        success: true,
        results,
        total_alerts: results.reduce((sum, r) => sum + r.alerts_sent, 0),
      };
    } catch (error) {
      console.error('Error in sendSLABreachAlerts:', error);
      throw error;
    }
  }

  /**
   * Send pending ticket reminders
   */
  async sendPendingReminders(workspaceId = null) {
    try {
      const schedules = await this.getActiveSchedules('reminder', workspaceId);
      const results = [];

      for (const schedule of schedules) {
        const config = typeof schedule.config === 'string'
          ? JSON.parse(schedule.config)
          : schedule.config;

        const hoursWaiting = config.hours_waiting || 24;
        const cutoffDate = new Date(Date.now() - hoursWaiting * 60 * 60 * 1000);

        // Find pending tickets waiting for customer response
        const pendingTickets = await db('tickets')
          .where('workspace_id', schedule.workspace_id)
          .where('status', 'pending')
          .where('updated_at', '<', cutoffDate)
          .select('id', 'subject', 'requester_id', 'requester_email');

        for (const ticket of pendingTickets) {
          // Check if reminder already sent recently
          const recentReminder = await db('ticket_notifications')
            .where('ticket_id', ticket.id)
            .where('type', 'pending_reminder')
            .where('created_at', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
            .first()
            .catch(() => null);

          if (!recentReminder) {
            await this.queueNotification(ticket.id, 'pending_reminder', {
              requester_id: ticket.requester_id,
              requester_email: ticket.requester_email,
              ticket_subject: ticket.subject,
            });

            // Record reminder sent
            await db('ticket_notifications').insert({
              id: uuidv4(),
              ticket_id: ticket.id,
              type: 'pending_reminder',
              sent_to: ticket.requester_id,
              created_at: new Date(),
            }).catch(() => {});
          }
        }

        results.push({
          schedule_id: schedule.id,
          workspace_id: schedule.workspace_id,
          reminders_sent: pendingTickets.length,
        });

        await this.updateScheduleRun(schedule.id, 'success', null);
      }

      return {
        success: true,
        results,
        total_reminders: results.reduce((sum, r) => sum + r.reminders_sent, 0),
      };
    } catch (error) {
      console.error('Error in sendPendingReminders:', error);
      throw error;
    }
  }

  /**
   * Escalate breached tickets
   */
  async escalateBreachedTickets(workspaceId = null) {
    try {
      const slaService = require('./ticket-sla.service');
      const workspaces = workspaceId
        ? [{ id: workspaceId }]
        : await db('workspaces').select('id');

      const results = [];

      for (const workspace of workspaces) {
        // Get escalation policy
        const policy = await db('escalation_policies')
          .where('workspace_id', workspace.id)
          .where('is_active', true)
          .where('is_default', true)
          .first();

        if (!policy) continue;

        const rules = typeof policy.rules === 'string'
          ? JSON.parse(policy.rules)
          : (policy.rules || []);

        // Find breached tickets
        const breachedTickets = await slaService.findBreachedTickets(workspace.id);

        for (const ticket of breachedTickets) {
          // Calculate how long it's been breached
          const now = new Date();
          let breachDuration = 0;

          if (ticket.first_response_due && !ticket.first_response_at) {
            const due = new Date(ticket.first_response_due);
            if (now > due) {
              breachDuration = Math.max(breachDuration, (now - due) / (60 * 1000));
            }
          }
          if (ticket.resolution_due) {
            const due = new Date(ticket.resolution_due);
            if (now > due) {
              breachDuration = Math.max(breachDuration, (now - due) / (60 * 1000));
            }
          }

          // Find applicable escalation rule
          const applicableRule = rules
            .filter(r => breachDuration >= r.after_minutes)
            .sort((a, b) => b.after_minutes - a.after_minutes)[0];

          if (applicableRule) {
            // Check if already escalated at this level
            const alreadyEscalated = await db('ticket_escalations')
              .where('ticket_id', ticket.id)
              .where('rule_level', applicableRule.after_minutes)
              .first()
              .catch(() => null);

            if (!alreadyEscalated) {
              await this.applyEscalation(ticket, applicableRule);

              // Record escalation
              await db('ticket_escalations').insert({
                id: uuidv4(),
                ticket_id: ticket.id,
                policy_id: policy.id,
                rule_level: applicableRule.after_minutes,
                action: applicableRule.action,
                target: applicableRule.target,
                created_at: new Date(),
              }).catch(() => {});
            }
          }
        }

        results.push({
          workspace_id: workspace.id,
          tickets_escalated: breachedTickets.length,
        });
      }

      return {
        success: true,
        results,
        total_escalated: results.reduce((sum, r) => sum + r.tickets_escalated, 0),
      };
    } catch (error) {
      console.error('Error in escalateBreachedTickets:', error);
      throw error;
    }
  }

  /**
   * Apply escalation action to a ticket
   */
  async applyEscalation(ticket, rule) {
    const updates = { updated_at: new Date() };

    switch (rule.action) {
      case 'increase_priority':
        const priorities = ['low', 'medium', 'high', 'urgent', 'critical'];
        const currentIndex = priorities.indexOf(ticket.priority || 'medium');
        if (currentIndex < priorities.length - 1) {
          updates.priority = priorities[currentIndex + 1];
        }
        break;

      case 'reassign':
        if (rule.target) {
          updates.assignee_id = rule.target;
          updates.assigned_at = new Date();
        }
        break;

      case 'assign_to_team':
        const assignmentService = require('./ticket-assignment.service');
        await assignmentService.assignToTeam(ticket.id, rule.target);
        break;

      case 'notify_manager':
        await this.queueNotification(ticket.id, 'escalation', {
          target: rule.target,
          reason: 'sla_breach',
          ticket_id: ticket.id,
        });
        break;
    }

    if (Object.keys(updates).length > 1) {
      await db('tickets').where('id', ticket.id).update(updates);
    }

    // Add escalation note
    await db('ticket_comments').insert({
      id: uuidv4(),
      ticket_id: ticket.id,
      content: `Ticket escalated: ${rule.action} (SLA breach for ${rule.after_minutes} minutes)`,
      is_internal: true,
      author_type: 'system',
      created_at: new Date(),
    });
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(workspaceId = null) {
    try {
      const schedules = await this.getActiveSchedules('report', workspaceId);
      const results = [];

      for (const schedule of schedules) {
        const config = typeof schedule.config === 'string'
          ? JSON.parse(schedule.config)
          : schedule.config;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Gather stats
        const stats = await this.gatherDailyStats(schedule.workspace_id, yesterday, today);

        // Queue report email
        if (config.recipients && config.recipients.length > 0) {
          await this.queueNotification(null, 'daily_report', {
            workspace_id: schedule.workspace_id,
            recipients: config.recipients,
            stats,
            date: yesterday.toISOString().split('T')[0],
          });
        }

        results.push({
          schedule_id: schedule.id,
          workspace_id: schedule.workspace_id,
          report_generated: true,
        });

        await this.updateScheduleRun(schedule.id, 'success', null);
      }

      return {
        success: true,
        results,
      };
    } catch (error) {
      console.error('Error in generateDailyReport:', error);
      throw error;
    }
  }

  /**
   * Gather daily statistics
   */
  async gatherDailyStats(workspaceId, startDate, endDate) {
    const [
      created,
      closed,
      resolved,
      avgResponseTime,
      avgResolutionTime,
      slaStats,
    ] = await Promise.all([
      db('tickets')
        .where('workspace_id', workspaceId)
        .whereBetween('created_at', [startDate, endDate])
        .count('id as count')
        .first(),

      db('tickets')
        .where('workspace_id', workspaceId)
        .whereBetween('closed_at', [startDate, endDate])
        .count('id as count')
        .first(),

      db('tickets')
        .where('workspace_id', workspaceId)
        .whereBetween('resolved_at', [startDate, endDate])
        .count('id as count')
        .first(),

      db('tickets')
        .where('workspace_id', workspaceId)
        .whereNotNull('first_response_at')
        .whereBetween('first_response_at', [startDate, endDate])
        .select(db.raw('AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) as avg_minutes'))
        .first(),

      db('tickets')
        .where('workspace_id', workspaceId)
        .whereNotNull('resolved_at')
        .whereBetween('resolved_at', [startDate, endDate])
        .select(db.raw('AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_minutes'))
        .first(),

      require('./ticket-sla.service').getSLAStats(workspaceId, {
        startDate,
        endDate,
      }),
    ]);

    return {
      tickets_created: parseInt(created?.count || 0),
      tickets_closed: parseInt(closed?.count || 0),
      tickets_resolved: parseInt(resolved?.count || 0),
      avg_first_response_minutes: parseFloat(avgResponseTime?.avg_minutes || 0).toFixed(1),
      avg_resolution_minutes: parseFloat(avgResolutionTime?.avg_minutes || 0).toFixed(1),
      sla_compliance: slaStats.overall_compliance_rate,
    };
  }

  /**
   * Cleanup old tickets
   */
  async cleanupOldTickets(workspaceId = null) {
    try {
      const schedules = await this.getActiveSchedules('cleanup', workspaceId);
      const results = [];

      for (const schedule of schedules) {
        const config = typeof schedule.config === 'string'
          ? JSON.parse(schedule.config)
          : schedule.config;

        const monthsOld = config.months_old || 12;
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);

        // Archive old closed tickets
        const archivedCount = await db('tickets')
          .where('workspace_id', schedule.workspace_id)
          .where('status', 'closed')
          .where('closed_at', '<', cutoffDate)
          .update({ is_archived: true, updated_at: new Date() });

        // Optionally delete old attachments
        if (config.delete_attachments) {
          await db('ticket_attachments')
            .whereIn('ticket_id', function() {
              this.select('id')
                .from('tickets')
                .where('workspace_id', schedule.workspace_id)
                .where('is_archived', true);
            })
            .where('created_at', '<', cutoffDate)
            .delete();
        }

        results.push({
          schedule_id: schedule.id,
          workspace_id: schedule.workspace_id,
          tickets_archived: archivedCount,
        });

        await this.updateScheduleRun(schedule.id, 'success', null);
      }

      return {
        success: true,
        results,
        total_archived: results.reduce((sum, r) => sum + r.tickets_archived, 0),
      };
    } catch (error) {
      console.error('Error in cleanupOldTickets:', error);
      throw error;
    }
  }

  /**
   * Get active schedules for a type
   */
  async getActiveSchedules(scheduleType, workspaceId = null) {
    let query = db('ticket_schedules')
      .where('schedule_type', scheduleType)
      .where('is_active', true);

    if (workspaceId) {
      query = query.where('workspace_id', workspaceId);
    }

    return query;
  }

  /**
   * Update schedule run status
   */
  async updateScheduleRun(scheduleId, status, error) {
    const nextRun = await this.calculateNextRun(scheduleId);

    await db('ticket_schedules')
      .where('id', scheduleId)
      .update({
        last_run_at: new Date(),
        last_run_status: status,
        last_run_error: error,
        next_run_at: nextRun,
        run_count: db.raw('run_count + 1'),
        updated_at: new Date(),
      });
  }

  /**
   * Calculate next run time from cron expression
   */
  async calculateNextRun(scheduleId) {
    const schedule = await db('ticket_schedules').where('id', scheduleId).first();
    if (!schedule || !schedule.cron_expression) {
      return null;
    }

    // Simple cron parsing for common patterns
    // In production, use a library like 'cron-parser'
    const now = new Date();
    const parts = schedule.cron_expression.split(' ');

    if (parts.length >= 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      const next = new Date(now);
      next.setSeconds(0);
      next.setMilliseconds(0);

      // Handle hour
      if (hour !== '*') {
        next.setHours(parseInt(hour));
        if (minute !== '*') {
          next.setMinutes(parseInt(minute));
        }
      }

      // If already passed today, move to tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }

      return next;
    }

    // Default: run in 1 hour
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Queue notification for async processing
   */
  async queueNotification(ticketId, type, params) {
    try {
      await db('notification_queue').insert({
        id: uuidv4(),
        ticket_id: ticketId,
        type,
        params: JSON.stringify(params),
        status: 'pending',
        created_at: new Date(),
      });
    } catch (err) {
      console.log('Notification queued:', type, '(table may not exist)');
    }
  }

  /**
   * Create a schedule
   */
  async createSchedule(workspaceId, data) {
    const id = uuidv4();
    const nextRun = new Date();

    await db('ticket_schedules').insert({
      id,
      workspace_id: workspaceId,
      name: data.name,
      schedule_type: data.schedule_type,
      config: JSON.stringify(data.config || {}),
      cron_expression: data.cron_expression,
      is_active: data.is_active !== false,
      next_run_at: nextRun,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return this.getScheduleById(id);
  }

  /**
   * Update a schedule
   */
  async updateSchedule(scheduleId, data) {
    const updates = { updated_at: new Date() };

    if (data.name !== undefined) updates.name = data.name;
    if (data.config !== undefined) updates.config = JSON.stringify(data.config);
    if (data.cron_expression !== undefined) updates.cron_expression = data.cron_expression;
    if (data.is_active !== undefined) updates.is_active = data.is_active;

    await db('ticket_schedules').where('id', scheduleId).update(updates);
    return this.getScheduleById(scheduleId);
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId) {
    const deleted = await db('ticket_schedules').where('id', scheduleId).delete();
    return deleted > 0;
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(scheduleId) {
    const schedule = await db('ticket_schedules').where('id', scheduleId).first();
    if (schedule) {
      schedule.config = typeof schedule.config === 'string'
        ? JSON.parse(schedule.config)
        : schedule.config;
    }
    return schedule;
  }

  /**
   * Get all schedules for a workspace
   */
  async getSchedules(workspaceId) {
    const schedules = await db('ticket_schedules')
      .where('workspace_id', workspaceId)
      .orderBy('created_at', 'desc');

    return schedules.map(s => ({
      ...s,
      config: typeof s.config === 'string' ? JSON.parse(s.config) : s.config,
    }));
  }

  /**
   * Run a schedule manually
   */
  async runScheduleNow(scheduleId) {
    const schedule = await this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    let result;

    switch (schedule.schedule_type) {
      case 'auto_close':
        result = await this.autoCloseStaleTickets(schedule.workspace_id);
        break;
      case 'reminder':
        result = await this.sendPendingReminders(schedule.workspace_id);
        break;
      case 'escalation':
        result = await this.escalateBreachedTickets(schedule.workspace_id);
        break;
      case 'report':
        result = await this.generateDailyReport(schedule.workspace_id);
        break;
      case 'cleanup':
        result = await this.cleanupOldTickets(schedule.workspace_id);
        break;
      default:
        throw new Error(`Unknown schedule type: ${schedule.schedule_type}`);
    }

    return result;
  }
}

module.exports = new TicketSchedulerService();
