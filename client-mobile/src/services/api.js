/**
 * API Service Layer
 * Axios instance with interceptors, token refresh, and error handling
 */
import axios from 'axios';
import { API_CONFIG, ERROR_MESSAGES } from '../config/constants';
import { getAuthToken, removeAuthToken, setAuthToken, getRefreshToken, setRefreshToken, removeRefreshToken } from '../utils/storage';

// Create axios instance
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_CONFIG.BASE_URL}/api/auth/refresh`, {
            refreshToken,
          });

          const { token: newToken, refreshToken: newRefreshToken } = response.data;

          await setAuthToken(newToken);
          if (newRefreshToken) {
            await setRefreshToken(newRefreshToken);
          }

          api.defaults.headers.common.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        await removeAuthToken();
        await removeRefreshToken();
        // Navigation to login will be handled by AuthContext
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    return Promise.reject(formatError(error));
  }
);

// Format error for consistent handling
const formatError = (error) => {
  if (!error.response) {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      status: 0,
      data: null,
    };
  }

  const { status, data } = error.response;

  let message = data?.message || data?.error || ERROR_MESSAGES.SERVER_ERROR;

  switch (status) {
    case 400:
      message = data?.message || ERROR_MESSAGES.VALIDATION_ERROR;
      break;
    case 401:
      message = ERROR_MESSAGES.UNAUTHORIZED;
      break;
    case 404:
      message = ERROR_MESSAGES.NOT_FOUND;
      break;
    case 429:
      message = ERROR_MESSAGES.RATE_LIMIT;
      break;
    case 500:
    case 502:
    case 503:
      message = ERROR_MESSAGES.SERVER_ERROR;
      break;
  }

  return {
    message,
    status,
    data: data,
  };
};

// Auth endpoints
export const authAPI = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }),

  register: (data) =>
    api.post('/api/auth/register', data),

  forgotPassword: (email) =>
    api.post('/api/auth/forgot-password', { email }),

  verifyCode: (email, code) =>
    api.post('/api/auth/verify-code', { email, code }),

  resetPassword: (token, password) =>
    api.post('/api/auth/reset-password', { token, password }),

  refreshToken: (refreshToken) =>
    api.post('/api/auth/refresh', { refreshToken }),

  getProfile: () =>
    api.get('/api/auth/me'),

  updateProfile: (data) =>
    api.put('/api/auth/profile', data),

  changePassword: (currentPassword, newPassword) =>
    api.put('/api/auth/password', { currentPassword, newPassword }),

  uploadAvatar: (formData) =>
    api.post('/api/auth/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteAccount: () =>
    api.delete('/api/auth/account'),
};

// Bots endpoints
export const botsAPI = {
  getAll: (params = {}) =>
    api.get('/api/bots', { params }),

  getById: (id) =>
    api.get(`/api/bots/${id}`),

  create: (data) =>
    api.post('/api/bots', data),

  update: (id, data) =>
    api.put(`/api/bots/${id}`, data),

  delete: (id) =>
    api.delete(`/api/bots/${id}`),

  getStats: (id) =>
    api.get(`/api/bots/${id}/stats`),

  getFlow: (id) =>
    api.get(`/api/bots/${id}/flow`),

  updateFlow: (id, flow) =>
    api.put(`/api/bots/${id}/flow`, { flow }),

  duplicate: (id) =>
    api.post(`/api/bots/${id}/duplicate`),

  export: (id) =>
    api.get(`/api/bots/${id}/export`),

  import: (data) =>
    api.post('/api/bots/import', data),
};

// Chat endpoints
export const chatAPI = {
  sendMessage: (botId, message, sessionId) =>
    api.post(`/api/bots/${botId}/chat`, { message, sessionId }),

  getHistory: (botId, sessionId, params = {}) =>
    api.get(`/api/bots/${botId}/chat/history`, { params: { sessionId, ...params } }),

  clearHistory: (botId, sessionId) =>
    api.delete(`/api/bots/${botId}/chat/history`, { params: { sessionId } }),

  getSessions: (botId) =>
    api.get(`/api/bots/${botId}/chat/sessions`),

  deleteSession: (botId, sessionId) =>
    api.delete(`/api/bots/${botId}/chat/sessions/${sessionId}`),
};

// Messages endpoints
export const messagesAPI = {
  getByBot: (botId, page = 1, limit = 20) =>
    api.get(`/api/messages/bot/${botId}`, { params: { page, limit } }),

  getById: (id) =>
    api.get(`/api/messages/${id}`),

  delete: (id) =>
    api.delete(`/api/messages/${id}`),

  search: (query, params = {}) =>
    api.get('/api/messages/search', { params: { query, ...params } }),
};

// Analytics endpoints
export const analyticsAPI = {
  getDashboard: () =>
    api.get('/api/analytics/dashboard'),

  getBotAnalytics: (botId, period = '7d') =>
    api.get(`/api/analytics/bot/${botId}`, { params: { period } }),

  getUsageHistory: (period = '30d') =>
    api.get('/api/analytics/usage', { params: { period } }),

  getConversationStats: (botId, period = '7d') =>
    api.get(`/api/analytics/bot/${botId}/conversations`, { params: { period } }),

  exportReport: (params) =>
    api.get('/api/analytics/export', { params, responseType: 'blob' }),
};

// User endpoints
export const userAPI = {
  getProfile: () =>
    api.get('/api/users/profile'),

  updateProfile: (data) =>
    api.put('/api/users/profile', data),

  changePassword: (currentPassword, newPassword) =>
    api.put('/api/users/password', { currentPassword, newPassword }),

  uploadAvatar: (formData) =>
    api.post('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getSettings: () =>
    api.get('/api/users/settings'),

  updateSettings: (settings) =>
    api.put('/api/users/settings', settings),

  getSubscription: () =>
    api.get('/api/users/subscription'),
};

// Notifications endpoints
export const notificationsAPI = {
  registerPushToken: (token, platform) =>
    api.post('/api/notifications/register', { token, platform }),

  unregisterPushToken: (token) =>
    api.delete('/api/notifications/unregister', { data: { token } }),

  getAll: (params = {}) =>
    api.get('/api/notifications', { params }),

  markAsRead: (id) =>
    api.put(`/api/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put('/api/notifications/read-all'),

  delete: (id) =>
    api.delete(`/api/notifications/${id}`),

  getUnreadCount: () =>
    api.get('/api/notifications/unread-count'),
};

export default api;
export { API_CONFIG };
