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
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Plan Limit Reached
          </h2>
          <p className="text-gray-600">
            You've reached the limit for {feature}
          </p>
        </div>

        {/* Limit Details */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 font-medium">Current Plan:</span>
            <span className="text-gray-900 font-semibold">{planName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Usage:</span>
            <span className="text-gray-900 font-semibold">
              {currentCount} / {limit}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-red-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min((currentCount / limit) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Message */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-purple-900">
            ⭐ <strong>Upgrade your plan</strong> to access more {feature} and unlock additional features!
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
            className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Need help? Contact our support team for assistance
        </p>
      </div>
    </div>
  );
}
