/**
 * Services Exports
 */

// API
export { default as api } from './api';
export {
  authAPI,
  botsAPI,
  chatAPI,
  messagesAPI,
  analyticsAPI,
  userAPI,
  notificationsAPI,
  API_CONFIG,
} from './api';

// Auth Service
export { default as authService } from './authService';

// Bot Service
export { default as botService } from './botService';
export {
  getBots,
  getBot,
  createBot,
  updateBot,
  deleteBot,
  getBotStats,
  getBotFlow,
  updateBotFlow,
  duplicateBot,
  exportBot,
  importBot,
  searchBots,
  filterBotsByStatus,
  sortBots,
} from './botService';

// Chat Service
export { default as chatService } from './chatService';
export {
  connectWebSocket,
  disconnectWebSocket,
  sendMessage,
  getMessages,
  clearMessages,
  getSessions,
  deleteSession,
  createSessionId,
  isConnected,
  addEventListener,
  removeEventListener,
} from './chatService';

// User Service
export { default as userService } from './userService';
export {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  deleteAvatar,
  getSettings,
  updateSettings,
  getSubscription,
  deleteAccount,
  validateProfileData,
} from './userService';

// Analytics Service
export { default as analyticsService } from './analyticsService';
export {
  getDashboardStats,
  getBotAnalytics,
  getUsageHistory,
  getConversationStats,
  exportReport,
  calculateChange,
  formatChartData,
  aggregateByPeriod,
  getAvailablePeriods,
} from './analyticsService';

// Push Notifications Service
export { default as pushService } from './pushService';
export {
  registerForPushNotifications,
  getExpoPushToken,
  scheduleLocalNotification,
  cancelScheduledNotification,
  cancelAllNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getLastNotificationResponse,
  setBadgeCount,
  getBadgeCount,
  clearBadgeCount,
  setupAndroidNotificationChannel,
} from './pushService';

// Biometric Service
export { default as biometricService } from './biometricService';
export {
  checkBiometricSupport,
  authenticateWithBiometric,
  getBiometricType,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  toggleBiometric,
  getSecurityLevel,
} from './biometricService';
