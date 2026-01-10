import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { Select } from '../../ui/Input';

export default function TicketTrendChart({ data }) {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('7d');

  const chartData = useMemo(() => {
    // Mock data if not provided
    if (!data || data.length === 0) {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      return Array.from({ length: days }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (days - i - 1));
        return {
          date: date.toISOString().split('T')[0],
          created: Math.floor(Math.random() * 20) + 5,
          resolved: Math.floor(Math.random() * 15) + 3
        };
      });
    }
    return data;
  }, [data, dateRange]);

  const maxValue = Math.max(
    ...chartData.flatMap(d => [d.created, d.resolved]),
    1
  );

  const rangeOptions = [
    { value: '7d', label: t('tickets.last7Days', 'Last 7 days') },
    { value: '30d', label: t('tickets.last30Days', 'Last 30 days') },
    { value: '90d', label: t('tickets.last90Days', 'Last 90 days') }
  ];

  const getY = (value) => {
    return 150 - (value / maxValue) * 130;
  };

  const createdPath = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 580 + 10;
    const y = getY(d.created);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const resolvedPath = chartData.map((d, i) => {
    const x = (i / (chartData.length - 1)) * 580 + 10;
    const y = getY(d.resolved);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('tickets.ticketTrend', 'Ticket Trend')}</CardTitle>
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={rangeOptions}
            className="w-36"
          />
        </div>
      </CardHeader>
      <div className="p-6">
        <svg viewBox="0 0 600 180" className="w-full h-48">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <line
              key={i}
              x1="0"
              y1={20 + i * 32.5}
              x2="600"
              y2={20 + i * 32.5}
              stroke="#e5e7eb"
              strokeDasharray="4"
              className="dark:stroke-slate-700"
            />
          ))}

          {/* Created line */}
          <path
            d={createdPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Resolved line */}
          <path
            d={resolvedPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {chartData.map((d, i) => {
            const x = (i / (chartData.length - 1)) * 580 + 10;
            return (
              <g key={i}>
                <circle cx={x} cy={getY(d.created)} r="3" fill="#3b82f6" />
                <circle cx={x} cy={getY(d.resolved)} r="3" fill="#22c55e" />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('tickets.created', 'Created')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('tickets.resolved', 'Resolved')}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
