/**
 * Voice Message Queue Service
 * Handles queuing and retry mechanism for voice transcriptions
 * Uses in-memory queue with optional Redis/Bull support
 */

const log = require('../../utils/logger');
const SpeechToText = require('./SpeechToText');

class VoiceQueue {
  constructor(options = {}) {
    this.queue = [];
    this.processing = false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.concurrency = options.concurrency || 2;
    this.activeJobs = 0;
    this.completedJobs = 0;
    this.failedJobs = 0;
    this.jobResults = new Map();
    this.jobCallbacks = new Map();
    this.providers = ['whisper', 'google', 'deepgram']; // Fallback order
  }

  /**
   * Add transcription job to queue
   * @param {Object} job - Job details
   * @returns {string} Job ID
   */
  async addJob(job) {
    const jobId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const queueJob = {
      id: jobId,
      audioBuffer: job.audioBuffer,
      audioUrl: job.audioUrl,
      options: job.options || {},
      provider: job.provider || 'whisper',
      retries: 0,
      status: 'pending',
      createdAt: new Date(),
      priority: job.priority || 0
    };

    // Insert by priority (higher priority first)
    const insertIndex = this.queue.findIndex(j => j.priority < queueJob.priority);
    if (insertIndex === -1) {
      this.queue.push(queueJob);
    } else {
      this.queue.splice(insertIndex, 0, queueJob);
    }

    log.info('Voice job added to queue', { jobId, provider: queueJob.provider });

    // Start processing if not already
    this.processQueue();

    return jobId;
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Object} Job status
   */
  getJobStatus(jobId) {
    const queuedJob = this.queue.find(j => j.id === jobId);
    if (queuedJob) {
      return {
        id: jobId,
        status: queuedJob.status,
        retries: queuedJob.retries,
        createdAt: queuedJob.createdAt
      };
    }

    const result = this.jobResults.get(jobId);
    if (result) {
      return {
        id: jobId,
        status: result.status,
        result: result.data,
        completedAt: result.completedAt
      };
    }

    return { id: jobId, status: 'not_found' };
  }

  /**
   * Wait for job completion
   * @param {string} jobId - Job ID
   * @param {number} timeout - Timeout in ms
   * @returns {Promise} Job result
   */
  waitForJob(jobId, timeout = 60000) {
    return new Promise((resolve, reject) => {
      // Check if already completed
      const result = this.jobResults.get(jobId);
      if (result) {
        return resolve(result);
      }

      // Set up callback
      const timeoutId = setTimeout(() => {
        this.jobCallbacks.delete(jobId);
        reject(new Error('Job timeout'));
      }, timeout);

      this.jobCallbacks.set(jobId, (result) => {
        clearTimeout(timeoutId);
        this.jobCallbacks.delete(jobId);
        resolve(result);
      });
    });
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing && this.activeJobs >= this.concurrency) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
      const job = this.queue.shift();
      if (job) {
        this.activeJobs++;
        this.processJob(job).finally(() => {
          this.activeJobs--;
          this.processQueue();
        });
      }
    }

    if (this.queue.length === 0 && this.activeJobs === 0) {
      this.processing = false;
    }
  }

  /**
   * Process individual job with retry
   * @param {Object} job - Job to process
   */
  async processJob(job) {
    job.status = 'processing';
    job.startedAt = new Date();

    try {
      const result = await this.transcribeWithRetry(job);

      job.status = 'completed';
      this.completedJobs++;

      const jobResult = {
        status: 'completed',
        data: result,
        completedAt: new Date()
      };

      this.jobResults.set(job.id, jobResult);

      // Trigger callback if exists
      const callback = this.jobCallbacks.get(job.id);
      if (callback) {
        callback(jobResult);
      }

      log.info('Voice job completed', { jobId: job.id, provider: result.provider });

    } catch (error) {
      job.status = 'failed';
      this.failedJobs++;

      const jobResult = {
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      };

      this.jobResults.set(job.id, jobResult);

      // Trigger callback if exists
      const callback = this.jobCallbacks.get(job.id);
      if (callback) {
        callback(jobResult);
      }

      log.error('Voice job failed', { jobId: job.id, error: error.message });
    }
  }

  /**
   * Transcribe with retry and fallback providers
   * @param {Object} job - Job details
   * @returns {Object} Transcription result
   */
  async transcribeWithRetry(job) {
    const providers = [job.provider, ...this.providers.filter(p => p !== job.provider)];

    for (const provider of providers) {
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const stt = new SpeechToText(provider);
          const result = await stt.transcribe(job.audioBuffer, job.options);

          if (result.success) {
            return result;
          }

          // Check if error is retryable
          if (this.isRetryableError(result.error)) {
            job.retries++;
            await this.delay(this.retryDelay * Math.pow(2, attempt)); // Exponential backoff
            continue;
          }

          // Non-retryable error, try next provider
          break;

        } catch (error) {
          job.retries++;

          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * Math.pow(2, attempt));
          }
        }
      }

      log.warn('Provider failed, trying next', { provider, jobId: job.id });
    }

    throw new Error('All transcription providers failed');
  }

  /**
   * Check if error is retryable
   * @param {string} error - Error message
   * @returns {boolean} Is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'timeout',
      'rate limit',
      'too many requests',
      'service unavailable',
      'internal server error',
      '503',
      '429',
      '500'
    ];

    return retryableErrors.some(e =>
      error.toLowerCase().includes(e.toLowerCase())
    );
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   * @returns {Object} Queue stats
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs,
      completedJobs: this.completedJobs,
      failedJobs: this.failedJobs,
      processing: this.processing
    };
  }

  /**
   * Clear completed job results (older than specified time)
   * @param {number} maxAge - Max age in ms
   */
  clearOldResults(maxAge = 3600000) { // Default 1 hour
    const cutoff = new Date(Date.now() - maxAge);

    for (const [jobId, result] of this.jobResults.entries()) {
      if (result.completedAt < cutoff) {
        this.jobResults.delete(jobId);
      }
    }
  }

  /**
   * Cancel pending job
   * @param {string} jobId - Job ID
   * @returns {boolean} Success
   */
  cancelJob(jobId) {
    const index = this.queue.findIndex(j => j.id === jobId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.jobResults.set(jobId, {
        status: 'cancelled',
        completedAt: new Date()
      });
      return true;
    }
    return false;
  }
}

// Export singleton instance
module.exports = new VoiceQueue();
