/**
 * TourHeatmap Component
 * Calendar heatmap showing daily tour activity
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Get day of week (0 = Sunday)
 */
const getDayOfWeek = (date) => new Date(date).getDay();

/**
 * Get week number in year
 */
const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

/**
 * Get color intensity based on value
 */
const getIntensityColor = (value, maxValue, baseColor = 'purple') => {
  if (!value || value === 0) return 'bg-gray-100 dark:bg-slate-700';

  const intensity = Math.min(value / maxValue, 1);

  const colors = {
    purple: [
      'bg-purple-100 dark:bg-purple-900/30',
      'bg-purple-200 dark:bg-purple-800/40',
      'bg-purple-300 dark:bg-purple-700/50',
      'bg-purple-400 dark:bg-purple-600/60',
      'bg-purple-500 dark:bg-purple-500'
    ],
    green: [
      'bg-green-100 dark:bg-green-900/30',
      'bg-green-200 dark:bg-green-800/40',
      'bg-green-300 dark:bg-green-700/50',
      'bg-green-400 dark:bg-green-600/60',
      'bg-green-500 dark:bg-green-500'
    ],
    blue: [
      'bg-blue-100 dark:bg-blue-900/30',
      'bg-blue-200 dark:bg-blue-800/40',
      'bg-blue-300 dark:bg-blue-700/50',
      'bg-blue-400 dark:bg-blue-600/60',
      'bg-blue-500 dark:bg-blue-500'
    ]
  };

  const colorSet = colors[baseColor] || colors.purple;
  const index = Math.min(Math.floor(intensity * colorSet.length), colorSet.length - 1);

  return colorSet[index];
};

/**
 * Format date for tooltip
 */
const formatDateTooltip = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * TourHeatmap Component
 * @param {Object} props
 * @param {Array} props.data - Daily data [{ date, impressions, completions }]
 * @param {string} props.metric - Metric to display ('impressions' or 'completions')
 * @param {string} props.color - Base color ('purple', 'green', 'blue')
 * @param {number} props.weeks - Number of weeks to show (default: 12)
 */
export default function TourHeatmap({
  data = [],
  metric = 'impressions',
  color = 'purple',
  weeks = 12
}) {
  const { t } = useTranslation();

  // Day labels
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Process data into calendar format
  const { calendarData, maxValue, totalValue } = useMemo(() => {
    // Create date map
    const dateMap = new Map();
    data.forEach(item => {
      dateMap.set(item.date, item[metric] || 0);
    });

    // Generate calendar grid
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7));

    // Adjust to start from Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const calendar = [];
    let currentDate = new Date(startDate);
    let max = 0;
    let total = 0;
    let currentWeek = [];

    while (currentDate <= today) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const value = dateMap.get(dateStr) || 0;

      if (value > max) max = value;
      total += value;

      currentWeek.push({
        date: dateStr,
        value,
        dayOfWeek: currentDate.getDay()
      });

      // Start new week on Sunday
      if (currentDate.getDay() === 6) {
        calendar.push(currentWeek);
        currentWeek = [];
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add remaining days
    if (currentWeek.length > 0) {
      calendar.push(currentWeek);
    }

    return {
      calendarData: calendar,
      maxValue: max,
      totalValue: total
    };
  }, [data, metric, weeks]);

  // Get month labels
  const monthLabels = useMemo(() => {
    const months = [];
    let lastMonth = -1;

    calendarData.forEach((week, weekIndex) => {
      if (week.length > 0) {
        const date = new Date(week[0].date);
        const month = date.getMonth();

        if (month !== lastMonth) {
          months.push({
            index: weekIndex,
            name: date.toLocaleDateString('en-US', { month: 'short' })
          });
          lastMonth = month;
        }
      }
    });

    return months;
  }, [calendarData]);

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg p-8">
        <div className="text-center">
          <div className="text-4xl mb-2 text-gray-400">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('analytics.noHeatmapData', 'No activity data available')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600 dark:text-gray-400">
          {t('analytics.totalActivity', 'Total')}: <span className="font-semibold text-gray-900 dark:text-white">{totalValue.toLocaleString()}</span> {metric}
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          {t('analytics.peak', 'Peak')}: <span className="font-semibold text-gray-900 dark:text-white">{maxValue.toLocaleString()}</span>/day
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-1 ml-8">
            {monthLabels.map((month, index) => (
              <div
                key={index}
                className="text-xs text-gray-500 dark:text-gray-400"
                style={{
                  position: 'relative',
                  left: `${month.index * 14}px`,
                  width: 0
                }}
              >
                {month.name}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Day labels */}
            <div className="flex flex-col gap-1 mr-2">
              {dayLabels.map((day, index) => (
                <div
                  key={day}
                  className="text-xs text-gray-500 dark:text-gray-400 h-3 flex items-center"
                  style={{ visibility: index % 2 === 1 ? 'visible' : 'hidden' }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="flex gap-1">
              {calendarData.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {/* Pad incomplete first week */}
                  {weekIndex === 0 && week[0]?.dayOfWeek > 0 && (
                    Array(week[0].dayOfWeek).fill(null).map((_, i) => (
                      <div key={`pad-${i}`} className="w-3 h-3" />
                    ))
                  )}

                  {week.map((day) => (
                    <div
                      key={day.date}
                      className={`w-3 h-3 rounded-sm cursor-pointer transition-colors hover:ring-2 hover:ring-gray-400 ${
                        getIntensityColor(day.value, maxValue, color)
                      }`}
                      title={`${formatDateTooltip(day.date)}: ${day.value.toLocaleString()} ${metric}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{t('analytics.less', 'Less')}</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-100 dark:bg-slate-700" />
          {[0.2, 0.4, 0.6, 0.8, 1].map((intensity, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-sm ${getIntensityColor(intensity * maxValue, maxValue, color)}`}
            />
          ))}
        </div>
        <span>{t('analytics.more', 'More')}</span>
      </div>
    </div>
  );
}
