import React, { useState, useEffect } from 'react';
import MemberList from '../components/team/MemberList';
import InviteModal from '../components/team/InviteModal';
import RoleEditor from '../components/team/RoleEditor';
import ActivityLog from '../components/team/ActivityLog';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function TeamSettings() {
  const [activeTab, setActiveTab] = useState('members');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    console.log('TeamSettings - Token:', token ? 'exists' : 'missing', token?.substring(0, 20) + '...');
    if (!token) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('TeamSettings - Making API calls with token');
      const [membersRes, rolesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/team/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/team/roles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_URL}/api/team/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (membersRes.ok) setMembers(await membersRes.json());
      if (rolesRes.ok) setRoles(await rolesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      setError('Failed to load team data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteSent = () => {
    setShowInviteModal(false);
    fetchData();
  };

  const handleMemberUpdated = () => {
    fetchData();
  };

  const handleRoleUpdated = () => {
    fetchData();
  };

  const tabs = [
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'roles', label: 'Roles', icon: '🔐' },
    { id: 'activity', label: 'Activity', icon: '📋' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>Team Settings</h1>
          <p style={{ color: '#6b7280', marginTop: '4px' }}>
            Manage your team members, roles, and permissions
          </p>
        </div>
        {activeTab === 'members' && (
          <button
            onClick={() => setShowInviteModal(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>+</span> Invite Member
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            padding: '20px',
            backgroundColor: '#f0f9ff',
            borderRadius: '12px',
            border: '1px solid #bae6fd'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#0369a1' }}>
              {stats.members?.total_members || 0}
            </div>
            <div style={{ color: '#0c4a6e', fontSize: '14px' }}>Total Members</div>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#f0fdf4',
            borderRadius: '12px',
            border: '1px solid #bbf7d0'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#15803d' }}>
              {stats.members?.active_members || 0}
            </div>
            <div style={{ color: '#14532d', fontSize: '14px' }}>Active Members</div>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#fefce8',
            borderRadius: '12px',
            border: '1px solid #fef08a'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#a16207' }}>
              {stats.invitations?.pending_invitations || 0}
            </div>
            <div style={{ color: '#713f12', fontSize: '14px' }}>Pending Invites</div>
          </div>
          <div style={{
            padding: '20px',
            backgroundColor: '#faf5ff',
            borderRadius: '12px',
            border: '1px solid #e9d5ff'
          }}>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#7e22ce' }}>
              {stats.roles?.length || 0}
            </div>
            <div style={{ color: '#581c87', fontSize: '14px' }}>Roles</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '1px solid #e5e7eb',
        paddingBottom: '12px'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading...
        </div>
      ) : error ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          color: '#dc2626',
          backgroundColor: '#fef2f2',
          borderRadius: '12px'
        }}>
          {error}
        </div>
      ) : (
        <>
          {activeTab === 'members' && (
            <MemberList
              members={members}
              roles={roles}
              onMemberUpdated={handleMemberUpdated}
            />
          )}
          {activeTab === 'roles' && (
            <RoleEditor
              roles={roles}
              onRoleUpdated={handleRoleUpdated}
            />
          )}
          {activeTab === 'activity' && (
            <ActivityLog />
          )}
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          roles={roles}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}
    </div>
  );
}
