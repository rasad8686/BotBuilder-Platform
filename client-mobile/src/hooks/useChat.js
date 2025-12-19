/**
 * useChat Hook
 * Custom hook for chat messaging with WebSocket support
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import chatService from '../services/chatService';
import { generateId } from '../utils/helpers';

/**
 * Main chat hook
 */
export const useChat = (botId, options = {}) => {
  const {
    autoConnect = true,
    useWebSocket = true,
    sessionId: initialSessionId,
  } = options;

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);

  const sessionIdRef = useRef(initialSessionId || chatService.createSessionId());
  const mounted = useRef(true);

  // Message handler
  const handleMessage = useCallback((message) => {
    if (!mounted.current) return;

    setMessages(prev => {
      // Check for duplicate
      const exists = prev.some(m => m.id === message.id);
      if (exists) return prev;

      return [...prev, {
        ...message,
        id: message.id || generateId(),
        timestamp: message.timestamp || new Date().toISOString(),
      }];
    });

    setTyping(false);
  }, []);

  // Typing handler
  const handleTyping = useCallback((data) => {
    if (!mounted.current) return;
    setTyping(data.isTyping);

    // Auto-clear typing after timeout
    if (data.isTyping) {
      setTimeout(() => {
        if (mounted.current) setTyping(false);
      }, 5000);
    }
  }, []);

  // Connect handler
  const handleConnect = useCallback(() => {
    if (!mounted.current) return;
    setConnected(true);
    setError(null);
  }, []);

  // Disconnect handler
  const handleDisconnect = useCallback(() => {
    if (!mounted.current) return;
    setConnected(false);
  }, []);

  // Error handler
  const handleError = useCallback((err) => {
    if (!mounted.current) return;
    setError(err.message || 'Connection error');
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!useWebSocket || !botId) return;

    const unsubMessage = chatService.addEventListener('message', handleMessage);
    const unsubTyping = chatService.addEventListener('typing', handleTyping);
    const unsubConnect = chatService.addEventListener('connect', handleConnect);
    const unsubDisconnect = chatService.addEventListener('disconnect', handleDisconnect);
    const unsubError = chatService.addEventListener('error', handleError);

    return () => {
      unsubMessage();
      unsubTyping();
      unsubConnect();
      unsubDisconnect();
      unsubError();
    };
  }, [botId, useWebSocket, handleMessage, handleTyping, handleConnect, handleDisconnect, handleError]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!botId || !useWebSocket) return;

    const success = await chatService.connectWebSocket(botId);
    if (!success && mounted.current) {
      setError('Failed to connect');
    }
  }, [botId, useWebSocket]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    chatService.disconnectWebSocket();
    if (mounted.current) {
      setConnected(false);
    }
  }, []);

  // Auto-connect
  useEffect(() => {
    mounted.current = true;

    if (autoConnect && botId && useWebSocket) {
      connect();
    }

    return () => {
      mounted.current = false;
      disconnect();
    };
  }, [autoConnect, botId, useWebSocket, connect, disconnect]);

  // Load initial messages
  const loadMessages = useCallback(async (forceRefresh = false) => {
    if (!botId || !mounted.current) return;

    setLoading(true);
    setError(null);

    const result = await chatService.getMessages(botId, sessionIdRef.current, {
      forceRefresh,
    });

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setMessages(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  // Send message
  const sendMessage = useCallback(async (content) => {
    if (!botId || !content.trim() || !mounted.current) {
      return { success: false, error: 'Invalid message' };
    }

    setSending(true);
    setError(null);

    // Add optimistic message
    const optimisticMessage = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(prev => [...prev, optimisticMessage]);

    const result = await chatService.sendMessage(botId, content.trim(), sessionIdRef.current);

    if (!mounted.current) return result;

    setSending(false);

    if (result.success) {
      // Update message status
      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticMessage.id
            ? { ...m, status: 'sent', id: result.data?.id || m.id }
            : m
        )
      );

      // If HTTP fallback, add response
      if (result.via === 'http' && result.data?.response) {
        handleMessage({
          id: generateId(),
          role: 'assistant',
          content: result.data.response,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Mark as failed
      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticMessage.id
            ? { ...m, status: 'failed' }
            : m
        )
      );
      setError(result.error);
    }

    return result;
  }, [botId, handleMessage]);

  // Retry failed message
  const retryMessage = useCallback(async (messageId) => {
    const message = messages.find(m => m.id === messageId && m.status === 'failed');
    if (!message) return { success: false, error: 'Message not found' };

    // Remove failed message
    setMessages(prev => prev.filter(m => m.id !== messageId));

    // Resend
    return sendMessage(message.content);
  }, [messages, sendMessage]);

  // Clear messages
  const clearMessages = useCallback(async () => {
    if (!botId || !mounted.current) return;

    setLoading(true);

    const result = await chatService.clearMessages(botId, sessionIdRef.current);

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setMessages([]);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  // Start new session
  const startNewSession = useCallback(() => {
    sessionIdRef.current = chatService.createSessionId();
    setMessages([]);
    setError(null);
  }, []);

  // Get session ID
  const getSessionId = useCallback(() => {
    return sessionIdRef.current;
  }, []);

  return {
    messages,
    loading,
    sending,
    connected,
    typing,
    error,
    connect,
    disconnect,
    loadMessages,
    sendMessage,
    retryMessage,
    clearMessages,
    startNewSession,
    getSessionId,
    isConnected: chatService.isConnected,
  };
};

/**
 * Hook for chat sessions management
 */
export const useChatSessions = (botId) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  const fetchSessions = useCallback(async () => {
    if (!botId || !mounted.current) return;

    setLoading(true);
    setError(null);

    const result = await chatService.getSessions(botId);

    if (!mounted.current) return;

    setLoading(false);

    if (result.success) {
      setSessions(result.data);
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  const deleteSession = useCallback(async (sessionId) => {
    if (!botId || !mounted.current) return;

    const result = await chatService.deleteSession(botId, sessionId);

    if (!mounted.current) return;

    if (result.success) {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
    } else {
      setError(result.error);
    }

    return result;
  }, [botId]);

  useEffect(() => {
    mounted.current = true;

    if (botId) {
      fetchSessions();
    }

    return () => {
      mounted.current = false;
    };
  }, [botId, fetchSessions]);

  return {
    sessions,
    loading,
    error,
    refresh: fetchSessions,
    deleteSession,
  };
};

export default {
  useChat,
  useChatSessions,
};
