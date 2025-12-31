import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginEarnings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState(null);
  const [payoutInfo, setPayoutInfo] = useState(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    payout_method: 'paypal',
    paypal_email: '',
    bank_name: '',
    bank_account_last4: '',
    bank_routing: ''
  });
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchEarnings(),
        fetchPayoutInfo()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/plugins/developer/earnings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setEarnings(data);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const fetchPayoutInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/plugins/developer/payout-info`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPayoutInfo(data);
        if (data.payoutInfo) {
          setPayoutForm(prev => ({
            ...prev,
            payout_method: data.payoutInfo.payout_method || 'paypal',
            paypal_email: data.payoutInfo.paypal_email || ''
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching payout info:', error);
    }
  };

  const handleRequestPayout = async () => {
    if (!payoutInfo?.hasPayoutInfo) {
      setShowSetupModal(true);
      return;
    }

    if (!payoutInfo?.canRequestPayout) {
      setMessage({
        type: 'error',
        text: `Minimum payout amount is $${payoutInfo?.minimumPayout || 50}`
      });
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/developer/payout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Payout requested successfully!' });
        fetchData();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to request payout' });
    } finally {
      setRequesting(false);
    }
  };

  const handleSavePayoutInfo = async () => {
    setRequesting(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/developer/payout-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payoutForm)
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Payout information saved!' });
        setShowSetupModal(false);
        fetchPayoutInfo();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save payout information' });
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="earnings-loading">
        <div className="spinner"></div>
        <p>Loading earnings...</p>
      </div>
    );
  }

  return (
    <div className="plugin-earnings-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Developer Earnings</h1>
          <p>Track your plugin revenue and manage payouts</p>
        </div>
        <button className="btn-developer" onClick={() => navigate('/plugins/developer')}>
          Developer Portal &#8594;
        </button>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card total">
          <div className="card-icon">&#128176;</div>
          <div className="card-content">
            <span className="card-value">{formatCurrency(earnings?.summary?.total_earned)}</span>
            <span className="card-label">Total Earned</span>
          </div>
        </div>

        <div className="summary-card pending">
          <div className="card-icon">&#9200;</div>
          <div className="card-content">
            <span className="card-value">{formatCurrency(earnings?.summary?.pending_balance)}</span>
            <span className="card-label">Pending Balance</span>
          </div>
        </div>

        <div className="summary-card paid">
          <div className="card-icon">&#9989;</div>
          <div className="card-content">
            <span className="card-value">{formatCurrency(earnings?.summary?.total_paid)}</span>
            <span className="card-label">Total Paid Out</span>
          </div>
        </div>

        <div className="summary-card rate">
          <div className="card-icon">&#128200;</div>
          <div className="card-content">
            <span className="card-value">70%</span>
            <span className="card-label">Revenue Share</span>
          </div>
        </div>
      </div>

      {/* Payout Section */}
      <div className="payout-section">
        <div className="payout-info">
          <h3>Request Payout</h3>
          <p>
            Available balance: <strong>{formatCurrency(earnings?.summary?.pending_balance)}</strong>
          </p>
          <p className="payout-note">
            Minimum payout: ${payoutInfo?.minimumPayout || 50}
            {payoutInfo?.nextPayoutDate && (
              <> | Next scheduled payout: {payoutInfo.nextPayoutDate}</>
            )}
          </p>
        </div>

        <div className="payout-actions">
          {!payoutInfo?.hasPayoutInfo && (
            <button className="btn-setup" onClick={() => setShowSetupModal(true)}>
              Setup Payout Method
            </button>
          )}
          <button
            className="btn-payout"
            onClick={handleRequestPayout}
            disabled={requesting || !payoutInfo?.canRequestPayout}
          >
            {requesting ? 'Processing...' : 'Request Payout'}
          </button>
        </div>
      </div>

      {/* Plugin Breakdown */}
      <div className="section">
        <h2>Earnings by Plugin</h2>
        {earnings?.byPlugin?.length > 0 ? (
          <div className="plugin-earnings-table">
            <table>
              <thead>
                <tr>
                  <th>Plugin</th>
                  <th>Sales</th>
                  <th>Earnings</th>
                </tr>
              </thead>
              <tbody>
                {earnings.byPlugin.map(plugin => (
                  <tr key={plugin.id}>
                    <td className="plugin-cell">
                      <div className="plugin-icon">
                        {plugin.icon_url ? (
                          <img src={plugin.icon_url} alt={plugin.name} />
                        ) : (
                          <span>&#129513;</span>
                        )}
                      </div>
                      <span>{plugin.name}</span>
                    </td>
                    <td>{plugin.sales}</td>
                    <td className="earnings-amount">{formatCurrency(plugin.earnings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No plugin earnings yet</p>
          </div>
        )}
      </div>

      {/* Monthly Breakdown */}
      <div className="section">
        <h2>Monthly Earnings</h2>
        {earnings?.monthly?.length > 0 ? (
          <div className="monthly-chart">
            {earnings.monthly.map((month, index) => (
              <div key={index} className="month-bar">
                <div
                  className="bar"
                  style={{
                    height: `${Math.min((month.earnings / Math.max(...earnings.monthly.map(m => m.earnings))) * 150, 150)}px`
                  }}
                >
                  <span className="bar-value">{formatCurrency(month.earnings)}</span>
                </div>
                <span className="month-label">
                  {new Date(month.month).toLocaleDateString('en-US', { month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No monthly data yet</p>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="section">
        <h2>Recent Transactions</h2>
        {earnings?.recentTransactions?.length > 0 ? (
          <div className="transactions-list">
            {earnings.recentTransactions.map(tx => (
              <div key={tx.id} className="transaction-item">
                <div className="tx-info">
                  <span className="tx-plugin">{tx.plugin_name}</span>
                  <span className="tx-buyer">Purchased by {tx.buyer_name}</span>
                </div>
                <div className="tx-details">
                  <span className="tx-amount">{formatCurrency(tx.amount)}</span>
                  <span className="tx-date">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </span>
                  <span className={`tx-status ${tx.status}`}>{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No transactions yet</p>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div className="section">
        <h2>Payout History</h2>
        {earnings?.payouts?.length > 0 ? (
          <div className="payouts-list">
            {earnings.payouts.map(payout => (
              <div key={payout.id} className="payout-item">
                <div className="payout-info">
                  <span className="payout-amount">{formatCurrency(payout.amount)}</span>
                  <span className="payout-method">{payout.payout_method}</span>
                </div>
                <div className="payout-meta">
                  <span className="payout-date">
                    {new Date(payout.created_at).toLocaleDateString()}
                  </span>
                  <span className={`payout-status ${payout.status}`}>{payout.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No payouts yet</p>
          </div>
        )}
      </div>

      {/* Payout Setup Modal */}
      {showSetupModal && (
        <div className="modal-overlay" onClick={() => setShowSetupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Setup Payout Method</h3>

            <div className="form-group">
              <label>Payout Method</label>
              <select
                value={payoutForm.payout_method}
                onChange={e => setPayoutForm(prev => ({ ...prev, payout_method: e.target.value }))}
              >
                <option value="paypal">PayPal</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>

            {payoutForm.payout_method === 'paypal' && (
              <div className="form-group">
                <label>PayPal Email</label>
                <input
                  type="email"
                  value={payoutForm.paypal_email}
                  onChange={e => setPayoutForm(prev => ({ ...prev, paypal_email: e.target.value }))}
                  placeholder="your@email.com"
                />
              </div>
            )}

            {payoutForm.payout_method === 'bank' && (
              <>
                <div className="form-group">
                  <label>Bank Name</label>
                  <input
                    type="text"
                    value={payoutForm.bank_name}
                    onChange={e => setPayoutForm(prev => ({ ...prev, bank_name: e.target.value }))}
                    placeholder="Bank name"
                  />
                </div>
                <div className="form-group">
                  <label>Account (Last 4 digits)</label>
                  <input
                    type="text"
                    value={payoutForm.bank_account_last4}
                    onChange={e => setPayoutForm(prev => ({ ...prev, bank_account_last4: e.target.value }))}
                    placeholder="1234"
                    maxLength={4}
                  />
                </div>
                <div className="form-group">
                  <label>Routing Number</label>
                  <input
                    type="text"
                    value={payoutForm.bank_routing}
                    onChange={e => setPayoutForm(prev => ({ ...prev, bank_routing: e.target.value }))}
                    placeholder="Routing number"
                  />
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowSetupModal(false)}>
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={handleSavePayoutInfo}
                disabled={requesting}
              >
                {requesting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .plugin-earnings-page {
          padding: 24px;
          min-height: 100vh;
          background: #f5f6fa;
        }

        .earnings-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-content h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          color: #1a1a2e;
        }

        .header-content p {
          margin: 0;
          color: #6b7280;
        }

        .btn-developer {
          padding: 12px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .message {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .message.success {
          background: #d1fae5;
          color: #059669;
        }

        .message.error {
          background: #fee2e2;
          color: #dc2626;
        }

        .message button {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: inherit;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .card-icon {
          font-size: 32px;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .summary-card.total .card-icon {
          background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
        }

        .summary-card.pending .card-icon {
          background: #fef3c720;
        }

        .summary-card.paid .card-icon {
          background: #d1fae520;
        }

        .summary-card.rate .card-icon {
          background: #dbeafe20;
        }

        .card-value {
          display: block;
          font-size: 24px;
          font-weight: 700;
          color: #1a1a2e;
        }

        .card-label {
          font-size: 14px;
          color: #6b7280;
        }

        .payout-section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .payout-info h3 {
          margin: 0 0 8px 0;
          color: #1a1a2e;
        }

        .payout-info p {
          margin: 0 0 4px 0;
          color: #6b7280;
        }

        .payout-note {
          font-size: 13px;
          color: #9ca3af;
        }

        .payout-actions {
          display: flex;
          gap: 12px;
        }

        .btn-setup,
        .btn-payout {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-setup {
          background: #f3f4f6;
          color: #4b5563;
        }

        .btn-payout {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }

        .btn-payout:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .section {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .section h2 {
          margin: 0 0 20px 0;
          font-size: 18px;
          color: #1a1a2e;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .plugin-earnings-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .plugin-earnings-table th {
          text-align: left;
          padding: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          border-bottom: 1px solid #e5e7eb;
        }

        .plugin-earnings-table td {
          padding: 16px 12px;
          border-bottom: 1px solid #f3f4f6;
        }

        .plugin-cell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .plugin-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .plugin-icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .plugin-icon span {
          color: white;
        }

        .earnings-amount {
          font-weight: 600;
          color: #10b981;
        }

        .monthly-chart {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          height: 200px;
          padding-top: 30px;
        }

        .month-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .bar {
          width: 100%;
          background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
          border-radius: 4px 4px 0 0;
          position: relative;
          min-height: 4px;
        }

        .bar-value {
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 11px;
          color: #6b7280;
          white-space: nowrap;
        }

        .month-label {
          margin-top: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        .transactions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transaction-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .tx-plugin {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
        }

        .tx-buyer {
          font-size: 13px;
          color: #6b7280;
        }

        .tx-details {
          text-align: right;
        }

        .tx-amount {
          display: block;
          font-weight: 600;
          color: #10b981;
        }

        .tx-date {
          font-size: 12px;
          color: #9ca3af;
          margin-right: 8px;
        }

        .tx-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .tx-status.pending {
          background: #fef3c7;
          color: #d97706;
        }

        .tx-status.paid {
          background: #d1fae5;
          color: #059669;
        }

        .payouts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .payout-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .payout-amount {
          display: block;
          font-weight: 600;
          color: #1a1a2e;
        }

        .payout-method {
          font-size: 13px;
          color: #6b7280;
          text-transform: capitalize;
        }

        .payout-meta {
          text-align: right;
        }

        .payout-date {
          font-size: 12px;
          color: #9ca3af;
          display: block;
        }

        .payout-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .payout-status.pending {
          background: #fef3c7;
          color: #d97706;
        }

        .payout-status.completed {
          background: #d1fae5;
          color: #059669;
        }

        .payout-status.failed {
          background: #fee2e2;
          color: #dc2626;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
        }

        .modal-content h3 {
          margin: 0 0 20px 0;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
          color: #1a1a2e;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .btn-cancel,
        .btn-save {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-cancel {
          background: #f3f4f6;
          color: #4b5563;
        }

        .btn-save {
          background: #667eea;
          color: white;
        }

        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }

          .payout-section {
            flex-direction: column;
            gap: 16px;
            text-align: center;
          }

          .payout-actions {
            width: 100%;
            flex-direction: column;
          }

          .monthly-chart {
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default PluginEarnings;
