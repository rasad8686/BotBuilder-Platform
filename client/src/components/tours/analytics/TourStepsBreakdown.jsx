/**
 * TourStepsBreakdown Component
 * Displays horizontal bar chart with step-by-step analytics
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList
} from 'recharts';

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
 * Get color based on completion rate
 */
const getCompletionColor = (rate) => {
  if (rate >= 80) return '#10B981'; // green
  if (rate >= 60) return '#3B82F6'; // blue
  if (rate >= 40) return '#F59E0B'; // yellow
  return '#EF4444'; // red
};

/**
 * Custom tooltip
 */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">
          Step {data.stepOrder}: {data.title}
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            Views: <span className="font-medium text-gray-900 dark:text-white">{data.views.toLocaleString()}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Completions: <span className="font-medium text-green-600">{data.completions.toLocaleString()}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Completion Rate: <span className="font-medium" style={{ color: getCompletionColor(data.completionRate) }}>
              {data.completionRate}%
            </span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Drop-off Rate: <span className="font-medium text-red-600">{data.dropOffRate}%</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Avg Time: <span className="font-medium text-gray-900 dark:text-white">{formatTime(data.avgTime)}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

/**
 * TourStepsBreakdown Component
 * @param {Object} props
 * @param {Array} props.steps - Steps data [{ stepOrder, title, views, completions, avgTime, dropOffRate }]
 * @param {number} props.height - Chart height
 * @param {boolean} props.showChart - Show bar chart (default true)
 * @param {boolean} props.showList - Show list view (default true)
 * @param {boolean} props.highlightDropOffs - Highlight high drop-off steps
 */
export default function TourStepsBreakdown({
  steps = [],
  height = 300,
  showChart = true,
  showList = true,
  highlightDropOffs = true
}) {
  const { t } = useTranslation();

  // Process data
  const processedSteps = useMemo(() => {
    if (!steps || steps.length === 0) return [];

    return steps.map((step, index) => {
      const views = step.views || 0;
      const completions = step.completions || 0;
      const completionRate = views > 0 ? parseFloat(((completions / views) * 100).toFixed(1)) : 0;

      return {
        stepOrder: step.stepOrder || index + 1,
        title: step.title || `Step ${index + 1}`,
        views,
        completions,
        completionRate,
        dropOffRate: step.dropOffRate || (views > 0 ? parseFloat(((views - completions) / views * 100).toFixed(1)) : 0),
        avgTime: step.avgTime || 0,
        isHighDropOff: highlightDropOffs && (step.dropOffRate || 0) > 30
      };
    });
  }, [steps, highlightDropOffs]);

  // Find step with highest drop-off
  const highestDropOffStep = useMemo(() => {
    if (processedSteps.length === 0) return null;
    return processedSteps.reduce((max, step) =>
      step.dropOffRate > (max?.dropOffRate || 0) ? step : max
    , null);
  }, [processedSteps]);

  // Empty state
  if (processedSteps.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2 text-gray-400">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('analytics.noStepsData', 'No step analytics available')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* High drop-off warning */}
      {highestDropOffStep && highestDropOffStep.dropOffRate > 30 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">{t('analytics.highDropOff', 'High drop-off detected:')}</span>{' '}
              Step {highestDropOffStep.stepOrder} "{highestDropOffStep.title}" has {highestDropOffStep.dropOffRate}% drop-off rate
            </p>
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {showChart && (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            <BarChart
              data={processedSteps}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-slate-700" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="title"
                stroke="#9CA3AF"
                fontSize={12}
                width={90}
                tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 12)}...` : value}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="completionRate"
                name={t('analytics.completionRate', 'Completion Rate')}
                radius={[0, 4, 4, 0]}
              >
                {processedSteps.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getCompletionColor(entry.completionRate)}
                  />
                ))}
                <LabelList
                  dataKey="completionRate"
                  position="right"
                  formatter={(v) => `${v}%`}
                  className="text-sm fill-gray-700 dark:fill-gray-300"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* List View */}
      {showList && (
        <div className="space-y-2">
          {processedSteps.map((step) => (
            <div
              key={step.stepOrder}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                step.isHighDropOff
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-gray-50 dark:bg-slate-800'
              }`}
            >
              {/* Step number */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                step.isHighDropOff
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
              }`}>
                {step.stepOrder}
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {step.title}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-32 hidden sm:block">
                <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${step.completionRate}%`,
                      backgroundColor: getCompletionColor(step.completionRate)
                    }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center min-w-[60px]">
                  <div className="text-gray-900 dark:text-white font-medium">
                    {step.views.toLocaleString()}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    {t('analytics.views', 'Views')}
                  </div>
                </div>
                <div className="text-center min-w-[60px]">
                  <div className="font-medium" style={{ color: getCompletionColor(step.completionRate) }}>
                    {step.completionRate}%
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    {t('analytics.rate', 'Rate')}
                  </div>
                </div>
                <div className="text-center min-w-[60px]">
                  <div className="text-gray-900 dark:text-white font-medium">
                    {formatTime(step.avgTime)}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 text-xs">
                    {t('analytics.avgTime', 'Avg Time')}
                  </div>
                </div>
                {step.dropOffRate > 0 && (
                  <div className="text-center min-w-[60px]">
                    <div className={`font-medium ${step.isHighDropOff ? 'text-red-600' : 'text-gray-600 dark:text-gray-400'}`}>
                      -{step.dropOffRate}%
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">
                      {t('analytics.dropOff', 'Drop-off')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
