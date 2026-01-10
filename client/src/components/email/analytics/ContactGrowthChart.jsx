import React, { useRef, useState, useEffect } from 'react';

const ContactGrowthChart = ({ data }) => {
  const svgRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(300);

  // Handle API response format { success: true, data: [...] } or direct array
  const growthData = Array.isArray(data) ? data : (data?.data || [
    { date: '2024-01-01', subscribed: 120, unsubscribed: 15 },
    { date: '2024-01-08', subscribed: 145, unsubscribed: 12 },
    { date: '2024-01-15', subscribed: 180, unsubscribed: 18 },
    { date: '2024-01-22', subscribed: 210, unsubscribed: 22 },
    { date: '2024-01-29', subscribed: 165, unsubscribed: 14 }
  ]);

  const totalSubscribed = growthData.reduce((sum, d) => sum + d.subscribed, 0);
  const totalUnsubscribed = growthData.reduce((sum, d) => sum + d.unsubscribed, 0);
  const netGrowth = totalSubscribed - totalUnsubscribed;

  const maxValue = Math.max(
    ...growthData.map(d => Math.max(d.subscribed, d.unsubscribed))
  ) || 1;
  const chartHeight = 150;

  // Get actual SVG width for path calculations
  useEffect(() => {
    const updateWidth = () => {
      if (svgRef.current) {
        setChartWidth(svgRef.current.getBoundingClientRect().width || 300);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate x position as absolute value
  const getX = (index) => {
    if (growthData.length <= 1) return 0;
    return (index / (growthData.length - 1)) * chartWidth;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900">Contact Growth</h3>
        <span className={`text-sm font-medium ${netGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {netGrowth >= 0 ? '+' : ''}{netGrowth} net
        </span>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: chartHeight }}>
        <svg ref={svgRef} className="w-full h-full">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <line
              key={i}
              x1="0"
              y1={chartHeight * (1 - ratio)}
              x2="100%"
              y2={chartHeight * (1 - ratio)}
              stroke="#e5e7eb"
              strokeDasharray="4"
            />
          ))}

          {/* Subscribed area */}
          <path
            d={`M 0 ${chartHeight} ${growthData.map((d, i) => {
              const x = getX(i);
              const y = chartHeight - (d.subscribed / maxValue) * chartHeight;
              return `L ${x} ${y}`;
            }).join(' ')} L ${chartWidth} ${chartHeight} Z`}
            fill="rgba(34, 197, 94, 0.2)"
          />

          {/* Subscribed line */}
          <path
            d={`M ${growthData.map((d, i) => {
              const x = getX(i);
              const y = chartHeight - (d.subscribed / maxValue) * chartHeight;
              return `${x} ${y}`;
            }).join(' L ')}`}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
          />

          {/* Unsubscribed line */}
          <path
            d={`M ${growthData.map((d, i) => {
              const x = getX(i);
              const y = chartHeight - (d.unsubscribed / maxValue) * chartHeight;
              return `${x} ${y}`;
            }).join(' L ')}`}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="4"
          />

          {/* Data points - Subscribed */}
          {growthData.map((d, i) => {
            const x = getX(i);
            const y = chartHeight - (d.subscribed / maxValue) * chartHeight;
            return (
              <circle
                key={`sub-${i}`}
                cx={x}
                cy={y}
                r="4"
                fill="#22c55e"
              />
            );
          })}

          {/* Data points - Unsubscribed */}
          {growthData.map((d, i) => {
            const x = getX(i);
            const y = chartHeight - (d.unsubscribed / maxValue) * chartHeight;
            return (
              <circle
                key={`unsub-${i}`}
                cx={x}
                cy={y}
                r="4"
                fill="#ef4444"
              />
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Subscribed: +{totalSubscribed}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-sm text-gray-600">Unsubscribed: -{totalUnsubscribed}</span>
        </div>
      </div>
    </div>
  );
};

export default ContactGrowthChart;
