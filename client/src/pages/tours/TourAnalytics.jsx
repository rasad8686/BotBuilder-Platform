/**
 * Tour Analytics Page
 * Real-time analytics dashboard for product tours
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTourAnalytics } from '../../hooks/useTourAnalytics';
import api from '../../api/axios';

const TourAnalytics = () => {
  const { t } = useTranslation();
  const { tourId } = useParams();
  const navigate = useNavigate();

  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historicalStats, setHistoricalStats] = useState(null);
  const [dateRange, setDateRange] = useState('7d');

  // Real-time analytics hook
  const {
    connected,
    connecting,
    error,
    stats,
    recentEvents,
    completionRate,
    dropOffPoints,
    refreshStats,
    clearRecentEvents
  } = useTourAnalytics(tourId);

  // Fetch tour details
  useEffect(() => {
    const fetchTour = async () => {
      try {
        const response = await api.get(`/api/tours/${tourId}`);
        setTour(response.data.data);
      } catch (err) {
        console.error('Error fetching tour:', err);
      } finally {
        setLoading(false);
      }
    };

    if (tourId) {
      fetchTour();
    }
  }, [tourId]);

  // Fetch historical stats
  useEffect(() => {
    const fetchHistoricalStats = async () => {
      try {
        const response = await api.get(`/api/tours/${tourId}/analytics`, {
          params: { range: dateRange }
        });
        setHistoricalStats(response.data.data);
      } catch (err) {
        console.error('Error fetching historical stats:', err);
      }
    };

    if (tourId) {
      fetchHistoricalStats();
    }
  }, [tourId, dateRange]);

  // Calculate funnel data
  const funnelData = useMemo(() => {
    if (!stats.stepDistribution || !tour?.steps) return [];

    const totalSteps = tour.steps.length;
    const funnel = [];

    for (let i = 0; i < totalSteps; i++) {
      const stepData = stats.stepDistribution.find(s => s.step === i);
      const dropOff = dropOffPoints.find(d => d.step === i);

      funnel.push({
        step: i,
        name: tour.steps[i]?.title || `Step ${i + 1}`,
        activeUsers: stepData?.count || 0,
        dropOffs: dropOff?.count || 0
      });
    }

    return funnel;
  }, [stats.stepDistribution, dropOffPoints, tour]);

  // Event type badge
  const getEventBadge = (type) => {
    const badges = {
      started: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Started' },
      step_viewed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Viewed' },
      step_completed: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Completed' },
      completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Finished' },
      skipped: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'Skipped' },
      error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Error' }
    };

    const badge = badges[type] || badges.started;
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  // Format time ago
  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/tours')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {tour?.name || t('tours.analytics.title', 'Tour Analytics')}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tours.analytics.realTime', 'Real-time analytics dashboard')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : connecting ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {connected ? t('common.connected', 'Connected') : connecting ? t('common.connecting', 'Connecting...') : t('common.disconnected', 'Disconnected')}
            </span>
          </div>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="24h">{t('common.last24h', 'Last 24 hours')}</option>
            <option value="7d">{t('common.last7d', 'Last 7 days')}</option>
            <option value="30d">{t('common.last30d', 'Last 30 days')}</option>
            <option value="90d">{t('common.last90d', 'Last 90 days')}</option>
          </select>

          <button
            onClick={refreshStats}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title={t('common.refresh', 'Refresh')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Real-time Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tours.analytics.activeUsers', 'Active Users')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.activeUsers}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            {t('tours.analytics.live', 'Live')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tours.analytics.activeSessions', 'Active Sessions')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.activeSessions}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tours.analytics.completionRate', 'Completion Rate')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {historicalStats?.completionRate?.toFixed(1) || 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('tours.analytics.totalViews', 'Total Views')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {historicalStats?.totalViews?.toLocaleString() || 0}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Step Progress Funnel */}
        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('tours.analytics.stepFunnel', 'Step Progress Funnel')}
          </h3>

          {funnelData.length > 0 ? (
            <div className="space-y-3">
              {funnelData.map((step, index) => {
                const maxUsers = Math.max(...funnelData.map(s => s.activeUsers), 1);
                const width = (step.activeUsers / maxUsers) * 100;

                return (
                  <div key={index} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {step.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {step.activeUsers} {t('tours.analytics.users', 'users')}
                        </span>
                        {step.dropOffs > 0 && (
                          <span className="text-xs text-red-500">
                            -{step.dropOffs} {t('tours.analytics.dropOff', 'drop-off')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(width, 5)}%` }}
                      >
                        {width > 15 && (
                          <span className="text-xs text-white font-medium">
                            {step.activeUsers}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400">
              {t('tours.analytics.noActiveUsers', 'No active users in tour')}
            </div>
          )}
        </div>

        {/* Active Sessions List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('tours.analytics.activeSessions', 'Active Sessions')}
            </h3>
            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              {stats.activeSessions} {t('common.live', 'live')}
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {stats.sessionsList.length > 0 ? (
              stats.sessionsList.map((session, index) => (
                <div
                  key={session.sessionId || index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {session.visitorId?.substring(0, 8) || 'Anonymous'}...
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Step {session.currentStep + 1}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(session.startedAt)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                {t('tours.analytics.noSessions', 'No active sessions')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Events Feed */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('tours.analytics.recentEvents', 'Recent Events')}
          </h3>
          {recentEvents.length > 0 && (
            <button
              onClick={clearRecentEvents}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('common.clear', 'Clear')}
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentEvents.length > 0 ? (
            recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getEventBadge(event.type)}
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {event.data.userId?.substring(0, 8) || event.data.sessionId?.substring(0, 8) || 'User'}...
                    {event.type === 'step_viewed' && ` viewed step ${(event.data.stepIndex || 0) + 1}`}
                    {event.type === 'step_completed' && ` completed step ${(event.data.stepIndex || 0) + 1}`}
                    {event.type === 'skipped' && ` skipped at step ${(event.data.skippedAtStep || 0) + 1}`}
                    {event.type === 'completed' && ` finished tour`}
                    {event.type === 'started' && ` started tour`}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {formatTimeAgo(event.timestamp)}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-20 text-gray-400 text-sm">
              {t('tours.analytics.noEvents', 'Waiting for events...')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TourAnalytics;
