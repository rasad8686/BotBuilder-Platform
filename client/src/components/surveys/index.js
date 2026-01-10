/**
 * Surveys Components Index
 * Export all survey components
 */

// Analytics Components
export { default as NPSScoreCard } from './NPSScoreCard';
export { default as CSATScoreCard } from './CSATScoreCard';
export { default as ResponseRateCard } from './ResponseRateCard';
export { default as ResponseTrendChart } from './ResponseTrendChart';
export { default as NPSBreakdownChart } from './NPSBreakdownChart';
export { default as QuestionAnalytics } from './QuestionAnalytics';
export { default as RecentResponsesList } from './RecentResponsesList';
export { default as SurveyAnalyticsDashboard } from './SurveyAnalyticsDashboard';

// Loading & Skeletons
export {
  CardSkeleton,
  ScoreCardSkeleton,
  ChartSkeleton,
  ListItemSkeleton,
  ResponseListSkeleton,
  QuestionAnalyticsSkeleton,
  SurveyCardSkeleton,
  SurveyListSkeleton,
  DashboardSkeleton,
  LoadingButton,
  LoadingSpinner,
  FullPageLoading
} from './SurveySkeletons';

// Error Handling
export {
  default as SurveyErrorBoundary,
  ErrorDisplay,
  InlineError,
  FieldError,
  ErrorToast,
  ERROR_MESSAGES,
  getErrorType
} from './SurveyErrorBoundary';

// Empty States
export {
  NoSurveysEmptyState,
  NoResponsesEmptyState,
  NoAnalyticsEmptyState,
  NoQuestionsEmptyState,
  SearchNoResultsEmptyState,
  OnboardingEmptyState,
  SurveyCompletedState,
  SurveyArchivedState
} from './SurveyEmptyStates';

// Animations
export {
  FadeIn,
  SlideIn,
  ScaleIn,
  StaggerChildren,
  QuestionTransition,
  SuccessAnimation,
  ErrorAnimation,
  PulseAnimation,
  AnimatedProgressBar,
  AnimatedCounter,
  ShakeAnimation,
  ConfettiAnimation,
  AnimatedTooltip
} from './SurveyAnimations';

// Responsive Components
export {
  ResponsiveContainer,
  TouchButton,
  TouchRatingScale,
  TouchStarRating,
  TouchChoiceOption,
  TouchTextInput,
  SwipeableCard,
  MobileBottomSheet,
  ResponsiveGrid
} from './SurveyResponsive';

// Accessibility
export {
  FocusTrap,
  SkipLink,
  VisuallyHidden,
  LiveRegion,
  AccessibleProgress,
  AccessibleRatingScale,
  AccessibleChoiceGroup,
  AccessibleModal,
  useKeyboardShortcuts,
  FocusRing
} from './SurveyAccessibility';

// Performance
export {
  LazyCharts,
  SuspenseWrapper,
  LazyLoad,
  MemoizedListItem,
  MemoizedChart,
  useDebounce,
  useThrottle,
  usePrevious,
  surveyCache,
  useCachedFetch,
  VirtualList,
  useBatchedUpdates,
  usePerformanceMonitor
} from './SurveyPerformance';

// FAZ 5 - Configuration Components
export { default as SurveyTargeting } from './SurveyTargeting';
export { default as SurveyScheduler } from './SurveyScheduler';
export { default as SurveyDelivery } from './SurveyDelivery';
export { default as SurveyStyleEditor } from './SurveyStyleEditor';
export { default as SurveyNotifications } from './SurveyNotifications';
export { default as SurveyTranslations } from './SurveyTranslations';
export { default as SurveyIntegrations } from './SurveyIntegrations';
export { default as SurveyABTest } from './SurveyABTest';
export { default as SurveyTemplates } from './SurveyTemplates';

// Core Survey Components
export { default as SurveyCard } from './SurveyCard';
export { default as SurveyForm } from './SurveyForm';
export { default as SurveyPreview } from './SurveyPreview';
export { default as QuestionBuilder } from './QuestionBuilder';
export { default as QuestionTypeSelector } from './QuestionTypeSelector';
