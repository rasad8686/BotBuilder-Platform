import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

const OpenRateChart = ({ data = [], detailed = false }) => {
  // Generate sample data if none provided
  const chartData = data.length > 0 ? data : generateSampleData();

  const formatHour = (hour) => {
    if (hour === 0) return '0h';
    if (hour === 24) return '24h';
    if (hour === 48) return '48h';
    return `${hour}h`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
          <p className="text-xs text-gray-500">{formatHour(label)}</p>
          <p className="text-sm font-medium text-gray-900">
            {payload[0].value.toLocaleString()} opens
          </p>
          {payload[0].payload.cumulative && (
            <p className="text-xs text-gray-500">
              Cumulative: {payload[0].payload.cumulative.toLocaleString()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: detailed ? 320 : 256 }}>
      <ResponsiveContainer width="99%" height={detailed ? 320 : 256}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="openGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="hour"
            tickFormatter={formatHour}
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={{ stroke: '#E5E7EB' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6B7280' }}
            axisLine={{ stroke: '#E5E7EB' }}
            tickLine={{ stroke: '#E5E7EB' }}
            tickFormatter={(value) => {
              if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
              return value;
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="opens"
            stroke="#8B5CF6"
            strokeWidth={2}
            fill="url(#openGradient)"
            dot={false}
            activeDot={{ r: 4, fill: '#8B5CF6' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// Generate sample data for demonstration
function generateSampleData() {
  const data = [];
  let cumulative = 0;

  for (let hour = 0; hour <= 48; hour++) {
    // Simulate a typical email open pattern
    let opens = 0;
    if (hour < 1) opens = Math.floor(Math.random() * 500) + 800;
    else if (hour < 4) opens = Math.floor(Math.random() * 300) + 400;
    else if (hour < 12) opens = Math.floor(Math.random() * 200) + 200;
    else if (hour < 24) opens = Math.floor(Math.random() * 100) + 100;
    else opens = Math.floor(Math.random() * 50) + 20;

    cumulative += opens;
    data.push({ hour, opens, cumulative });
  }

  return data;
}

export default OpenRateChart;
