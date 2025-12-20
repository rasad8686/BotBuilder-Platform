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
const GladiaProcessor = require('../services/voiceToBot/GladiaProcessor');

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

  // Gladia processor instance for real-time STT streaming
  const gladiaProcessor = new GladiaProcessor();

  // Log connections
  io.on('connection', (socket) => {
    log.info(`[WebSocket] New connection: ${socket.id}`);

    // Voice streaming state per socket
    let streamingSession = null;
    let finalTranscript = '';

    // Handle ping for keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // ========================================
    // VOICE STREAMING (Gladia Real-time STT)
    // ========================================

    // Track streaming state
    let streamingActive = false;
    let audioChunkCount = 0;
    let streamingTimeout = null;

    // Start voice streaming session
    socket.on('voice:start', (data) => {
      const { language = 'az', sessionId } = data;
      log.info('[WebSocket] Voice streaming started', { socketId: socket.id, language, sessionId });

      // Clean up any existing session
      if (streamingSession) {
        try {
          streamingSession.end();
        } catch (e) {}
        streamingSession = null;
      }

      // Reset state
      finalTranscript = '';
      audioChunkCount = 0;
      streamingActive = true;

      // Clear any existing timeout
      if (streamingTimeout) {
        clearTimeout(streamingTimeout);
        streamingTimeout = null;
      }

      // Create streaming recognition session with Gladia
      streamingSession = gladiaProcessor.createStreamingRecognition(
        { language },
        // onResult callback
        (result) => {
          if (!streamingActive) return;

          // Log ALL results for debugging
          log.info('[WebSocket] STT Result received', {
            isFinal: result.isFinal,
            transcript: result.transcript?.substring(0, 50),
            confidence: result.confidence
          });

          if (result.isFinal) {
            // Accumulate final transcript
            finalTranscript += result.transcript + ' ';
            socket.emit('voice:transcript', {
              transcript: result.transcript,
              isFinal: true,
              confidence: result.confidence,
              fullTranscript: finalTranscript.trim()
            });
            log.info('[WebSocket] Sent FINAL transcript to client', { transcript: result.transcript.substring(0, 50) });
          } else {
            // Send interim result immediately
            socket.emit('voice:transcript', {
              transcript: result.transcript,
              isFinal: false,
              confidence: result.confidence
            });
            log.info('[WebSocket] Sent INTERIM transcript to client', { transcript: result.transcript.substring(0, 50) });
          }
        },
        // onError callback
        (error) => {
          log.error('[WebSocket] Voice streaming error', { error: error.message });
          socket.emit('voice:error', { error: error.message });

          // Try to recreate session on certain errors
          if (error.code === 11 || error.message.includes('exceeded')) {
            // Streaming limit exceeded, notify client to restart
            streamingSession = null;
            streamingActive = false;
            socket.emit('voice:restart', { reason: 'Streaming limit exceeded' });
          }
        }
      );

      if (streamingSession) {
        socket.emit('voice:ready', { status: 'streaming', provider: 'gladia' });
        log.info('[WebSocket] Gladia real-time STT streaming ready');

        // Set timeout for max streaming duration (5 minutes)
        streamingTimeout = setTimeout(() => {
          if (streamingSession && streamingActive) {
            log.info('[WebSocket] Streaming timeout reached, stopping');
            socket.emit('voice:timeout', { reason: 'Max streaming duration reached' });
            if (streamingSession) {
              streamingSession.end();
              streamingSession = null;
            }
            streamingActive = false;
          }
        }, 5 * 60 * 1000);
      } else {
        // Fallback: notify client if Gladia is not available
        log.warn('[WebSocket] Gladia STT not available, check API key');
        socket.emit('voice:fallback', {
          reason: 'Gladia STT not available - check GLADIA_API_KEY',
          useWebSpeech: true
        });
      }
    });

    // Receive audio chunk
    socket.on('voice:audio', (audioData) => {
      if (streamingSession && streamingActive && audioData) {
        try {
          // audioData is expected to be ArrayBuffer or Buffer
          const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);

          // Only process non-empty chunks
          if (buffer.length > 0) {
            streamingSession.write(buffer);
            audioChunkCount++;

            // Log every 50 chunks for debugging
            if (audioChunkCount % 50 === 0) {
              log.debug('[WebSocket] Audio chunks received', { count: audioChunkCount });
            }
          }
        } catch (error) {
          log.error('[WebSocket] Error writing audio chunk', { error: error.message });

          // If stream is destroyed, notify client
          if (error.message.includes('destroyed') || error.message.includes('ended')) {
            socket.emit('voice:error', { error: 'Stream ended unexpectedly' });
            streamingSession = null;
            streamingActive = false;
          }
        }
      }
    });

    // Stop voice streaming session
    socket.on('voice:stop', () => {
      log.info('[WebSocket] Voice streaming stopped', { socketId: socket.id, audioChunks: audioChunkCount });

      // Clear timeout
      if (streamingTimeout) {
        clearTimeout(streamingTimeout);
        streamingTimeout = null;
      }

      streamingActive = false;

      if (streamingSession) {
        try {
          streamingSession.end();
        } catch (e) {
          log.warn('[WebSocket] Error ending stream', { error: e.message });
        }
        streamingSession = null;
      }

      // Send final accumulated transcript
      socket.emit('voice:complete', {
        finalTranscript: finalTranscript.trim(),
        audioChunksProcessed: audioChunkCount
      });
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      if (streamingSession) {
        streamingSession.end();
        streamingSession = null;
      }
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

        // Check if bot exists and get language
        const botCheck = await pool.query('SELECT id, name, language FROM bots WHERE id = $1', [botId]);
        if (botCheck.rows.length === 0) {
          socket.emit('widget:message', { message: 'Bu bot mövcud deyil. Zəhmət olmasa düzgün bot ID istifadə edin.' });
          return;
        }
        const bot = botCheck.rows[0];

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

            // Add language instruction if not English
            if (bot.language && bot.language !== 'en') {
              const languageNames = {
                'tr': 'Turkish', 'az': 'Azerbaijani', 'ru': 'Russian', 'ka': 'Georgian',
                'de': 'German', 'fr': 'French', 'es': 'Spanish', 'ar': 'Arabic',
                'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'pt': 'Portuguese',
                'it': 'Italian', 'nl': 'Dutch', 'pl': 'Polish', 'uk': 'Ukrainian',
                'hi': 'Hindi', 'bn': 'Bengali', 'id': 'Indonesian', 'vi': 'Vietnamese',
                'th': 'Thai', 'el': 'Greek', 'cs': 'Czech', 'ro': 'Romanian',
                'hu': 'Hungarian', 'sv': 'Swedish', 'fi': 'Finnish', 'da': 'Danish',
                'no': 'Norwegian', 'he': 'Hebrew', 'fa': 'Persian', 'ms': 'Malay',
                'tl': 'Filipino', 'sw': 'Swahili', 'ur': 'Urdu', 'ta': 'Tamil',
                'te': 'Telugu', 'mr': 'Marathi', 'gu': 'Gujarati', 'kn': 'Kannada',
                'ml': 'Malayalam', 'pa': 'Punjabi', 'bg': 'Bulgarian', 'hr': 'Croatian',
                'sk': 'Slovak', 'sl': 'Slovenian', 'sr': 'Serbian', 'lt': 'Lithuanian',
                'lv': 'Latvian', 'et': 'Estonian', 'ca': 'Catalan', 'eu': 'Basque',
                'gl': 'Galician', 'cy': 'Welsh', 'ga': 'Irish', 'is': 'Icelandic',
                'kk': 'Kazakh', 'uz': 'Uzbek', 'ky': 'Kyrgyz', 'mn': 'Mongolian',
                'ne': 'Nepali', 'si': 'Sinhala', 'km': 'Khmer', 'lo': 'Lao',
                'my': 'Burmese', 'am': 'Amharic', 'auto': 'the same language as the user'
              };
              const langName = languageNames[bot.language] || bot.language;
              systemPrompt = `[LANGUAGE REQUIREMENT: ${langName.toUpperCase()}]\n\n${systemPrompt}\n\n---\nCRITICAL LANGUAGE RULE: You MUST respond ONLY in ${langName}. Do NOT use any other language. Every single word of your response must be in ${langName}.`;
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
