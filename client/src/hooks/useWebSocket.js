/**
 * @fileoverview WebSocket hook for real-time communication
 * @module hooks/useWebSocket
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * WebSocket connection states
 * @typedef {'connecting' | 'connected' | 'disconnected' | 'error'} ConnectionState
 */

/**
 * Custom hook for WebSocket connections
 * @param {string} url - WebSocket server URL
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Connect automatically (default: true)
 * @param {boolean} options.autoReconnect - Auto reconnect on disconnect (default: true)
 * @param {number} options.reconnectAttempts - Max reconnect attempts (default: 5)
 * @param {number} options.reconnectInterval - Base reconnect interval ms (default: 1000)
 * @param {Function} options.onOpen - Callback when connection opens
 * @param {Function} options.onClose - Callback when connection closes
 * @param {Function} options.onError - Callback on error
 * @param {Function} options.onMessage - Callback when message received
 * @param {Array} options.protocols - WebSocket sub-protocols
 * @returns {Object} WebSocket state and controls
 * @property {ConnectionState} connectionState - Current connection state
 * @property {any} lastMessage - Last received message
 * @property {Array} messageHistory - History of received messages
 * @property {Function} sendMessage - Send a message
 * @property {Function} sendJsonMessage - Send a JSON message
 * @property {Function} connect - Manually connect
 * @property {Function} disconnect - Manually disconnect
 *
 * @example
 * const {
 *   connectionState,
 *   lastMessage,
 *   sendMessage,
 *   sendJsonMessage
 * } = useWebSocket('ws://localhost:3001', {
 *   onMessage: (message) => console.log('Received:', message),
 *   autoReconnect: true
 * });
 *
 * // Send a message
 * sendJsonMessage({ type: 'chat', content: 'Hello!' });
 */
const useWebSocket = (url, options = {}) => {
  const {
    autoConnect = true,
    autoReconnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
    onOpen,
    onClose,
    onError,
    onMessage,
    protocols = []
  } = options;

  const [connectionState, setConnectionState] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);

  const wsRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const messageQueueRef = useRef([]);

  /**
   * Clear reconnect timeout
   */
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Prevent multiple connections
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionState('connecting');

    try {
      wsRef.current = new WebSocket(url, protocols);

      wsRef.current.onopen = (event) => {
        setConnectionState('connected');
        reconnectCountRef.current = 0;

        // Send queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          wsRef.current.send(message);
        }

        onOpen?.(event);
      };

      wsRef.current.onclose = (event) => {
        setConnectionState('disconnected');
        onClose?.(event);

        // Auto reconnect with exponential backoff
        if (autoReconnect && reconnectCountRef.current < reconnectAttempts) {
          const delay = reconnectInterval * Math.pow(2, reconnectCountRef.current);
          reconnectCountRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (event) => {
        setConnectionState('error');
        onError?.(event);
      };

      wsRef.current.onmessage = (event) => {
        let data = event.data;

        // Try to parse as JSON
        try {
          data = JSON.parse(event.data);
        } catch {
          // Keep as string if not valid JSON
        }

        setLastMessage(data);
        setMessageHistory(prev => [...prev, data]);
        onMessage?.(data, event);
      };
    } catch (error) {
      setConnectionState('error');
      onError?.(error);
    }
  }, [url, protocols, autoReconnect, reconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectCountRef.current = reconnectAttempts; // Prevent auto-reconnect

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState('disconnected');
  }, [clearReconnectTimeout, reconnectAttempts]);

  /**
   * Send a message (string)
   * @param {string} message - Message to send
   */
  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      // Queue message for when connection opens
      messageQueueRef.current.push(message);

      // Auto-connect if not connected
      if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    }
  }, [connect]);

  /**
   * Send a JSON message
   * @param {Object} data - Data to send as JSON
   */
  const sendJsonMessage = useCallback((data) => {
    sendMessage(JSON.stringify(data));
  }, [sendMessage]);

  /**
   * Clear message history
   */
  const clearHistory = useCallback(() => {
    setMessageHistory([]);
  }, []);

  /**
   * Get connection readiness
   */
  const isReady = connectionState === 'connected';

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, url]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    connectionState,
    lastMessage,
    messageHistory,
    isReady,
    isConnecting: connectionState === 'connecting',
    isConnected: connectionState === 'connected',
    isDisconnected: connectionState === 'disconnected',
    isError: connectionState === 'error',

    // Actions
    connect,
    disconnect,
    sendMessage,
    sendJsonMessage,
    clearHistory,

    // Refs (for advanced usage)
    getWebSocket: () => wsRef.current
  };
};

/**
 * Hook for subscribing to specific WebSocket channels/topics
 * @param {Object} websocket - WebSocket instance from useWebSocket
 * @param {string} channel - Channel name to subscribe to
 * @param {Function} handler - Message handler for this channel
 *
 * @example
 * const ws = useWebSocket('ws://localhost:3001');
 *
 * useWebSocketChannel(ws, 'notifications', (message) => {
 *   console.log('Notification:', message);
 * });
 */
export const useWebSocketChannel = (websocket, channel, handler) => {
  useEffect(() => {
    if (!websocket?.lastMessage) return;

    const message = websocket.lastMessage;

    // Check if message belongs to this channel
    if (message?.channel === channel || message?.type === channel) {
      handler(message);
    }
  }, [websocket?.lastMessage, channel, handler]);

  const sendToChannel = useCallback((data) => {
    websocket?.sendJsonMessage({
      channel,
      ...data
    });
  }, [websocket, channel]);

  return { sendToChannel };
};

export default useWebSocket;
