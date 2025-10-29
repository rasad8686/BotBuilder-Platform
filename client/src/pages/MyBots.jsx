import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://botbuilder-platform.onrender.com';

export default function MyBots() {
  const { t } = useTranslation();
  const [bots, setBots] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/bots`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBots(response.data.bots || []);
    } catch (err) {
      setError(t('myBots.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (id) => {
    if (!confirm(t('myBots.deleteConfirm'))) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/bots/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBots(bots.filter(bot => bot.id !== id));
    } catch (err) {
      setError(t('myBots.deleteError'));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('myBots.loading')}</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">{t('myBots.title')} 🤖</h1>
            <p className="text-gray-600">{t('myBots.subtitle')}</p>
          </div>
          <button onClick={() => navigate('/create-bot')} className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
            + {t('myBots.createNew')}
          </button>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        {bots.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold mb-2">{t('myBots.noBots')}</h2>
            <p className="text-gray-600 mb-6">{t('myBots.noBotsDesc')}</p>
            <button onClick={() => navigate('/create-bot')} className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
              {t('myBots.createFirst')}
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bots.map(bot => (
              <div key={bot.id} className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold mb-2">{bot.name}</h3>
                <p className="text-gray-600 mb-4">{bot.description}</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/bot/${bot.id}/edit`)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    {t('myBots.edit')}
                  </button>
                  <button onClick={() => navigate(`/bot/${bot.id}/messages`)} className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                    {t('myBots.messages')}
                  </button>
                  <button onClick={() => deleteBot(bot.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                    {t('myBots.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}