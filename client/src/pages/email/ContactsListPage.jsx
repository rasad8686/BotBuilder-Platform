import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Upload, Download, Search, Filter, X, ChevronDown,
  MoreHorizontal, Trash2, Tag, ListFilter, Mail, CheckSquare,
  Square, RefreshCw, AlertCircle
} from 'lucide-react';
import { useContactsQuery, useBulkDeleteContactsMutation, useExportContactsMutation } from '../../hooks/email/useContacts';
import ContactCard from '../../components/email/ContactCard';
import ContactStatusBadge from '../../components/email/ContactStatusBadge';
import ContactFilters from '../../components/email/ContactFilters';
import ContactBulkActions from '../../components/email/ContactBulkActions';
import ExportModal from '../../components/email/ExportModal';

const ContactsListPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Filter state
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: [],
    tags: [],
    lists: [],
    source: [],
    dateRange: { start: null, end: null }
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Selection state
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modal state
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Build query params
  const queryParams = useMemo(() => ({
    status: activeTab === 'all' ? filters.status : [activeTab],
    tags: filters.tags,
    lists: filters.lists,
    source: filters.source,
    dateRange: filters.dateRange,
    search: searchQuery,
    sortBy,
    sortOrder,
    page,
    pageSize
  }), [activeTab, filters, searchQuery, sortBy, sortOrder, page, pageSize]);

  // Fetch contacts
  const { data, isLoading, error, refetch } = useContactsQuery(queryParams);
  const contacts = data?.contacts || [];
  const totalContacts = data?.total || 0;
  const stats = data?.stats || { total: 0, subscribed: 0, unsubscribed: 0, bounced: 0 };

  // Mutations
  const bulkDeleteMutation = useBulkDeleteContactsMutation();
  const exportMutation = useExportContactsMutation();

  // Tabs configuration
  const tabs = [
    { id: 'all', label: t('email.contacts.all', 'All'), count: stats.total },
    { id: 'subscribed', label: t('email.contacts.subscribed', 'Subscribed'), count: stats.subscribed },
    { id: 'unsubscribed', label: t('email.contacts.unsubscribed', 'Unsubscribed'), count: stats.unsubscribed },
    { id: 'bounced', label: t('email.contacts.bounced', 'Bounced'), count: stats.bounced }
  ];

  // Handle selection
  const handleSelectContact = useCallback((contactId) => {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      }
      return [...prev, contactId];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedContacts([]);
      setSelectAll(false);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
      setSelectAll(true);
    }
  }, [selectAll, contacts]);

  const clearSelection = useCallback(() => {
    setSelectedContacts([]);
    setSelectAll(false);
  }, []);

  // Handle bulk actions
  const handleBulkDelete = async () => {
    if (!window.confirm(t('email.contacts.confirmBulkDelete', 'Are you sure you want to delete selected contacts?'))) {
      return;
    }
    try {
      await bulkDeleteMutation.mutateAsync(selectedContacts);
      clearSelection();
      refetch();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  // Handle export
  const handleExport = async (options) => {
    try {
      const result = await exportMutation.mutateAsync({
        contactIds: selectedContacts.length > 0 ? selectedContacts : null,
        filters: queryParams,
        ...options
      });
      // Download file
      const blob = new Blob([result.data], { type: result.contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setShowExportModal(false);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Format number with K/M suffix
  const formatCount = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Pagination
  const totalPages = Math.ceil(totalContacts / pageSize);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold dark:text-white">
                {t('email.contacts.title', 'Contacts')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {t('email.contacts.subtitle', 'Manage your email contacts')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => navigate('/email/contacts/import')}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="w-4 h-4" />
              {t('email.contacts.import', 'Import')}
            </motion.button>
            <motion.button
              onClick={() => navigate('/email/contacts/new')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-4 h-4" />
              {t('email.contacts.addContact', 'Add Contact')}
            </motion.button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('email.contacts.totalContacts', 'Total Contacts')}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCount(stats.total)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('email.contacts.subscribed', 'Subscribed')}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCount(stats.subscribed)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('email.contacts.unsubscribed', 'Unsubscribed')}
            </p>
            <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {formatCount(stats.unsubscribed)}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('email.contacts.bounced', 'Bounced')}
            </p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCount(stats.bounced)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                  }}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap
                    transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  {tab.label}
                  <span className={`
                    px-2 py-0.5 rounded-full text-xs
                    ${activeTab === tab.id
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'
                    }
                  `}>
                    {formatCount(tab.count)}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Search & Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('email.contacts.searchPlaceholder', 'Search by email, name, or company...')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  px-4 py-2 border rounded-lg flex items-center gap-2 transition-colors
                  ${showFilters || Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v)
                    ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }
                `}
              >
                <Filter className="w-4 h-4" />
                {t('email.contacts.filters', 'Filters')}
              </button>

              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className="appearance-none px-4 py-2 pr-10 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <option value="created_at-desc">{t('email.contacts.sortNewest', 'Newest first')}</option>
                  <option value="created_at-asc">{t('email.contacts.sortOldest', 'Oldest first')}</option>
                  <option value="email-asc">{t('email.contacts.sortEmailAZ', 'Email A-Z')}</option>
                  <option value="email-desc">{t('email.contacts.sortEmailZA', 'Email Z-A')}</option>
                  <option value="first_name-asc">{t('email.contacts.sortNameAZ', 'Name A-Z')}</option>
                  <option value="last_activity-desc">{t('email.contacts.sortActivity', 'Last activity')}</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Export Button */}
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                {t('email.contacts.export', 'Export')}
              </button>

              {/* Refresh */}
              <button
                onClick={() => refetch()}
                className="p-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                title={t('email.contacts.refresh', 'Refresh')}
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ContactFilters
                    filters={filters}
                    onChange={setFilters}
                    onClear={() => setFilters({
                      status: [],
                      tags: [],
                      lists: [],
                      source: [],
                      dateRange: { start: null, end: null }
                    })}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bulk Actions Bar */}
          <AnimatePresence>
            {selectedContacts.length > 0 && (
              <ContactBulkActions
                selectedCount={selectedContacts.length}
                onAddToList={() => {}}
                onAddTags={() => {}}
                onRemoveTags={() => {}}
                onDelete={handleBulkDelete}
                onExport={() => setShowExportModal(true)}
                onClear={clearSelection}
              />
            )}
          </AnimatePresence>

          {/* Contacts Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t('email.contacts.loading', 'Loading contacts...')}
                </p>
              </div>
            ) : error ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
                <p className="text-red-500">{error.message}</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  {t('email.contacts.retry', 'Try again')}
                </button>
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('email.contacts.noContacts', 'No contacts yet')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  {t('email.contacts.noContactsDesc', 'Get started by adding your first contact or importing a list.')}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => navigate('/email/contacts/new')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {t('email.contacts.addContact', 'Add Contact')}
                  </button>
                  <button
                    onClick={() => navigate('/email/contacts/import')}
                    className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    {t('email.contacts.import', 'Import')}
                  </button>
                </div>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={handleSelectAll}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                      >
                        {selectAll ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('email.contacts.contact', 'Contact')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('email.contacts.status', 'Status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      {t('email.contacts.tags', 'Tags')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      {t('email.contacts.source', 'Source')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      {t('email.contacts.added', 'Added')}
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  {contacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      isSelected={selectedContacts.includes(contact.id)}
                      onSelect={() => handleSelectContact(contact.id)}
                      onClick={() => navigate(`/email/contacts/${contact.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('email.contacts.showing', 'Showing {{from}} to {{to}} of {{total}} contacts', {
                  from: (page - 1) * pageSize + 1,
                  to: Math.min(page * pageSize, totalContacts),
                  total: totalContacts
                })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.contacts.previous', 'Previous')}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.contacts.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onExport={handleExport}
            selectedCount={selectedContacts.length}
            totalCount={totalContacts}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContactsListPage;
