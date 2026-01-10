/**
 * Portal Ticket Card Component
 * Compact ticket card for list display
 */

import React from 'react';
import PortalStatusBadge from './PortalStatusBadge';

const PortalTicketCard = ({ ticket, onClick }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      general: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
      technical: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
      billing: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
      feature: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
      bug: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 0 1 6 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
          <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H3M6 17H1M18 13h3M18 17h5M17.47 9c1.93-.2 3.53-1.9 3.53-4" />
        </svg>
      ),
    };

    return icons[category] || icons.general;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: '#10b981',
      normal: '#3b82f6',
      high: '#f59e0b',
      urgent: '#ef4444',
    };
    return colors[priority] || colors.normal;
  };

  const hasUnreadReplies = ticket.unreadCount > 0;

  return (
    <div
      style={{
        ...styles.card,
        ...(hasUnreadReplies && styles.cardUnread),
      }}
      onClick={() => onClick(ticket.id)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onClick(ticket.id)}
    >
      <div style={styles.cardHeader}>
        <div style={styles.ticketNumber}>#{ticket.number}</div>
        <PortalStatusBadge status={ticket.status} />
      </div>

      <h3 style={styles.subject}>{ticket.subject}</h3>

      {ticket.lastMessage && (
        <p style={styles.preview}>
          {ticket.lastMessage.length > 100
            ? ticket.lastMessage.substring(0, 100) + '...'
            : ticket.lastMessage}
        </p>
      )}

      <div style={styles.cardFooter}>
        <div style={styles.meta}>
          {ticket.category && (
            <span style={styles.category}>
              {getCategoryIcon(ticket.category)}
              <span style={styles.categoryName}>
                {ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}
              </span>
            </span>
          )}

          {ticket.priority && ticket.priority !== 'normal' && (
            <span
              style={{
                ...styles.priority,
                color: getPriorityColor(ticket.priority),
              }}
            >
              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
            </span>
          )}
        </div>

        <div style={styles.info}>
          {hasUnreadReplies && (
            <span style={styles.unreadBadge}>{ticket.unreadCount} new</span>
          )}

          <span style={styles.date}>
            {formatDate(ticket.updatedAt || ticket.createdAt)}
          </span>

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={styles.arrow}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* Unread indicator */}
      {hasUnreadReplies && <div style={styles.unreadIndicator} />}
    </div>
  );
};

const styles = {
  card: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: '#faf5ff',
    borderColor: '#c4b5fd',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  ticketNumber: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#6b7280',
  },
  subject: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 8px 0',
    lineHeight: 1.4,
  },
  preview: {
    fontSize: '14px',
    color: '#6b7280',
    margin: '0 0 16px 0',
    lineHeight: 1.5,
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  category: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#6b7280',
    fontSize: '12px',
  },
  categoryName: {
    display: 'none',
  },
  priority: {
    fontSize: '12px',
    fontWeight: '500',
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  unreadBadge: {
    padding: '2px 8px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
  },
  date: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  arrow: {
    color: '#9ca3af',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '4px',
    backgroundColor: '#7c3aed',
    borderRadius: '12px 0 0 12px',
  },
};

// Hover styles (would need CSS-in-JS library or CSS file for proper hover)
// Adding inline style note: In production, use CSS modules or styled-components

export default PortalTicketCard;
