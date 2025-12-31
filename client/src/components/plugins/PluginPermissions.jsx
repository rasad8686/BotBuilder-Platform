import React, { useState } from 'react';

const PluginPermissions = ({
  permissions = [],
  granted = [],
  onGrant,
  onRevoke,
  editable = false,
  showDescriptions = true,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(false);

  const permissionDetails = {
    'read:data': {
      name: 'Read Data',
      description: 'Access to read plugin data storage',
      icon: '&#128065;',
      risk: 'low'
    },
    'write:data': {
      name: 'Write Data',
      description: 'Ability to write to plugin data storage',
      icon: '&#9998;',
      risk: 'low'
    },
    'read:messages': {
      name: 'Read Messages',
      description: 'Access to read incoming chat messages',
      icon: '&#128172;',
      risk: 'medium'
    },
    'send:messages': {
      name: 'Send Messages',
      description: 'Ability to send messages on behalf of your bot',
      icon: '&#128232;',
      risk: 'medium'
    },
    'network:outbound': {
      name: 'Network Access',
      description: 'Make HTTP requests to external services',
      icon: '&#127760;',
      risk: 'medium'
    },
    'network:inbound': {
      name: 'Receive Webhooks',
      description: 'Accept incoming webhook requests',
      icon: '&#128229;',
      risk: 'high'
    },
    'storage:local': {
      name: 'Local Storage',
      description: 'Use local file storage',
      icon: '&#128190;',
      risk: 'medium'
    },
    'storage:database': {
      name: 'Database Access',
      description: 'Direct access to database',
      icon: '&#128451;',
      risk: 'high'
    },
    'agent:execute': {
      name: 'Execute Agents',
      description: 'Run AI agent actions',
      icon: '&#129302;',
      risk: 'high'
    },
    'flow:read': {
      name: 'Read Flows',
      description: 'Access to read conversation flows',
      icon: '&#128194;',
      risk: 'low'
    },
    'flow:modify': {
      name: 'Modify Flows',
      description: 'Ability to modify conversation flows',
      icon: '&#128221;',
      risk: 'high'
    },
    'user:read': {
      name: 'Read Users',
      description: 'Access to read user information',
      icon: '&#128100;',
      risk: 'medium'
    },
    'user:write': {
      name: 'Modify Users',
      description: 'Ability to modify user information',
      icon: '&#128101;',
      risk: 'high'
    },
    'analytics:read': {
      name: 'Read Analytics',
      description: 'Access to read analytics data',
      icon: '&#128200;',
      risk: 'low'
    },
    'analytics:write': {
      name: 'Write Analytics',
      description: 'Ability to write analytics events',
      icon: '&#128202;',
      risk: 'low'
    },
    'admin:settings': {
      name: 'Admin Settings',
      description: 'Access to administrative settings',
      icon: '&#128272;',
      risk: 'critical'
    }
  };

  const getRiskColor = (risk) => {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#7c3aed'
    };
    return colors[risk] || '#6b7280';
  };

  const getRiskBg = (risk) => {
    const colors = {
      low: '#d1fae5',
      medium: '#fef3c7',
      high: '#fee2e2',
      critical: '#ede9fe'
    };
    return colors[risk] || '#f3f4f6';
  };

  const getPermissionInfo = (perm) => {
    return permissionDetails[perm] || {
      name: perm,
      description: 'Custom permission',
      icon: '&#128274;',
      risk: 'medium'
    };
  };

  const isGranted = (perm) => granted.includes(perm);

  const handleToggle = (perm) => {
    if (!editable) return;

    if (isGranted(perm)) {
      onRevoke && onRevoke(perm);
    } else {
      onGrant && onGrant(perm);
    }
  };

  const highRiskPermissions = permissions.filter(
    p => ['high', 'critical'].includes(getPermissionInfo(p).risk)
  );

  const displayPermissions = expanded ? permissions : permissions.slice(0, 5);

  return (
    <div className={`plugin-permissions ${className}`}>
      {highRiskPermissions.length > 0 && (
        <div className="risk-warning">
          <span className="warning-icon">&#9888;</span>
          <span>
            This plugin requires {highRiskPermissions.length} high-risk permission(s).
            Review carefully before granting access.
          </span>
        </div>
      )}

      <div className="permissions-list">
        {displayPermissions.map((perm) => {
          const info = getPermissionInfo(perm);
          const granted = isGranted(perm);

          return (
            <div
              key={perm}
              className={`permission-item ${granted ? 'granted' : ''} ${editable ? 'editable' : ''}`}
              onClick={() => handleToggle(perm)}
            >
              <div className="permission-icon">
                <span dangerouslySetInnerHTML={{ __html: info.icon }} />
              </div>

              <div className="permission-content">
                <div className="permission-header">
                  <span className="permission-name">{info.name}</span>
                  <span
                    className="permission-risk"
                    style={{
                      color: getRiskColor(info.risk),
                      background: getRiskBg(info.risk)
                    }}
                  >
                    {info.risk}
                  </span>
                </div>

                {showDescriptions && (
                  <p className="permission-description">{info.description}</p>
                )}
              </div>

              {editable && (
                <div className="permission-toggle">
                  <div className={`toggle-switch ${granted ? 'on' : 'off'}`}>
                    <div className="toggle-slider" />
                  </div>
                </div>
              )}

              {!editable && granted && (
                <span className="granted-badge">&#10003;</span>
              )}
            </div>
          );
        })}
      </div>

      {permissions.length > 5 && (
        <button
          className="toggle-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : `Show ${permissions.length - 5} More`}
        </button>
      )}

      <style>{`
        .plugin-permissions {
          width: 100%;
        }

        .risk-warning {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fef3c7;
          border-radius: 8px;
          margin-bottom: 16px;
          color: #92400e;
          font-size: 14px;
        }

        .warning-icon {
          font-size: 20px;
        }

        .permissions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .permission-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #f9fafb;
          border-radius: 10px;
          transition: all 0.2s;
        }

        .permission-item.editable {
          cursor: pointer;
        }

        .permission-item.editable:hover {
          background: #f3f4f6;
        }

        .permission-item.granted {
          background: #f0fdf4;
          border: 1px solid #86efac;
        }

        .permission-icon {
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .permission-content {
          flex: 1;
        }

        .permission-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }

        .permission-name {
          font-weight: 600;
          color: #1a1a2e;
        }

        .permission-risk {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .permission-description {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .permission-toggle {
          flex-shrink: 0;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          background: #d1d5db;
          border-radius: 12px;
          position: relative;
          transition: background 0.3s;
        }

        .toggle-switch.on {
          background: #10b981;
        }

        .toggle-slider {
          position: absolute;
          width: 18px;
          height: 18px;
          background: white;
          border-radius: 50%;
          top: 3px;
          left: 3px;
          transition: transform 0.3s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .toggle-switch.on .toggle-slider {
          transform: translateX(20px);
        }

        .granted-badge {
          width: 24px;
          height: 24px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .toggle-expand {
          width: 100%;
          padding: 12px;
          margin-top: 8px;
          background: transparent;
          border: 1px dashed #d1d5db;
          border-radius: 8px;
          color: #6b7280;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-expand:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }
      `}</style>
    </div>
  );
};

export default PluginPermissions;
