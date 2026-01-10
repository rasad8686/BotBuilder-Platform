import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  XCircle,
  FileQuestion,
  Search,
  Inbox,
  FolderOpen,
  RefreshCw,
  Wifi,
  WifiOff,
  ServerCrash,
  Lock
} from 'lucide-react';

/**
 * Loading Spinner Component
 */
const Spinner = forwardRef(({
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const sizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <Loader2
      ref={ref}
      className={`animate-spin text-purple-600 dark:text-purple-400 ${sizes[size]} ${className}`}
      {...props}
    />
  );
});

Spinner.displayName = 'Spinner';

/**
 * Loading State Component - Full page or section loading
 */
const LoadingState = forwardRef(({
  title = 'Loading...',
  description,
  size = 'md',
  fullPage = false,
  className = '',
  ...props
}, ref) => {
  const spinnerSizes = {
    sm: 'lg',
    md: 'xl',
    lg: 'xl'
  };

  const titleSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div
      ref={ref}
      className={`
        flex flex-col items-center justify-center
        ${fullPage ? 'min-h-screen' : 'py-16'}
        ${className}
      `}
      role="status"
      aria-live="polite"
      {...props}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center text-center"
      >
        <Spinner size={spinnerSizes[size]} className="mb-4" />
        <p className={`font-medium text-gray-900 dark:text-white ${titleSizes[size]}`}>
          {title}
        </p>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {description}
          </p>
        )}
      </motion.div>
    </div>
  );
});

LoadingState.displayName = 'LoadingState';

/**
 * Skeleton Loading Component
 */
const Skeleton = forwardRef(({
  width,
  height = '1rem',
  variant = 'text',
  className = '',
  ...props
}, ref) => {
  const variants = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-xl'
  };

  return (
    <div
      ref={ref}
      className={`
        bg-gray-200 dark:bg-slate-700
        animate-pulse
        ${variants[variant]}
        ${className}
      `}
      style={{
        width: width || '100%',
        height
      }}
      aria-hidden="true"
      {...props}
    />
  );
});

Skeleton.displayName = 'Skeleton';

/**
 * Card Skeleton - Pre-built skeleton for cards
 */
const CardSkeleton = forwardRef(({
  lines = 3,
  showAvatar = false,
  showImage = false,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`
      bg-white dark:bg-slate-800
      border border-gray-200 dark:border-slate-700
      rounded-xl p-6
      ${className}
    `}
    {...props}
  >
    {showImage && (
      <Skeleton variant="rectangular" height="120px" className="mb-4" />
    )}
    <div className="flex items-center gap-3">
      {showAvatar && (
        <Skeleton variant="circular" width="40px" height="40px" />
      )}
      <div className="flex-1">
        <Skeleton height="1.25rem" width="60%" className="mb-2" />
        <Skeleton height="0.875rem" width="40%" />
      </div>
    </div>
    {lines > 0 && (
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            height="0.875rem"
            width={i === lines - 1 ? '70%' : '100%'}
          />
        ))}
      </div>
    )}
  </div>
));

CardSkeleton.displayName = 'CardSkeleton';

/**
 * Table Skeleton - Pre-built skeleton for tables
 */
const TableSkeleton = forwardRef(({
  rows = 5,
  columns = 4,
  showHeader = true,
  className = '',
  ...props
}, ref) => (
  <div
    ref={ref}
    className={`
      bg-white dark:bg-slate-800
      border border-gray-200 dark:border-slate-700
      rounded-xl overflow-hidden
      ${className}
    `}
    {...props}
  >
    {showHeader && (
      <div className="px-4 py-3 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height="0.875rem" width={`${100 / columns - 2}%`} />
          ))}
        </div>
      </div>
    )}
    <div className="divide-y divide-gray-200 dark:divide-slate-700">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-4 py-3 flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height="0.875rem" width={`${100 / columns - 2}%`} />
          ))}
        </div>
      ))}
    </div>
  </div>
));

TableSkeleton.displayName = 'TableSkeleton';

/**
 * Empty State Component
 */
const EmptyState = forwardRef(({
  icon: Icon = Inbox,
  title = 'No data',
  description,
  action,
  size = 'md',
  className = '',
  ...props
}, ref) => {
  const iconSizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        flex flex-col items-center justify-center
        py-16 px-4 text-center
        ${className}
      `}
      {...props}
    >
      <div className="mb-4 p-4 rounded-full bg-gray-100 dark:bg-slate-800">
        <Icon className={`${iconSizes[size]} text-gray-400 dark:text-gray-500`} />
      </div>
      <h3 className={`font-semibold text-gray-900 dark:text-white ${titleSizes[size]}`}>
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </motion.div>
  );
});

EmptyState.displayName = 'EmptyState';

/**
 * Pre-built Empty States
 */
const NoResultsState = (props) => (
  <EmptyState
    icon={Search}
    title="No results found"
    description="Try adjusting your search or filters to find what you're looking for."
    {...props}
  />
);

const NoDataState = (props) => (
  <EmptyState
    icon={FolderOpen}
    title="No data yet"
    description="Get started by creating your first item."
    {...props}
  />
);

const NoNotificationsState = (props) => (
  <EmptyState
    icon={Inbox}
    title="All caught up!"
    description="You have no new notifications."
    {...props}
  />
);

/**
 * Error State Component
 */
const ErrorState = forwardRef(({
  icon: Icon = AlertCircle,
  title = 'Something went wrong',
  description = 'An error occurred while loading. Please try again.',
  error,
  onRetry,
  retryText = 'Try again',
  size = 'md',
  fullPage = false,
  className = '',
  ...props
}, ref) => {
  const iconSizes = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        flex flex-col items-center justify-center
        ${fullPage ? 'min-h-screen' : 'py-16'} px-4 text-center
        ${className}
      `}
      role="alert"
      {...props}
    >
      <div className="mb-4 p-4 rounded-full bg-red-100 dark:bg-red-900/30">
        <Icon className={`${iconSizes[size]} text-red-500 dark:text-red-400`} />
      </div>
      <h3 className={`font-semibold text-gray-900 dark:text-white ${titleSizes[size]}`}>
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {description}
        </p>
      )}
      {error && process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400 text-left max-w-md overflow-auto">
          {error.message || String(error)}
        </pre>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="
            mt-6 inline-flex items-center gap-2
            px-4 py-2 text-sm font-medium rounded-lg
            bg-purple-600 text-white hover:bg-purple-700
            transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2
          "
        >
          <RefreshCw className="w-4 h-4" />
          {retryText}
        </button>
      )}
    </motion.div>
  );
});

ErrorState.displayName = 'ErrorState';

/**
 * Pre-built Error States
 */
const NetworkErrorState = (props) => (
  <ErrorState
    icon={WifiOff}
    title="Connection lost"
    description="Please check your internet connection and try again."
    {...props}
  />
);

const ServerErrorState = (props) => (
  <ErrorState
    icon={ServerCrash}
    title="Server error"
    description="Our servers are experiencing issues. Please try again later."
    {...props}
  />
);

const NotFoundState = (props) => (
  <ErrorState
    icon={FileQuestion}
    title="Page not found"
    description="The page you're looking for doesn't exist or has been moved."
    {...props}
  />
);

const AccessDeniedState = (props) => (
  <ErrorState
    icon={Lock}
    title="Access denied"
    description="You don't have permission to view this content."
    {...props}
  />
);

/**
 * Inline Loading - For buttons or small areas
 */
const InlineLoading = forwardRef(({
  text = 'Loading...',
  className = '',
  ...props
}, ref) => (
  <span
    ref={ref}
    className={`inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}
    {...props}
  >
    <Spinner size="sm" />
    <span className="text-sm">{text}</span>
  </span>
));

InlineLoading.displayName = 'InlineLoading';

/**
 * Progress Bar Component
 */
const ProgressBar = forwardRef(({
  value = 0,
  max = 100,
  size = 'md',
  variant = 'primary',
  showLabel = false,
  animated = true,
  className = '',
  ...props
}, ref) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  const variants = {
    primary: 'bg-purple-600 dark:bg-purple-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  return (
    <div
      ref={ref}
      className={`w-full ${className}`}
      {...props}
    >
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-sm text-gray-500 dark:text-gray-400">Progress</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        className={`w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden ${sizes[size]}`}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <motion.div
          className={`h-full rounded-full ${variants[variant]}`}
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';

export {
  Spinner,
  LoadingState,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  EmptyState,
  NoResultsState,
  NoDataState,
  NoNotificationsState,
  ErrorState,
  NetworkErrorState,
  ServerErrorState,
  NotFoundState,
  AccessDeniedState,
  InlineLoading,
  ProgressBar
};
