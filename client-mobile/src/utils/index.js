/**
 * Utils Exports
 */

// Storage
export * from './storage';
export { storage, secureStorage } from './storage';

// Helpers
export * from './helpers';
export { default as helpers } from './helpers';

// Error Handler
export {
  AppError,
  NetworkError,
  APIError,
  AuthError,
  ValidationError,
  ErrorTypes,
  ErrorSeverity,
  parseError,
  getUserMessage,
  handleError,
  logError,
  getErrorLog,
  clearErrorLog,
  withErrorHandling,
  createErrorBoundaryHandler,
  retryWithBackoff,
  formatError,
  registerErrorHandler,
  unregisterErrorHandler,
  isNetworkError,
  isAuthError,
  isAPIError,
  isValidationError,
  setupGlobalErrorHandler,
} from './errorHandler';
