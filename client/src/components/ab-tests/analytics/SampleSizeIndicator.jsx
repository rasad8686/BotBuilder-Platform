/**
 * SampleSizeIndicator Component
 * Displays sample size progress with recommendation
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * SampleSizeIndicator Component
 * @param {Object} props
 * @param {number} props.current - Current sample size
 * @param {number} props.recommended - Recommended sample size
 * @param {number} props.dailyRate - Average daily impressions (for time estimate)
 * @param {boolean} props.showEstimate - Show time estimate
 */
export default function SampleSizeIndicator({
  current = 0,
  recommended = 0,
  dailyRate = 0,
  showEstimate = true
}) {
  const { t } = useTranslation();

  const progress = useMemo(() => {
    if (recommended <= 0) return 100;
    return Math.min((current / recommended) * 100, 100);
  }, [current, recommended]);

  const isSufficient = current >= recommended;
  const remaining = Math.max(0, recommended - current);

  // Estimate days remaining
  const daysRemaining = useMemo(() => {
    if (isSufficient || dailyRate <= 0) return 0;
    return Math.ceil(remaining / dailyRate);
  }, [isSufficient, remaining, dailyRate]);

  const getProgressColor = () => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const StatusIcon = isSufficient ? CheckCircle : AlertTriangle;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${isSufficient ? 'text-green-500' : 'text-amber-500'}`} />
          <span className="font-medium text-gray-900 dark:text-white">
            {t('abTests.sampleSize', 'Sample Size')}
          </span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {progress.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Recommended marker */}
        {!isSufficient && (
          <div
            className="absolute top-0 w-0.5 h-3 bg-gray-400 dark:bg-gray-500"
            style={{ left: '100%' }}
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">
            {current.toLocaleString()}
          </span>
          {' / '}
          {recommended.toLocaleString()} {t('abTests.recommended', 'recommended')}
        </span>
      </div>

      {/* Status message */}
      {!isSufficient && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">
                {t('abTests.insufficientSample', 'Insufficient sample size')}
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                {t('abTests.needMoreData', `Need ${remaining.toLocaleString()} more impressions for reliable results.`)}
                {showEstimate && daysRemaining > 0 && (
                  <span className="block mt-1">
                    {t('abTests.estimatedTime', `Estimated ~${daysRemaining} more days at current rate.`)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {isSufficient && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="font-medium">
              {t('abTests.sufficientSample', 'Sufficient sample size for reliable results')}
            </span>
          </div>
        </div>
      )}

      {/* Tooltip hint */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {t('abTests.sampleSizeHint', 'Larger sample sizes lead to more accurate and statistically significant results.')}
      </p>
    </div>
  );
}
