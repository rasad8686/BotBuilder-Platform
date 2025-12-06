/**
 * WebSocket Server Initialization
 * Integrates Socket.IO with Express server
 */

const { Server } = require('socket.io');
const ExecutionSocket = require('./executionSocket');
const log = require('../utils/logger');

let io = null;
let executionSocket = null;

/**
 * Initialize WebSocket server with Express HTTP server
 * @param {http.Server} server - HTTP server instance
 * @returns {Object} - { io, executionSocket }
 */
function initializeWebSocket(server) {
  // Create Socket.IO server
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    path: '/ws',
    transports: ['websocket', 'polling']
  });

  // Initialize execution socket handler
  executionSocket = new ExecutionSocket(io);
  executionSocket.initialize();

  // Log connections
  io.on('connection', (socket) => {
    log.info(`[WebSocket] New connection: ${socket.id}`);

    // Handle ping for keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle errors
    socket.on('error', (error) => {
      log.error(`[WebSocket] Socket error: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
      log.info(`[WebSocket] Disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  log.info('[WebSocket] Server initialized');

  return { io, executionSocket };
}

/**
 * Get the Socket.IO instance
 * @returns {Server|null}
 */
function getIO() {
  return io;
}

/**
 * Get the ExecutionSocket instance
 * @returns {ExecutionSocket|null}
 */
function getExecutionSocket() {
  return executionSocket;
}

/**
 * Broadcast to all connected clients
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcast(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Broadcast to a specific room
 * @param {string} room - Room name
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
function broadcastToRoom(room, event, data) {
  if (io) {
    io.to(room).emit(event, data);
  }
}

/**
 * Get connected clients count
 * @returns {number}
 */
async function getConnectedClientsCount() {
  if (!io) return 0;
  const sockets = await io.fetchSockets();
  return sockets.length;
}

module.exports = {
  initializeWebSocket,
  getIO,
  getExecutionSocket,
  broadcast,
  broadcastToRoom,
  getConnectedClientsCount
};
