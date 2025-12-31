import { create } from 'zustand';
import type { AnalyticsData, ChartData, OverviewStats } from '../types';
import { analyticsService } from '../services/analyticsService';

interface DateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface AnalyticsState {
  data: AnalyticsData | null;
  isLoading: boolean;
  error: string | null;
  dateRange: DateRange;
  selectedBotId: string | null;

  // Actions
  fetchAnalytics: () => Promise<void>;
  fetchBotAnalytics: (botId: string) => Promise<void>;
  setDateRange: (range: DateRange) => void;
  setSelectedBot: (botId: string | null) => void;
  clearError: () => void;
}

const defaultDateRange: DateRange = {
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
  label: 'Last 7 days',
};

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  dateRange: defaultDateRange,
  selectedBotId: null,

  fetchAnalytics: async () => {
    set({ isLoading: true, error: null });
    const { dateRange, selectedBotId } = get();

    try {
      const response = await analyticsService.getAnalytics({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        botId: selectedBotId || undefined,
      });

      if (response.success && response.data) {
        set({ data: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to fetch analytics', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  fetchBotAnalytics: async (botId: string) => {
    set({ isLoading: true, error: null, selectedBotId: botId });
    const { dateRange } = get();

    try {
      const response = await analyticsService.getBotAnalytics(botId, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      if (response.success && response.data) {
        set({ data: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to fetch bot analytics', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  setDateRange: (range: DateRange) => {
    set({ dateRange: range });
    get().fetchAnalytics();
  },

  setSelectedBot: (botId: string | null) => {
    set({ selectedBotId: botId });
    if (botId) {
      get().fetchBotAnalytics(botId);
    } else {
      get().fetchAnalytics();
    }
  },

  clearError: () => set({ error: null }),
}));

// Predefined date ranges
export const dateRangePresets: DateRange[] = [
  {
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Today',
  },
  {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 7 days',
  },
  {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 30 days',
  },
  {
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    label: 'Last 90 days',
  },
];
