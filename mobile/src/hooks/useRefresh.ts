import { useState, useCallback } from 'react';

interface UseRefreshResult {
  refreshing: boolean;
  onRefresh: () => Promise<void>;
}

export function useRefresh(fetchFn: () => Promise<void>): UseRefreshResult {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFn();
    } finally {
      setRefreshing(false);
    }
  }, [fetchFn]);

  return { refreshing, onRefresh };
}
