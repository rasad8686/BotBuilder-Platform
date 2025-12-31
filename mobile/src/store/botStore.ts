import { create } from 'zustand';
import type { Bot, BotConfig } from '../types';
import { botService } from '../services/botService';

interface BotState {
  bots: Bot[];
  selectedBot: Bot | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filter: {
    status: string | null;
    platform: string | null;
  };

  // Actions
  fetchBots: () => Promise<void>;
  fetchBot: (id: string) => Promise<Bot | null>;
  createBot: (bot: Partial<Bot>) => Promise<Bot | null>;
  updateBot: (id: string, updates: Partial<Bot>) => Promise<boolean>;
  deleteBot: (id: string) => Promise<boolean>;
  startBot: (id: string) => Promise<boolean>;
  stopBot: (id: string) => Promise<boolean>;
  updateBotConfig: (id: string, config: Partial<BotConfig>) => Promise<boolean>;
  setSelectedBot: (bot: Bot | null) => void;
  setSearchQuery: (query: string) => void;
  setFilter: (filter: { status?: string | null; platform?: string | null }) => void;
  clearError: () => void;
}

export const useBotStore = create<BotState>((set, get) => ({
  bots: [],
  selectedBot: null,
  isLoading: false,
  error: null,
  searchQuery: '',
  filter: {
    status: null,
    platform: null,
  },

  fetchBots: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await botService.getBots();
      if (response.success && response.data) {
        set({ bots: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to fetch bots', isLoading: false });
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
    }
  },

  fetchBot: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await botService.getBot(id);
      if (response.success && response.data) {
        set({ selectedBot: response.data, isLoading: false });
        return response.data;
      } else {
        set({ error: response.error || 'Failed to fetch bot', isLoading: false });
        return null;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return null;
    }
  },

  createBot: async (botData: Partial<Bot>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await botService.createBot(botData);
      if (response.success && response.data) {
        set((state) => ({
          bots: [...state.bots, response.data!],
          isLoading: false,
        }));
        return response.data;
      } else {
        set({ error: response.error || 'Failed to create bot', isLoading: false });
        return null;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return null;
    }
  },

  updateBot: async (id: string, updates: Partial<Bot>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await botService.updateBot(id, updates);
      if (response.success) {
        set((state) => ({
          bots: state.bots.map((bot) => (bot.id === id ? { ...bot, ...updates } : bot)),
          selectedBot: state.selectedBot?.id === id ? { ...state.selectedBot, ...updates } : state.selectedBot,
          isLoading: false,
        }));
        return true;
      } else {
        set({ error: response.error || 'Failed to update bot', isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return false;
    }
  },

  deleteBot: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await botService.deleteBot(id);
      if (response.success) {
        set((state) => ({
          bots: state.bots.filter((bot) => bot.id !== id),
          selectedBot: state.selectedBot?.id === id ? null : state.selectedBot,
          isLoading: false,
        }));
        return true;
      } else {
        set({ error: response.error || 'Failed to delete bot', isLoading: false });
        return false;
      }
    } catch (error) {
      set({ error: 'Network error', isLoading: false });
      return false;
    }
  },

  startBot: async (id: string) => {
    try {
      const response = await botService.startBot(id);
      if (response.success) {
        set((state) => ({
          bots: state.bots.map((bot) => (bot.id === id ? { ...bot, status: 'active' as const } : bot)),
          selectedBot:
            state.selectedBot?.id === id ? { ...state.selectedBot, status: 'active' as const } : state.selectedBot,
        }));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  stopBot: async (id: string) => {
    try {
      const response = await botService.stopBot(id);
      if (response.success) {
        set((state) => ({
          bots: state.bots.map((bot) => (bot.id === id ? { ...bot, status: 'inactive' as const } : bot)),
          selectedBot:
            state.selectedBot?.id === id ? { ...state.selectedBot, status: 'inactive' as const } : state.selectedBot,
        }));
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  },

  updateBotConfig: async (id: string, config: Partial<BotConfig>) => {
    const { selectedBot } = get();
    if (!selectedBot) return false;

    const updatedConfig = { ...selectedBot.config, ...config };
    return await get().updateBot(id, { config: updatedConfig });
  },

  setSelectedBot: (bot: Bot | null) => set({ selectedBot: bot }),

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setFilter: (filter) =>
    set((state) => ({
      filter: { ...state.filter, ...filter },
    })),

  clearError: () => set({ error: null }),
}));

// Selectors
export const selectFilteredBots = (state: BotState) => {
  let filtered = state.bots;

  if (state.searchQuery) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (bot) => bot.name.toLowerCase().includes(query) || bot.description?.toLowerCase().includes(query)
    );
  }

  if (state.filter.status) {
    filtered = filtered.filter((bot) => bot.status === state.filter.status);
  }

  if (state.filter.platform) {
    filtered = filtered.filter((bot) => bot.platform === state.filter.platform);
  }

  return filtered;
};
