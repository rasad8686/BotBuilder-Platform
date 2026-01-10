/**
 * SLA Dashboard Page
 *
 * Displays SLA metrics and compliance:
 * - Current SLA tier display
 * - Uptime gauge (99.95% etc)
 * - Response time gauge
 * - Monthly uptime calendar (green/yellow/red days)
 * - Incident timeline
 * - SLA credit balance
 * - Historical trend charts
 * - Download SLA report button
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';

// Tier badge colors
const TIER_COLORS = {
  standard: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  premium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

const TIER_LABELS = {
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise'
};

export default function SLADashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);
  const [credits, setCredits] = useState({ credits: [], totals: {} });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [downloading, setDownloading] = useState(false);

  /**
   * Load dashboard data
   */
  const loadDashboardData = async () => {
    setLoading(true);
    setError('');

    try {
      const [dashboardRes, creditsRes] = await Promise.all([
        axiosInstance.get('/api/sla/dashboard'),
        axiosInstance.get('/api/sla/credits')
      ]);

      if (dashboardRes.data.success) {
        setDashboardData(dashboardRes.data.data);
      }

      if (creditsRes.data.success) {
        setCredits(creditsRes.data.data);
      }

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load SLA data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * Download SLA report
   */
  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const response = await axiosInstance.get(`/api/sla/report/${selectedMonth}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sla-report-${selectedMonth}.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      setError('Failed to download report');
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Get gauge color based on value
   */
  const getGaugeColor = (value, target, isResponseTime = false) => {
    if (isResponseTime) {
      // Lower is better for response time
      if (value <= target) return 'text-green-500';
      if (value <= target * 1.5) return 'text-yellow-500';
      return 'text-red-500';
    } else {
      // Higher is better for uptime
      if (value >= target) return 'text-green-500';
      if (value >= target - 0.5) return 'text-yellow-500';
      return 'text-red-500';
    }
  };

  /**
   * Format uptime percentage
   */
  const formatUptime = (value) => {
    return value?.toFixed(4) || '0.0000';
  };

  /**
   * Get month options for selector
   */
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">Loading SLA data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
              SLA Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Service Level Agreement monitoring and compliance
            </p>
          </div>

          {/* Download Report */}
          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white"
            >
              {getMonthOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={handleDownloadReport}
              disabled={downloading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {downloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {dashboardData && (
          <>
            {/* SLA Tier & Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Tier */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">SLA Tier</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${TIER_COLORS[dashboardData.tier] || TIER_COLORS.standard}`}>
                  {TIER_LABELS[dashboardData.tier] || dashboardData.tier}
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Target: {dashboardData.uptime_target}% uptime
                </p>
              </div>

              {/* Uptime Gauge */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Current Uptime</p>
                <div className={`text-3xl font-bold ${getGaugeColor(dashboardData.current_uptime, dashboardData.uptime_target)}`}>
                  {formatUptime(dashboardData.current_uptime)}%
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {dashboardData.current_uptime_met ? (
                    <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      SLA Met
                    </span>
                  ) : (
                    <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Below Target
                    </span>
                  )}
                </div>
              </div>

              {/* Response Time Gauge */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Avg Response Time</p>
                <div className={`text-3xl font-bold ${getGaugeColor(dashboardData.current_response_time, dashboardData.response_time_target, true)}`}>
                  {dashboardData.current_response_time}ms
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Target: {`<`}{dashboardData.response_time_target}ms
                </p>
              </div>

              {/* Credit Balance */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Credit Balance</p>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  ${dashboardData.credit_balance?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Available SLA credits
                </p>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly Uptime Calendar */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Monthly Uptime Calendar
                </h2>
                <div className="grid grid-cols-7 gap-1">
                  {/* Day headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {dashboardData.daily_uptime && (() => {
                    const firstDay = new Date(dashboardData.daily_uptime[0]?.date).getDay();
                    const emptyDays = Array(firstDay).fill(null);

                    return [...emptyDays, ...dashboardData.daily_uptime].map((day, idx) => {
                      if (!day) {
                        return <div key={`empty-${idx}`} className="aspect-square"></div>;
                      }

                      const bgColor = day.status === 'green'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : day.status === 'yellow'
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';

                      const dayNum = new Date(day.date).getDate();

                      return (
                        <div
                          key={day.date}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs cursor-pointer hover:ring-2 hover:ring-purple-500 ${bgColor}`}
                          title={`${day.date}: ${day.uptime}%${day.hasIncident ? ' (incident)' : ''}`}
                        >
                          <span className="font-medium">{dayNum}</span>
                          <span className="text-[10px]">{day.uptime}%</span>
                          {day.hasIncident && (
                            <span className="text-[8px]">!</span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{`>= 99.9%`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-yellow-500"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">99.0% - 99.9%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-red-500"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{`< 99.0%`}</span>
                  </div>
                </div>
              </div>

              {/* Stats & Incidents */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    This Month
                  </h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Downtime</span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {dashboardData.current_downtime_minutes} min
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Incidents</span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {dashboardData.current_incidents}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Support Target</span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {dashboardData.support_response_hours}h
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Incidents */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Recent Incidents
                  </h2>
                  {dashboardData.recent_incidents?.length > 0 ? (
                    <div className="space-y-3">
                      {dashboardData.recent_incidents.map((incident, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-1.5 ${
                            incident.severity === 'critical' ? 'bg-red-500' :
                            incident.severity === 'major' ? 'bg-orange-500' :
                            'bg-yellow-500'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 dark:text-white truncate">
                              {incident.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(incident.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            incident.status === 'resolved'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {incident.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No recent incidents
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Historical Trend */}
            <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Historical Uptime Trend
              </h2>
              {dashboardData.history?.length > 0 ? (
                <div className="h-48">
                  {/* Simple bar chart */}
                  <div className="flex items-end justify-between h-40 gap-2">
                    {dashboardData.history.map((month, idx) => {
                      const height = ((parseFloat(month.uptime_actual) - 98) / 2) * 100; // Scale 98-100 to 0-100%
                      const clampedHeight = Math.max(0, Math.min(100, height));
                      const date = new Date(month.period_start);
                      const label = date.toLocaleDateString('en-US', { month: 'short' });

                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div
                            className={`w-full rounded-t transition-all ${
                              parseFloat(month.uptime_actual) >= dashboardData.uptime_target
                                ? 'bg-green-500'
                                : 'bg-red-500'
                            }`}
                            style={{ height: `${clampedHeight}%` }}
                            title={`${month.uptime_actual}%`}
                          ></div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Target line */}
                  <div className="relative -mt-40 pointer-events-none">
                    <div
                      className="absolute w-full border-t-2 border-dashed border-purple-500"
                      style={{ top: `${(100 - ((dashboardData.uptime_target - 98) / 2) * 100)}%` }}
                    >
                      <span className="absolute -top-5 right-0 text-xs text-purple-500">
                        Target: {dashboardData.uptime_target}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No historical data available
                </p>
              )}
            </div>

            {/* Credits Section */}
            <div className="mt-6 bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                SLA Credits
              </h2>

              {/* Credit Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending</p>
                  <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                    ${credits.totals.pending?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Approved</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">
                    ${credits.totals.approved?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">Applied</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    ${credits.totals.applied?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>

              {/* Credits Table */}
              {credits.credits?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Period</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Credit %</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Amount</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-700">
                      {credits.credits.map((credit, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                            {new Date(credit.period).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                            {credit.breach_type}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">
                            {credit.credit_percentage}%
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                            ${parseFloat(credit.credit_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              credit.status === 'applied' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                              credit.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            }`}>
                              {credit.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  No SLA credits recorded
                </p>
              )}
            </div>

            {/* SLA Terms */}
            <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                Your SLA Terms ({TIER_LABELS[dashboardData.tier]})
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>- Guaranteed uptime: {dashboardData.uptime_target}%</li>
                <li>- Response time target: {dashboardData.response_time_target}ms</li>
                <li>- Support response: Within {dashboardData.support_response_hours} hours</li>
                <li>- Credits applied automatically when SLA is not met</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
