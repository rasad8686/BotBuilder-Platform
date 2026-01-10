/**
 * Portal Conversation Component
 * Display ticket conversation thread
 */

import React from 'react';

const PortalConversation = ({ ticket, comments }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = [
      '#7c3aed', '#3b82f6', '#10b981', '#f59e0b',
      '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4',
    ];
    const index = name ? name.charCodeAt(0) % colors.length : 0;
    return colors[index];
  };

  // Combine initial message with comments
  const allMessages = [
    {
      id: 'initial',
      type: 'customer',
      author: ticket?.customerName || ticket?.customerEmail || 'Customer',
      email: ticket?.customerEmail,
      body: ticket?.description || ticket?.body,
      createdAt: ticket?.createdAt,
      attachments: ticket?.attachments || [],
    },
    ...(comments || []).map((comment) => ({
      ...comment,
      type: comment.isInternal ? 'internal' : (comment.isAgent ? 'agent' : 'customer'),
    })),
  ];

  return (
    <div style={styles.container}>
      {allMessages.map((message, index) => {
        const isCustomer = message.type === 'customer';
        const isAgent = message.type === 'agent';

        return (
          <div
            key={message.id}
            style={{
              ...styles.message,
              ...(isCustomer && styles.messageCustomer),
              ...(isAgent && styles.messageAgent),
            }}
          >
            {/* Avatar */}
            <div style={styles.avatarContainer}>
              {message.avatar ? (
                <img
                  src={message.avatar}
                  alt={message.author}
                  style={styles.avatar}
                />
              ) : (
                <div
                  style={{
                    ...styles.avatarPlaceholder,
                    backgroundColor: isAgent ? '#7c3aed' : getAvatarColor(message.author),
                  }}
                >
                  {isAgent ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    getInitials(message.author)
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            <div style={styles.messageContent}>
              <div style={styles.messageHeader}>
                <span style={styles.authorName}>
                  {message.author}
                  {isAgent && <span style={styles.agentBadge}>Support</span>}
                </span>
                <span style={styles.messageDate}>
                  {formatDate(message.createdAt)}
                </span>
              </div>

              <div
                style={{
                  ...styles.messageBody,
                  ...(isAgent && styles.messageBodyAgent),
                }}
              >
                {/* Render message body with basic formatting */}
                {message.body?.split('\n').map((paragraph, pIndex) => (
                  <p key={pIndex} style={styles.paragraph}>
                    {paragraph || '\u00A0'}
                  </p>
                ))}
              </div>

              {/* Attachments */}
              {message.attachments && message.attachments.length > 0 && (
                <div style={styles.attachments}>
                  {message.attachments.map((attachment, aIndex) => (
                    <a
                      key={aIndex}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.attachment}
                    >
                      {attachment.type?.startsWith('image/') ? (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          style={styles.attachmentImage}
                        />
                      ) : (
                        <div style={styles.attachmentFile}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          <span style={styles.attachmentName}>{attachment.name}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {allMessages.length === 1 && (
        <div style={styles.noReplies}>
          <p style={styles.noRepliesText}>
            Our team will respond to your ticket soon. You'll receive an email notification when there's a reply.
          </p>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  message: {
    display: 'flex',
    gap: '12px',
  },
  messageCustomer: {},
  messageAgent: {},
  avatarContainer: {
    flexShrink: 0,
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
  },
  messageContent: {
    flex: 1,
    minWidth: 0,
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    flexWrap: 'wrap',
  },
  authorName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  agentBadge: {
    padding: '2px 6px',
    backgroundColor: '#f3e8ff',
    color: '#7c3aed',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  messageDate: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  messageBody: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #e5e7eb',
  },
  messageBodyAgent: {
    backgroundColor: '#f3e8ff',
    borderColor: '#c4b5fd',
  },
  paragraph: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#374151',
  },
  attachments: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '12px',
  },
  attachment: {
    display: 'block',
    textDecoration: 'none',
  },
  attachmentImage: {
    maxWidth: '200px',
    maxHeight: '150px',
    borderRadius: '8px',
    objectFit: 'cover',
    border: '1px solid #e5e7eb',
  },
  attachmentFile: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    color: '#6b7280',
    fontSize: '13px',
  },
  attachmentName: {
    color: '#374151',
    fontWeight: '500',
  },
  noReplies: {
    textAlign: 'center',
    padding: '24px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px dashed #e5e7eb',
  },
  noRepliesText: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
};

export default PortalConversation;
