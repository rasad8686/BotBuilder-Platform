import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListFilter, Plus, Search, LayoutGrid, List as ListIcon,
  MoreHorizontal, Edit2, Copy, Trash2, Users, RefreshCw, AlertCircle
} from 'lucide-react';
import { useListsQuery, useDeleteListMutation, useDuplicateListMutation } from '../../hooks/email/useLists';
import ListCard from '../../components/email/ListCard';

const ListsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // grid | table
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedList, setSelectedList] = useState(null);

  // Fetch lists
  const { data, isLoading, error, refetch } = useListsQuery();
  const lists = data?.lists || [];

  // Mutations
  const deleteMutation = useDeleteListMutation();
  const duplicateMutation = useDuplicateListMutation();

  // Filter lists by search
  const filteredLists = lists.filter(list =>
    list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (list.description && list.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle delete
  const handleDelete = async () => {
    if (!selectedList) return;
    try {
      await deleteMutation.mutateAsync(selectedList.id);
      setShowDeleteModal(false);
      setSelectedList(null);
      refetch();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Handle duplicate
  const handleDuplicate = async (list) => {
    try {
      await duplicateMutation.mutateAsync(list.id);
      refetch();
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <ListFilter className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold dark:text-white">
                {t('email.lists.title', 'Lists')}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {t('email.lists.subtitle', 'Organize your contacts into lists')}
              </p>
            </div>
          </div>
          <motion.button
            onClick={() => navigate('/email/lists/new')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            {t('email.lists.createList', 'Create List')}
          </motion.button>
        </div>

        {/* Search & View Controls */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('email.lists.searchPlaceholder', 'Search lists...')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <ListIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => refetch()}
              className="p-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              title={t('email.lists.refresh', 'Refresh')}
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Lists */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {t('email.lists.loading', 'Loading lists...')}
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-500">{error.message}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 text-purple-600 hover:underline"
            >
              {t('email.lists.retry', 'Try again')}
            </button>
          </div>
        ) : filteredLists.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
            <ListFilter className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery
                ? t('email.lists.noResults', 'No lists found')
                : t('email.lists.noLists', 'No lists yet')
              }
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {searchQuery
                ? t('email.lists.noResultsDesc', 'Try a different search term')
                : t('email.lists.noListsDesc', 'Create your first list to organize contacts')
              }
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/email/lists/new')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                {t('email.lists.createList', 'Create List')}
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLists.map(list => (
              <ListCard
                key={list.id}
                list={list}
                onClick={() => navigate(`/email/lists/${list.id}`)}
                onEdit={() => navigate(`/email/lists/${list.id}/edit`)}
                onDuplicate={() => handleDuplicate(list)}
                onDelete={() => {
                  setSelectedList(list);
                  setShowDeleteModal(true);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('email.lists.name', 'Name')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('email.lists.type', 'Type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('email.lists.contacts', 'Contacts')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('email.lists.created', 'Created')}
                  </th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredLists.map(list => (
                  <tr
                    key={list.id}
                    onClick={() => navigate(`/email/lists/${list.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{list.name}</p>
                        {list.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {list.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`
                        px-2 py-1 text-xs font-medium rounded-full
                        ${list.type === 'dynamic'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-gray-300'
                        }
                      `}>
                        {list.type === 'dynamic' ? t('email.lists.dynamic', 'Dynamic') : t('email.lists.static', 'Static')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Users className="w-4 h-4" />
                        {list.contact_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(list.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle dropdown
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600"
                        >
                          <MoreHorizontal className="w-5 h-5" />
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedList && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('email.lists.deleteTitle', 'Delete List')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t('email.lists.deleteConfirm', 'Are you sure you want to delete "{{name}}"? This will not delete the contacts in this list.', { name: selectedList.name })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.lists.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isLoading
                    ? t('email.lists.deleting', 'Deleting...')
                    : t('email.lists.delete', 'Delete')
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ListsPage;
