import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrand } from '../contexts/BrandContext';
import api from '../api/axios';

export default function AdminLogin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { brand } = useBrand();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('credentials'); // credentials | 2fa | setup2fa
  const [, setAttempts] = useState(0);

  // Check if already logged in as admin
  useEffect(() => {
    const checkAdminSession = async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        try {
          const response = await api.get('/api/admin-auth/session', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.data.success) {
            // Already logged in as admin
            if (response.data.data.user.isSuperAdmin) {
              navigate('/superadmin/dashboard');
            } else {
              navigate('/admin/dashboard');
            }
          }
        } catch {
          localStorage.removeItem('adminToken');
        }
      }
    };
    checkAdminSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/admin-auth/login', {
        email,
        password,
        twoFactorCode: step === '2fa' ? twoFactorCode : undefined
      });

      if (response.data.require2FA) {
        // Need to enter 2FA code
        setStep('2fa');
        setLoading(false);
        return;
      }

      if (response.data.require2FASetup) {
        // Need to setup 2FA first
        setStep('setup2fa');
        setLoading(false);
        return;
      }

      if (response.data.success) {
        // Store admin token separately
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', JSON.stringify(response.data.user));

        // Also set as regular token for API calls
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // Redirect based on role
        if (response.data.user.isSuperAdmin) {
          navigate('/superadmin/dashboard');
        } else {
          navigate('/admin/dashboard');
        }
      }
    } catch (err) {
      const message = err.response?.data?.message || t('adminLogin.error', 'Login failed');
      setError(message);
      setAttempts(prev => prev + 1);

      // Show rate limit warning
      if (err.response?.status === 429) {
        setError(t('adminLogin.tooManyAttempts', 'Too many login attempts. Please try again in 15 minutes.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('credentials');
    setTwoFactorCode('');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative max-w-md w-full space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {brand?.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.brand_name || 'Admin'}
                className="h-16 w-16 object-contain"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">&#128274;</span>
              </div>
            )}
          </div>
          <h2 className="text-3xl font-extrabold text-white">
            {t('adminLogin.title', 'Admin Login')}
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            {t('adminLogin.subtitle', 'Secure access for administrators')}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="px-3 py-1 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full shadow-lg">
              {t('adminLogin.secureLogin', 'SECURE LOGIN')}
            </span>
            <span className="px-3 py-1 text-xs font-medium text-purple-300 bg-purple-900/50 rounded-full border border-purple-700">
              {t('adminLogin.requires2FA', '2FA Required')}
            </span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-300 text-sm text-center">{error}</p>
            </div>
          )}

          {/* Setup 2FA Required */}
          {step === 'setup2fa' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center">
                <span className="text-3xl">&#9888;&#65039;</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                {t('adminLogin.setup2FARequired', '2FA Setup Required')}
              </h3>
              <p className="text-gray-400">
                {t('adminLogin.setup2FAMessage', 'Two-factor authentication is mandatory for admin access. Please enable 2FA in your security settings first.')}
              </p>
              <div className="flex flex-col gap-3 mt-6">
                <Link
                  to="/login"
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors text-center"
                >
                  {t('adminLogin.goToRegularLogin', 'Go to Regular Login')}
                </Link>
                <button
                  onClick={handleBack}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                >
                  {t('common.back', 'Back')}
                </button>
              </div>
            </div>
          )}

          {/* Credentials Step */}
          {step === 'credentials' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('adminLogin.email', 'Email Address')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  {t('adminLogin.password', 'Password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? (
                      <span>&#128065;</span>
                    ) : (
                      <span>&#128064;</span>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{t('adminLogin.verifying', 'Verifying...')}</span>
                  </>
                ) : (
                  <>
                    <span>&#128274;</span>
                    <span>{t('adminLogin.continue', 'Continue')}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2FA Step */}
          {step === '2fa' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl">&#128272;</span>
                </div>
                <h3 className="text-xl font-bold text-white">
                  {t('adminLogin.enter2FA', 'Enter 2FA Code')}
                </h3>
                <p className="text-gray-400 text-sm mt-2">
                  {t('adminLogin.enter2FAMessage', 'Enter the 6-digit code from your authenticator app')}
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  autoFocus
                  className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-lg text-white text-center text-2xl font-mono tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="000000"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                >
                  {t('common.back', 'Back')}
                </button>
                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length !== 6}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>&#9989;</span>
                      <span>{t('adminLogin.verify', 'Verify')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Footer Links */}
          {step === 'credentials' && (
            <div className="mt-6 text-center space-y-3">
              <Link
                to="/login"
                className="block text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {t('adminLogin.regularLogin', 'Not an admin? Use regular login')}
              </Link>
              <Link
                to="/forgot-password"
                className="block text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                {t('adminLogin.forgotPassword', 'Forgot your password?')}
              </Link>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            {t('adminLogin.securityNotice', 'This login is monitored and logged. Unauthorized access attempts will be reported.')}
          </p>
        </div>
      </div>
    </div>
  );
}
