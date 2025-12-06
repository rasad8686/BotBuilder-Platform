import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function BranchSelector({ entityType, entityId, currentBranch, onBranchChange }) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [baseVersionId, setBaseVersionId] = useState('');
  const [versions, setVersions] = useState([]);
  const [mergeSource, setMergeSource] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchBranches();
    fetchVersions();
  }, [entityType, entityId]);

  const fetchBranches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}/branches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || !baseVersionId) return;
    setActionLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}/branches`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branchName: newBranchName,
          baseVersionId: parseInt(baseVersionId)
        })
      });

      if (res.ok) {
        setNewBranchName('');
        setBaseVersionId('');
        setShowCreateModal(false);
        fetchBranches();
      }
    } catch (err) {
      console.error('Failed to create branch:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMergeBranch = async () => {
    if (!mergeSource || !mergeTarget) return;
    setActionLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/versions/${entityType}/${entityId}/branches/merge`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceBranch: mergeSource,
          targetBranch: mergeTarget
        })
      });

      if (res.ok) {
        setMergeSource('');
        setMergeTarget('');
        setShowMergeModal(false);
        fetchBranches();
      }
    } catch (err) {
      console.error('Failed to merge branch:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBranch = async (branchName) => {
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) return;

    try {
      const res = await fetch(
        `${API_URL}/api/versions/${entityType}/${entityId}/branches/${encodeURIComponent(branchName)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (res.ok) {
        fetchBranches();
      }
    } catch (err) {
      console.error('Failed to delete branch:', err);
    }
  };

  const selectedBranch = branches.find(b => b.branch_name === currentBranch) || branches[0];

  return (
    <div style={{ position: 'relative' }}>
      {/* Branch Selector Button */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          <span style={{ fontSize: '16px' }}>🌿</span>
          <span>{selectedBranch?.branch_name || 'main'}</span>
          {selectedBranch?.is_main && (
            <span style={{
              padding: '2px 6px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600'
            }}>
              MAIN
            </span>
          )}
          <span style={{ marginLeft: '4px', color: '#9ca3af' }}>▼</span>
        </button>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '10px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          + Branch
        </button>

        {branches.length > 1 && (
          <button
            onClick={() => setShowMergeModal(true)}
            style={{
              padding: '10px 16px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Merge
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10
            }}
            onClick={() => setShowDropdown(false)}
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '8px',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
            minWidth: '280px',
            zIndex: 20,
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb',
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: '600',
              textTransform: 'uppercase'
            }}>
              Branches ({branches.length})
            </div>
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              {branches.map(branch => (
                <div
                  key={branch.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    cursor: 'pointer',
                    backgroundColor: branch.branch_name === currentBranch ? '#eff6ff' : 'white',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                  onClick={() => {
                    if (onBranchChange) onBranchChange(branch.branch_name);
                    setShowDropdown(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>🌿</span>
                    <div>
                      <div style={{ fontWeight: '500', fontSize: '14px' }}>
                        {branch.branch_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                        Base: v{branch.base_version_number || '?'}
                      </div>
                    </div>
                    {branch.is_main && (
                      <span style={{
                        padding: '2px 6px',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '600'
                      }}>
                        MAIN
                      </span>
                    )}
                  </div>
                  {!branch.is_main && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBranch(branch.branch_name);
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Create Branch Modal */}
      {showCreateModal && (
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
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600' }}>
              Create New Branch
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Branch Name
              </label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/my-changes"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Base Version
              </label>
              <select
                value={baseVersionId}
                onChange={(e) => setBaseVersionId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select version</option>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} - {v.commit_message || 'No message'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBranch}
                disabled={actionLoading || !newBranchName || !baseVersionId}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  opacity: actionLoading ? 0.7 : 1
                }}
              >
                {actionLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
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
            maxWidth: '400px'
          }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '600' }}>
              Merge Branches
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Source Branch
              </label>
              <select
                value={mergeSource}
                onChange={(e) => setMergeSource(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select source</option>
                {branches.filter(b => b.branch_name !== mergeTarget).map(b => (
                  <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
                ))}
              </select>
            </div>

            <div style={{ textAlign: 'center', margin: '12px 0', color: '#6b7280' }}>
              ↓ merge into ↓
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Target Branch
              </label>
              <select
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Select target</option>
                {branches.filter(b => b.branch_name !== mergeSource).map(b => (
                  <option key={b.id} value={b.branch_name}>{b.branch_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowMergeModal(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMergeBranch}
                disabled={actionLoading || !mergeSource || !mergeTarget}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  opacity: actionLoading ? 0.7 : 1
                }}
              >
                {actionLoading ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
