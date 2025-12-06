import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function MemberList({ members, roles, onMemberUpdated }) {
  const [editingMember, setEditingMember] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);

  const getToken = () => localStorage.getItem('token');

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return { bg: '#dcfce7', text: '#15803d' };
      case 'inactive': return { bg: '#f3f4f6', text: '#6b7280' };
      case 'suspended': return { bg: '#fee2e2', text: '#dc2626' };
      default: return { bg: '#f3f4f6', text: '#6b7280' };
    }
  };

  const handleUpdateRole = async (memberId) => {
    if (!selectedRole) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/team/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roleId: parseInt(selectedRole) })
      });

      if (res.ok) {
        setEditingMember(null);
        setSelectedRole('');
        onMemberUpdated();
      }
    } catch (err) {
      console.error('Failed to update role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/team/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (res.ok) {
        onMemberUpdated();
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!members || members.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        color: '#6b7280'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
        <p>No team members yet</p>
        <p style={{ fontSize: '14px' }}>Invite your first team member to get started</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {members.map(member => {
        const statusColors = getStatusColor(member.status);
        const isEditing = editingMember === member.id;

        return (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              backgroundColor: 'white',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              transition: 'box-shadow 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Avatar */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                fontSize: '16px'
              }}>
                {getInitials(member.username)}
              </div>

              {/* Info */}
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px' }}>
                  {member.username}
                </div>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  {member.email}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Role */}
              {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d1d5db',
                      fontSize: '14px'
                    }}
                  >
                    <option value="">Select role</option>
                    {roles.map(role => (
                      <option key={role.id} value={role.id}>{role.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleUpdateRole(member.id)}
                    disabled={loading || !selectedRole}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingMember(null); setSelectedRole(''); }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  {member.role_name}
                </div>
              )}

              {/* Status */}
              <div style={{
                padding: '6px 12px',
                backgroundColor: statusColors.bg,
                color: statusColors.text,
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500',
                textTransform: 'capitalize'
              }}>
                {member.status}
              </div>

              {/* Actions */}
              {!isEditing && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setEditingMember(member.id);
                      setSelectedRole(member.role_id?.toString() || '');
                    }}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Edit Role
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={loading}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
