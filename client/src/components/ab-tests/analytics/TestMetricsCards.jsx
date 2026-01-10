import { useTranslation } from 'react-i18next';
import {
  Users,
  Target,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card } from '../../ui/Card';

export default function TestMetricsCards({
  totalVisitors,
  totalConversions,
  avgConversionRate,
  totalRevenue,
  uplift
}) {
  const { t } = useTranslation();

  const metrics = [
    {
      label: t('abTests.totalVisitors', 'Total Visitors'),
      value: totalVisitors?.toLocaleString() || '0',
      icon: Users,
      color: 'purple'
    },
    {
      label: t('abTests.totalConversions', 'Total Conversions'),
      value: totalConversions?.toLocaleString() || '0',
      icon: Target,
      color: 'blue'
    },
    {
      label: t('abTests.avgConversionRate', 'Avg. Conversion Rate'),
      value: `${avgConversionRate?.toFixed(2) || '0.00'}%`,
      icon: TrendingUp,
      color: 'green'
    },
    {
      label: t('abTests.totalRevenue', 'Total Revenue'),
      value: `$${totalRevenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'orange'
    }
  ];

  const colorClasses = {
    purple: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      icon: 'text-purple-600 dark:text-purple-400'
    },
    blue: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: 'text-blue-600 dark:text-blue-400'
    },
    green: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      icon: 'text-green-600 dark:text-green-400'
    },
    orange: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      icon: 'text-orange-600 dark:text-orange-400'
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, idx) => {
        const colors = colorClasses[metric.color];
        return (
          <Card key={idx}>
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                  <metric.icon className={`w-5 h-5 ${colors.icon}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metric.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {metric.label}
              </p>
            </div>
          </Card>
        );
      })}

      {/* Uplift Card */}
      {uplift !== undefined && uplift !== 0 && (
        <Card className={uplift > 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${uplift > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {uplift > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
              </div>
            </div>
            <p className={`text-2xl font-bold ${uplift > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {uplift > 0 ? '+' : ''}{uplift.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {t('abTests.upliftVsControl', 'Uplift vs Control')}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
