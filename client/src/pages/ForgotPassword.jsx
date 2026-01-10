import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Development mode states
  const [devMode, setDevMode] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });

      const data = await res.json();

      if (res.ok) {
        // Check if development mode with token
        if (data.devMode && data.token) {
          setDevMode(true);
          setToken(data.token);
        } else {
          setSuccess(true);
        }
      } else {
        setError(data.error || t('forgotPassword.error'));
      }
    } catch (err) {
      setError(t('forgotPassword.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError(t('errors.passwordsMismatch'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }

    setResetLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: newPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResetSuccess(true);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      setError(t('errors.networkError'));
    } finally {
      setResetLoading(false);
    }
  };

  // Reset success view
  if (resetSuccess) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successBox}>
            <div style={styles.successIcon}><CheckCircle size={48} className="text-green-500" /></div>
            <h2 style={styles.successTitle}>Password Reset Successful!</h2>
            <p style={styles.successText}>Your password has been changed. You can now login with your new password.</p>
            <Link to="/login" style={styles.backButton}>
              → Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Development mode - show reset form directly
  if (devMode) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.header}>
            <div style={styles.devBadge}>🔧 DEV MODE</div>
            <h1 style={styles.title}>🔐 Reset Password</h1>
            <p style={styles.subtitle}>Enter your new password below</p>
          </div>

          <form onSubmit={handleResetPassword} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={styles.input}
                required
                minLength={8}
                autoFocus
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                style={styles.input}
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              style={styles.submitButton}
              disabled={resetLoading || !newPassword || !confirmPassword}
            >
              {resetLoading ? 'Resetting...' : 'Reset Password'}
            </button>

            <Link to="/login" style={styles.link}>
              ← Back to Login
            </Link>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>🔐 {t('forgotPassword.title')}</h1>
          <p style={styles.subtitle}>{t('forgotPassword.subtitle')}</p>
        </div>

        {success ? (
          <div style={styles.successBox}>
            <div style={styles.successIcon}><CheckCircle size={48} className="text-green-500" /></div>
            <h2 style={styles.successTitle}>{t('forgotPassword.successTitle')}</h2>
            <p style={styles.successText}>{t('forgotPassword.successMessage')}</p>
            <Link to="/login" style={styles.backButton}>
              ← {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formGroup}>
              <label style={styles.label}>{t('forgotPassword.emailLabel')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('forgotPassword.emailPlaceholder')}
                style={styles.input}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              style={styles.submitButton}
              disabled={loading || !email.trim()}
            >
              {loading ? t('common.loading') : t('forgotPassword.sendButton')}
            </button>

            <Link to="/login" style={styles.link}>
              ← {t('forgotPassword.backToLogin')}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

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
  header: {
    textAlign: 'center',
    marginBottom: '32px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    margin: '0 0 8px 0'
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: '14px',
    margin: 0
  },
  devBadge: {
    display: 'inline-block',
    backgroundColor: '#f59e0b',
    color: '#000',
    fontSize: '12px',
    fontWeight: '700',
    padding: '4px 12px',
    borderRadius: '20px',
    marginBottom: '16px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    color: '#e5e7eb',
    fontSize: '14px',
    fontWeight: '500'
  },
  input: {
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    padding: '14px 16px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  submitButton: {
    backgroundColor: '#8b5cf6',
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  link: {
    color: '#8b5cf6',
    textDecoration: 'none',
    fontSize: '14px',
    textAlign: 'center',
    display: 'block'
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#ef4444',
    fontSize: '14px'
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
  backButton: {
    display: 'inline-block',
    backgroundColor: '#2d2d3a',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    cursor: 'pointer'
  }
};
