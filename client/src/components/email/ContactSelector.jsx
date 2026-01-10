import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Search, CheckSquare, Square, Users, RefreshCw } from 'lucide-react';
import { useContactsQuery } from '../../hooks/email/useContacts';
import { useAddContactsToListMutation } from '../../hooks/email/useLists';
import ContactAvatar from './ContactAvatar';
import ContactStatusBadge from './ContactStatusBadge';

const ContactSelector = ({ listId, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch contacts not in this list
  const { data, isLoading, refetch } = useContactsQuery({
    search: searchQuery,
    excludeList: listId,
    page,
    pageSize
  });
  const contacts = data?.contacts || [];
  const totalContacts = data?.total || 0;

  // Add contacts mutation
  const addContactsMutation = useAddContactsToListMutation();

  // Toggle contact selection
  const toggleContact = useCallback((contactId) => {
    setSelectedContacts(prev => {
      if (prev.includes(contactId)) {
        return prev.filter(id => id !== contactId);
      }
      return [...prev, contactId];
    });
  }, []);

  // Select all visible contacts
  const selectAll = () => {
    const allIds = contacts.map(c => c.id);
    const allSelected = allIds.every(id => selectedContacts.includes(id));

    if (allSelected) {
      setSelectedContacts(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedContacts(prev => [...new Set([...prev, ...allIds])]);
    }
  };

  // Add selected contacts to list
  const handleAdd = async () => {
    if (selectedContacts.length === 0) return;

    try {
      await addContactsMutation.mutateAsync({
        listId,
        contactIds: selectedContacts
      });
      onSuccess && onSuccess();
    } catch (err) {
      console.error('Failed to add contacts:', err);
    }
  };

  const totalPages = Math.ceil(totalContacts / pageSize);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('email.contactSelector.title', 'Add Contacts to List')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('email.contactSelector.search', 'Search contacts...')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Selection info */}
        {selectedContacts.length > 0 && (
          <div className="px-6 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-800">
            <span className="text-sm text-purple-700 dark:text-purple-300">
              {t('email.contactSelector.selected', '{{count}} contacts selected', {
                count: selectedContacts.length
              })}
            </span>
          </div>
        )}

        {/* Contacts list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? t('email.contactSelector.noResults', 'No contacts found')
                  : t('email.contactSelector.noContacts', 'No contacts available')
                }
              </p>
            </div>
          ) : (
            <div>
              {/* Select all */}
              <div className="px-6 py-2 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                <button
                  onClick={selectAll}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {contacts.every(c => selectedContacts.includes(c.id)) ? (
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {t('email.contactSelector.selectAll', 'Select all on this page')}
                </button>
              </div>

              {/* Contacts */}
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {contacts.map(contact => {
                  const isSelected = selectedContacts.includes(contact.id);
                  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

                  return (
                    <div
                      key={contact.id}
                      onClick={() => toggleContact(contact.id)}
                      className={`
                        flex items-center gap-4 px-6 py-3 cursor-pointer transition-colors
                        ${isSelected
                          ? 'bg-purple-50 dark:bg-purple-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                        }
                      `}
                    >
                      <button className="flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      <ContactAvatar
                        email={contact.email}
                        name={fullName}
                        size="sm"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {fullName || contact.email}
                        </p>
                        {fullName && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {contact.email}
                          </p>
                        )}
                      </div>

                      <ContactStatusBadge status={contact.status} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('email.contactSelector.page', 'Page {{page}} of {{total}}', {
                page,
                total: totalPages
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm disabled:opacity-50"
              >
                {t('email.contactSelector.prev', 'Previous')}
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-gray-300 dark:border-slate-600 rounded text-sm disabled:opacity-50"
              >
                {t('email.contactSelector.next', 'Next')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            {t('email.contactSelector.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleAdd}
            disabled={selectedContacts.length === 0 || addContactsMutation.isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addContactsMutation.isLoading
              ? t('email.contactSelector.adding', 'Adding...')
              : t('email.contactSelector.add', 'Add {{count}} Contacts', { count: selectedContacts.length })
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ContactSelector;
