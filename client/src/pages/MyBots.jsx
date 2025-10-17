import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

// CRITICAL: Use environment variable for API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function MyBots() {
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Fetching bots from:', API_BASE_URL);
      
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/bots`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('Bots response:', response.data);

      if (response.data.success) {
        setBots(response.data.bots || []);
      } else {
        setError(response.data.message || 'Failed to fetch bots');
      }
    } catch (err) {
      console.error('Fetch bots error:', err);
      setError('Failed to fetch bots');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this bot?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API_BASE_URL}/bots/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setBots(bots.filter((bot) => bot.id !== id));
        alert('Bot deleted successfully!');
      }
    } catch (err) {
      console.error('Delete bot error:', err);
      alert('Failed to delete bot');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">BotBuilder</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="text-blue-600 hover:underline flex items-center"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              My Bots 🤖
            </h2>
            <p className="text-gray-600 mt-1">Manage your chatbots</p>
          </div>
          <Link
            to="/create-bot"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            + Create New Bot
          </Link>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading bots...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && bots.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-2">
              No bots yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first bot to get started!
            </p>
            <Link
              to="/create-bot"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Create Your First Bot
            </Link>
          </div>
        )}

        {/* Bots Grid */}
        {!loading && bots.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">
                      {bot.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {bot.status || 'Active'}
                    </p>
                  </div>
                  <span className="text-2xl">🤖</span>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Token:</span>{' '}
                    {bot.token?.substring(0, 20)}...
                  </p>
                  {bot.description && (
                    <p className="text-sm text-gray-600">{bot.description}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/bot/${bot.id}/edit`}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-center hover:bg-blue-700"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(bot.id)}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Debug Info */}
        <div className="mt-8 p-4 bg-gray-100 rounded text-xs text-gray-600">
          API: {API_BASE_URL}
        </div>
      </main>
    </div>
  );
}

export default MyBots;

