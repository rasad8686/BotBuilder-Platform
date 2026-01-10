/**
 * HourlyHeatmap Component
 * Heatmap showing conversion rates by hour and day of week
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/**
 * Get color intensity based on value
 */
const getHeatColor = (value, max, variant = 'A') => {
  if (max === 0) return 'bg-gray-100 dark:bg-slate-700';

  const intensity = value / max;

  const colorMap = {
    A: [
      'bg-blue-50 dark:bg-blue-900/10',
      'bg-blue-100 dark:bg-blue-900/20',
      'bg-blue-200 dark:bg-blue-900/30',
      'bg-blue-300 dark:bg-blue-900/40',
      'bg-blue-400 dark:bg-blue-900/50',
      'bg-blue-500 dark:bg-blue-800',
      'bg-blue-600 dark:bg-blue-700'
    ],
    B: [
      'bg-green-50 dark:bg-green-900/10',
      'bg-green-100 dark:bg-green-900/20',
      'bg-green-200 dark:bg-green-900/30',
      'bg-green-300 dark:bg-green-900/40',
      'bg-green-400 dark:bg-green-900/50',
      'bg-green-500 dark:bg-green-800',
      'bg-green-600 dark:bg-green-700'
    ]
  };

  const colors = colorMap[variant] || colorMap.A;
  const index = Math.min(Math.floor(intensity * colors.length), colors.length - 1);

  return colors[index];
};

/**
 * Format hour for display
 */
const formatHour = (hour) => {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
};

/**
 * HourlyHeatmap Component
 * @param {Object} props
 * @param {Array} props.data - Hourly data [{ day, hour, conversionRate, variant }]
 * @param {string} props.variant - Variant to display
 * @param {string} props.title - Chart title
 */
export default function HourlyHeatmap({
  data = [],
  variant = 'A',
  title
}) {
  const { t } = useTranslation();

  // Process data into grid format
  const { grid, maxValue } = useMemo(() => {
    const gridData = {};
    let max = 0;

    // Initialize grid
    DAYS.forEach((_, dayIndex) => {
      gridData[dayIndex] = {};
      HOURS.forEach(hour => {
        gridData[dayIndex][hour] = 0;
      });
    });

    // Fill with data
    data.forEach(item => {
      const variantName = item.variantName || item.variant_name || item.variant;
      if (variantName !== variant) return;

      const day = item.day_of_week ?? item.dayOfWeek ?? new Date(item.date).getDay();
      const hour = item.hour;
      const rate = parseFloat(item.conversion_rate || item.conversionRate) || 0;

      if (gridData[day] && hour !== undefined) {
        gridData[day][hour] = rate;
        max = Math.max(max, rate);
      }
    });

    return { grid: gridData, maxValue: max };
  }, [data, variant]);

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-8">
        <div className="text-center text-gray-500 dark:text-gray-400">
          {t('abTests.noHourlyData', 'No hourly data available')}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      {/* Title */}
      {title && (
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h4>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex ml-12 mb-1">
            {HOURS.filter(h => h % 3 === 0).map(hour => (
              <div
                key={hour}
                className="text-xs text-gray-500 dark:text-gray-400"
                style={{ width: '48px', textAlign: 'center' }}
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="space-y-1">
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center gap-2">
                {/* Day label */}
                <div className="w-10 text-xs text-gray-500 dark:text-gray-400 text-right">
                  {day}
                </div>

                {/* Hour cells */}
                <div className="flex gap-0.5">
                  {HOURS.map(hour => {
                    const value = grid[dayIndex]?.[hour] || 0;
                    const color = getHeatColor(value, maxValue, variant);

                    return (
                      <div
                        key={hour}
                        className={`w-4 h-4 rounded-sm ${color} cursor-pointer transition-transform hover:scale-125 group relative`}
                        title={`${day} ${formatHour(hour)}: ${value.toFixed(2)}%`}
                      >
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-10">
                          {day} {formatHour(hour)}
                          <br />
                          {value.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('abTests.low', 'Low')}
            </span>
            <div className="flex gap-0.5">
              {[0, 0.17, 0.33, 0.5, 0.67, 0.83, 1].map((intensity, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-sm ${getHeatColor(intensity * maxValue, maxValue, variant)}`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('abTests.high', 'High')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
