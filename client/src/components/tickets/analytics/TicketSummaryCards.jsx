/**
 * Ticket Summary Cards Component
 * Displays key metrics with trends
 */

import { useTranslation } from 'react-i18next';
import {
  Ticket,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Star,
  Zap
} from 'lucide-react';

const MetricCard = ({ title, value, trend, icon: Icon, format = 'number', color = 'blue' }) => {
  const { t } = useTranslation();

  const formatValue = (val) => {
    if (format === 'hours') {
      return `${val.toFixed(1)}h`;
    }
    if (format === 'percent') {
      return `${val}%`;
    }
    if (format === 'score') {
      return val.toFixed(1);
    }
    if (typeof val === 'number' && val >= 1000) {
      return (val / 1000).toFixed(1) + 'k';
    }
    return val;
  };

  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${
            trend.change > 0 ? 'text-green-600' : trend.change < 0 ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend.change > 0 ? (
              <TrendingUp className="w-4 h-4 mr-1" />
            ) : trend.change < 0 ? (
              <TrendingDown className="w-4 h-4 mr-1" />
            ) : null}
            {trend.change > 0 ? '+' : ''}{trend.change}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatValue(value)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {title}
        </p>
      </div>
    </div>
  );
};

export default function TicketSummaryCards({ data, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-4 animate-pulse">
            <div className="h-10 w-10 bg-gray-200 dark:bg-slate-700 rounded-lg" />
            <div className="mt-3 h-8 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="mt-2 h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const metrics = [
    {
      title: t('tickets.analytics.totalTickets', 'Total Tickets'),
      value: data.totalTickets || 0,
      trend: data.trends?.totalTickets,
      icon: Ticket,
      color: 'blue'
    },
    {
      title: t('tickets.analytics.openTickets', 'Open Tickets'),
      value: data.openTickets || 0,
      trend: data.trends?.openTickets,
      icon: AlertCircle,
      color: 'yellow'
    },
    {
      title: t('tickets.analytics.avgFirstResponse', 'Avg First Response'),
      value: data.avgFirstResponseTime || 0,
      trend: data.trends?.avgFirstResponseTime,
      icon: Clock,
      format: 'hours',
      color: 'purple'
    },
    {
      title: t('tickets.analytics.avgResolution', 'Avg Resolution'),
      value: data.avgResolutionTime || 0,
      trend: data.trends?.avgResolutionTime,
      icon: Clock,
      format: 'hours',
      color: 'orange'
    },
    {
      title: t('tickets.analytics.resolvedTickets', 'Resolved Tickets'),
      value: data.resolvedTickets || 0,
      trend: data.trends?.resolvedTickets,
      icon: CheckCircle,
      color: 'green'
    },
    {
      title: t('tickets.analytics.slaCompliance', 'SLA Compliance'),
      value: data.slaCompliance || 0,
      trend: data.trends?.slaCompliance,
      icon: Zap,
      format: 'percent',
      color: 'blue'
    },
    {
      title: t('tickets.analytics.csatScore', 'CSAT Score'),
      value: data.csatScore || 0,
      trend: data.trends?.csatScore,
      icon: Star,
      format: 'score',
      color: 'yellow'
    },
    {
      title: t('tickets.analytics.firstContact', 'First Contact Resolution'),
      value: data.firstContactResolution || 0,
      trend: data.trends?.firstContactResolution,
      icon: CheckCircle,
      format: 'percent',
      color: 'green'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
}
