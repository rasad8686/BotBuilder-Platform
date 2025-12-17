import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';

// Available permission resources
const PERMISSION_RESOURCES = [
  { key: 'bots', icon: '🤖', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'flows', icon: '🔀', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'messages', icon: '💬', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'analytics', icon: '📊', actions: ['read', 'export'] },
  { key: 'organization', icon: '🏢', actions: ['read', 'update', 'invite', 'remove_members'] },
  { key: 'api_tokens', icon: '🔑', actions: ['create', 'read', 'delete'] },
  { key: 'webhooks', icon: '🔗', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'knowledge_base', icon: '🧠', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'agents', icon: '🎯', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'workflows', icon: '🔄', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'channels', icon: '📱', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'voice_bots', icon: '📞', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'integrations', icon: '🔌', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'roles', icon: '👔', actions: ['create', 'read', 'update', 'delete'] },
  { key: 'users', icon: '👤', actions: ['read', 'update', 'delete', 'assign_role'] }
];

export default function AdminRoles() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {}
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/roles');
      if (response.data.success) {
        setRoles(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || t('roles.fetchError', 'Failed to load roles'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const response = await api.post('/api/roles', formData);
      if (response.data.success) {
        setRoles([...roles, response.data.data]);
        setShowCreateModal(false);
        resetForm();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || t('roles.createError', 'Failed to create role'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const response = await api.put(`/api/roles/${selectedRole.id}`, formData);
      if (response.data.success) {
        setRoles(roles.map(r => r.id === selectedRole.id ? response.data.data : r));
        setShowEditModal(false);
        resetForm();
      }
    } catch (err) {
      setFormError(err.response?.data?.message || t('roles.updateError', 'Failed to update role'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    setSaving(true);
    try {
      const response = await api.delete(`/api/roles/${selectedRole.id}`);
      if (response.data.success) {
        setRoles(roles.filter(r => r.id !== selectedRole.id));
        setShowDeleteModal(false);
        setSelectedRole(null);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || t('roles.deleteError', 'Failed to delete role'));
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {}
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (role) => {
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', permissions: {} });
    setSelectedRole(null);
    setFormError(null);
  };

  const togglePermission = (resource, action) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions[resource] || [];
      const newPermissions = currentPermissions.includes(action)
        ? currentPermissions.filter(a => a !== action)
        : [...currentPermissions, action];

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [resource]: newPermissions
        }
      };
    });
  };

  const toggleAllForResource = (resource, actions) => {
    setFormData(prev => {
      const currentPermissions = prev.permissions[resource] || [];
      const allSelected = actions.every(a => currentPermissions.includes(a));

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [resource]: allSelected ? [] : [...actions]
        }
      };
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">👔</div>
          <div className="text-xl text-gray-600 dark:text-gray-400">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-8 px-4 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium mb-4"
        >
          ← {t('common.back')}
        </Link>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              👔 {t('roles.title', 'Role Management')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {t('roles.subtitle', 'Create custom roles and manage permissions')}
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            + {t('roles.createRole', 'Create Role')}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div
              key={role.id}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-slate-700"
            >
              {/* Role Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {role.name}
                    {role.is_system && (
                      <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
                        {t('roles.system', 'System')}
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {role.description || t('roles.noDescription', 'No description')}
                  </p>
                </div>
              </div>

              {/* Permission Summary */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('roles.permissions', 'Permissions')}:
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(role.permissions || {}).map(([resource, actions]) => (
                    actions.length > 0 && (
                      <span
                        key={resource}
                        className="text-xs bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded"
                      >
                        {resource}: {actions.length}
                      </span>
                    )
                  ))}
                  {Object.keys(role.permissions || {}).length === 0 && (
                    <span className="text-xs text-gray-400">{t('roles.noPermissions', 'No permissions')}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(role)}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                  {t('common.edit')}
                </button>
                {!role.is_system && (
                  <button
                    onClick={() => openDeleteModal(role)}
                    className="bg-red-600 text-white py-2 px-3 rounded-lg text-sm hover:bg-red-700 transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {roles.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">👔</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('roles.noRoles', 'No Roles Yet')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {t('roles.noRolesDesc', 'Create your first custom role to get started')}
            </p>
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetForm();
            }} />

            <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {showCreateModal ? t('roles.createRole', 'Create Role') : t('roles.editRole', 'Edit Role')}
                </h2>

                {formError && (
                  <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
                    {formError}
                  </div>
                )}

                <form onSubmit={showCreateModal ? handleCreateRole : handleUpdateRole}>
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                        {t('roles.roleName', 'Role Name')} *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                        placeholder={t('roles.roleNamePlaceholder', 'e.g., Editor, Moderator')}
                        disabled={showEditModal && selectedRole?.is_system}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
                        {t('roles.description', 'Description')}
                      </label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-slate-700 dark:text-white"
                        placeholder={t('roles.descriptionPlaceholder', 'Role description...')}
                      />
                    </div>
                  </div>

                  {/* Permissions Grid */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {t('roles.permissions', 'Permissions')}
                    </h3>
                    <div className="space-y-4">
                      {PERMISSION_RESOURCES.map((resource) => (
                        <div
                          key={resource.key}
                          className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{resource.icon}</span>
                              <span className="font-medium text-gray-900 dark:text-white capitalize">
                                {t(`roles.resources.${resource.key}`, resource.key.replace('_', ' '))}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleAllForResource(resource.key, resource.actions)}
                              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                            >
                              {(formData.permissions[resource.key] || []).length === resource.actions.length
                                ? t('roles.deselectAll', 'Deselect All')
                                : t('roles.selectAll', 'Select All')}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {resource.actions.map((action) => {
                              const isSelected = (formData.permissions[resource.key] || []).includes(action);
                              return (
                                <button
                                  key={action}
                                  type="button"
                                  onClick={() => togglePermission(resource.key, action)}
                                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                                    isSelected
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                                  }`}
                                >
                                  {t(`roles.actions.${action}`, action)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        resetForm();
                      }}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? t('common.saving') : t('common.save')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowDeleteModal(false)} />
            <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                {t('roles.deleteConfirmTitle', 'Delete Role')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t('roles.deleteConfirm', `Are you sure you want to delete the role "${selectedRole.name}"? This action cannot be undone.`)}
              </p>
              {formError && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg mb-4">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleDeleteRole}
                  disabled={saving}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {saving ? t('common.deleting', 'Deleting...') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
