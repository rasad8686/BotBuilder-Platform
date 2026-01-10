import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';

export default function SLAPerformanceWidget({ data }) {
  const { t } = useTranslation();

  const metrics = [
    {
      label: t('tickets.firstResponseSLA', 'First Response SLA'),
      value: data?.firstResponseMet || 0,
      target: 95,
      trend: data?.firstResponseTrend || 0
    },
    {
      label: t('tickets.resolutionSLA', 'Resolution SLA'),
      value: data?.resolutionMet || 0,
      target: 90,
      trend: data?.resolutionTrend || 0
    }
  ];

  const overallCompliance = Math.round((metrics[0].value + metrics[1].value) / 2);

  const getTrendIcon = (trend) => {
    if (trend > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = (value, target) => {
    if (value >= target) return 'text-green-600 dark:text-green-400';
    if (value >= target - 10) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (value, target) => {
    if (value >= target) return 'bg-green-500';
    if (value >= target - 10) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tickets.slaPerformance', 'SLA Performance')}</CardTitle>
      </CardHeader>
      <div className="p-6">
        {/* Overall Compliance */}
        <div className="text-center mb-6">
          <div className="relative inline-flex">
            <svg width="120" height="120" viewBox="0 0 120 120">
              {/* Background circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="10"
                className="dark:stroke-slate-700"
              />
              {/* Progress circle */}
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={overallCompliance >= 90 ? '#22c55e' : overallCompliance >= 80 ? '#eab308' : '#ef4444'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${overallCompliance * 3.14} 314`}
                transform="rotate(-90 60 60)"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getStatusColor(overallCompliance, 90)}`}>
                {overallCompliance}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('tickets.overall', 'Overall')}
              </span>
            </div>
          </div>
        </div>

        {/* Individual Metrics */}
        <div className="space-y-4">
          {metrics.map((metric, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {metric.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${getStatusColor(metric.value, metric.target)}`}>
                    {metric.value}%
                  </span>
                  <div className="flex items-center gap-1">
                    {getTrendIcon(metric.trend)}
                    <span className={`text-xs ${metric.trend > 0 ? 'text-green-500' : metric.trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {Math.abs(metric.trend)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressColor(metric.value, metric.target)} transition-all duration-500`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('tickets.target', 'Target')}: {metric.target}%
                </span>
                <span className={`text-xs ${metric.value >= metric.target ? 'text-green-500' : 'text-red-500'}`}>
                  {metric.value >= metric.target
                    ? t('tickets.onTarget', 'On Target')
                    : t('tickets.belowTarget', 'Below Target')
                  }
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
