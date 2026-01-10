/**
 * ConversionTrendChart Component
 * Area chart showing conversion trends with comparison
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Variant colors with gradients
const VARIANT_COLORS = {
  A: { stroke: '#3B82F6', fill: 'url(#gradientA)' },
  B: { stroke: '#10B981', fill: 'url(#gradientB)' },
  C: { stroke: '#F59E0B', fill: 'url(#gradientC)' },
  D: { stroke: '#8B5CF6', fill: 'url(#gradientD)' }
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
                style={{ backgroundColor: entry.stroke }}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {entry.name}:
              </span>
              <span className="font-medium" style={{ color: entry.stroke }}>
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
 * Trend indicator
 */
function TrendIndicator({ current, previous }) {
  if (!previous || previous === 0) return null;

  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;
  const isNeutral = Math.abs(change) < 0.5;

  const Icon = isNeutral ? Minus : (isPositive ? TrendingUp : TrendingDown);
  const color = isNeutral
    ? 'text-gray-500'
    : (isPositive ? 'text-green-500' : 'text-red-500');

  return (
    <div className={`flex items-center gap-1 ${color}`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">
        {isPositive && '+'}
        {change.toFixed(1)}%
      </span>
    </div>
  );
}

/**
 * ConversionTrendChart Component
 * @param {Object} props
 * @param {Array} props.data - Daily data
 * @param {Array} props.variants - Variant names
 * @param {number} props.height - Chart height
 * @param {boolean} props.showComparison - Show period comparison
 */
export default function ConversionTrendChart({
  data = [],
  variants = ['A', 'B'],
  height = 300,
  showComparison = true
}) {
  const { t } = useTranslation();

  // Process data
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const dateMap = new Map();

    data.forEach(item => {
      const date = item.date;
      if (!dateMap.has(date)) {
        dateMap.set(date, { date });
      }

      const variantName = item.variantName || item.variant_name;
      const rate = parseFloat(item.conversion_rate || item.conversionRate) || 0;

      dateMap.get(date)[`variant${variantName}`] = rate;
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );
  }, [data]);

  // Get unique variants
  const uniqueVariants = useMemo(() => {
    const variantSet = new Set();
    data.forEach(item => {
      const name = item.variantName || item.variant_name;
      if (name) variantSet.add(name);
    });
    return Array.from(variantSet).sort();
  }, [data]);

  const displayVariants = uniqueVariants.length > 0 ? uniqueVariants : variants;

  // Calculate trends
  const trends = useMemo(() => {
    if (chartData.length < 2) return {};

    const result = {};
    displayVariants.forEach(variant => {
      const key = `variant${variant}`;
      const midPoint = Math.floor(chartData.length / 2);

      const firstHalf = chartData.slice(0, midPoint);
      const secondHalf = chartData.slice(midPoint);

      const avgFirst = firstHalf.reduce((sum, d) => sum + (d[key] || 0), 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((sum, d) => sum + (d[key] || 0), 0) / secondHalf.length;

      result[variant] = { current: avgSecond, previous: avgFirst };
    });

    return result;
  }, [chartData, displayVariants]);

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('abTests.noTrendData', 'No trend data available')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Trend indicators */}
      {showComparison && Object.keys(trends).length > 0 && (
        <div className="flex gap-4 px-4">
          {displayVariants.map(variant => {
            const trend = trends[variant];
            if (!trend) return null;

            return (
              <div
                key={variant}
                className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: VARIANT_COLORS[variant]?.stroke || '#6B7280' }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Variant {variant}
                </span>
                <TrendIndicator current={trend.current} previous={trend.previous} />
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradientA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradientD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>

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
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="circle"
              formatter={(value) => (
                <span className="text-sm text-gray-600 dark:text-gray-400">{value}</span>
              )}
            />

            {displayVariants.map((variant) => {
              const colors = VARIANT_COLORS[variant] || { stroke: '#6B7280', fill: 'rgba(107, 114, 128, 0.1)' };
              return (
                <Area
                  key={variant}
                  type="monotone"
                  dataKey={`variant${variant}`}
                  name={`Variant ${variant}`}
                  stroke={colors.stroke}
                  fill={colors.fill}
                  strokeWidth={2}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
