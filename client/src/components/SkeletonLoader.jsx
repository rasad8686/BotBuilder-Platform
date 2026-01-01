/**
 * Skeleton Loader Components
 * Animated placeholders for loading states
 */

export const SkeletonText = ({ lines = 3, className = '' }) => (
  <div className={className} role="status" aria-busy="true" aria-label="Loading text content">
    <span className="sr-only">Loading...</span>
    {Array(lines).fill(0).map((_, i) => (
      <div
        key={i}
        className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-2"
        style={{ width: `${Math.random() * 40 + 60}%` }}
        aria-hidden="true"
      />
    ))}
  </div>
);

export const SkeletonCard = ({ className = '' }) => (
  <div
    className={`p-4 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 ${className}`}
    role="status"
    aria-busy="true"
    aria-label="Loading card content"
  >
    <span className="sr-only">Loading...</span>
    <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-3/4 mb-4" aria-hidden="true" />
    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-full mb-2" aria-hidden="true" />
    <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-5/6" aria-hidden="true" />
  </div>
);

export const SkeletonTable = ({ rows = 5, cols = 4, className = '' }) => (
  <div
    className={`border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden ${className}`}
    role="status"
    aria-busy="true"
    aria-label="Loading table content"
  >
    <span className="sr-only">Loading table...</span>
    {/* Header */}
    <div className="flex bg-gray-100 dark:bg-slate-800 p-3 gap-4" aria-hidden="true">
      {Array(cols).fill(0).map((_, i) => (
        <div key={i} className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse flex-1" />
      ))}
    </div>
    {/* Rows */}
    {Array(rows).fill(0).map((_, rowIndex) => (
      <div key={rowIndex} className="flex p-3 gap-4 border-t border-gray-200 dark:border-slate-700" aria-hidden="true">
        {Array(cols).fill(0).map((_, colIndex) => (
          <div
            key={colIndex}
            className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse flex-1"
            style={{ width: `${Math.random() * 30 + 70}%` }}
          />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonDashboard = () => (
  <div className="p-6 space-y-6" role="status" aria-busy="true" aria-label="Loading dashboard">
    <span className="sr-only">Loading dashboard...</span>
    {/* Stats Cards Row */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array(4).fill(0).map((_, i) => (
        <div key={i} className="p-6 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
          <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/2 mb-3" />
          <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-3/4 mb-2" />
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/3" />
        </div>
      ))}
    </div>

    {/* Chart Section */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="p-6 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/3 mb-4" />
        <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
      <div className="p-6 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
        <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/3 mb-4" />
        <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    </div>

    {/* Activity Section */}
    <div className="p-6 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
      <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/4 mb-4" />
      <div className="space-y-3">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-10 w-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default {
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonDashboard
};
