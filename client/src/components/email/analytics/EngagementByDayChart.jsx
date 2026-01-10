import React from 'react';

const EngagementByDayChart = ({ data, showHeatmap = false }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Mock data for bar chart
  const dayData = data?.byDay || [
    { day: 'Mon', opens: 2450, rate: 28.5 },
    { day: 'Tue', opens: 3120, rate: 32.1 },
    { day: 'Wed', opens: 2890, rate: 29.8 },
    { day: 'Thu', opens: 2760, rate: 27.5 },
    { day: 'Fri', opens: 2340, rate: 25.2 },
    { day: 'Sat', opens: 1250, rate: 18.3 },
    { day: 'Sun', opens: 980, rate: 15.6 }
  ];

  // Mock heatmap data
  const heatmapData = data?.heatmap || {};

  const maxOpens = Math.max(...dayData.map(d => d.opens));
  const bestDay = dayData.reduce((best, day) => day.rate > best.rate ? day : best, dayData[0]);

  const getHeatmapValue = (day, hour) => {
    const key = `${day}_${hour}`;
    return heatmapData[key] || Math.floor(Math.random() * 100);
  };

  const getHeatmapColor = (value) => {
    if (value >= 80) return 'bg-green-600';
    if (value >= 60) return 'bg-green-500';
    if (value >= 40) return 'bg-green-400';
    if (value >= 20) return 'bg-green-300';
    return 'bg-green-100';
  };

  if (showHeatmap) {
    return (
      <div className="space-y-4">
        {/* Heatmap */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-1">
              <div className="w-12"></div>
              {hours.filter(h => h % 3 === 0).map(hour => (
                <div key={hour} className="flex-1 text-center text-xs text-gray-500">
                  {hour.toString().padStart(2, '0')}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            {days.map(day => (
              <div key={day} className="flex items-center mb-1">
                <div className="w-12 text-xs text-gray-600">{day}</div>
                <div className="flex-1 flex gap-0.5">
                  {hours.map(hour => {
                    const value = getHeatmapValue(day, hour);
                    return (
                      <div
                        key={hour}
                        className={`flex-1 h-5 rounded-sm ${getHeatmapColor(value)} hover:ring-2 hover:ring-blue-400 cursor-pointer`}
                        title={`${day} ${hour}:00 - ${value}% engagement`}
                      ></div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 bg-green-100 rounded"></div>
            <div className="w-4 h-4 bg-green-300 rounded"></div>
            <div className="w-4 h-4 bg-green-400 rounded"></div>
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <div className="w-4 h-4 bg-green-600 rounded"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Engagement by Day</h3>
        <span className="text-sm text-green-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
          Best: {bestDay.day}
        </span>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3">
        {dayData.map(day => (
          <div key={day.day} className="flex items-center gap-3">
            <span className="w-10 text-sm text-gray-600">{day.day}</span>
            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  day.day === bestDay.day ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${(day.opens / maxOpens) * 100}%` }}
              ></div>
            </div>
            <span className="w-12 text-sm text-gray-600 text-right">{day.rate}%</span>
          </div>
        ))}
      </div>

      {/* Best Time */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Best time to send: <strong>Tuesday 10:00 AM</strong></span>
      </div>
    </div>
  );
};

export default EngagementByDayChart;
