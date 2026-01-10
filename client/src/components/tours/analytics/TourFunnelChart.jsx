/**
 * TourFunnelChart Component
 * Displays a funnel chart showing tour conversion stages
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  Cell
} from 'recharts';

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];

/**
 * Custom tooltip for funnel chart
 */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
        <p className="font-semibold text-gray-900 dark:text-white">{data.name}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Count: <span className="font-medium">{data.value.toLocaleString()}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Rate: <span className="font-medium">{data.rate}%</span>
        </p>
        {data.dropOff > 0 && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Drop-off: <span className="font-medium">-{data.dropOff}%</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

/**
 * TourFunnelChart Component
 * @param {Object} props
 * @param {number} props.impressions - Total impressions
 * @param {number} props.started - Tours started count
 * @param {number} props.completed - Tours completed count
 * @param {Array} props.stepViews - Optional step views for detailed funnel
 * @param {number} props.height - Chart height (default: 300)
 * @param {boolean} props.showLabels - Show value labels on bars
 */
export default function TourFunnelChart({
  impressions = 0,
  started = 0,
  completed = 0,
  stepViews = [],
  height = 300,
  showLabels = true
}) {
  const { t } = useTranslation();

  // Calculate funnel data
  const funnelData = useMemo(() => {
    const baseValue = impressions || 1;

    const data = [
      {
        name: t('analytics.impressions', 'Impressions'),
        value: impressions,
        rate: 100,
        dropOff: 0,
        fill: COLORS[0]
      },
      {
        name: t('analytics.started', 'Started'),
        value: started,
        rate: impressions > 0 ? ((started / impressions) * 100).toFixed(1) : 0,
        dropOff: impressions > 0 ? (((impressions - started) / impressions) * 100).toFixed(1) : 0,
        fill: COLORS[1]
      }
    ];

    // Add step views if provided
    if (stepViews && stepViews.length > 0) {
      stepViews.forEach((step, index) => {
        const prevValue = index === 0 ? started : stepViews[index - 1].views;
        data.push({
          name: step.title || `Step ${index + 1}`,
          value: step.views || 0,
          rate: baseValue > 0 ? ((step.views / baseValue) * 100).toFixed(1) : 0,
          dropOff: prevValue > 0 ? (((prevValue - step.views) / prevValue) * 100).toFixed(1) : 0,
          fill: COLORS[(index + 2) % COLORS.length]
        });
      });
    }

    // Add completed
    const prevValue = stepViews && stepViews.length > 0
      ? stepViews[stepViews.length - 1].views
      : started;

    data.push({
      name: t('analytics.completed', 'Completed'),
      value: completed,
      rate: impressions > 0 ? ((completed / impressions) * 100).toFixed(1) : 0,
      dropOff: prevValue > 0 ? (((prevValue - completed) / prevValue) * 100).toFixed(1) : 0,
      fill: COLORS[2]
    });

    return data;
  }, [impressions, started, completed, stepViews, t]);

  // Empty state
  if (impressions === 0 && started === 0 && completed === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2 text-gray-400">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('analytics.noFunnelData', 'No funnel data available yet')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <FunnelChart>
          <Tooltip content={<CustomTooltip />} />
          <Funnel
            dataKey="value"
            data={funnelData}
            isAnimationActive
            animationDuration={800}
          >
            {funnelData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
            {showLabels && (
              <LabelList
                position="right"
                fill="#374151"
                stroke="none"
                dataKey="name"
                className="text-sm dark:fill-gray-300"
              />
            )}
            {showLabels && (
              <LabelList
                position="center"
                fill="#fff"
                stroke="none"
                dataKey="value"
                formatter={(value) => value.toLocaleString()}
                className="text-sm font-medium"
              />
            )}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>

      {/* Conversion rates summary */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {impressions > 0 ? ((started / impressions) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('analytics.startRate', 'Start Rate')}
          </div>
        </div>
        <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {started > 0 ? ((completed / started) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('analytics.completionRate', 'Completion Rate')}
          </div>
        </div>
        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {impressions > 0 ? ((completed / impressions) * 100).toFixed(1) : 0}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('analytics.overallRate', 'Overall Rate')}
          </div>
        </div>
      </div>
    </div>
  );
}
