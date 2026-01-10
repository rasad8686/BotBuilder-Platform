import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, CheckCircle, AlertTriangle, Smartphone, Monitor } from 'lucide-react';
import api from '../api/axios';
import BackupCodesExport from '../components/BackupCodesExport';

export default function SecuritySettings() {
  const { t } = useTranslation();

  // 2FA State
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFALoading, setTwoFALoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Disable 2FA State
  const [showDisable, setShowDisable] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(null);

  // User Info
  const [userEmail, setUserEmail] = useState('');

  // Check 2FA status on load
  useEffect(() => {
    check2FAStatus();
    loadSessions();
    // Get user email from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        setUserEmail(user.email || '');
      } catch (e) {
        // Error parsing user data - silent fail
      }
    }
  }, []);

  const check2FAStatus = async () => {
    try {
      setTwoFALoading(true);
      const response = await api.get('/api/auth/2fa/status');
      setTwoFAEnabled(response.data.enabled);
    } catch (error) {
      // Error checking 2FA status - silent fail
    } finally {
      setTwoFALoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      setSessionsLoading(true);
      const response = await api.get('/api/sessions');
      setSessions(response.data.sessions || []);
    } catch (error) {
      // Error loading sessions - silent fail
    } finally {
      setSessionsLoading(false);
    }
  };

  const setup2FA = async () => {
    try {
      setVerifyError('');
      const response = await api.post('/api/auth/2fa/setup');
      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
      setBackupCodes(response.data.backupCodes || []);
      setShowSetup(true);
    } catch (error) {
      setVerifyError(error.response?.data?.message || 'Failed to setup 2FA');
    }
  };

  const verify2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setVerifyError('Please enter a 6-digit code');
      return;
    }

    try {
      setVerifyLoading(true);
      setVerifyError('');
      await api.post('/api/auth/2fa/verify', { code: verifyCode });
      setTwoFAEnabled(true);
      setShowSetup(false);
      setVerifyCode('');
      alert(t('security.twoFactor.success'));
    } catch (error) {
      setVerifyError(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setVerifyLoading(false);
    }
  };

  const disable2FA = async () => {
    if (!disablePassword) {
      setDisableError('Password is required');
      return;
    }

    try {
      setDisableLoading(true);
      setDisableError('');
      await api.post('/api/auth/2fa/disable', {
        password: disablePassword,
        code: disableCode
      });
      setTwoFAEnabled(false);
      setShowDisable(false);
      setDisablePassword('');
      setDisableCode('');
      alert(t('security.twoFactor.disabledSuccess'));
    } catch (error) {
      setDisableError(error.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  const logoutSession = async (sessionId) => {
    try {
      setLogoutLoading(sessionId);
      await api.delete(`/api/sessions/${sessionId}`);
      setSessions(sessions.filter(s => s.id !== sessionId));
    } catch (error) {
      // Error logging out session - silent fail
      alert('Failed to logout session');
    } finally {
      setLogoutLoading(null);
    }
  };

  const logoutAllSessions = async () => {
    if (!confirm(t('security.sessions.logoutAll') + '?')) {
      return;
    }

    try {
      setLogoutLoading('all');
      const response = await api.delete('/api/sessions');
      loadSessions();
      alert(t('security.sessions.logoutSuccess', { count: response.data.terminatedCount }));
    } catch (error) {
      // Error logging out all sessions - silent fail
      alert('Failed to logout from other devices');
    } finally {
      setLogoutLoading(null);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-2">
            {t('security.title')}
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            {t('security.description')}
          </p>
        </div>

        {/* Two-Factor Authentication Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-6 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Lock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                {t('security.twoFactor.title')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('security.twoFactor.description')}
              </p>
            </div>
          </div>

          {twoFALoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : twoFAEnabled ? (
            <div>
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
                <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-400">
                    {t('security.twoFactor.enabled')}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    {t('security.twoFactor.enabledDesc')}
                  </p>
                </div>
              </div>

              {!showDisable ? (
                <button
                  onClick={() => setShowDisable(true)}
                  className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  {t('security.twoFactor.disable')}
                </button>
              ) : (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h3 className="font-semibold text-red-800 dark:text-red-400 mb-4">
                    {t('security.twoFactor.disableTitle')}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('security.twoFactor.password')}
                      </label>
                      <div className="relative">
                        <input
                          type={showDisablePassword ? "text" : "password"}
                          value={disablePassword}
                          onChange={(e) => setDisablePassword(e.target.value)}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                          placeholder={t('security.twoFactor.passwordPlaceholder')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowDisablePassword(!showDisablePassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showDisablePassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('security.twoFactor.code')}
                      </label>
                      <input
                        type="text"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder={t('security.twoFactor.codePlaceholder')}
                        maxLength={6}
                      />
                    </div>
                    {disableError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{disableError}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={disable2FA}
                        disabled={disableLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {disableLoading ? t('security.twoFactor.disabling') : t('security.twoFactor.disable')}
                      </button>
                      <button
                        onClick={() => {
                          setShowDisable(false);
                          setDisablePassword('');
                          setDisableCode('');
                          setDisableError('');
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : showSetup ? (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('security.twoFactor.scanQR')}
                </p>
                <div className="inline-block p-4 bg-white rounded-lg shadow-md">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              {/* Manual Entry */}
              <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('security.twoFactor.manualEntry')}
                </p>
                <code className="block p-3 bg-white dark:bg-slate-800 rounded font-mono text-sm break-all text-gray-800 dark:text-white">
                  {secret}
                </code>
              </div>

              {/* Backup Codes */}
              {backupCodes.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
                    {t('security.twoFactor.backupCodes')}
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-500 mb-3">
                    {t('security.twoFactor.backupCodesDesc')}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, index) => (
                      <code
                        key={index}
                        className="p-2 bg-white dark:bg-slate-800 rounded font-mono text-sm text-center text-gray-800 dark:text-white"
                      >
                        {code}
                      </code>
                    ))}
                  </div>

                  {/* Export Buttons */}
                  <BackupCodesExport backupCodes={backupCodes} userEmail={userEmail} />
                </div>
              )}

              {/* Verification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('security.twoFactor.enterCode')}
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white text-center text-xl tracking-widest font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="000000"
                    maxLength={6}
                  />
                  <button
                    onClick={verify2FA}
                    disabled={verifyLoading || verifyCode.length !== 6}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold transition-colors"
                  >
                    {verifyLoading ? t('security.twoFactor.verifying') : t('security.twoFactor.verify')}
                  </button>
                </div>
                {verifyError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{verifyError}</p>
                )}
              </div>

              <button
                onClick={() => {
                  setShowSetup(false);
                  setQrCode('');
                  setSecret('');
                  setBackupCodes([]);
                  setVerifyCode('');
                  setVerifyError('');
                }}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
              >
                {t('security.twoFactor.cancelSetup')}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                    {t('security.twoFactor.disabled')}
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-500">
                    {t('security.twoFactor.disabledDesc')}
                  </p>
                </div>
              </div>
              <button
                onClick={setup2FA}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors"
              >
                {t('security.twoFactor.enable')}
              </button>
            </div>
          )}
        </div>

        {/* Active Sessions Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {t('security.sessions.title')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('security.sessions.description')}
                </p>
              </div>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={logoutAllSessions}
                disabled={logoutLoading === 'all'}
                className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {logoutLoading === 'all' ? t('security.sessions.loggingOut') : t('security.sessions.logoutAll')}
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              {t('security.sessions.noSessions')}
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 rounded-lg border ${
                    session.isCurrent
                      ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-slate-600 rounded-lg flex items-center justify-center">
                        {session.deviceInfo?.includes('Mobile') ? (
                          <Smartphone className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        ) : (
                          <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 dark:text-white">
                            {session.deviceInfo || t('security.sessions.unknownDevice')}
                          </p>
                          {session.isCurrent && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                              {t('security.sessions.current')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('security.sessions.ip')}: {session.ipAddress || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {t('security.sessions.lastActive')}: {formatDate(session.lastActivity)}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => logoutSession(session.id)}
                        disabled={logoutLoading === session.id}
                        className="px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors text-sm"
                      >
                        {logoutLoading === session.id ? t('security.sessions.loggingOut') : t('security.sessions.logout')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
