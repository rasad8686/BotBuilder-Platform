/**
 * Alert Settings Page
 * Manage usage alerts for spending, rate limits, usage, and error rates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { DollarSign, Zap, BarChart3, XCircle, Mail, Link2, MessageSquare, Bell, Scroll, FlaskConical, Trash2, Clock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const AlertSettings = () => {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    alert_type: 'spending',
    threshold_value: '',
    threshold_type: 'absolute',
    notification_channels: ['email'],
    webhook_url: '',
    slack_channel: '',
    is_active: true
  });

  const token = localStorage.getItem('token');

  const alertTypes = [
    { value: 'spending', label: t('alerts.spending', 'Spending'), Icon: DollarSign, description: t('alerts.spendingDesc', 'Alert when spending exceeds threshold') },
    { value: 'rate_limit', label: t('alerts.rateLimit', 'Rate Limit'), Icon: Zap, description: t('alerts.rateLimitDesc', 'Alert when approaching rate limits') },
    { value: 'usage', label: t('alerts.usage', 'Usage'), Icon: BarChart3, description: t('alerts.usageDesc', 'Alert when daily requests exceed threshold') },
    { value: 'error_rate', label: t('alerts.errorRate', 'Error Rate'), Icon: XCircle, description: t('alerts.errorRateDesc', 'Alert when error rate exceeds threshold') }
  ];

  const thresholdTypes = [
    { value: 'absolute', label: t('alerts.absolute', 'Absolute Value') },
    { value: 'percentage', label: t('alerts.percentage', 'Percentage') }
  ];

  const notificationChannels = [
    { value: 'email', label: t('alerts.email', 'Email'), Icon: Mail },
    { value: 'webhook', label: t('alerts.webhook', 'Webhook'), Icon: Link2 },
    { value: 'slack', label: t('alerts.slack', 'Slack'), Icon: MessageSquare }
  ];

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch alerts');

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err.message);
      // Use mock data for demo
      setAlerts([
        {
          id: 1,
          name: 'Monthly Spending Limit',
          alert_type: 'spending',
          threshold_value: 100,
          threshold_type: 'absolute',
          notification_channels: ['email', 'slack'],
          is_active: true,
          last_triggered_at: null,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: 'High Error Rate',
          alert_type: 'error_rate',
          threshold_value: 5,
          threshold_type: 'percentage',
          notification_channels: ['email', 'webhook'],
          webhook_url: 'https://example.com/webhook',
          is_active: true,
          last_triggered_at: new Date(Date.now() - 86400000).toISOString(),
          created_at: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Create alert
  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create alert');
      }

      const data = await response.json();
      setAlerts([data.alert, ...alerts]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      alert(err.message);
    }
  };

  // Toggle alert active status
  const handleToggleAlert = async (alertId, currentStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!response.ok) throw new Error('Failed to update alert');

      setAlerts(alerts.map(a =>
        a.id === alertId ? { ...a, is_active: !currentStatus } : a
      ));
    } catch (err) {
      alert(err.message);
    }
  };

  // Delete alert
  const handleDeleteAlert = async (alertId) => {
    if (!window.confirm(t('alerts.confirmDelete', 'Are you sure you want to delete this alert?'))) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete alert');

      setAlerts(alerts.filter(a => a.id !== alertId));
    } catch (err) {
      alert(err.message);
    }
  };

  // View history
  const handleViewHistory = async (alertItem) => {
    setSelectedAlert(alertItem);
    setShowHistoryModal(true);
    setHistoryLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/alerts/${alertItem.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      // Use mock data
      setHistory([
        {
          id: 1,
          triggered_value: 105.50,
          notification_sent: { email: { success: true }, slack: { success: true } },
          status: 'sent',
          created_at: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: 2,
          triggered_value: 98.25,
          notification_sent: { email: { success: true } },
          status: 'sent',
          created_at: new Date(Date.now() - 172800000).toISOString()
        }
      ]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Test notification
  const handleTestNotification = async (alertId) => {
    setTestingId(alertId);
    setTestResult(null);

    try {
      const response = await fetch(`${API_URL}/api/alerts/test/${alertId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setTestResult({ alertId, success: data.success, results: data.results });
    } catch (err) {
      setTestResult({ alertId, success: false, error: err.message });
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      alert_type: 'spending',
      threshold_value: '',
      threshold_type: 'absolute',
      notification_channels: ['email'],
      webhook_url: '',
      slack_channel: '',
      is_active: true
    });
  };

  const handleChannelToggle = (channel) => {
    const channels = formData.notification_channels;
    if (channels.includes(channel)) {
      setFormData({
        ...formData,
        notification_channels: channels.filter(c => c !== channel)
      });
    } else {
      setFormData({
        ...formData,
        notification_channels: [...channels, channel]
      });
    }
  };

  const getAlertTypeInfo = (type) => {
    return alertTypes.find(t => t.value === type) || alertTypes[0];
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('alerts.never', 'Never');
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div style={styles.container} role="status" aria-busy="true">
        <div style={styles.loading}>
          <div style={styles.spinner} aria-hidden="true" />
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>{t('alerts.title', 'Usage Alerts')}</h1>
          <p style={styles.subtitle}>
            {t('alerts.subtitle', 'Configure alerts to monitor your API usage and spending')}
          </p>
        </div>
        <button
          style={styles.createButton}
          onClick={() => setShowCreateModal(true)}
          aria-label={t('alerts.createNew', 'Create new alert')}
        >
          + {t('alerts.newAlert', 'New Alert')}
        </button>
      </header>

      {error && (
        <div style={styles.errorBanner} role="alert">
          {t('alerts.usingDemo', 'Using demo data. Connect to API for real alerts.')}
        </div>
      )}

      {/* Alert List */}
      <div style={styles.alertGrid} role="list" aria-label={t('alerts.list', 'Alert list')}>
        {alerts.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon} aria-hidden="true"><Bell size={48} /></span>
            <h3>{t('alerts.noAlerts', 'No alerts configured')}</h3>
            <p>{t('alerts.createFirst', 'Create your first alert to start monitoring your usage')}</p>
          </div>
        ) : (
          alerts.map(alertItem => {
            const typeInfo = getAlertTypeInfo(alertItem.alert_type);
            return (
              <article
                key={alertItem.id}
                style={{
                  ...styles.alertCard,
                  opacity: alertItem.is_active ? 1 : 0.6
                }}
                role="listitem"
              >
                <div style={styles.alertHeader}>
                  <span style={styles.alertIcon} aria-hidden="true">{typeInfo.Icon && <typeInfo.Icon size={28} />}</span>
                  <div style={styles.alertInfo}>
                    <h3 style={styles.alertName}>{alertItem.name}</h3>
                    <span style={styles.alertType}>{typeInfo.label}</span>
                  </div>
                  <label style={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      checked={alertItem.is_active}
                      onChange={() => handleToggleAlert(alertItem.id, alertItem.is_active)}
                      style={styles.toggleInput}
                      aria-label={alertItem.is_active ? t('alerts.disable', 'Disable alert') : t('alerts.enable', 'Enable alert')}
                    />
                    <span style={{
                      ...styles.toggleSlider,
                      backgroundColor: alertItem.is_active ? '#10b981' : '#9ca3af'
                    }} />
                  </label>
                </div>

                <div style={styles.alertBody}>
                  <div style={styles.thresholdInfo}>
                    <span style={styles.thresholdLabel}>{t('alerts.threshold', 'Threshold')}:</span>
                    <span style={styles.thresholdValue}>
                      {alertItem.threshold_value}
                      {alertItem.threshold_type === 'percentage' ? '%' : ''}
                    </span>
                  </div>

                  <div style={styles.channelList}>
                    {(alertItem.notification_channels || []).map(channel => (
                      <span key={channel} style={styles.channelBadge}>
                        {(() => { const ChannelIcon = notificationChannels.find(c => c.value === channel)?.Icon; return ChannelIcon ? <ChannelIcon size={12} style={{ display: 'inline', marginRight: '4px' }} /> : null; })()} {channel}
                      </span>
                    ))}
                  </div>

                  <div style={styles.lastTriggered}>
                    <span style={styles.lastTriggeredLabel}>
                      {t('alerts.lastTriggered', 'Last triggered')}:
                    </span>
                    <span>{formatDate(alertItem.last_triggered_at)}</span>
                  </div>
                </div>

                <div style={styles.alertActions}>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleViewHistory(alertItem)}
                    aria-label={t('alerts.viewHistory', 'View history')}
                  >
                    <Scroll size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('alerts.history', 'History')}
                  </button>
                  <button
                    style={styles.actionButton}
                    onClick={() => handleTestNotification(alertItem.id)}
                    disabled={testingId === alertItem.id}
                    aria-label={t('alerts.testNotification', 'Test notification')}
                  >
                    {testingId === alertItem.id ? <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} /> : <FlaskConical size={14} style={{ display: 'inline', marginRight: '4px' }} />} {t('alerts.test', 'Test')}
                  </button>
                  <button
                    style={{ ...styles.actionButton, ...styles.deleteButton }}
                    onClick={() => handleDeleteAlert(alertItem.id)}
                    aria-label={t('alerts.delete', 'Delete alert')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {testResult && testResult.alertId === alertItem.id && (
                  <div style={{
                    ...styles.testResult,
                    backgroundColor: testResult.success ? '#d1fae5' : '#fee2e2'
                  }} role="status">
                    {testResult.success
                      ? t('alerts.testSuccess', 'Test notification sent successfully!')
                      : t('alerts.testFailed', 'Test failed: ') + (testResult.error || 'Unknown error')
                    }
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowCreateModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-modal-title"
        >
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 id="create-modal-title" style={styles.modalTitle}>
              {t('alerts.createAlert', 'Create New Alert')}
            </h2>

            <form onSubmit={handleCreateAlert}>
              <div style={styles.formGroup}>
                <label htmlFor="alert-name" style={styles.label}>
                  {t('alerts.name', 'Alert Name')}
                </label>
                <input
                  id="alert-name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={styles.input}
                  placeholder={t('alerts.namePlaceholder', 'e.g., Monthly Spending Limit')}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('alerts.alertType', 'Alert Type')}</label>
                <div style={styles.typeGrid}>
                  {alertTypes.map(type => (
                    <button
                      key={type.value}
                      type="button"
                      style={{
                        ...styles.typeCard,
                        borderColor: formData.alert_type === type.value ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: formData.alert_type === type.value ? '#eff6ff' : '#fff'
                      }}
                      onClick={() => setFormData({ ...formData, alert_type: type.value })}
                      aria-pressed={formData.alert_type === type.value}
                    >
                      <span style={styles.typeIcon}>{type.Icon && <type.Icon size={24} />}</span>
                      <span style={styles.typeLabel}>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label htmlFor="threshold-value" style={styles.label}>
                    {t('alerts.thresholdValue', 'Threshold Value')}
                  </label>
                  <input
                    id="threshold-value"
                    type="number"
                    value={formData.threshold_value}
                    onChange={e => setFormData({ ...formData, threshold_value: e.target.value })}
                    style={styles.input}
                    placeholder="100"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label htmlFor="threshold-type" style={styles.label}>
                    {t('alerts.thresholdType', 'Threshold Type')}
                  </label>
                  <select
                    id="threshold-type"
                    value={formData.threshold_type}
                    onChange={e => setFormData({ ...formData, threshold_type: e.target.value })}
                    style={styles.select}
                  >
                    {thresholdTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>{t('alerts.notificationChannels', 'Notification Channels')}</label>
                <div style={styles.channelGrid}>
                  {notificationChannels.map(channel => (
                    <label
                      key={channel.value}
                      style={{
                        ...styles.channelOption,
                        borderColor: formData.notification_channels.includes(channel.value) ? '#3b82f6' : '#e5e7eb',
                        backgroundColor: formData.notification_channels.includes(channel.value) ? '#eff6ff' : '#fff'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={formData.notification_channels.includes(channel.value)}
                        onChange={() => handleChannelToggle(channel.value)}
                        style={styles.channelCheckbox}
                      />
                      <span>{channel.Icon && <channel.Icon size={16} />}</span>
                      <span>{channel.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {formData.notification_channels.includes('webhook') && (
                <div style={styles.formGroup}>
                  <label htmlFor="webhook-url" style={styles.label}>
                    {t('alerts.webhookUrl', 'Webhook URL')}
                  </label>
                  <input
                    id="webhook-url"
                    type="url"
                    value={formData.webhook_url}
                    onChange={e => setFormData({ ...formData, webhook_url: e.target.value })}
                    style={styles.input}
                    placeholder="https://your-server.com/webhook"
                    required
                  />
                </div>
              )}

              {formData.notification_channels.includes('slack') && (
                <div style={styles.formGroup}>
                  <label htmlFor="slack-channel" style={styles.label}>
                    {t('alerts.slackChannel', 'Slack Channel')}
                  </label>
                  <input
                    id="slack-channel"
                    type="text"
                    value={formData.slack_channel}
                    onChange={e => setFormData({ ...formData, slack_channel: e.target.value })}
                    style={styles.input}
                    placeholder="#alerts"
                    required
                  />
                </div>
              )}

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" style={styles.submitButton}>
                  {t('alerts.create', 'Create Alert')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedAlert && (
        <div
          style={styles.modalOverlay}
          onClick={() => setShowHistoryModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-modal-title"
        >
          <div style={{ ...styles.modal, maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <h2 id="history-modal-title" style={styles.modalTitle}>
              {t('alerts.historyFor', 'History for')} "{selectedAlert.name}"
            </h2>

            {historyLoading ? (
              <div style={styles.loading}>
                <div style={styles.spinner} aria-hidden="true" />
              </div>
            ) : history.length === 0 ? (
              <div style={styles.emptyHistory}>
                <p>{t('alerts.noHistory', 'No trigger history yet')}</p>
              </div>
            ) : (
              <div style={styles.historyList} role="list" aria-label={t('alerts.triggerHistory', 'Trigger history')}>
                {history.map(item => (
                  <div key={item.id} style={styles.historyItem} role="listitem">
                    <div style={styles.historyTime}>
                      {formatDate(item.created_at)}
                    </div>
                    <div style={styles.historyValue}>
                      {t('alerts.triggeredAt', 'Triggered at')}: {item.triggered_value}
                      {selectedAlert.threshold_type === 'percentage' ? '%' : ''}
                    </div>
                    <div style={styles.historyChannels}>
                      {Object.entries(item.notification_sent || {}).map(([channel, result]) => (
                        <span
                          key={channel}
                          style={{
                            ...styles.historyChannel,
                            backgroundColor: result.success ? '#d1fae5' : '#fee2e2',
                            color: result.success ? '#065f46' : '#991b1b'
                          }}
                        >
                          {result.success ? '✓' : '✗'} {channel}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowHistoryModal(false)}
              >
                {t('common.close', 'Close')}
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  subtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#6b7280'
  },
  createButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  errorBanner: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '24px'
  },
  alertGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px'
  },
  alertCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    transition: 'all 0.2s'
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  alertIcon: {
    fontSize: '28px'
  },
  alertInfo: {
    flex: 1
  },
  alertName: {
    margin: '0 0 4px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  alertType: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  toggleLabel: {
    position: 'relative',
    display: 'inline-block',
    width: '48px',
    height: '24px',
    cursor: 'pointer'
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0
  },
  toggleSlider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '24px',
    transition: 'background-color 0.2s'
  },
  alertBody: {
    marginBottom: '16px'
  },
  thresholdInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px'
  },
  thresholdLabel: {
    fontSize: '13px',
    color: '#6b7280'
  },
  thresholdValue: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#3b82f6'
  },
  channelList: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px'
  },
  channelBadge: {
    padding: '4px 10px',
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#374151'
  },
  lastTriggered: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  lastTriggeredLabel: {
    marginRight: '4px'
  },
  alertActions: {
    display: 'flex',
    gap: '8px',
    borderTop: '1px solid #f3f4f6',
    paddingTop: '16px'
  },
  actionButton: {
    flex: 1,
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  deleteButton: {
    flex: 0,
    backgroundColor: '#fee2e2',
    color: '#dc2626'
  },
  testResult: {
    marginTop: '12px',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '13px',
    textAlign: 'center'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: 'white',
    borderRadius: '12px'
  },
  emptyIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '16px'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
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
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '500px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  modalTitle: {
    margin: '0 0 24px 0',
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  formGroup: {
    marginBottom: '20px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer'
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px'
  },
  typeCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'white'
  },
  typeIcon: {
    fontSize: '24px',
    marginBottom: '8px'
  },
  typeLabel: {
    fontSize: '13px',
    fontWeight: '500'
  },
  channelGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap'
  },
  channelOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  channelCheckbox: {
    display: 'none'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  historyList: {
    maxHeight: '400px',
    overflowY: 'auto'
  },
  historyItem: {
    padding: '16px',
    borderBottom: '1px solid #f3f4f6'
  },
  historyTime: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '8px'
  },
  historyValue: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '8px'
  },
  historyChannels: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  historyChannel: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500'
  },
  emptyHistory: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280'
  }
};

export default AlertSettings;
