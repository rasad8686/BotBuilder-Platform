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
      confidence: 0.95
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
    VoiceQueue.jobs = new Map();
  });

  describe('addJob()', () => {
    it('should add a job to the queue', async () => {
      const audioBuffer = Buffer.from('fake audio data');

      const job = await VoiceQueue.addJob({
        audioBuffer,
        provider: 'whisper',
        language: 'en'
      });

      expect(job).toHaveProperty('id');
      expect(job.status).toBe('pending');
      expect(job.provider).toBe('whisper');
      expect(job.language).toBe('en');
    });

    it('should assign default priority', async () => {
      const job = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      expect(job.priority).toBe(2);
    });

    it('should accept custom priority', async () => {
      const job = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper',
        priority: 1
      });

      expect(job.priority).toBe(1);
    });

    it('should store job in jobs map', async () => {
      const job = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      const storedJob = VoiceQueue.getJob(job.id);
      expect(storedJob).toBeDefined();
      expect(storedJob.id).toBe(job.id);
    });

    it('should sort queue by priority', async () => {
      await VoiceQueue.addJob({
        audioBuffer: Buffer.from('low'),
        provider: 'whisper',
        priority: 3
      });

      await VoiceQueue.addJob({
        audioBuffer: Buffer.from('high'),
        provider: 'whisper',
        priority: 1
      });

      await VoiceQueue.addJob({
        audioBuffer: Buffer.from('normal'),
        provider: 'whisper',
        priority: 2
      });

      // Queue should be sorted by priority
      expect(VoiceQueue.queue.length).toBe(3);
      expect(VoiceQueue.queue[0].priority).toBe(1);
      expect(VoiceQueue.queue[1].priority).toBe(2);
      expect(VoiceQueue.queue[2].priority).toBe(3);
    });
  });

  describe('getJob()', () => {
    it('should return job by id', async () => {
      const job = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      const retrieved = VoiceQueue.getJob(job.id);
      expect(retrieved).toEqual(job);
    });

    it('should return undefined for non-existent job', () => {
      const result = VoiceQueue.getJob('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('getStats()', () => {
    it('should return queue statistics', async () => {
      await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test1'),
        provider: 'whisper'
      });

      await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test2'),
        provider: 'google'
      });

      const stats = VoiceQueue.getStats();

      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('processing');
      expect(stats.queueLength).toBe(2);
    });

    it('should track processing state', () => {
      const stats = VoiceQueue.getStats();
      expect(stats.processing).toBe(false);
    });
  });

  describe('processQueue()', () => {
    it('should not start if already processing', async () => {
      VoiceQueue.processing = true;

      await VoiceQueue.processQueue();

      // Should return early without processing
      expect(VoiceQueue.processing).toBe(true);
    });

    it('should not start if queue is empty', async () => {
      VoiceQueue.queue = [];

      await VoiceQueue.processQueue();

      expect(VoiceQueue.processing).toBe(false);
    });
  });

  describe('retryJob()', () => {
    it('should increment retry count', async () => {
      const job = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      job.retries = 0;
      VoiceQueue.retryJob(job);

      expect(job.retries).toBe(1);
    });

    it('should re-add job to queue', async () => {
      const job = await VoiceQueue.addJob({
        audioBuffer: Buffer.from('test'),
        provider: 'whisper'
      });

      // Remove from queue first
      VoiceQueue.queue = VoiceQueue.queue.filter(j => j.id !== job.id);
      expect(VoiceQueue.queue.length).toBe(0);

      job.retries = 0;
      VoiceQueue.retryJob(job);

      expect(VoiceQueue.queue.length).toBe(1);
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

  describe('rate limiting', () => {
    it('should have rate limit configuration', () => {
      expect(VoiceQueue.maxConcurrent).toBeDefined();
      expect(VoiceQueue.maxConcurrent).toBeGreaterThan(0);
    });

    it('should have retry configuration', () => {
      expect(VoiceQueue.maxRetries).toBeDefined();
      expect(VoiceQueue.maxRetries).toBeGreaterThanOrEqual(0);
    });
  });
});
