/**
 * TestDurationCard Component
 * Shows test duration with progress and estimates
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Calendar, Target, AlertCircle } from 'lucide-react';

/**
 * Format duration
 */
const formatDuration = (startDate, endDate = new Date()) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (diffDays === 0) {
    return `${diffHours} hours`;
  } else if (diffDays === 1) {
    return `1 day ${diffHours}h`;
  } else {
    return `${diffDays} days`;
  }
};

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * TestDurationCard Component
 * @param {Object} props
 * @param {string} props.startDate - Test start date
 * @param {string} props.endDate - Test end date (optional, for completed tests)
 * @param {string} props.targetEndDate - Planned end date
 * @param {number} props.minDuration - Minimum required duration in days
 * @param {string} props.status - Test status (running, completed, paused)
 */
export default function TestDurationCard({
  startDate,
  endDate,
  targetEndDate,
  minDuration = 7,
  status = 'running'
}) {
  const { t } = useTranslation();

  const duration = useMemo(() => {
    if (!startDate) return null;

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date();
    const target = targetEndDate ? new Date(targetEndDate) : null;
    const minEnd = new Date(start);
    minEnd.setDate(minEnd.getDate() + minDuration);

    const runningDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const remainingDays = target ? Math.ceil((target - end) / (1000 * 60 * 60 * 24)) : null;
    const progress = target
      ? Math.min(((end - start) / (target - start)) * 100, 100)
      : Math.min((runningDays / minDuration) * 100, 100);

    const meetsMinDuration = runningDays >= minDuration;

    return {
      start,
      end,
      target,
      minEnd,
      runningDays,
      remainingDays,
      progress,
      meetsMinDuration,
      formatted: formatDuration(start, end)
    };
  }, [startDate, endDate, targetEndDate, minDuration]);

  if (!duration) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
        <div className="text-center text-gray-500 dark:text-gray-400">
          {t('abTests.noDurationData', 'No duration data available')}
        </div>
      </div>
    );
  }

  const isRunning = status === 'running';
  const isCompleted = status === 'completed';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          {t('abTests.testDuration', 'Test Duration')}
        </h4>
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          isRunning
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : isCompleted
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Duration display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-gray-900 dark:text-white">
          {duration.formatted}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {isRunning && t('abTests.andCounting', 'and counting...')}
          {isCompleted && t('abTests.totalDuration', 'total duration')}
        </div>
      </div>

      {/* Progress bar */}
      {isRunning && duration.target && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>{t('abTests.progress', 'Progress')}</span>
            <span>{duration.progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${duration.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">
            {t('abTests.started', 'Started')}:
          </span>
          <span className="font-medium text-gray-900 dark:text-white">
            {formatDate(duration.start)}
          </span>
        </div>

        {isCompleted && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">
              {t('abTests.ended', 'Ended')}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatDate(duration.end)}
            </span>
          </div>
        )}

        {isRunning && duration.target && (
          <div className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">
              {t('abTests.targetEnd', 'Target end')}:
            </span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatDate(duration.target)}
              {duration.remainingDays !== null && duration.remainingDays > 0 && (
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  ({duration.remainingDays} days left)
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Minimum duration warning */}
      {isRunning && !duration.meetsMinDuration && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">
                {t('abTests.minDurationWarning', 'Minimum duration not met')}
              </p>
              <p className="mt-1">
                {t('abTests.minDurationDescription',
                  `Run for at least ${minDuration} days for statistically reliable results. ${minDuration - duration.runningDays} more days needed.`
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success indicator */}
      {duration.meetsMinDuration && (
        <div className="mt-4 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              {t('abTests.minDurationMet', 'Minimum duration requirement met')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
