/**
 * Customer Ticket Lookup Page
 * Email verification to view tickets
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PortalHeader from '../../../components/tickets/portal/PortalHeader';
import EmailVerificationForm from '../../../components/tickets/portal/EmailVerificationForm';
import PortalTicketList from '../../../components/tickets/portal/PortalTicketList';

const CustomerTicketLookupPage = () => {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [portalConfig, setPortalConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [tickets, setTickets] = useState([]);

  // Load portal configuration and check magic link
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

        // Check for magic link token
        const token = searchParams.get('token');
        if (token) {
          await verifyMagicLink(token);
        } else {
          // Check for existing session
          const savedToken = localStorage.getItem(`portal_token_${workspaceSlug}`);
          if (savedToken) {
            await verifySession(savedToken);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPortalConfig();
  }, [workspaceSlug, searchParams]);

  // Verify magic link token
  const verifyMagicLink = async (token) => {
    try {
      const response = await fetch(`/api/public/tickets/auth/magic-link?token=${token}`);

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem(`portal_token_${workspaceSlug}`, data.accessToken);
        setIsAuthenticated(true);
        setCustomerEmail(data.email);
        setTickets(data.tickets || []);
      } else {
        setError('Invalid or expired link. Please request a new one.');
      }
    } catch (err) {
      setError('Failed to verify link.');
    }
  };

  // Verify existing session
  const verifySession = async (token) => {
    try {
      const response = await fetch('/api/public/tickets/portal/my-tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setCustomerEmail(data.email);
        setTickets(data.tickets || []);
      } else {
        localStorage.removeItem(`portal_token_${workspaceSlug}`);
      }
    } catch (err) {
      localStorage.removeItem(`portal_token_${workspaceSlug}`);
    }
  };

  // Handle successful authentication
  const handleAuthSuccess = (data) => {
    localStorage.setItem(`portal_token_${workspaceSlug}`, data.accessToken);
    setIsAuthenticated(true);
    setCustomerEmail(data.email);
    setTickets(data.tickets || []);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem(`portal_token_${workspaceSlug}`);
    setIsAuthenticated(false);
    setCustomerEmail('');
    setTickets([]);
  };

  // Navigate to ticket view
  const handleViewTicket = (ticketId) => {
    navigate(`/support/${workspaceSlug}/tickets/${ticketId}`);
  };

  // Navigate back to portal
  const handleBackToPortal = () => {
    navigate(`/support/${workspaceSlug}`);
  };

  // Refresh tickets
  const handleRefresh = () => {
    const token = localStorage.getItem(`portal_token_${workspaceSlug}`);
    if (token) {
      verifySession(token);
    }
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
      <PortalHeader
        config={portalConfig}
        isAuthenticated={isAuthenticated}
        customerEmail={customerEmail}
        onLogout={handleLogout}
      />

      <main style={styles.main}>
        <div style={styles.content}>
          {/* Back Button */}
          <button style={styles.backButton} onClick={handleBackToPortal}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Support Center
          </button>

          <div style={styles.lookupContainer}>
            <div style={styles.header}>
              <h1 style={styles.title}>My Support Tickets</h1>
              <p style={styles.subtitle}>
                {isAuthenticated
                  ? `Viewing tickets for ${customerEmail}`
                  : 'Enter your email to view your tickets'}
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

            {!isAuthenticated ? (
              <div style={styles.authSection}>
                <div style={styles.authIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p style={styles.authText}>
                  We'll send a verification code to your email address.
                </p>
                <EmailVerificationForm
                  workspaceId={portalConfig?.workspaceId}
                  onSuccess={handleAuthSuccess}
                />
              </div>
            ) : (
              <PortalTicketList
                tickets={tickets}
                onViewTicket={handleViewTicket}
                onRefresh={handleRefresh}
              />
            )}
          </div>
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
    maxWidth: '800px',
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
  lookupContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  subtitle: {
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
  authSection: {
    textAlign: 'center',
  },
  authIcon: {
    width: '80px',
    height: '80px',
    backgroundColor: '#f3f4f6',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    color: '#7c3aed',
  },
  authText: {
    color: '#6b7280',
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

export default CustomerTicketLookupPage;
