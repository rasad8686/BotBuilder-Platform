import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { WS_URL } from '../config/constants';
import type { Message, Conversation } from '../types';

type MessageHandler = (message: Message) => void;
type ConversationHandler = (conversation: Conversation) => void;
type BotStatusHandler = (data: { botId: string; status: string }) => void;
type ConnectionHandler = () => void;

class SocketService {
  private socket: Socket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private conversationHandlers: ConversationHandler[] = [];
  private botStatusHandlers: BotStatusHandler[] = [];
  private connectHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: ConnectionHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const token = await SecureStore.getItemAsync('token');
    if (!token) {
      console.log('No token available for socket connection');
      return;
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0;
      this.connectHandlers.forEach((handler) => handler());
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.disconnectHandlers.forEach((handler) => handler());
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
    });

    // Message events
    this.socket.on('message:new', (message: Message) => {
      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.socket.on('message:updated', (message: Message) => {
      this.messageHandlers.forEach((handler) => handler(message));
    });

    // Conversation events
    this.socket.on('conversation:new', (conversation: Conversation) => {
      this.conversationHandlers.forEach((handler) => handler(conversation));
    });

    this.socket.on('conversation:updated', (conversation: Conversation) => {
      this.conversationHandlers.forEach((handler) => handler(conversation));
    });

    // Bot events
    this.socket.on('bot:status', (data: { botId: string; status: string }) => {
      this.botStatusHandlers.forEach((handler) => handler(data));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Subscribe to conversation
  joinConversation(conversationId: string): void {
    this.socket?.emit('conversation:join', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('conversation:leave', conversationId);
  }

  // Subscribe to bot updates
  subscribeToBotUpdates(botId: string): void {
    this.socket?.emit('bot:subscribe', botId);
  }

  unsubscribeFromBotUpdates(botId: string): void {
    this.socket?.emit('bot:unsubscribe', botId);
  }

  // Send typing indicator
  sendTyping(conversationId: string, isTyping: boolean): void {
    this.socket?.emit('typing', { conversationId, isTyping });
  }

  // Event handlers
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  onConversation(handler: ConversationHandler): () => void {
    this.conversationHandlers.push(handler);
    return () => {
      this.conversationHandlers = this.conversationHandlers.filter((h) => h !== handler);
    };
  }

  onBotStatus(handler: BotStatusHandler): () => void {
    this.botStatusHandlers.push(handler);
    return () => {
      this.botStatusHandlers = this.botStatusHandlers.filter((h) => h !== handler);
    };
  }

  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.push(handler);
    return () => {
      this.connectHandlers = this.connectHandlers.filter((h) => h !== handler);
    };
  }

  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.push(handler);
    return () => {
      this.disconnectHandlers = this.disconnectHandlers.filter((h) => h !== handler);
    };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
