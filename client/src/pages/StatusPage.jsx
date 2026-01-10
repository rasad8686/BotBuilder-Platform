import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const STATUS_COLORS = {
  operational: { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-100' },
  degraded: { bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-100' },
  partial_outage: { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-100' },
  major_outage: { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-100' }
};

const STATUS_LABELS = {
  operational: 'Operational',
  degraded: 'Degraded Performance',
  partial_outage: 'Partial Outage',
  major_outage: 'Major Outage'
};

const INCIDENT_STATUS_COLORS = {
  investigating: 'bg-red-100 text-red-700',
  identified: 'bg-orange-100 text-orange-700',
  monitoring: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700'
};

export default function StatusPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [overallStatus, setOverallStatus] = useState('operational');
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [uptime, setUptime] = useState({ last30Days: 99.99, last90Days: 99.99 });
  const [history, setHistory] = useState([]);

  // Fetch all status data
  const fetchStatusData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch overall status
      const statusRes = await fetch(`${API_URL}/api/status`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setOverallStatus(data.status);
      }

      // Fetch services
      const servicesRes = await fetch(`${API_URL}/api/status/services`);
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || []);
      }

      // Fetch incidents
      const incidentsRes = await fetch(`${API_URL}/api/status/incidents`);
      if (incidentsRes.ok) {
        const data = await incidentsRes.json();
        setIncidents(data.incidents || []);
      }

      // Fetch uptime history
      const historyRes = await fetch(`${API_URL}/api/status/history?days=90`);
      if (historyRes.ok) {
        const data = await historyRes.json();
        setUptime(data.uptime || { last30Days: 99.99, last90Days: 99.99 });
        setHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      // Use mock data
      setServices([
        { name: 'api', displayName: 'API', status: 'operational', responseTime: 45 },
        { name: 'database', displayName: 'Database', status: 'operational', responseTime: 12 },
        { name: 'redis', displayName: 'Cache (Redis)', status: 'operational', responseTime: 3 },
        { name: 'webhooks', displayName: 'Webhooks', status: 'operational', responseTime: 89 },
        { name: 'ai', displayName: 'AI Services', status: 'operational', responseTime: 450 }
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatusData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatusData, 60000);
    return () => clearInterval(interval);
  }, [fetchStatusData]);

  const getOverallBanner = () => {
    if (overallStatus === 'operational') {
      return {
        bg: 'bg-green-500',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        text: 'All Systems Operational'
      };
    }
    if (overallStatus === 'degraded') {
      return {
        bg: 'bg-yellow-500',
        icon: (
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
        text: 'Degraded Performance'
      };
    }
    return {
      bg: 'bg-red-500',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      text: 'System Issues Detected'
    };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatResponseTime = (ms) => {
    if (ms === null || ms === undefined) return 'N/A';
    return `${ms}ms`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  const banner = getOverallBanner();
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  const recentIncidents = incidents.filter(i => i.status === 'resolved').slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                BotBuilder Status
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('status.lastUpdated', 'Last updated')}: {new Date().toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={fetchStatusData}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Overall Status Banner */}
        <div className={`${banner.bg} text-white rounded-xl p-6 mb-8 shadow-lg`}>
          <div className="flex items-center gap-4">
            {banner.icon}
            <div>
              <h2 className="text-2xl font-bold">{banner.text}</h2>
              <p className="text-white/80 text-sm mt-1">
                {activeIncidents.length > 0
                  ? `${activeIncidents.length} active incident(s)`
                  : 'No active incidents'}
              </p>
            </div>
          </div>
        </div>

        {/* Uptime Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {t('status.uptime30Days', '30-Day Uptime')}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {uptime.last30Days.toFixed(2)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {t('status.uptime90Days', '90-Day Uptime')}
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {uptime.last90Days.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Service Status Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('status.services', 'Services')}
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {services.map(service => {
              const colors = STATUS_COLORS[service.status] || STATUS_COLORS.operational;
              return (
                <div key={service.name} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors.bg}`}></div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {service.displayName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {STATUS_LABELS[service.status]}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatResponseTime(service.responseTime)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Response Time
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Uptime Chart (simplified) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('status.uptimeHistory', '90-Day Uptime History')}
          </h3>
          <div className="flex gap-0.5 h-8">
            {history.slice(-90).map((day, idx) => {
              let color = 'bg-green-500';
              if (day.uptime < 99.9) color = 'bg-yellow-500';
              if (day.uptime < 99) color = 'bg-orange-500';
              if (day.uptime < 95) color = 'bg-red-500';
              return (
                <div
                  key={idx}
                  className={`flex-1 ${color} rounded-sm hover:opacity-80 cursor-pointer`}
                  title={`${day.date}: ${day.uptime.toFixed(2)}% uptime`}
                ></div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Active Incidents */}
        {activeIncidents.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                {t('status.activeIncidents', 'Active Incidents')}
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {activeIncidents.map(incident => (
                <div key={incident.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900 dark:text-white">
                      {incident.title}
                    </h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${INCIDENT_STATUS_COLORS[incident.status]}`}>
                      {incident.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {incident.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(incident.affectedServices || []).map(service => (
                      <span key={service} className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                        {service}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Started: {formatDate(incident.startedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incident History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('status.incidentHistory', 'Incident History')}
            </h3>
          </div>
          {recentIncidents.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t('status.noRecentIncidents', 'No incidents in the past 7 days')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentIncidents.map(incident => (
                <div key={incident.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {incident.title}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(incident.startedAt)}
                        {incident.resolvedAt && ` - ${formatDate(incident.resolvedAt)}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${INCIDENT_STATUS_COLORS.resolved}`}>
                      Resolved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>{t('status.footer', 'For more information, please contact support')}</p>
        </div>
      </main>
    </div>
  );
}
