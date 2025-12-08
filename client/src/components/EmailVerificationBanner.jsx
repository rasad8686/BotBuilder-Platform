import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function EmailVerificationBanner({ user, onDismiss }) {
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isVerified, setIsVerified] = useState(user?.isVerified || false);

  // Update isVerified when user prop changes
  useEffect(() => {
    if (user?.isVerified) {
      setIsVerified(true);
    }
  }, [user?.isVerified]);

  // Don't show if user is verified or banner is dismissed
  if (!user || isVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });

      const data = await res.json();
      if (data.success) {
        // If already verified, hide banner and update localStorage
        if (data.alreadyVerified) {
          setIsVerified(true);
          // Update localStorage
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              userData.isVerified = true;
              localStorage.setItem('user', JSON.stringify(userData));
            } catch (e) {
              // Silent fail
            }
          }
          return;
        }
        setResendSuccess(true);
        // Auto-hide success message after 5 seconds
        setTimeout(() => setResendSuccess(false), 5000);
      }
    } catch (err) {
      console.error('Failed to resend verification email:', err);
    } finally {
      setResending(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <div style={styles.iconWrapper}>
          <span style={styles.icon}>!</span>
        </div>
        <div style={styles.textWrapper}>
          <p style={styles.message}>
            {t('emailVerification.bannerMessage', 'Please verify your email address to access all features.')}
          </p>
          {resendSuccess ? (
            <span style={styles.successText}>
              {t('emailVerification.resendSuccess', 'Verification email sent!')}
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              style={styles.resendButton}
            >
              {resending
                ? t('common.loading', 'Loading...')
                : t('emailVerification.resendLink', 'Resend verification email')}
            </button>
          )}
        </div>
      </div>
      <button onClick={handleDismiss} style={styles.dismissButton} aria-label="Dismiss">
        x
      </button>
    </div>
  );
}

const styles = {
  banner: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '0 0 16px 0'
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  iconWrapper: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  icon: {
    color: '#fbbf24',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  textWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap'
  },
  message: {
    color: '#fbbf24',
    fontSize: '14px',
    margin: 0
  },
  resendButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fbbf24',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0
  },
  successText: {
    color: '#10b981',
    fontSize: '14px',
    fontWeight: '500'
  },
  dismissButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#fbbf24',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    opacity: 0.7
  }
};
