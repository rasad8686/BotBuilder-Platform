import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Mail,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import api from '../../api/axios';

const UnsubscribePage = () => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, confirm, success, already, error
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const reasons = [
    { value: 'too_many', label: 'Too many emails' },
    { value: 'not_relevant', label: 'Content not relevant' },
    { value: 'never_signed_up', label: 'I never signed up' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await api.get(`/api/public/email/unsubscribe/${token}`);
        // The backend returns HTML, so we need to check the response differently
        // For now, we'll assume the token is valid and show the confirm form
        setEmail(searchParams.get('email') || 'your email');
        setStatus('confirm');
      } catch (error) {
        if (error.response?.status === 404) {
          setErrorMessage('This unsubscribe link is invalid or expired.');
        } else {
          setErrorMessage('An error occurred. Please try again later.');
        }
        setStatus('error');
      }
    };

    if (token) {
      verifyToken();
    } else {
      setStatus('error');
      setErrorMessage('Invalid unsubscribe link.');
    }
  }, [token, searchParams]);

  const handleUnsubscribe = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await api.post(`/api/public/email/unsubscribe/${token}`, {
        reason,
        feedback
      });
      setStatus('success');
    } catch (error) {
      if (error.response?.data?.message?.includes('already')) {
        setStatus('already');
      } else {
        setErrorMessage(error.response?.data?.message || 'Failed to unsubscribe. Please try again.');
        setStatus('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResubscribe = async () => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/public/email/resubscribe/${token}`);
      // Redirect to homepage or show success
      window.location.href = '/';
    } catch (error) {
      setErrorMessage('Failed to resubscribe. Please contact support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Verifying your request...</p>
          </div>
        );

      case 'confirm':
        return (
          <form onSubmit={handleUnsubscribe}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-orange-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Unsubscribe</h1>
              <p className="text-gray-500">
                Are you sure you want to unsubscribe <strong className="text-gray-700">{email}</strong> from our mailing list?
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Help us improve! Why did you unsubscribe?
                </label>
                <div className="space-y-2">
                  {reasons.map((r) => (
                    <label
                      key={r.value}
                      className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-gray-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {reason === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional feedback (optional)
                  </label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Tell us more..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                'Unsubscribe'
              )}
            </button>
          </form>
        );

      case 'success':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You've been unsubscribed</h1>
            <p className="text-gray-500 mb-6">
              You will no longer receive marketing emails from us.
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Email: <strong>{email}</strong>
            </p>
            <button
              onClick={handleResubscribe}
              disabled={isSubmitting}
              className="text-blue-600 hover:underline text-sm"
            >
              Changed your mind? Resubscribe
            </button>
          </div>
        );

      case 'already':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Unsubscribed</h1>
            <p className="text-gray-500 mb-6">
              This email address is already unsubscribed from our mailing list.
            </p>
            <p className="text-sm text-gray-400 mb-4">
              Email: <strong>{email}</strong>
            </p>
            <button
              onClick={handleResubscribe}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
            >
              Want to resubscribe? <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-500 mb-6">{errorMessage}</p>
            <a
              href="/"
              className="text-blue-600 hover:underline text-sm"
            >
              Return to homepage
            </a>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-xl font-bold text-gray-900">BotBuilder</span>
        </div>

        {renderContent()}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            If you have any questions, please contact our support team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UnsubscribePage;
