import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const PluginInstallButton = ({
  plugin,
  isInstalled = false,
  isPurchased = false,
  onInstall,
  onUninstall,
  size = 'medium', // small, medium, large
  showPrice = true
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = localStorage.getItem('token');

  const handleClick = async () => {
    if (!token) {
      navigate('/login');
      return;
    }

    // If paid plugin and not purchased, redirect to purchase
    if (!plugin.is_free && !isPurchased && !isInstalled) {
      navigate(`/plugins/${plugin.id}/purchase`);
      return;
    }

    if (isInstalled) {
      setShowConfirm(true);
      return;
    }

    // Install
    await handleInstall();
  };

  const handleInstall = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/install`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        onInstall && onInstall(plugin);
      } else {
        const error = await response.json();
        console.error('Install error:', error);
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/plugins/${plugin.id}/uninstall`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        onUninstall && onUninstall(plugin);
      }
    } catch (error) {
      console.error('Uninstall failed:', error);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    if (isInstalled) return 'Installed';
    if (!plugin.is_free && !isPurchased) {
      return showPrice ? `$${plugin.price}` : 'Get';
    }
    return 'Install';
  };

  const getButtonClass = () => {
    let classes = ['plugin-install-btn', size];
    if (isInstalled) classes.push('installed');
    if (!plugin.is_free && !isPurchased) classes.push('paid');
    if (loading) classes.push('loading');
    return classes.join(' ');
  };

  return (
    <>
      <button
        className={getButtonClass()}
        onClick={handleClick}
        disabled={loading}
      >
        {getButtonText()}
      </button>

      {showConfirm && (
        <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h4>Uninstall Plugin</h4>
            <p>Are you sure you want to uninstall <strong>{plugin.name}</strong>?</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleUninstall} disabled={loading}>
                {loading ? 'Uninstalling...' : 'Uninstall'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .plugin-install-btn {
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          background: #667eea;
          color: white;
        }

        .plugin-install-btn.small {
          padding: 6px 12px;
          font-size: 12px;
        }

        .plugin-install-btn.medium {
          padding: 10px 20px;
          font-size: 14px;
        }

        .plugin-install-btn.large {
          padding: 14px 28px;
          font-size: 16px;
        }

        .plugin-install-btn:hover:not(:disabled) {
          background: #5a6fd6;
          transform: translateY(-1px);
        }

        .plugin-install-btn.installed {
          background: #10b981;
        }

        .plugin-install-btn.installed:hover:not(:disabled) {
          background: #dc2626;
        }

        .plugin-install-btn.paid {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .plugin-install-btn.paid:hover:not(:disabled) {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        }

        .plugin-install-btn.loading {
          opacity: 0.7;
          cursor: wait;
        }

        .plugin-install-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .confirm-overlay {
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

        .confirm-modal {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 360px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }

        .confirm-modal h4 {
          margin: 0 0 12px 0;
          color: #1a1a2e;
        }

        .confirm-modal p {
          margin: 0 0 20px 0;
          color: #6b7280;
        }

        .confirm-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn-cancel,
        .btn-confirm {
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

        .btn-confirm {
          background: #dc2626;
          color: white;
        }

        .btn-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </>
  );
};

export default PluginInstallButton;
