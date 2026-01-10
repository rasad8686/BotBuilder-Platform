import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown, Shield, Pencil, Eye, User, Users, Calendar, Building2 } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import axiosInstance from '../api/axios';

export default function Organizations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizations, switchOrganization, refreshOrganizations } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Organizations are already loaded from context
    if (organizations !== null) {
      setLoading(false);
    }
  }, [organizations]);

  const handleSwitchOrg = async (org) => {
    await switchOrganization(org);
    navigate('/dashboard');
  };

  // Generate slug from name
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')          // Replace spaces with hyphens
      .replace(/-+/g, '-')           // Remove consecutive hyphens
      .substring(0, 50);             // Limit length
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setError(t('organizations.nameRequired', 'Organization name is required'));
      return;
    }

    setCreating(true);
    setError('');

    const name = newOrgName.trim();
    const slug = generateSlug(name);

    try {
      await axiosInstance.post('/api/organizations', {
        name,
        slug
      });

      setNewOrgName('');
      setShowCreateModal(false);
      await refreshOrganizations();
    } catch (err) {
      setError(err.response?.data?.message || t('organizations.createFailed', 'Failed to create organization'));
    } finally {
      setCreating(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'owner':
        return { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', Icon: Crown };
      case 'admin':
        return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', Icon: Shield };
      case 'member':
        return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', Icon: Pencil };
      case 'viewer':
        return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', Icon: Eye };
      default:
        return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', Icon: User };
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-slate-700 rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 bg-gray-300 dark:bg-slate-700 rounded-xl"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-300 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-300 dark:bg-slate-700 rounded w-1/2"></div>
                    </div>
                  </div>
                  <div className="h-10 bg-gray-300 dark:bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              {t('organizations.title', 'Your Organizations')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('organizations.subtitle', 'Manage and switch between your organizations')}
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors min-h-[44px]"
          >
            <span>+</span>
            {t('organizations.createNew', 'Create New Organization')}
          </button>
        </div>

        {/* Organizations Grid */}
        {organizations && organizations.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => {
              const badge = getRoleBadge(org.role);
              return (
                <div
                  key={org.id}
                  className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all cursor-pointer group"
                  onClick={() => handleSwitchOrg(org)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    {/* Organization Logo */}
                    <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg group-hover:scale-105 transition-transform">
                      {org.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {org.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge.bg} ${badge.text} flex items-center gap-1`}>
                          <badge.Icon className="w-3 h-3" /> {org.role?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{org.member_count || 1} {t('organizations.members', 'members')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(org.created_at || org.joined_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Switch Button */}
                  <button
                    className="w-full py-2.5 bg-gray-100 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-gray-700 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-300 rounded-lg font-medium transition-colors min-h-[44px]"
                  >
                    {t('organizations.switchTo', 'Switch to this organization')} →
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700">
            <div className="flex justify-center mb-4">
              <Building2 className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('organizations.noOrganizations', 'No organizations yet')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('organizations.createFirst', 'Create your first organization to get started')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
            >
              + {t('organizations.createNew', 'Create New Organization')}
            </button>
          </div>
        )}

        {/* Create Organization Modal */}
        {showCreateModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <div
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-org-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 id="create-org-modal-title" className="text-xl font-semibold text-gray-900 dark:text-white">
                  {t('organizations.createTitle', 'Create Organization')}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-2xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={t('common.close', 'Close')}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateOrg}>
                <div className="mb-6">
                  <label className="block mb-2 font-medium text-gray-700 dark:text-gray-200">
                    {t('organizations.orgName', 'Organization Name')}
                  </label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder={t('organizations.orgNamePlaceholder', 'My Company')}
                    className="w-full px-4 py-3 min-h-[44px] rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 outline-none transition-all"
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg text-sm" role="alert">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-5 py-3 min-h-[44px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-5 py-3 min-h-[44px] bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {creating ? t('common.creating', 'Creating...') : t('common.create', 'Create')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
