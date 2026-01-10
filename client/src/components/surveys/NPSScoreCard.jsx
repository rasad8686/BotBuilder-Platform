/**
 * NPS Score Card Component
 * Displays Net Promoter Score with gauge visualization
 */

import React from 'react';

const NPSScoreCard = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4"></div>
        <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      </div>
    );
  }

  const {
    score = 0,
    promoters = 0,
    passives = 0,
    detractors = 0,
    total_responses = 0,
    change = 0
  } = data || {};

  // NPS score ranges from -100 to 100
  const normalizedScore = ((score + 100) / 200) * 100;

  // Determine color based on score
  const getScoreColor = (score) => {
    if (score >= 50) return 'text-green-500';
    if (score >= 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score) => {
    if (score >= 70) return 'Excellent';
    if (score >= 50) return 'Great';
    if (score >= 30) return 'Good';
    if (score >= 0) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreBgColor = (score) => {
    if (score >= 50) return 'bg-green-500';
    if (score >= 0) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          NPS Score
        </h3>
        {change !== 0 && (
          <span className={`flex items-center text-sm ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
            {change > 0 ? (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
            {Math.abs(change)}
          </span>
        )}
      </div>

      {/* Score Display */}
      <div className="text-center mb-6">
        <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {score}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {getScoreLabel(score)}
        </div>
      </div>

      {/* Score Gauge */}
      <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
        <div className="absolute inset-0 flex">
          <div className="w-1/2 bg-gradient-to-r from-red-500 via-yellow-500 to-green-300"></div>
          <div className="w-1/2 bg-gradient-to-r from-green-300 to-green-500"></div>
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-gray-800 rounded-sm shadow-lg transition-all duration-500"
          style={{ left: `calc(${normalizedScore}% - 6px)` }}
        />
      </div>

      {/* Scale Labels */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-6">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Promoters (9-10)</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
              {promoters}
            </span>
            <span className="text-xs text-gray-500">
              ({total_responses > 0 ? Math.round((promoters / total_responses) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Passives (7-8)</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
              {passives}
            </span>
            <span className="text-xs text-gray-500">
              ({total_responses > 0 ? Math.round((passives / total_responses) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">Detractors (0-6)</span>
          </div>
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
              {detractors}
            </span>
            <span className="text-xs text-gray-500">
              ({total_responses > 0 ? Math.round((detractors / total_responses) * 100) : 0}%)
            </span>
          </div>
        </div>
      </div>

      {/* Total Responses */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Total Responses</span>
          <span className="font-medium text-gray-900 dark:text-white">{total_responses}</span>
        </div>
      </div>
    </div>
  );
};

export default NPSScoreCard;
