/**
 * Changelog Page (Public)
 *
 * Displays public changelog/release notes:
 * - Version list with badges (feature/bugfix/breaking)
 * - Filter by type
 * - Search
 * - Version detail modal
 * - "What's New" banner for latest
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axiosInstance from '../api/axios';

// Type badge colors
const TYPE_COLORS = {
  feature: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  improvement: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  bugfix: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  breaking: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  security: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  deprecated: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
};

const TYPE_LABELS = {
  feature: 'New Feature',
  improvement: 'Improvement',
  bugfix: 'Bug Fix',
  breaking: 'Breaking Change',
  security: 'Security',
  deprecated: 'Deprecated'
};

const CATEGORY_LABELS = {
  api: 'API',
  dashboard: 'Dashboard',
  sdk: 'SDK',
  billing: 'Billing',
  security: 'Security'
};

export default function Changelog() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // State
  const [entries, setEntries] = useState([]);
  const [latestEntry, setLatestEntry] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  /**
   * Load changelog entries
   */
  const loadEntries = async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10'
      });

      if (searchQuery) params.append('search', searchQuery);
      if (typeFilter) params.append('type', typeFilter);
      if (categoryFilter) params.append('category', categoryFilter);

      const response = await axiosInstance.get(`/api/changelog?${params.toString()}`);

      if (response.data.success) {
        setEntries(response.data.data.entries);
        setPagination(response.data.data.pagination);
      }

    } catch (err) {
      setError('Failed to load changelog');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load latest entry for "What's New" banner
   */
  const loadLatest = async () => {
    try {
      const response = await axiosInstance.get('/api/changelog/latest');
      if (response.data.success && response.data.data) {
        setLatestEntry(response.data.data);
      }
    } catch (err) {
      // Ignore error for latest
    }
  };

  useEffect(() => {
    loadEntries();
    loadLatest();
  }, []);

  useEffect(() => {
    loadEntries(1);
  }, [searchQuery, typeFilter, categoryFilter]);

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  /**
   * Get time since date
   */
  const getTimeSince = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Changelog
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            New updates and improvements to BotBuilder
          </p>

          {/* RSS Link */}
          <a
            href="/api/changelog/rss"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm text-orange-600 dark:text-orange-400 hover:underline"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z" />
              <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z" />
            </svg>
            Subscribe to RSS
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* What's New Banner */}
        {latestEntry && !searchQuery && !typeFilter && !categoryFilter && pagination.page === 1 && (
          <div className="mb-8 p-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl text-white">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-1 bg-white/20 rounded text-sm font-medium mb-2">
                  What's New
                </span>
                <h2 className="text-2xl font-bold mb-2">
                  {latestEntry.title}
                </h2>
                <p className="text-purple-100 mb-3">
                  Version {latestEntry.version} - {getTimeSince(latestEntry.published_at)}
                </p>
                {latestEntry.description && (
                  <p className="text-white/90 text-sm line-clamp-2">
                    {latestEntry.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedEntry(latestEntry)}
                className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition"
              >
                View Details
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search changelog..."
              className="w-full px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-4">Loading changelog...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No changelog entries found</p>
          </div>
        ) : (
          <>
            {/* Entries List */}
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-6 hover:shadow-lg transition cursor-pointer"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-mono rounded">
                          v{entry.version}
                        </span>
                        {entry.type && (
                          <span className={`px-2 py-1 text-sm rounded ${TYPE_COLORS[entry.type] || TYPE_COLORS.improvement}`}>
                            {TYPE_LABELS[entry.type] || entry.type}
                          </span>
                        )}
                        {entry.is_breaking && (
                          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded">
                            Breaking
                          </span>
                        )}
                        {entry.category && (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded">
                            {CATEGORY_LABELS[entry.category] || entry.category}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        {entry.title}
                      </h3>

                      {/* Description */}
                      {entry.description && (
                        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
                          {entry.description}
                        </p>
                      )}

                      {/* Items preview */}
                      {entry.items && entry.items.length > 0 && (
                        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                          {entry.items.slice(0, 3).map((item) => (
                            <li key={item.id} className="flex items-start gap-2">
                              <span className="text-purple-500">-</span>
                              <span className="line-clamp-1">{item.content}</span>
                            </li>
                          ))}
                          {entry.items.length > 3 && (
                            <li className="text-purple-600 dark:text-purple-400">
                              +{entry.items.length - 3} more changes
                            </li>
                          )}
                        </ul>
                      )}
                    </div>

                    {/* Date */}
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(entry.published_at || entry.created_at)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {getTimeSince(entry.published_at || entry.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  onClick={() => loadEntries(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => loadEntries(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-sm font-mono rounded">
                      v{selectedEntry.version}
                    </span>
                    {selectedEntry.type && (
                      <span className={`px-2 py-1 text-sm rounded ${TYPE_COLORS[selectedEntry.type] || TYPE_COLORS.improvement}`}>
                        {TYPE_LABELS[selectedEntry.type] || selectedEntry.type}
                      </span>
                    )}
                    {selectedEntry.is_breaking && (
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded">
                        Breaking Change
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedEntry.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {formatDate(selectedEntry.published_at || selectedEntry.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Description */}
              {selectedEntry.description && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Description</h3>
                  <div className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {selectedEntry.description}
                  </div>
                </div>
              )}

              {/* Changes */}
              {selectedEntry.items && selectedEntry.items.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Changes</h3>
                  <ul className="space-y-3">
                    {selectedEntry.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                        <span className="text-purple-500 mt-0.5">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </span>
                        <div className="flex-1">
                          <p className="text-gray-700 dark:text-gray-300">{item.content}</p>
                          {item.api_endpoint && (
                            <code className="text-xs bg-gray-200 dark:bg-slate-600 px-2 py-1 rounded mt-1 inline-block">
                              {item.api_endpoint}
                            </code>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
