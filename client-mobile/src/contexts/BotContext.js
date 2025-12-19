/**
 * Bot Context
 * Manages bots state and operations
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { botsAPI, chatAPI, analyticsAPI } from '../services/api';
import { setBotsCache, getBotsCache } from '../utils/storage';

const BotContext = createContext(null);

export const BotProvider = ({ children }) => {
  const [bots, setBots] = useState([]);
  const [selectedBot, setSelectedBot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalBots: 0,
    activeBots: 0,
    totalMessages: 0,
    totalUsers: 0,
  });

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const sessionIdRef = useRef(null);

  // ===============================
  // Bot Operations
  // ===============================

  /**
   * Fetch all bots
   */
  const fetchBots = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Try cache first if not forcing refresh
      if (!forceRefresh) {
        const cached = await getBotsCache();
        if (cached && cached.length > 0) {
          setBots(cached);
          updateStats(cached);
        }
      }

      // Fetch from server
      const response = await botsAPI.getAll();
      const botsData = response.data.bots || response.data || [];
      setBots(botsData);
      updateStats(botsData);

      // Update cache
      await setBotsCache(botsData);

      return { success: true, bots: botsData };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch bots';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Update stats from bots data
   */
  const updateStats = (botsData) => {
    const activeBots = botsData.filter(b => b.status === 'active').length;
    const totalMessages = botsData.reduce((sum, b) => sum + (b.messageCount || 0), 0);
    const totalUsers = botsData.reduce((sum, b) => sum + (b.userCount || 0), 0);

    setStats({
      totalBots: botsData.length,
      activeBots,
      totalMessages,
      totalUsers,
    });
  };

  /**
   * Fetch dashboard stats
   */
  const fetchDashboardStats = useCallback(async () => {
    try {
      const response = await analyticsAPI.getDashboard();
      if (response.data) {
        setStats(prev => ({
          ...prev,
          ...response.data,
        }));
      }
      return { success: true, stats: response.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Get single bot
   */
  const fetchBot = useCallback(async (botId) => {
    try {
      setLoading(true);
      setError(null);

      const response = await botsAPI.getById(botId);
      const botData = response.data.bot || response.data;
      setSelectedBot(botData);

      return { success: true, bot: botData };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to fetch bot';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create new bot
   */
  const createBot = useCallback(async (data) => {
    try {
      setLoading(true);
      setError(null);

      const response = await botsAPI.create(data);
      const newBot = response.data.bot || response.data;

      setBots(prev => [newBot, ...prev]);
      updateStats([newBot, ...bots]);
      await setBotsCache([newBot, ...bots]);

      return { success: true, bot: newBot };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to create bot';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [bots]);

  /**
   * Update bot
   */
  const updateBot = useCallback(async (botId, data) => {
    try {
      setLoading(true);
      setError(null);

      const response = await botsAPI.update(botId, data);
      const updatedBot = response.data.bot || response.data;

      setBots(prev => prev.map(b => b.id === botId ? updatedBot : b));
      if (selectedBot?.id === botId) {
        setSelectedBot(updatedBot);
      }

      return { success: true, bot: updatedBot };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update bot';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [selectedBot]);

  /**
   * Delete bot
   */
  const deleteBot = useCallback(async (botId) => {
    try {
      setLoading(true);
      setError(null);

      await botsAPI.delete(botId);

      const newBots = bots.filter(b => b.id !== botId);
      setBots(newBots);
      updateStats(newBots);

      if (selectedBot?.id === botId) {
        setSelectedBot(null);
      }

      return { success: true };
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to delete bot';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [bots, selectedBot]);

  /**
   * Search bots
   */
  const searchBots = useCallback((query) => {
    if (!query.trim()) return bots;
    const lowerQuery = query.toLowerCase();
    return bots.filter(bot =>
      bot.name.toLowerCase().includes(lowerQuery) ||
      bot.description?.toLowerCase().includes(lowerQuery)
    );
  }, [bots]);

  /**
   * Filter bots by status
   */
  const filterBotsByStatus = useCallback((status) => {
    if (status === 'all') return bots;
    return bots.filter(bot => bot.status === status);
  }, [bots]);

  // ===============================
  // Chat Operations
  // ===============================

  /**
   * Start new chat session
   */
  const startChatSession = useCallback((bot) => {
    setSelectedBot(bot);
    setMessages([]);
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Send message
   */
  const sendMessage = useCallback(async (content) => {
    if (!selectedBot || !content.trim()) return { success: false };

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setChatLoading(true);

    try {
      const response = await chatAPI.sendMessage(
        selectedBot.id,
        content.trim(),
        sessionIdRef.current
      );

      // Update user message status
      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'sent' } : m
        )
      );

      // Add bot response
      const botMessage = {
        id: `msg_${Date.now()}_bot`,
        role: 'assistant',
        content: response.data.message || response.data.reply || 'No response',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMessage]);

      return { success: true, message: botMessage };
    } catch (err) {
      // Update user message status to error
      setMessages(prev =>
        prev.map(m =>
          m.id === userMessage.id ? { ...m, status: 'error' } : m
        )
      );

      // Add error message
      const errorMessage = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);

      return { success: false, error: err.message };
    } finally {
      setChatLoading(false);
    }
  }, [selectedBot]);

  /**
   * Load chat history
   */
  const loadChatHistory = useCallback(async () => {
    if (!selectedBot) return { success: false };

    try {
      setChatLoading(true);
      const response = await chatAPI.getHistory(selectedBot.id, sessionIdRef.current);
      const history = response.data.messages || [];
      setMessages(history);
      return { success: true, messages: history };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setChatLoading(false);
    }
  }, [selectedBot]);

  /**
   * Clear chat
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // ===============================
  // Selection
  // ===============================

  const selectBot = useCallback((bot) => {
    setSelectedBot(bot);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBot(null);
    setMessages([]);
  }, []);

  const value = {
    // Bot state
    bots,
    selectedBot,
    loading,
    refreshing,
    error,
    stats,

    // Bot operations
    fetchBots,
    fetchBot,
    createBot,
    updateBot,
    deleteBot,
    searchBots,
    filterBotsByStatus,
    fetchDashboardStats,

    // Selection
    selectBot,
    clearSelection,

    // Chat state
    messages,
    chatLoading,

    // Chat operations
    startChatSession,
    sendMessage,
    loadChatHistory,
    clearChat,
  };

  return (
    <BotContext.Provider value={value}>
      {children}
    </BotContext.Provider>
  );
};

export const useBots = () => {
  const context = useContext(BotContext);
  if (!context) {
    throw new Error('useBots must be used within a BotProvider');
  }
  return context;
};

export default BotContext;
