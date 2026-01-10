/**
 * Customer Portal Page
 * Public-facing ticket support portal
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PortalHeader from '../../../components/tickets/portal/PortalHeader';
import PortalTicketList from '../../../components/tickets/portal/PortalTicketList';
import EmailVerificationForm from '../../../components/tickets/portal/EmailVerificationForm';

const CustomerPortalPage = () => {
  const { workspaceSlug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('submit');
  const [portalConfig, setPortalConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [tickets, setTickets] = useState([]);

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

        // Check for existing session
        const token = localStorage.getItem(`portal_token_${workspaceSlug}`);
        if (token) {
          await verifySession(token);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadPortalConfig();
  }, [workspaceSlug]);

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
    setActiveTab('tickets');
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem(`portal_token_${workspaceSlug}`);
    setIsAuthenticated(false);
    setCustomerEmail('');
    setTickets([]);
    setActiveTab('submit');
  };

  // Navigate to submit page
  const handleSubmitTicket = () => {
    navigate(`/support/${workspaceSlug}/submit`);
  };

  // Navigate to ticket view
  const handleViewTicket = (ticketId) => {
    navigate(`/support/${workspaceSlug}/tickets/${ticketId}`);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading support portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>!</div>
        <h2 style={styles.errorTitle}>Portal Not Found</h2>
        <p style={styles.errorText}>
          The support portal you're looking for doesn't exist or is not available.
        </p>
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
          {/* Welcome Section */}
          <div style={styles.welcomeSection}>
            <h1 style={styles.welcomeTitle}>
              {portalConfig?.welcomeMessage || 'How can we help you?'}
            </h1>
            <p style={styles.welcomeSubtitle}>
              Submit a ticket or check the status of your existing requests.
            </p>
          </div>

          {/* Action Cards */}
          <div style={styles.actionCards}>
            <div
              style={styles.actionCard}
              onClick={handleSubmitTicket}
              role="button"
              tabIndex={0}
            >
              <div style={styles.actionIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3 style={styles.actionTitle}>Submit a Ticket</h3>
              <p style={styles.actionDescription}>
                Create a new support request and we'll get back to you shortly.
              </p>
            </div>

            <div
              style={styles.actionCard}
              onClick={() => setActiveTab('tickets')}
              role="button"
              tabIndex={0}
            >
              <div style={styles.actionIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 style={styles.actionTitle}>Check Ticket Status</h3>
              <p style={styles.actionDescription}>
                View and track your existing support tickets.
              </p>
            </div>
          </div>

          {/* Tickets Section */}
          {activeTab === 'tickets' && (
            <div style={styles.ticketsSection}>
              <h2 style={styles.sectionTitle}>My Tickets</h2>

              {!isAuthenticated ? (
                <div style={styles.authContainer}>
                  <p style={styles.authText}>
                    Enter your email to view your tickets
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
                  onRefresh={() => verifySession(localStorage.getItem(`portal_token_${workspaceSlug}`))}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
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
    maxWidth: '400px',
  },
  main: {
    flex: 1,
    padding: '24px',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  welcomeSection: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  welcomeTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  welcomeSubtitle: {
    fontSize: '16px',
    color: '#6b7280',
  },
  actionCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '32px',
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid #e5e7eb',
    textAlign: 'center',
  },
  actionIcon: {
    width: '64px',
    height: '64px',
    backgroundColor: '#f3f4f6',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
    color: '#7c3aed',
  },
  actionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  actionDescription: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  ticketsSection: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
    marginTop: 0,
  },
  authContainer: {
    textAlign: 'center',
    padding: '24px',
  },
  authText: {
    color: '#6b7280',
    marginBottom: '16px',
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

export default CustomerPortalPage;
