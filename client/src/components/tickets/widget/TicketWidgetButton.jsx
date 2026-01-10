/**
 * Ticket Widget Button Component
 * Floating action button to open the widget
 */

import React, { useState } from 'react';

const TicketWidgetButton = ({
  onClick,
  primaryColor = '#7c3aed',
  text = 'Support',
  showIcon = true,
  unreadCount = 0,
  size = 'medium',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          button: { padding: '10px 16px', fontSize: '13px' },
          icon: 18,
          iconOnly: { width: '44px', height: '44px' },
        };
      case 'large':
        return {
          button: { padding: '16px 24px', fontSize: '16px' },
          icon: 24,
          iconOnly: { width: '64px', height: '64px' },
        };
      default:
        return {
          button: { padding: '14px 20px', fontSize: '14px' },
          icon: 20,
          iconOnly: { width: '56px', height: '56px' },
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const iconOnly = !text;

  return (
    <button
      style={{
        ...styles.button,
        ...sizeStyles.button,
        ...(iconOnly && sizeStyles.iconOnly),
        ...(iconOnly && styles.iconOnlyButton),
        backgroundColor: primaryColor,
        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isHovered
          ? '0 8px 25px rgba(0,0,0,0.25)'
          : '0 4px 15px rgba(0,0,0,0.2)',
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="Open support widget"
    >
      {/* Unread Badge */}
      {unreadCount > 0 && (
        <span style={styles.badge}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}

      {/* Icon */}
      {showIcon && (
        <svg
          width={sizeStyles.icon}
          height={sizeStyles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      )}

      {/* Text */}
      {text && <span style={styles.text}>{text}</span>}
    </button>
  );
};

const styles = {
  button: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: '#fff',
    border: 'none',
    borderRadius: '28px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  iconOnlyButton: {
    padding: 0,
    borderRadius: '50%',
  },
  text: {
    whiteSpace: 'nowrap',
  },
  badge: {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    backgroundColor: '#ef4444',
    color: '#fff',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
};

export default TicketWidgetButton;
