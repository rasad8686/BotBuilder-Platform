/**
 * Question Analytics Component
 * Displays analytics for individual survey questions
 */

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const QuestionAnalytics = ({ data, loading = false }) => {
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const questions = data || [];

  const renderQuestionChart = (question) => {
    const { question_type, distribution = [], avg_value, word_cloud = [] } = question;

    // For rating/scale/nps questions - show bar chart
    if (['rating', 'scale', 'nps', 'star'].includes(question_type)) {
      return (
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer width="99%" height="100%">
            <BarChart data={distribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" vertical={false} />
              <XAxis dataKey="answer_value" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // For choice questions - show pie chart
    if (['single_choice', 'multiple_choice', 'boolean'].includes(question_type)) {
      const chartData = distribution.map((d, i) => ({
        name: d.answer_value || d.answer_text || `Option ${i + 1}`,
        value: d.count
      }));

      return (
        <div className="flex items-center gap-6">
          <div style={{ width: 180, height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                    {item.name}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // For text questions - show word cloud
    if (question_type === 'text' && word_cloud.length > 0) {
      return (
        <div className="flex flex-wrap gap-2">
          {word_cloud.slice(0, 20).map((word, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
              style={{
                fontSize: `${Math.min(Math.max(word.count * 2, 12), 24)}px`
              }}
            >
              {word.word} ({word.count})
            </span>
          ))}
        </div>
      );
    }

    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-4">
        No visualization available
      </div>
    );
  };

  if (questions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Question Analytics
        </h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No question data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Question Analytics
      </h3>

      <div className="space-y-6">
        {questions.map((question, index) => (
          <div
            key={question.question_id || index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Question Header */}
            <button
              onClick={() => setSelectedQuestion(selectedQuestion === index ? null : index)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white text-left">
                  {question.question_text}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                  {question.response_count} responses
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    selectedQuestion === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Question Details */}
            {selectedQuestion === index && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {question.response_count || 0}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Responses</div>
                  </div>
                  {question.avg_value !== null && question.avg_value !== undefined && (
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {parseFloat(question.avg_value).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Avg Score</div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {question.question_type?.replace('_', ' ') || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Type</div>
                  </div>
                </div>

                {/* Chart */}
                {renderQuestionChart(question)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestionAnalytics;
