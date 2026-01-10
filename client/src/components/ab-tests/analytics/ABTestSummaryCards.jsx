/**
 * ABTestSummaryCards Component
 * Displays 4 summary metric cards for AB testing dashboard
 */

import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Play, Eye, Target, Trophy } from 'lucide-react';
import { Card, CardContent } from '../../ui/Card';

/**
 * Single summary card
 */
function SummaryCard({ title, value, icon: Icon, color, trend, trendLabel }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
  };

  const trendValue = parseFloat(trend) || 0;
  const isPositive = trendValue > 0;
  const isNegative = trendValue < 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <div className={`mt-3 flex items-center gap-1 text-sm ${
            isPositive ? 'text-green-600 dark:text-green-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
          }`}>
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : isNegative ? (
              <TrendingDown className="w-4 h-4" />
            ) : null}
            <span>
              {isPositive && '+'}{trendValue}% {trendLabel}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ABTestSummaryCards Component
 * @param {Object} props
 * @param {number} props.runningTests - Count of running tests
 * @param {number} props.totalImpressions - Total impressions
 * @param {number} props.avgConversionRate - Average conversion rate
 * @param {number} props.winnersCount - Tests with declared winner
 * @param {Object} props.trends - Trend percentages { running, impressions, conversion, winners }
 * @param {boolean} props.isLoading - Loading state
 */
export default function ABTestSummaryCards({
  runningTests = 0,
  totalImpressions = 0,
  avgConversionRate = 0,
  winnersCount = 0,
  trends = {},
  isLoading = false
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24 mb-4" />
                <div className="h-8 bg-gray-200 dark:bg-slate-700 rounded w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <SummaryCard
        title={t('abTests.runningTests', 'Running Tests')}
        value={runningTests}
        icon={Play}
        color="blue"
        trend={trends.running}
        trendLabel={t('analytics.vsPrevious', 'vs previous period')}
      />
      <SummaryCard
        title={t('abTests.totalImpressions', 'Total Impressions')}
        value={totalImpressions}
        icon={Eye}
        color="purple"
        trend={trends.impressions}
        trendLabel={t('analytics.vsPrevious', 'vs previous period')}
      />
      <SummaryCard
        title={t('abTests.avgConversion', 'Avg Conversion Rate')}
        value={`${avgConversionRate}%`}
        icon={Target}
        color="green"
        trend={trends.conversion}
        trendLabel={t('analytics.vsPrevious', 'vs previous period')}
      />
      <SummaryCard
        title={t('abTests.winners', 'Winners Declared')}
        value={winnersCount}
        icon={Trophy}
        color="amber"
        trend={trends.winners}
        trendLabel={t('analytics.vsPrevious', 'vs previous period')}
      />
    </div>
  );
}
