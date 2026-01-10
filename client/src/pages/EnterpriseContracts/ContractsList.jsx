import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
    marginTop: '4px'
  },
  createButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px'
  },
  table: {
    width: '100%',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    borderCollapse: 'collapse',
    overflow: 'hidden'
  },
  th: {
    background: '#f9fafb',
    padding: '14px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #e5e7eb'
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px',
    color: '#374151'
  },
  contractNumber: {
    fontWeight: '600',
    color: '#1a1a2e'
  },
  badge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  badgeDraft: {
    background: '#f3f4f6',
    color: '#6b7280'
  },
  badgePending: {
    background: '#fef3c7',
    color: '#92400e'
  },
  badgeActive: {
    background: '#d1fae5',
    color: '#059669'
  },
  badgeExpired: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  badgeCancelled: {
    background: '#fecaca',
    color: '#991b1b'
  },
  viewButton: {
    padding: '6px 12px',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#374151',
    cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '8px'
  },
  emptyText: {
    color: '#6b7280',
    marginBottom: '20px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  value: {
    fontWeight: '600',
    color: '#059669'
  }
};

const ContractsList = () => {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const navigate = useNavigate();

  const fetchContracts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/enterprise/contracts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/enterprise/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
    fetchSummary();
  }, [fetchContracts, fetchSummary]);

  const getStatusBadge = (status) => {
    const badgeStyles = {
      draft: styles.badgeDraft,
      pending: styles.badgePending,
      active: styles.badgeActive,
      expired: styles.badgeExpired,
      cancelled: styles.badgeCancelled
    };
    return { ...styles.badge, ...(badgeStyles[status] || styles.badgeDraft) };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading contracts...</div></div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Enterprise Contracts</h1>
          <p style={styles.subtitle}>Manage your enterprise agreements and billing</p>
        </div>
        <button style={styles.createButton} onClick={() => navigate('/enterprise/contracts/new')}>
          + New Contract
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{formatCurrency(summary.contract?.annual_value)}</div>
            <div style={styles.statLabel}>Annual Contract Value</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{summary.daysUntilRenewal || '-'}</div>
            <div style={styles.statLabel}>Days Until Renewal</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{formatCurrency(summary.invoiceSummary?.totalPaid)}</div>
            <div style={styles.statLabel}>Total Paid</div>
          </div>
          <div style={styles.statCard}>
            <div style={{...styles.statValue, color: summary.invoiceSummary?.overdueCount > 0 ? '#dc2626' : '#059669'}}>
              {summary.invoiceSummary?.overdueCount || 0}
            </div>
            <div style={styles.statLabel}>Overdue Invoices</div>
          </div>
        </div>
      )}

      {/* Contracts Table */}
      {contracts.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>No contracts yet</div>
          <p style={styles.emptyText}>Create your first enterprise contract to get started</p>
          <button style={styles.createButton} onClick={() => navigate('/enterprise/contracts/new')}>
            Create Contract
          </button>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Contract #</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Annual Value</th>
              <th style={styles.th}>Start Date</th>
              <th style={styles.th}>End Date</th>
              <th style={styles.th}>Invoices</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(contract => (
              <tr key={contract.id}>
                <td style={styles.td}>
                  <span style={styles.contractNumber}>{contract.contract_number}</span>
                </td>
                <td style={styles.td}>
                  <span style={getStatusBadge(contract.status)}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.value}>{formatCurrency(contract.annual_value)}</span>
                </td>
                <td style={styles.td}>{formatDate(contract.start_date)}</td>
                <td style={styles.td}>{formatDate(contract.end_date)}</td>
                <td style={styles.td}>{contract.invoice_count || 0}</td>
                <td style={styles.td}>
                  <button
                    style={styles.viewButton}
                    onClick={() => navigate(`/enterprise/contracts/${contract.id}`)}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ContractsList;
