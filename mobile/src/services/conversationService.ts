import api from './api';
import type { ApiResponse, Conversation, Message, PaginatedResponse } from '../types';

export const conversationService = {
  async getConversations(
    page = 1,
    limit = 20,
    filters?: { botId?: string; status?: string }
  ): Promise<ApiResponse<PaginatedResponse<Conversation>>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters?.botId && { botId: filters.botId }),
        ...(filters?.status && { status: filters.status }),
      });

      const response = await api.get(`/conversations?${params.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch conversations',
      };
    }
  },

  async getConversation(id: string): Promise<ApiResponse<Conversation>> {
    try {
      const response = await api.get(`/conversations/${id}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch conversation',
      };
    }
  },

  async getMessages(
    conversationId: string,
    page = 1,
    limit = 50
  ): Promise<ApiResponse<PaginatedResponse<Message>>> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await api.get(`/conversations/${conversationId}/messages?${params.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to fetch messages',
      };
    }
  },

  async sendMessage(
    conversationId: string,
    content: string,
    type = 'text'
  ): Promise<ApiResponse<Message>> {
    try {
      const response = await api.post(`/conversations/${conversationId}/messages`, {
        content,
        type,
      });
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to send message',
      };
    }
  },

  async markAsRead(conversationId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/conversations/${conversationId}/read`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to mark as read',
      };
    }
  },

  async closeConversation(conversationId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/conversations/${conversationId}/close`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to close conversation',
      };
    }
  },

  async escalateConversation(conversationId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/conversations/${conversationId}/escalate`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to escalate conversation',
      };
    }
  },

  async assignConversation(conversationId: string, agentId: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/conversations/${conversationId}/assign`, { agentId });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to assign conversation',
      };
    }
  },

  async addTag(conversationId: string, tag: string): Promise<ApiResponse<void>> {
    try {
      await api.post(`/conversations/${conversationId}/tags`, { tag });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to add tag',
      };
    }
  },

  async removeTag(conversationId: string, tag: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/conversations/${conversationId}/tags/${tag}`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to remove tag',
      };
    }
  },

  async rateConversation(conversationId: string, rating: number): Promise<ApiResponse<void>> {
    try {
      await api.post(`/conversations/${conversationId}/rate`, { rating });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to rate conversation',
      };
    }
  },

  async searchConversations(
    query: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse<PaginatedResponse<Conversation>>> {
    try {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await api.get(`/conversations/search?${params.toString()}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to search conversations',
      };
    }
  },
};
