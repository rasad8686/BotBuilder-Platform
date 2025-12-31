// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user' | 'manager';
  organizationId?: string;
  createdAt: string;
  lastLogin?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  language: string;
  biometricEnabled: boolean;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  botAlerts: boolean;
  conversationAlerts: boolean;
  weeklyReport: boolean;
}

// Auth Types
export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Bot Types
export interface Bot {
  id: string;
  name: string;
  description?: string;
  status: BotStatus;
  platform: BotPlatform;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  organizationId?: string;
  config: BotConfig;
  stats: BotStats;
}

export type BotStatus = 'active' | 'inactive' | 'error' | 'maintenance';
export type BotPlatform = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'web' | 'custom';

export interface BotConfig {
  welcomeMessage?: string;
  fallbackMessage?: string;
  aiEnabled: boolean;
  aiModel?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  language: string;
  timezone: string;
}

export interface BotStats {
  totalConversations: number;
  activeConversations: number;
  totalMessages: number;
  avgResponseTime: number;
  satisfactionScore: number;
  uptime: number;
}

// Conversation Types
export interface Conversation {
  id: string;
  botId: string;
  botName: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  status: ConversationStatus;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  lastMessage?: Message;
  tags?: string[];
  rating?: number;
}

export type ConversationStatus = 'active' | 'closed' | 'pending' | 'escalated';

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  type: MessageType;
  sender: MessageSender;
  timestamp: string;
  status: MessageStatus;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
}

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'video' | 'location' | 'card';
export type MessageSender = 'user' | 'bot' | 'agent';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

// Analytics Types
export interface AnalyticsData {
  overview: OverviewStats;
  messagesByDay: ChartData[];
  conversationsByDay: ChartData[];
  botPerformance: BotPerformance[];
  topIntents: IntentData[];
  userSatisfaction: SatisfactionData;
  peakHours: HourlyData[];
}

export interface OverviewStats {
  totalConversations: number;
  totalMessages: number;
  avgResponseTime: number;
  satisfactionScore: number;
  activeUsers: number;
  activeBots: number;
  conversationGrowth: number;
  messageGrowth: number;
}

export interface ChartData {
  date: string;
  value: number;
  label?: string;
}

export interface BotPerformance {
  botId: string;
  botName: string;
  conversations: number;
  messages: number;
  avgResponseTime: number;
  satisfaction: number;
}

export interface IntentData {
  intent: string;
  count: number;
  percentage: number;
}

export interface SatisfactionData {
  excellent: number;
  good: number;
  average: number;
  poor: number;
}

export interface HourlyData {
  hour: number;
  conversations: number;
  messages: number;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  logo?: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  memberCount: number;
  botLimit: number;
  messageLimit: number;
  createdAt: string;
}

// Activity Types
export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  botId?: string;
  botName?: string;
  userId?: string;
  userName?: string;
  metadata?: Record<string, unknown>;
}

export type ActivityType =
  | 'bot_created'
  | 'bot_started'
  | 'bot_stopped'
  | 'bot_error'
  | 'conversation_started'
  | 'conversation_closed'
  | 'user_joined'
  | 'settings_updated'
  | 'escalation';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Dashboard: undefined;
  Bots: undefined;
  BotDetail: { botId: string };
  BotSettings: { botId: string };
  CreateBot: undefined;
  Conversations: undefined;
  ConversationDetail: { conversationId: string };
  Analytics: undefined;
  Settings: undefined;
  Profile: undefined;
  Notifications: undefined;
  // Voice screens
  VoiceBots: undefined;
  VoiceCall: { botId: string; botName: string };
  // Clone screens
  Clones: undefined;
  CloneDetail: { cloneId: string };
  // Plugin screens
  Plugins: undefined;
  PluginDetail: { pluginId: string };
  // Settings screens
  ChangePassword: undefined;
  HelpCenter: undefined;
};
