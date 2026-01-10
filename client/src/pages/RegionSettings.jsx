import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const REGION_COORDINATES = {
  'us-east-1': { x: 25, y: 40, label: 'US East' },
  'eu-west-1': { x: 47, y: 35, label: 'EU West' },
  'ap-southeast-1': { x: 78, y: 55, label: 'Asia Pacific' }
};

const STATUS_COLORS = {
  active: 'bg-green-500',
  coming_soon: 'bg-yellow-500',
  maintenance: 'bg-orange-500',
  offline: 'bg-red-500'
};

export default function RegionSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState([]);
  const [settings, setSettings] = useState({ primaryRegion: 'us-east-1', allowedRegions: [] });
  const [bots, setBots] = useState([]);
  const [latencyResults, setLatencyResults] = useState([]);
  const [testingLatency, setTestingLatency] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migratingBot, setMigratingBot] = useState(null);

  const token = localStorage.getItem('token');

  // Fetch regions
  const fetchRegions = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/regions`);
      if (res.ok) {
        const data = await res.json();
        setRegions(data.regions || []);
      }
    } catch (err) {
      setRegions([
        { code: 'us-east-1', name: 'US East', status: 'active', isDefault: true },
        { code: 'eu-west-1', name: 'EU West', status: 'active', isDefault: false },
        { code: 'ap-southeast-1', name: 'Asia Pacific', status: 'coming_soon', isDefault: false }
      ]);
    }
  }, []);

  // Fetch organization settings
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/regions/organization/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || { primaryRegion: 'us-east-1', allowedRegions: ['us-east-1'] });
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, [token]);

  // Fetch bots
  const fetchBots = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/bots`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBots(data.bots || data || []);
      }
    } catch (err) {
      console.error('Failed to fetch bots:', err);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRegions(), fetchSettings(), fetchBots()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRegions, fetchSettings, fetchBots]);

  // Run latency test
  const runLatencyTest = async () => {
    setTestingLatency(true);
    try {
      const res = await fetch(`${API_URL}/api/regions/latency-test`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLatencyResults(data.results || []);
      }
    } catch (err) {
      console.error('Latency test failed:', err);
    } finally {
      setTestingLatency(false);
    }
  };

  // Update primary region
  const updatePrimaryRegion = async (region) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/regions/organization`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ primaryRegion: region })
      });

      if (res.ok) {
        setSettings(prev => ({ ...prev, primaryRegion: region }));
      }
    } catch (err) {
      console.error('Failed to update region:', err);
    } finally {
      setSaving(false);
    }
  };

  // Migrate bot to new region
  const migrateBot = async (botId, newRegion) => {
    setMigratingBot(botId);
    try {
      const res = await fetch(`${API_URL}/api/regions/bot/${botId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ region: newRegion })
      });

      if (res.ok) {
        await fetchBots();
      }
    } catch (err) {
      console.error('Failed to migrate bot:', err);
    } finally {
      setMigratingBot(null);
    }
  };

  const getLatencyColor = (latency) => {
    if (latency === null) return 'text-gray-400';
    if (latency < 50) return 'text-green-600';
    if (latency < 100) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('settings.regions', 'Region Settings')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {t('settings.regionsDescription', 'Manage your data residency and bot deployment regions')}
          </p>
        </div>

        {/* Region Map Visualization */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t('settings.globalInfrastructure', 'Global Infrastructure')}
          </h2>

          <div className="relative w-full h-64 bg-gradient-to-b from-blue-100 to-blue-50 dark:from-gray-700 dark:to-gray-800 rounded-lg overflow-hidden">
            {/* Simple world map background */}
            <svg viewBox="0 0 100 60" className="w-full h-full opacity-20">
              <path
                d="M15,25 Q25,20 35,22 Q45,18 55,25 Q60,22 65,28 Q75,25 85,30 L85,45 Q75,48 65,42 Q55,48 45,42 Q35,48 25,42 Q15,48 15,40 Z"
                fill="currentColor"
                className="text-blue-600 dark:text-blue-400"
              />
            </svg>

            {/* Region markers */}
            {regions.map(region => {
              const coords = REGION_COORDINATES[region.code];
              if (!coords) return null;

              const isSelected = settings.primaryRegion === region.code;

              return (
                <div
                  key={region.code}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                  onClick={() => region.status === 'active' && updatePrimaryRegion(region.code)}
                >
                  {/* Pulse animation for selected */}
                  {isSelected && (
                    <div className="absolute w-8 h-8 -inset-2 bg-blue-400 rounded-full animate-ping opacity-30"></div>
                  )}

                  {/* Marker */}
                  <div className={`w-4 h-4 rounded-full ${STATUS_COLORS[region.status]} ${
                    isSelected ? 'ring-4 ring-blue-300 dark:ring-blue-600' : ''
                  }`}></div>

                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {region.name}
                      {region.status !== 'active' && (
                        <span className="ml-1 text-yellow-400">({region.status.replace('_', ' ')})</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>{t('settings.active', 'Active')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>{t('settings.comingSoon', 'Coming Soon')}</span>
            </div>
          </div>
        </div>

        {/* Current Region */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t('settings.primaryRegion', 'Primary Region')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {regions.filter(r => r.status === 'active').map(region => (
              <button
                key={region.code}
                onClick={() => updatePrimaryRegion(region.code)}
                disabled={saving}
                className={`p-4 rounded-lg border-2 transition-all ${
                  settings.primaryRegion === region.code
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[region.status]}`}></div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900 dark:text-white">{region.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{region.code}</p>
                  </div>
                  {settings.primaryRegion === region.code && (
                    <svg className="w-5 h-5 text-blue-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Latency Test */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('settings.latencyTest', 'Latency Test')}
            </h2>
            <button
              onClick={runLatencyTest}
              disabled={testingLatency}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {testingLatency ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {t('settings.testing', 'Testing...')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {t('settings.runTest', 'Run Test')}
                </>
              )}
            </button>
          </div>

          {latencyResults.length > 0 ? (
            <div className="space-y-3">
              {latencyResults.map((result, idx) => (
                <div key={result.region} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {idx === 0 && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-full">
                        Best
                      </span>
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">{result.name}</span>
                  </div>
                  <span className={`font-mono font-semibold ${getLatencyColor(result.latency)}`}>
                    {result.latency !== null ? `${result.latency}ms` : 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              {t('settings.runLatencyTest', 'Run a latency test to find the best region for you')}
            </p>
          )}
        </div>

        {/* Bot Migration */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t('settings.botMigration', 'Bot Region Migration')}
          </h2>

          {bots.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              {t('settings.noBots', 'No bots to migrate')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      {t('settings.botName', 'Bot Name')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      {t('settings.currentRegion', 'Current Region')}
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                      {t('settings.migrateToRegion', 'Migrate To')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {bots.map(bot => (
                    <tr key={bot.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {bot.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {bot.region || 'us-east-1'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={bot.region || 'us-east-1'}
                          onChange={(e) => migrateBot(bot.id, e.target.value)}
                          disabled={migratingBot === bot.id}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          {regions.filter(r => r.status === 'active').map(region => (
                            <option key={region.code} value={region.code}>
                              {region.name}
                            </option>
                          ))}
                        </select>
                        {migratingBot === bot.id && (
                          <span className="ml-2 text-sm text-blue-600">Migrating...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
