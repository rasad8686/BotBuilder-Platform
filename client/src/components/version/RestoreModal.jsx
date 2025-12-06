import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function RestoreModal({ entityType, entityId, version, onClose, onRestored }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [commitMessage, setCommitMessage] = useState(`Restored to version ${version.version_number}`);

  const token = localStorage.getItem('token');

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRestore = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}/rollback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetVersion: version.version_number,
          commitMessage
        })
      });

      if (res.ok) {
        onRestored();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to restore version');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Restore Version
            </h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
              This will create a new version with the content from version {version.version_number}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            &times;
          </button>
        </div>

        {/* Version Preview */}
        <div style={{
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '12px',
              backgroundColor: '#f59e0b',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>v</div>
              <div style={{ fontSize: '20px', fontWeight: '700' }}>{version.version_number}</div>
            </div>
            <div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                {version.commit_message || `Version ${version.version_number}`}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                by <strong>{version.created_by_name || 'Unknown'}</strong>
              </div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>
                {formatDate(version.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Data Preview */}
        {version.data && (
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '500',
              color: '#374151',
              fontSize: '14px'
            }}>
              Version Data Preview
            </label>
            <div style={{
              padding: '12px',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              maxHeight: '150px',
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#4b5563'
            }}>
              {JSON.stringify(version.data, null, 2).slice(0, 500)}
              {JSON.stringify(version.data).length > 500 && '...'}
            </div>
          </div>
        )}

        {/* Commit Message */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Commit Message
          </label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Warning */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div style={{ fontSize: '14px', color: '#92400e' }}>
            <strong>Important:</strong> Restoring will not delete any versions.
            A new version will be created with the restored content.
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '16px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '16px',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Restoring...' : 'Restore Version'}
          </button>
        </div>
      </div>
    </div>
  );
}
