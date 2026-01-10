/**
 * OAuth Callback Handler
 * Handles redirect from OAuth providers (Google, Microsoft)
 * Extracts token from URL and stores in localStorage
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bot, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(getErrorMessage(error));
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage('No authentication token received');
        setTimeout(() => navigate('/login'), 3000);
        return;
      }

      try {
        // Clear old auth data first (including demo flag)
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('currentOrganizationId');
        localStorage.removeItem('isDemo');

        // Store new token in localStorage
        localStorage.setItem('token', token);

        // Decode token to get user info (JWT payload is base64 encoded)
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Store user info
        localStorage.setItem('user', JSON.stringify({
          id: payload.id,
          email: payload.email,
          name: payload.name
        }));

        // Store organization ID if available
        if (payload.organizationId) {
          localStorage.setItem('currentOrganizationId', payload.organizationId);
        }

        setStatus('success');

        // Redirect to dashboard after short delay
        // Use window.location.href for full page reload to ensure localStorage is read correctly
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } catch (err) {
        console.error('Error processing OAuth callback:', err);
        setStatus('error');
        setErrorMessage('Failed to process authentication');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  const getErrorMessage = (error) => {
    switch (error) {
      case 'oauth_failed':
        return 'OAuth authentication failed. Please try again.';
      case 'google_auth_failed':
        return 'Google authentication failed. Please try again.';
      case 'microsoft_auth_failed':
        return 'Microsoft authentication failed. Please try again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">BotBuilder</span>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-sm mx-auto">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Signing you in...
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Please wait while we complete your authentication.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Welcome!
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Authentication successful. Redirecting to dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Authentication Failed
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {errorMessage}
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-xs">
                Redirecting to login page...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
