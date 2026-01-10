/**
 * Ticket Automation Jobs
 * Cron jobs for scheduled ticket operations
 */

const cron = require('node-cron');
const ticketScheduler = require('../services/ticket-scheduler.service');
const ticketSLA = require('../services/ticket-sla.service');

/**
 * Initialize all ticket-related cron jobs
 */
function initializeTicketJobs() {
  console.log('Initializing ticket automation jobs...');

  // Every 5 minutes - SLA breach alerts
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Ticket Jobs] Running SLA breach alerts check...');
    try {
      const result = await ticketScheduler.sendSLABreachAlerts();
      console.log(`[Ticket Jobs] SLA alerts: ${result.total_alerts} sent`);
    } catch (error) {
      console.error('[Ticket Jobs] SLA alerts error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Every hour - Auto-close stale tickets
  cron.schedule('0 * * * *', async () => {
    console.log('[Ticket Jobs] Running auto-close check...');
    try {
      const result = await ticketScheduler.autoCloseStaleTickets();
      console.log(`[Ticket Jobs] Auto-close: ${result.total_closed} tickets closed`);
    } catch (error) {
      console.error('[Ticket Jobs] Auto-close error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Every 4 hours - Pending ticket reminders
  cron.schedule('0 */4 * * *', async () => {
    console.log('[Ticket Jobs] Running pending reminders...');
    try {
      const result = await ticketScheduler.sendPendingReminders();
      console.log(`[Ticket Jobs] Reminders: ${result.total_reminders} sent`);
    } catch (error) {
      console.error('[Ticket Jobs] Reminders error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Daily at 9am UTC - Escalation check
  cron.schedule('0 9 * * *', async () => {
    console.log('[Ticket Jobs] Running escalation check...');
    try {
      const result = await ticketScheduler.escalateBreachedTickets();
      console.log(`[Ticket Jobs] Escalations: ${result.total_escalated} tickets escalated`);
    } catch (error) {
      console.error('[Ticket Jobs] Escalation error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Daily at 6pm UTC - Daily report
  cron.schedule('0 18 * * *', async () => {
    console.log('[Ticket Jobs] Generating daily reports...');
    try {
      const result = await ticketScheduler.generateDailyReport();
      console.log(`[Ticket Jobs] Reports: ${result.results.length} generated`);
    } catch (error) {
      console.error('[Ticket Jobs] Report error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Weekly Sunday at midnight - Cleanup old tickets
  cron.schedule('0 0 * * 0', async () => {
    console.log('[Ticket Jobs] Running weekly cleanup...');
    try {
      const result = await ticketScheduler.cleanupOldTickets();
      console.log(`[Ticket Jobs] Cleanup: ${result.total_archived} tickets archived`);
    } catch (error) {
      console.error('[Ticket Jobs] Cleanup error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  // Every 15 minutes - Process custom schedules
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processCustomSchedules();
    } catch (error) {
      console.error('[Ticket Jobs] Custom schedules error:', error.message);
    }
  }, {
    scheduled: true,
    timezone: 'UTC',
  });

  console.log('Ticket automation jobs initialized successfully');
}

/**
 * Process custom schedules that are due
 */
async function processCustomSchedules() {
  const db = require('../config/db');

  try {
    // Find schedules that are due
    const dueSchedules = await db('ticket_schedules')
      .where('is_active', true)
      .where('next_run_at', '<=', new Date())
      .orderBy('next_run_at', 'asc')
      .limit(10);

    for (const schedule of dueSchedules) {
      console.log(`[Ticket Jobs] Processing schedule: ${schedule.name} (${schedule.schedule_type})`);

      try {
        await ticketScheduler.runScheduleNow(schedule.id);
      } catch (error) {
        console.error(`[Ticket Jobs] Schedule ${schedule.id} error:`, error.message);

        // Update schedule with error
        await db('ticket_schedules')
          .where('id', schedule.id)
          .update({
            last_run_at: new Date(),
            last_run_status: 'failed',
            last_run_error: error.message,
          });
      }
    }
  } catch (error) {
    console.error('[Ticket Jobs] Error processing custom schedules:', error.message);
  }
}

/**
 * Run a specific job manually (for testing or admin purposes)
 */
async function runJob(jobName) {
  console.log(`[Ticket Jobs] Manually running job: ${jobName}`);

  switch (jobName) {
    case 'sla_alerts':
      return ticketScheduler.sendSLABreachAlerts();

    case 'auto_close':
      return ticketScheduler.autoCloseStaleTickets();

    case 'reminders':
      return ticketScheduler.sendPendingReminders();

    case 'escalation':
      return ticketScheduler.escalateBreachedTickets();

    case 'daily_report':
      return ticketScheduler.generateDailyReport();

    case 'cleanup':
      return ticketScheduler.cleanupOldTickets();

    case 'custom_schedules':
      return processCustomSchedules();

    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
}

/**
 * Get job status and next run times
 */
function getJobStatus() {
  const jobs = [
    { name: 'sla_alerts', schedule: '*/5 * * * *', description: 'SLA breach alerts' },
    { name: 'auto_close', schedule: '0 * * * *', description: 'Auto-close stale tickets' },
    { name: 'reminders', schedule: '0 */4 * * *', description: 'Pending ticket reminders' },
    { name: 'escalation', schedule: '0 9 * * *', description: 'Escalate breached tickets' },
    { name: 'daily_report', schedule: '0 18 * * *', description: 'Generate daily reports' },
    { name: 'cleanup', schedule: '0 0 * * 0', description: 'Clean up old tickets' },
    { name: 'custom_schedules', schedule: '*/15 * * * *', description: 'Process custom schedules' },
  ];

  return jobs.map(job => ({
    ...job,
    next_run: getNextRunTime(job.schedule),
  }));
}

/**
 * Calculate next run time from cron expression
 */
function getNextRunTime(cronExpression) {
  try {
    const interval = cron.schedule(cronExpression, () => {});
    // This is a simplified version - in production use cron-parser
    const now = new Date();
    return now.toISOString();
  } catch {
    return null;
  }
}

module.exports = {
  initializeTicketJobs,
  runJob,
  getJobStatus,
  processCustomSchedules,
};
