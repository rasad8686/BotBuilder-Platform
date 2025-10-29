import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://botbuilder-platform.onrender.com';

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const [subRes, plansRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/subscriptions/current`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/subscriptions/plans`),
        axios.get(`${API_BASE_URL}/subscriptions/payment-history`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setSubscription(subRes.data);
      setPlans(plansRes.data);
      setPaymentHistory(historyRes.data);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId, billingCycle = 'monthly') => {
    try {
      setUpgrading(true);
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/subscriptions/create-checkout`,
        { planId, billingCycle },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Redirect to Stripe Checkout
      if (response.data.url) {
        window.location.href = response.data.url;
      } else if (response.data.success) {
        // Downgrade to free (no payment needed)
        alert(response.data.message);
        fetchBillingData();
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      alert(error.response?.data?.error || 'Failed to start checkout process');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/subscriptions/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Subscription cancelled. You will have access until the end of your billing period.');
      fetchBillingData();
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      alert(error.response?.data?.error || 'Failed to cancel subscription');
    }
  };

  const handleReactivate = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/subscriptions/reactivate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Subscription reactivated!');
      fetchBillingData();
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      alert(error.response?.data?.error || 'Failed to reactivate subscription');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and payment methods</p>
        </div>

        {/* Current Subscription Card */}
        {subscription && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{subscription.display_name}</h2>
                <p className="text-gray-600 mt-1">{subscription.plan_name === 'free' ? 'Free Plan' : `$${subscription.price_monthly}/month`}</p>
              </div>
              <div className={`px-4 py-2 rounded-full ${
                subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                subscription.cancel_at_period_end ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {subscription.cancel_at_period_end ? 'Canceling Soon' : subscription.status}
              </div>
            </div>

            {/* Usage Stats */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Bots Usage */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Bots</span>
                  <span className="font-semibold">
                    {subscription.current_bot_count} / {subscription.max_bots === -1 ? '∞' : subscription.max_bots}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      subscription.current_bot_count >= subscription.max_bots && subscription.max_bots !== -1
                        ? 'bg-red-500'
                        : subscription.current_bot_count / subscription.max_bots > 0.8 && subscription.max_bots !== -1
                        ? 'bg-orange-500'
                        : 'bg-purple-600'
                    }`}
                    style={{
                      width: subscription.max_bots === -1
                        ? '10%'
                        : `${Math.min((subscription.current_bot_count / subscription.max_bots) * 100, 100)}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* Messages Usage */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Messages this month</span>
                  <span className="font-semibold">
                    {subscription.current_message_count} / {subscription.max_messages_per_month === -1 ? '∞' : subscription.max_messages_per_month.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${
                      subscription.current_message_count >= subscription.max_messages_per_month && subscription.max_messages_per_month !== -1
                        ? 'bg-red-500'
                        : subscription.current_message_count / subscription.max_messages_per_month > 0.8 && subscription.max_messages_per_month !== -1
                        ? 'bg-orange-500'
                        : 'bg-purple-600'
                    }`}
                    style={{
                      width: subscription.max_messages_per_month === -1
                        ? '10%'
                        : `${Math.min((subscription.current_message_count / subscription.max_messages_per_month) * 100, 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            {!subscription.can_create_more_bots && subscription.plan_name !== 'enterprise' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <p className="text-orange-800">
                  ⚠️ You've reached your bot limit. Upgrade to create more bots!
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {subscription.plan_name === 'free' && (
                <button
                  onClick={() => handleUpgrade(plans.find(p => p.name === 'pro')?.id)}
                  disabled={upgrading}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {upgrading ? 'Processing...' : 'Upgrade to Pro'}
                </button>
              )}

              {subscription.plan_name === 'pro' && (
                <>
                  <button
                    onClick={() => handleUpgrade(plans.find(p => p.name === 'enterprise')?.id)}
                    disabled={upgrading}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {upgrading ? 'Processing...' : 'Upgrade to Enterprise'}
                  </button>
                  {!subscription.cancel_at_period_end && (
                    <button
                      onClick={handleCancelSubscription}
                      className="px-6 py-3 border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </>
              )}

              {subscription.plan_name === 'enterprise' && !subscription.cancel_at_period_end && (
                <button
                  onClick={handleCancelSubscription}
                  className="px-6 py-3 border border-red-500 text-red-500 rounded-lg hover:bg-red-50"
                >
                  Cancel Subscription
                </button>
              )}

              {subscription.cancel_at_period_end && (
                <button
                  onClick={handleReactivate}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Reactivate Subscription
                </button>
              )}
            </div>

            {subscription.cancel_at_period_end && (
              <p className="mt-4 text-sm text-gray-600">
                Your subscription will end on {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Available Plans */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Available Plans</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl shadow-lg p-8 ${
                  subscription?.plan_name === plan.name ? 'ring-2 ring-purple-600' : ''
                }`}
              >
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800">{plan.display_name}</h3>
                  <p className="text-4xl font-bold text-purple-600 mt-4">
                    ${plan.price_monthly}
                    <span className="text-lg text-gray-600">/mo</span>
                  </p>
                  {plan.price_yearly > 0 && (
                    <p className="text-sm text-gray-600 mt-2">
                      or ${plan.price_yearly}/year (save ${(plan.price_monthly * 12 - plan.price_yearly).toFixed(0)})
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  <li className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    {plan.max_bots === -1 ? 'Unlimited' : plan.max_bots} bot{plan.max_bots !== 1 ? 's' : ''}
                  </li>
                  <li className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    {plan.max_messages_per_month === -1 ? 'Unlimited' : plan.max_messages_per_month.toLocaleString()} messages/mo
                  </li>
                  <li className="flex items-center text-gray-700">
                    <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Webhook support
                  </li>
                  {plan.features?.api_access && (
                    <li className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      API access
                    </li>
                  )}
                  {plan.features?.priority_support && (
                    <li className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Priority support
                    </li>
                  )}
                  {plan.features?.custom_branding && (
                    <li className="flex items-center text-gray-700">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      Custom branding
                    </li>
                  )}
                </ul>

                {subscription?.plan_name === plan.name ? (
                  <button disabled className="w-full py-3 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed">
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgrading}
                    className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {plan.price_monthly === 0 ? 'Downgrade' : 'Upgrade'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Payment History */}
        {paymentHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Payment History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Description</th>
                    <th className="text-left py-3 px-4">Amount</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{new Date(payment.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4">{payment.description || 'Subscription payment'}</td>
                      <td className="py-3 px-4">${payment.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          payment.status === 'succeeded' ? 'bg-green-100 text-green-800' :
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {payment.receipt_url && (
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:underline"
                          >
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
