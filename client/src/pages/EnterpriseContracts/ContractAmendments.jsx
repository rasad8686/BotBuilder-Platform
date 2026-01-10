import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '800px',
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
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: '8px'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
    marginBottom: '24px'
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '16px'
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '20px'
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
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    background: '#fff'
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    minHeight: '100px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  hint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  },
  submitButton: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  amendmentHistory: {
    marginTop: '32px'
  },
  historyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: '16px'
  },
  amendmentItem: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '12px'
  },
  amendmentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  amendmentType: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  amendmentDate: {
    fontSize: '12px',
    color: '#6b7280'
  },
  amendmentDesc: {
    fontSize: '14px',
    color: '#374151',
    marginBottom: '8px'
  },
  changeBox: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px'
  },
  oldValue: {
    padding: '8px 12px',
    background: '#fee2e2',
    borderRadius: '6px',
    color: '#991b1b'
  },
  newValue: {
    padding: '8px 12px',
    background: '#d1fae5',
    borderRadius: '6px',
    color: '#065f46'
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#6b7280'
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px',
    color: '#6b7280',
    background: '#f9fafb',
    borderRadius: '8px'
  },
  badge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    background: '#dbeafe',
    color: '#1d4ed8',
    marginLeft: '8px'
  }
};

const AMENDMENT_TYPES = [
  { value: 'price_change', label: 'Price Change', fields: ['annual_value', 'monthly_value'] },
  { value: 'term_extension', label: 'Term Extension', fields: ['end_date'] },
  { value: 'seats_change', label: 'Seats Change', fields: ['included_seats'] },
  { value: 'limit_change', label: 'Resource Limit Change', fields: ['included_requests', 'included_storage_gb'] },
  { value: 'other', label: 'Other', fields: [] }
];

const ContractAmendments = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    amendmentType: 'price_change',
    description: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    newValue: {}
  });

  const fetchContract = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprise/contracts/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContract(data.data);
        setAmendments(data.data.amendments || []);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/enterprise/contracts/${id}/amend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Amendment created successfully');
        setFormData({
          amendmentType: 'price_change',
          description: '',
          effectiveDate: new Date().toISOString().split('T')[0],
          newValue: {}
        });
        fetchContract();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create amendment');
      }
    } catch (error) {
      console.error('Error creating amendment:', error);
      alert('Failed to create amendment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewValueChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      newValue: {
        ...prev.newValue,
        [field]: value
      }
    }));
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  };

  const formatValue = (value) => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const selectedType = AMENDMENT_TYPES.find(t => t.value === formData.amendmentType);

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading...</div></div>;
  }

  if (!contract) {
    return <div style={styles.container}><div style={styles.loading}>Contract not found</div></div>;
  }

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={() => navigate(`/enterprise/contracts/${id}`)}>
        Back to Contract
      </button>

      <h1 style={styles.title}>Contract Amendment</h1>
      <p style={styles.subtitle}>Create an amendment for {contract.contract_number}</p>

      {/* Amendment Form */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>New Amendment</h3>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Amendment Type</label>
            <select
              style={styles.select}
              value={formData.amendmentType}
              onChange={e => setFormData(prev => ({ ...prev, amendmentType: e.target.value, newValue: {} }))}
            >
              {AMENDMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              style={styles.textarea}
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the amendment..."
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Effective Date</label>
            <input
              type="date"
              style={styles.input}
              value={formData.effectiveDate}
              onChange={e => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
              required
            />
          </div>

          {/* Dynamic fields based on amendment type */}
          {selectedType?.fields.map(field => (
            <div key={field} style={styles.formGroup}>
              <label style={styles.label}>
                New {field.replace(/_/g, ' ')}
                <span style={styles.badge}>
                  Current: {contract[field] || 'N/A'}
                </span>
              </label>
              <input
                style={styles.input}
                type={field.includes('date') ? 'date' : 'number'}
                value={formData.newValue[field] || ''}
                onChange={e => handleNewValueChange(field, e.target.value)}
                placeholder={`Enter new ${field.replace(/_/g, ' ')}`}
              />
            </div>
          ))}

          <button
            type="submit"
            style={styles.submitButton}
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Amendment'}
          </button>
        </form>
      </div>

      {/* Amendment History */}
      <div style={styles.amendmentHistory}>
        <h2 style={styles.historyTitle}>Amendment History</h2>
        {amendments.length === 0 ? (
          <div style={styles.emptyState}>No amendments yet</div>
        ) : (
          amendments.map(amendment => (
            <div key={amendment.id} style={styles.amendmentItem}>
              <div style={styles.amendmentHeader}>
                <span style={styles.amendmentType}>
                  {AMENDMENT_TYPES.find(t => t.value === amendment.amendment_type)?.label || amendment.amendment_type}
                </span>
                <span style={styles.amendmentDate}>
                  Effective: {formatDate(amendment.effective_date)}
                </span>
              </div>
              <div style={styles.amendmentDesc}>{amendment.description}</div>
              <div style={styles.changeBox}>
                <div style={styles.oldValue}>
                  <strong>Old:</strong> {formatValue(amendment.old_value)}
                </div>
                <div style={styles.newValue}>
                  <strong>New:</strong> {formatValue(amendment.new_value)}
                </div>
              </div>
              <div style={{fontSize: '12px', color: '#6b7280', marginTop: '8px'}}>
                Approved by {amendment.approved_by} on {formatDate(amendment.approved_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContractAmendments;
