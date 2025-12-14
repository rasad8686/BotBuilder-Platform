import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';

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
  const [disableCode, setDisableCode] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');

  // Sessions State
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(null);

  // Check 2FA status on load
  useEffect(() => {
    check2FAStatus();
    loadSessions();
  }, []);

  const check2FAStatus = async () => {
    try {
      setTwoFALoading(true);
      const response = await api.get('/api/auth/2fa/status');
      setTwoFAEnabled(response.data.enabled);
    } catch (error) {
      console.error('Error checking 2FA status:', error);
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
      console.error('Error loading sessions:', error);
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
      alert('Two-factor authentication enabled successfully!');
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
      alert('Two-factor authentication disabled');
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
      console.error('Error logging out session:', error);
      alert('Failed to logout session');
    } finally {
      setLogoutLoading(null);
    }
  };

  const logoutAllSessions = async () => {
    if (!confirm('Are you sure you want to logout from all other devices?')) {
      return;
    }

    try {
      setLogoutLoading('all');
      const response = await api.delete('/api/sessions');
      loadSessions();
      alert(`Logged out from ${response.data.terminatedCount} device(s)`);
    } catch (error) {
      console.error('Error logging out all sessions:', error);
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
            Security Settings
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Manage your account security and active sessions
          </p>
        </div>

        {/* Two-Factor Authentication Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-6 transition-colors duration-300">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">🔐</span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                Two-Factor Authentication
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add an extra layer of security to your account
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
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800 dark:text-green-400">
                    2FA is Enabled
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    Your account is protected with two-factor authentication
                  </p>
                </div>
              </div>

              {!showDisable ? (
                <button
                  onClick={() => setShowDisable(true)}
                  className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  Disable 2FA
                </button>
              ) : (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <h3 className="font-semibold text-red-800 dark:text-red-400 mb-4">
                    Disable Two-Factor Authentication
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Your Password
                      </label>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="Enter your password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        2FA Code (optional)
                      </label>
                      <input
                        type="text"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        placeholder="6-digit code"
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
                        {disableLoading ? 'Disabling...' : 'Disable 2FA'}
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
                        Cancel
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
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="inline-block p-4 bg-white rounded-lg shadow-md">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              {/* Manual Entry */}
              <div className="p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Or enter this code manually:
                </p>
                <code className="block p-3 bg-white dark:bg-slate-800 rounded font-mono text-sm break-all text-gray-800 dark:text-white">
                  {secret}
                </code>
              </div>

              {/* Backup Codes */}
              {backupCodes.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
                    Backup Codes (Save these!)
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-500 mb-3">
                    Use these codes if you lose access to your authenticator app
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
                </div>
              )}

              {/* Verification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter the 6-digit code from your authenticator app
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
                    {verifyLoading ? 'Verifying...' : 'Verify'}
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
                Cancel Setup
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-yellow-800 dark:text-yellow-400">
                    2FA is Disabled
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-500">
                    Your account is less secure without two-factor authentication
                  </p>
                </div>
              </div>
              <button
                onClick={setup2FA}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors"
              >
                Enable 2FA
              </button>
            </div>
          )}
        </div>

        {/* Active Sessions Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 transition-colors duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📱</span>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                  Active Sessions
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage your logged-in devices
                </p>
              </div>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={logoutAllSessions}
                disabled={logoutLoading === 'all'}
                className="px-4 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {logoutLoading === 'all' ? 'Logging out...' : 'Logout All Others'}
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400 py-8">
              No active sessions found
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
                      <div className="text-2xl">
                        {session.deviceInfo?.includes('Mobile') ? '📱' : '💻'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 dark:text-white">
                            {session.deviceInfo || 'Unknown Device'}
                          </p>
                          {session.isCurrent && (
                            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          IP: {session.ipAddress || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Last active: {formatDate(session.lastActivity)}
                        </p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => logoutSession(session.id)}
                        disabled={logoutLoading === session.id}
                        className="px-3 py-1.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors text-sm"
                      >
                        {logoutLoading === session.id ? 'Logging out...' : 'Logout'}
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
