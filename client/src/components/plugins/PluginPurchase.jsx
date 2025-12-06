import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginPurchase = ({ plugin, onPurchaseComplete, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState('preview'); // preview, processing, success, error
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');

  const handlePurchase = async () => {
    setLoading(true);
    setPaymentStep('processing');
    setError(null);

    try {
      // Create checkout session
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/marketplace?purchase=success&plugin=${plugin.id}`,
          cancelUrl: `${window.location.origin}/marketplace?purchase=cancelled`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      // If we have a Stripe checkout URL, redirect to it
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // For mock payments (development), complete immediately
      if (data.sessionId && data.sessionId.includes('mock')) {
        await completeMockPurchase(data.sessionId);
      }

    } catch (err) {
      // Silent fail
      setError(err.message);
      setPaymentStep('error');
    } finally {
      setLoading(false);
    }
  };

  const completeMockPurchase = async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/api/plugins/purchase/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        setPaymentStep('success');
        setTimeout(() => {
          onPurchaseComplete && onPurchaseComplete(plugin);
        }, 2000);
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete purchase');
      }
    } catch (err) {
      setError(err.message);
      setPaymentStep('error');
    }
  };

  const renderPreview = () => (
    <>
      <div className="plugin-preview">
        <div className="plugin-icon">
          {plugin.icon_url ? (
            <img src={plugin.icon_url} alt={plugin.name} />
          ) : (
            <span className="default-icon">🧩</span>
          )}
        </div>
        <div className="plugin-info">
          <h3>{plugin.name}</h3>
          <p className="plugin-version">v{plugin.version}</p>
          <p className="plugin-description">{plugin.description}</p>
        </div>
      </div>

      <div className="price-breakdown">
        <div className="price-row">
          <span>Plugin Price</span>
          <span className="price">${plugin.price.toFixed(2)}</span>
        </div>
        <div className="price-row total">
          <span>Total</span>
          <span className="price">${plugin.price.toFixed(2)} USD</span>
        </div>
      </div>

      <div className="payment-info">
        <div className="secure-badge">
          <span className="lock-icon">🔒</span>
          <span>Secure checkout powered by Stripe</span>
        </div>
        <p className="payment-note">
          You will be redirected to Stripe to complete your purchase securely.
        </p>
      </div>

      <div className="purchase-actions">
        <button className="btn-cancel" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-purchase"
          onClick={handlePurchase}
          disabled={loading}
        >
          {loading ? 'Processing...' : `Pay $${plugin.price.toFixed(2)}`}
        </button>
      </div>

      <p className="terms-note">
        By purchasing, you agree to our Terms of Service and Privacy Policy.
        All sales are final.
      </p>
    </>
  );

  const renderProcessing = () => (
    <div className="processing-state">
      <div className="spinner-large"></div>
      <h3>Processing Payment</h3>
      <p>Please wait while we process your payment...</p>
      <p className="redirect-note">You will be redirected to complete payment.</p>
    </div>
  );

  const renderSuccess = () => (
    <div className="success-state">
      <div className="success-icon">✓</div>
      <h3>Purchase Complete!</h3>
      <p>Thank you for your purchase.</p>
      <p className="plugin-name">{plugin.name} has been added to your account.</p>
      <button className="btn-done" onClick={onClose}>
        Start Using Plugin
      </button>
    </div>
  );

  const renderError = () => (
    <div className="error-state">
      <div className="error-icon">✕</div>
      <h3>Payment Failed</h3>
      <p className="error-message">{error}</p>
      <div className="error-actions">
        <button className="btn-retry" onClick={() => {
          setPaymentStep('preview');
          setError(null);
        }}>
          Try Again
        </button>
        <button className="btn-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <div className="purchase-overlay" onClick={onClose}>
      <div className="purchase-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Purchase Plugin</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {paymentStep === 'preview' && renderPreview()}
          {paymentStep === 'processing' && renderProcessing()}
          {paymentStep === 'success' && renderSuccess()}
          {paymentStep === 'error' && renderError()}
        </div>

        <style>{`
          .purchase-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .purchase-modal {
            background: white;
            border-radius: 16px;
            width: 100%;
            max-width: 480px;
            overflow: hidden;
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 20px;
            color: #1a1a2e;
          }

          .close-btn {
            background: none;
            border: none;
            font-size: 28px;
            color: #6b7280;
            cursor: pointer;
          }

          .modal-content {
            padding: 24px;
          }

          .plugin-preview {
            display: flex;
            gap: 16px;
            padding: 20px;
            background: #f9fafb;
            border-radius: 12px;
            margin-bottom: 24px;
          }

          .plugin-icon {
            width: 64px;
            height: 64px;
            border-radius: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            flex-shrink: 0;
          }

          .plugin-icon img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .default-icon {
            font-size: 32px;
          }

          .plugin-info h3 {
            margin: 0 0 4px 0;
            font-size: 18px;
            color: #1a1a2e;
          }

          .plugin-version {
            margin: 0 0 8px 0;
            font-size: 13px;
            color: #6b7280;
          }

          .plugin-description {
            margin: 0;
            font-size: 14px;
            color: #4b5563;
            line-height: 1.4;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .price-breakdown {
            background: #f9fafb;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
          }

          .price-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
            color: #4b5563;
          }

          .price-row.total {
            border-top: 1px solid #e5e7eb;
            margin-top: 8px;
            padding-top: 16px;
            font-weight: 600;
            color: #1a1a2e;
          }

          .price-row .price {
            font-weight: 600;
          }

          .price-row.total .price {
            color: #667eea;
            font-size: 18px;
          }

          .payment-info {
            margin-bottom: 24px;
          }

          .secure-badge {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: #ecfdf5;
            border-radius: 8px;
            margin-bottom: 12px;
          }

          .lock-icon {
            font-size: 18px;
          }

          .secure-badge span:last-child {
            font-size: 14px;
            color: #059669;
            font-weight: 500;
          }

          .payment-note {
            font-size: 13px;
            color: #6b7280;
            margin: 0;
          }

          .purchase-actions {
            display: flex;
            gap: 12px;
          }

          .btn-cancel {
            flex: 1;
            padding: 14px;
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .btn-purchase {
            flex: 2;
            padding: 14px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }

          .btn-purchase:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }

          .btn-purchase:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .terms-note {
            margin: 16px 0 0 0;
            font-size: 11px;
            color: #9ca3af;
            text-align: center;
          }

          /* Processing State */
          .processing-state,
          .success-state,
          .error-state {
            text-align: center;
            padding: 40px 20px;
          }

          .spinner-large {
            width: 60px;
            height: 60px;
            border: 4px solid #e5e7eb;
            border-top-color: #667eea;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 24px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }

          .processing-state h3,
          .success-state h3,
          .error-state h3 {
            margin: 0 0 8px 0;
            color: #1a1a2e;
          }

          .processing-state p,
          .success-state p,
          .error-state p {
            margin: 0;
            color: #6b7280;
          }

          .redirect-note {
            font-size: 13px;
            margin-top: 16px !important;
          }

          /* Success State */
          .success-icon {
            width: 64px;
            height: 64px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 24px;
          }

          .success-state .plugin-name {
            font-weight: 500;
            color: #1a1a2e;
            margin-top: 8px !important;
          }

          .btn-done {
            margin-top: 24px;
            padding: 14px 32px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          }

          /* Error State */
          .error-icon {
            width: 64px;
            height: 64px;
            background: #dc2626;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin: 0 auto 24px;
          }

          .error-message {
            color: #dc2626 !important;
            font-weight: 500;
          }

          .error-actions {
            display: flex;
            gap: 12px;
            justify-content: center;
            margin-top: 24px;
          }

          .btn-retry {
            padding: 12px 24px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }

          .error-actions .btn-cancel {
            flex: none;
            padding: 12px 24px;
          }
        `}</style>
      </div>
    </div>
  );
};

export default PluginPurchase;
