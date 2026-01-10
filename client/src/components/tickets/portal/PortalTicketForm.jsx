/**
 * Portal Ticket Form Component
 * Full ticket submission form with validation
 */

import React, { useState, useRef } from 'react';

const PortalTicketForm = ({ config, onSubmit, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    category: '',
    priority: 'normal',
    description: '',
  });
  const [attachments, setAttachments] = useState([]);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const categories = config?.categories || [
    { id: 'general', name: 'General Inquiry' },
    { id: 'technical', name: 'Technical Support' },
    { id: 'billing', name: 'Billing Question' },
    { id: 'feature', name: 'Feature Request' },
    { id: 'bug', name: 'Bug Report' },
  ];

  const priorities = [
    { id: 'low', name: 'Low', description: 'Not urgent' },
    { id: 'normal', name: 'Normal', description: 'Standard response time' },
    { id: 'high', name: 'High', description: 'Needs attention soon' },
    { id: 'urgent', name: 'Urgent', description: 'Critical issue' },
  ];

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.length < 5) {
      newErrors.subject = 'Subject must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Please provide more details (at least 20 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, attachments: `${file.name} is too large (max 10MB)` }));
        return false;
      }
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({ ...prev, attachments: `${file.name} has an unsupported format` }));
        return false;
      }
      return true;
    });

    // Create preview for images
    const newAttachments = validFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => {
      const newAttachments = [...prev];
      if (newAttachments[index].preview) {
        URL.revokeObjectURL(newAttachments[index].preview);
      }
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    onSubmit({
      ...formData,
      attachments: attachments.map((a) => ({
        name: a.name,
        size: a.size,
        type: a.type,
        file: a.file,
      })),
    });
  };

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      {/* Name Field */}
      <div style={styles.field}>
        <label style={styles.label}>
          Your Name <span style={styles.required}>*</span>
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          style={{
            ...styles.input,
            ...(errors.name && styles.inputError),
          }}
          placeholder="John Doe"
          disabled={loading}
        />
        {errors.name && <span style={styles.errorText}>{errors.name}</span>}
      </div>

      {/* Email Field */}
      <div style={styles.field}>
        <label style={styles.label}>
          Email Address <span style={styles.required}>*</span>
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          style={{
            ...styles.input,
            ...(errors.email && styles.inputError),
          }}
          placeholder="john@example.com"
          disabled={loading}
        />
        {errors.email && <span style={styles.errorText}>{errors.email}</span>}
      </div>

      {/* Subject Field */}
      <div style={styles.field}>
        <label style={styles.label}>
          Subject <span style={styles.required}>*</span>
        </label>
        <input
          type="text"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          style={{
            ...styles.input,
            ...(errors.subject && styles.inputError),
          }}
          placeholder="Brief description of your issue"
          disabled={loading}
        />
        {errors.subject && <span style={styles.errorText}>{errors.subject}</span>}
      </div>

      {/* Category Field */}
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

      {/* Priority Field */}
      <div style={styles.field}>
        <label style={styles.label}>Priority</label>
        <div style={styles.priorityGrid}>
          {priorities.map((p) => (
            <button
              key={p.id}
              type="button"
              style={{
                ...styles.priorityOption,
                ...(formData.priority === p.id && styles.priorityOptionSelected),
              }}
              onClick={() => setFormData((prev) => ({ ...prev, priority: p.id }))}
              disabled={loading}
            >
              <span style={styles.priorityName}>{p.name}</span>
              <span style={styles.priorityDesc}>{p.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Description Field */}
      <div style={styles.field}>
        <label style={styles.label}>
          Description <span style={styles.required}>*</span>
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          style={{
            ...styles.textarea,
            ...(errors.description && styles.inputError),
          }}
          placeholder="Please describe your issue in detail..."
          rows={6}
          disabled={loading}
        />
        <div style={styles.textareaFooter}>
          {errors.description && <span style={styles.errorText}>{errors.description}</span>}
          <span style={styles.charCount}>{formData.description.length} characters</span>
        </div>
      </div>

      {/* Attachments */}
      <div style={styles.field}>
        <label style={styles.label}>Attachments</label>
        <div style={styles.uploadArea}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={styles.fileInput}
            accept="image/*,.pdf,.doc,.docx,.txt"
            disabled={loading}
          />
          <div style={styles.uploadContent}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span style={styles.uploadText}>Click or drag files to upload</span>
            <span style={styles.uploadHint}>Max 10MB per file. Supported: Images, PDF, DOC, TXT</span>
          </div>
        </div>
        {errors.attachments && <span style={styles.errorText}>{errors.attachments}</span>}

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div style={styles.attachmentList}>
            {attachments.map((attachment, index) => (
              <div key={index} style={styles.attachmentItem}>
                {attachment.preview ? (
                  <img src={attachment.preview} alt={attachment.name} style={styles.attachmentPreview} />
                ) : (
                  <div style={styles.attachmentIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                )}
                <div style={styles.attachmentInfo}>
                  <span style={styles.attachmentName}>{attachment.name}</span>
                  <span style={styles.attachmentSize}>{formatFileSize(attachment.size)}</span>
                </div>
                <button
                  type="button"
                  style={styles.removeButton}
                  onClick={() => handleRemoveAttachment(index)}
                  disabled={loading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        style={{
          ...styles.submitButton,
          ...(loading && styles.submitButtonLoading),
        }}
        disabled={loading}
      >
        {loading ? (
          <>
            <span style={styles.buttonSpinner}></span>
            Submitting...
          </>
        ) : (
          'Submit Ticket'
        )}
      </button>
    </form>
  );
};

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  required: {
    color: '#ef4444',
  },
  input: {
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  inputError: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.1)',
  },
  select: {
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  priorityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  priorityOption: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
  },
  priorityOptionSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#f3e8ff',
  },
  priorityName: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#1f2937',
  },
  priorityDesc: {
    display: 'block',
    fontSize: '11px',
    color: '#9ca3af',
    marginTop: '2px',
  },
  textarea: {
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    minHeight: '120px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  textareaFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: '12px',
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
  },
  uploadArea: {
    position: 'relative',
    border: '2px dashed #d1d5db',
    borderRadius: '8px',
    padding: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  fileInput: {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: 'pointer',
  },
  uploadContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    color: '#6b7280',
  },
  uploadText: {
    fontSize: '14px',
    fontWeight: '500',
  },
  uploadHint: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  attachmentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '12px',
  },
  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  attachmentPreview: {
    width: '40px',
    height: '40px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  attachmentIcon: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    color: '#6b7280',
  },
  attachmentInfo: {
    flex: 1,
    minWidth: 0,
  },
  attachmentName: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  attachmentSize: {
    display: 'block',
    fontSize: '11px',
    color: '#9ca3af',
  },
  removeButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: '#9ca3af',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
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
  submitButtonLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  buttonSpinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default PortalTicketForm;
