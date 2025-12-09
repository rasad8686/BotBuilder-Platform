import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '../contexts/OrganizationContext';
import axiosInstance from '../api/axios';
import InviteMemberModal from '../components/InviteMemberModal';
import ConfirmModal from '../components/ConfirmModal';

export default function OrganizationSettings() {
  const { t } = useTranslation();
  const { currentOrganization, userRole, hasPermission, refreshOrganizations, loading: orgLoading, isAuthenticated } = useOrganization();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteOrgModalOpen, setDeleteOrgModalOpen] = useState(false);
  const [removeMemberModal, setRemoveMemberModal] = useState({ open: false, member: null });
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [isEditingOrg, setIsEditingOrg] = useState(false);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    // Wait for organization to load
    if (orgLoading) {
      return;
    }

    // If no organization, redirect to dashboard
    if (!currentOrganization) {
      setError('No organization found. Please select an organization.');
      setTimeout(() => navigate('/dashboard'), 2000);
      return;
    }

    // Check permissions
    if (!hasPermission('admin')) {
      setError('You do not have permission to view organization settings');
      setTimeout(() => navigate('/dashboard'), 2000);
      return;
    }

    setOrgName(currentOrganization.name);
    setOrgSlug(currentOrganization.slug);
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization, orgLoading, isAuthenticated, hasPermission, navigate]);

  const fetchMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/organizations/${currentOrganization.id}/members`);
      setMembers(response.data.members || []);
      setError('');
    } catch (err) {
      // Silent fail

      // Handle specific error codes
      if (err.response?.status === 401) {
        setError('Authentication required. Redirecting to login...');
        setTimeout(() => navigate('/login'), 1500);
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view members');
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setError(err.response?.data?.message || 'Failed to load members');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrganization = async () => {
    try {
      await axiosInstance.put(`/api/organizations/${currentOrganization.id}`, {
        name: orgName,
        slug: orgSlug
      });
      setSuccessMessage('Organization updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      setIsEditingOrg(false);
      refreshOrganizations();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update organization');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleUpdateRole = async (memberId, newRole) => {
    try {
      await axiosInstance.put(`/api/organizations/${currentOrganization.id}/members/${memberId}/role`, {
        role: newRole
      });
      setSuccessMessage('Member role updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update member role');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeMemberModal.member) return;

    try {
      await axiosInstance.delete(
        `/api/organizations/${currentOrganization.id}/members/${removeMemberModal.member.user_id}`
      );
      setSuccessMessage('Member removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      setRemoveMemberModal({ open: false, member: null });
      fetchMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteOrganization = async () => {
    try {
      await axiosInstance.delete(`/api/organizations/${currentOrganization.id}`);
      setSuccessMessage('Organization deleted successfully');
      // Clear localStorage and redirect
      localStorage.removeItem('currentOrganizationId');
      setTimeout(() => {
        navigate('/dashboard');
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete organization');
      setTimeout(() => setError(''), 5000);
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'admin':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'member':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'viewer':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'owner': return '👑';
      case 'admin': return '🛡️';
      case 'member': return '✏️';
      case 'viewer': return '👁️';
      default: return '👤';
    }
  };

  if (!hasPermission('admin')) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-6 py-4 rounded-lg">
            {t('organization.noPermission')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {t('organization.settings')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('organization.settingsSubtitle')}
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            ✅ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Organization Details */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('organization.details')}</h2>
            {userRole === 'owner' && !isEditingOrg && (
              <button
                onClick={() => setIsEditingOrg(true)}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium text-sm"
              >
                {t('common.edit')}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('organization.name')}
              </label>
              {isEditingOrg ? (
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                />
              ) : (
                <p className="text-gray-900 dark:text-white font-medium">{currentOrganization.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('organization.slug')}
              </label>
              {isEditingOrg ? (
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                  placeholder="my-organization"
                />
              ) : (
                <p className="text-gray-600 dark:text-gray-400 font-mono">{currentOrganization.slug}</p>
              )}
            </div>

            {isEditingOrg && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdateOrganization}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  {t('common.saveChanges')}
                </button>
                <button
                  onClick={() => {
                    setIsEditingOrg(false);
                    setOrgName(currentOrganization.name);
                    setOrgSlug(currentOrganization.slug);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 mb-6 transition-colors duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('team.members')}</h2>
            {hasPermission('admin') && (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
              >
                {t('team.inviteMember')}
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                  <div className="w-12 h-12 bg-gray-300 dark:bg-slate-600 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 dark:bg-slate-600 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-300 dark:bg-slate-600 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {(member.name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{member.name || 'No name'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{member.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role Badge/Selector */}
                    {hasPermission('admin') && member.role !== 'owner' ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.user_id, e.target.value)}
                        className={`text-xs font-bold px-3 py-1.5 rounded border cursor-pointer ${getRoleBadgeColor(member.role)}`}
                      >
                        <option value="admin">🛡️ ADMIN</option>
                        <option value="member">✏️ MEMBER</option>
                        <option value="viewer">👁️ VIEWER</option>
                      </select>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1.5 rounded border ${getRoleBadgeColor(member.role)}`}>
                        {getRoleIcon(member.role)} {member.role.toUpperCase()}
                      </span>
                    )}

                    {/* Remove Button */}
                    {hasPermission('admin') && member.role !== 'owner' && (
                      <button
                        onClick={() => setRemoveMemberModal({ open: true, member })}
                        className="text-red-600 hover:text-red-700 font-medium text-sm px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        {t('common.remove')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Danger Zone */}
        {userRole === 'owner' && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-red-200 dark:border-red-800 transition-colors duration-300">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">{t('organization.dangerZone')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('organization.deleteWarning')}
            </p>
            <button
              onClick={() => setDeleteOrgModalOpen(true)}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              {t('organization.deleteOrganization')}
            </button>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSuccess={() => {
          setInviteModalOpen(false);
          fetchMembers();
          setSuccessMessage('Invitation sent successfully');
          setTimeout(() => setSuccessMessage(''), 3000);
        }}
        organizationId={currentOrganization?.id}
      />

      {/* Remove Member Confirmation */}
      <ConfirmModal
        isOpen={removeMemberModal.open}
        onClose={() => setRemoveMemberModal({ open: false, member: null })}
        onConfirm={handleRemoveMember}
        title="Remove Member?"
        message={`Are you sure you want to remove ${removeMemberModal.member?.name || removeMemberModal.member?.email} from this organization?`}
        confirmText="Remove"
        cancelText="Cancel"
        isDanger={true}
      />

      {/* Delete Organization Confirmation */}
      <ConfirmModal
        isOpen={deleteOrgModalOpen}
        onClose={() => setDeleteOrgModalOpen(false)}
        onConfirm={handleDeleteOrganization}
        title="Delete Organization?"
        message={`Are you sure you want to delete "${currentOrganization?.name}"? This action cannot be undone and all associated data will be permanently deleted.`}
        confirmText="Delete Organization"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
}
