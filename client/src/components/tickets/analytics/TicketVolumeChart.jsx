/**
 * Ticket Volume Chart Component
 * Area/Line chart showing created vs resolved tickets over time
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function TicketVolumeChart({ data, isLoading }) {
  const { t } = useTranslation();
  const [groupBy, setGroupBy] = useState('day');

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="h-6 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="h-64 bg-gray-100 dark:bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  const chartData = data || [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((item, index) => (
            <p key={index} className="text-sm" style={{ color: item.color }}>
              {item.name}: {item.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('tickets.analytics.ticketVolume', 'Ticket Volume')}
        </h3>
        <div className="flex gap-2">
          {['day', 'week', 'month'].map(option => (
            <button
              key={option}
              onClick={() => setGroupBy(option)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                groupBy === option
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {t(`tickets.analytics.${option}`, option.charAt(0).toUpperCase() + option.slice(1))}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          {t('tickets.analytics.noData', 'No data available')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" className="dark:stroke-slate-700" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickLine={{ stroke: '#E5E7EB' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <YAxis
              tick={{ fill: '#6B7280', fontSize: 12 }}
              tickLine={{ stroke: '#E5E7EB' }}
              axisLine={{ stroke: '#E5E7EB' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              name={t('tickets.analytics.created', 'Created')}
              stroke="#3B82F6"
              strokeWidth={2}
              fill="url(#colorCreated)"
            />
            <Area
              type="monotone"
              dataKey="resolved"
              name={t('tickets.analytics.resolved', 'Resolved')}
              stroke="#10B981"
              strokeWidth={2}
              fill="url(#colorResolved)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
