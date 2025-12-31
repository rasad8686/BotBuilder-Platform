import { create } from 'zustand';
import type { Conversation, Message, PaginatedResponse } from '../types';
import { conversationService } from '../services/conversationService';

interface ConversationState {
  conversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  unreadCount: number;

  // Actions
  fetchConversations: (page?: number, refresh?: boolean) => Promise<void>;
  fetchConversation: (id: string) => Promise<Conversation | null>;
  fetchMessages: (conversationId: string, page?: number) => Promise<void>;
  sendMessage: (conversationId: string, content: string, type?: string) => Promise<boolean>;
  markAsRead: (conversationId: string) => Promise<void>;
  closeConversation: (conversationId: string) => Promise<boolean>;
  escalateConversation: (conversationId: string) => Promise<boolean>;
  setSelectedConversation: (conversation: Conversation | null) => void;
  addMessage: (message: Message) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  clearMessages: () => void;
  clearError: () => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  selectedConversation: null,
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  isSending: false,
  error: null,
  hasMore: true,
  page: 1,
  unreadCount: 0,

  fetchConversations: async (page = 1, refresh = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await conversationService.getConversations(page);
      if (response.success && response.data) {
        const { data, hasMore, total } = response.data as PaginatedResponse<Conversation>;
        set((state) => ({
          conversations: refresh ? data : [...state.conversations, ...data],
          hasMore,
          page,
          isLoading: false,
          unreadCount: data.filter((c) => c.unreadCount > 0).length,
        }));
      } else {
        set({ error: response.error || 'Failed to fetch conversations', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  fetchConversation: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await conversationService.getConversation(id);
      if (response.success && response.data) {
        set({ selectedConversation: response.data, isLoading: false });
        return response.data;
      } else {
        set({ error: response.error || 'Failed to fetch conversation', isLoading: false });
        return null;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return null;
    }
  },

  fetchMessages: async (conversationId: string, page = 1) => {
    set({ isLoadingMessages: true, error: null });
    try {
      const response = await conversationService.getMessages(conversationId, page);
      if (response.success && response.data) {
        const { data, hasMore } = response.data as PaginatedResponse<Message>;
        set((state) => ({
          messages: page === 1 ? data : [...data, ...state.messages],
          hasMore,
          isLoadingMessages: false,
        }));
      } else {
        set({ error: response.error || 'Failed to fetch messages', isLoadingMessages: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoadingMessages: false });
    }
  },

  sendMessage: async (conversationId: string, content: string, type = 'text') => {
    set({ isSending: true });

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      content,
      type: type as Message['type'],
      sender: 'agent',
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    set((state) => ({
      messages: [...state.messages, tempMessage],
    }));

    try {
      const response = await conversationService.sendMessage(conversationId, content, type);
      if (response.success && response.data) {
        set((state) => ({
          messages: state.messages.map((msg) => (msg.id === tempMessage.id ? response.data! : msg)),
          isSending: false,
        }));
        return true;
      } else {
        // Mark message as failed
        set((state) => ({
          messages: state.messages.map((msg) => (msg.id === tempMessage.id ? { ...msg, status: 'failed' as const } : msg)),
          isSending: false,
        }));
        return false;
      }
    } catch (error) {
      set((state) => ({
        messages: state.messages.map((msg) => (msg.id === tempMessage.id ? { ...msg, status: 'failed' as const } : msg)),
        isSending: false,
      }));
      return false;
    }
  },

  markAsRead: async (conversationId: string) => {
    try {
      await conversationService.markAsRead(conversationId);
      set((state) => ({
        conversations: state.conversations.map((conv) =>
          conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      // Ignore error
    }
  },

  closeConversation: async (conversationId: string) => {
    try {
      const response = await conversationService.closeConversation(conversationId);
      if (response.success) {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, status: 'closed' as const } : conv
          ),
          selectedConversation:
            state.selectedConversation?.id === conversationId
              ? { ...state.selectedConversation, status: 'closed' as const }
              : state.selectedConversation,
        }));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  escalateConversation: async (conversationId: string) => {
    try {
      const response = await conversationService.escalateConversation(conversationId);
      if (response.success) {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === conversationId ? { ...conv, status: 'escalated' as const } : conv
          ),
          selectedConversation:
            state.selectedConversation?.id === conversationId
              ? { ...state.selectedConversation, status: 'escalated' as const }
              : state.selectedConversation,
        }));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  setSelectedConversation: (conversation: Conversation | null) => {
    set({ selectedConversation: conversation, messages: [] });
  },

  addMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateConversation: (id: string, updates: Partial<Conversation>) => {
    set((state) => ({
      conversations: state.conversations.map((conv) => (conv.id === id ? { ...conv, ...updates } : conv)),
      selectedConversation:
        state.selectedConversation?.id === id ? { ...state.selectedConversation, ...updates } : state.selectedConversation,
    }));
  },

  clearMessages: () => set({ messages: [], hasMore: true }),

  clearError: () => set({ error: null }),
}));
