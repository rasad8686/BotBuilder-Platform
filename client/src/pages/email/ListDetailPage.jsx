import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit2, Trash2, UserPlus, Search, RefreshCw,
  AlertCircle, Users, Settings, Download, MoreHorizontal,
  CheckSquare, Square, X
} from 'lucide-react';
import {
  useListQuery,
  useListContactsQuery,
  useRemoveContactsFromListMutation,
  useDeleteListMutation
} from '../../hooks/email/useLists';
import ContactCard from '../../components/email/ContactCard';
import ContactSelector from '../../components/email/ContactSelector';
import ListRuleBuilder from '../../components/email/ListRuleBuilder';

const ListDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('contacts');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [showContactSelector, setShowContactSelector] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Fetch list data
  const { data: list, isLoading: listLoading, error: listError, refetch: refetchList } = useListQuery(id);

  // Fetch contacts in list
  const { data: contactsData, isLoading: contactsLoading, refetch: refetchContacts } = useListContactsQuery(id, {
    search: searchQuery,
    page,
    pageSize
  });
  const contacts = contactsData?.contacts || [];
  const totalContacts = contactsData?.total || 0;

  // Mutations
  const removeContactsMutation = useRemoveContactsFromListMutation();
  const deleteListMutation = useDeleteListMutation();

  const tabs = [
    { id: 'contacts', label: t('email.list.contacts', 'Contacts'), icon: Users },
    { id: 'settings', label: t('email.list.settings', 'Settings'), icon: Settings }
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
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  }, [contacts, selectedContacts.length]);

  // Remove contacts from list
  const handleRemoveContacts = async () => {
    if (!selectedContacts.length) return;
    if (!window.confirm(t('email.list.confirmRemove', 'Remove selected contacts from this list?'))) {
      return;
    }
    try {
      await removeContactsMutation.mutateAsync({ listId: id, contactIds: selectedContacts });
      setSelectedContacts([]);
      refetchContacts();
    } catch (err) {
      console.error('Remove failed:', err);
    }
  };

  // Delete list
  const handleDeleteList = async () => {
    try {
      await deleteListMutation.mutateAsync(id);
      navigate('/email/lists');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalContacts / pageSize);

  if (listLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (listError || !list) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('email.list.notFound', 'List not found')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {listError?.message || t('email.list.notFoundDesc', 'The list you are looking for does not exist.')}
          </p>
          <button
            onClick={() => navigate('/email/lists')}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            {t('email.list.backToLists', 'Back to Lists')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/email/lists')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('email.list.backToLists', 'Back to Lists')}
        </button>

        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {list.name}
                </h1>
                <span className={`
                  px-2 py-1 text-xs font-medium rounded-full
                  ${list.type === 'dynamic'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-600 dark:text-gray-300'
                  }
                `}>
                  {list.type === 'dynamic' ? t('email.list.dynamic', 'Dynamic') : t('email.list.static', 'Static')}
                </span>
              </div>
              {list.description && (
                <p className="text-gray-500 dark:text-gray-400">{list.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {totalContacts} {t('email.list.contacts', 'contacts')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <motion.button
                onClick={() => navigate(`/email/lists/${id}/edit`)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Edit2 className="w-4 h-4" />
                {t('email.list.edit', 'Edit')}
              </motion.button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                title={t('email.list.delete', 'Delete')}
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="flex -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }
                  `}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Contacts Tab */}
          {activeTab === 'contacts' && (
            <div>
              {/* Toolbar */}
              <div className="p-4 border-b border-gray-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('email.list.searchContacts', 'Search contacts...')}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {list.type === 'static' && (
                    <motion.button
                      onClick={() => setShowContactSelector(true)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <UserPlus className="w-4 h-4" />
                      {t('email.list.addContacts', 'Add Contacts')}
                    </motion.button>
                  )}

                  <button
                    onClick={() => refetchContacts()}
                    className="p-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                    title={t('email.list.refresh', 'Refresh')}
                  >
                    <RefreshCw className={`w-5 h-5 ${contactsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedContacts.length > 0 && list.type === 'static' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between"
                >
                  <span className="text-sm text-purple-700 dark:text-purple-300">
                    {selectedContacts.length} {t('email.list.selected', 'selected')}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRemoveContacts}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      {t('email.list.removeFromList', 'Remove from list')}
                    </button>
                    <button
                      onClick={() => setSelectedContacts([])}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      {t('email.list.clearSelection', 'Clear')}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Contacts List */}
              <div className="overflow-x-auto">
                {contactsLoading ? (
                  <div className="p-8 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('email.list.loadingContacts', 'Loading contacts...')}
                    </p>
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      {searchQuery
                        ? t('email.list.noResults', 'No contacts found')
                        : t('email.list.noContacts', 'No contacts in this list')
                      }
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {searchQuery
                        ? t('email.list.noResultsDesc', 'Try a different search term')
                        : list.type === 'static'
                          ? t('email.list.noContactsStatic', 'Add contacts to this list to get started')
                          : t('email.list.noContactsDynamic', 'No contacts match the list rules')
                      }
                    </p>
                    {!searchQuery && list.type === 'static' && (
                      <button
                        onClick={() => setShowContactSelector(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        {t('email.list.addContacts', 'Add Contacts')}
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                      <tr>
                        {list.type === 'static' && (
                          <th className="px-4 py-3 text-left">
                            <button
                              onClick={handleSelectAll}
                              className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                            >
                              {selectedContacts.length === contacts.length ? (
                                <CheckSquare className="w-5 h-5 text-purple-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('email.list.contact', 'Contact')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          {t('email.list.status', 'Status')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                          {t('email.list.addedDate', 'Added')}
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
                          onSelect={list.type === 'static' ? () => handleSelectContact(contact.id) : undefined}
                          onClick={() => navigate(`/email/contacts/${contact.id}`)}
                          compact
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
                    {t('email.list.showing', 'Showing {{from}} to {{to}} of {{total}}', {
                      from: (page - 1) * pageSize + 1,
                      to: Math.min(page * pageSize, totalContacts),
                      total: totalContacts
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('email.list.previous', 'Previous')}
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('email.list.next', 'Next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="p-6">
              {list.type === 'static' ? (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    {t('email.list.staticList', 'Static List')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {t('email.list.staticListDesc', 'This is a static list. Contacts are added and removed manually.')}
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('email.list.dynamicRules', 'Dynamic List Rules')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {t('email.list.dynamicRulesDesc', 'Contacts matching these rules are automatically added to this list.')}
                  </p>
                  <ListRuleBuilder
                    rules={list.rules || []}
                    onChange={(rules) => {
                      // Update rules
                    }}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contact Selector Modal */}
      <AnimatePresence>
        {showContactSelector && (
          <ContactSelector
            listId={id}
            onClose={() => setShowContactSelector(false)}
            onSuccess={() => {
              setShowContactSelector(false);
              refetchContacts();
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
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
                {t('email.list.deleteTitle', 'Delete List')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t('email.list.deleteConfirm', 'Are you sure you want to delete "{{name}}"? This will not delete the contacts.', { name: list.name })}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.list.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDeleteList}
                  disabled={deleteListMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteListMutation.isLoading
                    ? t('email.list.deleting', 'Deleting...')
                    : t('email.list.delete', 'Delete')
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

export default ListDetailPage;
