import { useEffect, useState, useCallback } from 'react';
import { socketService } from '../services';
import { useAuthStore, useConversationStore, useBotStore } from '../store';
import type { Message, Conversation } from '../types';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addMessage = useConversationStore((state) => state.addMessage);
  const updateConversation = useConversationStore((state) => state.updateConversation);

  useEffect(() => {
    if (isAuthenticated) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }

    return () => {
      socketService.disconnect();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubConnect = socketService.onConnect(() => {
      setIsConnected(true);
    });

    const unsubDisconnect = socketService.onDisconnect(() => {
      setIsConnected(false);
    });

    const unsubMessage = socketService.onMessage((message: Message) => {
      addMessage(message);
    });

    const unsubConversation = socketService.onConversation((conversation: Conversation) => {
      updateConversation(conversation.id, conversation);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubMessage();
      unsubConversation();
    };
  }, [addMessage, updateConversation]);

  const joinConversation = useCallback((conversationId: string) => {
    socketService.joinConversation(conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketService.leaveConversation(conversationId);
  }, []);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    socketService.sendTyping(conversationId, isTyping);
  }, []);

  return {
    isConnected,
    joinConversation,
    leaveConversation,
    sendTyping,
  };
}

export function useBotSocket(botId: string) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    socketService.subscribeToBotUpdates(botId);

    const unsub = socketService.onBotStatus((data) => {
      if (data.botId === botId) {
        setStatus(data.status);
      }
    });

    return () => {
      socketService.unsubscribeFromBotUpdates(botId);
      unsub();
    };
  }, [botId]);

  return { status };
}
