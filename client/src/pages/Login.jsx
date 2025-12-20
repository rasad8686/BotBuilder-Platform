import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://botbuilder-platform.onrender.com";

function Login() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // SSO state
  const [ssoInfo, setSsoInfo] = useState(null);
  const [, setCheckingSSO] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const ssoCheckTimeout = useRef(null);

  // Rate limiting countdown state
  const [blockedUntil, setBlockedUntil] = useState(null);
  const [countdown, setCountdown] = useState("");
  const countdownRef = useRef(null);

  // Check for SSO error from callback
  useEffect(() => {
    const ssoError = searchParams.get('error');
    const ssoMessage = searchParams.get('message');
    if (ssoError === 'sso_failed' && ssoMessage) {
      setError(decodeURIComponent(ssoMessage));
    }
  }, [searchParams]);

  // Countdown timer effect
  useEffect(() => {
    if (!blockedUntil) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const blocked = new Date(blockedUntil);
      const diff = blocked - now;

      if (diff <= 0) {
        setBlockedUntil(null);
        setCountdown("");
        setError("");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [blockedUntil]);

  // Check SSO when email changes
  useEffect(() => {
    if (ssoCheckTimeout.current) {
      clearTimeout(ssoCheckTimeout.current);
    }

    const email = formData.email.trim();
    if (!email || !email.includes('@')) {
      setSsoInfo(null);
      return;
    }

    ssoCheckTimeout.current = setTimeout(async () => {
      try {
        setCheckingSSO(true);
        const response = await axios.get(`${API_BASE_URL}/api/sso/check?email=${encodeURIComponent(email)}`);
        if (response.data.ssoAvailable) {
          setSsoInfo(response.data);
        } else {
          setSsoInfo(null);
        }
      } catch (err) {
        setSsoInfo(null);
      } finally {
        setCheckingSSO(false);
      }
    }, 500);

    return () => {
      if (ssoCheckTimeout.current) {
        clearTimeout(ssoCheckTimeout.current);
      }
    };
  }, [formData.email]);

  // Handle SSO login
  const handleSSOLogin = async () => {
    if (!formData.email) return;

    try {
      setSsoLoading(true);
      const domain = formData.email.split('@')[1];
      const response = await axios.get(`${API_BASE_URL}/api/sso/login/${domain}?returnUrl=/dashboard`);

      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (err) {
      setError(err.response?.data?.error || t('sso.loginError', 'Failed to initiate SSO login'));
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const loginData = {
        ...formData,
        ...(requires2FA && twoFactorCode ? { twoFactorCode } : {})
      };

      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, loginData, {
        withCredentials: true
      });

      // Handle 2FA required
      if (response.data.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        if (response.data.user?.currentOrganizationId) {
          localStorage.setItem("currentOrganizationId", response.data.user.currentOrganizationId);
        }
        navigate("/dashboard");
      } else {
        setError("Login failed - no token received");
      }
    } catch (err) {
      // Check if user is blocked (rate limited)
      if (err.response?.data?.blocked && err.response?.data?.blockedUntil) {
        setBlockedUntil(err.response.data.blockedUntil);
        setError(t('auth.tooManyAttempts', 'Too many login attempts. Please try again in'));
      } else {
        setBlockedUntil(null);
        setError(err.response?.data?.message || err.response?.data?.error || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-500 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">BotBuilder</h1>
        <p className="text-gray-600 text-center mb-6">{t('auth.login')}</p>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {blockedUntil && countdown ? (
              <div className="text-center">
                <p className="font-semibold">{error}</p>
                <p className="text-2xl font-mono font-bold mt-2">{countdown}</p>
              </div>
            ) : (
              error
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!requires2FA ? (
            <>
              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">{t('auth.email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Show password field only if SSO is not enforced */}
              {(!ssoInfo?.requiresSSO) && (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-semibold mb-2">{t('auth.password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={!ssoInfo?.ssoAvailable}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
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

                  <div className="mb-6 text-right">
                    <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                      {t('auth.forgotPassword')}
                    </a>
                  </div>
                </>
              )}

              {/* SSO Button */}
              {ssoInfo?.ssoAvailable && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleSSOLogin}
                    disabled={ssoLoading}
                    className={`w-full py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2 ${
                      ssoInfo.provider === 'azure_ad' ? 'bg-[#0078d4] hover:bg-[#106ebe] text-white' :
                      ssoInfo.provider === 'google' ? 'bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700' :
                      ssoInfo.provider === 'okta' ? 'bg-[#007dc1] hover:bg-[#006ba1] text-white' :
                      'bg-gray-800 hover:bg-gray-900 text-white'
                    }`}
                  >
                    {ssoLoading ? (
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : ssoInfo.provider === 'azure_ad' ? (
                      <svg className="h-5 w-5" viewBox="0 0 23 23" fill="currentColor">
                        <path d="M0 0h11v11H0V0zm12 0h11v11H12V0zM0 12h11v11H0V12zm12 0h11v11H12V12z"/>
                      </svg>
                    ) : ssoInfo.provider === 'google' ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    ) : ssoInfo.provider === 'okta' ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.389 0 0 5.389 0 12s5.389 12 12 12 12-5.389 12-12S18.611 0 12 0zm0 18c-3.314 0-6-2.686-6-6s2.686-6 6-6 6 2.686 6 6-2.686 6-6 6z"/>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )}
                    {ssoInfo.provider === 'azure_ad' ? t('sso.signInWithAzure', 'Sign in with Microsoft') :
                     ssoInfo.provider === 'google' ? t('sso.signInWithGoogle', 'Sign in with Google') :
                     ssoInfo.provider === 'okta' ? t('sso.signInWithOkta', 'Sign in with Okta') :
                     `${t('sso.signInWithSSO', 'Sign in with')} ${ssoInfo.providerName || 'SSO'}`}
                  </button>
                  {!ssoInfo.ssoRequired && (
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">{t('auth.or', 'or')}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SSO Enforced Message */}
              {ssoInfo?.requiresSSO && (
                <p className="text-sm text-gray-600 text-center mb-4">
                  {t('sso.ssoRequired', 'Your organization requires SSO authentication')}
                </p>
              )}
            </>
          ) : (
            <div className="mb-6">
              <div className="text-center mb-4">
                <span className="text-4xl">🔐</span>
                <h2 className="text-xl font-semibold text-gray-800 mt-2">Two-Factor Authentication</h2>
                <p className="text-sm text-gray-600 mt-1">Enter the 6-digit code from your authenticator app</p>
              </div>
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="w-full mt-3 text-sm text-gray-600 hover:text-gray-800"
              >
                Back to login
              </button>
            </div>
          )}

          {/* Hide password login button when SSO is enforced */}
          {!ssoInfo?.requiresSSO && (
            <button
              type="submit"
              disabled={loading || (requires2FA && twoFactorCode.length !== 6) || !!blockedUntil}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
            {loading ? t('auth.loggingIn') : (requires2FA ? 'Verify' : t('auth.login'))}
            </button>
          )}
        </form>

        {!requires2FA && (
          <p className="text-center mt-6 text-gray-600">
            {t('auth.noAccount')} <a href="/register" className="text-blue-600 hover:underline">{t('auth.register')}</a>
          </p>
        )}
      </div>
    </div>
  );
}

export default Login;
