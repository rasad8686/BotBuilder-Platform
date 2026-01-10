/**
 * TourCompletionChart Component
 * Displays a line chart showing completions over time with comparison
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart
} from 'recharts';

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/**
 * Custom tooltip
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
        <p className="font-semibold text-gray-900 dark:text-white mb-2">
          {formatDate(label)}
        </p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-medium">{entry.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * TourCompletionChart Component
 * @param {Object} props
 * @param {Array} props.data - Daily data [{ date, completions, impressions, starts }]
 * @param {Array} props.previousData - Previous period data for comparison
 * @param {number} props.height - Chart height
 * @param {boolean} props.showComparison - Show previous period comparison
 * @param {string} props.chartType - 'line' or 'area'
 * @param {Array} props.metrics - Metrics to show ['completions', 'impressions', 'starts']
 */
export default function TourCompletionChart({
  data = [],
  previousData = [],
  height = 300,
  showComparison = false,
  chartType = 'area',
  metrics = ['completions']
}) {
  const { t } = useTranslation();

  // Process data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => {
      const result = {
        date: item.date,
        completions: item.completions || 0,
        impressions: item.impressions || 0,
        starts: item.starts || 0,
        dismissals: item.dismissals || 0
      };

      // Add previous period data if available
      if (showComparison && previousData && previousData[index]) {
        result.prevCompletions = previousData[index].completions || 0;
        result.prevImpressions = previousData[index].impressions || 0;
        result.prevStarts = previousData[index].starts || 0;
      }

      return result;
    });
  }, [data, previousData, showComparison]);

  // Metric configurations
  const metricConfig = {
    completions: {
      name: t('analytics.completions', 'Completions'),
      color: '#10B981',
      prevColor: '#6EE7B7'
    },
    impressions: {
      name: t('analytics.impressions', 'Impressions'),
      color: '#3B82F6',
      prevColor: '#93C5FD'
    },
    starts: {
      name: t('analytics.starts', 'Starts'),
      color: '#8B5CF6',
      prevColor: '#C4B5FD'
    },
    dismissals: {
      name: t('analytics.dismissals', 'Dismissals'),
      color: '#EF4444',
      prevColor: '#FCA5A5'
    }
  };

  // Empty state
  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg"
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-4xl mb-2 text-gray-400">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('analytics.noChartData', 'No data available for this period')}
          </p>
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === 'area' ? AreaChart : LineChart;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ChartComponent data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-slate-700" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
          />

          {metrics.map((metric) => {
            const config = metricConfig[metric];
            if (!config) return null;

            if (chartType === 'area') {
              return (
                <Area
                  key={metric}
                  type="monotone"
                  dataKey={metric}
                  name={config.name}
                  stroke={config.color}
                  fill={config.color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              );
            }

            return (
              <Line
                key={metric}
                type="monotone"
                dataKey={metric}
                name={config.name}
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            );
          })}

          {/* Previous period comparison lines */}
          {showComparison && metrics.map((metric) => {
            const config = metricConfig[metric];
            if (!config) return null;

            const prevKey = `prev${metric.charAt(0).toUpperCase() + metric.slice(1)}`;

            if (chartType === 'area') {
              return (
                <Area
                  key={`prev-${metric}`}
                  type="monotone"
                  dataKey={prevKey}
                  name={`${config.name} (Previous)`}
                  stroke={config.prevColor}
                  fill={config.prevColor}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              );
            }

            return (
              <Line
                key={`prev-${metric}`}
                type="monotone"
                dataKey={prevKey}
                name={`${config.name} (Previous)`}
                stroke={config.prevColor}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
