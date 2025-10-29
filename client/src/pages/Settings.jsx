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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">{t('settings.title')}</h1>
          <p className="text-gray-600">{t('settings.subtitle')}</p>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('settings.accountInfo')}</h2>
          {user && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('settings.name')}</label>
                <p className="text-gray-800">{user.name || t('settings.notSet')}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('settings.email')}</label>
                <p className="text-gray-800">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">{t('settings.userId')}</label>
                <p className="text-gray-800 font-mono">{user.id}</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('settings.quickLinks')}</h2>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/billing')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 border border-gray-200 flex items-center justify-between"
            >
              <span className="font-semibold text-gray-800">{t('settings.billingSubscription')}</span>
              <span>→</span>
            </button>
            <button
              onClick={() => navigate('/api-tokens')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 border border-gray-200 flex items-center justify-between"
            >
              <span className="font-semibold text-gray-800">{t('sidebar.apiTokens')}</span>
              <span>→</span>
            </button>
            <button
              onClick={() => navigate('/webhooks')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 border border-gray-200 flex items-center justify-between"
            >
              <span className="font-semibold text-gray-800">{t('sidebar.webhooks')}</span>
              <span>→</span>
            </button>
            <button
              onClick={() => navigate('/usage')}
              className="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 border border-gray-200 flex items-center justify-between"
            >
              <span className="font-semibold text-gray-800">{t('sidebar.usage')}</span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-red-200">
          <h2 className="text-2xl font-bold text-red-600 mb-6">{t('settings.dangerZone')}</h2>
          <div className="space-y-4">
            <button
              onClick={() => alert(t('settings.deleteNotImplemented'))}
              className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold"
            >
              {t('settings.deleteAccount')}
            </button>
            <p className="text-sm text-gray-600">
              ⚠️ {t('settings.deleteWarning')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
