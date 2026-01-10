/**
 * Email Queue using Bull
 * Handles job scheduling, progress tracking, and failed job handling
 * Redis is optional - falls back to in-memory if not available
 */

// Check if Redis is configured BEFORE importing Bull
const REDIS_CONFIGURED = !!(process.env.REDIS_HOST || process.env.REDIS_URL);

// Track state
let redisWarningShown = false;
let redisAvailable = false;

// In-memory fallback storage
const inMemoryJobs = {
  email: [],
  campaign: [],
  scheduled: []
};

let emailQueue = null;
let campaignQueue = null;
let scheduledQueue = null;

// Only create Bull queues if Redis is explicitly configured
if (REDIS_CONFIGURED) {
  const Queue = require('bull');

  // Redis connection config
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    retryStrategy: (times) => {
      if (times > 2) {
        if (!redisWarningShown) {
          console.warn('[EmailQueue] Redis connection failed after retries - using in-memory fallback');
          redisWarningShown = true;
        }
        return null; // Stop retrying
      }
      return Math.min(times * 500, 2000);
    }
  };

  try {
    emailQueue = new Queue('email-sending', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: {
          age: 24 * 3600,
          count: 1000
        },
        removeOnFail: false
      },
      limiter: {
        max: 100,
        duration: 1000
      }
    });

    campaignQueue = new Queue('campaign-processing', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: {
          age: 7 * 24 * 3600,
          count: 100
        }
      }
    });

    scheduledQueue = new Queue('email-scheduled', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000
        }
      }
    });

    // Silent error handler - only warn once
    const silentErrorHandler = (error) => {
      if (!redisWarningShown && (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')) {
        console.warn('[EmailQueue] Redis not available - using in-memory fallback');
        redisWarningShown = true;
      }
      // Silently ignore subsequent Redis errors
    };

    emailQueue.on('error', silentErrorHandler);
    campaignQueue.on('error', silentErrorHandler);
    scheduledQueue.on('error', silentErrorHandler);

    // Check Redis availability
    emailQueue.isReady().then(() => {
      redisAvailable = true;
      console.log('[EmailQueue] Redis connected - queue system active');
    }).catch(() => {
      redisAvailable = false;
      if (!redisWarningShown) {
        console.warn('[EmailQueue] Redis not available - using in-memory fallback');
        redisWarningShown = true;
      }
    });

  } catch (error) {
    if (!redisWarningShown) {
      console.warn('[EmailQueue] Failed to initialize Redis queues - using in-memory fallback');
      redisWarningShown = true;
    }
    emailQueue = null;
    campaignQueue = null;
    scheduledQueue = null;
  }
} else {
  // No Redis configured - log once and use in-memory
  console.log('[EmailQueue] Redis not configured - using in-memory fallback');
  redisWarningShown = true;
}

/**
 * Add emails to queue
 */
async function addToQueue(campaignId, emails, options = {}) {
  if (!redisAvailable || !emailQueue) {
    // In-memory fallback
    const jobs = emails.map(email => ({
      id: `email-${email.id}`,
      data: { sendId: email.id, campaignId, contactId: email.contact_id, email: email.email }
    }));
    inMemoryJobs.email.push(...jobs);
    return { queued: jobs.length, fallback: true };
  }

  const jobs = emails.map(email => ({
    name: 'send-email',
    data: {
      sendId: email.id,
      campaignId,
      contactId: email.contact_id,
      email: email.email,
      priority: email.priority || 0
    },
    opts: {
      priority: email.priority || 0,
      delay: options.delay || 0,
      jobId: `email-${email.id}`
    }
  }));

  await emailQueue.addBulk(jobs);
  return { queued: jobs.length };
}

/**
 * Add a campaign for processing
 */
async function addCampaignJob(campaignId, options = {}) {
  if (!redisAvailable || !campaignQueue) {
    const job = { id: `campaign-${campaignId}`, data: { campaignId, ...options } };
    inMemoryJobs.campaign.push(job);
    return job;
  }

  const job = await campaignQueue.add('process-campaign', {
    campaignId,
    batchSize: options.batchSize || 100,
    delayBetweenBatches: options.delayBetweenBatches || 1000
  }, {
    jobId: `campaign-${campaignId}`
  });

  return job;
}

/**
 * Schedule an email for later
 */
async function scheduleEmail(emailData, scheduledAt) {
  const delay = new Date(scheduledAt).getTime() - Date.now();

  if (!redisAvailable || !scheduledQueue) {
    const job = { id: `scheduled-${emailData.sendId}`, data: emailData, scheduledAt };
    inMemoryJobs.scheduled.push(job);
    return job;
  }

  if (delay <= 0) {
    return emailQueue.add('send-email', emailData);
  }

  return scheduledQueue.add('scheduled-send', emailData, {
    delay,
    jobId: `scheduled-${emailData.sendId}`
  });
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  if (!redisAvailable || !emailQueue) {
    return {
      waiting: inMemoryJobs.email.length,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: inMemoryJobs.scheduled.length,
      paused: 0,
      total: inMemoryJobs.email.length + inMemoryJobs.scheduled.length,
      fallback: true
    };
  }

  const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
    emailQueue.getWaitingCount(),
    emailQueue.getActiveCount(),
    emailQueue.getCompletedCount(),
    emailQueue.getFailedCount(),
    emailQueue.getDelayedCount(),
    emailQueue.getPausedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + delayed + paused
  };
}

/**
 * Get campaign-specific queue stats
 */
async function getCampaignQueueStats(campaignId) {
  if (!redisAvailable || !emailQueue) {
    const jobs = inMemoryJobs.email.filter(j => j.data.campaignId === campaignId);
    return { pending: jobs.length, processing: 0, failed: 0, delayed: 0, fallback: true };
  }

  const jobs = await emailQueue.getJobs(['waiting', 'active', 'delayed', 'failed']);
  const campaignJobs = jobs.filter(job => job.data.campaignId === campaignId);

  const stats = { pending: 0, processing: 0, failed: 0, delayed: 0 };

  for (const job of campaignJobs) {
    const state = await job.getState();
    switch (state) {
      case 'waiting': stats.pending++; break;
      case 'active': stats.processing++; break;
      case 'failed': stats.failed++; break;
      case 'delayed': stats.delayed++; break;
    }
  }

  return stats;
}

/**
 * Pause campaign processing
 */
async function pauseCampaign(campaignId) {
  if (!redisAvailable || !emailQueue) {
    const removed = inMemoryJobs.email.filter(j => j.data.campaignId === campaignId).length;
    inMemoryJobs.email = inMemoryJobs.email.filter(j => j.data.campaignId !== campaignId);
    return { paused: removed, fallback: true };
  }

  const waitingJobs = await emailQueue.getWaiting();
  const delayedJobs = await emailQueue.getDelayed();
  const allJobs = [...waitingJobs, ...delayedJobs];
  const campaignJobs = allJobs.filter(job => job.data.campaignId === campaignId);

  const removedCount = await Promise.all(campaignJobs.map(job => job.remove()));
  return { paused: removedCount.length };
}

/**
 * Resume campaign processing
 */
async function resumeCampaign(campaignId, pendingEmails) {
  return addToQueue(campaignId, pendingEmails);
}

/**
 * Cancel campaign - remove all pending jobs
 */
async function cancelCampaign(campaignId) {
  if (!redisAvailable || !emailQueue) {
    const cancelled = inMemoryJobs.email.filter(j => j.data.campaignId === campaignId).length;
    inMemoryJobs.email = inMemoryJobs.email.filter(j => j.data.campaignId !== campaignId);
    return { cancelled, fallback: true };
  }

  const jobs = await emailQueue.getJobs(['waiting', 'delayed', 'active']);
  const campaignJobs = jobs.filter(job => job.data.campaignId === campaignId);

  let cancelled = 0;
  for (const job of campaignJobs) {
    const state = await job.getState();
    if (state !== 'active') {
      await job.remove();
      cancelled++;
    }
  }

  return { cancelled };
}

/**
 * Retry failed emails for a campaign
 */
async function retryFailedEmails(campaignId) {
  if (!redisAvailable || !emailQueue) {
    return { retried: 0, fallback: true };
  }

  const failedJobs = await emailQueue.getFailed();
  const campaignJobs = failedJobs.filter(job => job.data.campaignId === campaignId);

  let retried = 0;
  for (const job of campaignJobs) {
    await job.retry();
    retried++;
  }

  return { retried };
}

/**
 * Get failed jobs for a campaign
 */
async function getFailedJobs(campaignId) {
  if (!redisAvailable || !emailQueue) {
    return [];
  }

  const failedJobs = await emailQueue.getFailed();
  return failedJobs
    .filter(job => job.data.campaignId === campaignId)
    .map(job => ({
      id: job.id,
      sendId: job.data.sendId,
      email: job.data.email,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn
    }));
}

/**
 * Clean old completed/failed jobs
 */
async function cleanQueue(gracePeriod = 24 * 60 * 60 * 1000) {
  if (!redisAvailable || !emailQueue) {
    return { cleaned: 0, fallback: true };
  }

  await emailQueue.clean(gracePeriod, 'completed');
  await emailQueue.clean(gracePeriod * 7, 'failed');
}

/**
 * Get job by ID
 */
async function getJob(jobId) {
  if (!redisAvailable || !emailQueue) {
    return inMemoryJobs.email.find(j => j.id === jobId) || null;
  }
  return emailQueue.getJob(jobId);
}

/**
 * Get job progress
 */
async function getJobProgress(jobId) {
  if (!redisAvailable || !emailQueue) {
    const job = inMemoryJobs.email.find(j => j.id === jobId);
    return job ? { id: job.id, progress: 0, state: 'waiting', fallback: true } : null;
  }

  const job = await emailQueue.getJob(jobId);
  if (!job) return null;

  return {
    id: job.id,
    progress: job.progress(),
    state: await job.getState(),
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  };
}

module.exports = {
  emailQueue,
  campaignQueue,
  scheduledQueue,
  addToQueue,
  addCampaignJob,
  scheduleEmail,
  getQueueStats,
  getCampaignQueueStats,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  retryFailedEmails,
  getFailedJobs,
  cleanQueue,
  getJob,
  getJobProgress,
  isRedisAvailable: () => redisAvailable
};
