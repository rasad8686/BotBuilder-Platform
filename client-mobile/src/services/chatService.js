/**
 * Chat Service
 * Handles chat messaging with WebSocket support
 */
import { chatAPI } from './api';
import { API_CONFIG, CHAT_CONFIG } from '../config/constants';
import { setChatCache, getChatCache, clearChatCache } from '../utils/storage';
import { getAuthToken } from '../utils/storage';
import { generateId } from '../utils/helpers';

// WebSocket instance
let ws = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;

// Event listeners
const listeners = {
  message: [],
  connect: [],
  disconnect: [],
  error: [],
  typing: [],
};

/**
 * Add event listener
 */
export const addEventListener = (event, callback) => {
  if (listeners[event]) {
    listeners[event].push(callback);
  }
  return () => removeEventListener(event, callback);
};

/**
 * Remove event listener
 */
export const removeEventListener = (event, callback) => {
  if (listeners[event]) {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  }
};

/**
 * Emit event to all listeners
 */
const emit = (event, data) => {
  if (listeners[event]) {
    listeners[event].forEach(callback => callback(data));
  }
};

/**
 * Connect to WebSocket server
 */
export const connectWebSocket = async (botId) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return true;
  }

  try {
    const token = await getAuthToken();
    const wsUrl = `${API_CONFIG.WS_URL}/chat?botId=${botId}&token=${token}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      emit('connect', { botId });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'message':
            emit('message', data.payload);
            break;
          case 'typing':
            emit('typing', data.payload);
            break;
          case 'error':
            emit('error', data.payload);
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      emit('error', { message: 'Connection error' });
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      emit('disconnect', { code: event.code, reason: event.reason });

      // Attempt reconnection
      if (reconnectAttempts < CHAT_CONFIG.MAX_RECONNECT_ATTEMPTS) {
        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          connectWebSocket(botId);
        }, CHAT_CONFIG.RECONNECT_INTERVAL);
      }
    };

    return true;
  } catch (error) {
    console.error('WebSocket connection error:', error);
    return false;
  }
};

/**
 * Disconnect WebSocket
 */
export const disconnectWebSocket = () => {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  reconnectAttempts = 0;
};

/**
 * Send message via WebSocket
 */
export const sendWebSocketMessage = (message) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
};

/**
 * Send typing indicator
 */
export const sendTypingIndicator = (botId, isTyping) => {
  return sendWebSocketMessage({
    type: 'typing',
    payload: { botId, isTyping },
  });
};

/**
 * Send chat message (HTTP fallback)
 */
export const sendMessage = async (botId, message, sessionId) => {
  try {
    // Create optimistic message
    const optimisticMessage = {
      id: generateId(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    // Try WebSocket first
    const wsSent = sendWebSocketMessage({
      type: 'message',
      payload: { botId, message, sessionId },
    });

    if (wsSent) {
      return { success: true, data: optimisticMessage, via: 'websocket' };
    }

    // Fallback to HTTP
    const response = await chatAPI.sendMessage(botId, message, sessionId);
    return { success: true, data: response.data, via: 'http' };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to send message',
      data: null,
    };
  }
};

/**
 * Get chat history with caching
 */
export const getMessages = async (botId, sessionId, options = {}) => {
  const { useCache = true, forceRefresh = false, page = 1, limit = 50 } = options;

  try {
    // Try cache first if not forcing refresh
    if (useCache && !forceRefresh && page === 1) {
      const cached = await getChatCache(botId);
      if (cached) {
        return { success: true, data: cached, fromCache: true };
      }
    }

    const response = await chatAPI.getHistory(botId, sessionId, { page, limit });
    const messages = response.data.messages || response.data;

    // Cache first page results
    if (useCache && page === 1) {
      await setChatCache(botId, messages);
    }

    return { success: true, data: messages, fromCache: false };
  } catch (error) {
    // Return cached data if available on error
    if (useCache) {
      const cached = await getChatCache(botId);
      if (cached) {
        return { success: true, data: cached, fromCache: true, error: error.message };
      }
    }

    return {
      success: false,
      error: error.message || 'Failed to fetch messages',
      data: [],
    };
  }
};

/**
 * Clear chat history
 */
export const clearMessages = async (botId, sessionId) => {
  try {
    await chatAPI.clearHistory(botId, sessionId);
    await clearChatCache(botId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to clear messages',
    };
  }
};

/**
 * Get chat sessions
 */
export const getSessions = async (botId) => {
  try {
    const response = await chatAPI.getSessions(botId);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to fetch sessions',
      data: [],
    };
  }
};

/**
 * Delete chat session
 */
export const deleteSession = async (botId, sessionId) => {
  try {
    await chatAPI.deleteSession(botId, sessionId);
    await clearChatCache(botId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to delete session',
    };
  }
};

/**
 * Generate new session ID
 */
export const createSessionId = () => {
  return `session_${generateId()}_${Date.now()}`;
};

/**
 * Check WebSocket connection status
 */
export const isConnected = () => {
  return ws && ws.readyState === WebSocket.OPEN;
};

export default {
  addEventListener,
  removeEventListener,
  connectWebSocket,
  disconnectWebSocket,
  sendMessage,
  sendTypingIndicator,
  getMessages,
  clearMessages,
  getSessions,
  deleteSession,
  createSessionId,
  isConnected,
};
