/**
 * StepAnalyticsCard Component
 * Individual step metrics card with mini trend chart
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, Eye, CheckCircle, LogOut } from 'lucide-react';

/**
 * Format time duration
 */
const formatTime = (seconds) => {
  if (!seconds || seconds === 0) return '-';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
};

/**
 * Mini sparkline chart
 */
const MiniChart = ({ data, dataKey, color }) => {
  if (!data || data.length < 2) return null;

  return (
    <div className="h-8 w-20">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#gradient-${dataKey})`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * StepAnalyticsCard Component
 * @param {Object} props
 * @param {number} props.stepNumber - Step order number
 * @param {string} props.title - Step title
 * @param {number} props.views - Total views
 * @param {number} props.completions - Completions count
 * @param {number} props.dropOffs - Drop-offs count
 * @param {Object} props.timeStats - { avg, min, max } in seconds
 * @param {Array} props.trend - Daily trend data [{ date, views, completions }]
 * @param {boolean} props.isHighlighted - Highlight as problematic step
 * @param {Function} props.onClick - Click handler
 */
export default function StepAnalyticsCard({
  stepNumber,
  title,
  views = 0,
  completions = 0,
  dropOffs = 0,
  timeStats = {},
  trend = [],
  isHighlighted = false,
  onClick
}) {
  const { t } = useTranslation();

  // Calculate metrics
  const metrics = useMemo(() => {
    const completionRate = views > 0 ? ((completions / views) * 100).toFixed(1) : 0;
    const dropOffRate = views > 0 ? ((dropOffs / views) * 100).toFixed(1) : 0;

    // Calculate trend direction
    let trendDirection = 'neutral';
    if (trend && trend.length >= 2) {
      const recentAvg = trend.slice(-3).reduce((sum, d) => sum + (d.completions || 0), 0) / 3;
      const olderAvg = trend.slice(0, 3).reduce((sum, d) => sum + (d.completions || 0), 0) / 3;
      if (recentAvg > olderAvg * 1.1) trendDirection = 'up';
      else if (recentAvg < olderAvg * 0.9) trendDirection = 'down';
    }

    return {
      completionRate: parseFloat(completionRate),
      dropOffRate: parseFloat(dropOffRate),
      trendDirection
    };
  }, [views, completions, dropOffs, trend]);

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isHighlighted
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
      } ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
            isHighlighted
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
          }`}>
            {stepNumber}
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
              {title || `Step ${stepNumber}`}
            </h4>
            <div className="flex items-center gap-1 text-sm">
              {metrics.trendDirection === 'up' && (
                <>
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">
                    {t('analytics.improving', 'Improving')}
                  </span>
                </>
              )}
              {metrics.trendDirection === 'down' && (
                <>
                  <TrendingDown className="w-3 h-3 text-red-500" />
                  <span className="text-red-600 dark:text-red-400">
                    {t('analytics.declining', 'Declining')}
                  </span>
                </>
              )}
              {metrics.trendDirection === 'neutral' && (
                <span className="text-gray-500 dark:text-gray-400">
                  {t('analytics.stable', 'Stable')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mini trend chart */}
        <MiniChart
          data={trend}
          dataKey="completions"
          color={isHighlighted ? '#EF4444' : '#8B5CF6'}
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Views */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {views.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('analytics.views', 'Views')}
            </div>
          </div>
        </div>

        {/* Completions */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {completions.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('analytics.completions', 'Completions')}
            </div>
          </div>
        </div>

        {/* Drop-offs */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <LogOut className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {dropOffs.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('analytics.dropOffs', 'Drop-offs')} ({metrics.dropOffRate}%)
            </div>
          </div>
        </div>

        {/* Avg Time */}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatTime(timeStats.avg)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('analytics.avgTime', 'Avg Time')}
            </div>
          </div>
        </div>
      </div>

      {/* Completion Rate Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">
            {t('analytics.completionRate', 'Completion Rate')}
          </span>
          <span className={`font-medium ${
            metrics.completionRate >= 70
              ? 'text-green-600 dark:text-green-400'
              : metrics.completionRate >= 50
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
          }`}>
            {metrics.completionRate}%
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              metrics.completionRate >= 70
                ? 'bg-green-500'
                : metrics.completionRate >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(metrics.completionRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Time range stats (optional) */}
      {(timeStats.min || timeStats.max) && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('analytics.minTime', 'Min')}: {formatTime(timeStats.min)}</span>
          <span>{t('analytics.maxTime', 'Max')}: {formatTime(timeStats.max)}</span>
        </div>
      )}
    </div>
  );
}
