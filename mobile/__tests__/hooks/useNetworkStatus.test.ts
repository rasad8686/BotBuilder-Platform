import { renderHook, act } from '@testing-library/react-hooks';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';

jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage');

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('useNetworkStatus', () => {
  let mockUnsubscribe: jest.Mock;
  let networkChangeCallback: (state: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUnsubscribe = jest.fn();
    mockNetInfo.addEventListener.mockImplementation((callback) => {
      networkChangeCallback = callback;
      return mockUnsubscribe;
    });

    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { ssid: 'TestWiFi' },
    } as any);

    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
  });

  it('should initialize with default values', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.networkStatus.isConnected).toBe(true);
    expect(result.current.networkStatus.isInternetReachable).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should detect wifi connection', async () => {
    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { ssid: 'TestWiFi' },
    } as any);

    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.networkStatus.isWifi).toBe(true);
    expect(result.current.networkStatus.isCellular).toBe(false);
    expect(result.current.networkStatus.type).toBe('wifi');
  });

  it('should detect cellular connection', async () => {
    mockNetInfo.fetch.mockResolvedValue({
      type: 'cellular',
      isConnected: true,
      isInternetReachable: true,
      details: { carrier: 'Test Carrier' },
    } as any);

    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.networkStatus.isWifi).toBe(false);
    expect(result.current.networkStatus.isCellular).toBe(true);
    expect(result.current.networkStatus.type).toBe('cellular');
  });

  it('should detect offline state', async () => {
    mockNetInfo.fetch.mockResolvedValue({
      type: 'none',
      isConnected: false,
      isInternetReachable: false,
      details: null,
    } as any);

    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.networkStatus.isConnected).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should update on network change', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.networkStatus.isConnected).toBe(true);

    // Simulate network going offline
    act(() => {
      networkChangeCallback({
        type: 'none',
        isConnected: false,
        isInternetReachable: false,
        details: null,
      });
    });

    expect(result.current.networkStatus.isConnected).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should refresh network status', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    mockNetInfo.fetch.mockResolvedValue({
      type: 'cellular',
      isConnected: true,
      isInternetReachable: true,
      details: {},
    } as any);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.networkStatus.type).toBe('cellular');
  });

  it('should load cached status on mount', async () => {
    const cachedStatus = {
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      isWifi: true,
      isCellular: false,
      details: { ssid: 'CachedWiFi' },
    };

    mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(cachedStatus));

    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(mockAsyncStorage.getItem).toHaveBeenCalled();
  });

  it('should cache status on change', async () => {
    const { waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(mockAsyncStorage.setItem).toHaveBeenCalled();
  });

  it('should cleanup on unmount', async () => {
    const { unmount, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should detect isInternetReachable separately from isConnected', async () => {
    mockNetInfo.fetch.mockResolvedValue({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: false, // Connected to WiFi but no internet
      details: { ssid: 'NoInternetWiFi' },
    } as any);

    const { result, waitForNextUpdate } = renderHook(() => useNetworkStatus());

    await waitForNextUpdate();

    expect(result.current.networkStatus.isConnected).toBe(true);
    expect(result.current.networkStatus.isInternetReachable).toBe(false);
    expect(result.current.isOffline).toBe(true); // Should be offline if no internet
  });
});
