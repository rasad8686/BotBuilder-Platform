import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ShieldX, RefreshCw, Search, Filter, X,
  ChevronDown, ChevronLeft, ChevronRight, Download, Upload,
  Trash2, UserCheck, BarChart3, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle, XCircle, MailX, Flag, Eye
} from 'lucide-react';
import api from '../../api/axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// API functions
const fetchBounces = async (params) => {
  const { data } = await api.get('/email/bounces', { params });
  return data;
};

const fetchBlacklist = async (params) => {
  const { data } = await api.get('/email/bounces/blacklist', { params });
  return data;
};

const fetchStatistics = async (params) => {
  const { data } = await api.get('/email/bounces/statistics', { params });
  return data;
};

const fetchBouncedContacts = async (params) => {
  const { data } = await api.get('/email/bounces/contacts/bounced', { params });
  return data;
};

const addToBlacklist = async (payload) => {
  const { data } = await api.post('/email/bounces/blacklist', payload);
  return data;
};

const removeFromBlacklist = async (email) => {
  const { data } = await api.delete(`/email/bounces/blacklist/${encodeURIComponent(email)}`);
  return data;
};

const reactivateContact = async (contactId) => {
  const { data } = await api.post(`/email/bounces/contacts/${contactId}/reactivate`);
  return data;
};

const BounceManagementPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [bounceType, setBounceType] = useState('');
  const [blacklistReason, setBlacklistReason] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlacklistEmail, setNewBlacklistEmail] = useState('');
  const [newBlacklistReason, setNewBlacklistReason] = useState('manual');
  const [selectedBounce, setSelectedBounce] = useState(null);

  // Query params
  const queryParams = useMemo(() => ({
    page,
    limit: pageSize,
    search: searchQuery || undefined,
    type: bounceType || undefined,
    reason: blacklistReason || undefined,
    start_date: dateRange.start || undefined,
    end_date: dateRange.end || undefined
  }), [page, pageSize, searchQuery, bounceType, blacklistReason, dateRange]);

  // Queries
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['bounceStatistics', dateRange],
    queryFn: () => fetchStatistics({ start_date: dateRange.start, end_date: dateRange.end })
  });

  const { data: bouncesData, isLoading: bouncesLoading, refetch: refetchBounces } = useQuery({
    queryKey: ['bounces', queryParams],
    queryFn: () => fetchBounces(queryParams),
    enabled: activeTab === 'bounces'
  });

  const { data: blacklistData, isLoading: blacklistLoading, refetch: refetchBlacklist } = useQuery({
    queryKey: ['blacklist', queryParams],
    queryFn: () => fetchBlacklist(queryParams),
    enabled: activeTab === 'blacklist'
  });

  const { data: bouncedContactsData, isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ['bouncedContacts', queryParams],
    queryFn: () => fetchBouncedContacts(queryParams),
    enabled: activeTab === 'contacts'
  });

  // Mutations
  const addBlacklistMutation = useMutation({
    mutationFn: addToBlacklist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['bounceStatistics'] });
      setShowAddModal(false);
      setNewBlacklistEmail('');
    }
  });

  const removeBlacklistMutation = useMutation({
    mutationFn: removeFromBlacklist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['bounceStatistics'] });
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bouncedContacts'] });
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
      queryClient.invalidateQueries({ queryKey: ['bounceStatistics'] });
    }
  });

  // Stats
  const stats = statsData?.statistics || {
    totalBounces: 0,
    hardBounces: 0,
    softBounces: 0,
    totalBlacklisted: 0,
    totalComplaints: 0,
    blacklistByReason: {},
    recentTrend: []
  };

  // Tabs configuration
  const tabs = [
    { id: 'overview', label: t('email.bounces.overview', 'Overview'), icon: BarChart3 },
    { id: 'bounces', label: t('email.bounces.bounces', 'Bounces'), icon: MailX },
    { id: 'blacklist', label: t('email.bounces.blacklist', 'Blacklist'), icon: ShieldX },
    { id: 'contacts', label: t('email.bounces.contacts', 'Bounced Contacts'), icon: UserCheck }
  ];

  // Handle add to blacklist
  const handleAddToBlacklist = useCallback(() => {
    if (!newBlacklistEmail.trim()) return;
    addBlacklistMutation.mutate({
      email: newBlacklistEmail.trim(),
      reason: newBlacklistReason
    });
  }, [newBlacklistEmail, newBlacklistReason, addBlacklistMutation]);

  // Handle remove from blacklist
  const handleRemoveFromBlacklist = useCallback((email) => {
    if (window.confirm(t('email.bounces.confirmRemove', 'Remove this email from blacklist?'))) {
      removeBlacklistMutation.mutate(email);
    }
  }, [removeBlacklistMutation, t]);

  // Handle reactivate contact
  const handleReactivateContact = useCallback((contactId) => {
    if (window.confirm(t('email.bounces.confirmReactivate', 'Reactivate this contact?'))) {
      reactivateMutation.mutate(contactId);
    }
  }, [reactivateMutation, t]);

  // Pagination
  const getPaginationData = () => {
    switch (activeTab) {
      case 'bounces':
        return bouncesData?.pagination || { page: 1, totalPages: 1, total: 0 };
      case 'blacklist':
        return blacklistData?.pagination || { page: 1, totalPages: 1, total: 0 };
      case 'contacts':
        return bouncedContactsData?.pagination || { page: 1, totalPages: 1, total: 0 };
      default:
        return { page: 1, totalPages: 1, total: 0 };
    }
  };

  const pagination = getPaginationData();

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get bounce type badge
  const getBounceTypeBadge = (type) => {
    if (type === 'hard') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Hard Bounce
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        Soft Bounce
      </span>
    );
  };

  // Get reason badge
  const getReasonBadge = (reason) => {
    const colors = {
      hard_bounce: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      soft_bounce_limit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      complaint: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      manual: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    };
    const labels = {
      hard_bounce: 'Hard Bounce',
      soft_bounce_limit: 'Soft Bounce Limit',
      complaint: 'Complaint',
      manual: 'Manual'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[reason] || colors.manual}`}>
        {labels[reason] || reason}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-orange-500" />
            {t('email.bounces.title', 'Bounce Management')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('email.bounces.description', 'Monitor bounces, manage blacklist, and maintain email deliverability')}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-slate-700">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setPage(1); }}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Bounces</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalBounces}</p>
                  </div>
                  <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <MailX className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Hard Bounces</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.hardBounces}</p>
                  </div>
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Soft Bounces</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.softBounces}</p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Blacklisted</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalBlacklisted}</p>
                  </div>
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <ShieldX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Complaints</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.totalComplaints}</p>
                  </div>
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Flag className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Blacklist by Reason */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Blacklist by Reason
                </h3>
                <div className="space-y-3">
                  {Object.entries(stats.blacklistByReason || {}).map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between">
                      {getReasonBadge(reason)}
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats.blacklistByReason || {}).length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No blacklisted emails</p>
                  )}
                </div>
              </motion.div>

              {/* Recent Trend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Last 7 Days Trend
                </h3>
                <div className="space-y-2">
                  {(stats.recentTrend || []).map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400 w-24">
                        {new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                      <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-orange-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min((item.count / Math.max(...stats.recentTrend.map(t => t.count), 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-right">
                        {item.count}
                      </span>
                    </div>
                  ))}
                  {(stats.recentTrend || []).length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No bounce data</p>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}

        {/* Bounces Tab */}
        {activeTab === 'bounces' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder={t('email.bounces.searchEmail', 'Search by email...')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <select
                value={bounceType}
                onChange={(e) => { setBounceType(e.target.value); setPage(1); }}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                <option value="">All Types</option>
                <option value="hard">Hard Bounce</option>
                <option value="soft">Soft Bounce</option>
              </select>
              <button
                onClick={() => refetchBounces()}
                className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Bounces Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {bouncesLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="mt-2 text-gray-500 dark:text-gray-400">Loading bounces...</p>
                </div>
              ) : (
                <>
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Provider</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {(bouncesData?.bounces || []).map((bounce) => (
                        <tr key={bounce.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {bounce.email}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {getBounceTypeBadge(bounce.type)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={bounce.reason}>
                            {bounce.reason || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {bounce.provider || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(bounce.bounced_at)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => setSelectedBounce(bounce)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(bouncesData?.bounces || []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                            No bounces found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}

        {/* Blacklist Tab */}
        {activeTab === 'blacklist' && (
          <div className="space-y-4">
            {/* Filters & Actions */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex flex-wrap gap-4 items-center flex-1">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder={t('email.bounces.searchEmail', 'Search by email...')}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <select
                  value={blacklistReason}
                  onChange={(e) => { setBlacklistReason(e.target.value); setPage(1); }}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Reasons</option>
                  <option value="hard_bounce">Hard Bounce</option>
                  <option value="soft_bounce_limit">Soft Bounce Limit</option>
                  <option value="complaint">Complaint</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ShieldX className="w-4 h-4" />
                Add to Blacklist
              </button>
            </div>

            {/* Blacklist Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {blacklistLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="mt-2 text-gray-500 dark:text-gray-400">Loading blacklist...</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Soft Bounces</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Blacklisted At</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {(blacklistData?.blacklist || []).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {item.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {getReasonBadge(item.reason)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {item.soft_bounce_count || 0}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={item.details}>
                          {item.details || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(item.blacklisted_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => handleRemoveFromBlacklist(item.email)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            title="Remove from blacklist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(blacklistData?.blacklist || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No blacklisted emails
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Bounced Contacts Tab */}
        {activeTab === 'contacts' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder={t('email.bounces.searchContact', 'Search contacts...')}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={() => refetchContacts()}
                className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Contacts Table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {contactsLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="mt-2 text-gray-500 dark:text-gray-400">Loading contacts...</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Bounce Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Updated</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {(bouncedContactsData?.contacts || []).map((contact) => (
                      <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {contact.first_name} {contact.last_name}
                          </div>
                          {contact.company && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{contact.company}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {contact.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {contact.custom_fields?.bounce_type ? getBounceTypeBadge(contact.custom_fields.bounce_type) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate" title={contact.custom_fields?.bounce_reason}>
                          {contact.custom_fields?.bounce_reason || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(contact.updated_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            onClick={() => handleReactivateContact(contact.id)}
                            className="flex items-center gap-1 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 ml-auto"
                            title="Reactivate contact"
                          >
                            <UserCheck className="w-4 h-4" />
                            <span>Reactivate</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {(bouncedContactsData?.contacts || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No bounced contacts
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {activeTab !== 'overview' && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Add to Blacklist Modal */}
        <AnimatePresence>
          {showAddModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowAddModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Add to Blacklist
                  </h3>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={newBlacklistEmail}
                      onChange={(e) => setNewBlacklistEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Reason
                    </label>
                    <select
                      value={newBlacklistReason}
                      onChange={(e) => setNewBlacklistReason(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    >
                      <option value="manual">Manual</option>
                      <option value="hard_bounce">Hard Bounce</option>
                      <option value="complaint">Complaint</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddToBlacklist}
                      disabled={!newBlacklistEmail.trim() || addBlacklistMutation.isPending}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {addBlacklistMutation.isPending ? 'Adding...' : 'Add to Blacklist'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bounce Detail Modal */}
        <AnimatePresence>
          {selectedBounce && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedBounce(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Bounce Details
                  </h3>
                  <button
                    onClick={() => setSelectedBounce(null)}
                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedBounce.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
                      {getBounceTypeBadge(selectedBounce.type)}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Provider</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedBounce.provider || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedBounce.bounced_at)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Reason</p>
                    <p className="font-medium text-gray-900 dark:text-white">{selectedBounce.reason || '-'}</p>
                  </div>

                  {selectedBounce.diagnostic_code && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Diagnostic Code</p>
                      <p className="font-mono text-sm bg-gray-100 dark:bg-slate-700 p-2 rounded text-gray-900 dark:text-white">
                        {selectedBounce.diagnostic_code}
                      </p>
                    </div>
                  )}

                  {selectedBounce.provider_response && (
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Provider Response</p>
                      <pre className="font-mono text-xs bg-gray-100 dark:bg-slate-700 p-3 rounded overflow-x-auto text-gray-900 dark:text-white">
                        {JSON.stringify(JSON.parse(selectedBounce.provider_response), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default BounceManagementPage;
