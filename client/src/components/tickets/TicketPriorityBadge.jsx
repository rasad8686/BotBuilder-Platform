import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/Badge';

export default function TicketPriorityBadge({ priority, size = 'default' }) {
  const { t } = useTranslation();

  const priorityConfig = {
    low: {
      label: t('tickets.priorityLow', 'Low'),
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    },
    medium: {
      label: t('tickets.priorityMedium', 'Medium'),
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    },
    high: {
      label: t('tickets.priorityHigh', 'High'),
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
    },
    urgent: {
      label: t('tickets.priorityUrgent', 'Urgent'),
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse'
    }
  };

  const config = priorityConfig[priority] || priorityConfig.medium;

  return (
    <span className={`
      inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
      ${config.className}
      ${size === 'sm' ? 'text-xs px-1.5 py-0.5' : ''}
    `}>
      {config.label}
    </span>
  );
}
