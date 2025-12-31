import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { useNetworkStatus } from '../../src/hooks/useNetworkStatus';
import { offlineService } from '../../src/services/offlineService';

jest.mock('../../src/hooks/useNetworkStatus');
jest.mock('../../src/services/offlineService');
jest.mock('../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#3B82F6',
      background: '#FFFFFF',
      card: '#F3F4F6',
      text: '#1F2937',
      textSecondary: '#6B7280',
      border: '#E5E7EB',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
    },
  }),
}));

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockOfflineService = offlineService as jest.Mocked<typeof offlineService>;

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOfflineService.getQueueLength.mockReturnValue(0);
    mockOfflineService.addSyncListener.mockReturnValue(() => {});
  });

  it('should not render when online with no queued requests', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        isWifi: true,
        isCellular: false,
        details: null,
      },
      isOffline: false,
      refresh: jest.fn(),
    });
    mockOfflineService.getQueueLength.mockReturnValue(0);

    const { queryByText } = render(<OfflineBanner />);

    // Banner should be hidden (animated out)
    expect(queryByText('No internet connection')).toBeNull();
  });

  it('should show offline message when offline', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        isWifi: false,
        isCellular: false,
        details: null,
      },
      isOffline: true,
      refresh: jest.fn(),
    });

    const { getByText } = render(<OfflineBanner />);

    expect(getByText('No internet connection')).toBeTruthy();
    expect(getByText('Working offline')).toBeTruthy();
  });

  it('should show pending changes count when offline with queue', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        isWifi: false,
        isCellular: false,
        details: null,
      },
      isOffline: true,
      refresh: jest.fn(),
    });
    mockOfflineService.getQueueLength.mockReturnValue(5);

    const { getByText } = render(<OfflineBanner />);

    expect(getByText('5 changes pending')).toBeTruthy();
  });

  it('should show sync now button when online with queued requests', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        isWifi: true,
        isCellular: false,
        details: null,
      },
      isOffline: false,
      refresh: jest.fn(),
    });
    mockOfflineService.getQueueLength.mockReturnValue(3);

    const { getByText } = render(<OfflineBanner />);

    expect(getByText('Sync Now')).toBeTruthy();
  });

  it('should trigger sync when sync button is pressed', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        isWifi: true,
        isCellular: false,
        details: null,
      },
      isOffline: false,
      refresh: jest.fn(),
    });
    mockOfflineService.getQueueLength.mockReturnValue(3);

    const { getByText } = render(<OfflineBanner />);

    fireEvent.press(getByText('Sync Now'));

    expect(mockOfflineService.processQueue).toHaveBeenCalled();
  });

  it('should not show sync button when offline', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        isWifi: false,
        isCellular: false,
        details: null,
      },
      isOffline: true,
      refresh: jest.fn(),
    });
    mockOfflineService.getQueueLength.mockReturnValue(3);

    const { queryByText } = render(<OfflineBanner />);

    expect(queryByText('Sync Now')).toBeNull();
  });

  it('should register sync listener on mount', () => {
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        isWifi: true,
        isCellular: false,
        details: null,
      },
      isOffline: false,
      refresh: jest.fn(),
    });

    render(<OfflineBanner />);

    expect(mockOfflineService.addSyncListener).toHaveBeenCalled();
  });

  it('should unregister sync listener on unmount', () => {
    const unsubscribe = jest.fn();
    mockOfflineService.addSyncListener.mockReturnValue(unsubscribe);
    mockUseNetworkStatus.mockReturnValue({
      networkStatus: {
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        isWifi: true,
        isCellular: false,
        details: null,
      },
      isOffline: false,
      refresh: jest.fn(),
    });

    const { unmount } = render(<OfflineBanner />);

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
