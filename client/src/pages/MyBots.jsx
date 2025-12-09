import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import botApi from '../api/bots';
import BotCard from '../components/BotCard';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import UpgradeLimitModal from '../components/UpgradeLimitModal';
import { API_URL } from '../config/api';
import { useOrganization } from '../contexts/OrganizationContext';

export default function MyBots() {
  const { t } = useTranslation();
  const { loading: orgLoading } = useOrganization();
  const [bots, setBots] = useState([]);
  const [filteredBots, setFilteredBots] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pagination, setPagination] = useState(null);
  const [usePagination] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Plan limits state
  const [subscription, setSubscription] = useState(null);
  const [upgradeLimitModalOpen, setUpgradeLimitModalOpen] = useState(false);
  const [limitErrorData, setLimitErrorData] = useState(null);

  useEffect(() => {
    // Wait for organization context to load before fetching data
    if (orgLoading) {
      return;
    }

    fetchBots();
    fetchSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, usePagination, orgLoading]);

  // Fetch subscription/plan info
  const fetchSubscription = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/billing/subscription`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data.success) {
        setSubscription(response.data.subscription);
      }
    } catch (err) {
      // Silent fail
    }
  };

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
    // Only apply local filtering if pagination is disabled
    if (!usePagination) {
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
    } else {
      // When using pagination, display the paginated results directly
      setFilteredBots(bots);
    }
  }, [searchQuery, filterPlatform, bots, usePagination]);

  const fetchBots = async () => {
    try {
      setLoading(true);

      if (usePagination) {
        // Fetch with pagination
        const response = await botApi.getBots({
          page: currentPage,
          limit: itemsPerPage
        });

        if (response.pagination) {
          // Paginated response
          setBots(response.data || []);
          setPagination(response.pagination);
          setFilteredBots(response.data || []);
        } else {
          // Non-paginated response (backward compatibility)
          setBots(response.bots || response.data || []);
          setPagination(null);
        }
      } else {
        // Fetch all without pagination (for filtering)
        const response = await botApi.getBots();
        setBots(response.bots || response.data || []);
        setPagination(null);
      }

      setError('');
    } catch (err) {
      // Silent fail
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
      setSuccessMessage(`Bot "${botToDelete.name}" deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 5000);
      // Refetch to update the list
      fetchBots();
    } catch (err) {
      // Silent fail
      setError(err.response?.data?.message || 'Failed to delete bot');
      setTimeout(() => setError(''), 5000);
    } finally {
      setBotToDelete(null);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newLimit) => {
    setItemsPerPage(newLimit);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Check if user can create more bots based on plan limits
  const getPlanLimits = () => {
    const limits = {
      free: 1,
      pro: 10,
      enterprise: -1 // unlimited
    };

    const currentPlan = subscription?.plan || 'free';
    const maxBots = limits[currentPlan];
    const currentBots = bots.length;

    return {
      currentPlan,
      maxBots,
      currentBots,
      canCreate: maxBots === -1 || currentBots < maxBots,
      isAtLimit: maxBots !== -1 && currentBots >= maxBots
    };
  };

  // Handle create bot button click with limit check
  const handleCreateBot = () => {
    const limits = getPlanLimits();

    if (limits.isAtLimit) {
      // Show upgrade modal
      const upgradePlan = limits.currentPlan === 'free' ? 'pro' : 'enterprise';
      const upgradeMessage = limits.currentPlan === 'free'
        ? 'Upgrade to Pro for 10 bots or Enterprise for unlimited bots'
        : 'Upgrade to Enterprise for unlimited bots';

      setLimitErrorData({
        currentPlan: limits.currentPlan,
        currentBots: limits.currentBots,
        maxBots: limits.maxBots,
        message: upgradeMessage,
        upgradePlan: upgradePlan,
        limitReached: true
      });
      setUpgradeLimitModalOpen(true);
    } else {
      // Navigate to create bot page
      navigate('/create-bot');
    }
  };

  // Loading skeleton - show while org context is loading OR bots are loading
  if (orgLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
            <div className="h-6 bg-gray-300 dark:bg-slate-700 rounded w-1/2 mb-8"></div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow p-6">
                  <div className="h-6 bg-gray-300 dark:bg-slate-700 rounded mb-4"></div>
                  <div className="h-4 bg-gray-300 dark:bg-slate-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-slate-700 rounded mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded flex-1"></div>
                    <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded flex-1"></div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {t('myBots.title')} 🤖
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('myBots.subtitle')}
            </p>
          </div>
          <PermissionGuard require="member">
            {(() => {
              const limits = getPlanLimits();
              const isAtLimit = limits.isAtLimit;

              return (
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={handleCreateBot}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors shadow-md ${
                      isAtLimit
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                    disabled={isAtLimit}
                  >
                    {isAtLimit ? t('myBots.limitReached') : t('myBots.createNew')}
                  </button>
                  {subscription && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {limits.currentBots} / {limits.maxBots === -1 ? '∞' : limits.maxBots} bots
                    </span>
                  )}
                </div>
              );
            })()}
          </PermissionGuard>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2 shadow-sm">
            ✅ {successMessage}
          </div>
        )}

        {/* Error Message - Only show after both org and bots finish loading */}
        {!orgLoading && !loading && error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 shadow-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Search and Filter - Hidden when using pagination */}
        {bots.length > 0 && !usePagination && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-4 mb-6 transition-colors duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('myBots.searchBots')}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('myBots.searchPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                />
              </div>

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('myBots.filterByPlatform')}
                </label>
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                >
                  <option value="all">{t('myBots.allPlatforms')}</option>
                  <option value="telegram">Telegram</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="discord">Discord</option>
                  <option value="slack">Slack</option>
                  <option value="messenger">Facebook Messenger</option>
                </select>
              </div>
            </div>

            {/* Results count */}
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {t('myBots.showingResults', { showing: filteredBots.length, total: bots.length })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {bots.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-12 text-center transition-colors duration-300">
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('myBots.noBots')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {t('myBots.noBotsDesc')}
            </p>
            <PermissionGuard
              require="member"
              fallback={
                <p className="text-gray-500 dark:text-gray-400 italic">
                  {t('myBots.contactAdmin')}
                </p>
              }
            >
              <button
                onClick={handleCreateBot}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-md"
              >
                {t('myBots.createFirst')}
              </button>
            </PermissionGuard>
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-12 text-center transition-colors duration-300">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {t('myBots.noBotsFound')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('myBots.adjustSearch')}
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPlatform('all');
              }}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              {t('myBots.clearFilters')}
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredBots.map(bot => (
                <BotCard
                  key={bot.id}
                  bot={bot}
                  onDelete={handleDeleteClick}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}
          </>
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

      {/* Upgrade Limit Modal */}
      <UpgradeLimitModal
        isOpen={upgradeLimitModalOpen}
        onClose={() => setUpgradeLimitModalOpen(false)}
        limitData={limitErrorData}
      />
    </div>
  );
}
