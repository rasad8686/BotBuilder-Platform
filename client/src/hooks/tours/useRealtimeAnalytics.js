/**
 * @fileoverview Hook for real-time analytics via WebSocket
 * @module hooks/tours/useRealtimeAnalytics
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

/**
 * Hook for real-time tour analytics via WebSocket
 * @param {Object} options - Options
 * @param {string} options.workspaceId - Workspace ID
 * @param {string} options.tourId - Optional tour ID for specific tour
 * @param {boolean} options.enabled - Enable/disable real-time updates
 * @returns {Object} { liveData, isConnected, activeTours, lastUpdate }
 */
export const useRealtimeAnalytics = (options = {}) => {
  const { workspaceId, tourId = null, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [liveData, setLiveData] = useState({
    impressions: 0,
    starts: 0,
    completions: 0,
    dismissals: 0
  });
  const [activeTours, setActiveTours] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!workspaceId || !enabled) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      socketRef.current = io(window.location.origin, {
        path: '/ws/tours',
        auth: { token },
        query: { workspaceId, tourId },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      socketRef.current.on('connect', () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Subscribe to analytics updates
        socketRef.current.emit('subscribe:analytics', {
          workspaceId,
          tourId
        });
      });

      socketRef.current.on('disconnect', () => {
        setIsConnected(false);
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        reconnectAttempts.current++;

        if (reconnectAttempts.current >= maxReconnectAttempts) {
          socketRef.current.disconnect();
        }
      });

      // Listen for analytics events
      socketRef.current.on('tour:impression', (data) => {
        if (!tourId || data.tourId === tourId) {
          setLiveData(prev => ({
            ...prev,
            impressions: prev.impressions + 1
          }));
          setLastUpdate(new Date());
        }
      });

      socketRef.current.on('tour:start', (data) => {
        if (!tourId || data.tourId === tourId) {
          setLiveData(prev => ({
            ...prev,
            starts: prev.starts + 1
          }));
          setLastUpdate(new Date());

          // Add to active tours if not already there
          setActiveTours(prev => {
            if (!prev.find(t => t.tourId === data.tourId)) {
              return [...prev, { tourId: data.tourId, visitorId: data.visitorId, startedAt: new Date() }];
            }
            return prev;
          });
        }
      });

      socketRef.current.on('tour:complete', (data) => {
        if (!tourId || data.tourId === tourId) {
          setLiveData(prev => ({
            ...prev,
            completions: prev.completions + 1
          }));
          setLastUpdate(new Date());

          // Remove from active tours
          setActiveTours(prev => prev.filter(t => t.visitorId !== data.visitorId));
        }
      });

      socketRef.current.on('tour:dismiss', (data) => {
        if (!tourId || data.tourId === tourId) {
          setLiveData(prev => ({
            ...prev,
            dismissals: prev.dismissals + 1
          }));
          setLastUpdate(new Date());

          // Remove from active tours
          setActiveTours(prev => prev.filter(t => t.visitorId !== data.visitorId));
        }
      });

      // Listen for bulk updates
      socketRef.current.on('analytics:update', (data) => {
        if (!tourId || data.tourId === tourId) {
          setLiveData(prev => ({
            impressions: prev.impressions + (data.impressions || 0),
            starts: prev.starts + (data.starts || 0),
            completions: prev.completions + (data.completions || 0),
            dismissals: prev.dismissals + (data.dismissals || 0)
          }));
          setLastUpdate(new Date());
        }
      });

      // Listen for active tours update
      socketRef.current.on('analytics:activeTours', (data) => {
        setActiveTours(data.tours || []);
      });

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [workspaceId, tourId, enabled]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe:analytics', { workspaceId, tourId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, [workspaceId, tourId]);

  // Reset live counters
  const resetCounters = useCallback(() => {
    setLiveData({
      impressions: 0,
      starts: 0,
      completions: 0,
      dismissals: 0
    });
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled]);

  // Reconnect when workspace or tour changes
  useEffect(() => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('unsubscribe:analytics', { workspaceId, tourId });
      socketRef.current.emit('subscribe:analytics', { workspaceId, tourId });
      resetCounters();
    }
  }, [workspaceId, tourId, isConnected, resetCounters]);

  return {
    liveData,
    isConnected,
    activeTours,
    lastUpdate,
    resetCounters,
    connect,
    disconnect
  };
};

export default useRealtimeAnalytics;
