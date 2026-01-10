/**
 * Survey Analytics Dashboard Component
 * Main dashboard for survey analytics with all components
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NPSScoreCard from './NPSScoreCard';
import CSATScoreCard from './CSATScoreCard';
import ResponseRateCard from './ResponseRateCard';
import ResponseTrendChart from './ResponseTrendChart';
import NPSBreakdownChart from './NPSBreakdownChart';
import QuestionAnalytics from './QuestionAnalytics';
import RecentResponsesList from './RecentResponsesList';

const API_BASE = '/api/surveys';

const SurveyAnalyticsDashboard = () => {
  const { surveyId } = useParams();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [npsData, setNpsData] = useState(null);
  const [csatData, setCsatData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [questionData, setQuestionData] = useState(null);
  const [recentResponses, setRecentResponses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [period, setPeriod] = useState('30d');

  // Get auth token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-csrf-token': csrfToken || ''
    };
  };

  // Calculate date range from period
  const getDateRange = (p) => {
    const end = new Date();
    const start = new Date();

    switch (p) {
      case '24h':
        start.setHours(start.getHours() - 24);
        break;
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      default:
        start.setDate(start.getDate() - 30);
    }

    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    };
  };

  // Fetch all analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    const dates = getDateRange(period);

    try {
      const headers = getAuthHeaders();

      // Fetch all data in parallel
      const [
        surveyRes,
        dashboardRes,
        npsRes,
        csatRes,
        trendRes,
        questionRes,
        recentRes
      ] = await Promise.all([
        fetch(`${API_BASE}/${surveyId}`, { headers }),
        fetch(`${API_BASE}/${surveyId}/analytics/dashboard?start_date=${dates.start_date}&end_date=${dates.end_date}`, { headers }),
        fetch(`${API_BASE}/${surveyId}/analytics/nps?start_date=${dates.start_date}&end_date=${dates.end_date}`, { headers }),
        fetch(`${API_BASE}/${surveyId}/analytics/csat?start_date=${dates.start_date}&end_date=${dates.end_date}`, { headers }),
        fetch(`${API_BASE}/${surveyId}/analytics/trend?start_date=${dates.start_date}&end_date=${dates.end_date}&group_by=${period === '24h' ? 'hour' : 'day'}`, { headers }),
        fetch(`${API_BASE}/${surveyId}/analytics/questions`, { headers }),
        fetch(`${API_BASE}/${surveyId}/analytics/recent?limit=10`, { headers })
      ]);

      const [
        surveyData,
        dashboardData,
        npsDataRes,
        csatDataRes,
        trendDataRes,
        questionDataRes,
        recentDataRes
      ] = await Promise.all([
        surveyRes.json(),
        dashboardRes.json(),
        npsRes.json(),
        csatRes.json(),
        trendRes.json(),
        questionRes.json(),
        recentRes.json()
      ]);

      if (surveyData.success) setSurvey(surveyData.survey);
      if (dashboardData.success) setDashboard(dashboardData.dashboard);
      if (npsDataRes.success) setNpsData(npsDataRes.nps);
      if (csatDataRes.success) setCsatData(csatDataRes.csat);
      if (trendDataRes.success) setTrendData(trendDataRes.trend);
      if (questionDataRes.success) setQuestionData(questionDataRes.questionAnalytics);
      if (recentDataRes.success) setRecentResponses(recentDataRes.responses);

    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (surveyId) {
      fetchAnalytics();
    }
  }, [surveyId, period]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  const handleExport = async (format = 'csv') => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`${API_BASE}/${surveyId}/export?format=${format}`, { headers });

      if (format === 'csv') {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey-${surveyId}-responses.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleRefresh = () => {
    fetchAnalytics();
  };

  const handleViewResponse = (response) => {
    // Navigate to response detail view
    navigate(`/surveys/${surveyId}/responses/${response.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/surveys')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {survey?.name || 'Survey Analytics'}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {survey?.type?.toUpperCase()} Survey
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {['24h', '7d', '30d', '90d'].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePeriodChange(p)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      period === p
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Export Button */}
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Score Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {survey?.type === 'nps' ? (
            <NPSScoreCard data={npsData} loading={loading} />
          ) : survey?.type === 'csat' ? (
            <CSATScoreCard data={csatData} loading={loading} />
          ) : (
            <>
              <NPSScoreCard data={npsData} loading={loading} />
              <CSATScoreCard data={csatData} loading={loading} />
            </>
          )}
          <ResponseRateCard data={dashboard} loading={loading} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ResponseTrendChart
            data={{ trend: trendData }}
            loading={loading}
            onPeriodChange={handlePeriodChange}
          />
          {survey?.type === 'nps' && (
            <NPSBreakdownChart data={npsData} loading={loading} />
          )}
        </div>

        {/* Question Analytics */}
        <div className="mb-8">
          <QuestionAnalytics data={questionData} loading={loading} />
        </div>

        {/* Recent Responses */}
        <div>
          <RecentResponsesList
            data={recentResponses}
            loading={loading}
            onViewResponse={handleViewResponse}
          />
        </div>
      </div>
    </div>
  );
};

export default SurveyAnalyticsDashboard;
