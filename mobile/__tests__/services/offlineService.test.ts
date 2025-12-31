import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { offlineService } from '../../src/services/offlineService';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe('OfflineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    mockAsyncStorage.removeItem.mockResolvedValue(undefined);
    mockAsyncStorage.getAllKeys.mockResolvedValue([]);
    mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
  });

  describe('Queue Management', () => {
    it('should add request to queue', async () => {
      const request = { method: 'POST' as const, url: '/api/test', data: { foo: 'bar' } };

      const id = await offlineService.addToQueue(request);

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should remove request from queue', async () => {
      const request = { method: 'POST' as const, url: '/api/test' };
      const id = await offlineService.addToQueue(request);

      await offlineService.removeFromQueue(id);

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should get queued requests', async () => {
      await offlineService.addToQueue({ method: 'POST' as const, url: '/api/test1' });
      await offlineService.addToQueue({ method: 'PUT' as const, url: '/api/test2' });

      const requests = offlineService.getQueuedRequests();

      expect(Array.isArray(requests)).toBe(true);
    });

    it('should get queue length', async () => {
      const initialLength = offlineService.getQueueLength();

      await offlineService.addToQueue({ method: 'POST' as const, url: '/api/test' });

      const newLength = offlineService.getQueueLength();
      expect(newLength).toBe(initialLength + 1);
    });
  });

  describe('Caching', () => {
    it('should cache data with default TTL', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };

      await offlineService.cacheData(key, data);

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
      const call = mockAsyncStorage.setItem.mock.calls.find(c => c[0].includes(key));
      expect(call).toBeDefined();
    });

    it('should cache data with custom TTL', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const ttl = 60000; // 1 minute

      await offlineService.cacheData(key, data, ttl);

      expect(mockAsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should get cached data', async () => {
      const key = 'test-key';
      const data = { value: 'test-data' };
      const cacheEntry = {
        key,
        data,
        ttl: 300000,
        timestamp: Date.now(),
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await offlineService.getCachedData(key);

      expect(result).toEqual(data);
    });

    it('should return null for expired cache', async () => {
      const key = 'test-key';
      const cacheEntry = {
        key,
        data: { value: 'test' },
        ttl: 1000, // 1 second
        timestamp: Date.now() - 10000, // 10 seconds ago
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));

      const result = await offlineService.getCachedData(key);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should return null for non-existent cache', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await offlineService.getCachedData('non-existent');

      expect(result).toBeNull();
    });

    it('should clear specific cache key', async () => {
      await offlineService.clearCache('test-key');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('@cache_test-key');
    });

    it('should clear all cache', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce([
        '@cache_key1',
        '@cache_key2',
        '@other_key',
      ]);

      await offlineService.clearCache();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(['@cache_key1', '@cache_key2']);
    });

    it('should get cache size', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce([
        '@cache_key1',
        '@cache_key2',
        '@cache_key3',
        '@other_key',
      ]);

      const size = await offlineService.getCacheSize();

      expect(size).toBe(3);
    });
  });

  describe('Offline-first data fetching', () => {
    it('should return cached data when available', async () => {
      const key = 'fetch-key';
      const cachedData = { value: 'cached' };
      const cacheEntry = {
        key,
        data: cachedData,
        ttl: 300000,
        timestamp: Date.now(),
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      } as any);

      const fetchFn = jest.fn().mockResolvedValue({ value: 'fresh' });

      const result = await offlineService.fetchWithCache(key, fetchFn);

      expect(result.data).toEqual(cachedData);
      expect(result.fromCache).toBe(true);
    });

    it('should fetch fresh data when cache is empty', async () => {
      const key = 'fetch-key';
      const freshData = { value: 'fresh' };

      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      } as any);

      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await offlineService.fetchWithCache(key, fetchFn);

      expect(result.data).toEqual(freshData);
      expect(result.fromCache).toBe(false);
      expect(fetchFn).toHaveBeenCalled();
    });

    it('should force refresh when specified', async () => {
      const key = 'fetch-key';
      const cachedData = { value: 'cached' };
      const freshData = { value: 'fresh' };
      const cacheEntry = {
        key,
        data: cachedData,
        ttl: 300000,
        timestamp: Date.now(),
      };

      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cacheEntry));
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      } as any);

      const fetchFn = jest.fn().mockResolvedValue(freshData);

      const result = await offlineService.fetchWithCache(key, fetchFn, { forceRefresh: true });

      expect(result.data).toEqual(freshData);
      expect(result.fromCache).toBe(false);
      expect(fetchFn).toHaveBeenCalled();
    });

    it('should throw error when offline and no cache available', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockNetInfo.fetch.mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      } as any);

      const fetchFn = jest.fn();

      await expect(
        offlineService.fetchWithCache('key', fetchFn)
      ).rejects.toThrow('No internet connection and no cached data available');
    });
  });

  describe('Sync Listeners', () => {
    it('should add and remove sync listeners', () => {
      const listener = jest.fn();

      const unsubscribe = offlineService.addSyncListener(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });
  });

  describe('Clear All Offline Data', () => {
    it('should clear queue and cache', async () => {
      mockAsyncStorage.getAllKeys.mockResolvedValueOnce(['@cache_key1']);

      await offlineService.clearAllOfflineData();

      expect(offlineService.getQueueLength()).toBe(0);
    });
  });
});
