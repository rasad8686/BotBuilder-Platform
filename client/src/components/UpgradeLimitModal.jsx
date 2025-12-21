import { Link } from 'react-router-dom';

export default function UpgradeLimitModal({ isOpen, onClose, limitData }) {
  if (!isOpen) return null;

  const feature = limitData?.feature || 'this feature';
  const currentCount = limitData?.currentCount || 0;
  const limit = limitData?.limit || 0;
  const planName = limitData?.currentPlan || 'Free';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔒</div>
          <h2 id="upgrade-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Plan Limit Reached
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            You've reached the limit for {feature}
          </p>
        </div>

        {/* Limit Details */}
        <div className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 dark:text-gray-300 font-medium">Current Plan:</span>
            <span className="text-gray-900 dark:text-white font-semibold">{planName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300 font-medium">Usage:</span>
            <span className="text-gray-900 dark:text-white font-semibold">
              {currentCount} / {limit}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-3">
            <div
              className="bg-red-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min((currentCount / limit) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Message */}
        <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-purple-900 dark:text-purple-200">
            <strong>Upgrade your plan</strong> to access more {feature} and unlock additional features!
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            to="/billing"
            className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-center"
          >
            View Plans
          </Link>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Need help? Contact our support team for assistance
        </p>
      </div>
    </div>
  );
}
