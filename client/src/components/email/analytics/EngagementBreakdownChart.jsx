import React from 'react';

const EngagementBreakdownChart = ({ data }) => {
  // Mock data if no data provided
  const segments = data || {
    highlyEngaged: { count: 3540, percentage: 35 },
    engaged: { count: 4050, percentage: 40 },
    inactive: { count: 2530, percentage: 25 }
  };

  const segmentConfig = [
    {
      key: 'highlyEngaged',
      label: 'Highly Engaged',
      description: 'Opened in last 30 days',
      color: 'bg-green-500',
      textColor: 'text-green-600'
    },
    {
      key: 'engaged',
      label: 'Engaged',
      description: 'Opened in last 60 days',
      color: 'bg-blue-500',
      textColor: 'text-blue-600'
    },
    {
      key: 'inactive',
      label: 'Inactive',
      description: 'No activity in 60+ days',
      color: 'bg-gray-400',
      textColor: 'text-gray-600'
    }
  ];

  const total = Object.values(segments).reduce((sum, s) => sum + (s.count || 0), 0);

  // Calculate donut segments
  let cumulativePercentage = 0;
  const donutSegments = segmentConfig.map(config => {
    const segment = segments[config.key] || { percentage: 0 };
    const startAngle = cumulativePercentage * 3.6;
    cumulativePercentage += segment.percentage;
    const endAngle = cumulativePercentage * 3.6;
    return {
      ...config,
      ...segment,
      startAngle,
      endAngle
    };
  });

  const getArcPath = (startAngle, endAngle, innerRadius, outerRadius) => {
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;

    const x1 = 50 + outerRadius * Math.cos(startRad);
    const y1 = 50 + outerRadius * Math.sin(startRad);
    const x2 = 50 + outerRadius * Math.cos(endRad);
    const y2 = 50 + outerRadius * Math.sin(endRad);
    const x3 = 50 + innerRadius * Math.cos(endRad);
    const y3 = 50 + innerRadius * Math.sin(endRad);
    const x4 = 50 + innerRadius * Math.cos(startRad);
    const y4 = 50 + innerRadius * Math.sin(startRad);

    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`;
  };

  const getColor = (key) => {
    switch (key) {
      case 'highlyEngaged':
        return '#22c55e';
      case 'engaged':
        return '#3b82f6';
      case 'inactive':
        return '#9ca3af';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-4">Engagement Breakdown</h3>

      <div className="flex items-center gap-6">
        {/* Donut Chart */}
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {donutSegments.map((segment, index) => (
              <path
                key={index}
                d={getArcPath(segment.startAngle, segment.endAngle, 25, 40)}
                fill={getColor(segment.key)}
                className="transition-all hover:opacity-80"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{total.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          {segmentConfig.map(config => {
            const segment = segments[config.key] || { count: 0, percentage: 0 };
            return (
              <div key={config.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{config.label}</p>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${config.textColor}`}>{segment.percentage}%</p>
                  <p className="text-xs text-gray-500">{segment.count?.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendation */}
      {segments.inactive?.percentage > 20 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">High inactive rate</p>
              <p className="text-xs text-yellow-700">Consider a re-engagement campaign for inactive contacts</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EngagementBreakdownChart;
