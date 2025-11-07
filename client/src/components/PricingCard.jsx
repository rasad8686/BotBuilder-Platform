import { Check, Zap, Crown, Star } from 'lucide-react';

export default function PricingCard({
  plan,
  planKey,
  isCurrentPlan,
  isPopular,
  onSelectPlan,
  loading
}) {
  const getIcon = () => {
    switch (planKey) {
      case 'free':
        return <Star className="w-8 h-8 text-gray-600" />;
      case 'pro':
        return <Zap className="w-8 h-8 text-purple-600" />;
      case 'enterprise':
        return <Crown className="w-8 h-8 text-blue-600" />;
      default:
        return <Star className="w-8 h-8 text-gray-600" />;
    }
  };

  const getGradient = () => {
    switch (planKey) {
      case 'free':
        return 'from-gray-50 to-gray-100';
      case 'pro':
        return 'from-purple-50 to-purple-100';
      case 'enterprise':
        return 'from-blue-50 to-blue-100';
      default:
        return 'from-gray-50 to-gray-100';
    }
  };

  const getBorderColor = () => {
    if (isCurrentPlan) return 'border-green-500';
    if (isPopular) return 'border-purple-500';
    return 'border-gray-200';
  };

  const getButtonColor = () => {
    if (isCurrentPlan) return 'bg-green-600 hover:bg-green-700';
    if (planKey === 'pro') return 'bg-purple-600 hover:bg-purple-700';
    if (planKey === 'enterprise') return 'bg-blue-600 hover:bg-blue-700';
    return 'bg-gray-600 hover:bg-gray-700';
  };

  return (
    <div
      className={`relative bg-white rounded-2xl shadow-lg border-2 ${getBorderColor()} overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105`}
    >
      {/* Popular Badge */}
      {isPopular && !isCurrentPlan && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
          MOST POPULAR
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute top-0 right-0 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-1 text-xs font-bold rounded-bl-lg">
          CURRENT PLAN
        </div>
      )}

      {/* Header */}
      <div className={`bg-gradient-to-br ${getGradient()} p-6 text-center`}>
        <div className="flex justify-center mb-3">
          {getIcon()}
        </div>
        <h3 className="text-2xl font-bold text-gray-900 capitalize mb-2">
          {plan.name}
        </h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-5xl font-extrabold text-gray-900">
            ${plan.price}
          </span>
          {plan.price > 0 && (
            <span className="text-gray-600 text-lg">/month</span>
          )}
        </div>
        {plan.price === 0 && (
          <span className="text-gray-600 text-sm">Forever free</span>
        )}
      </div>

      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3 mb-6">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className={`rounded-full p-1 ${
                  planKey === 'pro' ? 'bg-purple-100' :
                  planKey === 'enterprise' ? 'bg-blue-100' :
                  'bg-gray-100'
                }`}>
                  <Check className={`w-4 h-4 ${
                    planKey === 'pro' ? 'text-purple-600' :
                    planKey === 'enterprise' ? 'text-blue-600' :
                    'text-gray-600'
                  }`} />
                </div>
              </div>
              <span className="text-gray-700 text-sm leading-relaxed">
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* Action Button */}
        <button
          onClick={() => onSelectPlan(planKey)}
          disabled={loading || isCurrentPlan}
          className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all duration-300 ${
            isCurrentPlan
              ? 'bg-gray-400 cursor-not-allowed'
              : getButtonColor()
          } ${loading ? 'opacity-50 cursor-wait' : ''} shadow-md hover:shadow-xl`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Processing...
            </span>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : planKey === 'free' ? (
            'Get Started Free'
          ) : (
            `Upgrade to ${plan.name}`
          )}
        </button>

        {/* Additional Info */}
        {!isCurrentPlan && plan.price > 0 && (
          <p className="text-center text-xs text-gray-500 mt-3">
            Cancel anytime • No hidden fees
          </p>
        )}
      </div>
    </div>
  );
}
