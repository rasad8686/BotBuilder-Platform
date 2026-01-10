import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link2, Bot, HardDrive, Radio } from 'lucide-react';

const API_BASE = '/api/billing';

const USAGE_TYPES = {
  apiRequests: { label: 'API Requests', Icon: Link2, unit: 'requests', color: '#3b82f6' },
  aiTokens: { label: 'AI Tokens', Icon: Bot, unit: 'tokens', color: '#8b5cf6' },
  storageGb: { label: 'Storage', Icon: HardDrive, unit: 'GB', color: '#10b981' },
  bandwidthGb: { label: 'Bandwidth', Icon: Radio, unit: 'GB', color: '#f59e0b' }
};

const ALERT_TYPES = [
  { value: 'api_requests', label: 'API Requests' },
  { value: 'ai_tokens', label: 'AI Tokens' },
  { value: 'storage_gb', label: 'Storage (GB)' },
  { value: 'bandwidth_gb', label: 'Bandwidth (GB)' },
  { value: 'total_cost', label: 'Total Cost ($)' }
];

function UsageBilling() {
  const [activeTab, setActiveTab] = useState('current');
  const [currentUsage, setCurrentUsage] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [history, setHistory] = useState([]);
  const [tiers, setTiers] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Alert form state
  const [alertForm, setAlertForm] = useState({
    alertType: 'total_cost',
    threshold: 100
  });

  // Real-time cost ticker
  const [displayCost, setDisplayCost] = useState(0);

  // Fetch current usage
  const fetchCurrentUsage = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/usage/current`);
      setCurrentUsage(response.data.data);
    } catch (err) {
      setError('Failed to load current usage');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch estimate
  const fetchEstimate = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/usage/estimate`);
      setEstimate(response.data.data);
    } catch (err) {
      console.error('Failed to fetch estimate:', err);
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/usage/history`);
      setHistory(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  // Fetch tiers
  const fetchTiers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/tiers`);
      setTiers(response.data.data || {});
    } catch (err) {
      console.error('Failed to fetch tiers:', err);
    }
  }, []);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/invoices`);
      setInvoices(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    }
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/usage/alerts`);
      setAlerts(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUsage();
    fetchEstimate();
    fetchHistory();
    fetchTiers();
    fetchInvoices();
    fetchAlerts();
  }, [fetchCurrentUsage, fetchEstimate, fetchHistory, fetchTiers, fetchInvoices, fetchAlerts]);

  // Animate cost ticker
  useEffect(() => {
    if (currentUsage?.costs?.totalCost) {
      const target = currentUsage.costs.totalCost;
      const duration = 1000;
      const steps = 30;
      const increment = target / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current = Math.min(increment * step, target);
        setDisplayCost(current);

        if (step >= steps) {
          clearInterval(timer);
          setDisplayCost(target);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [currentUsage]);

  // Create alert
  const createAlert = async () => {
    try {
      await axios.post(`${API_BASE}/usage/alert`, alertForm);
      fetchAlerts();
      setAlertForm({ alertType: 'total_cost', threshold: 100 });
    } catch (err) {
      setError('Failed to create alert');
    }
  };

  // Delete alert
  const deleteAlert = async (alertId) => {
    try {
      await axios.delete(`${API_BASE}/usage/alert/${alertId}`);
      fetchAlerts();
    } catch (err) {
      setError('Failed to delete alert');
    }
  };

  // Download invoice
  const downloadInvoice = async (invoiceId) => {
    try {
      const response = await axios.get(`${API_BASE}/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${invoiceId}.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download invoice');
    }
  };

  // Calculate tier progress
  const getTierProgress = (unitType, currentValue) => {
    const unitTiers = tiers[unitType] || [];
    if (unitTiers.length === 0) return { current: null, next: null, progress: 0 };

    let currentTier = null;
    let nextTier = null;

    for (let i = 0; i < unitTiers.length; i++) {
      const tier = unitTiers[i];
      if (currentValue >= tier.minUnits && (tier.maxUnits === null || currentValue <= tier.maxUnits)) {
        currentTier = tier;
        nextTier = unitTiers[i + 1] || null;
        break;
      }
    }

    if (!currentTier) {
      currentTier = unitTiers[0];
      nextTier = unitTiers[1] || null;
    }

    const tierMin = currentTier.minUnits;
    const tierMax = currentTier.maxUnits || (nextTier?.minUnits || tierMin + 100000);
    const progress = ((currentValue - tierMin) / (tierMax - tierMin)) * 100;

    return {
      current: currentTier,
      next: nextTier,
      progress: Math.min(100, Math.max(0, progress))
    };
  };

  // Format number
  const formatNumber = (num, decimals = 0) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(decimals);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Usage-based Billing</h1>
        <p style={styles.subtitle}>Track usage, view costs, and manage billing alerts</p>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError(null)} style={styles.dismissBtn}>Dismiss</button>
        </div>
      )}

      {/* Cost Ticker */}
      <div style={styles.costTicker}>
        <div style={styles.costTickerContent}>
          <span style={styles.costLabel}>Current Period Cost</span>
          <span style={styles.costValue}>${displayCost.toFixed(2)}</span>
          {currentUsage?.daysRemaining > 0 && (
            <span style={styles.daysRemaining}>
              {currentUsage.daysRemaining} days remaining
            </span>
          )}
        </div>
        {estimate && (
          <div style={styles.estimateBox}>
            <span style={styles.estimateLabel}>Estimated End of Month</span>
            <span style={styles.estimateValue}>${estimate.estimatedCost?.toFixed(2) || '0.00'}</span>
            <span style={{
              ...styles.confidenceBadge,
              backgroundColor: estimate.confidence === 'high' ? '#dcfce7' : estimate.confidence === 'medium' ? '#fef3c7' : '#fee2e2',
              color: estimate.confidence === 'high' ? '#16a34a' : estimate.confidence === 'medium' ? '#d97706' : '#dc2626'
            }}>
              {estimate.confidence} confidence
            </span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={styles.tabs}>
        {['current', 'breakdown', 'tiers', 'history', 'invoices', 'alerts'].map(tab => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.activeTab : {})
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Current Usage Tab */}
      {activeTab === 'current' && currentUsage && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Current Period Usage</h2>
          <p style={styles.periodText}>
            {currentUsage.period?.startDate} to {currentUsage.period?.endDate}
          </p>

          <div style={styles.usageGrid}>
            {Object.entries(USAGE_TYPES).map(([key, config]) => {
              const value = currentUsage.usage?.[key] || 0;
              const tierInfo = getTierProgress(
                key === 'apiRequests' ? 'request' :
                key === 'aiTokens' ? 'token' :
                key === 'storageGb' ? 'gb_storage' : 'gb_bandwidth',
                value
              );

              return (
                <div key={key} style={styles.usageCard}>
                  <div style={styles.usageHeader}>
                    <span style={styles.usageIcon}>{config.Icon && <config.Icon size={24} />}</span>
                    <span style={styles.usageLabel}>{config.label}</span>
                  </div>
                  <div style={styles.usageValue}>
                    {formatNumber(value, key.includes('Gb') ? 2 : 0)}
                    <span style={styles.usageUnit}> {config.unit}</span>
                  </div>
                  <div style={styles.tierProgress}>
                    <div style={styles.progressBar}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${tierInfo.progress}%`,
                          backgroundColor: config.color
                        }}
                      />
                    </div>
                    <div style={styles.tierInfo}>
                      {tierInfo.current && (
                        <span style={styles.currentTier}>{tierInfo.current.name}</span>
                      )}
                      {tierInfo.next && (
                        <span style={styles.nextTier}>
                          Next: {tierInfo.next.name} at {formatNumber(tierInfo.next.minUnits)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cost Breakdown */}
          <div style={styles.costBreakdown}>
            <h3 style={styles.breakdownTitle}>Cost Breakdown</h3>
            <div style={styles.costGrid}>
              <div style={styles.costItem}>
                <span style={styles.costItemLabel}>Base Plan</span>
                <span style={styles.costItemValue}>${currentUsage.costs?.baseCost?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={styles.costItem}>
                <span style={styles.costItemLabel}>Usage Charges</span>
                <span style={styles.costItemValue}>${currentUsage.costs?.usageCost?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={styles.costItem}>
                <span style={styles.costItemLabel}>Overage</span>
                <span style={styles.costItemValue}>${currentUsage.costs?.overageCost?.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ ...styles.costItem, ...styles.totalCost }}>
                <span style={styles.costItemLabel}>Total</span>
                <span style={styles.costItemValue}>${currentUsage.costs?.totalCost?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Tab */}
      {activeTab === 'breakdown' && currentUsage?.costs?.breakdown && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Detailed Usage Breakdown</h2>

          {Object.entries(currentUsage.costs.breakdown).map(([type, data]) => (
            <div key={type} style={styles.breakdownCard}>
              <div style={styles.breakdownHeader}>
                <h3 style={styles.breakdownType}>
                  {(() => {
                    const usageType = USAGE_TYPES[type === 'api' ? 'apiRequests' : type === 'tokens' ? 'aiTokens' : type === 'storage' ? 'storageGb' : 'bandwidthGb'];
                    return usageType?.Icon && <usageType.Icon size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />;
                  })()}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </h3>
                <span style={styles.breakdownTotal}>${data.cost?.toFixed(4)}</span>
              </div>

              {data.tierBreakdown && data.tierBreakdown.length > 0 && (
                <table style={styles.breakdownTable}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Tier</th>
                      <th style={styles.th}>Units</th>
                      <th style={styles.th}>Price/Unit</th>
                      <th style={styles.th}>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tierBreakdown.map((tier, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>{tier.tier}</td>
                        <td style={styles.td}>{formatNumber(tier.units)}</td>
                        <td style={styles.td}>${tier.pricePerUnit.toFixed(6)}</td>
                        <td style={styles.td}>${tier.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tiers Tab */}
      {activeTab === 'tiers' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Pricing Tiers</h2>

          <div style={styles.tiersGrid}>
            {Object.entries(tiers).map(([unitType, tierList]) => (
              <div key={unitType} style={styles.tierCard}>
                <h3 style={styles.tierCardTitle}>
                  {(() => {
                    const icons = { request: Link2, token: Bot, gb_storage: HardDrive, gb_bandwidth: Radio };
                    const labels = { request: 'API Requests', token: 'AI Tokens', gb_storage: 'Storage', gb_bandwidth: 'Bandwidth' };
                    const Icon = icons[unitType] || Link2;
                    return <><Icon size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />{labels[unitType] || unitType}</>;
                  })()}
                </h3>
                <table style={styles.tierTable}>
                  <thead>
                    <tr>
                      <th style={styles.tierTh}>Tier</th>
                      <th style={styles.tierTh}>Range</th>
                      <th style={styles.tierTh}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierList.map((tier, idx) => (
                      <tr key={idx} style={idx === 0 && tier.pricePerUnit === 0 ? styles.freeTierRow : {}}>
                        <td style={styles.tierTd}>{tier.name.split(' - ')[1] || tier.name}</td>
                        <td style={styles.tierTd}>
                          {formatNumber(tier.minUnits)} - {tier.maxUnits ? formatNumber(tier.maxUnits) : 'Unlimited'}
                        </td>
                        <td style={styles.tierTd}>
                          {tier.pricePerUnit === 0 ? (
                            <span style={styles.freeLabel}>FREE</span>
                          ) : (
                            `$${tier.pricePerUnit.toFixed(6)}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Usage History</h2>

          {history.length === 0 ? (
            <p style={styles.noData}>No usage history available</p>
          ) : (
            <div style={styles.historyGrid}>
              {history.map((record, idx) => (
                <div key={idx} style={styles.historyCard}>
                  <div style={styles.historyHeader}>
                    <span style={styles.historyPeriod}>
                      {record.period?.start} - {record.period?.end}
                    </span>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: record.status === 'paid' ? '#dcfce7' :
                                      record.status === 'invoiced' ? '#dbeafe' : '#fef3c7',
                      color: record.status === 'paid' ? '#16a34a' :
                             record.status === 'invoiced' ? '#2563eb' : '#d97706'
                    }}>
                      {record.status}
                    </span>
                  </div>

                  <div style={styles.historyUsage}>
                    {Object.entries(USAGE_TYPES).map(([key, config]) => (
                      <div key={key} style={styles.historyUsageItem}>
                        <span>{config.Icon && <config.Icon size={16} />}</span>
                        <span>{formatNumber(record.usage?.[key] || 0)}</span>
                      </div>
                    ))}
                  </div>

                  <div style={styles.historyTotal}>
                    <span>Total</span>
                    <span style={styles.historyTotalValue}>${record.costs?.total?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Invoices</h2>

          {invoices.length === 0 ? (
            <p style={styles.noData}>No invoices available</p>
          ) : (
            <table style={styles.invoiceTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Invoice ID</th>
                  <th style={styles.th}>Period</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>{invoice.id}</td>
                    <td style={styles.td}>{invoice.period?.start} - {invoice.period?.end}</td>
                    <td style={styles.td}>${invoice.amount?.toFixed(2)}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.statusBadge,
                        backgroundColor: invoice.status === 'paid' ? '#dcfce7' : '#dbeafe',
                        color: invoice.status === 'paid' ? '#16a34a' : '#2563eb'
                      }}>
                        {invoice.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => downloadInvoice(invoice.id)}
                        style={styles.downloadBtn}
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Usage Alerts</h2>

          <div style={styles.alertForm}>
            <h3 style={styles.formTitle}>Create New Alert</h3>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Alert Type</label>
                <select
                  value={alertForm.alertType}
                  onChange={(e) => setAlertForm({ ...alertForm, alertType: e.target.value })}
                  style={styles.select}
                >
                  {ALERT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Threshold</label>
                <input
                  type="number"
                  value={alertForm.threshold}
                  onChange={(e) => setAlertForm({ ...alertForm, threshold: parseFloat(e.target.value) })}
                  style={styles.input}
                  min="0"
                  step="1"
                />
              </div>
              <button onClick={createAlert} style={styles.createBtn}>
                Create Alert
              </button>
            </div>
          </div>

          <div style={styles.alertsList}>
            <h3 style={styles.listTitle}>Active Alerts</h3>
            {alerts.length === 0 ? (
              <p style={styles.noData}>No alerts configured</p>
            ) : (
              <div style={styles.alertsGrid}>
                {alerts.map(alert => (
                  <div key={alert.id} style={styles.alertCard}>
                    <div style={styles.alertInfo}>
                      <span style={styles.alertType}>
                        {ALERT_TYPES.find(t => t.value === alert.alert_type)?.label || alert.alert_type}
                      </span>
                      <span style={styles.alertThreshold}>
                        Threshold: {alert.threshold?.toLocaleString()}
                        {alert.alert_type === 'total_cost' ? ' $' : ''}
                      </span>
                    </div>
                    <div style={styles.alertActions}>
                      <span style={{
                        ...styles.alertStatus,
                        color: alert.enabled ? '#16a34a' : '#9ca3af'
                      }}>
                        {alert.enabled ? 'Active' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => deleteAlert(alert.id)}
                        style={styles.deleteBtn}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0
  },
  subtitle: {
    color: '#6b7280',
    marginTop: '4px'
  },
  error: {
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#dc2626',
    cursor: 'pointer',
    fontWeight: '500'
  },
  costTicker: {
    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    borderRadius: '16px',
    padding: '24px 32px',
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
    boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
  },
  costTickerContent: {
    display: 'flex',
    flexDirection: 'column'
  },
  costLabel: {
    fontSize: '14px',
    opacity: 0.8
  },
  costValue: {
    fontSize: '48px',
    fontWeight: '700',
    marginTop: '4px'
  },
  daysRemaining: {
    fontSize: '14px',
    opacity: 0.8,
    marginTop: '4px'
  },
  estimateBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: '16px 24px',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end'
  },
  estimateLabel: {
    fontSize: '12px',
    opacity: 0.8
  },
  estimateValue: {
    fontSize: '28px',
    fontWeight: '600',
    marginTop: '4px'
  },
  confidenceBadge: {
    marginTop: '8px',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '8px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#6b7280',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  activeTab: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },
  section: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#111827',
    margin: '0 0 8px 0'
  },
  periodText: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '20px'
  },
  usageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  usageCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px'
  },
  usageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
  },
  usageIcon: {
    fontSize: '24px'
  },
  usageLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  usageValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827'
  },
  usageUnit: {
    fontSize: '14px',
    fontWeight: '400',
    color: '#6b7280'
  },
  tierProgress: {
    marginTop: '16px'
  },
  progressBar: {
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.5s ease-out'
  },
  tierInfo: {
    marginTop: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px'
  },
  currentTier: {
    color: '#374151',
    fontWeight: '500'
  },
  nextTier: {
    color: '#9ca3af'
  },
  costBreakdown: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px'
  },
  breakdownTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827'
  },
  costGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px'
  },
  costItem: {
    display: 'flex',
    flexDirection: 'column'
  },
  costItemLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  costItemValue: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#111827',
    marginTop: '4px'
  },
  totalCost: {
    backgroundColor: '#dbeafe',
    padding: '12px',
    borderRadius: '8px'
  },
  breakdownCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px'
  },
  breakdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  breakdownType: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#111827'
  },
  breakdownTotal: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#3b82f6'
  },
  breakdownTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    backgroundColor: '#e5e7eb',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151'
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px'
  },
  tiersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px'
  },
  tierCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '20px'
  },
  tierCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827'
  },
  tierTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tierTh: {
    textAlign: 'left',
    padding: '8px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb'
  },
  tierTd: {
    padding: '8px',
    fontSize: '13px',
    borderBottom: '1px solid #e5e7eb'
  },
  freeTierRow: {
    backgroundColor: '#dcfce7'
  },
  freeLabel: {
    color: '#16a34a',
    fontWeight: '600'
  },
  historyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px'
  },
  historyCard: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    padding: '16px'
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  historyPeriod: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  historyUsage: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  historyUsageItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: '12px',
    color: '#6b7280'
  },
  historyTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #e5e7eb'
  },
  historyTotalValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#111827'
  },
  invoiceTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  downloadBtn: {
    padding: '6px 12px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  alertForm: {
    backgroundColor: '#f9fafb',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '24px'
  },
  formTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827'
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
    flexWrap: 'wrap'
  },
  formGroup: {
    flex: 1,
    minWidth: '150px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  createBtn: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '500'
  },
  alertsList: {
    marginTop: '24px'
  },
  listTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: '#111827'
  },
  alertsGrid: {
    display: 'grid',
    gap: '12px'
  },
  alertCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '8px'
  },
  alertInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  alertType: {
    fontWeight: '600',
    color: '#111827'
  },
  alertThreshold: {
    fontSize: '13px',
    color: '#6b7280'
  },
  alertActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  alertStatus: {
    fontSize: '12px',
    fontWeight: '600'
  },
  deleteBtn: {
    padding: '6px 12px',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  noData: {
    textAlign: 'center',
    color: '#6b7280',
    padding: '40px'
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  }
};

export default UsageBilling;
