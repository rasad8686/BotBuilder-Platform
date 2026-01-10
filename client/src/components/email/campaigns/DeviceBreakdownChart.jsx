import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Monitor, Smartphone, Tablet } from 'lucide-react';

const DeviceBreakdownChart = ({ data = {} }) => {
  const defaultData = {
    desktop: 45,
    mobile: 42,
    tablet: 13
  };

  const deviceData = Object.keys(data).length > 0 ? data : defaultData;

  const total = Object.values(deviceData).reduce((sum, val) => sum + val, 0);

  const chartData = [
    { name: 'Desktop', value: deviceData.desktop || 0, color: '#6366F1', icon: Monitor },
    { name: 'Mobile', value: deviceData.mobile || 0, color: '#8B5CF6', icon: Smartphone },
    { name: 'Tablet', value: deviceData.tablet || 0, color: '#A78BFA', icon: Tablet }
  ].filter(item => item.value > 0);

  const getPercentage = (value) => {
    if (!total) return 0;
    return ((value / total) * 100).toFixed(1);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-900">{data.name}</p>
          <p className="text-xs text-gray-500">
            {data.value.toLocaleString()} ({getPercentage(data.value)}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = () => (
    <div className="flex flex-col gap-2 mt-4">
      {chartData.map((item, index) => {
        const Icon = item.icon;
        return (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <Icon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">{item.name}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-gray-900">{getPercentage(item.value)}%</span>
              <span className="text-xs text-gray-400 ml-1">({item.value.toLocaleString()})</span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Monitor className="w-8 h-8 mb-2" />
        <p className="text-sm">No device data available</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ width: '100%', height: 192 }}>
        <ResponsiveContainer width="99%" height={192}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {renderLegend()}
    </div>
  );
};

export default DeviceBreakdownChart;
