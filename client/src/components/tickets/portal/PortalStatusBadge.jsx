/**
 * Portal Status Badge Component
 * Status indicator for tickets
 */

import React from 'react';

const PortalStatusBadge = ({ status, size = 'medium' }) => {
  const getStatusConfig = (status) => {
    const configs = {
      open: {
        label: 'Open',
        color: '#3b82f6',
        backgroundColor: '#eff6ff',
        borderColor: '#bfdbfe',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
        ),
      },
      pending: {
        label: 'Pending',
        color: '#f59e0b',
        backgroundColor: '#fffbeb',
        borderColor: '#fde68a',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      'in-progress': {
        label: 'In Progress',
        color: '#8b5cf6',
        backgroundColor: '#f5f3ff',
        borderColor: '#c4b5fd',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        ),
      },
      resolved: {
        label: 'Resolved',
        color: '#10b981',
        backgroundColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        ),
      },
      closed: {
        label: 'Closed',
        color: '#6b7280',
        backgroundColor: '#f9fafb',
        borderColor: '#e5e7eb',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        ),
      },
      'waiting-customer': {
        label: 'Waiting for Reply',
        color: '#ec4899',
        backgroundColor: '#fdf2f8',
        borderColor: '#fbcfe8',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
    };

    return configs[status] || configs.open;
  };

  const config = getStatusConfig(status);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          padding: '2px 8px',
          fontSize: '10px',
          gap: '4px',
          iconSize: 10,
        };
      case 'large':
        return {
          padding: '6px 14px',
          fontSize: '14px',
          gap: '8px',
          iconSize: 16,
        };
      default:
        return {
          padding: '4px 10px',
          fontSize: '12px',
          gap: '6px',
          iconSize: 12,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <span
      style={{
        ...styles.badge,
        padding: sizeStyles.padding,
        fontSize: sizeStyles.fontSize,
        gap: sizeStyles.gap,
        color: config.color,
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
      }}
    >
      {config.icon}
      {config.label}
    </span>
  );
};

const styles = {
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: '500',
    borderRadius: '9999px',
    border: '1px solid',
    whiteSpace: 'nowrap',
  },
};

export default PortalStatusBadge;
