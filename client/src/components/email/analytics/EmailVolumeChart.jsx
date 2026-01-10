import React from 'react';

const EmailVolumeChart = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Handle API response format { success: true, data: [...] } or direct array
  const chartData = Array.isArray(data) ? data : (data?.data || [
    { date: '2024-01-01', sent: 1200, delivered: 1180, opened: 420, clicked: 145 },
    { date: '2024-01-02', sent: 980, delivered: 965, opened: 380, clicked: 120 },
    { date: '2024-01-03', sent: 1450, delivered: 1420, opened: 520, clicked: 180 },
    { date: '2024-01-04', sent: 1100, delivered: 1080, opened: 450, clicked: 155 },
    { date: '2024-01-05', sent: 1350, delivered: 1320, opened: 490, clicked: 165 },
    { date: '2024-01-06', sent: 800, delivered: 785, opened: 280, clicked: 95 },
    { date: '2024-01-07', sent: 750, delivered: 738, opened: 260, clicked: 88 }
  ]);

  const maxValue = Math.max(...chartData.map(d => d.sent));
  const chartHeight = 200;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-gray-600">Sent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-gray-600">Delivered</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded"></div>
          <span className="text-gray-600">Opened</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span className="text-gray-600">Clicked</span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: chartHeight }}>
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500">
          <span>{maxValue.toLocaleString()}</span>
          <span>{Math.round(maxValue * 0.75).toLocaleString()}</span>
          <span>{Math.round(maxValue * 0.5).toLocaleString()}</span>
          <span>{Math.round(maxValue * 0.25).toLocaleString()}</span>
          <span>0</span>
        </div>

        {/* Chart area */}
        <div className="ml-14 h-full flex items-end gap-2">
          {chartData.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5" style={{ height: chartHeight - 24 }}>
                {/* Sent bar */}
                <div
                  className="flex-1 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                  style={{ height: `${(day.sent / maxValue) * 100}%` }}
                  title={`Sent: ${day.sent}`}
                ></div>
                {/* Delivered bar */}
                <div
                  className="flex-1 bg-green-500 rounded-t transition-all hover:bg-green-600"
                  style={{ height: `${(day.delivered / maxValue) * 100}%` }}
                  title={`Delivered: ${day.delivered}`}
                ></div>
                {/* Opened bar */}
                <div
                  className="flex-1 bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                  style={{ height: `${(day.opened / maxValue) * 100}%` }}
                  title={`Opened: ${day.opened}`}
                ></div>
                {/* Clicked bar */}
                <div
                  className="flex-1 bg-orange-500 rounded-t transition-all hover:bg-orange-600"
                  style={{ height: `${(day.clicked / maxValue) * 100}%` }}
                  title={`Clicked: ${day.clicked}`}
                ></div>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-lg font-semibold text-blue-600">
            {chartData.reduce((sum, d) => sum + d.sent, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total Sent</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-green-600">
            {chartData.reduce((sum, d) => sum + d.delivered, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total Delivered</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-purple-600">
            {chartData.reduce((sum, d) => sum + d.opened, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total Opened</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-orange-600">
            {chartData.reduce((sum, d) => sum + d.clicked, 0).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">Total Clicked</p>
        </div>
      </div>
    </div>
  );
};

export default EmailVolumeChart;
