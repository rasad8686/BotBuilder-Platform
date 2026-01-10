/**
 * Customer Ticket Submit Page
 * Ticket submission form for customers
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PortalHeader from '../../../components/tickets/portal/PortalHeader';
import PortalTicketForm from '../../../components/tickets/portal/PortalTicketForm';
import PortalSuccessMessage from '../../../components/tickets/portal/PortalSuccessMessage';

const CustomerTicketSubmitPage = () => {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();

  const [portalConfig, setPortalConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdTicket, setCreatedTicket] = useState(null);

  // Load portal configuration
  useEffect(() => {
    const loadPortalConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/public/tickets/portal/${workspaceSlug}/config`);

        if (!response.ok) {
          throw new Error('Portal not found');
        }

        const data = await response.json();
        setPortalConfig(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPortalConfig();
  }, [workspaceSlug]);

  // Handle ticket submission
  const handleSubmit = async (formData) => {
    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`/api/public/tickets/portal/${workspaceSlug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit ticket');
      }

      const data = await response.json();
      setCreatedTicket(data.ticket);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Navigate back to portal
  const handleBackToPortal = () => {
    navigate(`/support/${workspaceSlug}`);
  };

  // View created ticket
  const handleViewTicket = () => {
    if (createdTicket?.id) {
      navigate(`/support/${workspaceSlug}/tickets/${createdTicket.id}`);
    }
  };

  // Submit another ticket
  const handleSubmitAnother = () => {
    setSubmitted(false);
    setCreatedTicket(null);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  if (error && !portalConfig) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>!</div>
        <h2 style={styles.errorTitle}>Portal Not Found</h2>
        <p style={styles.errorText}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <PortalHeader config={portalConfig} />

      <main style={styles.main}>
        <div style={styles.content}>
          {/* Back Button */}
          <button style={styles.backButton} onClick={handleBackToPortal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Support Center
          </button>

          {submitted ? (
            <PortalSuccessMessage
              ticket={createdTicket}
              onViewTicket={handleViewTicket}
              onSubmitAnother={handleSubmitAnother}
            />
          ) : (
            <div style={styles.formContainer}>
              <div style={styles.formHeader}>
                <h1 style={styles.formTitle}>Submit a Support Ticket</h1>
                <p style={styles.formSubtitle}>
                  Fill out the form below and we'll get back to you as soon as possible.
                </p>
              </div>

              {error && (
                <div style={styles.errorAlert}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <PortalTicketForm
                config={portalConfig}
                onSubmit={handleSubmit}
                loading={submitting}
              />
            </div>
          )}
        </div>
      </main>

      <footer style={styles.footer}>
        <p style={styles.footerText}>
          Powered by <a href="https://botbuilder.app" style={styles.footerLink}>BotBuilder</a>
        </p>
      </footer>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#7c3aed',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#6b7280',
    fontSize: '14px',
  },
  errorContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    padding: '24px',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    backgroundColor: '#fef2f2',
    color: '#ef4444',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  errorTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  errorText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  main: {
    flex: 1,
    padding: '24px',
  },
  content: {
    maxWidth: '640px',
    margin: '0 auto',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '24px',
    transition: 'color 0.2s',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  formHeader: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  formTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  formSubtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '24px',
  },
  footer: {
    padding: '24px',
    textAlign: 'center',
    borderTop: '1px solid #e5e7eb',
  },
  footerText: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },
  footerLink: {
    color: '#7c3aed',
    textDecoration: 'none',
  },
};

export default CustomerTicketSubmitPage;
