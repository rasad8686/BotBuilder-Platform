import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PERMISSION_GROUPS = [
  {
    name: 'Bots',
    permissions: [
      { key: 'bots_view', label: 'View Bots' },
      { key: 'bots_edit', label: 'Edit Bots' },
      { key: 'bots_create', label: 'Create Bots' },
      { key: 'bots_delete', label: 'Delete Bots' }
    ]
  },
  {
    name: 'Workflows',
    permissions: [
      { key: 'flows_view', label: 'View Workflows' },
      { key: 'flows_edit', label: 'Edit Workflows' },
      { key: 'flows_create', label: 'Create Workflows' },
      { key: 'flows_delete', label: 'Delete Workflows' }
    ]
  },
  {
    name: 'Team',
    permissions: [
      { key: 'team_view', label: 'View Team' },
      { key: 'team_manage', label: 'Manage Team' },
      { key: 'team_invite', label: 'Invite Members' }
    ]
  },
  {
    name: 'Billing',
    permissions: [
      { key: 'billing_view', label: 'View Billing' },
      { key: 'billing_manage', label: 'Manage Billing' }
    ]
  },
  {
    name: 'Other',
    permissions: [
      { key: 'analytics_view', label: 'View Analytics' },
      { key: 'knowledge_view', label: 'View Knowledge Base' },
      { key: 'knowledge_edit', label: 'Edit Knowledge Base' },
      { key: 'settings_view', label: 'View Settings' },
      { key: 'settings_edit', label: 'Edit Settings' }
    ]
  }
];

export default function RoleEditor({ roles, onRoleUpdated }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(false);
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);

  const getToken = () => {
    const token = localStorage.getItem('token');
    return token;
  };

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setEditingRole({ ...role });
    setPermissions(role.permissions || {});
  };

  const handlePermissionChange = (key, value) => {
    setPermissions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveRole = async () => {
    if (!editingRole) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/team/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editingRole.name,
          permissions
        })
      });

      if (res.ok) {
        setSelectedRole(null);
        setEditingRole(null);
        onRoleUpdated();
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/team/roles/${roleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (res.ok) {
        setSelectedRole(null);
        setEditingRole(null);
        onRoleUpdated();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete role');
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setLoading(true);

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API_URL}/api/team/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newRoleName,
          permissions: {}
        })
      });

      if (res.ok) {
        setNewRoleName('');
        setShowNewRoleForm(false);
        onRoleUpdated();
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
      {/* Roles List */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Roles</h3>
          <button
            onClick={() => setShowNewRoleForm(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + New
          </button>
        </div>

        {showNewRoleForm && (
          <div style={{
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            marginBottom: '12px'
          }}>
            <input
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                marginBottom: '8px',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCreateRole}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Create
              </button>
              <button
                onClick={() => { setShowNewRoleForm(false); setNewRoleName(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {roles.map(role => (
            <div
              key={role.id}
              onClick={() => handleSelectRole(role)}
              style={{
                padding: '12px 16px',
                backgroundColor: selectedRole?.id === role.id ? '#eff6ff' : 'white',
                border: `1px solid ${selectedRole?.id === role.id ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: '500' }}>{role.name}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {role.member_count || 0} members
              </div>
              {role.is_default && (
                <span style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  padding: '2px 8px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  Default
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Permissions Editor */}
      <div>
        {editingRole ? (
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '24px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    border: 'none',
                    borderBottom: '2px solid #e5e7eb',
                    padding: '4px 0',
                    outline: 'none'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleSaveRole}
                  disabled={loading}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Save Changes
                </button>
                {!editingRole.is_default && (
                  <button
                    onClick={() => handleDeleteRole(editingRole.id)}
                    disabled={loading}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
              {PERMISSION_GROUPS.map(group => (
                <div key={group.name}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '12px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e5e7eb'
                  }}>
                    {group.name}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.permissions.map(perm => (
                      <label
                        key={perm.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          cursor: 'pointer',
                          padding: '6px 0'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={permissions[perm.key] === true}
                          onChange={(e) => handlePermissionChange(perm.key, e.target.checked)}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontSize: '14px', color: '#4b5563' }}>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <p>Select a role to edit permissions</p>
          </div>
        )}
      </div>
    </div>
  );
}
