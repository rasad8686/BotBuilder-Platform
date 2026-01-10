/**
 * NPS Breakdown Chart Component
 * Displays NPS score distribution with horizontal bar chart
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const NPSBreakdownChart = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  const { distribution = [] } = data || {};

  // Generate full 0-10 scale data
  const fullDistribution = Array.from({ length: 11 }, (_, i) => {
    const found = distribution.find(d => parseInt(d.answer_value) === i);
    return {
      score: i,
      count: found?.count || 0,
      category: i <= 6 ? 'Detractor' : i <= 8 ? 'Passive' : 'Promoter'
    };
  });

  const getBarColor = (score) => {
    if (score <= 6) return '#EF4444'; // Red - Detractors
    if (score <= 8) return '#F59E0B'; // Yellow - Passives
    return '#10B981'; // Green - Promoters
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Score: {data.score}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Responses: {data.count}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {data.category}
          </p>
        </div>
      );
    }
    return null;
  };

  const totalResponses = fullDistribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          NPS Distribution
        </h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded bg-red-500 mr-1.5"></div>
            <span className="text-gray-600 dark:text-gray-400">Detractors (0-6)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded bg-yellow-500 mr-1.5"></div>
            <span className="text-gray-600 dark:text-gray-400">Passives (7-8)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded bg-green-500 mr-1.5"></div>
            <span className="text-gray-600 dark:text-gray-400">Promoters (9-10)</span>
          </div>
        </div>
      </div>

      {totalResponses === 0 ? (
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No NPS data available</p>
          </div>
        </div>
      ) : (
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="99%" height="100%">
            <BarChart
              data={fullDistribution}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
              <XAxis
                dataKey="score"
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-gray-600 dark:text-gray-400"
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {fullDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Score breakdown summary */}
      {totalResponses > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">
              {fullDistribution.filter(d => d.score <= 6).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Detractors
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {fullDistribution.filter(d => d.score >= 7 && d.score <= 8).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Passives
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">
              {fullDistribution.filter(d => d.score >= 9).reduce((sum, d) => sum + d.count, 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Promoters
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NPSBreakdownChart;
