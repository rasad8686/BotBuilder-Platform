/**
 * Portal Satisfaction Widget Component
 * Inline rating widget for resolved tickets
 */

import React, { useState } from 'react';

const PortalSatisfactionWidget = ({ onSubmit, loading: externalLoading }) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const emojis = [
    { value: 1, emoji: '', label: 'Very Dissatisfied' },
    { value: 2, emoji: '', label: 'Dissatisfied' },
    { value: 3, emoji: '', label: 'Neutral' },
    { value: 4, emoji: '', label: 'Satisfied' },
    { value: 5, emoji: '', label: 'Very Satisfied' },
  ];

  const handleRatingClick = (value) => {
    setRating(value);
    setShowFeedback(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const success = await onSubmit(rating, feedback);

      if (success) {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={styles.successContainer}>
        <div style={styles.successIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div style={styles.successText}>
          <h4 style={styles.successTitle}>Thank you for your feedback!</h4>
          <p style={styles.successDescription}>
            Your rating helps us improve our support.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>How was your experience?</h3>
        <p style={styles.subtitle}>
          Your feedback helps us improve our support
        </p>
      </div>

      {/* Emoji Rating */}
      <div style={styles.emojiRating}>
        {emojis.map((e) => (
          <button
            key={e.value}
            type="button"
            style={{
              ...styles.emojiButton,
              ...(rating === e.value && styles.emojiButtonSelected),
              ...(hoveredRating === e.value && styles.emojiButtonHovered),
            }}
            onClick={() => handleRatingClick(e.value)}
            onMouseEnter={() => setHoveredRating(e.value)}
            onMouseLeave={() => setHoveredRating(0)}
            title={e.label}
            disabled={submitting || externalLoading}
          >
            <span style={styles.emoji}>{e.emoji}</span>
          </button>
        ))}
      </div>

      {/* Rating Label */}
      {(rating > 0 || hoveredRating > 0) && (
        <p style={styles.ratingLabel}>
          {emojis.find((e) => e.value === (hoveredRating || rating))?.label}
        </p>
      )}

      {/* Feedback Section */}
      {showFeedback && (
        <div style={styles.feedbackSection}>
          <label style={styles.feedbackLabel}>
            Tell us more (optional)
          </label>
          <textarea
            style={styles.feedbackTextarea}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What did you like or what could we improve?"
            rows={3}
            maxLength={500}
            disabled={submitting || externalLoading}
          />
          <div style={styles.feedbackFooter}>
            <span style={styles.charCount}>{feedback.length}/500</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Submit Button */}
      {showFeedback && (
        <button
          type="button"
          style={{
            ...styles.submitButton,
            ...(submitting && styles.submitButtonLoading),
          }}
          onClick={handleSubmit}
          disabled={submitting || externalLoading || rating === 0}
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#faf5ff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    border: '1px solid #e9d5ff',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    margin: 0,
  },
  emojiRating: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  emojiButton: {
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  emojiButtonSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#f3e8ff',
    transform: 'scale(1.1)',
  },
  emojiButtonHovered: {
    borderColor: '#c4b5fd',
    transform: 'scale(1.05)',
  },
  emoji: {
    fontSize: '28px',
  },
  ratingLabel: {
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '500',
    color: '#7c3aed',
    marginTop: '12px',
    marginBottom: 0,
  },
  feedbackSection: {
    marginTop: '20px',
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
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  feedbackFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '4px',
  },
  charCount: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  error: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '13px',
    textAlign: 'center',
  },
  submitButton: {
    width: '100%',
    padding: '12px 20px',
    marginTop: '16px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  submitButtonLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  successContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    backgroundColor: '#ecfdf5',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '24px',
    border: '1px solid #a7f3d0',
  },
  successIcon: {
    width: '48px',
    height: '48px',
    backgroundColor: '#10b981',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0,
  },
  successText: {
    flex: 1,
  },
  successTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#065f46',
    margin: '0 0 4px 0',
  },
  successDescription: {
    fontSize: '14px',
    color: '#047857',
    margin: 0,
  },
};

export default PortalSatisfactionWidget;
