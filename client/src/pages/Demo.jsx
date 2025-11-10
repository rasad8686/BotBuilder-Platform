import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaRobot, FaSpinner } from 'react-icons/fa';

/**
 * Demo Page - Auto-login to demo account
 * Automatically logs in to demo@botbuilder.com and redirects to dashboard
 */
function Demo() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Preparing demo account...');

  useEffect(() => {
    loginToDemo();
  }, []);

  const loginToDemo = async () => {
    try {
      setStatus('loading');
      setMessage('Logging in to demo account...');

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      const response = await fetch(`${API_URL}/api/auth/demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to log in to demo account');
      }

      if (data.success) {
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('isDemo', 'true'); // Flag for demo mode

        setStatus('success');
        setMessage('Demo account loaded! Redirecting to dashboard...');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        throw new Error(data.message || 'Failed to log in to demo account');
      }

    } catch (error) {
      console.error('Demo login error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to load demo account. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
              <FaRobot className="text-3xl text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              BotBuilder Demo
            </h1>
            <p className="text-gray-600">
              Experience the full platform with sample data
            </p>
          </div>

          {/* Status Message */}
          <div className="text-center">
            {status === 'loading' && (
              <div>
                <FaSpinner className="animate-spin text-4xl text-purple-600 mx-auto mb-4" />
                <p className="text-gray-700 font-medium">{message}</p>
                <p className="text-sm text-gray-500 mt-2">
                  This may take a few seconds...
                </p>
              </div>
            )}

            {status === 'success' && (
              <div>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-gray-700 font-medium">{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium mb-4">{message}</p>
                <div className="space-y-2">
                  <button
                    onClick={loginToDemo}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Demo Info */}
          {status === 'loading' && (
            <div className="mt-8 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-900 mb-2">What's included:</h3>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>✓ Sample chatbot with AI configuration</li>
                <li>✓ Real conversation examples</li>
                <li>✓ Analytics and usage data</li>
                <li>✓ Full platform features</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Demo accounts are read-only with limited actions
        </p>
      </div>
    </div>
  );
}

export default Demo;
