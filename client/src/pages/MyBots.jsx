import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import botApi from '../api/bots';
import BotCard from '../components/BotCard';
import ConfirmModal from '../components/ConfirmModal';

export default function MyBots() {
  const { t } = useTranslation();
  const [bots, setBots] = useState([]);
  const [filteredBots, setFilteredBots] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchBots();
  }, []);

  useEffect(() => {
    // Show success message if bot was just created
    if (location.state?.botCreated) {
      setSuccessMessage('Bot created successfully! 🎉');
      // Clear the state
      window.history.replaceState({}, document.title);
      setTimeout(() => setSuccessMessage(''), 5000);
    }
  }, [location]);

  useEffect(() => {
    // Filter bots based on search and platform
    let filtered = bots;

    if (searchQuery) {
      filtered = filtered.filter(bot =>
        bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (bot.description && bot.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (filterPlatform !== 'all') {
      filtered = filtered.filter(bot => bot.platform === filterPlatform);
    }

    setFilteredBots(filtered);
  }, [searchQuery, filterPlatform, bots]);

  const fetchBots = async () => {
    try {
      setLoading(true);
      const response = await botApi.getBots();
      setBots(response.bots || []);
      setError('');
    } catch (err) {
      console.error('Fetch bots error:', err);
      setError(err.response?.data?.message || 'Failed to load bots');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (bot) => {
    setBotToDelete(bot);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!botToDelete) return;

    try {
      await botApi.deleteBot(botToDelete.id);
      setBots(bots.filter(bot => bot.id !== botToDelete.id));
      setSuccessMessage(`Bot "${botToDelete.name}" deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Delete bot error:', err);
      setError(err.response?.data?.message || 'Failed to delete bot');
      setTimeout(() => setError(''), 5000);
    } finally {
      setBotToDelete(null);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="h-6 bg-gray-300 rounded w-1/2 mb-8"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-xl shadow p-6">
                  <div className="h-6 bg-gray-300 rounded mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 rounded mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-10 bg-gray-300 rounded flex-1"></div>
                    <div className="h-10 bg-gray-300 rounded flex-1"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              My Bots 🤖
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and monitor all your chatbots
            </p>
          </div>
          <button
            onClick={() => navigate('/create-bot')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md"
          >
            + Create New Bot
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2 shadow-sm">
            ✅ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Search and Filter */}
        {bots.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Bots
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Platform
                </label>
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Platforms</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                  <option value="messenger">Facebook Messenger</option>
                </select>
              </div>
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-gray-600">
              Showing {filteredBots.length} of {bots.length} bot{bots.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Empty State */}
        {bots.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Bots Yet
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Get started by creating your first chatbot. It only takes a minute!
            </p>
            <button
              onClick={() => navigate('/create-bot')}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md"
            >
              Create Your First Bot
            </button>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Bots Found
            </h2>
            <p className="text-gray-600 mb-6">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPlatform('all');
              }}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredBots.map(bot => (
              <BotCard
                key={bot.id}
                bot={bot}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setBotToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Bot?"
        message={`Are you sure you want to delete "${botToDelete?.name}"? This action cannot be undone and all associated data will be permanently deleted.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
}
