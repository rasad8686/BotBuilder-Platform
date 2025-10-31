/**
 * Pricing Card Component
 * Displays subscription plan details with features and pricing
 * @param {Object} plan - Plan object with name, price, interval, limits, features
 * @param {boolean} isCurrentPlan - Whether this is the user's current plan
 * @param {boolean} isPopular - Whether to highlight as popular
 * @param {function} onSelectPlan - Handler for plan selection
 * @param {boolean} loading - Loading state for button
 */
export default function PricingCard({
  plan,
  planKey,
  isCurrentPlan = false,
  isPopular = false,
  onSelectPlan,
  loading = false
}) {
  // Plan color themes
  const planThemes = {
    free: {
      badge: 'bg-gray-100 text-gray-800',
      button: 'bg-gray-600 hover:bg-gray-700',
      border: 'border-gray-200',
      accent: 'text-gray-600'
    },
    pro: {
      badge: 'bg-purple-100 text-purple-800',
      button: 'bg-purple-600 hover:bg-purple-700',
      border: 'border-purple-200',
      accent: 'text-purple-600'
    },
    enterprise: {
      badge: 'bg-blue-100 text-blue-800',
      button: 'bg-blue-600 hover:bg-blue-700',
      border: 'border-blue-200',
      accent: 'text-blue-600'
    }
  };

  const theme = planThemes[planKey] || planThemes.free;

  // Format price display
  const formatPrice = (price, interval) => {
    if (price === 0) return 'Free';
    return `$${price}/${interval}`;
  };

  // Format limits display
  const formatLimit = (value) => {
    if (value === -1) return 'Unlimited';
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value;
  };

  return (
    <div
      className={`
        bg-white rounded-xl shadow-md p-6 border-2 transition-all duration-300
        ${isPopular ? 'border-purple-500 shadow-xl scale-105' : theme.border}
        ${isCurrentPlan ? 'ring-4 ring-green-200' : ''}
        hover:shadow-lg relative
      `}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
            MOST POPULAR
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-6">
          <span className="bg-green-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-md">
            CURRENT PLAN
          </span>
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-6">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-3 ${theme.badge}`}>
          {planKey === 'free' && '🆓'}
          {planKey === 'pro' && '⭐'}
          {planKey === 'enterprise' && '👑'}
          <span className="font-bold uppercase">{plan.name}</span>
        </div>

        {/* Price */}
        <div className="mb-4">
          <div className={`text-4xl font-bold ${theme.accent}`}>
            {plan.price === 0 ? (
              'Free'
            ) : (
              <>
                <span className="text-5xl">${plan.price}</span>
                <span className="text-xl text-gray-500">/{plan.interval}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Limits Summary */}
      <div className="grid grid-cols-3 gap-2 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className={`text-2xl font-bold ${theme.accent}`}>
            {formatLimit(plan.limits.bots)}
          </div>
          <div className="text-xs text-gray-600 font-medium">Bots</div>
        </div>
        <div className="text-center border-x border-gray-200">
          <div className={`text-2xl font-bold ${theme.accent}`}>
            {formatLimit(plan.limits.messages)}
          </div>
          <div className="text-xs text-gray-600 font-medium">Messages</div>
        </div>
        <div className="text-center">
          <div className={`text-2xl font-bold ${theme.accent}`}>
            {formatLimit(plan.limits.apiCalls)}
          </div>
          <div className="text-xs text-gray-600 font-medium">API Calls</div>
        </div>
      </div>

      {/* Features List */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Features included:</h4>
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onSelectPlan(planKey)}
        disabled={isCurrentPlan || loading}
        className={`
          w-full py-3 px-4 rounded-lg font-semibold text-white
          transition-all duration-200
          ${isCurrentPlan
            ? 'bg-green-500 cursor-default'
            : loading
              ? 'bg-gray-400 cursor-not-allowed'
              : `${theme.button} hover:scale-105 active:scale-95`
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin">⚙️</span>
            Processing...
          </span>
        ) : isCurrentPlan ? (
          <span className="flex items-center justify-center gap-2">
            ✓ Current Plan
          </span>
        ) : planKey === 'free' ? (
          'Downgrade to Free'
        ) : (
          `Upgrade to ${plan.name}`
        )}
      </button>

      {/* Footer Note */}
      {!isCurrentPlan && planKey !== 'free' && (
        <p className="text-xs text-gray-500 text-center mt-3">
          Cancel anytime. No hidden fees.
        </p>
      )}
    </div>
  );
}
