/**
 * Survey Error Handling Components
 * Error boundary and error display components
 */

import React, { Component } from 'react';

// Error types with user-friendly messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: {
    title: 'Connection Problem',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    icon: 'wifi'
  },
  SERVER_ERROR: {
    title: 'Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    icon: 'server'
  },
  NOT_FOUND: {
    title: 'Not Found',
    message: 'The survey you are looking for does not exist or has been deleted.',
    icon: 'search'
  },
  UNAUTHORIZED: {
    title: 'Access Denied',
    message: 'You do not have permission to view this survey. Please log in or contact the administrator.',
    icon: 'lock'
  },
  VALIDATION_ERROR: {
    title: 'Invalid Data',
    message: 'Please check your input and try again.',
    icon: 'alert'
  },
  TIMEOUT: {
    title: 'Request Timeout',
    message: 'The request took too long. Please try again.',
    icon: 'clock'
  },
  RATE_LIMIT: {
    title: 'Too Many Requests',
    message: 'You have made too many requests. Please wait a moment and try again.',
    icon: 'shield'
  },
  DEFAULT: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred. Please try again.',
    icon: 'alert'
  }
};

// Get error type from error object or status code
export const getErrorType = (error) => {
  if (!error) return 'DEFAULT';

  // Network errors
  if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
    return 'NETWORK_ERROR';
  }

  // HTTP status codes
  const status = error.status || error.response?.status;
  if (status) {
    if (status === 401 || status === 403) return 'UNAUTHORIZED';
    if (status === 404) return 'NOT_FOUND';
    if (status === 408 || status === 504) return 'TIMEOUT';
    if (status === 422 || status === 400) return 'VALIDATION_ERROR';
    if (status === 429) return 'RATE_LIMIT';
    if (status >= 500) return 'SERVER_ERROR';
  }

  return 'DEFAULT';
};

// Icon components
const Icons = {
  wifi: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
    </svg>
  ),
  server: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  search: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  lock: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  alert: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  clock: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  shield: (
    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
};

// Error Display Component
export const ErrorDisplay = ({
  error,
  onRetry,
  onGoBack,
  className = ''
}) => {
  const errorType = getErrorType(error);
  const errorInfo = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.DEFAULT;
  const Icon = Icons[errorInfo.icon] || Icons.alert;

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div className="text-gray-300 dark:text-gray-600 mb-6">
        {Icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {errorInfo.title}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
        {error?.message || errorInfo.message}
      </p>
      <div className="flex items-center gap-3">
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Go Back
          </button>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// Inline Error Message
export const InlineError = ({ message, onDismiss }) => (
  <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <p className="flex-1 text-sm text-red-700 dark:text-red-400">{message}</p>
    {onDismiss && (
      <button
        onClick={onDismiss}
        className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>
);

// Form Field Error
export const FieldError = ({ message }) => (
  <p className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    {message}
  </p>
);

// Toast notification for errors
export const ErrorToast = ({ message, onClose, duration = 5000 }) => {
  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium">{message}</p>
        <button onClick={onClose} className="ml-2 hover:opacity-80">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Error Boundary Class Component
class SurveyErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Survey Error Boundary caught:', error, errorInfo);
    // You could send this to an error reporting service
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center">
          <ErrorDisplay
            error={this.state.error}
            onRetry={this.handleRetry}
            onGoBack={this.props.onGoBack}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default SurveyErrorBoundary;
