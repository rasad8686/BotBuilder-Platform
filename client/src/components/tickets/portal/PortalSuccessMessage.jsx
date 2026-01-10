/**
 * Portal Success Message Component
 * Success state after ticket submission
 */

import React from 'react';

const PortalSuccessMessage = ({ ticket, onViewTicket, onSubmitAnother }) => {
  return (
    <div style={styles.container}>
      {/* Success Icon */}
      <div style={styles.iconContainer}>
        <div style={styles.iconOuter}>
          <div style={styles.iconInner}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      </div>

      {/* Success Message */}
      <h1 style={styles.title}>Ticket Submitted Successfully!</h1>
      <p style={styles.description}>
        Thank you for reaching out. We've received your support request and will get back to you as soon as possible.
      </p>

      {/* Ticket Info Card */}
      {ticket && (
        <div style={styles.ticketCard}>
          <div style={styles.ticketHeader}>
            <span style={styles.ticketLabel}>Your ticket number</span>
            <span style={styles.ticketNumber}>#{ticket.number}</span>
          </div>

          <div style={styles.ticketDetails}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Subject</span>
              <span style={styles.detailValue}>{ticket.subject}</span>
            </div>

            {ticket.category && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Category</span>
                <span style={styles.detailValue}>
                  {ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}
                </span>
              </div>
            )}

            {ticket.priority && (
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Priority</span>
                <span
                  style={{
                    ...styles.priorityBadge,
                    ...getPriorityStyle(ticket.priority),
                  }}
                >
                  {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* What's Next */}
      <div style={styles.nextSteps}>
        <h3 style={styles.nextStepsTitle}>What happens next?</h3>
        <ul style={styles.stepsList}>
          <li style={styles.step}>
            <div style={styles.stepIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5" />
                <path d="m22 22-1.5-1.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
                <path d="M14 11H8" />
                <path d="M14 7H8" />
              </svg>
            </div>
            <div style={styles.stepContent}>
              <span style={styles.stepText}>
                You'll receive a confirmation email with your ticket details
              </span>
            </div>
          </li>
          <li style={styles.step}>
            <div style={styles.stepIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={styles.stepContent}>
              <span style={styles.stepText}>
                Our support team will review your request
              </span>
            </div>
          </li>
          <li style={styles.step}>
            <div style={styles.stepIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div style={styles.stepContent}>
              <span style={styles.stepText}>
                We'll respond via email and you can track progress here
              </span>
            </div>
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        {onViewTicket && (
          <button style={styles.primaryButton} onClick={onViewTicket}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View Ticket
          </button>
        )}

        {onSubmitAnother && (
          <button style={styles.secondaryButton} onClick={onSubmitAnother}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Submit Another Ticket
          </button>
        )}
      </div>
    </div>
  );
};

// Helper function for priority styles
const getPriorityStyle = (priority) => {
  const styles = {
    low: { backgroundColor: '#ecfdf5', color: '#059669' },
    normal: { backgroundColor: '#eff6ff', color: '#2563eb' },
    high: { backgroundColor: '#fffbeb', color: '#d97706' },
    urgent: { backgroundColor: '#fef2f2', color: '#dc2626' },
  };
  return styles[priority] || styles.normal;
};

const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '48px 32px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  iconContainer: {
    marginBottom: '24px',
  },
  iconOuter: {
    width: '96px',
    height: '96px',
    margin: '0 auto',
    backgroundColor: '#ecfdf5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: '72px',
    height: '72px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '12px',
  },
  description: {
    fontSize: '16px',
    color: '#6b7280',
    maxWidth: '400px',
    margin: '0 auto 32px',
    lineHeight: 1.6,
  },
  ticketCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '32px',
    border: '1px solid #e5e7eb',
    textAlign: 'left',
  },
  ticketHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  ticketLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  ticketNumber: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#7c3aed',
  },
  ticketDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: '13px',
    color: '#6b7280',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
  },
  priorityBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  nextSteps: {
    textAlign: 'left',
    marginBottom: '32px',
  },
  nextStepsTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '16px',
  },
  stepsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  stepIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7c3aed',
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
    paddingTop: '6px',
  },
  stepText: {
    fontSize: '14px',
    color: '#6b7280',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '300px',
    margin: '0 auto',
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 24px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px 24px',
    backgroundColor: '#fff',
    color: '#6b7280',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

export default PortalSuccessMessage;
