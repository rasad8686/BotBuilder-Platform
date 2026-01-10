/**
 * Tour Analytics WebSocket Handler
 * Real-time analytics for product tours
 */

const logger = require('../utils/logger');
const db = require('../config/db');

class TourSocket {
  constructor(io) {
    this.io = io;
    this.namespace = io.of('/tours');
    this.activeUsers = new Map(); // tourId -> Set of userIds
    this.activeSessions = new Map(); // tourId -> Map of sessionId -> sessionData
    this.stepDistribution = new Map(); // tourId -> Map of stepId -> count

    this.setupNamespace();
  }

  /**
   * Setup namespace event handlers
   */
  setupNamespace() {
    this.namespace.on('connection', (socket) => {
      logger.info('Tour analytics client connected', { socketId: socket.id });

      // Authentication
      const { organizationId, userId } = socket.handshake.auth || {};
      socket.organizationId = organizationId;
      socket.userId = userId;

      // Join tour room for analytics
      socket.on('join:tour', (tourId) => this.joinTourRoom(socket, tourId));

      // Leave tour room
      socket.on('leave:tour', (tourId) => this.leaveTourRoom(socket, tourId));

      // Analytics events from SDK
      socket.on('tour:started', (data) => this.handleTourStarted(socket, data));
      socket.on('tour:step_viewed', (data) => this.handleStepViewed(socket, data));
      socket.on('tour:step_completed', (data) => this.handleStepCompleted(socket, data));
      socket.on('tour:completed', (data) => this.handleTourCompleted(socket, data));
      socket.on('tour:skipped', (data) => this.handleTourSkipped(socket, data));
      socket.on('tour:error', (data) => this.handleTourError(socket, data));

      // Batch events
      socket.on('tour:batch_events', (events) => this.handleBatchEvents(socket, events));

      // Request current stats
      socket.on('tour:get_stats', (tourId) => this.sendCurrentStats(socket, tourId));

      // Disconnect
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  /**
   * Join tour analytics room
   */
  joinTourRoom(socket, tourId) {
    const room = `tour:${tourId}`;
    socket.join(room);
    socket.currentTourRoom = room;

    logger.debug('Client joined tour room', { socketId: socket.id, tourId });

    // Send current stats
    this.sendCurrentStats(socket, tourId);
  }

  /**
   * Leave tour room
   */
  leaveTourRoom(socket, tourId) {
    const room = `tour:${tourId}`;
    socket.leave(room);

    if (socket.currentTourRoom === room) {
      socket.currentTourRoom = null;
    }

    logger.debug('Client left tour room', { socketId: socket.id, tourId });
  }

  /**
   * Handle tour started event
   */
  async handleTourStarted(socket, data) {
    const { tourId, userId, sessionId, metadata } = data;

    try {
      // Track active user
      if (!this.activeUsers.has(tourId)) {
        this.activeUsers.set(tourId, new Set());
      }
      this.activeUsers.get(tourId).add(userId || sessionId);

      // Track session
      if (!this.activeSessions.has(tourId)) {
        this.activeSessions.set(tourId, new Map());
      }
      this.activeSessions.get(tourId).set(sessionId, {
        sessionId,
        visitorId: userId,
        startedAt: new Date(),
        currentStep: 0,
        metadata
      });

      // Initialize step distribution
      if (!this.stepDistribution.has(tourId)) {
        this.stepDistribution.set(tourId, new Map());
      }
      const stepDist = this.stepDistribution.get(tourId);
      stepDist.set(0, (stepDist.get(0) || 0) + 1);

      // Save to database
      await this.saveTourEvent(tourId, 'started', {
        userId,
        sessionId,
        metadata
      });

      // Emit to room
      this.emitTourStarted(tourId, userId, sessionId, metadata);

      logger.info('Tour started', { tourId, userId, sessionId });
    } catch (error) {
      logger.error('Error handling tour started:', error);
    }
  }

  /**
   * Handle step viewed event
   */
  async handleStepViewed(socket, data) {
    const { tourId, stepId, stepIndex, userId, sessionId } = data;

    try {
      // Update session current step
      const sessions = this.activeSessions.get(tourId);
      if (sessions && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        session.currentStep = stepIndex;
        session.lastActivity = new Date();
      }

      // Update step distribution
      const stepDist = this.stepDistribution.get(tourId);
      if (stepDist) {
        // Decrement previous step
        const prevStep = stepIndex - 1;
        if (prevStep >= 0 && stepDist.get(prevStep) > 0) {
          stepDist.set(prevStep, stepDist.get(prevStep) - 1);
        }
        // Increment current step
        stepDist.set(stepIndex, (stepDist.get(stepIndex) || 0) + 1);
      }

      // Save to database
      await this.saveTourEvent(tourId, 'step_viewed', {
        stepId,
        stepIndex,
        userId,
        sessionId
      });

      // Emit to room
      this.emitStepViewed(tourId, stepId, stepIndex, userId, sessionId);

    } catch (error) {
      logger.error('Error handling step viewed:', error);
    }
  }

  /**
   * Handle step completed event
   */
  async handleStepCompleted(socket, data) {
    const { tourId, stepId, stepIndex, userId, sessionId, timeSpent } = data;

    try {
      // Save to database
      await this.saveTourEvent(tourId, 'step_completed', {
        stepId,
        stepIndex,
        userId,
        sessionId,
        timeSpent
      });

      // Emit to room
      this.emitStepCompleted(tourId, stepId, stepIndex, userId, sessionId, timeSpent);

    } catch (error) {
      logger.error('Error handling step completed:', error);
    }
  }

  /**
   * Handle tour completed event
   */
  async handleTourCompleted(socket, data) {
    const { tourId, userId, sessionId, duration, completedSteps, totalSteps } = data;

    try {
      // Remove from active users
      const users = this.activeUsers.get(tourId);
      if (users) {
        users.delete(userId || sessionId);
      }

      // Remove session
      const sessions = this.activeSessions.get(tourId);
      if (sessions) {
        sessions.delete(sessionId);
      }

      // Update step distribution - remove from last step
      const stepDist = this.stepDistribution.get(tourId);
      if (stepDist && totalSteps > 0) {
        const lastStep = totalSteps - 1;
        if (stepDist.get(lastStep) > 0) {
          stepDist.set(lastStep, stepDist.get(lastStep) - 1);
        }
      }

      // Save to database
      await this.saveTourEvent(tourId, 'completed', {
        userId,
        sessionId,
        duration,
        completedSteps,
        totalSteps
      });

      // Update tour completion stats
      await this.updateTourStats(tourId, 'completion');

      // Emit to room
      this.emitTourCompleted(tourId, userId, sessionId, duration);

      logger.info('Tour completed', { tourId, userId, duration });
    } catch (error) {
      logger.error('Error handling tour completed:', error);
    }
  }

  /**
   * Handle tour skipped event
   */
  async handleTourSkipped(socket, data) {
    const { tourId, userId, sessionId, skippedAtStep, reason } = data;

    try {
      // Remove from active users
      const users = this.activeUsers.get(tourId);
      if (users) {
        users.delete(userId || sessionId);
      }

      // Remove session
      const sessions = this.activeSessions.get(tourId);
      if (sessions) {
        sessions.delete(sessionId);
      }

      // Update step distribution
      const stepDist = this.stepDistribution.get(tourId);
      if (stepDist && stepDist.get(skippedAtStep) > 0) {
        stepDist.set(skippedAtStep, stepDist.get(skippedAtStep) - 1);
      }

      // Save to database
      await this.saveTourEvent(tourId, 'skipped', {
        userId,
        sessionId,
        skippedAtStep,
        reason
      });

      // Update drop-off stats
      await this.updateDropOffStats(tourId, skippedAtStep);

      // Emit to room
      this.emitTourSkipped(tourId, userId, sessionId, skippedAtStep, reason);

      logger.info('Tour skipped', { tourId, userId, skippedAtStep });
    } catch (error) {
      logger.error('Error handling tour skipped:', error);
    }
  }

  /**
   * Handle tour error event
   */
  async handleTourError(socket, data) {
    const { tourId, userId, sessionId, error, stepId } = data;

    try {
      // Save to database
      await this.saveTourEvent(tourId, 'error', {
        userId,
        sessionId,
        error,
        stepId
      });

      // Emit to room
      this.namespace.to(`tour:${tourId}`).emit('tour:error', {
        tourId,
        userId,
        sessionId,
        error,
        stepId,
        timestamp: new Date()
      });

      logger.warn('Tour error', { tourId, userId, error });
    } catch (err) {
      logger.error('Error handling tour error:', err);
    }
  }

  /**
   * Handle batch events (for offline queue)
   */
  async handleBatchEvents(socket, events) {
    if (!Array.isArray(events)) return;

    for (const event of events) {
      const { type, data } = event;

      switch (type) {
        case 'started':
          await this.handleTourStarted(socket, data);
          break;
        case 'step_viewed':
          await this.handleStepViewed(socket, data);
          break;
        case 'step_completed':
          await this.handleStepCompleted(socket, data);
          break;
        case 'completed':
          await this.handleTourCompleted(socket, data);
          break;
        case 'skipped':
          await this.handleTourSkipped(socket, data);
          break;
        case 'error':
          await this.handleTourError(socket, data);
          break;
      }
    }

    // Acknowledge batch processed
    socket.emit('tour:batch_ack', { count: events.length });
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(socket) {
    logger.debug('Tour analytics client disconnected', { socketId: socket.id });

    // Clean up any tracked state if needed
    // Note: Don't remove from activeUsers/Sessions on disconnect
    // as the tour might still be active in the user's browser
  }

  /**
   * Emit tour started to room
   */
  emitTourStarted(tourId, userId, sessionId, metadata) {
    const stats = this.getCurrentStats(tourId);

    this.namespace.to(`tour:${tourId}`).emit('tour:started', {
      tourId,
      userId,
      sessionId,
      metadata,
      timestamp: new Date(),
      stats
    });
  }

  /**
   * Emit step viewed to room
   */
  emitStepViewed(tourId, stepId, stepIndex, userId, sessionId) {
    const stats = this.getCurrentStats(tourId);

    this.namespace.to(`tour:${tourId}`).emit('tour:step_viewed', {
      tourId,
      stepId,
      stepIndex,
      userId,
      sessionId,
      timestamp: new Date(),
      stats
    });
  }

  /**
   * Emit step completed to room
   */
  emitStepCompleted(tourId, stepId, stepIndex, userId, sessionId, timeSpent) {
    this.namespace.to(`tour:${tourId}`).emit('tour:step_completed', {
      tourId,
      stepId,
      stepIndex,
      userId,
      sessionId,
      timeSpent,
      timestamp: new Date()
    });
  }

  /**
   * Emit tour completed to room
   */
  emitTourCompleted(tourId, userId, sessionId, duration) {
    const stats = this.getCurrentStats(tourId);

    this.namespace.to(`tour:${tourId}`).emit('tour:completed', {
      tourId,
      userId,
      sessionId,
      duration,
      timestamp: new Date(),
      stats
    });
  }

  /**
   * Emit tour skipped to room
   */
  emitTourSkipped(tourId, userId, sessionId, skippedAtStep, reason) {
    const stats = this.getCurrentStats(tourId);

    this.namespace.to(`tour:${tourId}`).emit('tour:skipped', {
      tourId,
      userId,
      sessionId,
      skippedAtStep,
      reason,
      timestamp: new Date(),
      stats
    });
  }

  /**
   * Get current real-time stats for a tour
   */
  getCurrentStats(tourId) {
    const activeCount = this.activeUsers.get(tourId)?.size || 0;
    const sessions = this.activeSessions.get(tourId);
    const stepDist = this.stepDistribution.get(tourId);

    // Convert step distribution to array
    const stepDistArray = [];
    if (stepDist) {
      for (const [step, count] of stepDist) {
        stepDistArray.push({ step, count });
      }
      stepDistArray.sort((a, b) => a.step - b.step);
    }

    // Get active sessions list
    const activeSessions = [];
    if (sessions) {
      for (const [sessionId, data] of sessions) {
        activeSessions.push({
          sessionId,
          visitorId: data.visitorId,
          currentStep: data.currentStep,
          startedAt: data.startedAt,
          lastActivity: data.lastActivity || data.startedAt
        });
      }
    }

    return {
      activeUsers: activeCount,
      activeSessions: activeSessions.length,
      sessionsList: activeSessions.slice(0, 20), // Limit to 20
      stepDistribution: stepDistArray,
      timestamp: new Date()
    };
  }

  /**
   * Send current stats to a specific socket
   */
  sendCurrentStats(socket, tourId) {
    const stats = this.getCurrentStats(tourId);
    socket.emit('tour:stats', { tourId, ...stats });
  }

  /**
   * Save tour event to database
   */
  async saveTourEvent(tourId, eventType, data) {
    try {
      await db('tour_analytics').insert({
        tour_id: tourId,
        event_type: eventType,
        visitor_id: data.userId || data.visitorId,
        session_id: data.sessionId,
        step_id: data.stepId,
        step_index: data.stepIndex,
        data: JSON.stringify(data),
        created_at: new Date()
      });
    } catch (error) {
      logger.error('Error saving tour event:', error);
    }
  }

  /**
   * Update tour completion stats
   */
  async updateTourStats(tourId, type) {
    try {
      if (type === 'completion') {
        await db('tours')
          .where({ id: tourId })
          .increment('completion_count', 1);
      }
    } catch (error) {
      logger.error('Error updating tour stats:', error);
    }
  }

  /**
   * Update drop-off stats
   */
  async updateDropOffStats(tourId, stepIndex) {
    try {
      // Get existing drop-off data
      const tour = await db('tours').where({ id: tourId }).first();
      const dropOffs = tour?.drop_off_stats ? JSON.parse(tour.drop_off_stats) : {};

      dropOffs[stepIndex] = (dropOffs[stepIndex] || 0) + 1;

      await db('tours')
        .where({ id: tourId })
        .update({
          drop_off_stats: JSON.stringify(dropOffs)
        });
    } catch (error) {
      logger.error('Error updating drop-off stats:', error);
    }
  }

  /**
   * Broadcast stats update to all clients in a tour room
   */
  broadcastStatsUpdate(tourId) {
    const stats = this.getCurrentStats(tourId);
    this.namespace.to(`tour:${tourId}`).emit('tour:stats_update', {
      tourId,
      ...stats
    });
  }

  /**
   * Get all active tours with stats
   */
  getAllActiveToursStats() {
    const stats = [];
    for (const [tourId, users] of this.activeUsers) {
      stats.push({
        tourId,
        ...this.getCurrentStats(tourId)
      });
    }
    return stats;
  }
}

module.exports = TourSocket;
