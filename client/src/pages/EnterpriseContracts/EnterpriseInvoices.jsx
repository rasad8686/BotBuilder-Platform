import React, { useState, useEffect, useCallback } from 'react';

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
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  statLabel: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '4px'
  },
  filters: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px'
  },
  filterButton: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '14px',
    cursor: 'pointer'
  },
  filterButtonActive: {
    background: '#3b82f6',
    color: '#fff',
    borderColor: '#3b82f6'
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
  invoiceNumber: {
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
  badgeSent: {
    background: '#dbeafe',
    color: '#1d4ed8'
  },
  badgePaid: {
    background: '#d1fae5',
    color: '#059669'
  },
  badgeOverdue: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  actionButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
    marginRight: '8px'
  },
  viewButton: {
    background: '#f3f4f6',
    color: '#374151'
  },
  payButton: {
    background: '#10b981',
    color: '#fff'
  },
  sendButton: {
    background: '#3b82f6',
    color: '#fff'
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
    color: '#6b7280'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: '#fff',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#1a1a2e'
  },
  invoiceDetail: {
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '16px',
    marginBottom: '16px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    fontSize: '14px'
  },
  detailLabel: {
    color: '#6b7280'
  },
  detailValue: {
    color: '#1a1a2e',
    fontWeight: '500'
  },
  lineItem: {
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6'
  },
  totalSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '2px solid #e5e7eb'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  closeButton: {
    padding: '10px 20px',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '20px'
  }
};

const EnterpriseInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [stats, setStats] = useState({ total: 0, paid: 0, pending: 0, overdue: 0 });

  const fetchInvoices = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/enterprise/invoices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const allInvoices = data.data || [];
        setInvoices(allInvoices);

        // Calculate stats
        const totalAmount = allInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
        const paidAmount = allInvoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
        const pendingAmount = allInvoices.filter(i => i.status === 'sent' || i.status === 'draft').reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
        const overdueAmount = allInvoices.filter(i => i.status === 'overdue').reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);

        setStats({
          total: totalAmount,
          paid: paidAmount,
          pending: pendingAmount,
          overdue: overdueAmount
        });
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleMarkPaid = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprise/invoices/${invoiceId}/pay`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchInvoices();
        setSelectedInvoice(null);
      }
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprise/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Invoice sent successfully');
        fetchInvoices();
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
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

  const getStatusBadge = (status) => {
    const badgeStyles = {
      draft: styles.badgeDraft,
      sent: styles.badgeSent,
      paid: styles.badgePaid,
      overdue: styles.badgeOverdue
    };
    return { ...styles.badge, ...(badgeStyles[status] || styles.badgeDraft) };
  };

  const filteredInvoices = filter === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === filter);

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading invoices...</div></div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Enterprise Invoices</h1>
          <p style={styles.subtitle}>View and manage your enterprise billing</p>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{formatCurrency(stats.total)}</div>
          <div style={styles.statLabel}>Total Invoiced</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#059669'}}>{formatCurrency(stats.paid)}</div>
          <div style={styles.statLabel}>Paid</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#3b82f6'}}>{formatCurrency(stats.pending)}</div>
          <div style={styles.statLabel}>Pending</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#dc2626'}}>{formatCurrency(stats.overdue)}</div>
          <div style={styles.statLabel}>Overdue</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filters}>
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button
            key={f}
            style={{
              ...styles.filterButton,
              ...(filter === f ? styles.filterButtonActive : {})
            }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>No invoices found</div>
          <p style={styles.emptyText}>
            {filter === 'all' ? 'Invoices will appear here once generated' : `No ${filter} invoices`}
          </p>
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Invoice #</th>
              <th style={styles.th}>Contract</th>
              <th style={styles.th}>Period</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Due Date</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(invoice => (
              <tr key={invoice.id}>
                <td style={styles.td}>
                  <span style={styles.invoiceNumber}>{invoice.invoice_number}</span>
                </td>
                <td style={styles.td}>{invoice.contract_number}</td>
                <td style={styles.td}>
                  {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                </td>
                <td style={styles.td}>{formatCurrency(invoice.total)}</td>
                <td style={styles.td}>{formatDate(invoice.due_date)}</td>
                <td style={styles.td}>
                  <span style={getStatusBadge(invoice.status)}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </span>
                </td>
                <td style={styles.td}>
                  <button
                    style={{...styles.actionButton, ...styles.viewButton}}
                    onClick={() => setSelectedInvoice(invoice)}
                  >
                    View
                  </button>
                  {invoice.status === 'draft' && (
                    <button
                      style={{...styles.actionButton, ...styles.sendButton}}
                      onClick={() => handleSendInvoice(invoice.id)}
                    >
                      Send
                    </button>
                  )}
                  {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                    <button
                      style={{...styles.actionButton, ...styles.payButton}}
                      onClick={() => handleMarkPaid(invoice.id)}
                    >
                      Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div style={styles.modal} onClick={() => setSelectedInvoice(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Invoice {selectedInvoice.invoice_number}</h2>

            <div style={styles.invoiceDetail}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Contract</span>
                <span style={styles.detailValue}>{selectedInvoice.contract_number}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Period</span>
                <span style={styles.detailValue}>
                  {formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}
                </span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Due Date</span>
                <span style={styles.detailValue}>{formatDate(selectedInvoice.due_date)}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Status</span>
                <span style={getStatusBadge(selectedInvoice.status)}>
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            {/* Line Items */}
            <h3 style={{fontSize: '16px', fontWeight: '600', marginBottom: '12px'}}>Line Items</h3>
            {(selectedInvoice.line_items || []).map((item, i) => (
              <div key={i} style={styles.lineItem}>
                <div>{item.description}</div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '13px', color: '#6b7280'}}>
                  <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                  <span>{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}

            <div style={styles.totalSection}>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Subtotal</span>
                <span style={styles.detailValue}>{formatCurrency(selectedInvoice.subtotal)}</span>
              </div>
              <div style={styles.detailRow}>
                <span style={styles.detailLabel}>Tax</span>
                <span style={styles.detailValue}>{formatCurrency(selectedInvoice.tax)}</span>
              </div>
              <div style={styles.totalRow}>
                <span>Total</span>
                <span>{formatCurrency(selectedInvoice.total)}</span>
              </div>
            </div>

            <button style={styles.closeButton} onClick={() => setSelectedInvoice(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterpriseInvoices;
