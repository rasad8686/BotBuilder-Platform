import React, { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';

const ICONS = {
  success: Check,
  error: X,
  warning: AlertTriangle,
  info: Info
};

const COLORS = {
  success: {
    bg: '#10b981',
    border: '#059669',
    text: '#ffffff'
  },
  error: {
    bg: '#ef4444',
    border: '#dc2626',
    text: '#ffffff'
  },
  warning: {
    bg: '#f59e0b',
    border: '#d97706',
    text: '#ffffff'
  },
  info: {
    bg: '#3b82f6',
    border: '#2563eb',
    text: '#ffffff'
  }
};

function ToastItem({ toast, onRemove }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const colors = COLORS[toast.type] || COLORS.info;

  useEffect(() => {
    if (toast.duration > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev - (100 / (toast.duration / 100));
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [toast.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        backgroundColor: colors.bg,
        borderRadius: '10px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
        minWidth: '320px',
        maxWidth: '420px',
        position: 'relative',
        overflow: 'hidden',
        animation: isExiting ? 'slideOut 0.3s ease forwards' : 'slideIn 0.3s ease',
        border: `1px solid ${colors.border}`
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          color: colors.text,
          flexShrink: 0
        }}
      >
        {React.createElement(ICONS[toast.type] || ICONS.info, { size: 14 })}
      </div>

      {/* Message */}
      <div style={{ flex: 1, color: colors.text, fontSize: '14px', lineHeight: '1.5' }}>
        {toast.message}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          background: 'rgba(255, 255, 255, 0.2)',
          border: 'none',
          borderRadius: '50%',
          width: '22px',
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: colors.text,
          fontSize: '14px',
          flexShrink: 0,
          transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
      >
        <X size={12} />
      </button>

      {/* Progress bar */}
      {toast.duration > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
            width: `${progress}%`,
            transition: 'width 0.1s linear'
          }}
        />
      )}
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useNotification();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </>
  );
}
