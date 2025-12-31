import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// Queue for offline requests
interface QueuedRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  data?: any;
  timestamp: number;
  retries: number;
}

// Cache configuration
interface CacheConfig {
  key: string;
  ttl: number; // Time to live in milliseconds
  data: any;
  timestamp: number;
}

const OFFLINE_QUEUE_KEY = '@offline_request_queue';
const CACHE_PREFIX = '@cache_';
const MAX_RETRIES = 3;
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

class OfflineService {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;
  private syncListeners: Array<(status: 'syncing' | 'synced' | 'error') => void> = [];

  constructor() {
    this.loadQueue();
    this.setupNetworkListener();
  }

  // Queue Management
  private async loadQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  async addToQueue(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>): Promise<string> {
    const queuedRequest: QueuedRequest = {
      ...request,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    this.queue.push(queuedRequest);
    await this.saveQueue();
    return queuedRequest.id;
  }

  async removeFromQueue(id: string): Promise<void> {
    this.queue = this.queue.filter((r) => r.id !== id);
    await this.saveQueue();
  }

  getQueuedRequests(): QueuedRequest[] {
    return [...this.queue];
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  // Network Listener
  private setupNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        this.processQueue();
      }
    });
  }

  // Process Queue
  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      return;
    }

    this.isProcessing = true;
    this.notifyListeners('syncing');

    const processedIds: string[] = [];
    const failedIds: string[] = [];

    for (const request of this.queue) {
      try {
        // Import api dynamically to avoid circular dependencies
        const { default: api } = await import('./api');

        const config: any = {
          method: request.method,
          url: request.url,
        };

        if (request.data && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
          config.data = request.data;
        }

        await api(config);
        processedIds.push(request.id);
      } catch (error: any) {
        console.error('Failed to process queued request:', error);
        request.retries += 1;

        if (request.retries >= MAX_RETRIES) {
          failedIds.push(request.id);
        }
      }
    }

    // Remove processed and failed requests
    this.queue = this.queue.filter(
      (r) => !processedIds.includes(r.id) && !failedIds.includes(r.id)
    );
    await this.saveQueue();

    this.isProcessing = false;
    this.notifyListeners(this.queue.length === 0 ? 'synced' : 'error');
  }

  // Sync Listeners
  addSyncListener(listener: (status: 'syncing' | 'synced' | 'error') => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(status: 'syncing' | 'synced' | 'error'): void {
    this.syncListeners.forEach((listener) => listener(status));
  }

  // Caching
  async cacheData(key: string, data: any, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const cacheConfig: CacheConfig = {
        key,
        ttl,
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheConfig));
    } catch (error) {
      console.error('Failed to cache data:', error);
    }
  }

  async getCachedData<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!cached) {
        return null;
      }

      const cacheConfig: CacheConfig = JSON.parse(cached);
      const now = Date.now();

      // Check if cache has expired
      if (now - cacheConfig.timestamp > cacheConfig.ttl) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }

      return cacheConfig.data as T;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }

  async clearCache(key?: string): Promise<void> {
    try {
      if (key) {
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      } else {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      return cacheKeys.length;
    } catch (error) {
      console.error('Failed to get cache size:', error);
      return 0;
    }
  }

  // Offline-first data fetching
  async fetchWithCache<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: { ttl?: number; forceRefresh?: boolean } = {}
  ): Promise<{ data: T; fromCache: boolean }> {
    const { ttl = DEFAULT_TTL, forceRefresh = false } = options;

    // Try to get cached data first
    if (!forceRefresh) {
      const cached = await this.getCachedData<T>(key);
      if (cached !== null) {
        // Return cached data, but try to refresh in background
        this.refreshInBackground(key, fetchFn, ttl);
        return { data: cached, fromCache: true };
      }
    }

    // Check if online
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected || !netInfo.isInternetReachable) {
      // Try to get any cached data, even if expired
      const expiredCache = await this.getExpiredCache<T>(key);
      if (expiredCache !== null) {
        return { data: expiredCache, fromCache: true };
      }
      throw new Error('No internet connection and no cached data available');
    }

    // Fetch fresh data
    const data = await fetchFn();
    await this.cacheData(key, data, ttl);
    return { data, fromCache: false };
  }

  private async refreshInBackground<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number
  ): Promise<void> {
    try {
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected && netInfo.isInternetReachable) {
        const data = await fetchFn();
        await this.cacheData(key, data, ttl);
      }
    } catch (error) {
      // Silently fail background refresh
      console.log('Background refresh failed:', error);
    }
  }

  private async getExpiredCache<T>(key: string): Promise<T | null> {
    try {
      const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!cached) {
        return null;
      }
      const cacheConfig: CacheConfig = JSON.parse(cached);
      return cacheConfig.data as T;
    } catch {
      return null;
    }
  }

  // Clear all offline data
  async clearAllOfflineData(): Promise<void> {
    try {
      this.queue = [];
      await this.saveQueue();
      await this.clearCache();
    } catch (error) {
      console.error('Failed to clear offline data:', error);
    }
  }
}

export const offlineService = new OfflineService();
export default offlineService;
