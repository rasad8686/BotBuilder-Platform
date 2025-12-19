/**
 * useNetwork Hook
 * Network status monitoring and connectivity management
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Main network status hook
 * @returns {Object} Network state and utilities
 */
export const useNetwork = () => {
  const [state, setState] = useState({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
    details: null,
    strength: null,
  });

  const [previousState, setPreviousState] = useState(null);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((netState) => {
      updateState(netState);
    });

    // Subscribe to changes
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setPreviousState(state);
      updateState(netState);
    });

    return () => unsubscribe();
  }, []);

  const updateState = (netState) => {
    const isConnected = netState.isConnected;
    const isInternetReachable = netState.isInternetReachable !== false;

    setState({
      isConnected,
      isInternetReachable,
      type: netState.type,
      isWifi: netState.type === 'wifi',
      isCellular: netState.type === 'cellular',
      details: netState.details,
      strength: getSignalStrength(netState),
    });
  };

  const getSignalStrength = (netState) => {
    if (!netState.isConnected) return 0;
    if (netState.type === 'wifi') return 4; // Assume good wifi
    if (netState.type === 'cellular') {
      const generation = netState.details?.cellularGeneration;
      if (generation === '5g') return 4;
      if (generation === '4g') return 3;
      if (generation === '3g') return 2;
      return 1;
    }
    return 2; // Default moderate
  };

  // Refresh network state
  const refresh = useCallback(async () => {
    const netState = await NetInfo.refresh();
    updateState(netState);
    return netState;
  }, []);

  // Check if online (connected + internet reachable)
  const isOnline = state.isConnected && state.isInternetReachable;

  // Check if connection was restored
  const wasRestored = previousState &&
    !previousState.isConnected &&
    state.isConnected;

  // Check if connection was lost
  const wasLost = previousState &&
    previousState.isConnected &&
    !state.isConnected;

  return {
    ...state,
    isOnline,
    wasRestored,
    wasLost,
    refresh,
  };
};

/**
 * Hook for executing callbacks on network changes
 */
export const useNetworkEffect = (callback, dependencies = []) => {
  const { isOnline, wasRestored, wasLost } = useNetwork();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    callbackRef.current({ isOnline, wasRestored, wasLost });
  }, [isOnline, wasRestored, wasLost, ...dependencies]);
};

/**
 * Hook for online-only operations
 */
export const useOnlineAction = () => {
  const { isOnline } = useNetwork();
  const pendingActions = useRef([]);

  // Execute action if online, otherwise queue it
  const execute = useCallback(async (action, options = {}) => {
    const {
      queueIfOffline = false,
      offlineMessage = 'No internet connection',
      onOffline,
    } = options;

    if (isOnline) {
      return await action();
    }

    if (queueIfOffline) {
      pendingActions.current.push(action);
      return { queued: true };
    }

    if (onOffline) {
      onOffline(offlineMessage);
    }

    throw new Error(offlineMessage);
  }, [isOnline]);

  // Execute all pending actions when back online
  useNetworkEffect(async ({ wasRestored }) => {
    if (wasRestored && pendingActions.current.length > 0) {
      const actions = [...pendingActions.current];
      pendingActions.current = [];

      for (const action of actions) {
        try {
          await action();
        } catch (error) {
          console.error('Failed to execute queued action:', error);
        }
      }
    }
  });

  // Clear pending actions
  const clearPending = useCallback(() => {
    pendingActions.current = [];
  }, []);

  return {
    execute,
    clearPending,
    pendingCount: pendingActions.current.length,
    isOnline,
  };
};

/**
 * Hook for retry logic with network awareness
 */
export const useNetworkRetry = (asyncFn, options = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    backoff = true,
    retryOnReconnect = true,
  } = options;

  const { isOnline, wasRestored } = useNetwork();
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: false,
    retryCount: 0,
  });

  const retryCountRef = useRef(0);
  const abortControllerRef = useRef(null);

  const execute = useCallback(async (...args) => {
    if (!isOnline) {
      setState((prev) => ({
        ...prev,
        error: new Error('No internet connection'),
        loading: false,
      }));
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, loading: true, error: null }));
    retryCountRef.current = 0;

    const attemptRequest = async () => {
      try {
        const result = await asyncFn(...args);
        setState({
          data: result,
          error: null,
          loading: false,
          retryCount: retryCountRef.current,
        });
        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          return;
        }

        retryCountRef.current++;

        if (retryCountRef.current < maxRetries) {
          const delay = backoff
            ? retryDelay * Math.pow(2, retryCountRef.current - 1)
            : retryDelay;

          await new Promise((resolve) => setTimeout(resolve, delay));
          return attemptRequest();
        }

        setState({
          data: null,
          error,
          loading: false,
          retryCount: retryCountRef.current,
        });
        throw error;
      }
    };

    return attemptRequest();
  }, [asyncFn, isOnline, maxRetries, retryDelay, backoff]);

  // Auto-retry on reconnect
  useEffect(() => {
    if (wasRestored && retryOnReconnect && state.error) {
      execute();
    }
  }, [wasRestored, retryOnReconnect]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      data: null,
      error: null,
      loading: false,
      retryCount: 0,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
    isOnline,
  };
};

/**
 * Hook for monitoring network quality
 */
export const useNetworkQuality = () => {
  const { type, details, isConnected, strength } = useNetwork();
  const [quality, setQuality] = useState('good');
  const [latency, setLatency] = useState(null);

  // Calculate quality based on connection type
  useEffect(() => {
    if (!isConnected) {
      setQuality('offline');
      return;
    }

    if (type === 'wifi') {
      setQuality('excellent');
    } else if (type === 'cellular') {
      const generation = details?.cellularGeneration;
      if (generation === '5g') setQuality('excellent');
      else if (generation === '4g') setQuality('good');
      else if (generation === '3g') setQuality('moderate');
      else setQuality('poor');
    } else {
      setQuality('unknown');
    }
  }, [type, details, isConnected]);

  // Ping test for latency (optional)
  const measureLatency = useCallback(async (url = 'https://www.google.com') => {
    if (!isConnected) {
      setLatency(null);
      return null;
    }

    try {
      const start = Date.now();
      await fetch(url, { method: 'HEAD', cache: 'no-store' });
      const elapsed = Date.now() - start;
      setLatency(elapsed);
      return elapsed;
    } catch {
      setLatency(null);
      return null;
    }
  }, [isConnected]);

  const getQualityLabel = () => {
    switch (quality) {
      case 'excellent':
        return 'Excellent';
      case 'good':
        return 'Good';
      case 'moderate':
        return 'Moderate';
      case 'poor':
        return 'Poor';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const getQualityColor = () => {
    switch (quality) {
      case 'excellent':
        return '#22c55e';
      case 'good':
        return '#84cc16';
      case 'moderate':
        return '#f59e0b';
      case 'poor':
        return '#ef4444';
      case 'offline':
        return '#94a3b8';
      default:
        return '#64748b';
    }
  };

  return {
    quality,
    qualityLabel: getQualityLabel(),
    qualityColor: getQualityColor(),
    latency,
    strength,
    measureLatency,
    connectionType: type,
    isConnected,
  };
};

/**
 * Hook for offline data sync
 */
export const useOfflineSync = (syncFn, options = {}) => {
  const { syncOnReconnect = true, maxPendingItems = 100 } = options;
  const { isOnline, wasRestored } = useNetwork();

  const [pendingItems, setPendingItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Add item to sync queue
  const addToQueue = useCallback((item) => {
    setPendingItems((prev) => {
      if (prev.length >= maxPendingItems) {
        // Remove oldest item if queue is full
        return [...prev.slice(1), item];
      }
      return [...prev, item];
    });
  }, [maxPendingItems]);

  // Sync all pending items
  const sync = useCallback(async () => {
    if (!isOnline || pendingItems.length === 0 || syncing) {
      return;
    }

    setSyncing(true);
    setSyncError(null);

    try {
      const itemsToSync = [...pendingItems];
      await syncFn(itemsToSync);

      setPendingItems([]);
      setLastSyncTime(new Date());
    } catch (error) {
      setSyncError(error);
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }, [isOnline, pendingItems, syncing, syncFn]);

  // Auto-sync when reconnected
  useEffect(() => {
    if (wasRestored && syncOnReconnect && pendingItems.length > 0) {
      sync();
    }
  }, [wasRestored, syncOnReconnect, pendingItems.length]);

  // Clear queue
  const clearQueue = useCallback(() => {
    setPendingItems([]);
  }, []);

  return {
    addToQueue,
    sync,
    clearQueue,
    pendingItems,
    pendingCount: pendingItems.length,
    syncing,
    lastSyncTime,
    syncError,
    isOnline,
  };
};

export default useNetwork;
