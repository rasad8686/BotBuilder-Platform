import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Badge } from '../ui/Badge';

export default function StatisticalSignificance({
  significance,
  hasEnoughData,
  sampleSize,
  recommendedSize
}) {
  const { t } = useTranslation();

  const getSignificanceLevel = () => {
    if (significance >= 99) return { level: 'very_high', color: 'green' };
    if (significance >= 95) return { level: 'high', color: 'green' };
    if (significance >= 90) return { level: 'moderate', color: 'yellow' };
    if (significance >= 80) return { level: 'low', color: 'orange' };
    return { level: 'none', color: 'gray' };
  };

  const { level, color } = getSignificanceLevel();
  const progress = Math.min(100, sampleSize / recommendedSize * 100);

  const colorClasses = {
    green: {
      bg: 'bg-green-500',
      text: 'text-green-700 dark:text-green-400',
      bgLight: 'bg-green-100 dark:bg-green-900/30'
    },
    yellow: {
      bg: 'bg-yellow-500',
      text: 'text-yellow-700 dark:text-yellow-400',
      bgLight: 'bg-yellow-100 dark:bg-yellow-900/30'
    },
    orange: {
      bg: 'bg-orange-500',
      text: 'text-orange-700 dark:text-orange-400',
      bgLight: 'bg-orange-100 dark:bg-orange-900/30'
    },
    gray: {
      bg: 'bg-gray-400',
      text: 'text-gray-600 dark:text-gray-400',
      bgLight: 'bg-gray-100 dark:bg-gray-800'
    }
  };

  const colors = colorClasses[color];

  return (
    <div className="space-y-6">
      {/* Significance Meter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('abTests.statisticalSignificance', 'Statistical Significance')}
          </span>
          <span className={`text-lg font-bold ${colors.text}`}>
            {significance.toFixed(1)}%
          </span>
        </div>

        <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bg} transition-all duration-500`}
            style={{ width: `${Math.min(100, significance)}%` }}
          />
        </div>

        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              0-80%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              80-90%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              90-95%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              95%+
            </span>
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className={`p-4 rounded-lg ${colors.bgLight}`}>
        <div className="flex items-start gap-3">
          {level === 'very_high' || level === 'high' ? (
            <CheckCircle className={`w-5 h-5 ${colors.text} shrink-0 mt-0.5`} />
          ) : level === 'moderate' || level === 'low' ? (
            <Clock className={`w-5 h-5 ${colors.text} shrink-0 mt-0.5`} />
          ) : (
            <AlertCircle className={`w-5 h-5 ${colors.text} shrink-0 mt-0.5`} />
          )}

          <div>
            <p className={`font-medium ${colors.text}`}>
              {level === 'very_high' && t('abTests.significanceVeryHigh', 'Very High Confidence')}
              {level === 'high' && t('abTests.significanceHigh', 'High Confidence - Ready to declare winner')}
              {level === 'moderate' && t('abTests.significanceModerate', 'Moderate Confidence - Continue testing')}
              {level === 'low' && t('abTests.significanceLow', 'Low Confidence - More data needed')}
              {level === 'none' && t('abTests.significanceNone', 'Not enough data yet')}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {level === 'very_high' || level === 'high'
                ? t('abTests.significanceHighDesc', 'You can confidently declare a winner based on the current data.')
                : t('abTests.significanceLowDesc', 'Continue running the test to gather more data for reliable results.')
              }
            </p>
          </div>
        </div>
      </div>

      {/* Sample Size Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('abTests.sampleSize', 'Sample Size')}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {sampleSize.toLocaleString()} / {recommendedSize.toLocaleString()}
          </span>
        </div>

        <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {!hasEnoughData && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {t('abTests.needMoreSamples', 'Recommended: At least {{count}} visitors for reliable results', { count: recommendedSize })}
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {significance >= 95 ? (
              <CheckCircle className="w-8 h-8 text-green-500 mx-auto" />
            ) : (
              <Clock className="w-8 h-8 text-gray-400 mx-auto" />
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('abTests.significantResult', 'Significant Result')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {sampleSize.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('abTests.totalVisitors', 'Total Visitors')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(progress)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('abTests.dataComplete', 'Data Complete')}
          </p>
        </div>
      </div>
    </div>
  );
}
