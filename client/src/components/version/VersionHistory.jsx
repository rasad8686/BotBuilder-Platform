import React, { useState, useEffect } from 'react';
import { FileEdit } from 'lucide-react';
import DiffViewer from './DiffViewer';
import RestoreModal from './RestoreModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function VersionHistory({ entityType, entityId, onVersionRestored }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState([]);
  const [showDiff, setShowDiff] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

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

  const handleSelectVersion = (version) => {
    setSelectedVersions(prev => {
      const isSelected = prev.some(v => v.id === version.id);
      if (isSelected) {
        return prev.filter(v => v.id !== version.id);
      }
      if (prev.length >= 2) {
        return [prev[1], version];
      }
      return [...prev, version];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2) {
      setShowDiff(true);
    }
  };

  const handleRestore = (version) => {
    setRestoreVersion(version);
    setShowRestore(true);
  };

  const handleRestoreConfirmed = () => {
    setShowRestore(false);
    setRestoreVersion(null);
    fetchVersions();
    if (onVersionRestored) {
      onVersionRestored();
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
        Loading version history...
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px',
        backgroundColor: '#f9fafb',
        borderRadius: '12px',
        color: '#6b7280'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}><FileEdit size={48} /></div>
        <p>No version history yet</p>
        <p style={{ fontSize: '14px' }}>Changes will be tracked automatically</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          Version History ({versions.length})
        </h3>
        {selectedVersions.length === 2 && (
          <button
            onClick={handleCompare}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Compare Selected
          </button>
        )}
      </div>

      {/* Version List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {versions.map((version, index) => {
          const isSelected = selectedVersions.some(v => v.id === version.id);
          const isLatest = index === 0;

          return (
            <div
              key={version.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 20px',
                backgroundColor: isSelected ? '#eff6ff' : 'white',
                borderRadius: '12px',
                border: `2px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                transition: 'all 0.2s'
              }}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleSelectVersion(version)}
                style={{
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer'
                }}
              />

              {/* Version Number */}
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                backgroundColor: isLatest ? '#10b981' : '#6b7280',
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

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600' }}>
                    {version.commit_message || `Version ${version.version_number}`}
                  </span>
                  {isLatest && (
                    <span style={{
                      padding: '2px 8px',
                      backgroundColor: '#dcfce7',
                      color: '#15803d',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      LATEST
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  by <strong>{version.created_by_name || 'Unknown'}</strong>
                  <span style={{ margin: '0 8px' }}>•</span>
                  {formatDate(version.created_at)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleSelectVersion(version)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  View
                </button>
                {!isLatest && (
                  <button
                    onClick={() => handleRestore(version)}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Diff Modal */}
      {showDiff && selectedVersions.length === 2 && (
        <DiffViewer
          entityType={entityType}
          entityId={entityId}
          versionA={selectedVersions[0].version_number}
          versionB={selectedVersions[1].version_number}
          onClose={() => setShowDiff(false)}
        />
      )}

      {/* Restore Modal */}
      {showRestore && restoreVersion && (
        <RestoreModal
          entityType={entityType}
          entityId={entityId}
          version={restoreVersion}
          onClose={() => { setShowRestore(false); setRestoreVersion(null); }}
          onRestored={handleRestoreConfirmed}
        />
      )}
    </div>
  );
}
