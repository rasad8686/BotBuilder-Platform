/**
 * Tickets By Status Chart Component
 * Donut chart showing ticket distribution by status
 */

import { useTranslation } from 'react-i18next';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const STATUS_COLORS = {
  open: '#3B82F6',      // blue
  pending: '#F59E0B',   // amber
  resolved: '#10B981',  // green
  closed: '#6B7280'     // gray
};

export default function TicketsByStatusChart({ data, isLoading }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse mb-4" />
        <div className="h-48 flex items-center justify-center">
          <div className="w-32 h-32 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  const chartData = data || [];
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {item.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {item.value} ({item.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy }) => {
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
        <tspan x={cx} y={cy - 10} className="text-2xl font-bold fill-gray-900 dark:fill-white">
          {total}
        </tspan>
        <tspan x={cx} y={cy + 15} className="text-sm fill-gray-500 dark:fill-gray-400">
          {t('tickets.analytics.total', 'Total')}
        </tspan>
      </text>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {t('tickets.analytics.byStatus', 'By Status')}
      </h3>

      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
          {t('tickets.analytics.noData', 'No data available')}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name.toLowerCase()] || '#6B7280'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[item.name.toLowerCase()] || '#6B7280' }}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {item.name}: {item.value} ({item.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
