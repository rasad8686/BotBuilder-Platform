import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, Sparkles, HelpCircle, Lightbulb, FileText, MessageCircle, CheckCircle, AlertTriangle, Send } from 'lucide-react';
import axios from 'axios';

// Auto-detect API URL based on environment
const getApiBaseUrl = () => {
  // If env variable is set, use it
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Auto-detect based on hostname
  const hostname = window.location.hostname;

  // Production domain
  if (hostname.includes('vercel.app') || hostname.includes('bot-builder')) {
    return 'https://botbuilder-platform.onrender.com';
  }

  // Local development
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

export default function FeedbackModal({ isOpen, onClose, userName = '', userEmail = '' }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const categories = [
    { value: 'bug', label: t('feedback.categories.bug', 'Bug Report'), Icon: Bug },
    { value: 'feature', label: t('feedback.categories.feature', 'Feature Request'), Icon: Sparkles },
    { value: 'question', label: t('feedback.categories.question', 'Question'), Icon: HelpCircle },
    { value: 'suggestion', label: t('feedback.categories.suggestion', 'Suggestion'), Icon: Lightbulb },
    { value: 'other', label: t('feedback.categories.other', 'Other'), Icon: FileText }
  ];

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setCategory('');
        setMessage('');
        setError('');
        setSuccess(false);
      }, 300); // Wait for fade out animation
    }
  }, [isOpen]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!category) {
      setError(t('feedback.errors.selectCategory', 'Please select a category'));
      return;
    }

    if (!message.trim()) {
      setError(t('feedback.errors.messageRequired', 'Please enter your message'));
      return;
    }

    if (message.trim().length < 10) {
      setError(t('feedback.errors.messageTooShort', 'Message must be at least 10 characters'));
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE_URL}/api/feedback`;

      const response = await axios.post(
        url,
        {
          category,
          message: message.trim()
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        t('feedback.errors.submitFailed', 'Failed to submit feedback. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 id="feedback-modal-title" className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-6 h-6" />
              <span>{t('feedback.title', 'Send Feedback')}</span>
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-purple-100 mt-2 text-sm">
            {t('feedback.subtitle', 'We value your feedback! Help us improve the platform.')}
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="m-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg animate-slideDown" role="status">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-300">
                  {t('feedback.success.title', 'Thank you!')}
                </h3>
                <p className="text-green-700 dark:text-green-400 text-sm">
                  {t('feedback.success.message', 'Your feedback has been submitted successfully.')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* User Info Display */}
            <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold">From:</span>
                <span>{userName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold">Email:</span>
                <span>{userEmail}</span>
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                {t('feedback.fields.category', 'Category')} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className={`p-3 rounded-lg border-2 text-left font-medium transition-all min-h-[44px] ${
                      category === cat.value
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-slate-600 hover:border-purple-300 text-gray-700 dark:text-gray-300'
                    }`}
                    aria-pressed={category === cat.value}
                  >
                    <cat.Icon className="w-4 h-4 mr-2" />
                    <span className="text-sm">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                {t('feedback.fields.message', 'Message')} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('feedback.fields.messagePlaceholder', 'Tell us what\'s on your mind...')}
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:border-purple-600 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-800 outline-none transition-all resize-none"
                maxLength={5000}
                aria-describedby="message-hint"
              />
              <div id="message-hint" className="flex justify-between items-center mt-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('feedback.fields.minChars', 'Minimum 10 characters')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {message.length} / 5000
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2" role="alert">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 min-h-[44px] border-2 border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 font-semibold transition-colors"
                disabled={loading}
              >
                {t('feedback.buttons.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !category || !message.trim()}
                className="flex-1 px-6 py-3 min-h-[44px] bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('feedback.buttons.submitting', 'Submitting...')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>{t('feedback.buttons.submit', 'Submit Feedback')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.2s ease-out;
        }

        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
