/**
 * ComparisonWidget Component
 * Shows period comparison with percentage change indicators
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

/**
 * Format large numbers
 */
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

/**
 * Calculate percentage change
 */
const calculateChange = (current, previous) => {
  if (!previous || previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous * 100).toFixed(1);
};

/**
 * Metric comparison item
 */
const MetricItem = ({ label, current, previous, format = 'number', invertColors = false }) => {
  const change = parseFloat(calculateChange(current, previous));
  const isPositive = change > 0;
  const isNegative = change < 0;
  const isNeutral = change === 0;

  // For some metrics like "drop-off rate", positive change is bad
  const colorPositive = invertColors ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
  const colorNegative = invertColors ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  const formatValue = (val) => {
    if (format === 'percent') return `${val}%`;
    if (format === 'time') {
      if (val < 60) return `${Math.round(val)}s`;
      return `${Math.floor(val / 60)}m ${Math.round(val % 60)}s`;
    }
    return formatNumber(val);
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        {/* Previous value */}
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {formatValue(previous)}
        </span>

        <ArrowRight className="w-4 h-4 text-gray-400" />

        {/* Current value */}
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {formatValue(current)}
        </span>

        {/* Change indicator */}
        <div className={`flex items-center gap-1 min-w-[60px] ${
          isPositive ? colorPositive : isNegative ? colorNegative : 'text-gray-500'
        }`}>
          {isPositive && <TrendingUp className="w-4 h-4" />}
          {isNegative && <TrendingDown className="w-4 h-4" />}
          {isNeutral && <Minus className="w-4 h-4" />}
          <span className="text-sm font-medium">
            {isPositive && '+'}{change}%
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * ComparisonWidget Component
 * @param {Object} props
 * @param {Object} props.current - Current period data
 * @param {Object} props.previous - Previous period data
 * @param {string} props.currentLabel - Current period label (e.g., "This Week")
 * @param {string} props.previousLabel - Previous period label (e.g., "Last Week")
 * @param {Array} props.metrics - Custom metrics to show [{ key, label, format, invertColors }]
 */
export default function ComparisonWidget({
  current = {},
  previous = {},
  currentLabel,
  previousLabel,
  metrics
}) {
  const { t } = useTranslation();

  // Default metrics if not provided
  const defaultMetrics = [
    { key: 'impressions', label: t('analytics.impressions', 'Impressions'), format: 'number' },
    { key: 'starts', label: t('analytics.starts', 'Starts'), format: 'number' },
    { key: 'completions', label: t('analytics.completions', 'Completions'), format: 'number' },
    { key: 'completionRate', label: t('analytics.completionRate', 'Completion Rate'), format: 'percent' },
    { key: 'avgTime', label: t('analytics.avgTime', 'Avg Time'), format: 'time' }
  ];

  const metricsToShow = metrics || defaultMetrics;

  // Calculate summary
  const summary = useMemo(() => {
    let positive = 0;
    let negative = 0;

    metricsToShow.forEach(metric => {
      const change = parseFloat(calculateChange(
        current[metric.key] || 0,
        previous[metric.key] || 0
      ));
      if (change > 0 && !metric.invertColors) positive++;
      else if (change < 0 && !metric.invertColors) negative++;
      else if (change > 0 && metric.invertColors) negative++;
      else if (change < 0 && metric.invertColors) positive++;
    });

    return { positive, negative };
  }, [current, previous, metricsToShow]);

  // Empty state
  if (Object.keys(current).length === 0 && Object.keys(previous).length === 0) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-slate-800 rounded-lg text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('analytics.noComparisonData', 'Not enough data for comparison')}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {t('analytics.periodComparison', 'Period Comparison')}
          </h4>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {previousLabel || t('analytics.previousPeriod', 'Previous')}
            </span>
            <span className="text-gray-400">vs</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {currentLabel || t('analytics.currentPeriod', 'Current')}
            </span>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-3 mt-3">
          {summary.positive > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs">
              <TrendingUp className="w-3 h-3" />
              <span>{summary.positive} {t('analytics.improved', 'improved')}</span>
            </div>
          )}
          {summary.negative > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs">
              <TrendingDown className="w-3 h-3" />
              <span>{summary.negative} {t('analytics.declined', 'declined')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Metrics list */}
      <div className="p-4">
        {metricsToShow.map((metric) => (
          <MetricItem
            key={metric.key}
            label={metric.label}
            current={current[metric.key] || 0}
            previous={previous[metric.key] || 0}
            format={metric.format}
            invertColors={metric.invertColors}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {t('analytics.comparisonHint', 'Comparing same length periods for accurate analysis')}
        </p>
      </div>
    </div>
  );
}
