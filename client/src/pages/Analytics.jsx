import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Analytics() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBots: 0,
    totalMessages: 0,
    recentBots: [],
    messagesByType: {
      greeting: 0,
      response: 0,
      fallback: 0
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch bots
      const botsResponse = await axios.get('http://localhost:3000/bots', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const bots = botsResponse.data;
      let totalMessages = 0;
      const messageTypes = { greeting: 0, response: 0, fallback: 0 };
      
      // Fetch messages for each bot
      for (const bot of bots) {
        try {
          const messagesResponse = await axios.get(
            `http://localhost:3000/api/bots/${bot.id}/messages`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const messages = messagesResponse.data;
          totalMessages += messages.length;
          
          messages.forEach(msg => {
            if (messageTypes[msg.message_type] !== undefined) {
              messageTypes[msg.message_type]++;
            }
          });
        } catch (err) {
          console.error(`Error fetching messages for bot ${bot.id}:`, err);
        }
      }
      
      setStats({
        totalBots: bots.length,
        totalMessages,
        recentBots: bots.slice(0, 5),
        messagesByType: messageTypes
      });
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-700">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">BotBuilder</h1>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-purple-600 hover:text-purple-800 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
        </div>

        <h2 className="text-4xl font-bold text-gray-800 mb-2">Analytics 📊</h2>
        <p className="text-gray-600 mb-8">Overview of your chatbot statistics</p>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-2xl font-bold mb-2">Total Bots</h3>
            <p className="text-5xl font-bold">{stats.totalBots}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-2xl font-bold mb-2">Total Messages</h3>
            <p className="text-5xl font-bold">{stats.totalMessages}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="text-5xl mb-4">📈</div>
            <h3 className="text-2xl font-bold mb-2">Avg Messages/Bot</h3>
            <p className="text-5xl font-bold">
              {stats.totalBots > 0 ? Math.round(stats.totalMessages / stats.totalBots) : 0}
            </p>
          </div>
        </div>

        {/* Message Types Breakdown */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Messages by Type</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-yellow-50 rounded-xl">
              <div className="text-4xl mb-2">👋</div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Greeting</h4>
              <p className="text-3xl font-bold text-yellow-600">{stats.messagesByType.greeting}</p>
            </div>
            
            <div className="text-center p-6 bg-blue-50 rounded-xl">
              <div className="text-4xl mb-2">💬</div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Response</h4>
              <p className="text-3xl font-bold text-blue-600">{stats.messagesByType.response}</p>
            </div>
            
            <div className="text-center p-6 bg-red-50 rounded-xl">
              <div className="text-4xl mb-2">🤷</div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Fallback</h4>
              <p className="text-3xl font-bold text-red-600">{stats.messagesByType.fallback}</p>
            </div>
          </div>
        </div>

        {/* Recent Bots */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Recent Bots</h3>
          {stats.recentBots.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No bots created yet</p>
          ) : (
            <div className="space-y-4">
              {stats.recentBots.map((bot) => (
                <div
                  key={bot.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                  onClick={() => navigate(`/bot/${bot.id}/messages`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">🤖</div>
                    <div>
                      <h4 className="font-bold text-gray-800">{bot.name}</h4>
                      <p className="text-sm text-gray-600">{bot.description}</p>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 inline-block">
                        {bot.platform}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {new Date(bot.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/create-bot')}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition text-left"
          >
            <div className="text-4xl mb-2">➕</div>
            <h4 className="text-xl font-bold mb-1">Create New Bot</h4>
            <p className="text-sm opacity-90">Build a new chatbot from scratch</p>
          </button>

          <button
            onClick={() => navigate('/my-bots')}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition text-left"
          >
            <div className="text-4xl mb-2">📋</div>
            <h4 className="text-xl font-bold mb-1">Manage Bots</h4>
            <p className="text-sm opacity-90">View and edit your existing bots</p>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Analytics;