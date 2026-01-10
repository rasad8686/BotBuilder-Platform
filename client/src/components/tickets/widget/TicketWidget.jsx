/**
 * Ticket Widget Component
 * Main embeddable ticket widget container
 */

import React, { useState, useEffect } from 'react';
import TicketWidgetButton from './TicketWidgetButton';
import TicketWidgetModal from './TicketWidgetModal';

const TicketWidget = ({
  workspaceId,
  apiEndpoint = '/api/public/tickets',
  position = 'bottom-right',
  primaryColor = '#7c3aed',
  buttonText = 'Support',
  showIcon = true,
  defaultOpen = false,
  onOpen,
  onClose,
  onTicketSubmit,
  customStyles = {},
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [portalConfig, setPortalConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load portal configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`${apiEndpoint}/widget/${workspaceId}/config`);
        if (response.ok) {
          const data = await response.json();
          setPortalConfig(data);
        }
      } catch (err) {
        console.error('Failed to load widget config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [workspaceId, apiEndpoint]);

  // Handle open
  const handleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    onOpen?.();
  };

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    onClose?.();
  };

  // Handle minimize
  const handleMinimize = () => {
    setIsMinimized(true);
  };

  // Handle restore from minimized
  const handleRestore = () => {
    setIsMinimized(false);
  };

  // Handle ticket submission
  const handleTicketSubmit = (ticket) => {
    onTicketSubmit?.(ticket);
  };

  // Get position styles
  const getPositionStyles = () => {
    const positions = {
      'bottom-right': { bottom: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'top-right': { top: '20px', right: '20px' },
      'top-left': { top: '20px', left: '20px' },
    };
    return positions[position] || positions['bottom-right'];
  };

  const positionStyles = getPositionStyles();

  // Merge custom styles
  const mergedConfig = {
    ...portalConfig,
    primaryColor: primaryColor,
    ...customStyles,
  };

  if (loading) {
    return null;
  }

  return (
    <div
      style={{
        ...styles.container,
        ...positionStyles,
      }}
      data-ticket-widget
    >
      {/* Widget Modal */}
      {isOpen && !isMinimized && (
        <TicketWidgetModal
          workspaceId={workspaceId}
          apiEndpoint={apiEndpoint}
          config={mergedConfig}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onTicketSubmit={handleTicketSubmit}
          position={position}
        />
      )}

      {/* Minimized Bar */}
      {isOpen && isMinimized && (
        <div
          style={{
            ...styles.minimizedBar,
            backgroundColor: primaryColor,
          }}
          onClick={handleRestore}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={styles.minimizedText}>Continue with support</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      )}

      {/* Widget Button */}
      {!isOpen && (
        <TicketWidgetButton
          onClick={handleOpen}
          primaryColor={primaryColor}
          text={buttonText}
          showIcon={showIcon}
          unreadCount={unreadCount}
        />
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    zIndex: 999999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  minimizedBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderRadius: '24px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'transform 0.2s',
  },
  minimizedText: {
    fontSize: '14px',
    fontWeight: '500',
  },
};

export default TicketWidget;
