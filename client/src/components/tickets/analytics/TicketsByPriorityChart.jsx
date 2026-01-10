/**
 * Tickets By Priority Chart Component
 * Horizontal bar chart showing ticket distribution by priority
 */

import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const PRIORITY_COLORS = {
  urgent: '#EF4444',  // red
  high: '#F97316',    // orange
  medium: '#F59E0B',  // amber
  low: '#6B7280'      // gray
};

export default function TicketsByPriorityChart({ data, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-16 h-4 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="flex-1 h-6 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const chartData = data || [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
            {item.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {item.value} tickets ({item.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('tickets.analytics.byPriority', 'By Priority')}
      </h3>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
          {t('tickets.analytics.noData', 'No data available')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#6B7280', fontSize: 12 }}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PRIORITY_COLORS[entry.name.toLowerCase()] || '#6B7280'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
