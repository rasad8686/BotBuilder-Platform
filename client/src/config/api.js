// API Configuration
// Use relative URL in production (nginx proxy) or env variable
export const API_URL = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
  // Auth
  login: '/api/auth/login',
  register: '/api/auth/register',

  // Bots
  bots: '/api/bots',
  botById: (id) => `/api/bots/${id}`,
  botMessages: (id) => `/api/bots/${id}/messages`,

  // Billing
  subscription: '/api/billing/subscription',
  upgrade: '/api/billing/upgrade',
  cancel: '/api/billing/cancel',

  // Admin
  adminStats: '/api/admin/stats',
  adminAuditLogs: '/api/admin/audit-logs',
  adminHealth: '/api/admin/health',

  // API Tokens
  apiTokens: '/api/api-tokens',

  // Webhooks
  webhooks: '/api/webhooks',

  // Usage
  usage: '/api/usage',

  // Settings
  settings: '/api/settings',

  // Organizations
  organizations: '/api/organizations'
};

export default API_URL;
