import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ROLE_COLORS = {
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  editor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

export default function Workspaces() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: workspaceId } = useParams();

  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Form states
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
  const [newMember, setNewMember] = useState({ email: '', role: 'viewer' });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');

  // Fetch workspaces
  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/workspaces`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch workspace details
  const fetchWorkspaceDetails = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/workspaces/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedWorkspace(data.workspace);
      }
    } catch (err) {
      console.error('Failed to fetch workspace:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceDetails(workspaceId);
    } else {
      setSelectedWorkspace(null);
    }
  }, [workspaceId, fetchWorkspaceDetails]);

  // Create workspace
  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/workspaces`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newWorkspace)
      });

      if (res.ok) {
        await fetchWorkspaces();
        setShowCreateModal(false);
        setNewWorkspace({ name: '', description: '' });
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setSaving(false);
    }
  };

  // Add member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedWorkspace) return;
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/workspaces/${selectedWorkspace.id}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newMember)
      });

      if (res.ok) {
        await fetchWorkspaceDetails(selectedWorkspace.id);
        setShowMemberModal(false);
        setNewMember({ email: '', role: 'viewer' });
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    } finally {
      setSaving(false);
    }
  };

  // Remove member
  const handleRemoveMember = async (memberId) => {
    if (!selectedWorkspace || !confirm('Remove this member from the workspace?')) return;

    try {
      const res = await fetch(`${API_URL}/api/workspaces/${selectedWorkspace.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        await fetchWorkspaceDetails(selectedWorkspace.id);
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  // Update member role
  const handleUpdateRole = async (memberId, newRole) => {
    if (!selectedWorkspace) return;

    try {
      await fetch(`${API_URL}/api/workspaces/${selectedWorkspace.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      await fetchWorkspaceDetails(selectedWorkspace.id);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  // Delete workspace
  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace || !confirm('Delete this workspace? This action cannot be undone.')) return;

    try {
      const res = await fetch(`${API_URL}/api/workspaces/${selectedWorkspace.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        navigate('/workspaces');
        fetchWorkspaces();
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('common.loading', 'Loading...')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Workspace detail view
  if (selectedWorkspace) {
    const canManage = ['owner', 'admin'].includes(selectedWorkspace.userRole);
    const isOwner = selectedWorkspace.userRole === 'owner';

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/workspaces')}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {selectedWorkspace.name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {selectedWorkspace.description || 'No description'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm font-medium rounded-full ${ROLE_COLORS[selectedWorkspace.userRole]}`}>
                {selectedWorkspace.userRole}
              </span>
              {canManage && (
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Members */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('workspaces.members', 'Members')} ({selectedWorkspace.members?.length || 0})
                </h2>
                {canManage && (
                  <button
                    onClick={() => setShowMemberModal(true)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                  >
                    {t('workspaces.addMember', 'Add Member')}
                  </button>
                )}
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {(selectedWorkspace.members || []).map(member => (
                  <div key={member.userId} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                          {member.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isOwner && member.role !== 'owner' ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[member.role]}`}>
                          {member.role}
                        </span>
                      )}

                      {canManage && member.role !== 'owner' && (
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-1 text-red-500 hover:text-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats & Resources */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('workspaces.stats', 'Statistics')}
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Members</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedWorkspace.members?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Resources</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedWorkspace.resources?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {isOwner && !selectedWorkspace.isDefault && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                    {t('workspaces.dangerZone', 'Danger Zone')}
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                    {t('workspaces.deleteWarning', 'Deleting a workspace is permanent and cannot be undone.')}
                  </p>
                  <button
                    onClick={handleDeleteWorkspace}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    {t('workspaces.deleteWorkspace', 'Delete Workspace')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Add Member Modal */}
        {showMemberModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t('workspaces.addMember', 'Add Member')}
              </h3>
              <form onSubmit={handleAddMember}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={newMember.role}
                    onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowMemberModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Workspaces list view
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('workspaces.title', 'Workspaces')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('workspaces.description', 'Organize your team resources into workspaces')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              {t('workspaces.create', 'Create Workspace')}
            </button>
          </div>
        </div>

        {/* Workspaces Grid/List */}
        {workspaces.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('workspaces.noWorkspaces', 'No Workspaces Yet')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('workspaces.createFirst', 'Create your first workspace to organize your team resources')}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {t('workspaces.create', 'Create Workspace')}
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map(workspace => (
              <div
                key={workspace.id}
                onClick={() => navigate(`/workspaces/${workspace.id}`)}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-white">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {workspace.isDefault && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                      Default
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {workspace.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                  {workspace.description || 'No description'}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                    <span>{workspace.memberCount} members</span>
                    <span>{workspace.resourceCount} resources</span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ROLE_COLORS[workspace.userRole]}`}>
                    {workspace.userRole}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Members</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Resources</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-300">Your Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {workspaces.map(workspace => (
                  <tr
                    key={workspace.id}
                    onClick={() => navigate(`/workspaces/${workspace.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {workspace.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-white">{workspace.name}</span>
                        {workspace.isDefault && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{workspace.memberCount}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{workspace.resourceCount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${ROLE_COLORS[workspace.userRole]}`}>
                        {workspace.userRole}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {t('workspaces.create', 'Create Workspace')}
            </h3>
            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newWorkspace.name}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Marketing Team"
                  required
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newWorkspace.description}
                  onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
