import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '16px',
    cursor: 'pointer',
    background: 'none',
    border: 'none'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px'
  },
  titleSection: {},
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  badgeActive: {
    background: '#d1fae5',
    color: '#059669'
  },
  badgeDraft: {
    background: '#f3f4f6',
    color: '#6b7280'
  },
  badgePending: {
    background: '#fef3c7',
    color: '#92400e'
  },
  badgeExpired: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
    marginTop: '8px'
  },
  actions: {
    display: 'flex',
    gap: '8px'
  },
  actionButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    border: 'none'
  },
  signButton: {
    background: '#10b981',
    color: '#fff'
  },
  amendButton: {
    background: '#3b82f6',
    color: '#fff'
  },
  pdfButton: {
    background: '#f3f4f6',
    color: '#374151'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '24px'
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '24px'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '16px'
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6'
  },
  label: {
    color: '#6b7280',
    fontSize: '14px'
  },
  value: {
    color: '#1a1a2e',
    fontSize: '14px',
    fontWeight: '500'
  },
  moneyValue: {
    color: '#059669',
    fontSize: '18px',
    fontWeight: '700'
  },
  section: {
    marginTop: '24px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '16px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    background: '#f9fafb',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb'
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  progressBar: {
    height: '8px',
    background: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px'
  },
  progressFill: {
    height: '100%',
    background: '#3b82f6',
    borderRadius: '4px'
  }
};

const ContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchContract = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprise/contracts/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContract(data.data);
      }
    } catch (error) {
      console.error('Error fetching contract:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  const handleSign = async () => {
    if (!window.confirm('Are you sure you want to sign this contract?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprise/contracts/${id}/sign`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Contract signed successfully!');
        fetchContract();
      }
    } catch (error) {
      console.error('Error signing contract:', error);
    }
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

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  const getStatusBadge = (status) => {
    const badgeStyles = {
      active: styles.badgeActive,
      draft: styles.badgeDraft,
      pending: styles.badgePending,
      expired: styles.badgeExpired
    };
    return { ...styles.badge, ...(badgeStyles[status] || styles.badgeDraft) };
  };

  const calculateProgress = () => {
    if (!contract) return 0;
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    const now = new Date();
    const total = end - start;
    const elapsed = now - start;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading contract...</div></div>;
  }

  if (!contract) {
    return <div style={styles.container}><div style={styles.loading}>Contract not found</div></div>;
  }

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={() => navigate('/enterprise/contracts')}>
        Back to Contracts
      </button>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleSection}>
          <h1 style={styles.title}>
            {contract.contract_number}
            <span style={getStatusBadge(contract.status)}>
              {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
            </span>
          </h1>
          <p style={styles.subtitle}>
            {contract.organization_name} - Created {formatDate(contract.created_at)}
          </p>
        </div>
        <div style={styles.actions}>
          {(contract.status === 'draft' || contract.status === 'pending') && (
            <button style={{...styles.actionButton, ...styles.signButton}} onClick={handleSign}>
              Sign Contract
            </button>
          )}
          {contract.status === 'active' && (
            <button style={{...styles.actionButton, ...styles.amendButton}} onClick={() => navigate(`/enterprise/contracts/${id}/amend`)}>
              Create Amendment
            </button>
          )}
          <button style={{...styles.actionButton, ...styles.pdfButton}}>
            Download PDF
          </button>
        </div>
      </div>

      {/* Content Grid */}
      <div style={styles.grid}>
        {/* Main Info */}
        <div>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Contract Details</h3>
            <div style={styles.row}>
              <span style={styles.label}>Contract Term</span>
              <span style={styles.value}>{formatDate(contract.start_date)} - {formatDate(contract.end_date)}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Auto Renew</span>
              <span style={styles.value}>{contract.auto_renew ? 'Yes' : 'No'}</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Payment Terms</span>
              <span style={styles.value}>NET {contract.payment_terms}</span>
            </div>
            {contract.signed_at && (
              <div style={styles.row}>
                <span style={styles.label}>Signed By</span>
                <span style={styles.value}>{contract.signed_by} on {formatDate(contract.signed_at)}</span>
              </div>
            )}

            {/* Progress */}
            <div style={{marginTop: '16px'}}>
              <div style={styles.label}>Contract Progress</div>
              <div style={styles.progressBar}>
                <div style={{...styles.progressFill, width: `${calculateProgress()}%`}} />
              </div>
              <div style={{fontSize: '12px', color: '#6b7280', marginTop: '4px'}}>
                {Math.round(calculateProgress())}% complete
              </div>
            </div>
          </div>

          {/* Included Resources */}
          <div style={{...styles.card, marginTop: '16px'}}>
            <h3 style={styles.cardTitle}>Included Resources</h3>
            <div style={styles.row}>
              <span style={styles.label}>API Requests</span>
              <span style={styles.value}>{formatNumber(contract.included_requests)}/month</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Storage</span>
              <span style={styles.value}>{contract.included_storage_gb} GB</span>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Seats</span>
              <span style={styles.value}>{contract.included_seats} users</span>
            </div>
          </div>

          {/* Invoices */}
          {contract.invoices && contract.invoices.length > 0 && (
            <div style={{...styles.card, marginTop: '16px'}}>
              <h3 style={styles.cardTitle}>Recent Invoices</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Invoice #</th>
                    <th style={styles.th}>Period</th>
                    <th style={styles.th}>Amount</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.invoices.slice(0, 5).map(invoice => (
                    <tr key={invoice.id}>
                      <td style={styles.td}>{invoice.invoice_number}</td>
                      <td style={styles.td}>{formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}</td>
                      <td style={styles.td}>{formatCurrency(invoice.total)}</td>
                      <td style={styles.td}>
                        <span style={getStatusBadge(invoice.status)}>
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Pricing</h3>
            <div style={{textAlign: 'center', padding: '16px 0'}}>
              <div style={styles.moneyValue}>{formatCurrency(contract.annual_value)}</div>
              <div style={styles.label}>Annual Value</div>
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Monthly</span>
              <span style={styles.value}>{formatCurrency(contract.monthly_value)}</span>
            </div>
            {contract.discount_percentage > 0 && (
              <div style={styles.row}>
                <span style={styles.label}>Discount</span>
                <span style={{...styles.value, color: '#059669'}}>{contract.discount_percentage}%</span>
              </div>
            )}
          </div>

          {/* Amendments */}
          {contract.amendments && contract.amendments.length > 0 && (
            <div style={{...styles.card, marginTop: '16px'}}>
              <h3 style={styles.cardTitle}>Amendments ({contract.amendments.length})</h3>
              {contract.amendments.slice(0, 3).map(amendment => (
                <div key={amendment.id} style={{padding: '12px 0', borderBottom: '1px solid #f3f4f6'}}>
                  <div style={{fontWeight: '500', fontSize: '14px'}}>{amendment.amendment_type}</div>
                  <div style={{fontSize: '12px', color: '#6b7280'}}>{amendment.description}</div>
                  <div style={{fontSize: '11px', color: '#9ca3af', marginTop: '4px'}}>
                    Effective: {formatDate(amendment.effective_date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractDetail;
