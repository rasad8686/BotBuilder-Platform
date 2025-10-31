import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import axiosInstance from '../api/axios';
import InviteMemberModal from '../components/InviteMemberModal';
import ConfirmModal from '../components/ConfirmModal';

export default function OrganizationSettings() {
  const { currentOrganization, userRole, hasPermission, refreshOrganizations } = useOrganization();
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
    if (!currentOrganization) return;

    // Check permissions
    if (!hasPermission('admin')) {
      setError('You do not have permission to view organization settings');
      return;
    }

    setOrgName(currentOrganization.name);
    setOrgSlug(currentOrganization.slug);
    fetchMembers();
  }, [currentOrganization]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/organizations/${currentOrganization.id}/members`);
      setMembers(response.data.members || []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError(err.response?.data?.message || 'Failed to load members');
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
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg">
            ⚠️ You do not have permission to view organization settings
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            ⚙️ Organization Settings
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your organization and team members
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            ✅ {successMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            ⚠️ {error}
          </div>
        )}

        {/* Organization Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Organization Details</h2>
            {userRole === 'owner' && !isEditingOrg && (
              <button
                onClick={() => setIsEditingOrg(true)}
                className="text-purple-600 hover:text-purple-700 font-medium text-sm"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              {isEditingOrg ? (
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              ) : (
                <p className="text-gray-900 font-medium">{currentOrganization.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Slug
              </label>
              {isEditingOrg ? (
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="my-organization"
                />
              ) : (
                <p className="text-gray-600 font-mono">{currentOrganization.slug}</p>
              )}
            </div>

            {isEditingOrg && (
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleUpdateOrganization}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditingOrg(false);
                    setOrgName(currentOrganization.name);
                    setOrgSlug(currentOrganization.slug);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
            {hasPermission('admin') && (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
              >
                ➕ Invite Member
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-300 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {(member.name || member.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{member.name || 'No name'}</div>
                      <div className="text-sm text-gray-600">{member.email}</div>
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
                        className="text-red-600 hover:text-red-700 font-medium text-sm px-3 py-1.5 hover:bg-red-50 rounded transition-colors"
                      >
                        Remove
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
          <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
            <h2 className="text-xl font-bold text-red-600 mb-2">⚠️ Danger Zone</h2>
            <p className="text-gray-600 mb-4">
              Once you delete an organization, there is no going back. Please be certain.
            </p>
            <button
              onClick={() => setDeleteOrgModalOpen(true)}
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Delete Organization
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
