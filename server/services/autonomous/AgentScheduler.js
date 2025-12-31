/**
 * Agent Scheduler - Scheduled Task Execution System
 * Manages scheduled, recurring, and triggered agent tasks
 */

const db = require('../../db');
const log = require('../../utils/logger');
const AgentCore = require('./AgentCore');
const TaskExecutor = require('./TaskExecutor');

// Schedule configuration
const SCHEDULER_CONFIG = {
  checkInterval: parseInt(process.env.SCHEDULER_CHECK_INTERVAL) || 60000, // 1 minute
  maxConcurrentTasks: parseInt(process.env.SCHEDULER_MAX_CONCURRENT) || 10,
  retryDelay: parseInt(process.env.SCHEDULER_RETRY_DELAY) || 300000, // 5 minutes
  maxRetries: parseInt(process.env.SCHEDULER_MAX_RETRIES) || 3,
  taskTimeout: parseInt(process.env.SCHEDULER_TASK_TIMEOUT) || 3600000 // 1 hour
};

// Schedule types
const SCHEDULE_TYPES = {
  ONCE: 'once',
  RECURRING: 'recurring',
  CRON: 'cron',
  TRIGGER: 'trigger'
};

// Schedule status
const SCHEDULE_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Trigger types
const TRIGGER_TYPES = {
  WEBHOOK: 'webhook',
  EVENT: 'event',
  CONDITION: 'condition',
  CHAIN: 'chain' // Triggered by another task completion
};

class AgentScheduler {
  constructor() {
    this.isRunning = false;
    this.checkInterval = null;
    this.runningTasks = new Map();
    this.eventListeners = new Map();
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      log.warn('AgentScheduler: Already running');
      return;
    }

    this.isRunning = true;
    this.checkInterval = setInterval(
      () => this.checkScheduledTasks(),
      SCHEDULER_CONFIG.checkInterval
    );

    log.info('AgentScheduler: Started', {
      checkInterval: SCHEDULER_CONFIG.checkInterval
    });

    // Run initial check
    this.checkScheduledTasks();
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    log.info('AgentScheduler: Stopped');
  }

  /**
   * Create a scheduled task
   */
  async createSchedule(scheduleData) {
    const {
      agentId,
      userId,
      taskDescription,
      inputData = {},
      scheduleType = SCHEDULE_TYPES.ONCE,
      scheduleConfig = {},
      priority = 'normal',
      tags = []
    } = scheduleData;

    // Validate schedule config
    if (scheduleType === SCHEDULE_TYPES.ONCE && !scheduleConfig.executeAt) {
      throw new Error('executeAt is required for one-time schedules');
    }

    if (scheduleType === SCHEDULE_TYPES.RECURRING && !scheduleConfig.interval) {
      throw new Error('interval is required for recurring schedules');
    }

    if (scheduleType === SCHEDULE_TYPES.CRON && !scheduleConfig.cronExpression) {
      throw new Error('cronExpression is required for cron schedules');
    }

    const nextRun = this.calculateNextRun(scheduleType, scheduleConfig);

    const result = await db.query(
      `INSERT INTO agent_schedules
       (agent_id, user_id, task_description, input_data, schedule_type, schedule_config, priority, tags, next_run_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        agentId,
        userId,
        taskDescription,
        JSON.stringify(inputData),
        scheduleType,
        JSON.stringify(scheduleConfig),
        priority,
        JSON.stringify(tags),
        nextRun,
        SCHEDULE_STATUS.ACTIVE
      ]
    );

    log.info('AgentScheduler: Schedule created', {
      scheduleId: result.rows[0].id,
      agentId,
      scheduleType,
      nextRun
    });

    return this.parseSchedule(result.rows[0]);
  }

  /**
   * Calculate next run time based on schedule type
   */
  calculateNextRun(type, config) {
    const now = new Date();

    switch (type) {
      case SCHEDULE_TYPES.ONCE:
        return new Date(config.executeAt);

      case SCHEDULE_TYPES.RECURRING:
        const intervalMs = this.parseInterval(config.interval);
        return new Date(now.getTime() + intervalMs);

      case SCHEDULE_TYPES.CRON:
        return this.getNextCronTime(config.cronExpression);

      case SCHEDULE_TYPES.TRIGGER:
        return null; // Triggered manually

      default:
        return null;
    }
  }

  /**
   * Parse interval string to milliseconds
   */
  parseInterval(interval) {
    const units = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
      w: 604800000
    };

    const match = interval.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`Invalid interval format: ${interval}`);
    }

    return parseInt(match[1]) * units[match[2]];
  }

  /**
   * Get next cron execution time (simplified implementation)
   */
  getNextCronTime(cronExpression) {
    // Simplified cron parsing - for full support, use a library like node-cron
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const now = new Date();
    const next = new Date(now);

    // Simple implementation for common patterns
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    if (minute !== '*') next.setMinutes(parseInt(minute));
    if (hour !== '*') next.setHours(parseInt(hour));

    // If the calculated time is in the past, add appropriate interval
    if (next <= now) {
      if (hour === '*' && minute !== '*') {
        next.setHours(next.getHours() + 1);
      } else if (hour !== '*') {
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  /**
   * Check and execute scheduled tasks
   */
  async checkScheduledTasks() {
    if (!this.isRunning) return;

    try {
      // Get due schedules
      const result = await db.query(
        `SELECT * FROM agent_schedules
         WHERE status = $1
         AND next_run_at <= NOW()
         AND (last_run_at IS NULL OR last_run_at < next_run_at)
         ORDER BY priority DESC, next_run_at ASC
         LIMIT $2`,
        [SCHEDULE_STATUS.ACTIVE, SCHEDULER_CONFIG.maxConcurrentTasks - this.runningTasks.size]
      );

      for (const row of result.rows) {
        const schedule = this.parseSchedule(row);
        if (!this.runningTasks.has(schedule.id)) {
          this.executeScheduledTask(schedule);
        }
      }

    } catch (error) {
      log.error('AgentScheduler: Check failed', { error: error.message });
    }
  }

  /**
   * Execute a scheduled task
   */
  async executeScheduledTask(schedule) {
    this.runningTasks.set(schedule.id, {
      schedule,
      startTime: new Date()
    });

    try {
      log.info('AgentScheduler: Executing scheduled task', {
        scheduleId: schedule.id,
        agentId: schedule.agent_id
      });

      // Get the agent
      const agent = await AgentCore.findById(schedule.agent_id);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Create task executor
      const executor = new TaskExecutor(agent);

      // Create and execute task
      const task = await TaskExecutor.createTask(
        agent.id,
        schedule.task_description,
        schedule.input_data
      );

      const result = await executor.execute(task.id);

      // Update schedule
      await this.updateScheduleAfterRun(schedule, true, result);

      // Handle chained triggers
      if (schedule.schedule_config.triggerOnComplete) {
        await this.handleChainedTriggers(schedule, result);
      }

      log.info('AgentScheduler: Task completed', {
        scheduleId: schedule.id,
        taskId: task.id
      });

    } catch (error) {
      log.error('AgentScheduler: Task failed', {
        scheduleId: schedule.id,
        error: error.message
      });

      await this.updateScheduleAfterRun(schedule, false, null, error.message);

    } finally {
      this.runningTasks.delete(schedule.id);
    }
  }

  /**
   * Update schedule after execution
   */
  async updateScheduleAfterRun(schedule, success, result, error = null) {
    const updates = {
      last_run_at: new Date(),
      run_count: (schedule.run_count || 0) + 1
    };

    if (success) {
      updates.success_count = (schedule.success_count || 0) + 1;
      updates.last_result = JSON.stringify(result);
    } else {
      updates.failure_count = (schedule.failure_count || 0) + 1;
      updates.last_error = error;

      // Check retry logic
      if (schedule.failure_count >= SCHEDULER_CONFIG.maxRetries) {
        updates.status = SCHEDULE_STATUS.FAILED;
      }
    }

    // Calculate next run for recurring schedules
    if (schedule.schedule_type === SCHEDULE_TYPES.RECURRING && success) {
      updates.next_run_at = this.calculateNextRun(
        schedule.schedule_type,
        schedule.schedule_config
      );
    } else if (schedule.schedule_type === SCHEDULE_TYPES.CRON) {
      updates.next_run_at = this.getNextCronTime(schedule.schedule_config.cronExpression);
    } else if (schedule.schedule_type === SCHEDULE_TYPES.ONCE) {
      updates.status = SCHEDULE_STATUS.COMPLETED;
    }

    const setClause = Object.entries(updates)
      .map(([key, _], i) => `${key} = $${i + 1}`)
      .join(', ');

    await db.query(
      `UPDATE agent_schedules SET ${setClause} WHERE id = $${Object.keys(updates).length + 1}`,
      [...Object.values(updates), schedule.id]
    );
  }

  /**
   * Handle chained trigger execution
   */
  async handleChainedTriggers(completedSchedule, result) {
    const result2 = await db.query(
      `SELECT * FROM agent_schedules
       WHERE schedule_type = $1
       AND schedule_config->>'triggerOnSchedule' = $2
       AND status = $3`,
      [SCHEDULE_TYPES.TRIGGER, completedSchedule.id.toString(), SCHEDULE_STATUS.ACTIVE]
    );

    for (const row of result2.rows) {
      const chainedSchedule = this.parseSchedule(row);
      chainedSchedule.input_data = {
        ...chainedSchedule.input_data,
        triggeredBy: completedSchedule.id,
        previousResult: result
      };

      this.executeScheduledTask(chainedSchedule);
    }
  }

  /**
   * Trigger a schedule manually
   */
  async trigger(scheduleId, additionalInput = {}) {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    schedule.input_data = { ...schedule.input_data, ...additionalInput };
    return this.executeScheduledTask(schedule);
  }

  /**
   * Trigger by event
   */
  async triggerByEvent(eventName, eventData) {
    const result = await db.query(
      `SELECT * FROM agent_schedules
       WHERE schedule_type = $1
       AND schedule_config->>'eventName' = $2
       AND status = $3`,
      [SCHEDULE_TYPES.TRIGGER, eventName, SCHEDULE_STATUS.ACTIVE]
    );

    const triggered = [];
    for (const row of result.rows) {
      const schedule = this.parseSchedule(row);
      schedule.input_data = { ...schedule.input_data, event: eventData };
      triggered.push(this.executeScheduledTask(schedule));
    }

    return Promise.all(triggered);
  }

  /**
   * Get schedule by ID
   */
  async getSchedule(scheduleId) {
    const result = await db.query(
      `SELECT * FROM agent_schedules WHERE id = $1`,
      [scheduleId]
    );

    return result.rows.length > 0 ? this.parseSchedule(result.rows[0]) : null;
  }

  /**
   * Get schedules for an agent
   */
  async getAgentSchedules(agentId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = `SELECT * FROM agent_schedules WHERE agent_id = $1`;
    const params = [agentId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY next_run_at ASC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows.map(this.parseSchedule);
  }

  /**
   * Get schedules for a user
   */
  async getUserSchedules(userId, options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = `SELECT * FROM agent_schedules WHERE user_id = $1`;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY next_run_at ASC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows.map(this.parseSchedule);
  }

  /**
   * Pause a schedule
   */
  async pauseSchedule(scheduleId) {
    await db.query(
      `UPDATE agent_schedules SET status = $1 WHERE id = $2`,
      [SCHEDULE_STATUS.PAUSED, scheduleId]
    );
    return true;
  }

  /**
   * Resume a paused schedule
   */
  async resumeSchedule(scheduleId) {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const nextRun = this.calculateNextRun(
      schedule.schedule_type,
      schedule.schedule_config
    );

    await db.query(
      `UPDATE agent_schedules SET status = $1, next_run_at = $2 WHERE id = $3`,
      [SCHEDULE_STATUS.ACTIVE, nextRun, scheduleId]
    );

    return true;
  }

  /**
   * Cancel a schedule
   */
  async cancelSchedule(scheduleId) {
    await db.query(
      `UPDATE agent_schedules SET status = $1 WHERE id = $2`,
      [SCHEDULE_STATUS.CANCELLED, scheduleId]
    );
    return true;
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId) {
    await db.query(
      `DELETE FROM agent_schedules WHERE id = $1`,
      [scheduleId]
    );
    return true;
  }

  /**
   * Get scheduler statistics
   */
  async getStats() {
    const result = await db.query(
      `SELECT
        status,
        schedule_type,
        COUNT(*) as count,
        SUM(run_count) as total_runs,
        SUM(success_count) as total_success,
        SUM(failure_count) as total_failures
       FROM agent_schedules
       GROUP BY status, schedule_type`
    );

    return {
      byStatus: result.rows.reduce((acc, row) => {
        acc[row.status] = acc[row.status] || {};
        acc[row.status][row.schedule_type] = {
          count: parseInt(row.count),
          totalRuns: parseInt(row.total_runs || 0),
          totalSuccess: parseInt(row.total_success || 0),
          totalFailures: parseInt(row.total_failures || 0)
        };
        return acc;
      }, {}),
      runningTasks: this.runningTasks.size,
      isRunning: this.isRunning
    };
  }

  /**
   * Get upcoming schedules
   */
  async getUpcoming(limit = 10) {
    const result = await db.query(
      `SELECT * FROM agent_schedules
       WHERE status = $1 AND next_run_at IS NOT NULL
       ORDER BY next_run_at ASC
       LIMIT $2`,
      [SCHEDULE_STATUS.ACTIVE, limit]
    );

    return result.rows.map(this.parseSchedule);
  }

  /**
   * Parse schedule from database row
   */
  parseSchedule(row) {
    if (!row) return null;

    return {
      ...row,
      input_data: typeof row.input_data === 'string' ? JSON.parse(row.input_data) : row.input_data || {},
      schedule_config: typeof row.schedule_config === 'string' ? JSON.parse(row.schedule_config) : row.schedule_config || {},
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [],
      last_result: row.last_result ? (typeof row.last_result === 'string' ? JSON.parse(row.last_result) : row.last_result) : null
    };
  }
}

// Create singleton instance
const scheduler = new AgentScheduler();

// Export class and instance
AgentScheduler.instance = scheduler;
AgentScheduler.TYPES = SCHEDULE_TYPES;
AgentScheduler.STATUS = SCHEDULE_STATUS;
AgentScheduler.TRIGGERS = TRIGGER_TYPES;
AgentScheduler.CONFIG = SCHEDULER_CONFIG;

module.exports = AgentScheduler;
