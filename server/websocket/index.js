/**
 * WebSocket Server Initialization
 * Integrates Socket.IO with Express server
 */

const { Server } = require('socket.io');
const ExecutionSocket = require('./executionSocket');
const log = require('../utils/logger');
const pool = require('../db');
const {
  AIProviderFactory,
  EncryptionHelper
} = require('../services/ai');
const ragService = require('../services/ragService');

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

    // Handle widget join
    socket.on('widget:join', (data) => {
      const { botId, sessionId } = data;
      const room = `widget:${botId}:${sessionId}`;
      socket.join(room);
      log.info(`[WebSocket] Widget joined room: ${room}`);
    });

    // Handle widget messages
    socket.on('widget:message', async (data) => {
      const { sessionId, message } = data;
      const botId = parseInt(data.botId, 10);
      const room = `widget:${data.botId}:${sessionId}`;

      // Validate botId is a valid number
      if (isNaN(botId)) {
        log.warn('[WebSocket] Invalid botId:', data.botId);
        socket.emit('widget:message', { message: 'Bot ID is invalid. Please use a valid bot ID.' });
        return;
      }

      try {
        // Emit typing indicator
        socket.emit('widget:typing');

        // Check if bot exists
        const botCheck = await pool.query('SELECT id, name FROM bots WHERE id = $1', [botId]);
        if (botCheck.rows.length === 0) {
          socket.emit('widget:message', { message: 'Bu bot mövcud deyil. Zəhmət olmasa düzgün bot ID istifadə edin.' });
          return;
        }

        // Store user message
        await pool.query(`
          INSERT INTO widget_messages (bot_id, session_id, role, content, created_at)
          VALUES ($1, $2, 'user', $3, NOW())
        `, [botId, sessionId, message]);

        // Get AI configuration
        const aiConfigResult = await pool.query(
          'SELECT * FROM ai_configurations WHERE bot_id = $1 AND is_enabled = true',
          [botId]
        );

        let aiResponse = "AI is not configured for this bot.";

        if (aiConfigResult.rows.length > 0) {
          const config = aiConfigResult.rows[0];

          // Get API key
          let apiKey;
          if (config.api_key_encrypted) {
            apiKey = EncryptionHelper.decrypt(config.api_key_encrypted);
          } else {
            apiKey = config.provider === 'openai'
              ? process.env.OPENAI_API_KEY
              : process.env.ANTHROPIC_API_KEY;
            if (apiKey) apiKey = apiKey.trim();
          }

          if (apiKey) {
            const aiService = AIProviderFactory.getProvider({
              provider: config.provider,
              apiKey: apiKey,
              model: config.model
            });

            // Get system prompt with RAG
            let systemPrompt = config.system_prompt || 'You are a helpful assistant.';
            try {
              const ragResult = await ragService.getContextForQuery(botId, message, {
                maxChunks: 20,
                threshold: 0.15
              });
              if (ragResult.hasContext && ragResult.context) {
                systemPrompt = ragService.buildRAGPrompt(config.system_prompt, ragResult.context);
              }
            } catch (ragError) {
              log.error('RAG error:', ragError.message);
            }

            // Get conversation history
            const historyResult = await pool.query(`
              SELECT role, content FROM widget_messages
              WHERE bot_id = $1 AND session_id = $2
              ORDER BY created_at DESC
              LIMIT $3
            `, [botId, sessionId, config.context_window || 10]);

            const messages = [{ role: 'system', content: systemPrompt }];
            const history = historyResult.rows.reverse();
            for (const msg of history) {
              if (msg.role === 'user' && msg.content === message) continue;
              messages.push({ role: msg.role, content: msg.content });
            }
            messages.push({ role: 'user', content: message });

            // Send to AI
            const response = await aiService.chat({
              messages: messages,
              temperature: parseFloat(config.temperature) || 0.7,
              maxTokens: parseInt(config.max_tokens) || 1024,
              stream: false
            });

            aiResponse = response.content;
          }
        }

        // Store bot response
        await pool.query(`
          INSERT INTO widget_messages (bot_id, session_id, role, content, created_at)
          VALUES ($1, $2, 'assistant', $3, NOW())
        `, [botId, sessionId, aiResponse]);

        // Send response back
        socket.emit('widget:message', { message: aiResponse });

      } catch (error) {
        log.error('[WebSocket] Widget message error:', error.message);
        socket.emit('widget:error', { error: 'Failed to process message' });
        socket.emit('widget:message', { message: 'Sorry, there was an error. Please try again.' });
      }
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
