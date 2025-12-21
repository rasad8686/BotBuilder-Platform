import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';
import { SkeletonTable } from '../components/SkeletonLoader';

export default function ApiTokens() {
  const { t } = useTranslation();
  const [tokens, setTokens] = useState([]);
  const [bots, setBots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newToken, setNewToken] = useState(null);
  const [formData, setFormData] = useState({
    tokenName: '',
    botId: '',
    expiresInDays: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const [tokensRes, botsRes] = await Promise.all([
        axiosInstance.get('/api/api-tokens'),
        axiosInstance.get('/api/bots')
      ]);

      // API returns array directly or { tokens: [...] } or { data: [...] }
      const tokensData = Array.isArray(tokensRes.data) ? tokensRes.data : (tokensRes.data.tokens || tokensRes.data.data || []);
      const botsData = Array.isArray(botsRes.data) ? botsRes.data : (botsRes.data.bots || botsRes.data.data || []);
      setTokens(tokensData);
      setBots(botsData);
    } catch (error) {
      // Silent fail
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e) => {
    e.preventDefault();
    try {
      const response = await axiosInstance.post('/api/api-tokens', {
        tokenName: formData.tokenName,
        botId: formData.botId || null,
        expiresInDays: formData.expiresInDays ? parseInt(formData.expiresInDays) : null
      });

      // Backend returns { success: true, data: { token: '...' } }
      const tokenValue = response.data.data?.token || response.data.token;
      setNewToken(tokenValue);
      setFormData({ tokenName: '', botId: '', expiresInDays: '' });
      fetchData();
    } catch (error) {
      // Silent fail
      alert(error.response?.data?.error || 'Failed to create token');
    }
  };

  const handleDeleteToken = async (tokenId) => {
    if (!confirm('Are you sure you want to delete this token? This action cannot be undone.')) {
      return;
    }

    try {
      await axiosInstance.delete(`/api/api-tokens/${tokenId}`);

      fetchData();
    } catch (error) {
      // Silent fail
      alert(error.response?.data?.error || 'Failed to delete token');
    }
  };

  const handleToggleToken = async (tokenId) => {
    try {
      await axiosInstance.patch(`/api/api-tokens/${tokenId}/toggle`);

      fetchData();
    } catch (error) {
      // Silent fail
      alert(error.response?.data?.error || 'Failed to toggle token');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6 transition-colors duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded w-48 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-72 animate-pulse" />
          </div>
          <SkeletonTable rows={5} cols={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-4 sm:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-2">{t('apiTokens.title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('apiTokens.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            + {t('apiTokens.createNew')}
          </button>
        </div>

        {/* API Documentation Card */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-3">📚 API Documentation</h2>
          <p className="text-blue-700 dark:text-blue-300 mb-4">
            Use API tokens to access BotBuilder API programmatically. Include the token in the Authorization header of your requests.
          </p>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Example Usage:</p>
            <code className="text-sm bg-gray-100 dark:bg-slate-700 dark:text-gray-300 p-3 rounded block overflow-x-auto">
              curl -H "Authorization: Bearer bbot_your_token_here" \<br/>
              {`     https://your-domain.com/api/bots`}
            </code>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Available Endpoints:</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                <li>• GET /bots - List all bots</li>
                <li>• POST /bots - Create new bot</li>
                <li>• GET /bots/:id - Get bot details</li>
                <li>• PUT /bots/:id - Update bot</li>
                <li>• DELETE /bots/:id - Delete bot</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Token Security:</p>
              <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                <li>• Tokens are shown only once</li>
                <li>• Store tokens securely</li>
                <li>• Never commit tokens to git</li>
                <li>• Rotate tokens regularly</li>
                <li>• Use environment variables</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tokens List */}
        {tokens.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-12 text-center transition-colors duration-300">
            <div className="text-6xl mb-4">🔑</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t('apiTokens.noTokens')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{t('apiTokens.noTokensDesc')}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              {t('apiTokens.createFirst')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tokens.map((token) => (
              <div key={token.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 transition-colors duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white">{token.token_name}</h3>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        token.is_active ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {token.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <code className="bg-gray-100 dark:bg-slate-700 dark:text-gray-300 px-3 py-1 rounded text-sm">
                        {token.token_preview}
                      </code>
                      <button
                        onClick={() => copyToClipboard(token.token_preview)}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-700 text-sm"
                        title="Copy token preview"
                      >
                        📋 Copy
                      </button>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-semibold">Bot:</span> {token.bot_name || 'All bots'}
                      </div>
                      <div>
                        <span className="font-semibold">Last used:</span>{' '}
                        {token.last_used_at
                          ? new Date(token.last_used_at).toLocaleDateString()
                          : 'Never'}
                      </div>
                      <div>
                        <span className="font-semibold">Expires:</span>{' '}
                        {token.expires_at
                          ? new Date(token.expires_at).toLocaleDateString()
                          : 'Never'}
                      </div>
                    </div>

                    <div className="mt-3">
                      <span className="text-sm text-gray-600">Permissions: </span>
                      {token.permissions?.read && (
                        <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">
                          Read
                        </span>
                      )}
                      {token.permissions?.write && (
                        <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-2">
                          Write
                        </span>
                      )}
                      {token.permissions?.delete && (
                        <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                          Delete
                        </span>
                      )}
                      {!token.permissions && (
                        <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                          Full Access
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleToken(token.id)}
                      className={`px-4 py-2 rounded-lg ${
                        token.is_active
                          ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {token.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeleteToken(token.id)}
                      className="px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Token Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Create API Token</h2>

              {newToken ? (
                <div>
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <p className="text-green-800 dark:text-green-200 font-semibold mb-2">✅ Token Created!</p>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                      Copy this token now. You won't be able to see it again!
                    </p>
                    <div className="bg-white dark:bg-slate-700 p-3 rounded border border-green-300 dark:border-green-700">
                      <code className="text-sm break-all dark:text-gray-300">{newToken}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(newToken)}
                      className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      📋 Copy Token
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setNewToken(null);
                      setShowCreateModal(false);
                    }}
                    className="w-full px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateToken}>
                  <div className="mb-4">
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Token Name *</label>
                    <input
                      type="text"
                      value={formData.tokenName}
                      onChange={(e) => setFormData({ ...formData, tokenName: e.target.value })}
                      required
                      placeholder="e.g., Production API Key"
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">Bot (Optional)</label>
                    <select
                      value={formData.botId}
                      onChange={(e) => setFormData({ ...formData, botId: e.target.value })}
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">All Bots</option>
                      {bots.map((bot) => (
                        <option key={bot.id} value={bot.id}>
                          {bot.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Leave empty to allow access to all bots
                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-2">
                      Expires In (Days, Optional)
                    </label>
                    <input
                      type="number"
                      value={formData.expiresInDays}
                      onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                      placeholder="e.g., 90"
                      className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                    />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Leave empty for no expiration
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Create Token
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
