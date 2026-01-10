import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [error, setError] = useState('');
  const [_email, setEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendEmail, setResendEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setError(t('verifyEmail.noToken', 'No verification token provided'));
      return;
    }

    verifyToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-email?token=${token}`);
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setEmail(data.email || '');
        if (data.alreadyVerified) {
          setAlreadyVerified(true);
        }
      } else {
        setError(data.error || t('verifyEmail.invalidToken', 'Invalid or expired token'));
      }
    } catch (err) {
      setError(t('verifyEmail.networkError', 'Network error. Please try again.'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResending(true);
    setResendSuccess(false);

    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail })
      });

      const data = await res.json();
      if (data.success) {
        setResendSuccess(true);
      }
    } catch (err) {
      // Still show success to prevent email enumeration
      setResendSuccess(true);
    } finally {
      setResending(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <p>{t('verifyEmail.verifying', 'Verifying your email...')}</p>
          </div>
        </div>
        <style>{spinnerKeyframes}</style>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successBox}>
            <div style={styles.successIcon}><CheckCircle size={48} className="text-green-500" /></div>
            <h2 style={styles.successTitle}>
              {alreadyVerified
                ? t('verifyEmail.alreadyVerifiedTitle', 'Already Verified')
                : t('verifyEmail.successTitle', 'Email Verified!')}
            </h2>
            <p style={styles.successText}>
              {alreadyVerified
                ? t('verifyEmail.alreadyVerifiedMessage', 'Your email has already been verified.')
                : t('verifyEmail.successMessage', 'Your email has been verified successfully. You can now access all features.')}
            </p>
            <Link to="/dashboard" style={styles.dashboardButton}>
              {t('verifyEmail.goToDashboard', 'Go to Dashboard')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Error state with resend option
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.errorBox}>
          <div style={styles.errorIcon}><XCircle size={48} className="text-red-500" /></div>
          <h2 style={styles.errorTitle}>{t('verifyEmail.errorTitle', 'Verification Failed')}</h2>
          <p style={styles.errorText}>{error}</p>

          <div style={styles.resendSection}>
            <p style={styles.resendTitle}>
              {t('verifyEmail.resendTitle', 'Need a new verification link?')}
            </p>

            {resendSuccess ? (
              <div style={styles.resendSuccessBox}>
                <p style={styles.resendSuccessText}>
                  {t('verifyEmail.resendSuccess', 'If an account exists with this email, you will receive a new verification link.')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleResend} style={styles.resendForm}>
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder={t('verifyEmail.emailPlaceholder', 'Enter your email')}
                  style={styles.input}
                  required
                />
                <button
                  type="submit"
                  style={styles.resendButton}
                  disabled={resending || !resendEmail}
                >
                  {resending
                    ? t('common.loading', 'Loading...')
                    : t('verifyEmail.resendButton', 'Resend Verification Email')}
                </button>
              </form>
            )}
          </div>

          <Link to="/login" style={styles.link}>
            ← {t('verifyEmail.backToLogin', 'Back to Login')}
          </Link>
        </div>
      </div>
      <style>{spinnerKeyframes}</style>
    </div>
  );
}

const spinnerKeyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
    padding: '20px'
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#12121a',
    borderRadius: '16px',
    padding: '40px',
    border: '1px solid #2d2d3a'
  },
  loading: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#9ca3af'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #2d2d3a',
    borderTop: '3px solid #8b5cf6',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite'
  },
  successBox: {
    textAlign: 'center',
    padding: '20px 0'
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  successTitle: {
    color: '#10b981',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 12px 0'
  },
  successText: {
    color: '#9ca3af',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 24px 0'
  },
  dashboardButton: {
    display: 'inline-block',
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    cursor: 'pointer'
  },
  errorBox: {
    textAlign: 'center',
    padding: '20px 0'
  },
  errorIcon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  errorTitle: {
    color: '#ef4444',
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 12px 0'
  },
  errorText: {
    color: '#9ca3af',
    fontSize: '14px',
    lineHeight: '1.6',
    margin: '0 0 24px 0'
  },
  resendSection: {
    backgroundColor: '#1a1a24',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px'
  },
  resendTitle: {
    color: '#e5e7eb',
    fontSize: '14px',
    fontWeight: '500',
    margin: '0 0 16px 0'
  },
  resendForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  input: {
    backgroundColor: '#12121a',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none'
  },
  resendButton: {
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
  },
  resendSuccessBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '8px',
    padding: '12px'
  },
  resendSuccessText: {
    color: '#10b981',
    fontSize: '14px',
    margin: 0
  },
  link: {
    color: '#8b5cf6',
    textDecoration: 'none',
    fontSize: '14px'
  }
};
