/**
 * Customer Ticket View Page
 * View and interact with a specific ticket
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PortalHeader from '../../../components/tickets/portal/PortalHeader';
import PortalConversation from '../../../components/tickets/portal/PortalConversation';
import PortalReplyBox from '../../../components/tickets/portal/PortalReplyBox';
import PortalStatusBadge from '../../../components/tickets/portal/PortalStatusBadge';
import PortalSatisfactionWidget from '../../../components/tickets/portal/PortalSatisfactionWidget';

const CustomerTicketViewPage = () => {
  const { workspaceSlug, ticketId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [portalConfig, setPortalConfig] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);

  // Get access token
  const getAccessToken = () => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem(`portal_token_${workspaceSlug}`, tokenFromUrl);
      return tokenFromUrl;
    }
    return localStorage.getItem(`portal_token_${workspaceSlug}`);
  };

  // Load ticket data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load portal config
        const configResponse = await fetch(`/api/public/tickets/portal/${workspaceSlug}/config`);
        if (!configResponse.ok) {
          throw new Error('Portal not found');
        }
        const configData = await configResponse.json();
        setPortalConfig(configData);

        // Load ticket
        const token = getAccessToken();
        if (!token) {
          throw new Error('Please verify your email to view this ticket');
        }

        const ticketResponse = await fetch(`/api/public/tickets/portal/${ticketId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!ticketResponse.ok) {
          if (ticketResponse.status === 401) {
            throw new Error('Session expired. Please verify your email again.');
          }
          throw new Error('Ticket not found or access denied');
        }

        const ticketData = await ticketResponse.json();
        setTicket(ticketData.ticket);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workspaceSlug, ticketId, searchParams]);

  // Submit reply
  const handleSubmitReply = async (content, attachments) => {
    try {
      setSubmittingReply(true);
      const token = getAccessToken();

      const response = await fetch(`/api/public/tickets/portal/${ticketId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ body: content, attachments }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }

      const data = await response.json();

      // Add new comment to ticket
      setTicket((prev) => ({
        ...prev,
        comments: [...(prev.comments || []), data.comment],
      }));

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSubmittingReply(false);
    }
  };

  // Close ticket
  const handleCloseTicket = async () => {
    if (!window.confirm('Are you sure you want to close this ticket?')) {
      return;
    }

    try {
      setClosingTicket(true);
      const token = getAccessToken();

      const response = await fetch(`/api/public/tickets/portal/${ticketId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to close ticket');
      }

      setTicket((prev) => ({ ...prev, status: 'closed' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setClosingTicket(false);
    }
  };

  // Submit satisfaction rating
  const handleSubmitSatisfaction = async (rating, feedback) => {
    try {
      const token = getAccessToken();

      const response = await fetch(`/api/public/tickets/portal/${ticketId}/satisfaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ rating, feedback }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      setTicket((prev) => ({
        ...prev,
        satisfaction: { rating, feedback, submittedAt: new Date().toISOString() },
      }));

      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  // Navigate back
  const handleBackToTickets = () => {
    navigate(`/support/${workspaceSlug}/lookup`);
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Loading ticket...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <PortalHeader config={portalConfig} />
        <main style={styles.main}>
          <div style={styles.content}>
            <div style={styles.errorContainer}>
              <div style={styles.errorIcon}>!</div>
              <h2 style={styles.errorTitle}>Unable to Load Ticket</h2>
              <p style={styles.errorText}>{error}</p>
              <button style={styles.primaryButton} onClick={handleBackToTickets}>
                Go to My Tickets
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isResolved = ticket?.status === 'resolved' || ticket?.status === 'closed';
  const canReply = ticket?.status !== 'closed';

  return (
    <div style={styles.container}>
      <PortalHeader config={portalConfig} />

      <main style={styles.main}>
        <div style={styles.content}>
          {/* Back Button */}
          <button style={styles.backButton} onClick={handleBackToTickets}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to My Tickets
          </button>

          {/* Ticket Header */}
          <div style={styles.ticketHeader}>
            <div style={styles.ticketMeta}>
              <span style={styles.ticketNumber}>#{ticket?.number}</span>
              <PortalStatusBadge status={ticket?.status} />
            </div>
            <h1 style={styles.ticketSubject}>{ticket?.subject}</h1>
            <p style={styles.ticketDate}>
              Created {new Date(ticket?.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Satisfaction Widget (for resolved tickets) */}
          {isResolved && !ticket?.satisfaction && (
            <PortalSatisfactionWidget
              onSubmit={handleSubmitSatisfaction}
            />
          )}

          {/* Already Rated Message */}
          {ticket?.satisfaction && (
            <div style={styles.ratedMessage}>
              <span style={styles.ratedStars}>
                {'★'.repeat(ticket.satisfaction.rating)}{'☆'.repeat(5 - ticket.satisfaction.rating)}
              </span>
              <span style={styles.ratedText}>
                Thank you for your feedback!
              </span>
            </div>
          )}

          {/* Conversation */}
          <div style={styles.conversationContainer}>
            <h2 style={styles.sectionTitle}>Conversation</h2>
            <PortalConversation
              ticket={ticket}
              comments={ticket?.comments || []}
            />
          </div>

          {/* Reply Box */}
          {canReply ? (
            <div style={styles.replyContainer}>
              <PortalReplyBox
                onSubmit={handleSubmitReply}
                loading={submittingReply}
                placeholder="Type your reply..."
              />
            </div>
          ) : (
            <div style={styles.closedMessage}>
              <p>This ticket is closed. If you need further assistance, please create a new ticket.</p>
            </div>
          )}

          {/* Actions */}
          {canReply && ticket?.status !== 'closed' && (
            <div style={styles.actions}>
              <button
                style={styles.closeButton}
                onClick={handleCloseTicket}
                disabled={closingTicket}
              >
                {closingTicket ? 'Closing...' : 'Close Ticket'}
              </button>
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
  },
  ticketHeader: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px',
  },
  ticketMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  ticketNumber: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280',
  },
  ticketSubject: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
    marginTop: 0,
  },
  ticketDate: {
    fontSize: '14px',
    color: '#9ca3af',
    margin: 0,
  },
  ratedMessage: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    textAlign: 'center',
  },
  ratedStars: {
    fontSize: '24px',
    color: '#f59e0b',
    display: 'block',
    marginBottom: '8px',
  },
  ratedText: {
    color: '#166534',
    fontSize: '14px',
  },
  conversationContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
    marginTop: 0,
  },
  replyContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px',
  },
  closedMessage: {
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center',
    marginBottom: '24px',
    color: '#6b7280',
    fontSize: '14px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '24px',
  },
  closeButton: {
    padding: '10px 20px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  errorContainer: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '48px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center',
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
    margin: '0 auto 16px',
  },
  errorTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '8px',
  },
  errorText: {
    color: '#6b7280',
    marginBottom: '24px',
  },
  primaryButton: {
    padding: '12px 24px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
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

export default CustomerTicketViewPage;
