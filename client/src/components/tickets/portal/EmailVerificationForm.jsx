/**
 * Email Verification Form Component
 * Email input with OTP verification
 */

import React, { useState, useRef, useEffect } from 'react';

const EmailVerificationForm = ({ workspaceId, onSuccess }) => {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  const codeInputRefs = useRef([]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Validate email
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Request verification code
  const handleRequestCode = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/public/tickets/auth/request-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          workspaceId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send verification code');
      }

      setStep('code');
      setResendTimer(60);
      // Focus first code input
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Verify code
  const handleVerifyCode = async (fullCode) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/public/tickets/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: fullCode,
          workspaceId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid or expired code');
      }

      const data = await response.json();
      onSuccess(data);
    } catch (err) {
      setError(err.message);
      // Clear code on error
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Handle code input change
  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode);
      }
    }
  };

  // Handle code input keydown
  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newCode = [...code];
      for (let i = 0; i < pasted.length; i++) {
        newCode[i] = pasted[i];
      }
      setCode(newCode);

      // Focus appropriate input or submit
      if (pasted.length === 6) {
        handleVerifyCode(pasted);
      } else {
        codeInputRefs.current[pasted.length]?.focus();
      }
    }
  };

  // Resend code
  const handleResend = async () => {
    if (resendTimer > 0) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/public/tickets/auth/request-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          workspaceId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to resend code');
      }

      setResendTimer(60);
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Go back to email step
  const handleBack = () => {
    setStep('email');
    setCode(['', '', '', '', '', '']);
    setError(null);
  };

  return (
    <div style={styles.container}>
      {step === 'email' ? (
        <form onSubmit={handleRequestCode} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              style={{
                ...styles.input,
                ...(error && styles.inputError),
              }}
              placeholder="you@example.com"
              disabled={loading}
              autoFocus
            />
            {error && <span style={styles.errorText}>{error}</span>}
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(loading && styles.buttonLoading),
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span style={styles.spinner}></span>
                Sending...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      ) : (
        <div style={styles.codeContainer}>
          {/* Back button */}
          <button type="button" style={styles.backButton} onClick={handleBack}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Change email
          </button>

          {/* Email display */}
          <p style={styles.codeSentText}>
            We sent a 6-digit code to <strong>{email}</strong>
          </p>

          {/* Code inputs */}
          <div style={styles.codeInputs}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (codeInputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleCodeKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                style={{
                  ...styles.codeInput,
                  ...(error && styles.codeInputError),
                }}
                disabled={loading}
              />
            ))}
          </div>

          {/* Error */}
          {error && <p style={styles.errorMessage}>{error}</p>}

          {/* Resend */}
          <div style={styles.resendContainer}>
            <span style={styles.resendText}>Didn't receive the code?</span>
            {resendTimer > 0 ? (
              <span style={styles.resendTimer}>Resend in {resendTimer}s</span>
            ) : (
              <button
                type="button"
                style={styles.resendButton}
                onClick={handleResend}
                disabled={loading}
              >
                Resend code
              </button>
            )}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div style={styles.verifyingContainer}>
              <span style={styles.spinner}></span>
              <span>Verifying...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '360px',
    margin: '0 auto',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    textAlign: 'center',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: '12px',
    color: '#ef4444',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  codeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '13px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  codeSentText: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    margin: 0,
  },
  codeInputs: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
  },
  codeInput: {
    width: '44px',
    height: '52px',
    textAlign: 'center',
    fontSize: '20px',
    fontWeight: '600',
    border: '2px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  codeInputError: {
    borderColor: '#ef4444',
  },
  errorMessage: {
    fontSize: '13px',
    color: '#ef4444',
    margin: 0,
    textAlign: 'center',
  },
  resendContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
  },
  resendText: {
    fontSize: '13px',
    color: '#6b7280',
  },
  resendTimer: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  resendButton: {
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    color: '#7c3aed',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  verifyingContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#6b7280',
    fontSize: '14px',
    marginTop: '8px',
  },
};

export default EmailVerificationForm;
