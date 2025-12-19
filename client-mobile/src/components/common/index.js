/**
 * Common Components Exports
 */

// Notification Badge
export {
  Badge,
  NotificationBadge,
  IconWithBadge,
  TabBarBadge,
  NotificationDot,
  PulsingBadge,
} from './NotificationBadge';

// Biometric Prompt
export {
  BiometricPrompt,
  BiometricButton,
  BiometricToggle,
  LockScreen,
} from './BiometricPrompt';

// Loading Screen
export {
  LoadingScreen,
  LoadingSpinner,
  LoadingOverlay,
  SkeletonLoader,
  SkeletonCard,
  SkeletonList,
  RefreshIndicator,
} from './LoadingScreen';

// Error Boundary
export {
  default as ErrorBoundary,
  ErrorView,
  NetworkErrorView,
  NotFoundView,
  PermissionDeniedView,
  MaintenanceView,
  EmptyStateView,
} from './ErrorBoundary';

// Offline Notice
export {
  OfflineNotice,
  OfflineIndicator,
  OfflineScreen,
  NetworkQualityIndicator,
  useNetworkStatus,
} from './OfflineNotice';

// Toast
export {
  Toast,
  ToastProvider,
  useToast,
  Snackbar,
  Alert,
} from './Toast';

// Confirm Modal
export {
  ConfirmModal,
  InputConfirmModal,
  ActionSheet,
  ConfirmProvider,
  useConfirm,
} from './ConfirmModal';
