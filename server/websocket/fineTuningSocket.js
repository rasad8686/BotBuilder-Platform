/**
 * Fine-Tuning WebSocket Handler
 * Real-time training status updates via WebSocket
 */

const log = require('../utils/logger');

class FineTuningSocket {
  constructor(io) {
    this.io = io;
    this.jobRooms = new Map(); // Track active job rooms
  }

  /**
   * Initialize socket handlers
   */
  initialize() {
    this.io.on('connection', (socket) => {
      // Join training room
      socket.on('training:join', (data) => {
        const { jobId } = data;
        if (jobId) {
          const room = `training:${jobId}`;
          socket.join(room);

          // Track room membership
          if (!this.jobRooms.has(jobId)) {
            this.jobRooms.set(jobId, new Set());
          }
          this.jobRooms.get(jobId).add(socket.id);

          log.info(`[FineTuning] Socket ${socket.id} joined room ${room}`);

          // Acknowledge join
          socket.emit('training:joined', { jobId, room });
        }
      });

      // Leave training room
      socket.on('training:leave', (data) => {
        const { jobId } = data;
        if (jobId) {
          const room = `training:${jobId}`;
          socket.leave(room);

          // Update room tracking
          if (this.jobRooms.has(jobId)) {
            this.jobRooms.get(jobId).delete(socket.id);
            if (this.jobRooms.get(jobId).size === 0) {
              this.jobRooms.delete(jobId);
            }
          }

          log.info(`[FineTuning] Socket ${socket.id} left room ${room}`);
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        // Clean up room memberships
        for (const [jobId, sockets] of this.jobRooms.entries()) {
          if (sockets.has(socket.id)) {
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.jobRooms.delete(jobId);
            }
          }
        }
      });
    });

    log.info('[FineTuning] WebSocket handler initialized');
  }

  /**
   * Emit progress update to job room
   * @param {string} jobId - OpenAI job ID
   * @param {Object} progress - Progress data
   */
  emitProgress(jobId, progress) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:progress', {
      jobId,
      ...progress,
      timestamp: new Date()
    });

    log.debug(`[FineTuning] Emitted progress to ${room}`, { progress });
  }

  /**
   * Emit status change
   * @param {string} jobId - OpenAI job ID
   * @param {string} status - New status
   * @param {Object} data - Additional data
   */
  emitStatusChange(jobId, status, data = {}) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:status', {
      jobId,
      status,
      ...data,
      timestamp: new Date()
    });

    log.info(`[FineTuning] Emitted status change to ${room}`, { status });
  }

  /**
   * Emit training started
   * @param {string} jobId - OpenAI job ID
   * @param {Object} data - Job data
   */
  emitStarted(jobId, data = {}) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:started', {
      jobId,
      message: 'Training has started',
      ...data,
      timestamp: new Date()
    });

    log.info(`[FineTuning] Training started: ${jobId}`);
  }

  /**
   * Emit epoch progress
   * @param {string} jobId - OpenAI job ID
   * @param {number} currentEpoch - Current epoch
   * @param {number} totalEpochs - Total epochs
   * @param {Object} metrics - Training metrics
   */
  emitEpochProgress(jobId, currentEpoch, totalEpochs, metrics = {}) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:epoch', {
      jobId,
      currentEpoch,
      totalEpochs,
      progress: Math.round((currentEpoch / totalEpochs) * 100),
      metrics,
      timestamp: new Date()
    });

    log.debug(`[FineTuning] Epoch ${currentEpoch}/${totalEpochs} for ${jobId}`);
  }

  /**
   * Emit step progress within epoch
   * @param {string} jobId - OpenAI job ID
   * @param {number} step - Current step
   * @param {number} totalSteps - Total steps
   * @param {Object} metrics - Step metrics (loss, etc.)
   */
  emitStepProgress(jobId, step, totalSteps, metrics = {}) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:step', {
      jobId,
      step,
      totalSteps,
      progress: totalSteps > 0 ? Math.round((step / totalSteps) * 100) : 0,
      metrics,
      timestamp: new Date()
    });
  }

  /**
   * Emit validation running
   * @param {string} jobId - OpenAI job ID
   */
  emitValidating(jobId) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:validating', {
      jobId,
      message: 'Running validation',
      timestamp: new Date()
    });

    log.info(`[FineTuning] Validation running: ${jobId}`);
  }

  /**
   * Emit training completed
   * @param {string} jobId - OpenAI job ID
   * @param {Object} result - Training result
   */
  emitComplete(jobId, result = {}) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:complete', {
      jobId,
      success: true,
      message: 'Training completed successfully',
      ...result,
      timestamp: new Date()
    });

    log.info(`[FineTuning] Training complete: ${jobId}`, { result });
  }

  /**
   * Emit training failed
   * @param {string} jobId - OpenAI job ID
   * @param {Object} error - Error details
   */
  emitError(jobId, error = {}) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:error', {
      jobId,
      success: false,
      message: error.message || 'Training failed',
      error,
      timestamp: new Date()
    });

    log.error(`[FineTuning] Training error: ${jobId}`, { error });
  }

  /**
   * Emit training cancelled
   * @param {string} jobId - OpenAI job ID
   */
  emitCancelled(jobId) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:cancelled', {
      jobId,
      message: 'Training was cancelled',
      timestamp: new Date()
    });

    log.info(`[FineTuning] Training cancelled: ${jobId}`);
  }

  /**
   * Emit metrics update
   * @param {string} jobId - OpenAI job ID
   * @param {Object} metrics - Training metrics
   */
  emitMetrics(jobId, metrics) {
    const room = `training:${jobId}`;
    this.io.to(room).emit('training:metrics', {
      jobId,
      metrics,
      timestamp: new Date()
    });
  }

  /**
   * Get number of clients watching a job
   * @param {string} jobId - OpenAI job ID
   * @returns {number} - Number of clients
   */
  getWatcherCount(jobId) {
    return this.jobRooms.has(jobId) ? this.jobRooms.get(jobId).size : 0;
  }

  /**
   * Check if job has watchers
   * @param {string} jobId - OpenAI job ID
   * @returns {boolean}
   */
  hasWatchers(jobId) {
    return this.getWatcherCount(jobId) > 0;
  }

  /**
   * Get all active job rooms
   * @returns {Array} - Array of job IDs being watched
   */
  getActiveJobs() {
    return Array.from(this.jobRooms.keys());
  }
}

// Singleton instance
let instance = null;

/**
 * Get or create FineTuningSocket instance
 * @param {Object} io - Socket.IO instance
 * @returns {FineTuningSocket}
 */
function getFineTuningSocket(io) {
  if (!instance && io) {
    instance = new FineTuningSocket(io);
    instance.initialize();
  }
  return instance;
}

/**
 * Get existing instance (for use in poller)
 * @returns {FineTuningSocket|null}
 */
function getInstance() {
  return instance;
}

module.exports = {
  FineTuningSocket,
  getFineTuningSocket,
  getInstance
};
