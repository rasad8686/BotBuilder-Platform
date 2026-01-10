/**
 * Seller Earnings Page
 * View earnings, request payouts, and manage payout settings
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const SellerEarnings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [earnings, setEarnings] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [requesting, setRequesting] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchData();
  }, [token, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchEarnings(), fetchPayouts()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/seller/earnings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEarnings(data);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const fetchPayouts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/marketplace/seller/payouts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setPayouts(data.payouts || []);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) {
      alert(t('seller.invalidAmount', 'Please enter a valid amount'));
      return;
    }

    if (amount > (earnings?.summary?.available || 0)) {
      alert(t('seller.insufficientBalance', 'Insufficient available balance'));
      return;
    }

    try {
      setRequesting(true);
      const response = await fetch(`${API_URL}/api/marketplace/seller/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount })
      });

      const data = await response.json();
      if (data.success) {
        alert(t('seller.payoutRequested', 'Payout requested successfully!'));
        setShowPayoutModal(false);
        setPayoutAmount('');
        fetchData();
      } else {
        alert(data.error || 'Failed to request payout');
      }
    } catch (error) {
      alert('Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { bg: '#d1fae5', color: '#065f46' },
      pending: { bg: '#fef3c7', color: '#92400e' },
      processing: { bg: '#dbeafe', color: '#1e40af' },
      failed: { bg: '#fee2e2', color: '#991b1b' }
    };
    const s = styles[status] || styles.pending;
    return (
      <span style={{
        padding: '4px 10px',
        backgroundColor: s.bg,
        color: s.color,
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: '500',
        textTransform: 'capitalize'
      }}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <button style={styles.backButton} onClick={() => navigate('/seller/dashboard')}>
            ← {t('seller.backToDashboard', 'Back to Dashboard')}
          </button>
          <h1 style={styles.title}>{t('seller.earnings', 'Earnings')}</h1>
        </div>
      </header>

      {/* Summary Cards */}
      <div style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>{t('seller.available', 'Available Balance')}</span>
          <span style={styles.summaryValue}>${earnings?.summary?.available?.toFixed(2) || '0.00'}</span>
          <button
            style={styles.withdrawButton}
            onClick={() => setShowPayoutModal(true)}
            disabled={!earnings?.summary?.available || earnings.summary.available <= 0}
          >
            {t('seller.requestPayout', 'Request Payout')}
          </button>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>{t('seller.pending', 'Pending')}</span>
          <span style={styles.summaryValueSmall}>${earnings?.summary?.pending?.toFixed(2) || '0.00'}</span>
          <span style={styles.summaryHint}>{t('seller.pendingHint', 'Awaiting payment confirmation')}</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>{t('seller.totalEarned', 'Total Earned')}</span>
          <span style={styles.summaryValueSmall}>${earnings?.summary?.total_net?.toFixed(2) || '0.00'}</span>
          <span style={styles.summaryHint}>{t('seller.afterFees', 'After platform fees')}</span>
        </div>
        <div style={styles.summaryCard}>
          <span style={styles.summaryLabel}>{t('seller.paidOut', 'Paid Out')}</span>
          <span style={styles.summaryValueSmall}>${earnings?.summary?.paid?.toFixed(2) || '0.00'}</span>
        </div>
      </div>

      {/* Tabs */}
      <nav style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'overview' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('overview')}
        >
          {t('seller.overview', 'Overview')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'transactions' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('transactions')}
        >
          {t('seller.transactions', 'Transactions')}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'payouts' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('payouts')}
        >
          {t('seller.payoutHistory', 'Payout History')}
        </button>
      </nav>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={styles.content}>
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('seller.monthlyEarnings', 'Monthly Earnings')}</h2>
            {earnings?.monthlyEarnings?.length > 0 ? (
              <div style={styles.chartContainer}>
                {earnings.monthlyEarnings.map((month, idx) => (
                  <div key={idx} style={styles.chartBar}>
                    <div
                      style={{
                        ...styles.bar,
                        height: `${Math.min(100, (month.amount / Math.max(...earnings.monthlyEarnings.map(m => m.amount))) * 100)}%`
                      }}
                    />
                    <span style={styles.barLabel}>
                      {new Date(month.month).toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span style={styles.barValue}>${parseFloat(month.amount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.noData}>{t('seller.noEarningsYet', 'No earnings yet')}</p>
            )}
          </section>

          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>{t('seller.platformFees', 'Platform Fee Structure')}</h2>
            <div style={styles.feeInfo}>
              <div style={styles.feeRow}>
                <span>{t('seller.standardFee', 'Standard Fee')}</span>
                <span style={styles.feeValue}>30%</span>
              </div>
              <p style={styles.feeDesc}>
                {t('seller.feeDesc', 'We take 30% of each sale to cover payment processing, hosting, and marketplace services.')}
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div style={styles.content}>
          <h2 style={styles.sectionTitle}>{t('seller.recentTransactions', 'Recent Transactions')}</h2>
          {earnings?.recentEarnings?.length > 0 ? (
            <div style={styles.transactionsList}>
              {earnings.recentEarnings.map(earning => (
                <div key={earning.id} style={styles.transactionRow}>
                  <div style={styles.transactionInfo}>
                    <span style={styles.transactionItem}>{earning.item_name}</span>
                    <span style={styles.transactionDate}>
                      {new Date(earning.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={styles.transactionAmounts}>
                    <span style={styles.grossAmount}>${earning.gross_amount.toFixed(2)}</span>
                    <span style={styles.feeAmount}>-${earning.platform_fee.toFixed(2)} fee</span>
                    <span style={styles.netAmount}>+${earning.net_amount.toFixed(2)}</span>
                  </div>
                  {getStatusBadge(earning.status)}
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>
              <p>{t('seller.noTransactions', 'No transactions yet')}</p>
            </div>
          )}
        </div>
      )}

      {/* Payouts Tab */}
      {activeTab === 'payouts' && (
        <div style={styles.content}>
          <h2 style={styles.sectionTitle}>{t('seller.payoutHistory', 'Payout History')}</h2>
          {payouts.length > 0 ? (
            <div style={styles.payoutsList}>
              {payouts.map(payout => (
                <div key={payout.id} style={styles.payoutRow}>
                  <div style={styles.payoutInfo}>
                    <span style={styles.payoutAmount}>${payout.amount.toFixed(2)}</span>
                    <span style={styles.payoutMethod}>{payout.payout_method}</span>
                  </div>
                  <div style={styles.payoutMeta}>
                    <span style={styles.payoutDate}>
                      {new Date(payout.created_at).toLocaleDateString()}
                    </span>
                    {payout.payout_reference && (
                      <span style={styles.payoutRef}>Ref: {payout.payout_reference}</span>
                    )}
                  </div>
                  {getStatusBadge(payout.status)}
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.empty}>
              <p>{t('seller.noPayouts', 'No payouts yet')}</p>
            </div>
          )}
        </div>
      )}

      {/* Payout Modal */}
      {showPayoutModal && (
        <div style={styles.modalOverlay} onClick={() => setShowPayoutModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{t('seller.requestPayout', 'Request Payout')}</h2>
              <button style={styles.closeButton} onClick={() => setShowPayoutModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.availableBalance}>
                <span>{t('seller.availableBalance', 'Available Balance')}</span>
                <span style={styles.balanceAmount}>${earnings?.summary?.available?.toFixed(2) || '0.00'}</span>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('seller.payoutAmount', 'Payout Amount')}</label>
                <div style={styles.amountInput}>
                  <span style={styles.currencySymbol}>$</span>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    style={styles.input}
                    placeholder="0.00"
                    min="0"
                    max={earnings?.summary?.available || 0}
                    step="0.01"
                  />
                </div>
                <button
                  style={styles.maxButton}
                  onClick={() => setPayoutAmount(earnings?.summary?.available?.toFixed(2) || '0')}
                >
                  {t('seller.withdrawAll', 'Withdraw All')}
                </button>
              </div>

              <p style={styles.payoutNote}>
                {t('seller.payoutNote', 'Payouts are typically processed within 3-5 business days.')}
              </p>

              <button
                style={styles.confirmButton}
                onClick={handleRequestPayout}
                disabled={requesting || !payoutAmount || parseFloat(payoutAmount) <= 0}
              >
                {requesting
                  ? t('common.processing', 'Processing...')
                  : t('seller.confirmPayout', 'Confirm Payout')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '100px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  header: {
    marginBottom: '32px'
  },
  backButton: {
    padding: '0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '14px',
    cursor: 'pointer',
    marginBottom: '8px'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  summaryCard: {
    padding: '24px',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    textAlign: 'center'
  },
  summaryLabel: {
    display: 'block',
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  summaryValue: {
    display: 'block',
    fontSize: '32px',
    fontWeight: '700',
    color: '#10b981',
    marginBottom: '16px'
  },
  summaryValueSmall: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  summaryHint: {
    display: 'block',
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '8px'
  },
  withdrawButton: {
    padding: '10px 20px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px'
  },
  tab: {
    padding: '12px 24px',
    backgroundColor: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#3b82f6'
  },
  content: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px'
  },
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  chartContainer: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: '200px',
    padding: '20px 0'
  },
  chartBar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    height: '100%'
  },
  bar: {
    width: '40px',
    backgroundColor: '#10b981',
    borderRadius: '4px 4px 0 0',
    marginTop: 'auto'
  },
  barLabel: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#6b7280'
  },
  barValue: {
    fontSize: '11px',
    color: '#374151',
    fontWeight: '500'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '40px'
  },
  feeInfo: {
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px'
  },
  feeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  feeValue: {
    fontWeight: '600',
    color: '#1a1a2e'
  },
  feeDesc: {
    margin: 0,
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.6'
  },
  transactionsList: {},
  transactionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  transactionInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  transactionItem: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a2e'
  },
  transactionDate: {
    fontSize: '12px',
    color: '#6b7280'
  },
  transactionAmounts: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end'
  },
  grossAmount: {
    fontSize: '13px',
    color: '#6b7280'
  },
  feeAmount: {
    fontSize: '12px',
    color: '#ef4444'
  },
  netAmount: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#10b981'
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280'
  },
  payoutsList: {},
  payoutRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 0',
    borderBottom: '1px solid #e5e7eb'
  },
  payoutInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  payoutAmount: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  payoutMethod: {
    fontSize: '13px',
    color: '#6b7280',
    textTransform: 'capitalize'
  },
  payoutMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end'
  },
  payoutDate: {
    fontSize: '13px',
    color: '#6b7280'
  },
  payoutRef: {
    fontSize: '11px',
    color: '#9ca3af'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '100%',
    maxWidth: '400px'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600'
  },
  closeButton: {
    width: '32px',
    height: '32px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '20px',
    cursor: 'pointer'
  },
  modalBody: {
    padding: '24px'
  },
  availableBalance: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  balanceAmount: {
    fontWeight: '600',
    color: '#10b981'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  amountInput: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  currencySymbol: {
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    color: '#6b7280'
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '16px',
    border: 'none',
    outline: 'none'
  },
  maxButton: {
    marginTop: '8px',
    padding: '0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#3b82f6',
    fontSize: '13px',
    cursor: 'pointer'
  },
  payoutNote: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '20px'
  },
  confirmButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};

export default SellerEarnings;
