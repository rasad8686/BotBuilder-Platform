import api from './api';
import type { ApiResponse, Bot, BotConfig, BotStats } from '../types';

export const botService = {
  async getBots(): Promise<ApiResponse<Bot[]>> {
    try {
      const response = await api.get('/bots');
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bots',
      };
    }
  },

  async getBot(id: string): Promise<ApiResponse<Bot>> {
    try {
      const response = await api.get(`/bots/${id}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bot',
      };
    }
  },

  async createBot(botData: Partial<Bot>): Promise<ApiResponse<Bot>> {
    try {
      const response = await api.post('/bots', botData);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to create bot',
      };
    }
  },

  async updateBot(id: string, updates: Partial<Bot>): Promise<ApiResponse<Bot>> {
    try {
      const response = await api.put(`/bots/${id}`, updates);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update bot',
      };
    }
  },

  async deleteBot(id: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/bots/${id}`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to delete bot',
      };
    }
  },

  async startBot(id: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/bots/${id}/start`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to start bot',
      };
    }
  },

  async stopBot(id: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/bots/${id}/stop`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to stop bot',
      };
    }
  },

  async restartBot(id: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/bots/${id}/restart`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to restart bot',
      };
    }
  },

  async getBotConfig(id: string): Promise<ApiResponse<BotConfig>> {
    try {
      const response = await api.get(`/bots/${id}/config`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bot config',
      };
    }
  },

  async updateBotConfig(id: string, config: Partial<BotConfig>): Promise<ApiResponse<BotConfig>> {
    try {
      const response = await api.put(`/bots/${id}/config`, config);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to update bot config',
      };
    }
  },

  async getBotStats(id: string): Promise<ApiResponse<BotStats>> {
    try {
      const response = await api.get(`/bots/${id}/stats`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch bot stats',
      };
    }
  },

  async testBot(id: string, message: string): Promise<ApiResponse<string>> {
    try {
      const response = await api.post(`/bots/${id}/test`, { message });
      return { success: true, data: response.data.response };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to test bot',
      };
    }
  },

  async duplicateBot(id: string, name: string): Promise<ApiResponse<Bot>> {
    try {
      const response = await api.post(`/bots/${id}/duplicate`, { name });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to duplicate bot',
      };
    }
  },

  async exportBot(id: string): Promise<ApiResponse<Blob>> {
    try {
      const response = await api.get(`/bots/${id}/export`, {
        responseType: 'blob',
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to export bot',
      };
    }
  },
};
