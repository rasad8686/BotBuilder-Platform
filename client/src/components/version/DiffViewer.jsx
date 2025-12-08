import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function DiffViewer({ entityType, entityId, versionA, versionB, onClose }) {
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('side-by-side'); // 'side-by-side' or 'inline'

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchDiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionA, versionB]);

  const fetchDiff = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}/compare`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          versionA: Math.min(versionA, versionB),
          versionB: Math.max(versionA, versionB)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDiff(data);
      }
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const renderValue = (value, type) => {
    const bgColor = type === 'added' ? '#dcfce7' : type === 'removed' ? '#fee2e2' : '#fef9c3';
    const textColor = type === 'added' ? '#15803d' : type === 'removed' ? '#dc2626' : '#854d0e';
    const prefix = type === 'added' ? '+' : type === 'removed' ? '-' : '~';

    return (
      <div style={{
        padding: '8px 12px',
        backgroundColor: bgColor,
        color: textColor,
        borderRadius: '6px',
        fontFamily: 'monospace',
        fontSize: '13px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        <span style={{ fontWeight: '600', marginRight: '8px' }}>{prefix}</span>
        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
      </div>
    );
  };

  const renderSideBySide = () => {
    if (!diff) return null;

    const allKeys = new Set([
      ...Object.keys(diff.diff.added || {}),
      ...Object.keys(diff.diff.removed || {}),
      ...Object.keys(diff.diff.modified || {})
    ]);

    if (allKeys.size === 0) {
      return (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280'
        }}>
          No differences found between these versions
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Array.from(allKeys).map(key => {
          const isAdded = key in (diff.diff.added || {});
          const isRemoved = key in (diff.diff.removed || {});
          const isModified = key in (diff.diff.modified || {});

          return (
            <div key={key} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {/* Key Header */}
              <div style={{
                padding: '10px 16px',
                backgroundColor: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontFamily: 'monospace' }}>{key}</span>
                {isAdded && (
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>ADDED</span>
                )}
                {isRemoved && (
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>REMOVED</span>
                )}
                {isModified && (
                  <span style={{
                    padding: '2px 8px',
                    backgroundColor: '#fef9c3',
                    color: '#854d0e',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>CHANGED</span>
                )}
              </div>

              {/* Values */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: viewMode === 'side-by-side' ? '1fr 1fr' : '1fr',
                gap: '1px',
                backgroundColor: '#e5e7eb'
              }}>
                {isAdded && (
                  <>
                    {viewMode === 'side-by-side' && (
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', color: '#9ca3af', fontStyle: 'italic' }}>
                        (empty)
                      </div>
                    )}
                    <div style={{ padding: '12px', backgroundColor: 'white' }}>
                      {renderValue(diff.diff.added[key], 'added')}
                    </div>
                  </>
                )}

                {isRemoved && (
                  <>
                    <div style={{ padding: '12px', backgroundColor: 'white' }}>
                      {renderValue(diff.diff.removed[key], 'removed')}
                    </div>
                    {viewMode === 'side-by-side' && (
                      <div style={{ padding: '12px', backgroundColor: '#f9fafb', color: '#9ca3af', fontStyle: 'italic' }}>
                        (removed)
                      </div>
                    )}
                  </>
                )}

                {isModified && (
                  <>
                    <div style={{ padding: '12px', backgroundColor: 'white' }}>
                      {renderValue(diff.diff.modified[key].old, 'removed')}
                    </div>
                    <div style={{ padding: '12px', backgroundColor: 'white' }}>
                      {renderValue(diff.diff.modified[key].new, 'added')}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>
              Compare Versions
            </h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
              Version {Math.min(versionA, versionB)} → Version {Math.max(versionA, versionB)}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* View Mode Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              padding: '4px'
            }}>
              <button
                onClick={() => setViewMode('side-by-side')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: viewMode === 'side-by-side' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: viewMode === 'side-by-side' ? '500' : '400',
                  boxShadow: viewMode === 'side-by-side' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('inline')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: viewMode === 'inline' ? 'white' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: viewMode === 'inline' ? '500' : '400',
                  boxShadow: viewMode === 'inline' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Inline
              </button>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '4px'
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#f9fafb',
          display: 'flex',
          gap: '24px',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#dcfce7', borderRadius: '4px' }}></div>
            <span style={{ color: '#15803d' }}>Added</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#fee2e2', borderRadius: '4px' }}></div>
            <span style={{ color: '#dc2626' }}>Removed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '16px', height: '16px', backgroundColor: '#fef9c3', borderRadius: '4px' }}></div>
            <span style={{ color: '#854d0e' }}>Changed</span>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px'
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Loading diff...
            </div>
          ) : (
            renderSideBySide()
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
