import { useTranslation } from 'react-i18next';
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Card } from '../../ui/Card';

export default function TicketStatsCards({
  openCount,
  pendingCount,
  breachedCount,
  resolvedToday
}) {
  const { t } = useTranslation();

  const stats = [
    {
      label: t('tickets.openTickets', 'Open'),
      value: openCount,
      icon: Inbox,
      color: 'blue',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      textColor: 'text-blue-700 dark:text-blue-300'
    },
    {
      label: t('tickets.pending', 'Pending'),
      value: pendingCount,
      icon: Clock,
      color: 'yellow',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      textColor: 'text-yellow-700 dark:text-yellow-300'
    },
    {
      label: t('tickets.breachedSLA', 'Breached SLA'),
      value: breachedCount,
      icon: AlertTriangle,
      color: 'red',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
      textColor: 'text-red-700 dark:text-red-300'
    },
    {
      label: t('tickets.resolvedToday', 'Resolved Today'),
      value: resolvedToday,
      icon: CheckCircle,
      color: 'green',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      textColor: 'text-green-700 dark:text-green-300'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className={stat.value > 0 && stat.color === 'red' ? 'border-red-300 dark:border-red-700' : ''}>
          <div className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${stat.textColor}`}>
                {stat.value}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stat.label}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
