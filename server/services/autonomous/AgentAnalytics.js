/**
 * Agent Analytics - Performance Metrics and Insights
 * Tracks and analyzes agent performance, usage, and optimization opportunities
 */

const db = require('../../db');
const log = require('../../utils/logger');

// Analytics configuration
const ANALYTICS_CONFIG = {
  retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS) || 90,
  aggregationInterval: parseInt(process.env.ANALYTICS_AGGREGATION_INTERVAL) || 3600000, // 1 hour
  alertThresholds: {
    errorRate: parseFloat(process.env.ALERT_ERROR_RATE) || 0.1,
    avgDuration: parseInt(process.env.ALERT_AVG_DURATION) || 60000,
    failureStreak: parseInt(process.env.ALERT_FAILURE_STREAK) || 3
  }
};

// Metric types
const METRIC_TYPES = {
  TASK_EXECUTION: 'task_execution',
  TOOL_USAGE: 'tool_usage',
  TOKEN_CONSUMPTION: 'token_consumption',
  ERROR: 'error',
  LATENCY: 'latency',
  MEMORY_USAGE: 'memory_usage',
  USER_INTERACTION: 'user_interaction'
};

class AgentAnalytics {
  constructor() {
    this.metricsBuffer = [];
    this.flushInterval = null;
    this.bufferSize = 100;
  }

  /**
   * Start the analytics service
   */
  start() {
    this.flushInterval = setInterval(
      () => this.flushMetrics(),
      30000 // Flush every 30 seconds
    );
    log.info('AgentAnalytics: Started');
  }

  /**
   * Stop the analytics service
   */
  stop() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Final flush
    this.flushMetrics();
    log.info('AgentAnalytics: Stopped');
  }

  /**
   * Track a metric
   */
  track(agentId, metricType, value, metadata = {}) {
    const metric = {
      agent_id: agentId,
      metric_type: metricType,
      value,
      metadata,
      timestamp: new Date()
    };

    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics();
    }
  }

  /**
   * Flush buffered metrics to database
   */
  async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      for (const metric of metrics) {
        await db.query(
          `INSERT INTO agent_metrics
           (agent_id, metric_type, value, metadata, recorded_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            metric.agent_id,
            metric.metric_type,
            metric.value,
            JSON.stringify(metric.metadata),
            metric.timestamp
          ]
        );
      }

      log.debug('AgentAnalytics: Flushed metrics', { count: metrics.length });

    } catch (error) {
      log.error('AgentAnalytics: Failed to flush metrics', { error: error.message });
      // Put failed metrics back in buffer
      this.metricsBuffer.unshift(...metrics);
    }
  }

  /**
   * Track task execution
   */
  trackTaskExecution(agentId, taskData) {
    const {
      taskId,
      status,
      duration,
      stepCount,
      tokensUsed = 0,
      error = null
    } = taskData;

    this.track(agentId, METRIC_TYPES.TASK_EXECUTION, duration, {
      taskId,
      status,
      stepCount,
      tokensUsed,
      error: error ? error.substring(0, 200) : null
    });

    if (tokensUsed > 0) {
      this.track(agentId, METRIC_TYPES.TOKEN_CONSUMPTION, tokensUsed, { taskId });
    }

    if (error) {
      this.track(agentId, METRIC_TYPES.ERROR, 1, { taskId, error: error.substring(0, 200) });
    }
  }

  /**
   * Track tool usage
   */
  trackToolUsage(agentId, toolData) {
    const { toolName, duration, success, input, output } = toolData;

    this.track(agentId, METRIC_TYPES.TOOL_USAGE, duration, {
      toolName,
      success,
      inputSize: JSON.stringify(input).length,
      outputSize: output ? JSON.stringify(output).length : 0
    });
  }

  /**
   * Get agent performance summary
   */
  async getAgentPerformance(agentId, options = {}) {
    const { days = 30 } = options;

    const result = await db.query(
      `SELECT
        COUNT(CASE WHEN metric_type = 'task_execution' THEN 1 END) as total_tasks,
        COUNT(CASE WHEN metric_type = 'task_execution' AND metadata->>'status' = 'completed' THEN 1 END) as successful_tasks,
        COUNT(CASE WHEN metric_type = 'error' THEN 1 END) as total_errors,
        AVG(CASE WHEN metric_type = 'task_execution' THEN value END) as avg_duration,
        SUM(CASE WHEN metric_type = 'token_consumption' THEN value ELSE 0 END) as total_tokens,
        MAX(recorded_at) as last_activity
       FROM agent_metrics
       WHERE agent_id = $1 AND recorded_at > NOW() - INTERVAL '${days} days'`,
      [agentId]
    );

    const data = result.rows[0];

    return {
      totalTasks: parseInt(data.total_tasks || 0),
      successfulTasks: parseInt(data.successful_tasks || 0),
      failedTasks: parseInt(data.total_tasks || 0) - parseInt(data.successful_tasks || 0),
      successRate: data.total_tasks > 0
        ? (data.successful_tasks / data.total_tasks * 100).toFixed(2)
        : 0,
      totalErrors: parseInt(data.total_errors || 0),
      avgDuration: parseFloat(data.avg_duration || 0).toFixed(2),
      totalTokens: parseInt(data.total_tokens || 0),
      lastActivity: data.last_activity
    };
  }

  /**
   * Get task execution trends
   */
  async getExecutionTrends(agentId, options = {}) {
    const { days = 30, interval = 'day' } = options;

    const intervalMap = {
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month'
    };

    const truncInterval = intervalMap[interval] || 'day';

    const result = await db.query(
      `SELECT
        DATE_TRUNC('${truncInterval}', recorded_at) as period,
        COUNT(*) as executions,
        AVG(value) as avg_duration,
        COUNT(CASE WHEN metadata->>'status' = 'completed' THEN 1 END) as successful,
        COUNT(CASE WHEN metadata->>'status' = 'failed' THEN 1 END) as failed
       FROM agent_metrics
       WHERE agent_id = $1
       AND metric_type = 'task_execution'
       AND recorded_at > NOW() - INTERVAL '${days} days'
       GROUP BY period
       ORDER BY period ASC`,
      [agentId]
    );

    return result.rows.map(row => ({
      period: row.period,
      executions: parseInt(row.executions),
      avgDuration: parseFloat(row.avg_duration || 0).toFixed(2),
      successful: parseInt(row.successful),
      failed: parseInt(row.failed),
      successRate: row.executions > 0
        ? ((row.successful / row.executions) * 100).toFixed(2)
        : 0
    }));
  }

  /**
   * Get tool usage statistics
   */
  async getToolStats(agentId, options = {}) {
    const { days = 30, limit = 10 } = options;

    const result = await db.query(
      `SELECT
        metadata->>'toolName' as tool_name,
        COUNT(*) as usage_count,
        AVG(value) as avg_duration,
        COUNT(CASE WHEN metadata->>'success' = 'true' THEN 1 END) as successful
       FROM agent_metrics
       WHERE agent_id = $1
       AND metric_type = 'tool_usage'
       AND recorded_at > NOW() - INTERVAL '${days} days'
       GROUP BY tool_name
       ORDER BY usage_count DESC
       LIMIT $2`,
      [agentId, limit]
    );

    return result.rows.map(row => ({
      toolName: row.tool_name,
      usageCount: parseInt(row.usage_count),
      avgDuration: parseFloat(row.avg_duration || 0).toFixed(2),
      successful: parseInt(row.successful),
      successRate: row.usage_count > 0
        ? ((row.successful / row.usage_count) * 100).toFixed(2)
        : 0
    }));
  }

  /**
   * Get error analysis
   */
  async getErrorAnalysis(agentId, options = {}) {
    const { days = 30, limit = 20 } = options;

    const result = await db.query(
      `SELECT
        metadata->>'error' as error_message,
        COUNT(*) as occurrence_count,
        MAX(recorded_at) as last_occurrence,
        MIN(recorded_at) as first_occurrence
       FROM agent_metrics
       WHERE agent_id = $1
       AND metric_type = 'error'
       AND recorded_at > NOW() - INTERVAL '${days} days'
       GROUP BY error_message
       ORDER BY occurrence_count DESC
       LIMIT $2`,
      [agentId, limit]
    );

    return result.rows.map(row => ({
      errorMessage: row.error_message,
      occurrenceCount: parseInt(row.occurrence_count),
      lastOccurrence: row.last_occurrence,
      firstOccurrence: row.first_occurrence
    }));
  }

  /**
   * Get token consumption analysis
   */
  async getTokenAnalysis(agentId, options = {}) {
    const { days = 30 } = options;

    const result = await db.query(
      `SELECT
        DATE_TRUNC('day', recorded_at) as day,
        SUM(value) as total_tokens,
        AVG(value) as avg_tokens_per_task,
        COUNT(*) as task_count
       FROM agent_metrics
       WHERE agent_id = $1
       AND metric_type = 'token_consumption'
       AND recorded_at > NOW() - INTERVAL '${days} days'
       GROUP BY day
       ORDER BY day ASC`,
      [agentId]
    );

    const totalTokens = result.rows.reduce((sum, row) => sum + parseInt(row.total_tokens), 0);

    return {
      daily: result.rows.map(row => ({
        date: row.day,
        tokens: parseInt(row.total_tokens),
        avgPerTask: parseFloat(row.avg_tokens_per_task).toFixed(0),
        taskCount: parseInt(row.task_count)
      })),
      totalTokens,
      avgDailyTokens: result.rows.length > 0 ? (totalTokens / result.rows.length).toFixed(0) : 0
    };
  }

  /**
   * Get comparative analytics across agents
   */
  async getComparativeAnalytics(agentIds, options = {}) {
    const { days = 30 } = options;

    const result = await db.query(
      `SELECT
        agent_id,
        COUNT(CASE WHEN metric_type = 'task_execution' THEN 1 END) as total_tasks,
        AVG(CASE WHEN metric_type = 'task_execution' THEN value END) as avg_duration,
        COUNT(CASE WHEN metric_type = 'error' THEN 1 END) as error_count,
        SUM(CASE WHEN metric_type = 'token_consumption' THEN value ELSE 0 END) as total_tokens
       FROM agent_metrics
       WHERE agent_id = ANY($1)
       AND recorded_at > NOW() - INTERVAL '${days} days'
       GROUP BY agent_id`,
      [agentIds]
    );

    return result.rows.map(row => ({
      agentId: row.agent_id,
      totalTasks: parseInt(row.total_tasks || 0),
      avgDuration: parseFloat(row.avg_duration || 0).toFixed(2),
      errorCount: parseInt(row.error_count || 0),
      totalTokens: parseInt(row.total_tokens || 0)
    }));
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(agentId) {
    const result = await db.query(
      `SELECT
        metric_type,
        value,
        metadata,
        recorded_at
       FROM agent_metrics
       WHERE agent_id = $1
       AND recorded_at > NOW() - INTERVAL '1 hour'
       ORDER BY recorded_at DESC
       LIMIT 100`,
      [agentId]
    );

    return result.rows.map(row => ({
      type: row.metric_type,
      value: row.value,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      timestamp: row.recorded_at
    }));
  }

  /**
   * Get performance alerts
   */
  async getAlerts(agentId) {
    const alerts = [];
    const perf = await this.getAgentPerformance(agentId, { days: 7 });

    // High error rate alert
    if (perf.totalTasks > 0) {
      const errorRate = perf.failedTasks / perf.totalTasks;
      if (errorRate > ANALYTICS_CONFIG.alertThresholds.errorRate) {
        alerts.push({
          type: 'high_error_rate',
          severity: 'warning',
          message: `Error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold`,
          value: errorRate
        });
      }
    }

    // High average duration alert
    if (parseFloat(perf.avgDuration) > ANALYTICS_CONFIG.alertThresholds.avgDuration) {
      alerts.push({
        type: 'high_latency',
        severity: 'warning',
        message: `Average duration (${perf.avgDuration}ms) exceeds threshold`,
        value: perf.avgDuration
      });
    }

    // Check for failure streak
    const recentTasks = await db.query(
      `SELECT metadata->>'status' as status
       FROM agent_metrics
       WHERE agent_id = $1 AND metric_type = 'task_execution'
       ORDER BY recorded_at DESC
       LIMIT $2`,
      [agentId, ANALYTICS_CONFIG.alertThresholds.failureStreak]
    );

    const failures = recentTasks.rows.filter(r => r.status === 'failed').length;
    if (failures >= ANALYTICS_CONFIG.alertThresholds.failureStreak) {
      alerts.push({
        type: 'failure_streak',
        severity: 'critical',
        message: `${failures} consecutive task failures detected`,
        value: failures
      });
    }

    return alerts;
  }

  /**
   * Get optimization suggestions
   */
  async getSuggestions(agentId) {
    const suggestions = [];
    const perf = await this.getAgentPerformance(agentId, { days: 30 });
    const tools = await this.getToolStats(agentId, { days: 30 });
    const errors = await this.getErrorAnalysis(agentId, { days: 30 });

    // Suggest based on error patterns
    if (errors.length > 0) {
      const topError = errors[0];
      if (topError.occurrenceCount > 5) {
        suggestions.push({
          type: 'recurring_error',
          priority: 'high',
          message: `Address recurring error: "${topError.errorMessage.substring(0, 50)}..."`,
          impact: 'reliability'
        });
      }
    }

    // Suggest based on slow tools
    const slowTools = tools.filter(t => parseFloat(t.avgDuration) > 5000);
    for (const tool of slowTools.slice(0, 2)) {
      suggestions.push({
        type: 'slow_tool',
        priority: 'medium',
        message: `Optimize ${tool.toolName} - avg duration ${tool.avgDuration}ms`,
        impact: 'performance'
      });
    }

    // Suggest based on token usage
    const tokenAnalysis = await this.getTokenAnalysis(agentId, { days: 30 });
    if (parseInt(tokenAnalysis.avgDailyTokens) > 50000) {
      suggestions.push({
        type: 'high_token_usage',
        priority: 'low',
        message: 'Consider optimizing prompts to reduce token consumption',
        impact: 'cost'
      });
    }

    return suggestions;
  }

  /**
   * Generate performance report
   */
  async generateReport(agentId, options = {}) {
    const { days = 30 } = options;

    const [performance, trends, tools, errors, tokens, alerts, suggestions] = await Promise.all([
      this.getAgentPerformance(agentId, { days }),
      this.getExecutionTrends(agentId, { days }),
      this.getToolStats(agentId, { days }),
      this.getErrorAnalysis(agentId, { days }),
      this.getTokenAnalysis(agentId, { days }),
      this.getAlerts(agentId),
      this.getSuggestions(agentId)
    ]);

    return {
      generatedAt: new Date(),
      period: `Last ${days} days`,
      summary: performance,
      trends,
      toolUsage: tools,
      errors,
      tokenConsumption: tokens,
      alerts,
      suggestions
    };
  }

  /**
   * Cleanup old metrics
   */
  async cleanup() {
    const result = await db.query(
      `DELETE FROM agent_metrics
       WHERE recorded_at < NOW() - INTERVAL '${ANALYTICS_CONFIG.retentionDays} days'
       RETURNING id`
    );

    log.info('AgentAnalytics: Cleaned up old metrics', { count: result.rows.length });
    return result.rows.length;
  }
}

// Create singleton instance
const analytics = new AgentAnalytics();

// Export class and instance
AgentAnalytics.instance = analytics;
AgentAnalytics.TYPES = METRIC_TYPES;
AgentAnalytics.CONFIG = ANALYTICS_CONFIG;

module.exports = AgentAnalytics;
