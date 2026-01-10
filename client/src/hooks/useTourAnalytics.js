/**
 * useTourAnalytics Hook
 * Real-time tour analytics subscription with auto-reconnect
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export const useTourAnalytics = (tourId, options = {}) => {
  const { autoConnect = true, onEvent } = options;

  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    activeUsers: 0,
    activeSessions: 0,
    sessionsList: [],
    stepDistribution: [],
    timestamp: null
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [completionRate, setCompletionRate] = useState(0);
  const [dropOffPoints, setDropOffPoints] = useState([]);

  const socketRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);

  /**
   * Connect to tour analytics WebSocket
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected || connecting) return;

    setConnecting(true);
    setError(null);

    const socket = io(`${SOCKET_URL}/tours`, {
      path: '/ws',
      transports: ['polling', 'websocket'],
      auth: {
        organizationId: localStorage.getItem('organizationId'),
        userId: localStorage.getItem('userId')
      },
      reconnection: false // We handle reconnection manually
    });

    socket.on('connect', () => {
      setConnected(true);
      setConnecting(false);
      setError(null);
      reconnectAttemptsRef.current = 0;

      // Join tour room
      if (tourId) {
        socket.emit('join:tour', tourId);
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        scheduleReconnect();
      }
    });

    socket.on('connect_error', (err) => {
      setConnecting(false);
      setError(`Connection error: ${err.message}`);
      scheduleReconnect();
    });

    // Tour events
    socket.on('tour:stats', handleStats);
    socket.on('tour:stats_update', handleStats);
    socket.on('tour:started', handleTourStarted);
    socket.on('tour:step_viewed', handleStepViewed);
    socket.on('tour:step_completed', handleStepCompleted);
    socket.on('tour:completed', handleTourCompleted);
    socket.on('tour:skipped', handleTourSkipped);
    socket.on('tour:error', handleTourError);

    socketRef.current = socket;
  }, [tourId, connecting]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      if (tourId) {
        socketRef.current.emit('leave:tour', tourId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnected(false);
    setConnecting(false);
  }, [tourId]);

  /**
   * Schedule reconnection attempt
   */
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError('Max reconnection attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, RECONNECT_INTERVAL * reconnectAttemptsRef.current);
  }, [connect]);

  /**
   * Handle stats update
   */
  const handleStats = useCallback((data) => {
    setStats({
      activeUsers: data.activeUsers || 0,
      activeSessions: data.activeSessions || 0,
      sessionsList: data.sessionsList || [],
      stepDistribution: data.stepDistribution || [],
      timestamp: data.timestamp
    });
  }, []);

  /**
   * Handle tour started event
   */
  const handleTourStarted = useCallback((data) => {
    addRecentEvent('started', data);
    if (data.stats) handleStats(data.stats);
    onEvent?.('started', data);
  }, [handleStats, onEvent]);

  /**
   * Handle step viewed event
   */
  const handleStepViewed = useCallback((data) => {
    addRecentEvent('step_viewed', data);
    if (data.stats) handleStats(data.stats);
    onEvent?.('step_viewed', data);
  }, [handleStats, onEvent]);

  /**
   * Handle step completed event
   */
  const handleStepCompleted = useCallback((data) => {
    addRecentEvent('step_completed', data);
    onEvent?.('step_completed', data);
  }, [onEvent]);

  /**
   * Handle tour completed event
   */
  const handleTourCompleted = useCallback((data) => {
    addRecentEvent('completed', data);
    if (data.stats) handleStats(data.stats);

    // Update completion rate
    setCompletionRate(prev => {
      // Simple running average
      return prev > 0 ? (prev + 100) / 2 : 100;
    });

    onEvent?.('completed', data);
  }, [handleStats, onEvent]);

  /**
   * Handle tour skipped event
   */
  const handleTourSkipped = useCallback((data) => {
    addRecentEvent('skipped', data);
    if (data.stats) handleStats(data.stats);

    // Update drop-off points
    setDropOffPoints(prev => {
      const stepIndex = data.skippedAtStep;
      const existing = prev.find(p => p.step === stepIndex);

      if (existing) {
        return prev.map(p =>
          p.step === stepIndex ? { ...p, count: p.count + 1 } : p
        );
      }

      return [...prev, { step: stepIndex, count: 1 }].sort((a, b) => a.step - b.step);
    });

    onEvent?.('skipped', data);
  }, [handleStats, onEvent]);

  /**
   * Handle tour error event
   */
  const handleTourError = useCallback((data) => {
    addRecentEvent('error', data);
    onEvent?.('error', data);
  }, [onEvent]);

  /**
   * Add event to recent events list
   */
  const addRecentEvent = useCallback((type, data) => {
    setRecentEvents(prev => {
      const newEvent = {
        id: Date.now(),
        type,
        data,
        timestamp: new Date()
      };

      // Keep last 50 events
      const updated = [newEvent, ...prev].slice(0, 50);
      return updated;
    });
  }, []);

  /**
   * Request current stats
   */
  const refreshStats = useCallback(() => {
    if (socketRef.current?.connected && tourId) {
      socketRef.current.emit('tour:get_stats', tourId);
    }
  }, [tourId]);

  /**
   * Switch to a different tour
   */
  const switchTour = useCallback((newTourId) => {
    if (socketRef.current?.connected) {
      if (tourId) {
        socketRef.current.emit('leave:tour', tourId);
      }
      socketRef.current.emit('join:tour', newTourId);

      // Reset state
      setStats({
        activeUsers: 0,
        activeSessions: 0,
        sessionsList: [],
        stepDistribution: [],
        timestamp: null
      });
      setRecentEvents([]);
    }
  }, [tourId]);

  /**
   * Clear recent events
   */
  const clearRecentEvents = useCallback(() => {
    setRecentEvents([]);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && tourId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, tourId]);

  // Handle tour ID changes
  useEffect(() => {
    if (socketRef.current?.connected && tourId) {
      socketRef.current.emit('join:tour', tourId);
    }
  }, [tourId]);

  return {
    // Connection state
    connected,
    connecting,
    error,

    // Real-time data
    stats,
    recentEvents,
    completionRate,
    dropOffPoints,

    // Actions
    connect,
    disconnect,
    refreshStats,
    switchTour,
    clearRecentEvents
  };
};

/**
 * Hook for all tours overview
 */
export const useAllToursAnalytics = (options = {}) => {
  const { autoConnect = true } = options;

  const [connected, setConnected] = useState(false);
  const [activeToursStats, setActiveToursStats] = useState([]);

  const socketRef = useRef(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${SOCKET_URL}/tours`, {
      path: '/ws',
      transports: ['polling', 'websocket'],
      auth: {
        organizationId: localStorage.getItem('organizationId')
      }
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get:all_tours_stats');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('all_tours:stats', (data) => {
      setActiveToursStats(data);
    });

    socketRef.current = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => disconnect();
  }, [autoConnect]);

  return {
    connected,
    activeToursStats,
    connect,
    disconnect
  };
};

export default useTourAnalytics;
