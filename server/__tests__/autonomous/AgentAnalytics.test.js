/**
 * AgentAnalytics Test Suite
 */

const AgentAnalytics = require('../../services/autonomous/AgentAnalytics');

// Mock dependencies
jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const db = require('../../db');

describe('AgentAnalytics', () => {
  let analytics;

  beforeEach(() => {
    analytics = new AgentAnalytics();
    jest.clearAllMocks();
  });

  afterEach(() => {
    analytics.stop();
  });

  describe('constructor', () => {
    it('should initialize with empty metrics buffer', () => {
      expect(analytics.metricsBuffer).toEqual([]);
    });

    it('should set buffer size', () => {
      expect(analytics.bufferSize).toBe(100);
    });
  });

  describe('track', () => {
    it('should add metric to buffer', () => {
      analytics.track(1, 'task_execution', 1000, { taskId: 123 });

      expect(analytics.metricsBuffer.length).toBe(1);
      expect(analytics.metricsBuffer[0].agent_id).toBe(1);
      expect(analytics.metricsBuffer[0].metric_type).toBe('task_execution');
      expect(analytics.metricsBuffer[0].value).toBe(1000);
    });

    it('should auto-flush when buffer is full', async () => {
      db.query.mockResolvedValue({ rows: [] });

      // Fill buffer to capacity
      for (let i = 0; i < 100; i++) {
        analytics.track(1, 'test', i);
      }

      // Buffer should be flushed
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('trackTaskExecution', () => {
    it('should track task execution with all fields', () => {
      analytics.trackTaskExecution(1, {
        taskId: 123,
        status: 'completed',
        duration: 5000,
        stepCount: 5,
        tokensUsed: 1000
      });

      expect(analytics.metricsBuffer.length).toBe(2); // task_execution + token_consumption
    });

    it('should track error if present', () => {
      analytics.trackTaskExecution(1, {
        taskId: 123,
        status: 'failed',
        duration: 1000,
        error: 'Something went wrong'
      });

      const errorMetric = analytics.metricsBuffer.find(m => m.metric_type === 'error');
      expect(errorMetric).toBeTruthy();
    });
  });

  describe('trackToolUsage', () => {
    it('should track tool usage', () => {
      analytics.trackToolUsage(1, {
        toolName: 'web_search',
        duration: 500,
        success: true,
        input: { query: 'test' },
        output: { results: [] }
      });

      expect(analytics.metricsBuffer.length).toBe(1);
      expect(analytics.metricsBuffer[0].metric_type).toBe('tool_usage');
    });
  });

  describe('flushMetrics', () => {
    it('should flush metrics to database', async () => {
      analytics.metricsBuffer = [
        { agent_id: 1, metric_type: 'test', value: 100, metadata: {}, timestamp: new Date() }
      ];

      db.query.mockResolvedValue({ rows: [] });

      await analytics.flushMetrics();

      expect(db.query).toHaveBeenCalled();
      expect(analytics.metricsBuffer.length).toBe(0);
    });

    it('should do nothing if buffer is empty', async () => {
      await analytics.flushMetrics();

      expect(db.query).not.toHaveBeenCalled();
    });

    it('should restore metrics on database error', async () => {
      analytics.metricsBuffer = [
        { agent_id: 1, metric_type: 'test', value: 100, metadata: {}, timestamp: new Date() }
      ];

      db.query.mockRejectedValue(new Error('DB Error'));

      await analytics.flushMetrics();

      expect(analytics.metricsBuffer.length).toBe(1);
    });
  });

  describe('getAgentPerformance', () => {
    it('should return performance metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          total_tasks: '100',
          successful_tasks: '90',
          total_errors: '10',
          avg_duration: '5000',
          total_tokens: '50000',
          last_activity: new Date()
        }]
      });

      const performance = await analytics.getAgentPerformance(1);

      expect(performance.totalTasks).toBe(100);
      expect(performance.successfulTasks).toBe(90);
      expect(performance.successRate).toBe('90.00');
    });

    it('should handle empty results', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total_tasks: null }]
      });

      const performance = await analytics.getAgentPerformance(1);

      expect(performance.totalTasks).toBe(0);
    });
  });

  describe('getExecutionTrends', () => {
    it('should return execution trends', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { period: new Date(), executions: '10', avg_duration: '5000', successful: '9', failed: '1' },
          { period: new Date(), executions: '15', avg_duration: '4000', successful: '14', failed: '1' }
        ]
      });

      const trends = await analytics.getExecutionTrends(1);

      expect(trends.length).toBe(2);
      expect(trends[0].executions).toBe(10);
    });
  });

  describe('getToolStats', () => {
    it('should return tool usage statistics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { tool_name: 'web_search', usage_count: '50', avg_duration: '1000', successful: '48' },
          { tool_name: 'analyze_text', usage_count: '30', avg_duration: '500', successful: '30' }
        ]
      });

      const stats = await analytics.getToolStats(1);

      expect(stats.length).toBe(2);
      expect(stats[0].toolName).toBe('web_search');
      expect(stats[0].usageCount).toBe(50);
    });
  });

  describe('getErrorAnalysis', () => {
    it('should return error analysis', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { error_message: 'Connection timeout', occurrence_count: '15', last_occurrence: new Date(), first_occurrence: new Date() }
        ]
      });

      const errors = await analytics.getErrorAnalysis(1);

      expect(errors.length).toBe(1);
      expect(errors[0].occurrenceCount).toBe(15);
    });
  });

  describe('getTokenAnalysis', () => {
    it('should return token consumption analysis', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { day: new Date(), total_tokens: '10000', avg_tokens_per_task: '500', task_count: '20' },
          { day: new Date(), total_tokens: '15000', avg_tokens_per_task: '600', task_count: '25' }
        ]
      });

      const analysis = await analytics.getTokenAnalysis(1);

      expect(analysis.daily.length).toBe(2);
      expect(analysis.totalTokens).toBe(25000);
    });
  });

  describe('getAlerts', () => {
    it('should return high error rate alert', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_tasks: '100',
            successful_tasks: '80',
            total_errors: '20',
            avg_duration: '5000'
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { status: 'completed' },
            { status: 'completed' },
            { status: 'completed' }
          ]
        });

      const alerts = await analytics.getAlerts(1);

      expect(alerts.some(a => a.type === 'high_error_rate')).toBe(true);
    });

    it('should return high latency alert', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            total_tasks: '100',
            successful_tasks: '95',
            total_errors: '5',
            avg_duration: '100000' // Very high
          }]
        })
        .mockResolvedValueOnce({
          rows: []
        });

      const alerts = await analytics.getAlerts(1);

      expect(alerts.some(a => a.type === 'high_latency')).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for recurring errors', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ total_tasks: '50', successful_tasks: '45' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ error_message: 'Timeout error', occurrence_count: '10' }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const suggestions = await analytics.getSuggestions(1);

      expect(suggestions.some(s => s.type === 'recurring_error')).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', async () => {
      db.query.mockResolvedValue({
        rows: [{ total_tasks: '10', successful_tasks: '9' }]
      });

      const report = await analytics.generateReport(1);

      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
      expect(report.summary).toBeDefined();
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should return recent metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          { metric_type: 'task_execution', value: 1000, metadata: '{"taskId": 1}', recorded_at: new Date() }
        ]
      });

      const metrics = await analytics.getRealTimeMetrics(1);

      expect(metrics.length).toBe(1);
      expect(metrics[0].type).toBe('task_execution');
    });
  });

  describe('cleanup', () => {
    it('should delete old metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1 }, { id: 2 }, { id: 3 }]
      });

      const deleted = await analytics.cleanup();

      expect(deleted).toBe(3);
    });
  });

  describe('start and stop', () => {
    it('should start flush interval', () => {
      analytics.start();

      expect(analytics.flushInterval).toBeTruthy();

      analytics.stop();
    });

    it('should stop flush interval', () => {
      analytics.start();
      analytics.stop();

      expect(analytics.flushInterval).toBeNull();
    });
  });

  describe('static properties', () => {
    it('should have instance singleton', () => {
      expect(AgentAnalytics.instance).toBeDefined();
    });

    it('should have TYPES constant', () => {
      expect(AgentAnalytics.TYPES).toBeDefined();
      expect(AgentAnalytics.TYPES.TASK_EXECUTION).toBe('task_execution');
    });

    it('should have CONFIG constant', () => {
      expect(AgentAnalytics.CONFIG).toBeDefined();
      expect(AgentAnalytics.CONFIG.retentionDays).toBeDefined();
    });
  });
});
