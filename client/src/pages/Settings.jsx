import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">{t('settings.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>

        {/* Account Information */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-6 transition-colors duration-300">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('settings.accountInfo')}</h2>
          {user && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('settings.name')}</label>
                <p className="text-gray-800 dark:text-white">{user.name || t('settings.notSet')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('settings.email')}</label>
                <p className="text-gray-800 dark:text-white">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">{t('settings.userId')}</label>
                <p className="text-gray-800 dark:text-white font-mono">{user.id}</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-6 transition-colors duration-300">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">{t('settings.quickLinks')}</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/billing')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-between transition-colors"
            >
              <span className="font-semibold text-gray-800 dark:text-white">{t('settings.billingSubscription')}</span>
              <span className="text-gray-600 dark:text-gray-400">→</span>
            </button>
            <button
              onClick={() => navigate('/api-tokens')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-between transition-colors"
            >
              <span className="font-semibold text-gray-800 dark:text-white">{t('sidebar.apiTokens')}</span>
              <span className="text-gray-600 dark:text-gray-400">→</span>
            </button>
            <button
              onClick={() => navigate('/webhooks')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-between transition-colors"
            >
              <span className="font-semibold text-gray-800 dark:text-white">{t('sidebar.webhooks')}</span>
              <span className="text-gray-600 dark:text-gray-400">→</span>
            </button>
            <button
              onClick={() => navigate('/usage')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-between transition-colors"
            >
              <span className="font-semibold text-gray-800 dark:text-white">{t('sidebar.usage')}</span>
              <span className="text-gray-600 dark:text-gray-400">→</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 border border-red-200 dark:border-red-800 transition-colors duration-300">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-6">{t('settings.dangerZone')}</h2>
          <div className="space-y-4">
            <button
              onClick={() => alert(t('settings.deleteNotImplemented'))}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              {t('settings.deleteAccount')}
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ⚠️ {t('settings.deleteWarning')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
