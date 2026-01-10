import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Megaphone, Plus, Search, Filter, Trash2, Edit2, ToggleLeft, ToggleRight,
  Eye, Calendar, Users, ChevronDown, AlertCircle, RefreshCw
} from 'lucide-react';
import { getBanners, createBanner, updateBanner, deleteBanner, toggleBannerStatus } from '../../api/banners';
import BannerForm from '../../components/banners/BannerForm';
import BannerPreview from '../../components/banners/BannerPreview';
import { useNotification } from '../../contexts/NotificationContext';

export default function Banners() {
  const { t } = useTranslation();
  const { showToast } = useNotification();
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewBanner, setPreviewBanner] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Type badge colors
  const typeBadgeColors = {
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    promo: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
  };

  // Audience labels
  const audienceLabels = {
    all: t('banners.audienceAll', 'All Users'),
    free: t('banners.audienceFree', 'Free Plan'),
    paid: t('banners.audiencePaid', 'Paid Plan'),
    trial: t('banners.audienceTrial', 'Trial Users')
  };

  // Fetch banners
  const fetchBanners = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (audienceFilter) params.target_audience = audienceFilter;
      const data = await getBanners(params);
      setBanners(data.banners || data || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError(t('banners.errorFetching', 'Failed to load banners'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, [searchQuery, typeFilter, statusFilter, audienceFilter]);

  // Handle create/edit banner
  const handleSave = async (data) => {
    try {
      setIsSaving(true);
      if (selectedBanner) {
        await updateBanner(selectedBanner.id, data);
        showToast(t('banners.bannerUpdated', 'Banner updated successfully'), 'success');
      } else {
        await createBanner(data);
        showToast(t('banners.bannerCreated', 'Banner created successfully'), 'success');
      }
      setIsFormOpen(false);
      setSelectedBanner(null);
      fetchBanners();
    } catch (err) {
      console.error('Error saving banner:', err);
      showToast(t('banners.errorSaving', 'Failed to save banner'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle delete banner
  const handleDelete = async (id) => {
    try {
      await deleteBanner(id);
      setDeleteConfirm(null);
      showToast(t('banners.bannerDeleted', 'Banner deleted successfully'), 'success');
      fetchBanners();
    } catch (err) {
      console.error('Error deleting banner:', err);
      showToast(t('banners.errorDeleting', 'Failed to delete banner'), 'error');
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (id) => {
    try {
      await toggleBannerStatus(id);
      showToast(t('banners.statusToggled', 'Banner status updated'), 'success');
      fetchBanners();
    } catch (err) {
      console.error('Error toggling banner status:', err);
      showToast(t('banners.errorToggling', 'Failed to toggle banner status'), 'error');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Open edit modal
  const handleEdit = (banner) => {
    setSelectedBanner(banner);
    setIsFormOpen(true);
  };

  // Open create modal
  const handleCreate = () => {
    setSelectedBanner(null);
    setIsFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <Megaphone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {t('banners.title', 'In-App Banners')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400">
                {t('banners.description', 'Manage announcements and promotional banners')}
              </p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('banners.createNew', 'Create Banner')}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('banners.searchPlaceholder', 'Search banners...')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showFilters
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600'
                : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
          >
            <Filter className="w-4 h-4" />
            {t('banners.filters', 'Filters')}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Refresh */}
          <button
            onClick={fetchBanners}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.filterByType', 'Type')}
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('banners.allTypes', 'All Types')}</option>
                <option value="info">{t('banners.typeInfo', 'Info')}</option>
                <option value="warning">{t('banners.typeWarning', 'Warning')}</option>
                <option value="success">{t('banners.typeSuccess', 'Success')}</option>
                <option value="error">{t('banners.typeError', 'Error')}</option>
                <option value="promo">{t('banners.typePromo', 'Promo')}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.filterByStatus', 'Status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('banners.allStatuses', 'All Statuses')}</option>
                <option value="active">{t('banners.statusActive', 'Active')}</option>
                <option value="inactive">{t('banners.statusInactive', 'Inactive')}</option>
              </select>
            </div>

            {/* Audience Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('banners.filterByAudience', 'Target Audience')}
              </label>
              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">{t('banners.allAudiences', 'All Audiences')}</option>
                <option value="all">{t('banners.audienceAll', 'All Users')}</option>
                <option value="free">{t('banners.audienceFree', 'Free Plan')}</option>
                <option value="paid">{t('banners.audiencePaid', 'Paid Plan')}</option>
                <option value="trial">{t('banners.audienceTrial', 'Trial Users')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
        </div>
      )}

      {/* Banner Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
          </div>
        ) : banners.length === 0 ? (
          <div className="p-8 text-center">
            <Megaphone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('banners.noBanners', 'No banners found')}
            </p>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('banners.createFirst', 'Create your first banner')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('banners.columnTitle', 'Title')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('banners.columnType', 'Type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('banners.columnAudience', 'Audience')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('banners.columnDates', 'Start / End')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('banners.columnStatus', 'Status')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('banners.columnActions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {banners.map((banner) => (
                  <tr
                    key={banner.id}
                    className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    {/* Title */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {banner.title}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                          {banner.message}
                        </span>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${typeBadgeColors[banner.type] || typeBadgeColors.info}`}>
                        {banner.type?.toUpperCase()}
                      </span>
                    </td>

                    {/* Audience */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        {audienceLabels[banner.target_audience] || banner.target_audience}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {formatDate(banner.start_date)}
                        </div>
                        {banner.end_date && (
                          <div className="text-gray-500 dark:text-gray-500">
                            {formatDate(banner.end_date)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${banner.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                        {banner.is_active
                          ? t('banners.statusActive', 'Active')
                          : t('banners.statusInactive', 'Inactive')
                        }
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Preview */}
                        <button
                          onClick={() => setPreviewBanner(previewBanner?.id === banner.id ? null : banner)}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                          title={t('banners.preview', 'Preview')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => handleEdit(banner)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title={t('common.edit', 'Edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleStatus(banner.id)}
                          className={`p-2 rounded-lg transition-colors ${banner.is_active
                              ? 'text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          title={banner.is_active ? t('banners.deactivate', 'Deactivate') : t('banners.activate', 'Activate')}
                        >
                          {banner.is_active ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => setDeleteConfirm(banner)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Preview */}
      {previewBanner && (
        <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 p-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            {t('banners.previewTitle', 'Banner Preview')}
          </h3>
          <BannerPreview banner={previewBanner} />
        </div>
      )}

      {/* Create/Edit Form Modal */}
      <BannerForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedBanner(null);
        }}
        onSave={handleSave}
        banner={selectedBanner}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('banners.deleteConfirmTitle', 'Delete Banner')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('banners.deleteConfirmMessage', 'Are you sure you want to delete this banner? This action cannot be undone.')}
              </p>
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-3 mb-6">
                <p className="font-medium text-gray-900 dark:text-white">{deleteConfirm.title}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{deleteConfirm.message}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  {t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
