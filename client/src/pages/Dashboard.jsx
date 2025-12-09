import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import botApi from "../api/bots";

function Dashboard() {
  const { t } = useTranslation();
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchBots();
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
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="text-2xl dark:text-white">{t('dashboard.loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Beta Banner */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-6 py-4 rounded-lg mb-6 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div className="flex-1">
              <p className="font-medium">
                {t('dashboard.betaWelcome')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">{t('dashboard.title')} 🤖</h1>
            <p className="text-gray-600 dark:text-gray-400">{t('dashboard.subtitle')}</p>
          </div>
          <button
            onClick={() => navigate("/create-bot")}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
          >
            + {t('dashboard.createNew')}
          </button>
        </div>

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6 flex items-center gap-2">
            ✅ {successMessage}
          </div>
        )}

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

        {bots.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-12 text-center transition-colors duration-300">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold mb-2 dark:text-white">{t('dashboard.noBots')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('dashboard.noBotsDesc')}</p>
            <button
              onClick={() => navigate("/create-bot")}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              {t('dashboard.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div key={bot.id} className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                  <div className="text-3xl">🤖</div>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </div>
                <h3 className="text-xl font-bold mb-2 dark:text-white">{bot.name}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{bot.description}</p>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {t('dashboard.token')}: {bot.token}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
