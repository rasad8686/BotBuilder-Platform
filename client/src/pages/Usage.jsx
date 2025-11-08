import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function Usage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/analytics/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading usage data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Usage & Analytics</h1>
          <p className="text-gray-600">Monitor your platform usage and statistics</p>
        </div>

        {dashboardData && (
          <>
            {/* Current Plan Card */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white mb-8">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-3xl font-bold mb-2">{dashboardData.subscription.display_name}</h2>
                  <p className="text-purple-100">
                    {dashboardData.subscription.plan_name === 'free'
                      ? 'Free Plan'
                      : `Your current subscription plan`}
                  </p>
                </div>
                {dashboardData.subscription.plan_name === 'free' && (
                  <button
                    onClick={() => navigate('/billing')}
                    className="px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 font-semibold"
                  >
                    Upgrade Plan
                  </button>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Bots */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">🤖</div>
                  <span className={`text-2xl font-bold ${
                    dashboardData.bots.percentage > 80 ? 'text-orange-600' : 'text-purple-600'
                  }`}>
                    {dashboardData.bots.total}
                  </span>
                </div>
                <h3 className="text-gray-600 font-semibold mb-2">Total Bots</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Limit: {dashboardData.bots.limit === -1 ? '∞' : dashboardData.bots.limit}
                  </span>
                  <span className={`font-semibold ${
                    dashboardData.bots.percentage > 80 ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    {dashboardData.bots.limit === -1 ? '0' : Math.round(dashboardData.bots.percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      dashboardData.bots.percentage >= 100 ? 'bg-red-500' :
                      dashboardData.bots.percentage > 80 ? 'bg-orange-500' :
                      'bg-purple-600'
                    }`}
                    style={{
                      width: dashboardData.bots.limit === -1
                        ? '10%'
                        : `${Math.min(dashboardData.bots.percentage, 100)}%`
                    }}
                  ></div>
                </div>
                {!dashboardData.bots.canCreateMore && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ Limit reached
                  </p>
                )}
              </div>

              {/* Messages */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📨</div>
                  <span className={`text-2xl font-bold ${
                    dashboardData.messages.percentage > 80 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {dashboardData.messages.total.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-gray-600 font-semibold mb-2">Messages (Month)</h3>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Limit: {dashboardData.messages.limit === -1 ? '∞' : dashboardData.messages.limit.toLocaleString()}
                  </span>
                  <span className={`font-semibold ${
                    dashboardData.messages.percentage > 80 ? 'text-orange-600' : 'text-gray-600'
                  }`}>
                    {dashboardData.messages.limit === -1 ? '0' : Math.round(dashboardData.messages.percentage)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full ${
                      dashboardData.messages.percentage >= 100 ? 'bg-red-500' :
                      dashboardData.messages.percentage > 80 ? 'bg-orange-500' :
                      'bg-green-600'
                    }`}
                    style={{
                      width: dashboardData.messages.limit === -1
                        ? '10%'
                        : `${Math.min(dashboardData.messages.percentage, 100)}%`
                    }}
                  ></div>
                </div>
                {dashboardData.messages.percentage > 80 && dashboardData.messages.limit !== -1 && (
                  <p className="text-xs text-orange-600 mt-2">
                    ⚠️ {dashboardData.messages.percentage >= 100 ? 'Limit reached' : 'Approaching limit'}
                  </p>
                )}
              </div>

              {/* Messages Sent */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📤</div>
                  <span className="text-2xl font-bold text-blue-600">
                    {dashboardData.messages.sent.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-gray-600 font-semibold mb-2">Sent</h3>
                <p className="text-sm text-gray-500">Messages sent this month</p>
              </div>

              {/* Messages Received */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl">📥</div>
                  <span className="text-2xl font-bold text-indigo-600">
                    {dashboardData.messages.received.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-gray-600 font-semibold mb-2">Received</h3>
                <p className="text-sm text-gray-500">Messages received this month</p>
              </div>
            </div>

            {/* Warning Messages */}
            {(dashboardData.messages.percentage > 80 && dashboardData.messages.limit !== -1) && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">⚠️</div>
                  <div>
                    <h3 className="text-xl font-bold text-orange-800 mb-2">
                      {dashboardData.messages.percentage >= 100
                        ? 'Message Limit Reached'
                        : 'Approaching Message Limit'}
                    </h3>
                    <p className="text-orange-700 mb-4">
                      You've used {dashboardData.messages.total.toLocaleString()} out of {dashboardData.messages.limit.toLocaleString()} messages this month
                      ({Math.round(dashboardData.messages.percentage)}%).
                      {dashboardData.messages.percentage >= 100
                        ? ' Upgrade to continue sending messages.'
                        : ' Consider upgrading to avoid service interruptions.'}
                    </p>
                    <button
                      onClick={() => navigate('/billing')}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!dashboardData.bots.canCreateMore && dashboardData.bots.limit !== -1 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">⚠️</div>
                  <div>
                    <h3 className="text-xl font-bold text-orange-800 mb-2">Bot Limit Reached</h3>
                    <p className="text-orange-700 mb-4">
                      You've reached your bot limit of {dashboardData.bots.limit} bot{dashboardData.bots.limit !== 1 ? 's' : ''}.
                      Upgrade to create more bots.
                    </p>
                    <button
                      onClick={() => navigate('/billing')}
                      className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Quick Actions</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => navigate('/my-bots')}
                  className="p-6 border-2 border-purple-200 rounded-xl hover:border-purple-600 hover:bg-purple-50 transition-all"
                >
                  <div className="text-4xl mb-3">🤖</div>
                  <h3 className="font-bold text-gray-800 mb-2">Manage Bots</h3>
                  <p className="text-sm text-gray-600">View and edit your bots</p>
                </button>

                <button
                  onClick={() => navigate('/api-tokens')}
                  className="p-6 border-2 border-blue-200 rounded-xl hover:border-blue-600 hover:bg-blue-50 transition-all"
                >
                  <div className="text-4xl mb-3">🔑</div>
                  <h3 className="font-bold text-gray-800 mb-2">API Tokens</h3>
                  <p className="text-sm text-gray-600">Generate API keys</p>
                </button>

                <button
                  onClick={() => navigate('/webhooks')}
                  className="p-6 border-2 border-green-200 rounded-xl hover:border-green-600 hover:bg-green-50 transition-all"
                >
                  <div className="text-4xl mb-3">🔗</div>
                  <h3 className="font-bold text-gray-800 mb-2">Webhooks</h3>
                  <p className="text-sm text-gray-600">Configure webhooks</p>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
