import React, { useState, useEffect, useCallback } from 'react';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
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
  addButton: {
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
  domainList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  domainCard: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden'
  },
  domainHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e5e7eb'
  },
  domainInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  domainIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '10px',
    background: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  domainName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  domainType: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '2px'
  },
  statusBadges: {
    display: 'flex',
    gap: '8px'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  badgePending: {
    background: '#fef3c7',
    color: '#92400e'
  },
  badgeActive: {
    background: '#d1fae5',
    color: '#059669'
  },
  badgeFailed: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  badgeVerifying: {
    background: '#dbeafe',
    color: '#1d4ed8'
  },
  domainBody: {
    padding: '20px'
  },
  section: {
    marginBottom: '24px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  stepNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    background: '#3b82f6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '600'
  },
  stepComplete: {
    background: '#10b981'
  },
  dnsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#f9fafb',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  dnsHeader: {
    background: '#1a1a2e',
    color: '#fff',
    textAlign: 'left',
    padding: '10px 16px',
    fontSize: '12px',
    fontWeight: '600'
  },
  dnsCell: {
    padding: '12px 16px',
    fontSize: '13px',
    fontFamily: 'monospace',
    borderBottom: '1px solid #e5e7eb',
    wordBreak: 'break-all'
  },
  copyButton: {
    padding: '4px 8px',
    background: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
    marginLeft: '8px'
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px'
  },
  actionButton: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  verifyButton: {
    background: '#3b82f6',
    color: '#fff'
  },
  sslButton: {
    background: '#10b981',
    color: '#fff'
  },
  deleteButton: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  sslInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: '#f9fafb',
    borderRadius: '8px'
  },
  sslIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px'
  },
  sslActive: {
    background: '#d1fae5',
    color: '#059669'
  },
  sslPending: {
    background: '#fef3c7',
    color: '#92400e'
  },
  sslExpired: {
    background: '#fee2e2',
    color: '#dc2626'
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
    maxWidth: '500px'
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
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff'
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
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  verificationStatus: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '13px'
  },
  verificationError: {
    background: '#fee2e2',
    color: '#dc2626'
  },
  verificationSuccess: {
    background: '#d1fae5',
    color: '#059669'
  },
  hint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  }
};

const CustomDomains = () => {
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState(null);
  const [formData, setFormData] = useState({ domain: '', type: 'widget', verificationMethod: 'cname' });
  const [verifying, setVerifying] = useState(null);
  const [requestingSSL, setRequestingSSL] = useState(null);
  const [dnsRecords, setDnsRecords] = useState({});

  const fetchDomains = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/custom-domains', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDomains(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching domains:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDnsRecords = async (domainId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/custom-domains/${domainId}/dns-records`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDnsRecords(prev => ({ ...prev, [domainId]: data.data.records }));
      }
    } catch (error) {
      console.error('Error fetching DNS records:', error);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const handleExpand = (domainId) => {
    if (expandedDomain === domainId) {
      setExpandedDomain(null);
    } else {
      setExpandedDomain(domainId);
      if (!dnsRecords[domainId]) {
        fetchDnsRecords(domainId);
      }
    }
  };

  const handleAddDomain = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/custom-domains', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ domain: '', type: 'widget', verificationMethod: 'cname' });
        fetchDomains();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to add domain');
      }
    } catch (error) {
      console.error('Error adding domain:', error);
      alert('Failed to add domain');
    }
  };

  const handleVerify = async (domainId) => {
    setVerifying(domainId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/custom-domains/${domainId}/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        if (data.data.verified) {
          alert('Domain verified successfully!');
        } else {
          alert(`Verification failed: ${data.data.error}`);
        }
        fetchDomains();
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      alert('Failed to verify domain');
    } finally {
      setVerifying(null);
    }
  };

  const handleRequestSSL = async (domainId) => {
    setRequestingSSL(domainId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/custom-domains/${domainId}/ssl`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        alert(data.data.message || 'SSL certificate request initiated');
        fetchDomains();
      } else {
        alert(data.message || 'Failed to request SSL certificate');
      }
    } catch (error) {
      console.error('Error requesting SSL:', error);
      alert('Failed to request SSL certificate');
    } finally {
      setRequestingSSL(null);
    }
  };

  const handleDelete = async (domainId) => {
    if (!window.confirm('Are you sure you want to remove this domain?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/custom-domains/${domainId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchDomains();
      }
    } catch (error) {
      console.error('Error deleting domain:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return { ...styles.badge, ...styles.badgeActive };
      case 'verifying':
        return { ...styles.badge, ...styles.badgeVerifying };
      case 'failed':
        return { ...styles.badge, ...styles.badgeFailed };
      default:
        return { ...styles.badge, ...styles.badgePending };
    }
  };

  const getSSLBadge = (sslStatus) => {
    switch (sslStatus) {
      case 'issued':
        return { ...styles.badge, ...styles.badgeActive };
      case 'expired':
        return { ...styles.badge, ...styles.badgeFailed };
      default:
        return { ...styles.badge, ...styles.badgePending };
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'widget': return 'Chat Widget';
      case 'api': return 'API Endpoint';
      case 'portal': return 'Customer Portal';
      default: return type;
    }
  };

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading domains...</div></div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Custom Domains</h1>
          <p style={styles.subtitle}>Use your own domain for widget, API, or customer portal</p>
        </div>
        <button style={styles.addButton} onClick={() => setShowModal(true)}>
          <span>+</span> Add Domain
        </button>
      </div>

      {/* Domain List */}
      {domains.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>Domain</div>
          <div style={styles.emptyTitle}>No custom domains configured</div>
          <p style={styles.emptyText}>Add your own domain to white-label BotBuilder</p>
          <button style={styles.addButton} onClick={() => setShowModal(true)}>Add Domain</button>
        </div>
      ) : (
        <div style={styles.domainList}>
          {domains.map(domain => {
            const isExpanded = expandedDomain === domain.id;
            const records = dnsRecords[domain.id] || [];

            return (
              <div key={domain.id} style={styles.domainCard}>
                {/* Domain Header */}
                <div style={styles.domainHeader} onClick={() => handleExpand(domain.id)}>
                  <div style={styles.domainInfo}>
                    <div style={styles.domainIcon}>Domain</div>
                    <div>
                      <div style={styles.domainName}>{domain.domain}</div>
                      <div style={styles.domainType}>{getTypeLabel(domain.type)}</div>
                    </div>
                  </div>
                  <div style={styles.statusBadges}>
                    <span style={getStatusBadge(domain.status)}>
                      {domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                    </span>
                    <span style={getSSLBadge(domain.ssl_status)}>
                      SSL: {domain.ssl_status}
                    </span>
                    <span>{isExpanded ? 'Less' : 'More'}</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={styles.domainBody}>
                    {/* Step 1: DNS Configuration */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>
                        <span style={{
                          ...styles.stepNumber,
                          ...(domain.status === 'active' ? styles.stepComplete : {})
                        }}>1</span>
                        Configure DNS Records
                      </div>
                      <p style={styles.hint}>Add the following DNS records to your domain provider:</p>
                      <table style={styles.dnsTable}>
                        <thead>
                          <tr>
                            <th style={styles.dnsHeader}>Type</th>
                            <th style={styles.dnsHeader}>Name</th>
                            <th style={styles.dnsHeader}>Value</th>
                            <th style={styles.dnsHeader}>Purpose</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.map((record, i) => (
                            <tr key={i}>
                              <td style={styles.dnsCell}>{record.type}</td>
                              <td style={styles.dnsCell}>
                                {record.name}
                                <button
                                  style={styles.copyButton}
                                  onClick={() => copyToClipboard(record.name)}
                                >
                                  Copy
                                </button>
                              </td>
                              <td style={styles.dnsCell}>
                                {record.value}
                                <button
                                  style={styles.copyButton}
                                  onClick={() => copyToClipboard(record.value)}
                                >
                                  Copy
                                </button>
                              </td>
                              <td style={styles.dnsCell}>{record.purpose}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Step 2: Verify Domain */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>
                        <span style={{
                          ...styles.stepNumber,
                          ...(domain.status === 'active' ? styles.stepComplete : {})
                        }}>2</span>
                        Verify Domain Ownership
                      </div>
                      {domain.verification_error && (
                        <div style={{...styles.verificationStatus, ...styles.verificationError}}>
                          {domain.verification_error}
                        </div>
                      )}
                      {domain.status === 'active' && domain.verified_at && (
                        <div style={{...styles.verificationStatus, ...styles.verificationSuccess}}>
                          Domain verified on {new Date(domain.verified_at).toLocaleDateString()}
                        </div>
                      )}
                      {domain.status !== 'active' && (
                        <button
                          style={{...styles.actionButton, ...styles.verifyButton}}
                          onClick={() => handleVerify(domain.id)}
                          disabled={verifying === domain.id}
                        >
                          {verifying === domain.id ? 'Verifying...' : 'Verify DNS Records'}
                        </button>
                      )}
                    </div>

                    {/* Step 3: SSL Certificate */}
                    <div style={styles.section}>
                      <div style={styles.sectionTitle}>
                        <span style={{
                          ...styles.stepNumber,
                          ...(domain.ssl_status === 'issued' ? styles.stepComplete : {})
                        }}>3</span>
                        SSL Certificate
                      </div>
                      <div style={styles.sslInfo}>
                        <div style={{
                          ...styles.sslIcon,
                          ...(domain.ssl_status === 'issued' ? styles.sslActive :
                              domain.ssl_status === 'expired' ? styles.sslExpired :
                              styles.sslPending)
                        }}>
                          {domain.ssl_status === 'issued' ? 'Secure' : 'SSL'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>
                            {domain.ssl_status === 'issued' ? 'Certificate Active' :
                             domain.ssl_status === 'expired' ? 'Certificate Expired' :
                             'Certificate Pending'}
                          </div>
                          {domain.ssl_expires_at && (
                            <div style={{ fontSize: '13px', color: '#6b7280' }}>
                              Expires: {new Date(domain.ssl_expires_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      {domain.status === 'active' && domain.ssl_status !== 'issued' && (
                        <button
                          style={{...styles.actionButton, ...styles.sslButton, marginTop: '12px'}}
                          onClick={() => handleRequestSSL(domain.id)}
                          disabled={requestingSSL === domain.id}
                        >
                          {requestingSSL === domain.id ? 'Requesting...' : 'Request SSL Certificate'}
                        </button>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={styles.actionButtons}>
                      <button
                        style={{...styles.actionButton, ...styles.deleteButton}}
                        onClick={() => handleDelete(domain.id)}
                      >
                        Remove Domain
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Domain Modal */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Add Custom Domain</h2>

            <div style={styles.formGroup}>
              <label style={styles.label}>Domain Name</label>
              <input
                style={styles.input}
                value={formData.domain}
                onChange={e => setFormData(prev => ({...prev, domain: e.target.value}))}
                placeholder="chat.example.com"
              />
              <p style={styles.hint}>Enter the full domain or subdomain you want to use</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Domain Type</label>
              <select
                style={styles.select}
                value={formData.type}
                onChange={e => setFormData(prev => ({...prev, type: e.target.value}))}
              >
                <option value="widget">Chat Widget</option>
                <option value="api">API Endpoint</option>
                <option value="portal">Customer Portal</option>
              </select>
              <p style={styles.hint}>What this domain will be used for</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Verification Method</label>
              <select
                style={styles.select}
                value={formData.verificationMethod}
                onChange={e => setFormData(prev => ({...prev, verificationMethod: e.target.value}))}
              >
                <option value="cname">CNAME Record</option>
                <option value="txt">TXT Record</option>
              </select>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                style={styles.saveButton}
                onClick={handleAddDomain}
                disabled={!formData.domain}
              >
                Add Domain
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDomains;
