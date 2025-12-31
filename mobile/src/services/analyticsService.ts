import api from './api';
import type { ApiResponse, AnalyticsData, ChartData, OverviewStats } from '../types';

interface AnalyticsParams {
  startDate: string;
  endDate: string;
  botId?: string;
}

export const analyticsService = {
  async getAnalytics(params: AnalyticsParams): Promise<ApiResponse<AnalyticsData>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.botId && { botId: params.botId }),
      });

      const response = await api.get(`/analytics?${queryParams.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch analytics',
      };
    }
  },

  async getBotAnalytics(
    botId: string,
    params: { startDate: string; endDate: string }
  ): Promise<ApiResponse<AnalyticsData>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
      });

      const response = await api.get(`/analytics/bots/${botId}?${queryParams.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bot analytics',
      };
    }
  },

  async getOverviewStats(): Promise<ApiResponse<OverviewStats>> {
    try {
      const response = await api.get('/analytics/overview');
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch overview stats',
      };
    }
  },

  async getConversationTrends(
    params: AnalyticsParams
  ): Promise<ApiResponse<ChartData[]>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.botId && { botId: params.botId }),
      });

      const response = await api.get(`/analytics/conversations/trends?${queryParams.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch conversation trends',
      };
    }
  },

  async getMessageTrends(params: AnalyticsParams): Promise<ApiResponse<ChartData[]>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.botId && { botId: params.botId }),
      });

      const response = await api.get(`/analytics/messages/trends?${queryParams.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch message trends',
      };
    }
  },

  async getResponseTimeStats(params: AnalyticsParams): Promise<ApiResponse<{
    average: number;
    median: number;
    p95: number;
    trend: ChartData[];
  }>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.botId && { botId: params.botId }),
      });

      const response = await api.get(`/analytics/response-time?${queryParams.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch response time stats',
      };
    }
  },

  async getSatisfactionStats(params: AnalyticsParams): Promise<ApiResponse<{
    average: number;
    distribution: { rating: number; count: number }[];
    trend: ChartData[];
  }>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.botId && { botId: params.botId }),
      });

      const response = await api.get(`/analytics/satisfaction?${queryParams.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch satisfaction stats',
      };
    }
  },

  async exportAnalytics(
    params: AnalyticsParams,
    format: 'csv' | 'pdf' = 'csv'
  ): Promise<ApiResponse<Blob>> {
    try {
      const queryParams = new URLSearchParams({
        startDate: params.startDate,
        endDate: params.endDate,
        format,
        ...(params.botId && { botId: params.botId }),
      });

      const response = await api.get(`/analytics/export?${queryParams.toString()}`, {
        responseType: 'blob',
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to export analytics',
      };
    }
  },
};
