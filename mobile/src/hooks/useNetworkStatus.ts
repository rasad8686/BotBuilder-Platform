import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
  isWifi: boolean;
  isCellular: boolean;
  details: any;
}

interface UseNetworkStatusReturn {
  networkStatus: NetworkStatus;
  isOffline: boolean;
  refresh: () => Promise<void>;
}

const NETWORK_STATUS_KEY = '@network_status_cache';

export const useNetworkStatus = (): UseNetworkStatusReturn => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    isWifi: false,
    isCellular: false,
    details: null,
  });

  const parseNetInfoState = (state: NetInfoState): NetworkStatus => {
    return {
      isConnected: state.isConnected,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      isWifi: state.type === 'wifi',
      isCellular: state.type === 'cellular',
      details: state.details,
    };
  };

  const refresh = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      const status = parseNetInfoState(state);
      setNetworkStatus(status);
      await AsyncStorage.setItem(NETWORK_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
      console.error('Failed to fetch network status:', error);
    }
  }, []);

  useEffect(() => {
    // Load cached status
    const loadCachedStatus = async () => {
      try {
        const cached = await AsyncStorage.getItem(NETWORK_STATUS_KEY);
        if (cached) {
          setNetworkStatus(JSON.parse(cached));
        }
      } catch (error) {
        console.error('Failed to load cached network status:', error);
      }
    };
    loadCachedStatus();

    // Initial fetch
    refresh();

    // Subscribe to network status changes
    const unsubscribe: NetInfoSubscription = NetInfo.addEventListener((state) => {
      const status = parseNetInfoState(state);
      setNetworkStatus(status);
      AsyncStorage.setItem(NETWORK_STATUS_KEY, JSON.stringify(status)).catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  return {
    networkStatus,
    isOffline: networkStatus.isConnected === false || networkStatus.isInternetReachable === false,
    refresh,
  };
};

export default useNetworkStatus;
