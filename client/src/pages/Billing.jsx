import { useState, useEffect } from 'react';
import UsageBar from '../components/UsageBar';
import { API_URL } from '../config/api';

// MODULE-LEVEL UPGRADE LOCK (Nuclear option - prevents ALL double clicks)
let upgradeInProgress = false;
const UPGRADE_COOLDOWN = 3000; // 3 seconds

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [fetchingSubscription, setFetchingSubscription] = useState(true);
  const [canceling, setCanceling] = useState(false);

  // Fetch current subscription on mount
  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch(`${API_URL}/api/billing/subscription`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const data = await res.json();
      console.log('📊 Subscription API Response:', data);

      if (data.success) {
        setSubscription(data.subscription);
        console.log('✅ Current Plan:', data.subscription.plan);
        console.log('✅ Plan Status:', data.subscription.status);
      }
    } catch (err) {
      console.error('❌ Error fetching subscription:', err);
    } finally {
      setFetchingSubscription(false);
    }
  };

  const handleUpgrade = async (e, planType) => {
    e.preventDefault();
    e.stopPropagation();

    // TRIPLE GUARD - Module level lock
    if (upgradeInProgress) {
      console.warn('🚫 Upgrade already in progress - BLOCKED');
      return;
    }

    if (!planType || !['pro', 'enterprise'].includes(planType)) {
      console.error('❌ Invalid plan:', planType);
      return;
    }

    upgradeInProgress = true;
    console.log('🔒 LOCKED - Starting upgrade to:', planType);

    try {
      const payload = {
        planType: planType,
        successUrl: window.location.origin + '/billing?success=true',
        cancelUrl: window.location.origin + '/billing?canceled=true'
      };

      console.log('📡 Sending:', payload);

      const response = await fetch(`${API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Checkout failed');
      }

      const data = await response.json();
      console.log('✅ Response:', data);

      if (!data.checkoutUrl || !data.checkoutUrl.startsWith('http')) {
        throw new Error('Invalid checkout URL: ' + data.checkoutUrl);
      }

      console.log('🚀 Redirecting to:', data.checkoutUrl);
      window.location.href = data.checkoutUrl;

      // Don't reset flag - we're redirecting anyway

    } catch (error) {
      console.error('❌ Upgrade failed:', error);
      alert('Upgrade failed: ' + error.message);

      // Reset after cooldown
      setTimeout(() => {
        upgradeInProgress = false;
        console.log('🔓 UNLOCKED after error');
      }, UPGRADE_COOLDOWN);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel subscription? Your access will continue until the end of your current billing period.')) {
      return;
    }

    setCanceling(true);
    console.log('🚫 Starting subscription cancellation...');

    try {
      const response = await fetch(`${API_URL}/api/billing/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        credentials: 'include'
      });

      const data = await response.json();
      console.log('📡 Cancel response:', data);

      if (data.success) {
        const endDate = new Date(data.currentPeriodEnd).toLocaleDateString();
        alert(`Subscription canceled successfully. Your access will continue until ${endDate}.`);
        console.log('✅ Subscription canceled. Ends at:', endDate);

        // Refresh subscription data
        await fetchSubscription();
      } else {
        throw new Error(data.message || 'Failed to cancel subscription');
      }
    } catch (error) {
      console.error('❌ Cancel failed:', error);
      alert('Failed to cancel subscription: ' + error.message);
    } finally {
      setCanceling(false);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: 0,
      features: ['1 bot', '1,000 messages/month', 'Basic support']
    },
    {
      name: 'Pro',
      price: 29,
      features: ['10 bots', '50,000 messages/month', 'Priority support', 'Analytics']
    },
    {
      name: 'Enterprise',
      price: 99,
      features: ['Unlimited bots', 'Unlimited messages', '24/7 support', 'White-label']
    }
  ];

  // Check if this is the current plan
  const isCurrentPlan = (planName) => {
    if (!subscription) return false;
    return subscription.plan.toLowerCase() === planName.toLowerCase();
  };

  // Get button text and state for each plan
  const getPlanButton = (planName) => {
    if (fetchingSubscription) {
      return { text: 'Loading...', disabled: true, className: 'bg-gray-300 text-gray-500' };
    }

    const isCurrent = isCurrentPlan(planName);

    // CURRENT PLAN: Always show "Current Plan" and disable
    if (isCurrent) {
      return {
        text: 'Current Plan',
        disabled: true,
        className: 'bg-green-100 text-green-700 border-2 border-green-500'
      };
    }

    // FREE PLAN: Always disabled (can't downgrade to free manually)
    if (planName === 'Free') {
      return {
        text: 'Downgrade to Free',
        disabled: true,
        className: 'bg-gray-300 text-gray-500'
      };
    }

    // UPGRADE PLANS: Always enabled (lock handled in handleUpgrade)
    return {
      text: 'Upgrade to ' + planName,
      disabled: false,
      className: 'bg-blue-600 text-white hover:bg-blue-700'
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Billing & Plans</h1>
          <p className="text-gray-600">Choose the plan that fits your needs</p>
        </div>

        {/* Usage Bar */}
        <div className="mb-8">
          <UsageBar />
        </div>

        {/* Current Subscription Info */}
        {subscription && !fetchingSubscription && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900">
                  Current Plan: {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
                </h3>
                <p className="text-sm text-blue-700">
                  Status: <span className="font-medium">{subscription.status}</span>
                  {subscription.currentPeriodEnd && (
                    <> • {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'}: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</>
                  )}
                </p>

                {/* Cancel Button for Paid Plans */}
                {subscription.plan !== 'free' && subscription.stripeSubscriptionId && (
                  <div className="mt-3">
                    {subscription.cancelAtPeriodEnd ? (
                      <p className="text-sm text-orange-600 font-medium">
                        ⚠️ Subscription canceled - Access until {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    ) : (
                      <button
                        onClick={handleCancel}
                        disabled={canceling}
                        className="text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {canceling ? 'Canceling...' : 'Cancel Subscription'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {subscription.stripeSubscriptionId && (
                <div className="text-xs text-blue-600 ml-4">
                  <div>Subscription ID: {subscription.stripeSubscriptionId}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const isCurrent = isCurrentPlan(plan.name);
            const button = getPlanButton(plan.name);

            return (
              <div
                key={plan.name}
                className={`bg-white rounded-lg shadow-md border-2 p-6 relative ${
                  isCurrent ? 'border-green-500 ring-2 ring-green-200' : 'border-gray-200'
                }`}
              >
                {/* Current Plan Badge */}
                {isCurrent && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                      ✓ Current Plan
                    </span>
                  </div>
                )}

                {/* Plan Name */}
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h2>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  {plan.price > 0 && <span className="text-gray-600">/month</span>}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    if (button.disabled) return;
                    e.preventDefault();
                    e.stopPropagation();

                    if (plan.name === 'Pro') {
                      handleUpgrade(e, 'pro');
                    } else if (plan.name === 'Enterprise') {
                      handleUpgrade(e, 'enterprise');
                    }
                  }}
                  disabled={button.disabled}
                  className={`w-full font-semibold py-3 px-4 rounded-lg transition-colors ${button.className} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {button.text}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
