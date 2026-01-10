import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Wrench, Lock, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenError(t('resetPassword.noToken'));
      return;
    }

    verifyToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/verify-reset-token?token=${token}`);
      const data = await res.json();

      if (data.valid) {
        setTokenValid(true);
        setEmail(data.email);
      } else {
        setTokenError(data.error || t('resetPassword.invalidToken'));
      }
    } catch (err) {
      setTokenError(t('resetPassword.verifyError'));
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError(t('resetPassword.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setError(data.error || t('resetPassword.error'));
      }
    } catch (err) {
      setError(t('resetPassword.networkError'));
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>
            <div style={styles.spinner}></div>
            <p>{t('resetPassword.verifying')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.errorBox}>
            <div style={styles.errorIcon}><XCircle size={48} className="text-red-500" /></div>
            <h2 style={styles.errorTitle}>{t('resetPassword.invalidTokenTitle')}</h2>
            <p style={styles.errorText}>{tokenError}</p>
            <Link to="/forgot-password" style={styles.retryButton}>
              {t('resetPassword.requestNewLink')}
            </Link>
          </div>
        </div>
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
            <h2 style={styles.successTitle}>{t('resetPassword.successTitle')}</h2>
            <p style={styles.successText}>{t('resetPassword.successMessage')}</p>
            <Link to="/login" style={styles.loginButton}>
              {t('resetPassword.goToLogin')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>🔑 {t('resetPassword.title')}</h1>
          <p style={styles.subtitle}>
            {t('resetPassword.subtitle')} <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('resetPassword.newPassword')}</label>
            <div style={styles.inputWrapper}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('resetPassword.newPasswordPlaceholder')}
                style={styles.input}
                required
                minLength={8}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>{t('resetPassword.confirmPassword')}</label>
            <div style={styles.inputWrapper}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                style={styles.input}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                {showConfirmPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div style={styles.requirements}>
            <p style={styles.requirementTitle}>{t('resetPassword.requirements')}</p>
            <ul style={styles.requirementList}>
              <li style={{
                ...styles.requirementItem,
                color: password.length >= 8 ? '#10b981' : '#9ca3af'
              }}>
                {password.length >= 8 ? '✓' : '○'} {t('resetPassword.minChars')}
              </li>
              <li style={{
                ...styles.requirementItem,
                color: password === confirmPassword && password.length > 0 ? '#10b981' : '#9ca3af'
              }}>
                {password === confirmPassword && password.length > 0 ? '✓' : '○'} {t('resetPassword.passwordsMatch')}
              </li>
            </ul>
          </div>

          <button
            type="submit"
            style={styles.submitButton}
            disabled={loading || password.length < 8 || password !== confirmPassword}
          >
            {loading ? t('common.loading') : t('resetPassword.resetButton')}
          </button>

          <Link to="/login" style={styles.link}>
            ← {t('resetPassword.backToLogin')}
          </Link>
        </form>
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
  inputWrapper: {
    position: 'relative'
  },
  input: {
    backgroundColor: '#1a1a24',
    border: '1px solid #2d2d3a',
    borderRadius: '8px',
    padding: '14px 16px',
    paddingRight: '48px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box'
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  requirements: {
    backgroundColor: '#1a1a24',
    borderRadius: '8px',
    padding: '12px 16px'
  },
  requirementTitle: {
    color: '#9ca3af',
    fontSize: '12px',
    margin: '0 0 8px 0'
  },
  requirementList: {
    margin: 0,
    padding: '0 0 0 16px',
    listStyle: 'none'
  },
  requirementItem: {
    fontSize: '13px',
    marginBottom: '4px'
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
  retryButton: {
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
  loginButton: {
    display: 'inline-block',
    backgroundColor: '#10b981',
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
