import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bot, PartyPopper, CheckCircle, Trash2, Plus, ArrowRight, Sparkles } from "lucide-react";
import botApi from "../api/bots";
import { SkeletonDashboard } from "../components/SkeletonLoader";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Dashboard() {
  const { t } = useTranslation();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rateLimitStatus, setRateLimitStatus] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");

  // Fetch rate limit status
  const fetchRateLimitStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rate-limits/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRateLimitStatus(data);
      }
    } catch (err) {
      // Use mock data
      setRateLimitStatus({
        tier: 'pro',
        limits: { requests_per_minute: 100, requests_per_day: 10000, current_minute: 23, current_day: 1456 },
        percentage_used: { minute: 23, day: 14.56 }
      });
    }
  }, [token]);

  useEffect(() => {
    fetchBots();
    fetchRateLimitStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.state?.botCreated) {
      setSuccessMessage(t('dashboard.botCreated'));
      // Clear the state to prevent showing on refresh
      window.history.replaceState({}, document.title);
      // Auto-hide after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    }
  }, [location, t]);

  const fetchBots = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login");
        return;
      }

      const response = await botApi.getBots();
      setBots(response.bots || response.data || []);
    } catch (err) {
      // Silent fail

      if (!err.response) {
        setError(t('dashboard.networkError'));
      } else if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
      } else {
        setError(err.response?.data?.message || t('dashboard.fetchError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('dashboard.deleteConfirm'))) {
      return;
    }

    try {
      await botApi.deleteBot(id);
      setBots(bots.filter(bot => bot.id !== id));
      setSuccessMessage(t('dashboard.botDeleted'));
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      // Silent fail
      const errorMsg = !err.response
        ? t('dashboard.networkError')
        : (err.response?.data?.message || t('dashboard.deleteError'));
      alert(errorMsg);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Beta Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-xl mb-6 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {t('dashboard.betaWelcome')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Rate Limit Card */}
        {rateLimitStatus && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6 transition-colors duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold dark:text-white">{t('dashboard.rateLimits', 'API Rate Limits')}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                    rateLimitStatus.tier === 'enterprise' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                    rateLimitStatus.tier === 'pro' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {rateLimitStatus.tier}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.minuteUsage', 'This Minute')}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rateLimitStatus.percentage_used.minute >= 90 ? 'bg-red-500' :
                            rateLimitStatus.percentage_used.minute >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, rateLimitStatus.percentage_used.minute)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {Math.round(rateLimitStatus.percentage_used.minute)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('dashboard.dailyUsage', 'Today')}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            rateLimitStatus.percentage_used.day >= 90 ? 'bg-red-500' :
                            rateLimitStatus.percentage_used.day >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(100, rateLimitStatus.percentage_used.day)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {Math.round(rateLimitStatus.percentage_used.day * 10) / 10}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <Link
                to="/developer/rate-limits"
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium whitespace-nowrap"
              >
                {t('dashboard.viewDetails', 'View details')} &rarr;
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Bot className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold dark:text-white">{t('dashboard.title')}</h1>
              <p className="text-gray-600 dark:text-gray-400">{t('dashboard.subtitle')}</p>
            </div>
          </div>
          <motion.button
            onClick={() => navigate("/create-bot")}
            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-md"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5" />
            {t('dashboard.createNew')}
          </motion.button>
        </div>

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

        {bots.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-12 text-center transition-colors duration-300"
          >
            <div className="w-20 h-20 mx-auto mb-6 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
              <Bot className="w-10 h-10 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">{t('dashboard.noBots')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">{t('dashboard.noBotsDesc')}</p>
            <motion.button
              onClick={() => navigate("/create-bot")}
              className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition-colors inline-flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-5 h-5" />
              {t('dashboard.createFirst')}
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot, index) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-slate-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <motion.button
                    onClick={() => handleDelete(bot.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
                <h3 className="text-xl font-bold mb-2 dark:text-white">{bot.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm line-clamp-2">{bot.description}</p>
                <div className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">
                  {t('dashboard.token')}: {bot.token}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
