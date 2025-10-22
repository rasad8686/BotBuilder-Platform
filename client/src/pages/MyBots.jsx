import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://botbuilder-platform.onrender.com';

export default function MyBots() {
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
      setError('Failed to fetch bots');
    } finally {
      setLoading(false);
    }
  };

  const deleteBot = async (id) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/bots/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBots(bots.filter(bot => bot.id !== id));
    } catch (err) {
      setError('Failed to delete bot');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">My Bots 🤖</h1>
            <p className="text-gray-600">Manage your chatbots</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('/create-bot')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
              + Create New Bot
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700">
              Logout
            </button>
          </div>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        {bots.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold mb-2">No bots yet</h2>
            <p className="text-gray-600 mb-6">Create your first bot to get started!</p>
            <button onClick={() => navigate('/create-bot')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
              Create Your First Bot
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bots.map(bot => (
              <div key={bot.id} className="bg-white rounded-xl shadow p-6">
                <h3 className="text-xl font-bold mb-2">{bot.name}</h3>
                <p className="text-gray-600 mb-4">{bot.description}</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/edit-bot/${bot.id}`)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    Edit
                  </button>
                  <button onClick={() => deleteBot(bot.id)} className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700">
                    Delete
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