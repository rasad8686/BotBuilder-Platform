/**
 * Customer Satisfaction Page
 * Standalone page for rating tickets (linked from email)
 */

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PortalHeader from '../../../components/tickets/portal/PortalHeader';

const CustomerSatisfactionPage = () => {
  const { workspaceSlug, ticketId } = useParams();
  const [searchParams] = useSearchParams();

  const [portalConfig, setPortalConfig] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emojis = [
    { value: 1, emoji: '', label: 'Very Dissatisfied' },
    { value: 2, emoji: '', label: 'Dissatisfied' },
    { value: 3, emoji: '', label: 'Neutral' },
    { value: 4, emoji: '', label: 'Satisfied' },
    { value: 5, emoji: '', label: 'Very Satisfied' },
  ];

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load portal config
        const configResponse = await fetch(`/api/public/tickets/portal/${workspaceSlug}/config`);
        if (configResponse.ok) {
          const configData = await configResponse.json();
          setPortalConfig(configData);
        }

        // Load ticket basic info
        const token = searchParams.get('token');
        if (token) {
          const ticketResponse = await fetch(`/api/public/tickets/portal/${ticketId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (ticketResponse.ok) {
            const ticketData = await ticketResponse.json();
            setTicket(ticketData.ticket);

            // Check if already rated
            if (ticketData.ticket?.satisfaction) {
              setSubmitted(true);
              setRating(ticketData.ticket.satisfaction.rating);
            }
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [workspaceSlug, ticketId, searchParams]);

  // Submit rating
  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const token = searchParams.get('token');
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

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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

  return (
    <div style={styles.container}>
      <PortalHeader config={portalConfig} />

      <main style={styles.main}>
        <div style={styles.content}>
          {submitted ? (
            <div style={styles.successContainer}>
              <div style={styles.successIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h1 style={styles.successTitle}>Thank You!</h1>
              <p style={styles.successText}>
                Your feedback helps us improve our support.
              </p>
              <div style={styles.ratingDisplay}>
                {emojis.map((e) => (
                  <span
                    key={e.value}
                    style={{
                      ...styles.emojiDisplay,
                      opacity: e.value === rating ? 1 : 0.3,
                      transform: e.value === rating ? 'scale(1.5)' : 'scale(1)',
                    }}
                  >
                    {e.emoji}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div style={styles.ratingContainer}>
              <div style={styles.header}>
                <h1 style={styles.title}>How was your experience?</h1>
                {ticket && (
                  <p style={styles.ticketInfo}>
                    Regarding: <strong>#{ticket.number}</strong> - {ticket.subject}
                  </p>
                )}
              </div>

              {error && (
                <div style={styles.errorAlert}>
                  {error}
                </div>
              )}

              {/* Emoji Rating */}
              <div style={styles.emojiRating}>
                {emojis.map((e) => (
                  <button
                    key={e.value}
                    style={{
                      ...styles.emojiButton,
                      ...(rating === e.value && styles.emojiButtonSelected),
                      ...(hoveredRating === e.value && styles.emojiButtonHovered),
                    }}
                    onClick={() => setRating(e.value)}
                    onMouseEnter={() => setHoveredRating(e.value)}
                    onMouseLeave={() => setHoveredRating(0)}
                    title={e.label}
                  >
                    <span style={styles.emoji}>{e.emoji}</span>
                    <span style={styles.emojiLabel}>{e.label}</span>
                  </button>
                ))}
              </div>

              {/* Star Rating Alternative */}
              <div style={styles.starRating}>
                <p style={styles.orText}>or rate with stars</p>
                <div style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      style={styles.starButton}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                    >
                      <span
                        style={{
                          ...styles.star,
                          color: star <= (hoveredRating || rating) ? '#f59e0b' : '#d1d5db',
                        }}
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Textarea */}
              <div style={styles.feedbackSection}>
                <label style={styles.feedbackLabel}>
                  Additional feedback (optional)
                </label>
                <textarea
                  style={styles.feedbackTextarea}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Tell us more about your experience..."
                  rows={4}
                  maxLength={1000}
                />
                <span style={styles.charCount}>{feedback.length}/1000</span>
              </div>

              {/* Submit Button */}
              <button
                style={{
                  ...styles.submitButton,
                  ...(submitting && styles.submitButtonDisabled),
                }}
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    maxWidth: '500px',
    width: '100%',
  },
  ratingContainer: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '12px',
  },
  ticketInfo: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  errorAlert: {
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px',
    marginBottom: '24px',
  },
  emojiRating: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
    marginBottom: '24px',
  },
  emojiButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: '#f9fafb',
    border: '2px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: '80px',
  },
  emojiButtonSelected: {
    backgroundColor: '#f3e8ff',
    borderColor: '#7c3aed',
  },
  emojiButtonHovered: {
    backgroundColor: '#f3f4f6',
    transform: 'translateY(-2px)',
  },
  emoji: {
    fontSize: '32px',
    marginBottom: '4px',
  },
  emojiLabel: {
    fontSize: '10px',
    color: '#6b7280',
    whiteSpace: 'nowrap',
  },
  starRating: {
    marginBottom: '24px',
  },
  orText: {
    fontSize: '12px',
    color: '#9ca3af',
    marginBottom: '8px',
  },
  stars: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
  },
  starButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    transition: 'transform 0.2s',
  },
  star: {
    fontSize: '32px',
    transition: 'color 0.2s',
  },
  feedbackSection: {
    textAlign: 'left',
    marginBottom: '24px',
  },
  feedbackLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px',
  },
  feedbackTextarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  charCount: {
    display: 'block',
    textAlign: 'right',
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px',
  },
  submitButton: {
    width: '100%',
    padding: '14px 24px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  successContainer: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '48px 32px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    backgroundColor: '#ecfdf5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    color: '#10b981',
  },
  successTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '8px',
  },
  successText: {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '24px',
  },
  ratingDisplay: {
    display: 'flex',
    justifyContent: 'center',
    gap: '8px',
  },
  emojiDisplay: {
    fontSize: '32px',
    transition: 'all 0.3s',
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

export default CustomerSatisfactionPage;
