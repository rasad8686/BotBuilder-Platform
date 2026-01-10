import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  summaryCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  summaryValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  summaryValueWarning: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f59e0b'
  },
  summaryValueDanger: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#ef4444'
  },
  tokensSection: {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  },
  sectionHeader: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  tokenCard: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  tokenHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  tokenInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  tokenName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  tokenPreview: {
    fontSize: '12px',
    color: '#6b7280',
    fontFamily: 'monospace'
  },
  badge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  badgeActive: {
    background: '#d1fae5',
    color: '#059669'
  },
  badgeWarning: {
    background: '#fef3c7',
    color: '#d97706'
  },
  badgeDanger: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  badgeDisabled: {
    background: '#f3f4f6',
    color: '#6b7280'
  },
  progressSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px'
  },
  progressLabel: {
    color: '#6b7280'
  },
  progressValue: {
    fontWeight: '600',
    color: '#1a1a2e'
  },
  progressBar: {
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease'
  },
  progressFillNormal: {
    background: 'linear-gradient(90deg, #3b82f6, #60a5fa)'
  },
  progressFillWarning: {
    background: 'linear-gradient(90deg, #f59e0b, #fbbf24)'
  },
  progressFillDanger: {
    background: 'linear-gradient(90deg, #ef4444, #f87171)'
  },
  limitSettings: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    background: '#f9fafb',
    padding: '16px',
    borderRadius: '8px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  select: {
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    outline: 'none',
    background: '#fff',
    cursor: 'pointer'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#374151',
    cursor: 'pointer'
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  },
  button: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s'
  },
  buttonPrimary: {
    background: '#3b82f6',
    color: '#fff'
  },
  buttonSecondary: {
    background: '#e5e7eb',
    color: '#374151'
  },
  buttonDanger: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  resetInfo: {
    fontSize: '12px',
    color: '#6b7280',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyState: {
    padding: '48px',
    textAlign: 'center',
    color: '#6b7280'
  },
  sliderContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  slider: {
    flex: 1,
    height: '6px',
    appearance: 'none',
    background: '#e5e7eb',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer'
  },
  sliderValue: {
    minWidth: '60px',
    textAlign: 'right',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e'
  }
};

const SpendingLimits = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [editingToken, setEditingToken] = useState(null);
  const [editForm, setEditForm] = useState({
    hardLimit: '',
    warningLimit: '',
    periodType: 'monthly',
    autoDisable: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSpendingData();
  }, []);

  const fetchSpendingData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/api-tokens/spending/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
        setTokens(data.tokens);
      }
    } catch (error) {
      console.error('Error fetching spending data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (token) => {
    setEditingToken(token.tokenId);
    setEditForm({
      hardLimit: token.limit || '',
      warningLimit: token.warning || '',
      periodType: token.periodType || 'monthly',
      autoDisable: token.autoDisableOnLimit !== false
    });
  };

  const handleCancelEdit = () => {
    setEditingToken(null);
    setEditForm({
      hardLimit: '',
      warningLimit: '',
      periodType: 'monthly',
      autoDisable: true
    });
  };

  const handleSaveLimit = async (tokenId) => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-tokens/${tokenId}/spending-limit`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hardLimit: editForm.hardLimit ? parseFloat(editForm.hardLimit) : null,
          warningLimit: editForm.warningLimit ? parseFloat(editForm.warningLimit) : null,
          periodType: editForm.periodType,
          autoDisable: editForm.autoDisable
        })
      });

      if (response.ok) {
        await fetchSpendingData();
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error saving spending limit:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSpending = async (tokenId) => {
    if (!window.confirm('Are you sure you want to reset spending for this token?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/api-tokens/${tokenId}/spending/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchSpendingData();
      }
    } catch (error) {
      console.error('Error resetting spending:', error);
    }
  };

  const getProgressColor = (percentUsed, warningReached, limitReached) => {
    if (limitReached) return styles.progressFillDanger;
    if (warningReached) return styles.progressFillWarning;
    return styles.progressFillNormal;
  };

  const getBadgeStyle = (token) => {
    if (token.disabledByLimit) return { ...styles.badge, ...styles.badgeDanger };
    if (token.limitReached) return { ...styles.badge, ...styles.badgeDanger };
    if (token.warningReached) return { ...styles.badge, ...styles.badgeWarning };
    if (!token.isActive) return { ...styles.badge, ...styles.badgeDisabled };
    return { ...styles.badge, ...styles.badgeActive };
  };

  const getBadgeText = (token) => {
    if (token.disabledByLimit) return 'Limit Exceeded';
    if (token.limitReached) return 'At Limit';
    if (token.warningReached) return 'Warning';
    if (!token.isActive) return 'Inactive';
    return 'Active';
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading spending data...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Spending Limits</h1>
        <p style={styles.subtitle}>
          Monitor and control API spending across your tokens
        </p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Tokens</div>
            <div style={styles.summaryValue}>{summary.totalTokens}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Spend (Period)</div>
            <div style={styles.summaryValue}>{formatCurrency(summary.totalSpend)}</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>At Warning</div>
            <div style={summary.tokensAtWarning > 0 ? styles.summaryValueWarning : styles.summaryValue}>
              {summary.tokensAtWarning}
            </div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>At Limit / Disabled</div>
            <div style={summary.tokensAtLimit > 0 ? styles.summaryValueDanger : styles.summaryValue}>
              {summary.tokensAtLimit} / {summary.tokensDisabled}
            </div>
          </div>
        </div>
      )}

      {/* Tokens List */}
      <div style={styles.tokensSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>API Token Spending</span>
        </div>

        {tokens.length === 0 ? (
          <div style={styles.emptyState}>
            No API tokens found. Create a token to set spending limits.
          </div>
        ) : (
          tokens.map((token) => (
            <div key={token.tokenId} style={styles.tokenCard}>
              <div style={styles.tokenHeader}>
                <div style={styles.tokenInfo}>
                  <span style={styles.tokenName}>{token.tokenName}</span>
                  <span style={styles.tokenPreview}>{token.tokenPreview}</span>
                </div>
                <span style={getBadgeStyle(token)}>{getBadgeText(token)}</span>
              </div>

              {/* Progress Bar */}
              <div style={styles.progressSection}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressLabel}>
                    Current Spend: {formatCurrency(token.currentSpend)}
                    {token.limit && ` / ${formatCurrency(token.limit)}`}
                  </span>
                  <span style={styles.progressValue}>
                    {token.limit ? `${token.percentUsed}%` : 'No limit'}
                  </span>
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      ...getProgressColor(token.percentUsed, token.warningReached, token.limitReached),
                      width: `${Math.min(100, token.percentUsed)}%`
                    }}
                  />
                </div>
                <div style={styles.resetInfo}>
                  Period: {token.periodType || 'monthly'} | Resets: {formatDate(token.resetAt)}
                </div>
              </div>

              {/* Edit Form */}
              {editingToken === token.tokenId ? (
                <div style={styles.limitSettings}>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Hard Limit (USD)</label>
                    <input
                      type="number"
                      style={styles.input}
                      value={editForm.hardLimit}
                      onChange={(e) => setEditForm({ ...editForm, hardLimit: e.target.value })}
                      placeholder="e.g. 100"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Warning Threshold (USD)</label>
                    <input
                      type="number"
                      style={styles.input}
                      value={editForm.warningLimit}
                      onChange={(e) => setEditForm({ ...editForm, warningLimit: e.target.value })}
                      placeholder="e.g. 80"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Period</label>
                    <select
                      style={styles.select}
                      value={editForm.periodType}
                      onChange={(e) => setEditForm({ ...editForm, periodType: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div style={styles.inputGroup}>
                    <label style={styles.label}>Auto-disable</label>
                    <label style={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={editForm.autoDisable}
                        onChange={(e) => setEditForm({ ...editForm, autoDisable: e.target.checked })}
                      />
                      Disable token when limit reached
                    </label>
                  </div>
                  <div style={{ ...styles.buttonGroup, gridColumn: '1 / -1' }}>
                    <button
                      style={{ ...styles.button, ...styles.buttonPrimary }}
                      onClick={() => handleSaveLimit(token.tokenId)}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save Limit'}
                    </button>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary }}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={styles.buttonGroup}>
                  <button
                    style={{ ...styles.button, ...styles.buttonPrimary }}
                    onClick={() => handleEditClick(token)}
                  >
                    {token.limit ? 'Edit Limit' : 'Set Limit'}
                  </button>
                  {token.currentSpend > 0 && (
                    <button
                      style={{ ...styles.button, ...styles.buttonDanger }}
                      onClick={() => handleResetSpending(token.tokenId)}
                    >
                      Reset Spending
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SpendingLimits;
