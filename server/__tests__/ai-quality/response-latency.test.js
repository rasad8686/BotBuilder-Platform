/**
 * AI Response Latency Tests
 * Tests performance monitoring, latency tracking, and response time SLAs
 * Ensures proper metrics collection and performance alerting
 */

// ========================================
// MOCKS
// ========================================

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// ========================================
// LATENCY UTILITIES
// ========================================

/**
 * High-resolution timer for accurate latency measurement
 */
class LatencyTimer {
  constructor() {
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = Date.now();
    return this;
  }

  stop() {
    this.endTime = Date.now();
    return this.getLatency();
  }

  getLatency() {
    if (!this.startTime || !this.endTime) return 0;
    return this.endTime - this.startTime;
  }
}

/**
 * Statistics calculator for latency metrics
 */
class LatencyStatistics {
  constructor() {
    this.samples = [];
  }

  addSample(latency) {
    this.samples.push(latency);
  }

  getCount() {
    return this.samples.length;
  }

  getMin() {
    if (this.samples.length === 0) return 0;
    return Math.min(...this.samples);
  }

  getMax() {
    if (this.samples.length === 0) return 0;
    return Math.max(...this.samples);
  }

  getMean() {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  getMedian() {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  getPercentile(p) {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getP50() { return this.getPercentile(50); }
  getP90() { return this.getPercentile(90); }
  getP95() { return this.getPercentile(95); }
  getP99() { return this.getPercentile(99); }

  getStandardDeviation() {
    if (this.samples.length < 2) return 0;
    const mean = this.getMean();
    const squaredDiffs = this.samples.map(s => Math.pow(s - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / this.samples.length);
  }

  getSummary() {
    return {
      count: this.getCount(),
      min: this.getMin(),
      max: this.getMax(),
      mean: Math.round(this.getMean()),
      median: this.getMedian(),
      p50: this.getP50(),
      p90: this.getP90(),
      p95: this.getP95(),
      p99: this.getP99(),
      stdDev: Math.round(this.getStandardDeviation())
    };
  }

  reset() {
    this.samples = [];
  }
}

// ========================================
// AI SERVICE SIMULATION
// ========================================

/**
 * Mock AI service with configurable latency
 */
class MockLatencyAIService {
  constructor(options = {}) {
    this.provider = options.provider || 'openai';
    this.baseLatency = options.baseLatency || 100;
    this.latencyVariance = options.latencyVariance || 50;
    this.slowResponseThreshold = options.slowResponseThreshold || 5000;
  }

  async chat(messages) {
    // Calculate random latency within variance
    const variance = (Math.random() - 0.5) * 2 * this.latencyVariance;
    const latency = Math.max(10, this.baseLatency + variance);

    await new Promise(resolve => setTimeout(resolve, latency));

    return {
      content: 'AI response',
      provider: this.provider,
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75
      }
    };
  }
}

/**
 * AI Handler with latency monitoring
 */
class LatencyMonitoredAIHandler {
  constructor(aiService, options = {}) {
    this.aiService = aiService;
    this.stats = new LatencyStatistics();
    this.slowThreshold = options.slowThreshold || 3000;
    this.slaTarget = options.slaTarget || 2000; // 2 second SLA
    this.slaPercentile = options.slaPercentile || 95; // P95
    this.onSlowResponse = options.onSlowResponse || (() => {});
    this.onSLAViolation = options.onSLAViolation || (() => {});
    this.requestHistory = [];
    this.maxHistorySize = options.maxHistorySize || 1000;
  }

  async processMessage(userMessage) {
    const timer = new LatencyTimer().start();

    try {
      const response = await this.aiService.chat([
        { role: 'user', content: userMessage }
      ]);

      const latency = timer.stop();
      this.recordLatency(latency, true);

      // Check for slow response
      if (latency > this.slowThreshold) {
        this.onSlowResponse({
          latency,
          threshold: this.slowThreshold,
          provider: this.aiService.provider
        });
      }

      return {
        success: true,
        content: response.content,
        latency,
        usage: response.usage,
        isSlow: latency > this.slowThreshold
      };
    } catch (error) {
      const latency = timer.stop();
      this.recordLatency(latency, false);

      return {
        success: false,
        content: 'Error occurred',
        latency,
        error: error.message
      };
    }
  }

  recordLatency(latency, success) {
    this.stats.addSample(latency);

    // Keep history bounded
    if (this.requestHistory.length >= this.maxHistorySize) {
      this.requestHistory.shift();
    }

    this.requestHistory.push({
      latency,
      success,
      timestamp: Date.now()
    });

    // Check SLA after recording
    this.checkSLA();
  }

  checkSLA() {
    if (this.stats.getCount() < 10) return; // Need minimum samples

    const percentileLatency = this.stats.getPercentile(this.slaPercentile);
    if (percentileLatency > this.slaTarget) {
      this.onSLAViolation({
        targetLatency: this.slaTarget,
        actualLatency: percentileLatency,
        percentile: this.slaPercentile
      });
    }
  }

  getMetrics() {
    return {
      ...this.stats.getSummary(),
      slaTarget: this.slaTarget,
      slaPercentile: this.slaPercentile,
      isMeetingSLA: this.stats.getPercentile(this.slaPercentile) <= this.slaTarget,
      slowThreshold: this.slowThreshold,
      slowResponseCount: this.requestHistory.filter(r => r.latency > this.slowThreshold).length,
      successRate: this.calculateSuccessRate()
    };
  }

  calculateSuccessRate() {
    if (this.requestHistory.length === 0) return 100;
    const successes = this.requestHistory.filter(r => r.success).length;
    return Math.round((successes / this.requestHistory.length) * 100);
  }

  getRecentLatencies(count = 10) {
    return this.requestHistory.slice(-count).map(r => r.latency);
  }

  reset() {
    this.stats.reset();
    this.requestHistory = [];
  }
}

/**
 * SLA Monitor for tracking service level agreements
 */
class SLAMonitor {
  constructor(options = {}) {
    this.targets = options.targets || {
      p50: 500,
      p90: 1500,
      p95: 2000,
      p99: 3000
    };
    this.windowSize = options.windowSize || 100;
    this.samples = [];
    this.violations = [];
  }

  recordLatency(latency) {
    if (this.samples.length >= this.windowSize) {
      this.samples.shift();
    }
    this.samples.push(latency);
    this.checkViolations();
  }

  checkViolations() {
    if (this.samples.length < 10) return;

    const stats = new LatencyStatistics();
    this.samples.forEach(s => stats.addSample(s));

    const currentViolations = [];

    if (stats.getP50() > this.targets.p50) {
      currentViolations.push({ percentile: 'p50', target: this.targets.p50, actual: stats.getP50() });
    }
    if (stats.getP90() > this.targets.p90) {
      currentViolations.push({ percentile: 'p90', target: this.targets.p90, actual: stats.getP90() });
    }
    if (stats.getP95() > this.targets.p95) {
      currentViolations.push({ percentile: 'p95', target: this.targets.p95, actual: stats.getP95() });
    }
    if (stats.getP99() > this.targets.p99) {
      currentViolations.push({ percentile: 'p99', target: this.targets.p99, actual: stats.getP99() });
    }

    if (currentViolations.length > 0) {
      this.violations.push({
        timestamp: Date.now(),
        violations: currentViolations
      });
    }
  }

  getStatus() {
    if (this.samples.length < 10) {
      return { status: 'insufficient_data', sampleCount: this.samples.length };
    }

    const stats = new LatencyStatistics();
    this.samples.forEach(s => stats.addSample(s));

    const isHealthy =
      stats.getP50() <= this.targets.p50 &&
      stats.getP90() <= this.targets.p90 &&
      stats.getP95() <= this.targets.p95 &&
      stats.getP99() <= this.targets.p99;

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      current: {
        p50: stats.getP50(),
        p90: stats.getP90(),
        p95: stats.getP95(),
        p99: stats.getP99()
      },
      targets: this.targets,
      recentViolations: this.violations.slice(-5)
    };
  }
}

// ========================================
// TESTS
// ========================================

describe('AI Response Latency', () => {

  // ----------------------------------------
  // Latency Measurement
  // ----------------------------------------
  describe('Latency Measurement', () => {
    it('should measure response latency accurately', async () => {
      const aiService = new MockLatencyAIService({
        baseLatency: 100,
        latencyVariance: 10
      });

      const handler = new LatencyMonitoredAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.latency).toBeGreaterThanOrEqual(90);
      expect(result.latency).toBeLessThan(200);
    });

    it('should include latency in response', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 50 });
      const handler = new LatencyMonitoredAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result).toHaveProperty('latency');
      expect(typeof result.latency).toBe('number');
    });

    it('should handle high-resolution timing', () => {
      const timer = new LatencyTimer();
      timer.start();

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 50) {
        // Busy wait for more accurate timing test
      }

      const latency = timer.stop();
      expect(latency).toBeGreaterThanOrEqual(45);
      expect(latency).toBeLessThan(100);
    });
  });

  // ----------------------------------------
  // Statistics Calculation
  // ----------------------------------------
  describe('Statistics Calculation', () => {
    it('should calculate mean latency', () => {
      const stats = new LatencyStatistics();
      [100, 150, 200, 250, 300].forEach(l => stats.addSample(l));

      expect(stats.getMean()).toBe(200);
    });

    it('should calculate median latency', () => {
      const stats = new LatencyStatistics();
      [100, 200, 300, 400, 500].forEach(l => stats.addSample(l));

      expect(stats.getMedian()).toBe(300);
    });

    it('should calculate min and max', () => {
      const stats = new LatencyStatistics();
      [150, 100, 300, 200, 250].forEach(l => stats.addSample(l));

      expect(stats.getMin()).toBe(100);
      expect(stats.getMax()).toBe(300);
    });

    it('should calculate percentiles', () => {
      const stats = new LatencyStatistics();
      // Add 100 samples from 1-100
      for (let i = 1; i <= 100; i++) {
        stats.addSample(i);
      }

      expect(stats.getP50()).toBe(50);
      expect(stats.getP90()).toBe(90);
      expect(stats.getP95()).toBe(95);
      expect(stats.getP99()).toBe(99);
    });

    it('should calculate standard deviation', () => {
      const stats = new LatencyStatistics();
      [100, 100, 100, 100, 100].forEach(l => stats.addSample(l));

      expect(stats.getStandardDeviation()).toBe(0);

      stats.reset();
      [100, 200].forEach(l => stats.addSample(l));
      expect(stats.getStandardDeviation()).toBe(50);
    });

    it('should provide summary statistics', () => {
      const stats = new LatencyStatistics();
      [100, 150, 200].forEach(l => stats.addSample(l));

      const summary = stats.getSummary();

      expect(summary).toHaveProperty('count', 3);
      expect(summary).toHaveProperty('min', 100);
      expect(summary).toHaveProperty('max', 200);
      expect(summary).toHaveProperty('mean');
      expect(summary).toHaveProperty('p95');
    });
  });

  // ----------------------------------------
  // Slow Response Detection
  // ----------------------------------------
  describe('Slow Response Detection', () => {
    it('should detect slow responses', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 200 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        slowThreshold: 100
      });

      const result = await handler.processMessage('Hello');

      expect(result.isSlow).toBe(true);
    });

    it('should not flag fast responses as slow', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 50 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        slowThreshold: 1000
      });

      const result = await handler.processMessage('Hello');

      expect(result.isSlow).toBe(false);
    });

    it('should call onSlowResponse callback', async () => {
      const slowCallback = jest.fn();
      const aiService = new MockLatencyAIService({ baseLatency: 200 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        slowThreshold: 100,
        onSlowResponse: slowCallback
      });

      await handler.processMessage('Hello');

      expect(slowCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 100,
          latency: expect.any(Number)
        })
      );
    });

    it('should track slow response count', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 200 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        slowThreshold: 100
      });

      await handler.processMessage('Hello 1');
      await handler.processMessage('Hello 2');
      await handler.processMessage('Hello 3');

      const metrics = handler.getMetrics();
      expect(metrics.slowResponseCount).toBe(3);
    });
  });

  // ----------------------------------------
  // SLA Monitoring
  // ----------------------------------------
  describe('SLA Monitoring', () => {
    it('should track SLA compliance', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 100 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        slaTarget: 500,
        slaPercentile: 95
      });

      // Generate some samples
      for (let i = 0; i < 15; i++) {
        await handler.processMessage(`Hello ${i}`);
      }

      const metrics = handler.getMetrics();
      expect(metrics.isMeetingSLA).toBe(true);
    });

    it('should detect SLA violations', async () => {
      const slaCallback = jest.fn();
      const aiService = new MockLatencyAIService({ baseLatency: 300 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        slaTarget: 100,
        slaPercentile: 95,
        onSLAViolation: slaCallback
      });

      // Generate samples to trigger SLA check
      for (let i = 0; i < 15; i++) {
        await handler.processMessage(`Hello ${i}`);
      }

      expect(slaCallback).toHaveBeenCalled();
    });

    it('should use SLA Monitor for complex SLA tracking', () => {
      const monitor = new SLAMonitor({
        targets: {
          p50: 100,
          p90: 200,
          p95: 300,
          p99: 500
        }
      });

      // Add compliant samples
      for (let i = 0; i < 20; i++) {
        monitor.recordLatency(50 + Math.random() * 50);
      }

      const status = monitor.getStatus();
      expect(status.status).toBe('healthy');
    });

    it('should detect SLA degradation', () => {
      const monitor = new SLAMonitor({
        targets: {
          p50: 100,
          p90: 200,
          p95: 300,
          p99: 500
        }
      });

      // Add slow samples
      for (let i = 0; i < 20; i++) {
        monitor.recordLatency(500 + Math.random() * 100);
      }

      const status = monitor.getStatus();
      expect(status.status).toBe('degraded');
    });
  });

  // ----------------------------------------
  // Performance Metrics
  // ----------------------------------------
  describe('Performance Metrics', () => {
    it('should provide comprehensive metrics', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 100 });
      const handler = new LatencyMonitoredAIHandler(aiService);

      for (let i = 0; i < 10; i++) {
        await handler.processMessage(`Hello ${i}`);
      }

      const metrics = handler.getMetrics();

      expect(metrics).toHaveProperty('count', 10);
      expect(metrics).toHaveProperty('min');
      expect(metrics).toHaveProperty('max');
      expect(metrics).toHaveProperty('mean');
      expect(metrics).toHaveProperty('p50');
      expect(metrics).toHaveProperty('p90');
      expect(metrics).toHaveProperty('p95');
      expect(metrics).toHaveProperty('p99');
      expect(metrics).toHaveProperty('successRate');
    });

    it('should track success rate', async () => {
      let callCount = 0;
      const flakyService = {
        provider: 'flaky',
        chat: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount % 5 === 0) {
            throw new Error('Random failure');
          }
          return { content: 'Success', usage: {} };
        })
      };

      const handler = new LatencyMonitoredAIHandler(flakyService);

      for (let i = 0; i < 10; i++) {
        await handler.processMessage(`Hello ${i}`);
      }

      const metrics = handler.getMetrics();
      expect(metrics.successRate).toBe(80); // 8/10 succeed
    });

    it('should track recent latencies', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 50 });
      const handler = new LatencyMonitoredAIHandler(aiService);

      for (let i = 0; i < 5; i++) {
        await handler.processMessage(`Hello ${i}`);
      }

      const recent = handler.getRecentLatencies(3);
      expect(recent).toHaveLength(3);
      recent.forEach(l => expect(typeof l).toBe('number'));
    });

    it('should bound history size', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 10 });
      const handler = new LatencyMonitoredAIHandler(aiService, {
        maxHistorySize: 5
      });

      for (let i = 0; i < 10; i++) {
        await handler.processMessage(`Hello ${i}`);
      }

      expect(handler.requestHistory).toHaveLength(5);
    });
  });

  // ----------------------------------------
  // Provider Comparison
  // ----------------------------------------
  describe('Provider Comparison', () => {
    it('should track latency by provider', async () => {
      const openai = new MockLatencyAIService({
        provider: 'openai',
        baseLatency: 100
      });

      const claude = new MockLatencyAIService({
        provider: 'claude',
        baseLatency: 150
      });

      const openaiHandler = new LatencyMonitoredAIHandler(openai);
      const claudeHandler = new LatencyMonitoredAIHandler(claude);

      for (let i = 0; i < 10; i++) {
        await openaiHandler.processMessage('Test');
        await claudeHandler.processMessage('Test');
      }

      const openaiMetrics = openaiHandler.getMetrics();
      const claudeMetrics = claudeHandler.getMetrics();

      // Claude should be slower on average
      expect(claudeMetrics.mean).toBeGreaterThan(openaiMetrics.mean);
    });
  });

  // ----------------------------------------
  // Edge Cases
  // ----------------------------------------
  describe('Edge Cases', () => {
    it('should handle empty statistics', () => {
      const stats = new LatencyStatistics();

      expect(stats.getMean()).toBe(0);
      expect(stats.getMedian()).toBe(0);
      expect(stats.getMin()).toBe(0);
      expect(stats.getMax()).toBe(0);
      expect(stats.getP95()).toBe(0);
    });

    it('should handle single sample', () => {
      const stats = new LatencyStatistics();
      stats.addSample(100);

      expect(stats.getMean()).toBe(100);
      expect(stats.getMedian()).toBe(100);
      expect(stats.getMin()).toBe(100);
      expect(stats.getMax()).toBe(100);
    });

    it('should handle very small latencies', async () => {
      const aiService = new MockLatencyAIService({
        baseLatency: 10,
        latencyVariance: 5
      });

      const handler = new LatencyMonitoredAIHandler(aiService);
      const result = await handler.processMessage('Hello');

      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics correctly', async () => {
      const aiService = new MockLatencyAIService({ baseLatency: 100 });
      const handler = new LatencyMonitoredAIHandler(aiService);

      await handler.processMessage('Hello');
      expect(handler.getMetrics().count).toBe(1);

      handler.reset();
      expect(handler.getMetrics().count).toBe(0);
    });

    it('should handle insufficient data in SLA monitor', () => {
      const monitor = new SLAMonitor();

      // Only add a few samples
      monitor.recordLatency(100);
      monitor.recordLatency(150);

      const status = monitor.getStatus();
      expect(status.status).toBe('insufficient_data');
    });
  });

  // ----------------------------------------
  // Real-world Scenarios
  // ----------------------------------------
  describe('Real-world Scenarios', () => {
    it('should handle burst of requests', async () => {
      const aiService = new MockLatencyAIService({
        baseLatency: 50,
        latencyVariance: 20
      });
      const handler = new LatencyMonitoredAIHandler(aiService);

      // Simulate burst
      const promises = Array(20).fill(null).map((_, i) =>
        handler.processMessage(`Request ${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      results.forEach(r => expect(r.success).toBe(true));

      const metrics = handler.getMetrics();
      expect(metrics.count).toBe(20);
    });

    it('should detect latency spikes', async () => {
      const stats = new LatencyStatistics();

      // Normal latencies
      for (let i = 0; i < 90; i++) {
        stats.addSample(100 + Math.random() * 50);
      }

      // Spike
      for (let i = 0; i < 10; i++) {
        stats.addSample(1000 + Math.random() * 500);
      }

      const p99 = stats.getP99();
      const p50 = stats.getP50();

      // P99 should be much higher than P50 due to spike
      expect(p99).toBeGreaterThan(p50 * 5);
    });

    it('should provide actionable SLA status', () => {
      const monitor = new SLAMonitor({
        targets: {
          p50: 200,
          p90: 500,
          p95: 800,
          p99: 1500
        }
      });

      // Mix of fast and slow
      for (let i = 0; i < 80; i++) {
        monitor.recordLatency(150);
      }
      for (let i = 0; i < 20; i++) {
        monitor.recordLatency(600);
      }

      const status = monitor.getStatus();

      expect(status.current.p50).toBeLessThan(status.targets.p50);
      expect(status.current.p90).toBeGreaterThan(status.targets.p50);
    });
  });
});
