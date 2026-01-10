/**
 * Survey Skeleton Components
 * Loading states for survey components
 */

import React from 'react';

// Skeleton base component with animation
const SkeletonPulse = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

// Card Skeleton
export const CardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <SkeletonPulse className="h-4 w-24 mb-4" />
    <SkeletonPulse className="h-12 w-32 mb-4" />
    <SkeletonPulse className="h-4 w-full mb-2" />
    <SkeletonPulse className="h-4 w-3/4" />
  </div>
);

// Score Card Skeleton
export const ScoreCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div className="flex items-center justify-between mb-4">
      <SkeletonPulse className="h-4 w-20" />
      <SkeletonPulse className="h-4 w-12" />
    </div>
    <div className="text-center mb-6">
      <SkeletonPulse className="h-16 w-24 mx-auto mb-2" />
      <SkeletonPulse className="h-4 w-16 mx-auto" />
    </div>
    <SkeletonPulse className="h-4 w-full mb-6" />
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between">
          <SkeletonPulse className="h-4 w-32" />
          <SkeletonPulse className="h-4 w-16" />
        </div>
      ))}
    </div>
  </div>
);

// Chart Skeleton
export const ChartSkeleton = ({ height = 300 }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div className="flex items-center justify-between mb-6">
      <SkeletonPulse className="h-5 w-32" />
      <SkeletonPulse className="h-8 w-40" />
    </div>
    <SkeletonPulse className={`w-full`} style={{ height }} />
  </div>
);

// List Item Skeleton
export const ListItemSkeleton = () => (
  <div className="flex items-center gap-4 p-3">
    <SkeletonPulse className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1">
      <SkeletonPulse className="h-4 w-3/4 mb-2" />
      <SkeletonPulse className="h-3 w-1/2" />
    </div>
    <SkeletonPulse className="w-5 h-5 flex-shrink-0" />
  </div>
);

// Response List Skeleton
export const ResponseListSkeleton = ({ count = 5 }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div className="flex items-center justify-between mb-6">
      <SkeletonPulse className="h-5 w-36" />
      <SkeletonPulse className="h-4 w-16" />
    </div>
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Question Analytics Skeleton
export const QuestionAnalyticsSkeleton = ({ count = 3 }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <SkeletonPulse className="h-5 w-40 mb-6" />
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonPulse className="w-6 h-6 rounded-full" />
              <SkeletonPulse className="h-4 w-48" />
            </div>
            <SkeletonPulse className="h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Survey Card Skeleton
export const SurveyCardSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <SkeletonPulse className="h-5 w-48 mb-2" />
        <SkeletonPulse className="h-4 w-32" />
      </div>
      <SkeletonPulse className="h-6 w-16 rounded-full" />
    </div>
    <SkeletonPulse className="h-4 w-full mb-4" />
    <div className="flex items-center justify-between">
      <SkeletonPulse className="h-4 w-24" />
      <SkeletonPulse className="h-8 w-20" />
    </div>
  </div>
);

// Survey List Skeleton
export const SurveyListSkeleton = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <SurveyCardSkeleton key={i} />
    ))}
  </div>
);

// Full Dashboard Skeleton
export const DashboardSkeleton = () => (
  <div className="space-y-8">
    {/* Score Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ScoreCardSkeleton />
      <ScoreCardSkeleton />
      <ScoreCardSkeleton />
    </div>

    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartSkeleton height={300} />
      <ChartSkeleton height={300} />
    </div>

    {/* Question Analytics */}
    <QuestionAnalyticsSkeleton />

    {/* Recent Responses */}
    <ResponseListSkeleton />
  </div>
);

// Button with loading spinner
export const LoadingButton = ({
  loading = false,
  children,
  className = '',
  disabled = false,
  ...props
}) => (
  <button
    className={`relative inline-flex items-center justify-center ${className}`}
    disabled={loading || disabled}
    {...props}
  >
    {loading && (
      <svg
        className="absolute animate-spin h-5 w-5 text-current"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    )}
    <span className={loading ? 'opacity-0' : ''}>{children}</span>
  </button>
);

// Inline Loading Spinner
export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  return (
    <svg
      className={`animate-spin ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// Full page loading
export const FullPageLoading = ({ message = 'Loading...' }) => (
  <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="text-center">
      <LoadingSpinner size="xl" className="text-indigo-600 mx-auto mb-4" />
      <p className="text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  </div>
);

export default {
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
};
