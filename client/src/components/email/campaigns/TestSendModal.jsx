import React, { useState } from 'react';
import { X, Send, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useTestSendMutation } from '../../../hooks/email/useCampaigns';

const TestSendModal = ({ campaignData, onClose }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle, sending, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const testSendMutation = useTestSendMutation();

  const handleSend = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter an email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setStatus('sending');
    setErrorMessage('');

    try {
      await testSendMutation.mutateAsync({
        email,
        subject: campaignData.subject,
        content_html: campaignData.content_html,
        from_name: campaignData.from_name,
        from_email: campaignData.from_email
      });
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Failed to send test email');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Send Test Email</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === 'success' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-1">Test Email Sent!</h4>
            <p className="text-sm text-gray-500 mb-4">
              Check your inbox at <strong>{email}</strong>
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  setStatus('idle');
                  setEmail('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Send Another
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="your@email.com"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errorMessage ? 'border-red-300' : 'border-gray-200'
                }`}
                disabled={status === 'sending'}
              />
              {errorMessage && (
                <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errorMessage}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Test email will include:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>- Subject: {campaignData.subject || 'No subject'}</li>
                <li>- From: {campaignData.from_name} &lt;{campaignData.from_email}&gt;</li>
                <li>- Personalization tags replaced with sample data</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={status === 'sending'}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={status === 'sending'}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {status === 'sending' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Test
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TestSendModal;
