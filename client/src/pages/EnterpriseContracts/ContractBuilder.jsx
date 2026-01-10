import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
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
  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '20px'
  },
  tierCard: {
    padding: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s'
  },
  tierCardSelected: {
    borderColor: '#3b82f6',
    background: '#eff6ff'
  },
  tierName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  tierPrice: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#3b82f6',
    marginTop: '4px'
  },
  tierFeature: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer'
  },
  summary: {
    position: 'sticky',
    top: '24px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid #f3f4f6',
    fontSize: '14px'
  },
  summaryLabel: {
    color: '#6b7280'
  },
  summaryValue: {
    color: '#1a1a2e',
    fontWeight: '500'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 0',
    borderTop: '2px solid #e5e7eb',
    marginTop: '8px'
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a2e'
  },
  totalValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#059669'
  },
  createButton: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '16px'
  },
  hint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px'
  },
  sliderContainer: {
    marginBottom: '16px'
  },
  slider: {
    width: '100%',
    marginTop: '8px'
  },
  sliderValue: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#6b7280'
  }
};

const TIERS = {
  starter: {
    name: 'Starter',
    annualBase: 12000,
    includedRequests: 1000000,
    includedStorageGb: 50,
    includedSeats: 10
  },
  professional: {
    name: 'Professional',
    annualBase: 36000,
    includedRequests: 5000000,
    includedStorageGb: 200,
    includedSeats: 50
  },
  enterprise: {
    name: 'Ultimate',
    annualBase: 100000,
    includedRequests: 20000000,
    includedStorageGb: 1000,
    includedSeats: 200
  }
};

const ContractBuilder = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tier: 'professional',
    contractYears: 1,
    startDate: new Date().toISOString().split('T')[0],
    autoRenew: true,
    paymentTerms: 30,
    customSeats: null,
    customRequests: null,
    customStorage: null,
    discountPercentage: 0,
    notes: ''
  });
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    calculatePricing();
  }, [formData]);

  const calculatePricing = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/enterprise/pricing/calculate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        setPricing(data.data);
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/enterprise/contracts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/enterprise/contracts/${data.data.id}`);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to create contract');
      }
    } catch (error) {
      console.error('Error creating contract:', error);
      alert('Failed to create contract');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  const selectedTier = TIERS[formData.tier];

  return (
    <div style={styles.container}>
      <button style={styles.backButton} onClick={() => navigate('/enterprise/contracts')}>
        Back to Contracts
      </button>

      <h1 style={styles.title}>Build Your Enterprise Contract</h1>
      <p style={styles.subtitle}>Configure your enterprise plan and pricing</p>

      <div style={styles.grid}>
        {/* Configuration */}
        <div>
          {/* Tier Selection */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Select Plan Tier</h3>
            <div style={styles.tierGrid}>
              {Object.entries(TIERS).map(([key, tier]) => (
                <div
                  key={key}
                  style={{
                    ...styles.tierCard,
                    ...(formData.tier === key ? styles.tierCardSelected : {})
                  }}
                  onClick={() => setFormData(prev => ({ ...prev, tier: key }))}
                >
                  <div style={styles.tierName}>{tier.name}</div>
                  <div style={styles.tierPrice}>{formatCurrency(tier.annualBase)}/yr</div>
                  <div style={styles.tierFeature}>{formatNumber(tier.includedRequests)} requests</div>
                  <div style={styles.tierFeature}>{tier.includedSeats} seats</div>
                </div>
              ))}
            </div>
          </div>

          {/* Contract Terms */}
          <div style={{...styles.card, marginTop: '16px'}}>
            <h3 style={styles.cardTitle}>Contract Terms</h3>

            <div style={styles.formGroup}>
              <label style={styles.label}>Contract Length</label>
              <select
                style={styles.select}
                value={formData.contractYears}
                onChange={e => setFormData(prev => ({ ...prev, contractYears: parseInt(e.target.value) }))}
              >
                <option value={1}>1 Year</option>
                <option value={2}>2 Years (8% discount)</option>
                <option value={3}>3 Years (15% discount)</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Start Date</label>
              <input
                type="date"
                style={styles.input}
                value={formData.startDate}
                onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Payment Terms</label>
              <select
                style={styles.select}
                value={formData.paymentTerms}
                onChange={e => setFormData(prev => ({ ...prev, paymentTerms: parseInt(e.target.value) }))}
              >
                <option value={15}>NET 15</option>
                <option value={30}>NET 30</option>
                <option value={45}>NET 45</option>
                <option value={60}>NET 60</option>
              </select>
            </div>

            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={formData.autoRenew}
                onChange={e => setFormData(prev => ({ ...prev, autoRenew: e.target.checked }))}
              />
              Auto-renew contract
            </label>
          </div>

          {/* Customization */}
          <div style={{...styles.card, marginTop: '16px'}}>
            <h3 style={styles.cardTitle}>Customize Resources</h3>

            <div style={styles.sliderContainer}>
              <label style={styles.label}>Additional Seats: {formData.customSeats || selectedTier.includedSeats}</label>
              <input
                type="range"
                style={styles.slider}
                min={selectedTier.includedSeats}
                max={selectedTier.includedSeats * 5}
                step={5}
                value={formData.customSeats || selectedTier.includedSeats}
                onChange={e => setFormData(prev => ({ ...prev, customSeats: parseInt(e.target.value) }))}
              />
              <div style={styles.sliderValue}>
                <span>{selectedTier.includedSeats} (included)</span>
                <span>{selectedTier.includedSeats * 5}</span>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Additional Discount (%)</label>
              <input
                type="number"
                style={styles.input}
                min="0"
                max="30"
                value={formData.discountPercentage}
                onChange={e => setFormData(prev => ({ ...prev, discountPercentage: parseFloat(e.target.value) || 0 }))}
              />
              <p style={styles.hint}>Contact sales for additional discounts</p>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Notes</label>
              <textarea
                style={{...styles.input, minHeight: '80px', resize: 'vertical'}}
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any special requirements..."
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div style={styles.summary}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Contract Summary</h3>

            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Plan</span>
              <span style={styles.summaryValue}>{pricing?.tier || selectedTier.name}</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Contract Term</span>
              <span style={styles.summaryValue}>{formData.contractYears} Year(s)</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>API Requests</span>
              <span style={styles.summaryValue}>{formatNumber(pricing?.includedRequests || selectedTier.includedRequests)}/mo</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Storage</span>
              <span style={styles.summaryValue}>{pricing?.includedStorageGb || selectedTier.includedStorageGb} GB</span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryLabel}>Seats</span>
              <span style={styles.summaryValue}>{pricing?.includedSeats || selectedTier.includedSeats}</span>
            </div>
            {pricing?.discountPercentage > 0 && (
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Discount</span>
                <span style={{...styles.summaryValue, color: '#059669'}}>-{pricing.discountPercentage}%</span>
              </div>
            )}

            <div style={styles.totalRow}>
              <span style={styles.totalLabel}>Annual Total</span>
              <span style={styles.totalValue}>{formatCurrency(pricing?.annualValue)}</span>
            </div>
            <div style={{textAlign: 'center', color: '#6b7280', fontSize: '14px'}}>
              {formatCurrency(pricing?.monthlyValue)}/month
            </div>

            <button
              style={styles.createButton}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractBuilder;
