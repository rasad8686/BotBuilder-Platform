/**
 * TaskScheduler (AgentScheduler) Tests
 * Comprehensive tests for the scheduled task execution system
 */

// Mock dependencies
jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../services/autonomous/AgentCore', () => ({
  findById: jest.fn()
}));

jest.mock('../../../services/autonomous/TaskExecutor', () => {
  const mockExecutor = {
    execute: jest.fn(() => Promise.resolve({ success: true, result: 'test result' }))
  };
  return jest.fn(() => mockExecutor);
});

// Mock TaskExecutor.createTask as a static method
const TaskExecutor = require('../../../services/autonomous/TaskExecutor');
TaskExecutor.createTask = jest.fn(() => Promise.resolve({ id: 'task-123' }));

const db = require('../../../db');
const log = require('../../../utils/logger');
const AgentCore = require('../../../services/autonomous/AgentCore');
const AgentScheduler = require('../../../services/autonomous/AgentScheduler');

describe('AgentScheduler (TaskScheduler)', () => {
  let scheduler;

  beforeEach(() => {
    scheduler = new AgentScheduler();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (scheduler.isRunning) {
      scheduler.stop();
    }
    jest.useRealTimers();
  });

  // ============================================================================
  // 1. Constructor Tests
  // ============================================================================

  describe('constructor', () => {
    it('should initialize with default state', () => {
      const newScheduler = new AgentScheduler();
      expect(newScheduler.isRunning).toBe(false);
      expect(newScheduler.checkInterval).toBeNull();
      expect(newScheduler.runningTasks).toBeInstanceOf(Map);
      expect(newScheduler.eventListeners).toBeInstanceOf(Map);
    });

    it('should initialize empty runningTasks map', () => {
      expect(scheduler.runningTasks.size).toBe(0);
    });

    it('should initialize empty eventListeners map', () => {
      expect(scheduler.eventListeners.size).toBe(0);
    });

    it('should not start automatically', () => {
      expect(scheduler.isRunning).toBe(false);
      expect(scheduler.checkInterval).toBeNull();
    });
  });

  // ============================================================================
  // 2. Start/Stop Tests
  // ============================================================================

  describe('start', () => {
    it('should start the scheduler', () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.start();

      expect(scheduler.isRunning).toBe(true);
      expect(scheduler.checkInterval).not.toBeNull();
      expect(log.info).toHaveBeenCalledWith(
        'AgentScheduler: Started',
        expect.any(Object)
      );
    });

    it('should set up check interval', () => {
      db.query.mockResolvedValue({ rows: [] });
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      scheduler.start();

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        AgentScheduler.CONFIG.checkInterval
      );
    });

    it('should run initial check on start', () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.start();

      expect(db.query).toHaveBeenCalled();
    });

    it('should warn if already running', () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.start();
      scheduler.start();

      expect(log.warn).toHaveBeenCalledWith('AgentScheduler: Already running');
    });

    it('should not create duplicate intervals', () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.start();
      const firstInterval = scheduler.checkInterval;
      scheduler.start();

      expect(scheduler.checkInterval).toBe(firstInterval);
    });
  });

  describe('stop', () => {
    it('should stop the scheduler', () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.start();
      scheduler.stop();

      expect(scheduler.isRunning).toBe(false);
      expect(scheduler.checkInterval).toBeNull();
      expect(log.info).toHaveBeenCalledWith('AgentScheduler: Stopped');
    });

    it('should clear the check interval', () => {
      db.query.mockResolvedValue({ rows: [] });
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      scheduler.start();
      const intervalId = scheduler.checkInterval;
      scheduler.stop();

      expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId);
    });

    it('should handle stop when not running', () => {
      scheduler.stop();
      expect(scheduler.isRunning).toBe(false);
    });

    it('should not log when stopping inactive scheduler', () => {
      scheduler.stop();
      expect(log.info).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 3. Create Schedule Tests
  // ============================================================================

  describe('createSchedule', () => {
    const mockScheduleData = {
      agentId: 1,
      userId: 100,
      taskDescription: 'Test task',
      inputData: { key: 'value' },
      scheduleType: 'once',
      scheduleConfig: { executeAt: new Date('2026-01-02T10:00:00Z') },
      priority: 'high',
      tags: ['test']
    };

    it('should create a one-time schedule', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          agent_id: 1,
          user_id: 100,
          task_description: 'Test task',
          input_data: '{"key":"value"}',
          schedule_type: 'once',
          schedule_config: '{"executeAt":"2026-01-02T10:00:00Z"}',
          priority: 'high',
          tags: '["test"]',
          status: 'active',
          next_run_at: new Date('2026-01-02T10:00:00Z')
        }]
      };

      db.query.mockResolvedValue(mockResult);

      const result = await scheduler.createSchedule(mockScheduleData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_schedules'),
        expect.arrayContaining([1, 100, 'Test task'])
      );
      expect(result.id).toBe(1);
      expect(log.info).toHaveBeenCalledWith(
        'AgentScheduler: Schedule created',
        expect.any(Object)
      );
    });

    it('should create a recurring schedule', async () => {
      const recurringData = {
        ...mockScheduleData,
        scheduleType: 'recurring',
        scheduleConfig: { interval: '1h' }
      };

      const mockResult = {
        rows: [{
          id: 2,
          schedule_type: 'recurring',
          schedule_config: '{"interval":"1h"}',
          input_data: '{}',
          tags: '[]',
          status: 'active'
        }]
      };

      db.query.mockResolvedValue(mockResult);

      const result = await scheduler.createSchedule(recurringData);

      expect(result.schedule_type).toBe('recurring');
    });

    it('should create a cron schedule', async () => {
      const cronData = {
        ...mockScheduleData,
        scheduleType: 'cron',
        scheduleConfig: { cronExpression: '0 9 * * *' }
      };

      const mockResult = {
        rows: [{
          id: 3,
          schedule_type: 'cron',
          schedule_config: '{"cronExpression":"0 9 * * *"}',
          input_data: '{}',
          tags: '[]',
          status: 'active'
        }]
      };

      db.query.mockResolvedValue(mockResult);

      const result = await scheduler.createSchedule(cronData);

      expect(result.schedule_type).toBe('cron');
    });

    it('should throw error if executeAt missing for once type', async () => {
      const invalidData = {
        ...mockScheduleData,
        scheduleType: 'once',
        scheduleConfig: {}
      };

      await expect(scheduler.createSchedule(invalidData))
        .rejects.toThrow('executeAt is required for one-time schedules');
    });

    it('should throw error if interval missing for recurring type', async () => {
      const invalidData = {
        ...mockScheduleData,
        scheduleType: 'recurring',
        scheduleConfig: {}
      };

      await expect(scheduler.createSchedule(invalidData))
        .rejects.toThrow('interval is required for recurring schedules');
    });

    it('should throw error if cronExpression missing for cron type', async () => {
      const invalidData = {
        ...mockScheduleData,
        scheduleType: 'cron',
        scheduleConfig: {}
      };

      await expect(scheduler.createSchedule(invalidData))
        .rejects.toThrow('cronExpression is required for cron schedules');
    });

    it('should use default values for optional parameters', async () => {
      const minimalData = {
        agentId: 1,
        userId: 100,
        taskDescription: 'Test',
        scheduleType: 'once',
        scheduleConfig: { executeAt: new Date() }
      };

      const mockResult = {
        rows: [{
          id: 4,
          input_data: '{}',
          schedule_config: '{}',
          tags: '[]',
          priority: 'normal',
          status: 'active'
        }]
      };

      db.query.mockResolvedValue(mockResult);

      await scheduler.createSchedule(minimalData);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['normal'])
      );
    });

    it('should handle JSON stringification of complex data', async () => {
      const complexData = {
        ...mockScheduleData,
        inputData: { nested: { deeply: { value: 'test' } } },
        tags: ['tag1', 'tag2', 'tag3']
      };

      const mockResult = {
        rows: [{
          id: 5,
          input_data: '{"nested":{"deeply":{"value":"test"}}}',
          tags: '["tag1","tag2","tag3"]',
          schedule_config: '{}',
          status: 'active'
        }]
      };

      db.query.mockResolvedValue(mockResult);

      const result = await scheduler.createSchedule(complexData);

      expect(result.input_data).toEqual({ nested: { deeply: { value: 'test' } } });
      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });
  });

  // ============================================================================
  // 4. Calculate Next Run Tests
  // ============================================================================

  describe('calculateNextRun', () => {
    it('should calculate next run for once type', () => {
      const executeAt = new Date('2026-01-02T10:00:00Z');
      const result = scheduler.calculateNextRun('once', { executeAt });

      expect(result).toEqual(executeAt);
    });

    it('should calculate next run for recurring type', () => {
      const before = Date.now();
      const result = scheduler.calculateNextRun('recurring', { interval: '1h' });
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThan(before);
      expect(result.getTime()).toBeLessThanOrEqual(after + 3600000);
    });

    it('should calculate next run for cron type', () => {
      const result = scheduler.calculateNextRun('cron', { cronExpression: '0 9 * * *' });

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for trigger type', () => {
      const result = scheduler.calculateNextRun('trigger', {});

      expect(result).toBeNull();
    });

    it('should return null for unknown type', () => {
      const result = scheduler.calculateNextRun('unknown', {});

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 5. Parse Interval Tests
  // ============================================================================

  describe('parseInterval', () => {
    it('should parse seconds', () => {
      expect(scheduler.parseInterval('30s')).toBe(30000);
    });

    it('should parse minutes', () => {
      expect(scheduler.parseInterval('5m')).toBe(300000);
    });

    it('should parse hours', () => {
      expect(scheduler.parseInterval('2h')).toBe(7200000);
    });

    it('should parse days', () => {
      expect(scheduler.parseInterval('1d')).toBe(86400000);
    });

    it('should parse weeks', () => {
      expect(scheduler.parseInterval('1w')).toBe(604800000);
    });

    it('should throw error for invalid format', () => {
      expect(() => scheduler.parseInterval('invalid'))
        .toThrow('Invalid interval format: invalid');
    });

    it('should throw error for missing unit', () => {
      expect(() => scheduler.parseInterval('10'))
        .toThrow('Invalid interval format: 10');
    });

    it('should throw error for invalid unit', () => {
      expect(() => scheduler.parseInterval('10x'))
        .toThrow('Invalid interval format: 10x');
    });

    it('should handle large numbers', () => {
      expect(scheduler.parseInterval('1000h')).toBe(3600000000);
    });
  });

  // ============================================================================
  // 6. Cron Expression Tests
  // ============================================================================

  describe('getNextCronTime', () => {
    it('should parse valid cron expression', () => {
      const result = scheduler.getNextCronTime('30 9 * * *');

      expect(result).toBeInstanceOf(Date);
    });

    it('should throw error for invalid cron expression', () => {
      expect(() => scheduler.getNextCronTime('invalid'))
        .toThrow('Invalid cron expression');
    });

    it('should throw error for too few parts', () => {
      expect(() => scheduler.getNextCronTime('0 9 *'))
        .toThrow('Invalid cron expression');
    });

    it('should throw error for too many parts', () => {
      expect(() => scheduler.getNextCronTime('0 9 * * * * extra'))
        .toThrow('Invalid cron expression');
    });

    it('should handle wildcard minutes', () => {
      const result = scheduler.getNextCronTime('* 9 * * *');

      expect(result).toBeInstanceOf(Date);
    });

    it('should handle wildcard hours', () => {
      const result = scheduler.getNextCronTime('30 * * * *');

      expect(result).toBeInstanceOf(Date);
    });

    it('should calculate future time', () => {
      const now = new Date();
      const result = scheduler.getNextCronTime('0 9 * * *');

      expect(result.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle specific minute and hour', () => {
      const result = scheduler.getNextCronTime('15 10 * * *');

      expect(result.getMinutes()).toBe(15);
      expect(result.getHours()).toBe(10);
    });
  });

  // ============================================================================
  // 7. Check Scheduled Tasks Tests
  // ============================================================================

  describe('checkScheduledTasks', () => {
    it('should query for due schedules', async () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.isRunning = true;

      await scheduler.checkScheduledTasks();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1'),
        expect.arrayContaining(['active'])
      );
    });

    it('should not check if scheduler not running', async () => {
      scheduler.isRunning = false;

      await scheduler.checkScheduledTasks();

      expect(db.query).not.toHaveBeenCalled();
    });

    it('should execute due tasks', async () => {
      const mockTask = {
        id: 1,
        agent_id: 1,
        user_id: 100,
        task_description: 'Test',
        input_data: '{}',
        schedule_config: '{}',
        tags: '[]',
        schedule_type: 'once',
        status: 'active'
      };

      db.query.mockResolvedValue({ rows: [mockTask] });
      AgentCore.findById.mockResolvedValue({ id: 1, name: 'Test Agent' });
      scheduler.isRunning = true;

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.checkScheduledTasks();

      expect(scheduler.executeScheduledTask).toHaveBeenCalled();
    });

    it('should respect concurrent task limit', async () => {
      const mockTasks = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        agent_id: 1,
        input_data: '{}',
        schedule_config: '{}',
        tags: '[]',
        status: 'active'
      }));

      db.query.mockResolvedValue({ rows: mockTasks });
      scheduler.isRunning = true;

      await scheduler.checkScheduledTasks();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'active',
          AgentScheduler.CONFIG.maxConcurrentTasks
        ])
      );
    });

    it('should handle errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));
      scheduler.isRunning = true;

      await scheduler.checkScheduledTasks();

      expect(log.error).toHaveBeenCalledWith(
        'AgentScheduler: Check failed',
        expect.any(Object)
      );
    });

    it('should skip already running tasks', async () => {
      const mockTask = {
        id: 1,
        agent_id: 1,
        input_data: '{}',
        schedule_config: '{}',
        tags: '[]'
      };

      scheduler.runningTasks.set(1, { schedule: mockTask, startTime: new Date() });
      db.query.mockResolvedValue({ rows: [mockTask] });
      scheduler.isRunning = true;

      jest.spyOn(scheduler, 'executeScheduledTask');

      await scheduler.checkScheduledTasks();

      expect(scheduler.executeScheduledTask).not.toHaveBeenCalled();
    });

    it('should order tasks by priority', async () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.isRunning = true;

      await scheduler.checkScheduledTasks();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY priority DESC'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // 8. Execute Scheduled Task Tests
  // ============================================================================

  describe('executeScheduledTask', () => {
    const mockSchedule = {
      id: 1,
      agent_id: 1,
      user_id: 100,
      task_description: 'Test task',
      input_data: {},
      schedule_type: 'once',
      schedule_config: {},
      status: 'active'
    };

    beforeEach(() => {
      AgentCore.findById.mockResolvedValue({ id: 1, name: 'Test Agent' });
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });
    });

    it('should execute a scheduled task', async () => {
      await scheduler.executeScheduledTask(mockSchedule);

      expect(AgentCore.findById).toHaveBeenCalledWith(1);
      expect(TaskExecutor.createTask).toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        'AgentScheduler: Executing scheduled task',
        expect.any(Object)
      );
    });

    it('should add task to running tasks', async () => {
      const executePromise = scheduler.executeScheduledTask(mockSchedule);

      // Check immediately that it was added
      expect(scheduler.runningTasks.has(1)).toBe(true);

      await executePromise;
    });

    it('should remove task from running tasks after completion', async () => {
      await scheduler.executeScheduledTask(mockSchedule);

      expect(scheduler.runningTasks.has(1)).toBe(false);
    });

    it('should handle agent not found', async () => {
      AgentCore.findById.mockResolvedValue(null);

      await scheduler.executeScheduledTask(mockSchedule);

      expect(log.error).toHaveBeenCalledWith(
        'AgentScheduler: Task failed',
        expect.objectContaining({
          error: 'Agent not found'
        })
      );
    });

    it('should update schedule after successful execution', async () => {
      jest.spyOn(scheduler, 'updateScheduleAfterRun').mockResolvedValue();

      await scheduler.executeScheduledTask(mockSchedule);

      expect(scheduler.updateScheduleAfterRun).toHaveBeenCalledWith(
        mockSchedule,
        true,
        expect.any(Object)
      );
    });

    it('should update schedule after failed execution', async () => {
      TaskExecutor.createTask.mockRejectedValue(new Error('Task failed'));
      jest.spyOn(scheduler, 'updateScheduleAfterRun').mockResolvedValue();

      await scheduler.executeScheduledTask(mockSchedule);

      expect(scheduler.updateScheduleAfterRun).toHaveBeenCalledWith(
        mockSchedule,
        false,
        null,
        'Task failed'
      );
    });

    it('should handle chained triggers', async () => {
      const scheduleWithTrigger = {
        ...mockSchedule,
        schedule_config: { triggerOnComplete: true }
      };

      jest.spyOn(scheduler, 'handleChainedTriggers').mockResolvedValue();

      await scheduler.executeScheduledTask(scheduleWithTrigger);

      expect(scheduler.handleChainedTriggers).toHaveBeenCalled();
    });

    it('should track start time', async () => {
      const before = Date.now();
      const executePromise = scheduler.executeScheduledTask(mockSchedule);

      const runningTask = scheduler.runningTasks.get(1);
      expect(runningTask.startTime).toBeInstanceOf(Date);
      expect(runningTask.startTime.getTime()).toBeGreaterThanOrEqual(before);

      await executePromise;
    });

    it('should log completion', async () => {
      await scheduler.executeScheduledTask(mockSchedule);

      expect(log.info).toHaveBeenCalledWith(
        'AgentScheduler: Task completed',
        expect.objectContaining({
          scheduleId: 1,
          taskId: 'task-123'
        })
      );
    });

    it('should always remove from running tasks even on error', async () => {
      AgentCore.findById.mockRejectedValue(new Error('Unexpected error'));

      await scheduler.executeScheduledTask(mockSchedule);

      expect(scheduler.runningTasks.has(1)).toBe(false);
    });
  });

  // ============================================================================
  // 9. Update Schedule After Run Tests
  // ============================================================================

  describe('updateScheduleAfterRun', () => {
    const mockSchedule = {
      id: 1,
      schedule_type: 'once',
      schedule_config: {},
      run_count: 0,
      success_count: 0,
      failure_count: 0
    };

    it('should update last_run_at', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(mockSchedule, true, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('last_run_at = $1'),
        expect.arrayContaining([expect.any(Date), 1])
      );
    });

    it('should increment run_count', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(mockSchedule, true, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('run_count = $'),
        expect.arrayContaining([1])
      );
    });

    it('should increment success_count on success', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(mockSchedule, true, { data: 'test' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('success_count = $'),
        expect.any(Array)
      );
    });

    it('should increment failure_count on failure', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(mockSchedule, false, null, 'Error message');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('failure_count = $'),
        expect.any(Array)
      );
    });

    it('should store last_result on success', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const result = { data: 'test result' };

      await scheduler.updateScheduleAfterRun(mockSchedule, true, result);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('last_result = $'),
        expect.arrayContaining([JSON.stringify(result)])
      );
    });

    it('should store last_error on failure', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(mockSchedule, false, null, 'Test error');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('last_error = $'),
        expect.arrayContaining(['Test error'])
      );
    });

    it('should mark one-time schedules as completed', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(mockSchedule, true, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['completed'])
      );
    });

    it('should calculate next run for recurring schedules', async () => {
      const recurringSchedule = {
        ...mockSchedule,
        schedule_type: 'recurring',
        schedule_config: { interval: '1h' }
      };

      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(recurringSchedule, true, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('next_run_at = $'),
        expect.any(Array)
      );
    });

    it('should calculate next run for cron schedules', async () => {
      const cronSchedule = {
        ...mockSchedule,
        schedule_type: 'cron',
        schedule_config: { cronExpression: '0 9 * * *' }
      };

      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(cronSchedule, true, {});

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('next_run_at = $'),
        expect.any(Array)
      );
    });

    it('should mark as failed after max retries', async () => {
      const failedSchedule = {
        ...mockSchedule,
        failure_count: AgentScheduler.CONFIG.maxRetries
      };

      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(failedSchedule, false, null, 'Error');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $'),
        expect.arrayContaining(['failed'])
      );
    });

    it('should not update next_run for recurring on failure', async () => {
      const recurringSchedule = {
        ...mockSchedule,
        schedule_type: 'recurring',
        schedule_config: { interval: '1h' }
      };

      db.query.mockResolvedValue({ rows: [] });

      await scheduler.updateScheduleAfterRun(recurringSchedule, false, null, 'Error');

      const callArgs = db.query.mock.calls[0][0];
      expect(callArgs).not.toContain('next_run_at');
    });
  });

  // ============================================================================
  // 10. Pause/Resume/Cancel Tests
  // ============================================================================

  describe('pauseSchedule', () => {
    it('should pause a schedule', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await scheduler.pauseSchedule(1);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_schedules'),
        ['paused', 1]
      );
    });

    it('should update status to paused', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.pauseSchedule(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['paused'])
      );
    });
  });

  describe('resumeSchedule', () => {
    const mockSchedule = {
      id: 1,
      schedule_type: 'recurring',
      schedule_config: { interval: '1h' },
      input_data: {},
      tags: []
    };

    it('should resume a paused schedule', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockSchedule] })
                .mockResolvedValueOnce({ rows: [] });

      const result = await scheduler.resumeSchedule(1);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_schedules'),
        expect.arrayContaining(['active'])
      );
    });

    it('should calculate new next_run_at', async () => {
      db.query.mockResolvedValueOnce({ rows: [mockSchedule] })
                .mockResolvedValueOnce({ rows: [] });

      await scheduler.resumeSchedule(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['active', expect.any(Date), 1])
      );
    });

    it('should throw error if schedule not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(scheduler.resumeSchedule(999))
        .rejects.toThrow('Schedule not found');
    });
  });

  describe('cancelSchedule', () => {
    it('should cancel a schedule', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await scheduler.cancelSchedule(1);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_schedules'),
        ['cancelled', 1]
      );
    });

    it('should update status to cancelled', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.cancelSchedule(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('status = $1'),
        expect.arrayContaining(['cancelled'])
      );
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await scheduler.deleteSchedule(1);

      expect(result).toBe(true);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agent_schedules'),
        [1]
      );
    });
  });

  // ============================================================================
  // 11. Trigger Tests
  // ============================================================================

  describe('trigger', () => {
    const mockSchedule = {
      id: 1,
      agent_id: 1,
      input_data: { original: 'data' },
      schedule_config: {},
      tags: []
    };

    it('should manually trigger a schedule', async () => {
      db.query.mockResolvedValue({ rows: [mockSchedule] });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.trigger(1, { additional: 'input' });

      expect(scheduler.executeScheduledTask).toHaveBeenCalledWith(
        expect.objectContaining({
          input_data: { original: 'data', additional: 'input' }
        })
      );
    });

    it('should merge additional input data', async () => {
      db.query.mockResolvedValue({ rows: [mockSchedule] });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.trigger(1, { key: 'value' });

      expect(scheduler.executeScheduledTask).toHaveBeenCalledWith(
        expect.objectContaining({
          input_data: expect.objectContaining({ key: 'value' })
        })
      );
    });

    it('should throw error if schedule not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(scheduler.trigger(999))
        .rejects.toThrow('Schedule not found');
    });
  });

  describe('triggerByEvent', () => {
    it('should trigger schedules by event name', async () => {
      const mockSchedules = [
        {
          id: 1,
          schedule_type: 'trigger',
          schedule_config: '{"eventName":"test.event"}',
          input_data: '{}',
          tags: '[]'
        },
        {
          id: 2,
          schedule_type: 'trigger',
          schedule_config: '{"eventName":"test.event"}',
          input_data: '{}',
          tags: '[]'
        }
      ];

      db.query.mockResolvedValue({ rows: mockSchedules });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.triggerByEvent('test.event', { eventData: 'value' });

      expect(scheduler.executeScheduledTask).toHaveBeenCalledTimes(2);
    });

    it('should pass event data to schedules', async () => {
      const mockSchedule = {
        id: 1,
        schedule_type: 'trigger',
        schedule_config: '{"eventName":"test.event"}',
        input_data: '{}',
        tags: '[]'
      };

      db.query.mockResolvedValue({ rows: [mockSchedule] });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      const eventData = { key: 'value' };
      await scheduler.triggerByEvent('test.event', eventData);

      expect(scheduler.executeScheduledTask).toHaveBeenCalledWith(
        expect.objectContaining({
          input_data: { event: eventData }
        })
      );
    });

    it('should return array of triggered executions', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await scheduler.triggerByEvent('test.event', {});

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('handleChainedTriggers', () => {
    it('should execute chained schedules', async () => {
      const completedSchedule = { id: 1 };
      const result = { data: 'test' };

      const chainedSchedules = [
        {
          id: 2,
          schedule_type: 'trigger',
          schedule_config: '{"triggerOnSchedule":"1"}',
          input_data: '{}',
          tags: '[]'
        }
      ];

      db.query.mockResolvedValue({ rows: chainedSchedules });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.handleChainedTriggers(completedSchedule, result);

      expect(scheduler.executeScheduledTask).toHaveBeenCalled();
    });

    it('should pass previous result to chained tasks', async () => {
      const completedSchedule = { id: 1 };
      const result = { important: 'data' };

      const chainedSchedules = [
        {
          id: 2,
          input_data: '{}',
          schedule_config: '{"triggerOnSchedule":"1"}',
          tags: '[]'
        }
      ];

      db.query.mockResolvedValue({ rows: chainedSchedules });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.handleChainedTriggers(completedSchedule, result);

      expect(scheduler.executeScheduledTask).toHaveBeenCalledWith(
        expect.objectContaining({
          input_data: expect.objectContaining({
            previousResult: result
          })
        })
      );
    });

    it('should include triggeredBy in input data', async () => {
      const completedSchedule = { id: 1 };
      const chainedSchedule = {
        id: 2,
        input_data: '{}',
        schedule_config: '{"triggerOnSchedule":"1"}',
        tags: '[]'
      };

      db.query.mockResolvedValue({ rows: [chainedSchedule] });
      AgentCore.findById.mockResolvedValue({ id: 1 });

      jest.spyOn(scheduler, 'executeScheduledTask').mockResolvedValue();

      await scheduler.handleChainedTriggers(completedSchedule, {});

      expect(scheduler.executeScheduledTask).toHaveBeenCalledWith(
        expect.objectContaining({
          input_data: expect.objectContaining({
            triggeredBy: 1
          })
        })
      );
    });
  });

  // ============================================================================
  // 12. Get Schedule Tests
  // ============================================================================

  describe('getSchedule', () => {
    it('should get schedule by ID', async () => {
      const mockSchedule = {
        id: 1,
        agent_id: 1,
        input_data: '{}',
        schedule_config: '{}',
        tags: '[]'
      };

      db.query.mockResolvedValue({ rows: [mockSchedule] });

      const result = await scheduler.getSchedule(1);

      expect(result.id).toBe(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM agent_schedules WHERE id = $1'),
        [1]
      );
    });

    it('should return null if not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await scheduler.getSchedule(999);

      expect(result).toBeNull();
    });

    it('should parse JSON fields', async () => {
      const mockSchedule = {
        id: 1,
        input_data: '{"key":"value"}',
        schedule_config: '{"interval":"1h"}',
        tags: '["tag1","tag2"]',
        last_result: '{"result":"data"}'
      };

      db.query.mockResolvedValue({ rows: [mockSchedule] });

      const result = await scheduler.getSchedule(1);

      expect(result.input_data).toEqual({ key: 'value' });
      expect(result.schedule_config).toEqual({ interval: '1h' });
      expect(result.tags).toEqual(['tag1', 'tag2']);
      expect(result.last_result).toEqual({ result: 'data' });
    });
  });

  describe('getAgentSchedules', () => {
    it('should get schedules for an agent', async () => {
      const mockSchedules = [
        { id: 1, agent_id: 1, input_data: '{}', schedule_config: '{}', tags: '[]' },
        { id: 2, agent_id: 1, input_data: '{}', schedule_config: '{}', tags: '[]' }
      ];

      db.query.mockResolvedValue({ rows: mockSchedules });

      const result = await scheduler.getAgentSchedules(1);

      expect(result).toHaveLength(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE agent_id = $1'),
        expect.any(Array)
      );
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getAgentSchedules(1, { status: 'active' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        expect.arrayContaining([1, 'active'])
      );
    });

    it('should apply limit and offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getAgentSchedules(1, { limit: 20, offset: 10 });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 20, 10])
      );
    });

    it('should use default limit of 50', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getAgentSchedules(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([50])
      );
    });
  });

  describe('getUserSchedules', () => {
    it('should get schedules for a user', async () => {
      const mockSchedules = [
        { id: 1, user_id: 100, input_data: '{}', schedule_config: '{}', tags: '[]' }
      ];

      db.query.mockResolvedValue({ rows: mockSchedules });

      const result = await scheduler.getUserSchedules(100);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        expect.any(Array)
      );
    });

    it('should filter by status', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getUserSchedules(100, { status: 'paused' });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('AND status = $2'),
        expect.arrayContaining([100, 'paused'])
      );
    });

    it('should apply limit and offset', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getUserSchedules(100, { limit: 30, offset: 5 });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100, 30, 5])
      );
    });
  });

  // ============================================================================
  // 13. Statistics and Analytics Tests
  // ============================================================================

  describe('getStats', () => {
    it('should get scheduler statistics', async () => {
      const mockStats = [
        {
          status: 'active',
          schedule_type: 'recurring',
          count: '5',
          total_runs: '100',
          total_success: '95',
          total_failures: '5'
        }
      ];

      db.query.mockResolvedValue({ rows: mockStats });

      const result = await scheduler.getStats();

      expect(result.byStatus).toBeDefined();
      expect(result.runningTasks).toBe(0);
      expect(result.isRunning).toBe(false);
    });

    it('should include running task count', async () => {
      db.query.mockResolvedValue({ rows: [] });
      scheduler.runningTasks.set(1, {});
      scheduler.runningTasks.set(2, {});

      const result = await scheduler.getStats();

      expect(result.runningTasks).toBe(2);
    });

    it('should group stats by status and type', async () => {
      const mockStats = [
        {
          status: 'active',
          schedule_type: 'once',
          count: '3',
          total_runs: '3',
          total_success: '3',
          total_failures: '0'
        },
        {
          status: 'active',
          schedule_type: 'recurring',
          count: '2',
          total_runs: '20',
          total_success: '18',
          total_failures: '2'
        }
      ];

      db.query.mockResolvedValue({ rows: mockStats });

      const result = await scheduler.getStats();

      expect(result.byStatus.active.once.count).toBe(3);
      expect(result.byStatus.active.recurring.count).toBe(2);
    });
  });

  describe('getUpcoming', () => {
    it('should get upcoming schedules', async () => {
      const mockSchedules = [
        {
          id: 1,
          next_run_at: new Date('2026-01-02T10:00:00Z'),
          input_data: '{}',
          schedule_config: '{}',
          tags: '[]'
        }
      ];

      db.query.mockResolvedValue({ rows: mockSchedules });

      const result = await scheduler.getUpcoming(10);

      expect(result).toHaveLength(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE status = $1 AND next_run_at IS NOT NULL'),
        ['active', 10]
      );
    });

    it('should order by next_run_at', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getUpcoming();

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY next_run_at ASC'),
        expect.any(Array)
      );
    });

    it('should use default limit of 10', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.getUpcoming();

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([10])
      );
    });
  });

  // ============================================================================
  // 14. Parse Schedule Tests
  // ============================================================================

  describe('parseSchedule', () => {
    it('should parse schedule row', () => {
      const row = {
        id: 1,
        agent_id: 1,
        input_data: '{"key":"value"}',
        schedule_config: '{"interval":"1h"}',
        tags: '["tag1"]',
        last_result: '{"result":"data"}'
      };

      const result = scheduler.parseSchedule(row);

      expect(result.input_data).toEqual({ key: 'value' });
      expect(result.schedule_config).toEqual({ interval: '1h' });
      expect(result.tags).toEqual(['tag1']);
    });

    it('should return null for null input', () => {
      const result = scheduler.parseSchedule(null);

      expect(result).toBeNull();
    });

    it('should handle already parsed JSON', () => {
      const row = {
        id: 1,
        input_data: { key: 'value' },
        schedule_config: { interval: '1h' },
        tags: ['tag1'],
        last_result: { result: 'data' }
      };

      const result = scheduler.parseSchedule(row);

      expect(result.input_data).toEqual({ key: 'value' });
      expect(result.schedule_config).toEqual({ interval: '1h' });
    });

    it('should handle null JSON fields', () => {
      const row = {
        id: 1,
        input_data: null,
        schedule_config: null,
        tags: null,
        last_result: null
      };

      const result = scheduler.parseSchedule(row);

      expect(result.input_data).toEqual({});
      expect(result.schedule_config).toEqual({});
      expect(result.tags).toEqual([]);
      expect(result.last_result).toBeNull();
    });

    it('should preserve other fields', () => {
      const row = {
        id: 1,
        agent_id: 1,
        user_id: 100,
        status: 'active',
        input_data: '{}',
        schedule_config: '{}',
        tags: '[]'
      };

      const result = scheduler.parseSchedule(row);

      expect(result.id).toBe(1);
      expect(result.agent_id).toBe(1);
      expect(result.user_id).toBe(100);
      expect(result.status).toBe('active');
    });
  });

  // ============================================================================
  // 15. Constants and Configuration Tests
  // ============================================================================

  describe('Constants', () => {
    it('should expose TYPES constant', () => {
      expect(AgentScheduler.TYPES).toBeDefined();
      expect(AgentScheduler.TYPES.ONCE).toBe('once');
      expect(AgentScheduler.TYPES.RECURRING).toBe('recurring');
      expect(AgentScheduler.TYPES.CRON).toBe('cron');
      expect(AgentScheduler.TYPES.TRIGGER).toBe('trigger');
    });

    it('should expose STATUS constant', () => {
      expect(AgentScheduler.STATUS).toBeDefined();
      expect(AgentScheduler.STATUS.ACTIVE).toBe('active');
      expect(AgentScheduler.STATUS.PAUSED).toBe('paused');
      expect(AgentScheduler.STATUS.COMPLETED).toBe('completed');
      expect(AgentScheduler.STATUS.FAILED).toBe('failed');
      expect(AgentScheduler.STATUS.CANCELLED).toBe('cancelled');
    });

    it('should expose TRIGGERS constant', () => {
      expect(AgentScheduler.TRIGGERS).toBeDefined();
      expect(AgentScheduler.TRIGGERS.WEBHOOK).toBe('webhook');
      expect(AgentScheduler.TRIGGERS.EVENT).toBe('event');
      expect(AgentScheduler.TRIGGERS.CONDITION).toBe('condition');
      expect(AgentScheduler.TRIGGERS.CHAIN).toBe('chain');
    });

    it('should expose CONFIG constant', () => {
      expect(AgentScheduler.CONFIG).toBeDefined();
      expect(AgentScheduler.CONFIG.checkInterval).toBeDefined();
      expect(AgentScheduler.CONFIG.maxConcurrentTasks).toBeDefined();
      expect(AgentScheduler.CONFIG.retryDelay).toBeDefined();
      expect(AgentScheduler.CONFIG.maxRetries).toBeDefined();
    });
  });

  // ============================================================================
  // 16. Singleton Instance Tests
  // ============================================================================

  describe('Singleton', () => {
    it('should provide singleton instance', () => {
      expect(AgentScheduler.instance).toBeDefined();
      expect(AgentScheduler.instance).toBeInstanceOf(AgentScheduler);
    });

    it('should return same instance', () => {
      const instance1 = AgentScheduler.instance;
      const instance2 = AgentScheduler.instance;

      expect(instance1).toBe(instance2);
    });
  });

  // ============================================================================
  // 17. Integration Tests
  // ============================================================================

  describe('Integration scenarios', () => {
    it('should handle full lifecycle of one-time task', async () => {
      const scheduleData = {
        agentId: 1,
        userId: 100,
        taskDescription: 'One-time task',
        scheduleType: 'once',
        scheduleConfig: { executeAt: new Date('2026-01-02T10:00:00Z') }
      };

      // Create schedule
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          ...scheduleData,
          input_data: '{}',
          schedule_config: JSON.stringify(scheduleData.scheduleConfig),
          tags: '[]',
          status: 'active'
        }]
      });

      const schedule = await scheduler.createSchedule(scheduleData);
      expect(schedule.id).toBe(1);

      // Get schedule
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          input_data: '{}',
          schedule_config: '{}',
          tags: '[]'
        }]
      });

      const fetched = await scheduler.getSchedule(1);
      expect(fetched.id).toBe(1);

      // Cancel schedule
      db.query.mockResolvedValueOnce({ rows: [] });

      await scheduler.cancelSchedule(1);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_schedules'),
        ['cancelled', 1]
      );
    });

    it('should handle recurring task execution cycle', async () => {
      const schedule = {
        id: 1,
        agent_id: 1,
        schedule_type: 'recurring',
        schedule_config: { interval: '1h' },
        input_data: {},
        tags: [],
        run_count: 0,
        success_count: 0,
        failure_count: 0
      };

      AgentCore.findById.mockResolvedValue({ id: 1 });
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.executeScheduledTask(schedule);

      // Should calculate next run
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('next_run_at = $'),
        expect.any(Array)
      );
    });

    it('should handle concurrent task limits', async () => {
      const tasks = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        agent_id: 1,
        input_data: '{}',
        schedule_config: '{}',
        tags: '[]',
        status: 'active'
      }));

      db.query.mockResolvedValue({ rows: tasks });
      scheduler.isRunning = true;

      await scheduler.checkScheduledTasks();

      const limitArg = db.query.mock.calls[0][1][1];
      expect(limitArg).toBe(AgentScheduler.CONFIG.maxConcurrentTasks);
    });

    it('should handle error recovery with retries', async () => {
      const schedule = {
        id: 1,
        agent_id: 1,
        schedule_type: 'once',
        schedule_config: {},
        input_data: {},
        failure_count: 0
      };

      TaskExecutor.createTask.mockRejectedValue(new Error('Temporary failure'));
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.executeScheduledTask(schedule);

      // Should increment failure count
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('failure_count = $'),
        expect.any(Array)
      );
    });
  });

  // ============================================================================
  // 18. Error Handling Tests
  // ============================================================================

  describe('Error handling', () => {
    it('should handle database errors in createSchedule', async () => {
      const scheduleData = {
        agentId: 1,
        userId: 100,
        taskDescription: 'Test',
        scheduleType: 'once',
        scheduleConfig: { executeAt: new Date() }
      };

      db.query.mockRejectedValue(new Error('Database error'));

      await expect(scheduler.createSchedule(scheduleData))
        .rejects.toThrow('Database error');
    });

    it('should handle database errors in getSchedule', async () => {
      db.query.mockRejectedValue(new Error('Connection lost'));

      await expect(scheduler.getSchedule(1))
        .rejects.toThrow('Connection lost');
    });

    it('should handle task execution errors gracefully', async () => {
      const schedule = {
        id: 1,
        agent_id: 1,
        schedule_type: 'once',
        schedule_config: {},
        input_data: {},
        failure_count: 0
      };

      AgentCore.findById.mockRejectedValue(new Error('Agent lookup failed'));
      db.query.mockResolvedValue({ rows: [] });

      await scheduler.executeScheduledTask(schedule);

      expect(log.error).toHaveBeenCalled();
      expect(scheduler.runningTasks.has(1)).toBe(false);
    });

    it('should handle invalid cron expressions', () => {
      expect(() => scheduler.getNextCronTime('invalid cron'))
        .toThrow('Invalid cron expression');
    });

    it('should handle invalid interval formats', () => {
      expect(() => scheduler.parseInterval('invalid'))
        .toThrow('Invalid interval format');
    });
  });
});
