import React, { Suspense } from 'react';

/**
 * Loading Spinner Component
 * Displayed while lazy-loaded components are loading
 */
function LoadingSpinner() {
  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900"
      role="status"
      aria-busy="true"
      aria-label="Loading application"
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="relative" aria-hidden="true">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
          <div className="absolute top-0 left-0 w-12 h-12 border-4 border-blue-600 dark:border-blue-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium" aria-live="polite">Loading...</p>
      </div>
    </div>
  );
}

/**
 * Page Loading Component (for full page lazy loads)
 */
function PageLoading() {
  return (
    <div
      className="flex items-center justify-center min-h-[60vh]"
      role="status"
      aria-busy="true"
      aria-label="Loading page content"
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="relative" aria-hidden="true">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-600 dark:border-blue-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-600 dark:text-gray-400 font-medium" aria-live="polite">Loading page...</p>
      </div>
    </div>
  );
}

/**
 * Suspense wrapper for lazy-loaded components
 * @param {React.ComponentType} Component - Lazy loaded component
 * @param {React.ReactNode} fallback - Optional custom fallback
 */
function LazyLoadWrapper({ children, fallback = <PageLoading /> }) {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
}

/**
 * Higher-order component for lazy loading with Suspense
 * @param {Function} importFn - Dynamic import function
 * @param {React.ReactNode} fallback - Optional custom fallback
 */
function withLazyLoad(importFn, fallback = <PageLoading />) {
  const LazyComponent = React.lazy(importFn);

  return function LazyWrapper(props) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export { LoadingSpinner, PageLoading, LazyLoadWrapper, withLazyLoad };
export default LazyLoadWrapper;
