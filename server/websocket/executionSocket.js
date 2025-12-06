/**
 * Execution WebSocket Handler
 * Manages real-time execution updates for multi-agent workflows
 */

const log = require('../utils/logger');

class ExecutionSocket {
  constructor(io) {
    this.io = io;
    this.executionRooms = new Map(); // executionId -> Set of socket ids
  }

  /**
   * Initialize socket handlers
   */
  initialize() {
    this.io.on('connection', (socket) => {
      log.info(`[ExecutionSocket] Client connected: ${socket.id}`);

      // Join execution room
      socket.on('execution:join', (executionId) => {
        this.joinExecution(socket, executionId);
      });

      // Leave execution room
      socket.on('execution:leave', (executionId) => {
        this.leaveExecution(socket, executionId);
      });

      // Handle pause request
      socket.on('execution:pause', (executionId) => {
        this.handlePause(executionId);
      });

      // Handle stop request
      socket.on('execution:stop', (executionId) => {
        this.handleStop(executionId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Join an execution room
   */
  joinExecution(socket, executionId) {
    const room = `execution:${executionId}`;
    socket.join(room);

    if (!this.executionRooms.has(executionId)) {
      this.executionRooms.set(executionId, new Set());
    }
    this.executionRooms.get(executionId).add(socket.id);

    log.info(`[ExecutionSocket] Socket ${socket.id} joined room ${room}`);

    socket.emit('execution:joined', { executionId, room });
  }

  /**
   * Leave an execution room
   */
  leaveExecution(socket, executionId) {
    const room = `execution:${executionId}`;
    socket.leave(room);

    if (this.executionRooms.has(executionId)) {
      this.executionRooms.get(executionId).delete(socket.id);
      if (this.executionRooms.get(executionId).size === 0) {
        this.executionRooms.delete(executionId);
      }
    }

    log.info(`[ExecutionSocket] Socket ${socket.id} left room ${room}`);
  }

  /**
   * Handle socket disconnect
   */
  handleDisconnect(socket) {
    log.info(`[ExecutionSocket] Client disconnected: ${socket.id}`);

    // Remove from all execution rooms
    for (const [executionId, sockets] of this.executionRooms) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.executionRooms.delete(executionId);
        }
      }
    }
  }

  /**
   * Handle pause request
   */
  handlePause(executionId) {
    // Emit pause event to workflow engine
    this.io.emit(`execution:${executionId}:pause`);
  }

  /**
   * Handle stop request
   */
  handleStop(executionId) {
    // Emit stop event to workflow engine
    this.io.emit(`execution:${executionId}:stop`);
  }

  /**
   * Broadcast to all clients in an execution room
   */
  broadcastToExecution(executionId, event, data) {
    const room = `execution:${executionId}`;
    this.io.to(room).emit(event, {
      ...data,
      executionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Emit execution start event
   */
  emitExecutionStart(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:start', {
      type: 'executionStart',
      workflowId: data.workflowId,
      workflowName: data.workflowName,
      input: data.input
    });
  }

  /**
   * Emit step start event
   */
  emitStepStart(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:stepStart', {
      type: 'stepStart',
      stepId: data.stepId,
      agentId: data.agentId,
      agentName: data.agentName,
      agentRole: data.agentRole,
      input: data.input,
      order: data.order
    });
  }

  /**
   * Emit step progress event (for streaming)
   */
  emitStepProgress(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:stepProgress', {
      type: 'stepProgress',
      stepId: data.stepId,
      output: data.output
    });
  }

  /**
   * Emit step complete event
   */
  emitStepComplete(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:stepComplete', {
      type: 'stepComplete',
      stepId: data.stepId,
      agentId: data.agentId,
      agentName: data.agentName,
      output: data.output,
      duration: data.duration,
      tokens: data.tokens,
      cost: data.cost
    });
  }

  /**
   * Emit step failed event
   */
  emitStepFailed(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:stepFailed', {
      type: 'stepFailed',
      stepId: data.stepId,
      agentId: data.agentId,
      agentName: data.agentName,
      error: data.error,
      duration: data.duration
    });
  }

  /**
   * Emit agent message event
   */
  emitAgentMessage(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:agentMessage', {
      type: 'agentMessage',
      messageId: data.messageId,
      fromAgent: data.fromAgent,
      toAgent: data.toAgent,
      messageType: data.messageType,
      content: data.content
    });
  }

  /**
   * Emit execution complete event
   */
  emitExecutionComplete(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:complete', {
      type: 'executionComplete',
      status: 'completed',
      output: data.output,
      totalDuration: data.totalDuration,
      totalTokens: data.totalTokens,
      totalCost: data.totalCost,
      agentBreakdown: data.agentBreakdown
    });
  }

  /**
   * Emit execution error event
   */
  emitExecutionError(executionId, data) {
    this.broadcastToExecution(executionId, 'execution:error', {
      type: 'executionFailed',
      status: 'failed',
      error: data.error,
      stepId: data.stepId,
      agentId: data.agentId
    });
  }

  /**
   * Emit execution paused event
   */
  emitExecutionPaused(executionId) {
    this.broadcastToExecution(executionId, 'execution:paused', {
      type: 'executionPaused',
      status: 'paused'
    });
  }

  /**
   * Emit execution resumed event
   */
  emitExecutionResumed(executionId) {
    this.broadcastToExecution(executionId, 'execution:resumed', {
      type: 'executionResumed',
      status: 'running'
    });
  }

  /**
   * Send update for a specific step
   */
  sendStepUpdate(executionId, stepId, status, data = {}) {
    const eventMap = {
      start: 'emitStepStart',
      progress: 'emitStepProgress',
      complete: 'emitStepComplete',
      failed: 'emitStepFailed'
    };

    const method = eventMap[status];
    if (method && this[method]) {
      this[method](executionId, { stepId, ...data });
    }
  }

  /**
   * Send a message between agents
   */
  sendMessage(executionId, fromAgent, toAgent, messageType, content) {
    this.emitAgentMessage(executionId, {
      messageId: `msg-${Date.now()}`,
      fromAgent,
      toAgent,
      messageType,
      content
    });
  }

  /**
   * Get connected clients count for an execution
   */
  getConnectedClients(executionId) {
    return this.executionRooms.get(executionId)?.size || 0;
  }

  /**
   * Check if execution has connected clients
   */
  hasConnectedClients(executionId) {
    return this.getConnectedClients(executionId) > 0;
  }
}

module.exports = ExecutionSocket;
