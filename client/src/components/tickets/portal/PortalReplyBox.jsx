/**
 * Portal Reply Box Component
 * Rich text reply box with attachments
 */

import React, { useState, useRef } from 'react';

const PortalReplyBox = ({ onSubmit, loading, placeholder = 'Type your reply...' }) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const maxFiles = 5;

    if (attachments.length + files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        setError(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    const newAttachments = validFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    setError(null);

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

  // Handle submit
  const handleSubmit = async () => {
    if (!content.trim() && attachments.length === 0) {
      setError('Please enter a message');
      return;
    }

    setError(null);
    const success = await onSubmit(
      content,
      attachments.map((a) => ({
        name: a.name,
        size: a.size,
        type: a.type,
        file: a.file,
      }))
    );

    if (success) {
      setContent('');
      // Clean up previews
      attachments.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview);
      });
      setAttachments([]);
    }
  };

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e) => {
    setContent(e.target.value);

    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  };

  return (
    <div
      style={{
        ...styles.container,
        ...(focused && styles.containerFocused),
      }}
    >
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div style={styles.attachmentPreview}>
          {attachments.map((attachment, index) => (
            <div key={index} style={styles.attachmentItem}>
              {attachment.preview ? (
                <img src={attachment.preview} alt={attachment.name} style={styles.attachmentImage} />
              ) : (
                <div style={styles.attachmentIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={styles.textarea}
        disabled={loading}
        rows={3}
      />

      {/* Error */}
      {error && (
        <div style={styles.error}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          {/* Attach Button */}
          <button
            type="button"
            style={styles.attachButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || attachments.length >= 5}
            title="Attach files"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span>Attach</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={styles.fileInput}
            accept="image/*,.pdf,.doc,.docx,.txt"
            disabled={loading}
          />

          {/* Character count */}
          <span style={styles.charCount}>
            {content.length > 0 && `${content.length} characters`}
          </span>
        </div>

        <div style={styles.toolbarRight}>
          {/* Keyboard shortcut hint */}
          <span style={styles.shortcutHint}>Ctrl+Enter to send</span>

          {/* Send Button */}
          <button
            type="button"
            style={{
              ...styles.sendButton,
              ...(loading && styles.sendButtonLoading),
              ...((!content.trim() && attachments.length === 0) && styles.sendButtonDisabled),
            }}
            onClick={handleSubmit}
            disabled={loading || (!content.trim() && attachments.length === 0)}
          >
            {loading ? (
              <>
                <span style={styles.spinner}></span>
                Sending...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Send Reply
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  containerFocused: {
    borderColor: '#7c3aed',
    boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.1)',
  },
  attachmentPreview: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '12px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
  },
  attachmentImage: {
    width: '32px',
    height: '32px',
    objectFit: 'cover',
    borderRadius: '4px',
  },
  attachmentIcon: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    color: '#6b7280',
  },
  attachmentInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  attachmentName: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#374151',
    maxWidth: '120px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  attachmentSize: {
    fontSize: '10px',
    color: '#9ca3af',
  },
  removeButton: {
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textarea: {
    width: '100%',
    padding: '16px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'none',
    minHeight: '80px',
    maxHeight: '200px',
    boxSizing: 'border-box',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '13px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  attachButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  fileInput: {
    display: 'none',
  },
  charCount: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  shortcutHint: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  sendButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#7c3aed',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  sendButtonLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
    cursor: 'not-allowed',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default PortalReplyBox;
