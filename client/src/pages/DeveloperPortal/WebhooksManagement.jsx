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
  createButton: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  webhookList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  webhookCard: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  },
  webhookHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer'
  },
  webhookInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  statusIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%'
  },
  statusActive: {
    background: '#10b981'
  },
  statusDisabled: {
    background: '#ef4444'
  },
  statusFailing: {
    background: '#f59e0b'
  },
  webhookName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  webhookUrl: {
    fontSize: '13px',
    color: '#6b7280',
    fontFamily: 'monospace'
  },
  webhookStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  statBadge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  successBadge: {
    background: '#d1fae5',
    color: '#059669'
  },
  failBadge: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  webhookBody: {
    padding: '20px'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px'
  },
  eventTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  eventTag: {
    padding: '4px 10px',
    background: '#f3f4f6',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#4b5563'
  },
  secretSection: {
    background: '#1a1a2e',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  secretValue: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#10b981'
  },
  secretActions: {
    display: 'flex',
    gap: '8px'
  },
  iconButton: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    borderRadius: '4px',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '12px'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px'
  },
  actionButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  testButton: {
    background: '#3b82f6',
    color: '#fff'
  },
  enableButton: {
    background: '#10b981',
    color: '#fff'
  },
  editButton: {
    background: '#f3f4f6',
    color: '#374151'
  },
  deleteButton: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  logsSection: {
    marginTop: '20px'
  },
  logsTable: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    background: '#f9fafb',
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: '12px',
    fontWeight: '600',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb'
  },
  tableCell: {
    padding: '10px 12px',
    fontSize: '13px',
    color: '#374151',
    borderBottom: '1px solid #f3f4f6'
  },
  statusSuccess: {
    color: '#10b981'
  },
  statusFailed: {
    color: '#ef4444'
  },
  expandButton: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '12px'
  },
  expandedRow: {
    background: '#f9fafb',
    padding: '12px',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all'
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
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalTitle: {
    fontSize: '20px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#1a1a2e'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  eventSelector: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  eventCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: '#f3f4f6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  eventCheckboxSelected: {
    background: '#dbeafe',
    color: '#1d4ed8'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px'
  },
  cancelButton: {
    padding: '10px 20px',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer'
  },
  saveButton: {
    padding: '10px 20px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  statsCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '20px'
  },
  statItem: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a2e'
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  },
  chartContainer: {
    height: '120px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    padding: '0 20px'
  },
  chartBar: {
    flex: 1,
    borderRadius: '4px 4px 0 0',
    minHeight: '4px'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px',
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px'
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
  retryButton: {
    padding: '4px 8px',
    background: '#fef3c7',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#92400e',
    cursor: 'pointer'
  }
};

const WebhooksManagement = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWebhook, setExpandedWebhook] = useState(null);
  const [webhookLogs, setWebhookLogs] = useState({});
  const [webhookStats, setWebhookStats] = useState({});
  const [expandedLog, setExpandedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [formData, setFormData] = useState({ name: '', url: '', events: [] });
  const [testing, setTesting] = useState(null);
  const [showSecret, setShowSecret] = useState({});

  const fetchWebhooks = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/webhooks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/webhooks/events/list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEvents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  }, []);

  const fetchLogs = async (webhookId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}/logs?limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhookLogs(prev => ({ ...prev, [webhookId]: data.data || [] }));
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const fetchStats = async (webhookId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhookStats(prev => ({ ...prev, [webhookId]: data.data }));
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchWebhooks();
    fetchEvents();
  }, [fetchWebhooks, fetchEvents]);

  const handleExpandWebhook = (webhookId) => {
    if (expandedWebhook === webhookId) {
      setExpandedWebhook(null);
    } else {
      setExpandedWebhook(webhookId);
      fetchLogs(webhookId);
      fetchStats(webhookId);
    }
  };

  const handleCreate = () => {
    setEditingWebhook(null);
    setFormData({ name: '', url: '', events: [] });
    setShowModal(true);
  };

  const handleEdit = (webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events || []
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = editingWebhook
        ? `/api/webhooks/${editingWebhook.id}`
        : '/api/webhooks';
      const method = editingWebhook ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowModal(false);
        fetchWebhooks();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save webhook');
      }
    } catch (error) {
      console.error('Error saving webhook:', error);
      alert('Failed to save webhook');
    }
  };

  const handleDelete = async (webhookId) => {
    if (!window.confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  };

  const handleTest = async (webhookId) => {
    setTesting(webhookId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success && data.data.success) {
        alert(`Test successful! Status: ${data.data.statusCode}, Time: ${data.data.responseTime}ms`);
      } else {
        alert(`Test failed: ${data.data?.statusCode || 'No response'}`);
      }
      fetchLogs(webhookId);
    } catch (error) {
      console.error('Error testing webhook:', error);
      alert('Failed to test webhook');
    } finally {
      setTesting(null);
    }
  };

  const handleRotateSecret = async (webhookId) => {
    if (!window.confirm('This will invalidate the current signing secret. Continue?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}/rotate-secret`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Signing secret rotated successfully');
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Error rotating secret:', error);
    }
  };

  const handleEnable = async (webhookId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}/enable`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchWebhooks();
      }
    } catch (error) {
      console.error('Error enabling webhook:', error);
    }
  };

  const handleRetry = async (webhookId, logId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/webhooks/${webhookId}/retry/${logId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success && data.data.success) {
        alert('Retry successful!');
      } else {
        alert('Retry failed');
      }
      fetchLogs(webhookId);
    } catch (error) {
      console.error('Error retrying:', error);
    }
  };

  const toggleEvent = (eventName) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventName)
        ? prev.events.filter(e => e !== eventName)
        : [...prev.events, eventName]
    }));
  };

  const copySecret = (secret) => {
    navigator.clipboard.writeText(secret);
    alert('Secret copied to clipboard');
  };

  const getWebhookStatus = (webhook) => {
    if (!webhook.is_active || webhook.disabled_at) return 'disabled';
    if ((webhook.failure_count || 0) >= 3) return 'failing';
    return 'active';
  };

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading webhooks...</div></div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Webhooks</h1>
          <p style={styles.subtitle}>Manage webhook endpoints and monitor deliveries</p>
        </div>
        <button style={styles.createButton} onClick={handleCreate}>
          <span>+</span> Create Webhook
        </button>
      </div>

      {/* Webhook List */}
      {webhooks.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>Webhooks</div>
          <div style={styles.emptyTitle}>No webhooks configured</div>
          <p style={styles.emptyText}>Create your first webhook to receive real-time event notifications</p>
          <button style={styles.createButton} onClick={handleCreate}>Create Webhook</button>
        </div>
      ) : (
        <div style={styles.webhookList}>
          {webhooks.map(webhook => {
            const status = getWebhookStatus(webhook);
            const isExpanded = expandedWebhook === webhook.id;
            const logs = webhookLogs[webhook.id] || [];
            const stats = webhookStats[webhook.id];

            return (
              <div key={webhook.id} style={styles.webhookCard}>
                {/* Webhook Header */}
                <div style={styles.webhookHeader} onClick={() => handleExpandWebhook(webhook.id)}>
                  <div style={styles.webhookInfo}>
                    <div style={{
                      ...styles.statusIndicator,
                      ...(status === 'active' ? styles.statusActive :
                          status === 'failing' ? styles.statusFailing :
                          styles.statusDisabled)
                    }} />
                    <div>
                      <div style={styles.webhookName}>{webhook.name}</div>
                      <div style={styles.webhookUrl}>{webhook.url}</div>
                    </div>
                  </div>
                  <div style={styles.webhookStats}>
                    {webhook.stats && (
                      <>
                        <span style={{...styles.statBadge, ...styles.successBadge}}>
                          {webhook.stats.success_rate}% success
                        </span>
                        {webhook.stats.failed > 0 && (
                          <span style={{...styles.statBadge, ...styles.failBadge}}>
                            {webhook.stats.failed} failed
                          </span>
                        )}
                      </>
                    )}
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={styles.webhookBody}>
                    {/* Stats */}
                    {stats && (
                      <div style={styles.statsCard}>
                        <div style={styles.statItem}>
                          <div style={styles.statValue}>{stats.summary.total_deliveries}</div>
                          <div style={styles.statLabel}>Total Deliveries</div>
                        </div>
                        <div style={styles.statItem}>
                          <div style={{...styles.statValue, color: '#10b981'}}>{stats.summary.success_rate}%</div>
                          <div style={styles.statLabel}>Success Rate</div>
                        </div>
                        <div style={styles.statItem}>
                          <div style={styles.statValue}>{stats.summary.avg_response_time}ms</div>
                          <div style={styles.statLabel}>Avg Response Time</div>
                        </div>
                        <div style={styles.statItem}>
                          <div style={{
                            ...styles.statValue,
                            color: stats.health.status === 'healthy' ? '#10b981' :
                                   stats.health.status === 'failing' ? '#f59e0b' : '#ef4444'
                          }}>
                            {stats.health.status.toUpperCase()}
                          </div>
                          <div style={styles.statLabel}>Health Status</div>
                        </div>
                      </div>
                    )}

                    {/* Success Rate Chart */}
                    {stats?.daily && stats.daily.length > 0 && (
                      <div style={styles.section}>
                        <div style={styles.sectionTitle}>Daily Success Rate</div>
                        <div style={styles.chartContainer}>
                          {stats.daily.slice(0, 14).reverse().map((day, i) => {
                            const rate = day.total > 0 ? (day.successful / day.total) * 100 : 0;
                            return (
                              <div
                                key={i}
                                style={{
                                  ...styles.chartBar,
                                  height: `${rate}%`,
                                  background: rate >= 90 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444'
                                }}
                                title={`${day.date}: ${rate.toFixed(0)}%`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Events */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Subscribed Events</div>
                      <div style={styles.eventTags}>
                        {(webhook.events || []).map(event => (
                          <span key={event} style={styles.eventTag}>{event}</span>
                        ))}
                      </div>
                    </div>

                    {/* Signing Secret */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>Signing Secret</div>
                      <div style={styles.secretSection}>
                        <div style={styles.secretValue}>
                          {showSecret[webhook.id]
                            ? (webhook.signing_secret || webhook.secret || 'Not set')
                            : 'Click to reveal'}
                        </div>
                        <div style={styles.secretActions}>
                          <button
                            style={styles.iconButton}
                            onClick={() => setShowSecret(prev => ({...prev, [webhook.id]: !prev[webhook.id]}))}
                          >
                            {showSecret[webhook.id] ? 'Hide' : 'Show'}
                          </button>
                          <button
                            style={styles.iconButton}
                            onClick={() => copySecret(webhook.signing_secret || webhook.secret)}
                          >
                            Copy
                          </button>
                          <button
                            style={styles.iconButton}
                            onClick={() => handleRotateSecret(webhook.id)}
                          >
                            Rotate
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={styles.actionButtons}>
                      <button
                        style={{...styles.actionButton, ...styles.testButton}}
                        onClick={() => handleTest(webhook.id)}
                        disabled={testing === webhook.id}
                      >
                        {testing === webhook.id ? 'Testing...' : 'Test Webhook'}
                      </button>
                      {status === 'disabled' && (
                        <button
                          style={{...styles.actionButton, ...styles.enableButton}}
                          onClick={() => handleEnable(webhook.id)}
                        >
                          Re-enable
                        </button>
                      )}
                      <button
                        style={{...styles.actionButton, ...styles.editButton}}
                        onClick={() => handleEdit(webhook)}
                      >
                        Edit
                      </button>
                      <button
                        style={{...styles.actionButton, ...styles.deleteButton}}
                        onClick={() => handleDelete(webhook.id)}
                      >
                        Delete
                      </button>
                    </div>

                    {/* Delivery Logs */}
                    <div style={styles.logsSection}>
                      <div style={styles.sectionTitle}>Recent Deliveries</div>
                      {logs.length === 0 ? (
                        <p style={{color: '#6b7280', fontSize: '13px'}}>No delivery logs yet</p>
                      ) : (
                        <table style={styles.logsTable}>
                          <thead>
                            <tr>
                              <th style={styles.tableHeader}>Event</th>
                              <th style={styles.tableHeader}>Status</th>
                              <th style={styles.tableHeader}>Response</th>
                              <th style={styles.tableHeader}>Time</th>
                              <th style={styles.tableHeader}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map(log => (
                              <React.Fragment key={log.id}>
                                <tr>
                                  <td style={styles.tableCell}>{log.event_type}</td>
                                  <td style={{
                                    ...styles.tableCell,
                                    ...(log.status === 'success' || log.success ? styles.statusSuccess : styles.statusFailed)
                                  }}>
                                    {log.status === 'success' || log.success ? 'Success' : 'Failed'}
                                  </td>
                                  <td style={styles.tableCell}>
                                    {log.status_code || '-'} ({log.response_time_ms}ms)
                                  </td>
                                  <td style={styles.tableCell}>
                                    {new Date(log.created_at).toLocaleString()}
                                  </td>
                                  <td style={styles.tableCell}>
                                    <button
                                      style={styles.expandButton}
                                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                    >
                                      {expandedLog === log.id ? 'Hide' : 'Details'}
                                    </button>
                                    {(log.status === 'failed' || !log.success) && (
                                      <button
                                        style={styles.retryButton}
                                        onClick={() => handleRetry(webhook.id, log.id)}
                                      >
                                        Retry
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {expandedLog === log.id && (
                                  <tr>
                                    <td colSpan="5" style={styles.expandedRow}>
                                      {log.error_message && <div><strong>Error:</strong> {log.error_message}</div>}
                                      {log.response_body && <div><strong>Response:</strong> {log.response_body}</div>}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>
              {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
            </h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={formData.name}
                onChange={e => setFormData(prev => ({...prev, name: e.target.value}))}
                placeholder="My Webhook"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Endpoint URL</label>
              <input
                style={styles.input}
                value={formData.url}
                onChange={e => setFormData(prev => ({...prev, url: e.target.value}))}
                placeholder="https://example.com/webhook"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Events (select at least one)</label>
              <div style={styles.eventSelector}>
                {events.map(event => (
                  <label
                    key={event.name}
                    style={{
                      ...styles.eventCheckbox,
                      ...(formData.events.includes(event.name) ? styles.eventCheckboxSelected : {})
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.name)}
                      onChange={() => toggleEvent(event.name)}
                      style={{display: 'none'}}
                    />
                    {event.name}
                  </label>
                ))}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                style={styles.saveButton}
                onClick={handleSave}
                disabled={!formData.name || !formData.url || formData.events.length === 0}
              >
                {editingWebhook ? 'Save Changes' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebhooksManagement;
