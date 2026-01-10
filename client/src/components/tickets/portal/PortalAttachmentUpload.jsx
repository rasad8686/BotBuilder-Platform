/**
 * Portal Attachment Upload Component
 * Drag and drop file upload with preview
 */

import React, { useState, useRef, useCallback } from 'react';

const PortalAttachmentUpload = ({
  attachments,
  onChange,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = ['image/*', '.pdf', '.doc', '.docx', '.txt'],
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get file icon
  const getFileIcon = (type) => {
    if (type.startsWith('image/')) {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    }
    if (type === 'application/pdf') {
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    );
  };

  // Validate files
  const validateFiles = useCallback((files) => {
    const validFiles = [];
    let errorMessage = null;

    for (const file of files) {
      // Check max files
      if (attachments.length + validFiles.length >= maxFiles) {
        errorMessage = `Maximum ${maxFiles} files allowed`;
        break;
      }

      // Check file size
      if (file.size > maxSize) {
        errorMessage = `${file.name} is too large (max ${formatFileSize(maxSize)})`;
        continue;
      }

      // Check file type
      if (!allowedMimeTypes.includes(file.type)) {
        errorMessage = `${file.name} is not a supported file type`;
        continue;
      }

      // Check for duplicates
      const isDuplicate = attachments.some(
        (a) => a.name === file.name && a.size === file.size
      );
      if (isDuplicate) {
        continue;
      }

      validFiles.push(file);
    }

    return { validFiles, errorMessage };
  }, [attachments, maxFiles, maxSize]);

  // Handle file selection
  const handleFiles = useCallback((files) => {
    const { validFiles, errorMessage } = validateFiles(Array.from(files));

    if (errorMessage) {
      setError(errorMessage);
    } else {
      setError(null);
    }

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      }));

      onChange([...attachments, ...newAttachments]);
    }
  }, [attachments, onChange, validateFiles]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  // Handle file input change
  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const handleRemove = (id) => {
    const attachment = attachments.find((a) => a.id === id);
    if (attachment?.preview) {
      URL.revokeObjectURL(attachment.preview);
    }
    onChange(attachments.filter((a) => a.id !== id));
    setError(null);
  };

  // Open file dialog
  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div style={styles.container}>
      {/* Drop Zone */}
      <div
        style={{
          ...styles.dropZone,
          ...(dragActive && styles.dropZoneActive),
          ...(disabled && styles.dropZoneDisabled),
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => e.key === 'Enter' && handleClick()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedTypes.join(',')}
          onChange={handleInputChange}
          style={styles.fileInput}
          disabled={disabled}
        />

        <div style={styles.dropContent}>
          <div style={styles.dropIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={styles.dropText}>
            <strong>Click to upload</strong> or drag and drop
          </div>
          <div style={styles.dropHint}>
            Max {maxFiles} files, up to {formatFileSize(maxSize)} each
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={styles.error}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div style={styles.attachmentList}>
          {attachments.map((attachment) => (
            <div key={attachment.id} style={styles.attachmentItem}>
              {/* Preview or Icon */}
              {attachment.preview ? (
                <img
                  src={attachment.preview}
                  alt={attachment.name}
                  style={styles.attachmentPreview}
                />
              ) : (
                <div style={styles.attachmentIcon}>
                  {getFileIcon(attachment.type)}
                </div>
              )}

              {/* Info */}
              <div style={styles.attachmentInfo}>
                <span style={styles.attachmentName}>{attachment.name}</span>
                <span style={styles.attachmentSize}>{formatFileSize(attachment.size)}</span>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                style={styles.removeButton}
                onClick={() => handleRemove(attachment.id)}
                disabled={disabled}
                title="Remove file"
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

      {/* Files count */}
      {attachments.length > 0 && (
        <div style={styles.countInfo}>
          {attachments.length} of {maxFiles} files
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  dropZone: {
    position: 'relative',
    border: '2px dashed #d1d5db',
    borderRadius: '12px',
    padding: '32px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: '#fafafa',
  },
  dropZoneActive: {
    borderColor: '#7c3aed',
    backgroundColor: '#f5f3ff',
  },
  dropZoneDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  fileInput: {
    display: 'none',
  },
  dropContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none',
  },
  dropIcon: {
    color: '#9ca3af',
  },
  dropText: {
    fontSize: '14px',
    color: '#6b7280',
  },
  dropHint: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '13px',
  },
  attachmentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  attachmentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
  },
  attachmentPreview: {
    width: '40px',
    height: '40px',
    objectFit: 'cover',
    borderRadius: '6px',
    flexShrink: 0,
  },
  attachmentIcon: {
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    color: '#6b7280',
    flexShrink: 0,
  },
  attachmentInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  attachmentName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  attachmentSize: {
    fontSize: '11px',
    color: '#9ca3af',
  },
  removeButton: {
    padding: '6px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#9ca3af',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s, background-color 0.2s',
    flexShrink: 0,
  },
  countInfo: {
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'right',
  },
};

export default PortalAttachmentUpload;
