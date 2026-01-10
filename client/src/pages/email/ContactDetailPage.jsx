import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit2, Trash2, ListPlus, UserMinus, MoreHorizontal,
  Mail, Phone, Building2, Briefcase, Calendar, Clock, Tag,
  Send, Eye, MousePointer, AlertTriangle, CheckCircle, XCircle,
  ExternalLink, RefreshCw
} from 'lucide-react';
import { useContactQuery, useUpdateContactMutation, useDeleteContactMutation } from '../../hooks/email/useContacts';
import ContactAvatar from '../../components/email/ContactAvatar';
import ContactStatusBadge from '../../components/email/ContactStatusBadge';
import ContactTagsInput from '../../components/email/ContactTagsInput';
import ContactActivityTimeline from '../../components/email/ContactActivityTimeline';

const ContactDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Fetch contact data
  const { data: contact, isLoading, error, refetch } = useContactQuery(id);
  const updateMutation = useUpdateContactMutation();
  const deleteMutation = useDeleteContactMutation();

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      navigate('/email/contacts');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Handle unsubscribe
  const handleUnsubscribe = async () => {
    try {
      await updateMutation.mutateAsync({ id, status: 'unsubscribed' });
      refetch();
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  };

  // Handle tag update
  const handleTagsUpdate = async (tags) => {
    try {
      await updateMutation.mutateAsync({ id, tags });
      refetch();
    } catch (err) {
      console.error('Tag update failed:', err);
    }
  };

  const tabs = [
    { id: 'overview', label: t('email.contact.overview', 'Overview') },
    { id: 'activity', label: t('email.contact.activity', 'Activity') },
    { id: 'campaigns', label: t('email.contact.campaigns', 'Campaigns') },
    { id: 'lists', label: t('email.contact.lists', 'Lists') }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('email.contact.notFound', 'Contact not found')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {error?.message || t('email.contact.notFoundDesc', 'The contact you are looking for does not exist.')}
          </p>
          <button
            onClick={() => navigate('/email/contacts')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('email.contact.backToContacts', 'Back to Contacts')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/email/contacts')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('email.contact.backToContacts', 'Back to Contacts')}
        </button>

        {/* Contact Header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ContactAvatar
                email={contact.email}
                name={`${contact.first_name || ''} ${contact.last_name || ''}`.trim()}
                size="lg"
                status={contact.status}
              />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {contact.first_name || contact.last_name
                      ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                      : contact.email}
                  </h1>
                  <ContactStatusBadge status={contact.status} />
                </div>
                <p className="text-gray-500 dark:text-gray-400">{contact.email}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <motion.button
                onClick={() => navigate(`/email/contacts/${id}/edit`)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Edit2 className="w-4 h-4" />
                {t('email.contact.edit', 'Edit')}
              </motion.button>

              <div className="relative">
                <button
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  className="p-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>

                <AnimatePresence>
                  {showActionsMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-10"
                    >
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          // Open add to list modal
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >
                        <ListPlus className="w-4 h-4" />
                        {t('email.contact.addToList', 'Add to List')}
                      </button>
                      {contact.status === 'subscribed' && (
                        <button
                          onClick={() => {
                            setShowActionsMenu(false);
                            handleUnsubscribe();
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                        >
                          <UserMinus className="w-4 h-4" />
                          {t('email.contact.unsubscribe', 'Unsubscribe')}
                        </button>
                      )}
                      <hr className="my-1 border-gray-200 dark:border-slate-700" />
                      <button
                        onClick={() => {
                          setShowActionsMenu(false);
                          setShowDeleteModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('email.contact.delete', 'Delete')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                    px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contact Info Card */}
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('email.contact.contactInfo', 'Contact Information')}
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('email.contact.email', 'Email')}
                        </p>
                        <p className="text-gray-900 dark:text-white">{contact.email}</p>
                      </div>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('email.contact.phone', 'Phone')}
                          </p>
                          <p className="text-gray-900 dark:text-white">{contact.phone}</p>
                        </div>
                      </div>
                    )}
                    {contact.company && (
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('email.contact.company', 'Company')}
                          </p>
                          <p className="text-gray-900 dark:text-white">{contact.company}</p>
                        </div>
                      </div>
                    )}
                    {contact.job_title && (
                      <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('email.contact.jobTitle', 'Job Title')}
                          </p>
                          <p className="text-gray-900 dark:text-white">{contact.job_title}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags Card */}
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('email.contact.tags', 'Tags')}
                  </h3>
                  <ContactTagsInput
                    tags={contact.tags || []}
                    onChange={handleTagsUpdate}
                    editable
                  />
                </div>

                {/* Custom Fields Card */}
                {contact.custom_fields && Object.keys(contact.custom_fields).length > 0 && (
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-5">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {t('email.contact.customFields', 'Custom Fields')}
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(contact.custom_fields).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{key}</p>
                          <p className="text-gray-900 dark:text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subscription Info */}
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    {t('email.contact.subscriptionInfo', 'Subscription Info')}
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('email.contact.subscribedDate', 'Subscribed Date')}
                        </p>
                        <p className="text-gray-900 dark:text-white">
                          {new Date(contact.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ExternalLink className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('email.contact.source', 'Source')}
                        </p>
                        <p className="text-gray-900 dark:text-white capitalize">
                          {contact.source || 'manual'}
                        </p>
                      </div>
                    </div>
                    {contact.last_activity && (
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('email.contact.lastActivity', 'Last Activity')}
                          </p>
                          <p className="text-gray-900 dark:text-white">
                            {new Date(contact.last_activity).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <ContactActivityTimeline
                contactId={id}
                activities={contact.activities || []}
              />
            )}

            {/* Campaigns Tab */}
            {activeTab === 'campaigns' && (
              <div>
                {contact.campaigns && contact.campaigns.length > 0 ? (
                  <div className="space-y-4">
                    {contact.campaigns.map(campaign => (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {campaign.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(campaign.sent_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {campaign.delivered && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm">{t('email.contact.delivered', 'Delivered')}</span>
                            </div>
                          )}
                          {campaign.opened && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <Eye className="w-4 h-4" />
                              <span className="text-sm">{t('email.contact.opened', 'Opened')}</span>
                            </div>
                          )}
                          {campaign.clicked && (
                            <div className="flex items-center gap-1 text-purple-600">
                              <MousePointer className="w-4 h-4" />
                              <span className="text-sm">{t('email.contact.clicked', 'Clicked')}</span>
                            </div>
                          )}
                          {campaign.bounced && (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-4 h-4" />
                              <span className="text-sm">{t('email.contact.bounced', 'Bounced')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Send className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('email.contact.noCampaigns', 'No campaigns sent to this contact yet.')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Lists Tab */}
            {activeTab === 'lists' && (
              <div>
                {contact.lists && contact.lists.length > 0 ? (
                  <div className="space-y-4">
                    {contact.lists.map(list => (
                      <div
                        key={list.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                      >
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {list.name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {list.contact_count} {t('email.contact.contacts', 'contacts')}
                          </p>
                        </div>
                        <button
                          onClick={() => {/* Remove from list */}}
                          className="text-sm text-red-600 hover:underline"
                        >
                          {t('email.contact.removeFromList', 'Remove')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Tag className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {t('email.contact.noLists', 'This contact is not in any lists.')}
                    </p>
                    <button
                      onClick={() => {/* Open add to list modal */}}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {t('email.contact.addToList', 'Add to List')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
                {t('email.contact.deleteTitle', 'Delete Contact')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t('email.contact.deleteConfirm', 'Are you sure you want to delete this contact? This action cannot be undone.')}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  {t('email.contact.cancel', 'Cancel')}
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {t('email.contact.delete', 'Delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContactDetailPage;
