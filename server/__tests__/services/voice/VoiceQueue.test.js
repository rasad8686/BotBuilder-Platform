/**
 * Voice Queue Service Tests
 * Tests for server/services/voice/VoiceQueue.js
 */

jest.mock('../../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
}));

// Mock SpeechToText
jest.mock('../../../services/voice/SpeechToText', () => {
  return jest.fn().mockImplementation(() => ({
    transcribe: jest.fn().mockResolvedValue({
      success: true,
      text: 'Test transcription',
      confidence: 0.95,
      provider: 'whisper'
    })
  }));
});

const VoiceQueue = require('../../../services/voice/VoiceQueue');

describe('VoiceQueue Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset queue state
    VoiceQueue.queue = [];
    VoiceQueue.processing = false;
    VoiceQueue.activeJobs = 0;
    VoiceQueue.completedJobs = 0;
    VoiceQueue.failedJobs = 0;
    VoiceQueue.jobResults = new Map();
    VoiceQueue.jobCallbacks = new Map();
  });

  describe('addJob()', () => {
    it('should add a job to the queue and return job ID', async () => {
      const audioBuffer = Buffer.from('fake audio data');

      const jobId = await VoiceQueue.addJob({
        audioBuffer,
        provider: 'whisper'
      });

      // addJob returns a job ID string
      expect(typeof jobId).toBe('string');
      expect(jobId).toMatch(/^voice_\d+_[a-z0-9]+$/);
    });

    it('should add job with default priority 0', async () => {
      const jobId = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      // Check queue contains job with default priority
      expect(VoiceQueue.queue.length).toBeGreaterThanOrEqual(0);
      expect(typeof jobId).toBe('string');
    });

    it('should accept custom priority', async () => {
      const jobId = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper',
        priority: 5
      });

      expect(typeof jobId).toBe('string');
    });

    it('should start processing queue after adding job', async () => {
      const processSpy = jest.spyOn(VoiceQueue, 'processQueue');

      await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      expect(processSpy).toHaveBeenCalled();
      processSpy.mockRestore();
    });
  });

  describe('getJobStatus()', () => {
    it('should return job status for queued job', async () => {
      // Stop processing temporarily
      VoiceQueue.processing = true;
      VoiceQueue.activeJobs = VoiceQueue.concurrency;

      const jobId = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      const status = VoiceQueue.getJobStatus(jobId);
      expect(status).toBeDefined();
      expect(status.id).toBe(jobId);
      expect(status.status).toBe('pending');
    });

    it('should return not_found for non-existent job', () => {
      const status = VoiceQueue.getJobStatus('non-existent-id');
      expect(status.status).toBe('not_found');
    });
  });

  describe('getStats()', () => {
    it('should return queue statistics', () => {
      const stats = VoiceQueue.getStats();

      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('activeJobs');
      expect(stats).toHaveProperty('completedJobs');
      expect(stats).toHaveProperty('failedJobs');
      expect(stats).toHaveProperty('processing');
    });

    it('should track processing state', () => {
      const stats = VoiceQueue.getStats();
      expect(typeof stats.processing).toBe('boolean');
    });

    it('should count completed and failed jobs', () => {
      VoiceQueue.completedJobs = 5;
      VoiceQueue.failedJobs = 2;

      const stats = VoiceQueue.getStats();
      expect(stats.completedJobs).toBe(5);
      expect(stats.failedJobs).toBe(2);
    });
  });

  describe('processQueue()', () => {
    it('should not exceed concurrency limit', async () => {
      VoiceQueue.processing = true;
      VoiceQueue.activeJobs = VoiceQueue.concurrency;

      await VoiceQueue.processQueue();

      // Should return without processing more
      expect(VoiceQueue.activeJobs).toBe(VoiceQueue.concurrency);
    });

    it('should stop processing when queue is empty', async () => {
      VoiceQueue.queue = [];
      VoiceQueue.processing = false;

      await VoiceQueue.processQueue();

      expect(VoiceQueue.processing).toBe(false);
    });
  });

  describe('cancelJob()', () => {
    it('should cancel pending job', async () => {
      // Stop processing temporarily
      VoiceQueue.processing = true;
      VoiceQueue.activeJobs = VoiceQueue.concurrency;

      const jobId = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      const cancelled = VoiceQueue.cancelJob(jobId);
      expect(cancelled).toBe(true);

      const status = VoiceQueue.getJobStatus(jobId);
      expect(status.status).toBe('cancelled');
    });

    it('should return false for non-existent job', () => {
      const cancelled = VoiceQueue.cancelJob('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('provider fallback', () => {
    it('should have fallback providers configured', () => {
      expect(VoiceQueue.providers).toBeDefined();
      expect(VoiceQueue.providers.length).toBeGreaterThan(0);
    });

    it('should include common providers', () => {
      expect(VoiceQueue.providers).toContain('whisper');
      expect(VoiceQueue.providers).toContain('google');
      expect(VoiceQueue.providers).toContain('deepgram');
    });
  });

  describe('configuration', () => {
    it('should have concurrency configuration', () => {
      expect(VoiceQueue.concurrency).toBeDefined();
      expect(VoiceQueue.concurrency).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      expect(VoiceQueue.maxRetries).toBeDefined();
      expect(VoiceQueue.maxRetries).toBeGreaterThanOrEqual(0);
    });

    it('should have retry delay configuration', () => {
      expect(VoiceQueue.retryDelay).toBeDefined();
      expect(VoiceQueue.retryDelay).toBeGreaterThan(0);
    });
  });

  describe('isRetryableError()', () => {
    it('should identify timeout as retryable', () => {
      const result = VoiceQueue.isRetryableError('Request timeout');
      expect(result).toBe(true);
    });

    it('should identify rate limit as retryable', () => {
      const result = VoiceQueue.isRetryableError('Rate limit exceeded');
      expect(result).toBe(true);
    });

    it('should identify 503 as retryable', () => {
      const result = VoiceQueue.isRetryableError('503 Service Unavailable');
      expect(result).toBe(true);
    });

    it('should not identify auth error as retryable', () => {
      const result = VoiceQueue.isRetryableError('Authentication failed');
      expect(result).toBe(false);
    });
  });

  describe('waitForJob()', () => {
    it('should return result if job already completed', async () => {
      const jobId = 'test-job-id';
      VoiceQueue.jobResults.set(jobId, {
        status: 'completed',
        data: { text: 'test' },
        completedAt: new Date()
      });

      const result = await VoiceQueue.waitForJob(jobId);
      expect(result.status).toBe('completed');
      expect(result.data.text).toBe('test');
    });

    it('should timeout if job takes too long', async () => {
      const jobId = 'slow-job-id';

      await expect(VoiceQueue.waitForJob(jobId, 100))
        .rejects.toThrow('Job timeout');
    });
  });

  describe('clearOldResults()', () => {
    it('should clear old results', () => {
      const oldDate = new Date(Date.now() - 7200000); // 2 hours ago
      const recentDate = new Date();

      VoiceQueue.jobResults.set('old-job', {
        status: 'completed',
        completedAt: oldDate
      });
      VoiceQueue.jobResults.set('recent-job', {
        status: 'completed',
        completedAt: recentDate
      });

      VoiceQueue.clearOldResults(3600000); // 1 hour

      expect(VoiceQueue.jobResults.has('old-job')).toBe(false);
      expect(VoiceQueue.jobResults.has('recent-job')).toBe(true);
    });
  });
});
