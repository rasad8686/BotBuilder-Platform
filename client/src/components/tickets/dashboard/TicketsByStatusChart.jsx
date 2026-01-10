import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle } from '../../ui/Card';

const STATUS_COLORS = {
  open: '#3b82f6',    // blue
  pending: '#eab308', // yellow
  resolved: '#22c55e', // green
  closed: '#6b7280'   // gray
};

export default function TicketsByStatusChart({ data }) {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    const statuses = ['open', 'pending', 'resolved', 'closed'];
    return statuses.map(status => ({
      status,
      label: t(`tickets.status${status.charAt(0).toUpperCase() + status.slice(1)}`, status),
      count: data?.[status] || 0,
      color: STATUS_COLORS[status]
    }));
  }, [data, t]);

  const total = chartData.reduce((sum, item) => sum + item.count, 0);

  // Calculate angles for pie chart
  let currentAngle = 0;
  const segments = chartData.map(item => {
    const angle = total > 0 ? (item.count / total) * 360 : 0;
    const segment = {
      ...item,
      startAngle: currentAngle,
      endAngle: currentAngle + angle
    };
    currentAngle += angle;
    return segment;
  });

  const getPathD = (startAngle, endAngle, radius = 80) => {
    const centerX = 100;
    const centerY = 100;

    const start = {
      x: centerX + radius * Math.cos((startAngle - 90) * Math.PI / 180),
      y: centerY + radius * Math.sin((startAngle - 90) * Math.PI / 180)
    };

    const end = {
      x: centerX + radius * Math.cos((endAngle - 90) * Math.PI / 180),
      y: centerY + radius * Math.sin((endAngle - 90) * Math.PI / 180)
    };

    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${centerX} ${centerY} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('tickets.ticketsByStatus', 'Tickets by Status')}</CardTitle>
      </CardHeader>
      <div className="p-6">
        <div className="flex items-center justify-center gap-8">
          {/* Pie Chart */}
          <div className="relative">
            <svg width="200" height="200" viewBox="0 0 200 200">
              {total === 0 ? (
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="40"
                  className="dark:stroke-slate-700"
                />
              ) : (
                segments.map((segment, index) => (
                  segment.count > 0 && (
                    <path
                      key={index}
                      d={getPathD(segment.startAngle, segment.endAngle)}
                      fill={segment.color}
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  )
                ))
              )}
              {/* Center hole */}
              <circle cx="100" cy="100" r="50" fill="white" className="dark:fill-slate-800" />
              {/* Total in center */}
              <text
                x="100"
                y="95"
                textAnchor="middle"
                className="text-2xl font-bold fill-gray-900 dark:fill-white"
              >
                {total}
              </text>
              <text
                x="100"
                y="115"
                textAnchor="middle"
                className="text-xs fill-gray-500 dark:fill-gray-400"
              >
                {t('tickets.total', 'Total')}
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.label}
                  </p>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
