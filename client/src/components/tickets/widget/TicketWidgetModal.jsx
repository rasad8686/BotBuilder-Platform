/**
 * Ticket Widget Modal Component
 * Modal container for the widget form
 */

import React, { useState, useEffect } from 'react';
import WidgetTicketForm from './WidgetTicketForm';

const TicketWidgetModal = ({
  workspaceId,
  apiEndpoint,
  config,
  onClose,
  onMinimize,
  onTicketSubmit,
  position,
}) => {
  const [view, setView] = useState('form'); // 'form' | 'success' | 'lookup'
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [animating, setAnimating] = useState(true);

  useEffect(() => {
    // Entrance animation
    const timer = setTimeout(() => setAnimating(false), 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle ticket submission
  const handleSubmit = async (formData) => {
    try {
      const response = await fetch(`${apiEndpoint}/widget/${workspaceId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit ticket');
      }

      const data = await response.json();
      setSubmittedTicket(data.ticket);
      setView('success');
      onTicketSubmit?.(data.ticket);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Handle new ticket
  const handleNewTicket = () => {
    setSubmittedTicket(null);
    setView('form');
  };

  // Get animation styles based on position
  const getAnimationStyles = () => {
    const isTop = position?.startsWith('top');
    return {
      opacity: animating ? 0 : 1,
      transform: animating
        ? `translateY(${isTop ? '-20px' : '20px'})`
        : 'translateY(0)',
    };
  };

  const primaryColor = config?.primaryColor || '#7c3aed';

  return (
    <div
      style={{
        ...styles.modal,
        ...getAnimationStyles(),
      }}
    >
      {/* Header */}
      <div
        style={{
          ...styles.header,
          backgroundColor: primaryColor,
        }}
      >
        <div style={styles.headerContent}>
          {config?.logo ? (
            <img src={config.logo} alt="" style={styles.logo} />
          ) : (
            <div style={styles.defaultLogo}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          )}
          <div style={styles.headerText}>
            <h3 style={styles.headerTitle}>{config?.name || 'Support'}</h3>
            <p style={styles.headerSubtitle}>
              {view === 'form' && 'How can we help?'}
              {view === 'success' && 'Ticket submitted!'}
              {view === 'lookup' && 'Track your tickets'}
            </p>
          </div>
        </div>

        <div style={styles.headerActions}>
          <button
            style={styles.headerButton}
            onClick={onMinimize}
            title="Minimize"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            style={styles.headerButton}
            onClick={onClose}
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {view === 'form' && (
          <WidgetTicketForm
            config={config}
            onSubmit={handleSubmit}
            primaryColor={primaryColor}
          />
        )}

        {view === 'success' && (
          <div style={styles.successView}>
            <div style={styles.successIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h4 style={styles.successTitle}>Thank you!</h4>
            <p style={styles.successText}>
              Your ticket #{submittedTicket?.number} has been submitted. We'll get back to you soon.
            </p>
            <div style={styles.successActions}>
              <button
                style={{
                  ...styles.successButton,
                  backgroundColor: primaryColor,
                }}
                onClick={handleNewTicket}
              >
                Submit Another Ticket
              </button>
              <button
                style={styles.closeButton}
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <span style={styles.footerText}>
          Powered by{' '}
          <a href="https://botbuilder.app" target="_blank" rel="noopener noreferrer" style={styles.footerLink}>
            BotBuilder
          </a>
        </span>
      </div>
    </div>
  );
};

const styles = {
  modal: {
    width: '380px',
    maxWidth: 'calc(100vw - 40px)',
    maxHeight: 'calc(100vh - 100px)',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: 'opacity 0.2s, transform 0.2s',
  },
  header: {
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#fff',
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    width: '36px',
    height: '36px',
    objectFit: 'contain',
    borderRadius: '8px',
  },
  defaultLogo: {
    width: '36px',
    height: '36px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '12px',
    opacity: 0.9,
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '4px',
  },
  headerButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  successView: {
    textAlign: 'center',
    padding: '20px 0',
  },
  successIcon: {
    width: '64px',
    height: '64px',
    backgroundColor: '#ecfdf5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#10b981',
    margin: '0 auto 16px',
  },
  successTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  successText: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
    lineHeight: 1.5,
  },
  successActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  successButton: {
    padding: '12px 20px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  closeButton: {
    padding: '12px 20px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  footerLink: {
    color: '#7c3aed',
    textDecoration: 'none',
    fontWeight: '500',
  },
};

export default TicketWidgetModal;
