import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ACTION_LABELS = {
  team_member_added: { label: 'Member Added', icon: '👤', color: '#10b981' },
  team_member_updated: { label: 'Member Updated', icon: '✏️', color: '#3b82f6' },
  team_member_removed: { label: 'Member Removed', icon: '🚫', color: '#ef4444' },
  team_invitation_sent: { label: 'Invitation Sent', icon: '📧', color: '#8b5cf6' },
  team_invitation_accepted: { label: 'Invitation Accepted', icon: '✅', color: '#10b981' },
  role_created: { label: 'Role Created', icon: '🔐', color: '#3b82f6' },
  role_updated: { label: 'Role Updated', icon: '🔄', color: '#f59e0b' },
  role_deleted: { label: 'Role Deleted', icon: '🗑️', color: '#ef4444' },
  version_created: { label: 'Version Created', icon: '📝', color: '#3b82f6' },
  version_rollback: { label: 'Version Rollback', icon: '⏪', color: '#f59e0b' },
  branch_created: { label: 'Branch Created', icon: '🌿', color: '#10b981' },
  branch_merged: { label: 'Branch Merged', icon: '🔀', color: '#8b5cf6' },
  branch_deleted: { label: 'Branch Deleted', icon: '✂️', color: '#ef4444' }
};

export default function ActivityLog() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ action: '', entityType: '' });

  useEffect(() => {
    fetchActivities();
  }, [filter]);

  const fetchActivities = async () => {
    const token = localStorage.getItem('token');
    // Silent fail
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.action) params.append('action', filter.action);
      if (filter.entityType) params.append('entityType', filter.entityType);
      params.append('limit', '50');

      const res = await fetch(`${API_URL}/api/team/activity?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const getActionInfo = (action) => {
    return ACTION_LABELS[action] || { label: action, icon: '📋', color: '#6b7280' };
  };

  const uniqueActions = [...new Set(activities.map(a => a.action))];
  const uniqueEntityTypes = [...new Set(activities.map(a => a.entity_type))];

  return (
    <div>
      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            Action Type
          </label>
          <select
            value={filter.action}
            onChange={(e) => setFilter(prev => ({ ...prev, action: e.target.value }))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              minWidth: '180px'
            }}
          >
            <option value="">All Actions</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>
                {getActionInfo(action).label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            Entity Type
          </label>
          <select
            value={filter.entityType}
            onChange={(e) => setFilter(prev => ({ ...prev, entityType: e.target.value }))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              minWidth: '180px'
            }}
          >
            <option value="">All Entities</option>
            {uniqueEntityTypes.map(type => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => setFilter({ action: '', entityType: '' })}
            style={{
              padding: '8px 16px',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Activity List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
          Loading activities...
        </div>
      ) : activities.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <p>No activity yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activities.map(activity => {
            const actionInfo = getActionInfo(activity.action);

            return (
              <div
                key={activity.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '16px 20px',
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb'
                }}
              >
                {/* Icon */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: `${actionInfo.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0
                }}>
                  {actionInfo.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{
                      fontWeight: '600',
                      color: actionInfo.color
                    }}>
                      {actionInfo.label}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      {activity.entity_type?.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div style={{ fontSize: '14px', color: '#4b5563' }}>
                    <span style={{ fontWeight: '500' }}>{activity.username || 'System'}</span>
                    {activity.email && (
                      <span style={{ color: '#9ca3af' }}> ({activity.email})</span>
                    )}
                  </div>

                  {activity.changes && Object.keys(activity.changes).length > 0 && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      color: '#6b7280'
                    }}>
                      {JSON.stringify(activity.changes, null, 2).slice(0, 200)}
                      {JSON.stringify(activity.changes).length > 200 && '...'}
                    </div>
                  )}
                </div>

                {/* Time */}
                <div style={{
                  fontSize: '13px',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap'
                }}>
                  {formatTime(activity.created_at)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
