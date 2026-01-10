import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle } from '../../ui/Card';

const PRIORITY_COLORS = {
  low: '#6b7280',     // gray
  medium: '#3b82f6',  // blue
  high: '#f97316',    // orange
  urgent: '#ef4444'   // red
};

export default function TicketsByPriorityChart({ data }) {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    const priorities = ['low', 'medium', 'high', 'urgent'];
    return priorities.map(priority => ({
      priority,
      label: t(`tickets.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`, priority),
      count: data?.[priority] || 0,
      color: PRIORITY_COLORS[priority]
    }));
  }, [data, t]);

  const maxValue = Math.max(...chartData.map(item => item.count), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tickets.ticketsByPriority', 'Tickets by Priority')}</CardTitle>
      </CardHeader>
      <div className="p-6">
        <div className="space-y-4">
          {chartData.map((item, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {item.label}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
              <div className="h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.count / maxValue) * 100}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
