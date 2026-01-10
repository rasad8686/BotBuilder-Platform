/**
 * CSAT Score Card Component
 * Displays Customer Satisfaction Score with visual indicator
 */

import React from 'react';

const CSATScoreCard = ({ data, loading = false }) => {
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
    satisfied_count = 0,
    total_responses = 0,
    change = 0,
    distribution = []
  } = data || {};

  // Determine color based on score
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  const getProgressColor = (score) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Satisfaction faces
  const satisfactionEmojis = [
    { emoji: '1', label: 'Very Dissatisfied', color: 'bg-red-500' },
    { emoji: '2', label: 'Dissatisfied', color: 'bg-orange-500' },
    { emoji: '3', label: 'Neutral', color: 'bg-yellow-500' },
    { emoji: '4', label: 'Satisfied', color: 'bg-lime-500' },
    { emoji: '5', label: 'Very Satisfied', color: 'bg-green-500' }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          CSAT Score
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
            {Math.abs(change)}%
          </span>
        )}
      </div>

      {/* Score Display */}
      <div className="text-center mb-6">
        <div className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {score}%
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {getScoreLabel(score)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-6">
        <div
          className={`absolute inset-y-0 left-0 ${getProgressColor(score)} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Satisfaction Distribution */}
      {distribution.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Rating Distribution
          </h4>
          <div className="space-y-2">
            {satisfactionEmojis.map((item, index) => {
              const distItem = distribution.find(d => parseInt(d.answer_value) === index + 1);
              const count = distItem?.count || 0;
              const percentage = total_responses > 0 ? (count / total_responses) * 100 : 0;

              return (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm">{index + 1}</span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-12 text-xs text-gray-500 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Satisfied</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {satisfied_count}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {total_responses}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSATScoreCard;
