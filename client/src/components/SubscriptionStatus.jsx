/**
 * Subscription Status Component
 * Displays current subscription details and status
 * @param {Object} subscription - Subscription data from API
 * @param {function} onManageSubscription - Handler for managing subscription
 * @param {function} onCancelSubscription - Handler for canceling subscription
 * @param {boolean} loading - Loading state
 */
export default function SubscriptionStatus({
  subscription,
  onManageSubscription,
  onCancelSubscription,
  loading = false
}) {
  if (!subscription) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  // Status color mapping
  const statusColors = {
    active: 'bg-green-100 text-green-800 border-green-200',
    trialing: 'bg-blue-100 text-blue-800 border-blue-200',
    past_due: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    canceled: 'bg-red-100 text-red-800 border-red-200',
    incomplete: 'bg-orange-100 text-orange-800 border-orange-200'
  };

  const statusIcons = {
    active: '✓',
    trialing: '⏳',
    past_due: '⚠️',
    canceled: '✕',
    incomplete: '⏱️'
  };

  const status = subscription.status || 'active';
  const statusColor = statusColors[status] || statusColors.active;
  const statusIcon = statusIcons[status] || statusIcons.active;

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Calculate days until renewal
  const getDaysUntilRenewal = () => {
    if (!subscription.currentPeriodEnd) return null;
    const now = new Date();
    const endDate = new Date(subscription.currentPeriodEnd);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntilRenewal = getDaysUntilRenewal();

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">Current Subscription</h3>
            <p className="text-purple-100">Manage your subscription and billing</p>
          </div>
          <div className="text-5xl">💳</div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Plan Info */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h4 className="text-2xl font-bold text-gray-900">
                {subscription.planName}
              </h4>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
                {statusIcon} {status.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">
              {subscription.price === 0 ? (
                'Free plan - No payment required'
              ) : (
                <>
                  <span className="text-2xl font-bold text-purple-600">
                    ${subscription.price}
                  </span>
                  <span className="text-gray-500">/{subscription.interval}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Renewal Info */}
        {subscription.currentPeriodEnd && subscription.plan !== 'free' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📅</span>
              <div className="flex-1">
                <h5 className="font-semibold text-gray-900 mb-1">
                  {subscription.cancelAtPeriodEnd ? 'Subscription Ends' : 'Next Billing Date'}
                </h5>
                <p className="text-gray-700">
                  {formatDate(subscription.currentPeriodEnd)}
                  {daysUntilRenewal !== null && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({daysUntilRenewal} {daysUntilRenewal === 1 ? 'day' : 'days'} remaining)
                    </span>
                  )}
                </p>
                {subscription.cancelAtPeriodEnd && (
                  <p className="text-sm text-orange-600 mt-2 font-medium">
                    ⚠️ Your subscription will be canceled at the end of the current period
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div>
          <h5 className="font-semibold text-gray-900 mb-3">Plan Features:</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {subscription.features?.map((feature, index) => (
              <div key={index} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Usage Limits */}
        <div>
          <h5 className="font-semibold text-gray-900 mb-3">Plan Limits:</h5>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {subscription.limits.bots === -1 ? '∞' : subscription.limits.bots}
              </div>
              <div className="text-xs text-gray-600 font-medium mt-1">Bots</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {subscription.limits.messages === -1 ? '∞' : subscription.limits.messages.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600 font-medium mt-1">Messages/mo</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {subscription.limits.apiCalls === -1 ? '∞' : subscription.limits.apiCalls.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600 font-medium mt-1">API Calls/mo</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          {subscription.plan !== 'free' && (
            <>
              <button
                onClick={onManageSubscription}
                disabled={loading}
                className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span>
                    Loading...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    ⚙️ Manage Subscription
                  </span>
                )}
              </button>

              {!subscription.cancelAtPeriodEnd && (
                <button
                  onClick={onCancelSubscription}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    ✕ Cancel Subscription
                  </span>
                </button>
              )}
            </>
          )}

          {subscription.plan === 'free' && (
            <p className="text-sm text-gray-600 text-center flex-1 py-3">
              Upgrade to unlock more features and higher limits
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
