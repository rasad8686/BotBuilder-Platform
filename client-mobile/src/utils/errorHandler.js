/**
 * Error Handler Utility
 * Global error handling, logging, and reporting
 */

// Error types
export const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  AUTH: 'AUTH_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  STORAGE: 'STORAGE_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

// Error severity levels
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

/**
 * Custom App Error class
 */
export class AppError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, options = {}) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.userMessage = options.userMessage || message;
    this.timestamp = new Date().toISOString();
    this.recoverable = options.recoverable !== false;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Network Error
 */
export class NetworkError extends AppError {
  constructor(message = 'Network connection failed', options = {}) {
    super(message, ErrorTypes.NETWORK, {
      severity: ErrorSeverity.HIGH,
      userMessage: 'Unable to connect. Please check your internet connection.',
      recoverable: true,
      ...options,
    });
    this.name = 'NetworkError';
  }
}

/**
 * API Error
 */
export class APIError extends AppError {
  constructor(message, statusCode, options = {}) {
    super(message, ErrorTypes.API, {
      statusCode,
      severity: statusCode >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
      ...options,
    });
    this.name = 'APIError';
    this.response = options.response;
  }
}

/**
 * Auth Error
 */
export class AuthError extends AppError {
  constructor(message = 'Authentication failed', options = {}) {
    super(message, ErrorTypes.AUTH, {
      severity: ErrorSeverity.HIGH,
      userMessage: 'Your session has expired. Please log in again.',
      ...options,
    });
    this.name = 'AuthError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message, fields = {}, options = {}) {
    super(message, ErrorTypes.VALIDATION, {
      severity: ErrorSeverity.LOW,
      recoverable: true,
      ...options,
    });
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Error handlers registry
 */
const errorHandlers = new Map();

/**
 * Register a custom error handler
 */
export const registerErrorHandler = (errorType, handler) => {
  errorHandlers.set(errorType, handler);
};

/**
 * Unregister an error handler
 */
export const unregisterErrorHandler = (errorType) => {
  errorHandlers.delete(errorType);
};

/**
 * Parse error from various sources
 */
export const parseError = (error) => {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // Axios/fetch response error
  if (error.response) {
    const { status, data } = error.response;
    const message = data?.message || data?.error || error.message;

    if (status === 401 || status === 403) {
      return new AuthError(message, { statusCode: status });
    }

    return new APIError(message, status, {
      response: error.response,
      details: data,
    });
  }

  // Network error (no response)
  if (error.request || error.message === 'Network Error') {
    return new NetworkError(error.message);
  }

  // Validation error
  if (error.name === 'ValidationError' || error.errors) {
    return new ValidationError(error.message, error.errors || {});
  }

  // Generic error
  return new AppError(error.message || 'An unexpected error occurred', ErrorTypes.UNKNOWN, {
    details: { originalError: error },
  });
};

/**
 * Get user-friendly error message
 */
export const getUserMessage = (error) => {
  const parsedError = parseError(error);

  // Check for custom user message
  if (parsedError.userMessage) {
    return parsedError.userMessage;
  }

  // Default messages by type
  switch (parsedError.type) {
    case ErrorTypes.NETWORK:
      return 'Unable to connect. Please check your internet connection.';
    case ErrorTypes.AUTH:
      return 'Your session has expired. Please log in again.';
    case ErrorTypes.VALIDATION:
      return 'Please check your input and try again.';
    case ErrorTypes.PERMISSION:
      return 'You do not have permission to perform this action.';
    case ErrorTypes.API:
      if (parsedError.statusCode >= 500) {
        return 'Server error. Please try again later.';
      }
      return parsedError.message || 'Request failed. Please try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
};

/**
 * Error logger
 */
const errorLog = [];
const MAX_LOG_SIZE = 100;

export const logError = (error, context = {}) => {
  const parsedError = parseError(error);
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: parsedError.type,
    message: parsedError.message,
    severity: parsedError.severity,
    stack: parsedError.stack,
    context,
  };

  // Add to local log
  errorLog.unshift(logEntry);
  if (errorLog.length > MAX_LOG_SIZE) {
    errorLog.pop();
  }

  // Console log in development
  if (__DEV__) {
    console.error('[ErrorHandler]', logEntry);
  }

  // Report to external service in production
  if (!__DEV__ && parsedError.severity !== ErrorSeverity.LOW) {
    reportError(logEntry);
  }

  return logEntry;
};

/**
 * Report error to external service
 */
const reportError = async (logEntry) => {
  // Implement your error reporting service here
  // Example: Sentry, Bugsnag, Firebase Crashlytics, etc.
  try {
    // await errorReportingService.report(logEntry);
    console.log('[ErrorHandler] Error reported:', logEntry.type);
  } catch (reportError) {
    console.error('[ErrorHandler] Failed to report error:', reportError);
  }
};

/**
 * Get error log
 */
export const getErrorLog = () => [...errorLog];

/**
 * Clear error log
 */
export const clearErrorLog = () => {
  errorLog.length = 0;
};

/**
 * Handle error with registered handlers
 */
export const handleError = (error, options = {}) => {
  const parsedError = parseError(error);
  const { silent = false, context = {}, showToast, onError } = options;

  // Log the error
  logError(parsedError, context);

  // Check for registered handler
  const handler = errorHandlers.get(parsedError.type);
  if (handler) {
    handler(parsedError, options);
    return parsedError;
  }

  // Call custom error callback
  if (onError) {
    onError(parsedError);
  }

  // Show toast if provided
  if (showToast && !silent) {
    showToast.error(getUserMessage(parsedError));
  }

  return parsedError;
};

/**
 * Wrap async function with error handling
 */
export const withErrorHandling = (asyncFn, options = {}) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      handleError(error, options);
      throw parseError(error);
    }
  };
};

/**
 * Create error boundary handler
 */
export const createErrorBoundaryHandler = (options = {}) => {
  return (error, errorInfo) => {
    logError(error, {
      componentStack: errorInfo?.componentStack,
      ...options.context,
    });

    if (options.onError) {
      options.onError(error, errorInfo);
    }
  };
};

/**
 * Retry helper with error handling
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => error.type === ErrorTypes.NETWORK,
    onRetry,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseError(error);

      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      if (onRetry) {
        onRetry(attempt + 1, delay, lastError);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

/**
 * Format error for display
 */
export const formatError = (error) => {
  const parsedError = parseError(error);

  return {
    title: getErrorTitle(parsedError),
    message: getUserMessage(parsedError),
    type: parsedError.type,
    recoverable: parsedError.recoverable,
    code: parsedError.code,
  };
};

/**
 * Get error title by type
 */
const getErrorTitle = (error) => {
  switch (error.type) {
    case ErrorTypes.NETWORK:
      return 'Connection Error';
    case ErrorTypes.AUTH:
      return 'Authentication Error';
    case ErrorTypes.VALIDATION:
      return 'Validation Error';
    case ErrorTypes.PERMISSION:
      return 'Permission Denied';
    case ErrorTypes.API:
      return 'Request Failed';
    default:
      return 'Error';
  }
};

/**
 * Check if error is of specific type
 */
export const isNetworkError = (error) => parseError(error).type === ErrorTypes.NETWORK;
export const isAuthError = (error) => parseError(error).type === ErrorTypes.AUTH;
export const isAPIError = (error) => parseError(error).type === ErrorTypes.API;
export const isValidationError = (error) => parseError(error).type === ErrorTypes.VALIDATION;

/**
 * Global error handler setup for uncaught errors
 */
export const setupGlobalErrorHandler = () => {
  // Handle uncaught JS errors
  const originalHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    logError(error, { isFatal, source: 'global' });

    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });

  // Handle unhandled promise rejections
  const rejectionTracking = require('promise/setimmediate/rejection-tracking');
  rejectionTracking.enable({
    allRejections: true,
    onUnhandled: (id, error) => {
      logError(error, { id, source: 'unhandledRejection' });
    },
  });
};

export default {
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
};
