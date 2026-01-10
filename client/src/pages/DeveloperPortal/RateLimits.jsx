import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RateLimits() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rateLimitStatus, setRateLimitStatus] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [countdown, setCountdown] = useState({ minutes: 0, seconds: 0 });

  const token = localStorage.getItem('token');

  // Fetch rate limit status
  const fetchRateLimitStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/api/rate-limits/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch rate limit status');
      }

      const data = await res.json();
      setRateLimitStatus(data);
    } catch (err) {
      setError(err.message);
      // Use mock data for demo
      setRateLimitStatus({
        tier: 'pro',
        limits: {
          requests_per_minute: 100,
          requests_per_day: 10000,
          current_minute: 23,
          current_day: 1456
        },
        reset_at: {
          minute: new Date(Date.now() + 45000).toISOString(),
          day: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        },
        percentage_used: {
          minute: 23,
          day: 14.56
        }
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch tiers
  const fetchTiers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rate-limits/tiers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setTiers(data.tiers || []);
      }
    } catch (err) {
      // Use mock data
      setTiers([
        {
          name: 'free',
          displayName: 'Free',
          limits: { requests_per_minute: 20, requests_per_day: 1000 },
          features: ['Basic API access', '20 requests/minute', '1,000 requests/day', 'Community support']
        },
        {
          name: 'pro',
          displayName: 'Pro',
          limits: { requests_per_minute: 100, requests_per_day: 10000 },
          features: ['Full API access', '100 requests/minute', '10,000 requests/day', 'Priority support', 'Webhook integrations', 'Advanced analytics']
        },
        {
          name: 'enterprise',
          displayName: 'Enterprise',
          limits: { requests_per_minute: 500, requests_per_day: 100000 },
          features: ['Unlimited API access', '500 requests/minute', '100,000 requests/day', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'White-label options']
        }
      ]);
    }
  }, [token]);

  useEffect(() => {
    fetchRateLimitStatus();
    fetchTiers();
  }, [fetchRateLimitStatus, fetchTiers]);

  // Countdown timer
  useEffect(() => {
    if (!rateLimitStatus?.reset_at?.minute) return;

    const updateCountdown = () => {
      const resetTime = new Date(rateLimitStatus.reset_at.minute);
      const now = new Date();
      const diff = Math.max(0, resetTime - now);

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setCountdown({ minutes, seconds });

      // Refresh data when timer reaches 0
      if (diff <= 0) {
        fetchRateLimitStatus();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [rateLimitStatus?.reset_at?.minute, fetchRateLimitStatus]);

  const getTierColor = (tier) => {
    const colors = {
      free: 'gray',
      pro: 'blue',
      enterprise: 'purple'
    };
    return colors[tier] || 'gray';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" role="status" aria-busy="true">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            {t('developer.rateLimits', 'Rate Limits')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('developer.rateLimitsDescription', 'Monitor your API usage and rate limit status')}
          </p>
        </div>

        {error && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6" role="alert">
            <p className="text-yellow-800 dark:text-yellow-200">
              {t('developer.usingDemoData', 'Using demo data. Connect to API for real metrics.')}
            </p>
          </div>
        )}

        {/* Current Tier Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {t('developer.currentTier', 'Current Tier')}
              </p>
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-bold capitalize text-${getTierColor(rateLimitStatus?.tier)}-600 dark:text-${getTierColor(rateLimitStatus?.tier)}-400`}>
                  {rateLimitStatus?.tier || 'free'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${getTierColor(rateLimitStatus?.tier)}-100 dark:bg-${getTierColor(rateLimitStatus?.tier)}-900/30 text-${getTierColor(rateLimitStatus?.tier)}-700 dark:text-${getTierColor(rateLimitStatus?.tier)}-300`}>
                  {t('developer.active', 'Active')}
                </span>
              </div>
            </div>

            {/* Reset Countdown */}
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {t('developer.minuteLimitResets', 'Minute limit resets in')}
              </p>
              <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                {String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Usage Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Minute Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('developer.minuteUsage', 'Requests This Minute')}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {rateLimitStatus?.limits?.current_minute || 0} / {rateLimitStatus?.limits?.requests_per_minute || 0}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(rateLimitStatus?.percentage_used?.minute || 0)}`}
                style={{ width: `${Math.min(100, rateLimitStatus?.percentage_used?.minute || 0)}%` }}
                role="progressbar"
                aria-valuenow={rateLimitStatus?.percentage_used?.minute || 0}
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {Math.round(rateLimitStatus?.percentage_used?.minute || 0)}% {t('developer.used', 'used')}
            </p>
          </div>

          {/* Daily Usage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('developer.dailyUsage', 'Requests Today')}
              </h3>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {(rateLimitStatus?.limits?.current_day || 0).toLocaleString()} / {(rateLimitStatus?.limits?.requests_per_day || 0).toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(rateLimitStatus?.percentage_used?.day || 0)}`}
                style={{ width: `${Math.min(100, rateLimitStatus?.percentage_used?.day || 0)}%` }}
                role="progressbar"
                aria-valuenow={rateLimitStatus?.percentage_used?.day || 0}
                aria-valuemin="0"
                aria-valuemax="100"
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {Math.round(rateLimitStatus?.percentage_used?.day * 100) / 100}% {t('developer.used', 'used')}
            </p>
          </div>
        </div>

        {/* Tier Comparison Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('developer.tierComparison', 'Tier Comparison')}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                    {t('developer.feature', 'Feature')}
                  </th>
                  {tiers.map(tier => (
                    <th
                      key={tier.name}
                      className={`px-6 py-4 text-center text-sm font-medium ${
                        tier.name === rateLimitStatus?.tier
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-500 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-lg font-bold">{tier.displayName}</span>
                        {tier.name === rateLimitStatus?.tier && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full">
                            {t('developer.currentPlan', 'Current')}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {t('developer.requestsPerMinute', 'Requests per Minute')}
                  </td>
                  {tiers.map(tier => (
                    <td
                      key={tier.name}
                      className={`px-6 py-4 text-center text-sm font-semibold ${
                        tier.name === rateLimitStatus?.tier
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {tier.limits.requests_per_minute.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {t('developer.requestsPerDay', 'Requests per Day')}
                  </td>
                  {tiers.map(tier => (
                    <td
                      key={tier.name}
                      className={`px-6 py-4 text-center text-sm font-semibold ${
                        tier.name === rateLimitStatus?.tier
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {tier.limits.requests_per_day.toLocaleString()}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                    {t('developer.features', 'Features')}
                  </td>
                  {tiers.map(tier => (
                    <td
                      key={tier.name}
                      className={`px-6 py-4 text-left text-sm ${
                        tier.name === rateLimitStatus?.tier
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : ''
                      }`}
                    >
                      <ul className="space-y-1">
                        {tier.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-6 py-4"></td>
                  {tiers.map(tier => (
                    <td
                      key={tier.name}
                      className={`px-6 py-4 text-center ${
                        tier.name === rateLimitStatus?.tier
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : ''
                      }`}
                    >
                      {tier.name !== rateLimitStatus?.tier && tier.name !== 'free' && (
                        <button
                          onClick={() => navigate('/billing')}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          {t('developer.upgradeTo', 'Upgrade to')} {tier.displayName}
                        </button>
                      )}
                      {tier.name === rateLimitStatus?.tier && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {t('developer.currentPlan', 'Current Plan')}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Upgrade CTA (if not Enterprise) */}
        {rateLimitStatus?.tier !== 'enterprise' && (
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold mb-2">
                  {t('developer.needMoreRequests', 'Need more API requests?')}
                </h3>
                <p className="text-purple-100">
                  {t('developer.upgradeDescription', 'Upgrade your plan to get higher rate limits and more features.')}
                </p>
              </div>
              <button
                onClick={() => navigate('/billing')}
                className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors font-semibold whitespace-nowrap"
              >
                {t('developer.viewPlans', 'View Plans')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
