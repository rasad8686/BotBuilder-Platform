/**
 * ABTestTimelineChart Component
 * Line chart showing daily performance of variants over time
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
  Legend
} from 'recharts';

// Variant colors
const VARIANT_COLORS = {
  A: '#3B82F6',
  B: '#10B981',
  C: '#F59E0B',
  D: '#8B5CF6',
  E: '#EC4899',
  F: '#14B8A6'
};

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
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {entry.name}:
              </span>
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.value?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

/**
 * ABTestTimelineChart Component
 * @param {Object} props
 * @param {Array} props.data - Daily data [{ date, variantA: rate, variantB: rate, ... }]
 * @param {Array} props.variants - Variant names to display
 * @param {number} props.height - Chart height
 * @param {string} props.metric - Metric to display ('conversionRate' or 'conversions')
 */
export default function ABTestTimelineChart({
  data = [],
  variants = ['A', 'B'],
  height = 300,
  metric = 'conversionRate'
}) {
  const { t } = useTranslation();

  // Process data - group by date, separate lines for each variant
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group by date
    const dateMap = new Map();

    data.forEach(item => {
      const date = item.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date });
      }

      const variantName = item.variantName || item.variant_name;
      const value = metric === 'conversionRate'
        ? parseFloat(item.conversion_rate || item.conversionRate) || 0
        : parseInt(item.conversions) || 0;

      dateMap.get(date)[`variant${variantName}`] = value;
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }, [data, metric]);

  // Get unique variants from data
  const uniqueVariants = useMemo(() => {
    const variantSet = new Set();
    data.forEach(item => {
      const name = item.variantName || item.variant_name;
      if (name) variantSet.add(name);
    });
    return Array.from(variantSet).sort();
  }, [data]);

  const displayVariants = uniqueVariants.length > 0 ? uniqueVariants : variants;

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
            {t('abTests.noTimelineData', 'No timeline data available')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
            tickFormatter={(value) => metric === 'conversionRate' ? `${value}%` : value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="circle"
            formatter={(value) => (
              <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
            )}
          />

          {displayVariants.map((variant) => (
            <Line
              key={variant}
              type="monotone"
              dataKey={`variant${variant}`}
              name={`Variant ${variant}`}
              stroke={VARIANT_COLORS[variant] || '#6B7280'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
