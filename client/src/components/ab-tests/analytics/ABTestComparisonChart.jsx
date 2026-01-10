/**
 * ABTestComparisonChart Component
 * Bar chart comparing variant conversion rates with confidence intervals
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
  ErrorBar,
  ReferenceLine
} from 'recharts';
import { Star } from 'lucide-react';

// Variant colors
const VARIANT_COLORS = {
  A: '#3B82F6', // blue
  B: '#10B981', // green
  C: '#F59E0B', // amber
  D: '#8B5CF6', // purple
  E: '#EC4899', // pink
  F: '#14B8A6'  // teal
};

/**
 * Custom tooltip
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: VARIANT_COLORS[data.name] || '#6B7280' }}
          />
          <span className="font-semibold text-gray-900 dark:text-white">
            Variant {data.name}
            {data.isControl && ' (Control)'}
            {data.isWinner && ' '}
          </span>
          {data.isWinner && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-gray-600 dark:text-gray-400">
            Conversion Rate: <span className="font-medium text-gray-900 dark:text-white">{data.conversionRate}%</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Impressions: <span className="font-medium">{data.impressions?.toLocaleString()}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Conversions: <span className="font-medium">{data.conversions?.toLocaleString()}</span>
          </p>
          {data.lift !== undefined && !data.isControl && (
            <p className={`${data.lift >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Lift: <span className="font-medium">{data.lift >= 0 ? '+' : ''}{data.lift}%</span>
            </p>
          )}
          {data.confidence !== undefined && !data.isControl && (
            <p className="text-gray-600 dark:text-gray-400">
              Confidence: <span className="font-medium">{data.confidence}%</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

/**
 * ABTestComparisonChart Component
 * @param {Object} props
 * @param {Array} props.variants - Variant data [{ name, conversionRate, impressions, conversions, isControl, isWinner, confidence, lift }]
 * @param {number} props.height - Chart height
 * @param {boolean} props.showConfidenceInterval - Show error bars
 * @param {string} props.winnerVariant - Winner variant name
 */
export default function ABTestComparisonChart({
  variants = [],
  height = 300,
  showConfidenceInterval = true,
  winnerVariant = null
}) {
  const { t } = useTranslation();

  // Process data for chart
  const chartData = useMemo(() => {
    if (!variants || variants.length === 0) return [];

    // Find control for lift calculations
    const control = variants.find(v => v.isControl);
    const controlRate = control ? parseFloat(control.conversionRate) : 0;

    return variants.map(v => {
      const rate = parseFloat(v.conversionRate) || 0;
      const lift = controlRate > 0 && !v.isControl
        ? ((rate - controlRate) / controlRate * 100).toFixed(1)
        : undefined;

      // Calculate confidence interval (approximate)
      const n = v.impressions || 1;
      const p = rate / 100;
      const se = Math.sqrt((p * (1 - p)) / n) * 100;
      const marginOfError = 1.96 * se; // 95% CI

      return {
        name: v.name || v.variantName,
        conversionRate: rate,
        impressions: v.impressions || 0,
        conversions: v.conversions || 0,
        isControl: v.isControl || false,
        isWinner: winnerVariant === v.name || winnerVariant === v.variantName,
        confidence: v.confidence || v.significance?.confidence,
        lift: parseFloat(lift),
        errorMargin: showConfidenceInterval ? marginOfError : 0
      };
    }).sort((a, b) => {
      // Sort: control first, then by conversion rate descending
      if (a.isControl) return -1;
      if (b.isControl) return 1;
      return b.conversionRate - a.conversionRate;
    });
  }, [variants, winnerVariant, showConfidenceInterval]);

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('abTests.noVariantData', 'No variant data available')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-slate-700" />
          <XAxis
            dataKey="name"
            stroke="#9CA3AF"
            fontSize={12}
            tickFormatter={(value) => `Variant ${value}`}
          />
          <YAxis
            stroke="#9CA3AF"
            fontSize={12}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Reference line at control rate */}
          {chartData.find(d => d.isControl) && (
            <ReferenceLine
              y={chartData.find(d => d.isControl).conversionRate}
              stroke="#9CA3AF"
              strokeDasharray="5 5"
              label={{
                value: 'Control',
                position: 'right',
                fill: '#9CA3AF',
                fontSize: 10
              }}
            />
          )}

          <Bar
            dataKey="conversionRate"
            name={t('abTests.conversionRate', 'Conversion Rate')}
            radius={[4, 4, 0, 0]}
            maxBarSize={80}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={VARIANT_COLORS[entry.name] || '#6B7280'}
                stroke={entry.isWinner ? '#F59E0B' : 'none'}
                strokeWidth={entry.isWinner ? 3 : 0}
              />
            ))}
            {showConfidenceInterval && (
              <ErrorBar
                dataKey="errorMargin"
                width={4}
                strokeWidth={2}
                stroke="#6B7280"
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
        {chartData.map((variant) => (
          <div key={variant.name} className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${variant.isWinner ? 'ring-2 ring-amber-500 ring-offset-2' : ''}`}
              style={{ backgroundColor: VARIANT_COLORS[variant.name] || '#6B7280' }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Variant {variant.name}
              {variant.isControl && ' (Control)'}
            </span>
            {variant.isWinner && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}
