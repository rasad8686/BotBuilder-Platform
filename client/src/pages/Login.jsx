import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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

  // Rate limiting countdown state
  const [blockedUntil, setBlockedUntil] = useState(null);
  const [countdown, setCountdown] = useState("");
  const countdownRef = useRef(null);

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

              <div className="mb-4">
                <label className="block text-gray-700 font-semibold mb-2">{t('auth.password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
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

          <button
            type="submit"
            disabled={loading || (requires2FA && twoFactorCode.length !== 6) || !!blockedUntil}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('auth.loggingIn') : (requires2FA ? 'Verify' : t('auth.login'))}
          </button>
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
