/**
 * Widget Ticket Form Component
 * Compact ticket form for the widget
 */

import React, { useState } from 'react';

const WidgetTicketForm = ({ config, onSubmit, primaryColor = '#7c3aed' }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const categories = config?.categories || [
    { id: 'general', name: 'General Inquiry' },
    { id: 'technical', name: 'Technical Support' },
    { id: 'billing', name: 'Billing' },
    { id: 'other', name: 'Other' },
  ];

  // Validate form
  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.length < 10) {
      newErrors.message = 'Please provide more details';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    setSubmitError(null);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);
    setSubmitError(null);

    const result = await onSubmit({
      ...formData,
      description: formData.message,
    });

    setLoading(false);

    if (!result.success) {
      setSubmitError(result.error || 'Failed to submit ticket');
    }
  };

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      {/* Name */}
      <div style={styles.field}>
        <label style={styles.label}>Name</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          style={{
            ...styles.input,
            ...(errors.name && styles.inputError),
          }}
          placeholder="Your name"
          disabled={loading}
        />
        {errors.name && <span style={styles.error}>{errors.name}</span>}
      </div>

      {/* Email */}
      <div style={styles.field}>
        <label style={styles.label}>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          style={{
            ...styles.input,
            ...(errors.email && styles.inputError),
          }}
          placeholder="you@example.com"
          disabled={loading}
        />
        {errors.email && <span style={styles.error}>{errors.email}</span>}
      </div>

      {/* Subject */}
      <div style={styles.field}>
        <label style={styles.label}>Subject</label>
        <input
          type="text"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          style={{
            ...styles.input,
            ...(errors.subject && styles.inputError),
          }}
          placeholder="Brief description"
          disabled={loading}
        />
        {errors.subject && <span style={styles.error}>{errors.subject}</span>}
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div style={styles.field}>
          <label style={styles.label}>Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            style={styles.select}
            disabled={loading}
          >
            <option value="">Select a category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Message */}
      <div style={styles.field}>
        <label style={styles.label}>Message</label>
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          style={{
            ...styles.textarea,
            ...(errors.message && styles.inputError),
          }}
          placeholder="How can we help you?"
          rows={4}
          disabled={loading}
        />
        {errors.message && <span style={styles.error}>{errors.message}</span>}
      </div>

      {/* Submit Error */}
      {submitError && (
        <div style={styles.submitError}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {submitError}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        style={{
          ...styles.submitButton,
          backgroundColor: primaryColor,
          opacity: loading ? 0.7 : 1,
        }}
        disabled={loading}
      >
        {loading ? (
          <>
            <span style={styles.spinner}></span>
            Submitting...
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Submit Ticket
          </>
        )}
      </button>
    </form>
  );
};

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  textarea: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    minHeight: '80px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  error: {
    fontSize: '12px',
    color: '#ef4444',
  },
  submitError: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '13px',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default WidgetTicketForm;
