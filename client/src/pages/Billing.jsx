import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import billingApi from '../api/billing';
import PricingCard from '../components/PricingCard';
import SubscriptionStatus from '../components/SubscriptionStatus';

export default function Billing() {
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState({});
  const [usage, setUsage] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('subscription');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchBillingData();

    // Check for success/cancel from Stripe redirect
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      alert('Subscription updated successfully!');
      // Clear query params
      navigate('/billing', { replace: true });
    } else if (canceled === 'true') {
      alert('Checkout canceled');
      navigate('/billing', { replace: true });
    }
  }, [searchParams]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      // Fetch all billing data in parallel
      const [subscriptionRes, plansRes, usageRes, invoicesRes] = await Promise.all([
        billingApi.getSubscription().catch(err => {
          console.error('Error fetching subscription:', err);
          return { subscription: null };
        }),
        billingApi.getPlans().catch(err => {
          console.error('Error fetching plans:', err);
          return { plans: {} };
        }),
        billingApi.getUsage().catch(err => {
          console.error('Error fetching usage:', err);
          return { usage: null };
        }),
        billingApi.getInvoices().catch(err => {
          console.error('Error fetching invoices:', err);
          return { invoices: [] };
        })
      ]);

      if (subscriptionRes.subscription) {
        setSubscription(subscriptionRes.subscription);
      }
      if (plansRes.plans) {
        setPlans(plansRes.plans);
      }
      if (usageRes.usage) {
        setUsage(usageRes.usage);
      }
      if (invoicesRes.invoices) {
        setInvoices(invoicesRes.invoices);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
      if (error.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planKey) => {
    if (planKey === 'free') {
      alert('To downgrade to free, please cancel your current subscription from the Manage Subscription portal.');
      return;
    }

    try {
      setActionLoading(true);
      const response = await billingApi.createCheckoutSession(planKey);

      if (response.success && response.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.url;
      } else {
        alert('Failed to create checkout session. Please try again later.');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to start checkout process';

      // Handle specific error codes
      if (error.response?.data?.code === 'STRIPE_NOT_CONFIGURED') {
        alert('Billing system is not yet configured. Please contact support to enable billing for your organization.');
      } else if (error.response?.data?.code === 'STRIPE_PRICE_NOT_CONFIGURED') {
        alert('This plan is not yet available. Please contact support for more information.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setActionLoading(true);
      const response = await billingApi.createPortalSession();

      if (response.success && response.url) {
        // Redirect to Stripe Customer Portal
        window.location.href = response.url;
      } else {
        alert('Failed to open customer portal. Please try again later.');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to open customer portal';

      // Handle specific error codes
      if (error.response?.data?.code === 'STRIPE_NOT_CONFIGURED') {
        alert('Billing system is not yet configured. Please contact support.');
      } else if (error.response?.data?.code === 'NO_STRIPE_CUSTOMER') {
        alert('You need to upgrade to a paid plan first before accessing the customer portal.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await billingApi.cancelSubscription();

      if (response.success) {
        alert('Subscription canceled. You will have access until the end of your billing period.');
        fetchBillingData();
      } else {
        alert('Failed to cancel subscription. Please try again later.');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to cancel subscription';

      // Handle specific error codes
      if (error.response?.data?.code === 'STRIPE_NOT_CONFIGURED') {
        alert('Billing system is not yet configured. Please contact support.');
      } else if (error.response?.data?.code === 'NO_ACTIVE_SUBSCRIPTION') {
        alert('You do not have an active subscription to cancel.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription, usage, and invoices</p>
        </div>

        {/* Tabs */}
        <div className="mb-8 border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('subscription')}
              className={`pb-4 px-2 font-semibold transition-colors border-b-2 ${
                activeTab === 'subscription'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Current Subscription
            </button>
            <button
              onClick={() => setActiveTab('plans')}
              className={`pb-4 px-2 font-semibold transition-colors border-b-2 ${
                activeTab === 'plans'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Available Plans
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`pb-4 px-2 font-semibold transition-colors border-b-2 ${
                activeTab === 'usage'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Usage & Limits
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`pb-4 px-2 font-semibold transition-colors border-b-2 ${
                activeTab === 'invoices'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Invoices
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'subscription' && (
          <div>
            <SubscriptionStatus
              subscription={subscription}
              onManageSubscription={handleManageSubscription}
              onCancelSubscription={handleCancelSubscription}
              loading={actionLoading}
            />
          </div>
        )}

        {activeTab === 'plans' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Choose Your Plan</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {Object.keys(plans).map((planKey) => (
                <PricingCard
                  key={planKey}
                  plan={plans[planKey]}
                  planKey={planKey}
                  isCurrentPlan={subscription?.plan === planKey}
                  isPopular={planKey === 'pro'}
                  onSelectPlan={handleSelectPlan}
                  loading={actionLoading}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'usage' && usage && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Current Usage</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Bots Usage */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Bots</h3>
                  <span className="text-3xl">🤖</span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-3xl font-bold text-purple-600">
                      {usage.bots.current}
                    </span>
                    <span className="text-sm text-gray-500">
                      / {usage.bots.limit === -1 ? '∞' : usage.bots.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usage.bots.percentage >= 90 && usage.bots.limit !== -1
                          ? 'bg-red-500'
                          : usage.bots.percentage >= 70 && usage.bots.limit !== -1
                          ? 'bg-yellow-500'
                          : 'bg-purple-600'
                      }`}
                      style={{
                        width: usage.bots.limit === -1 ? '10%' : `${Math.min(usage.bots.percentage, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {usage.bots.limit === -1
                    ? 'Unlimited bots available'
                    : `${usage.bots.limit - usage.bots.current} bots remaining`}
                </p>
              </div>

              {/* Messages Usage */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Messages</h3>
                  <span className="text-3xl">💬</span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-3xl font-bold text-purple-600">
                      {usage.messages.current.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">
                      / {usage.messages.limit === -1 ? '∞' : usage.messages.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usage.messages.percentage >= 90 && usage.messages.limit !== -1
                          ? 'bg-red-500'
                          : usage.messages.percentage >= 70 && usage.messages.limit !== -1
                          ? 'bg-yellow-500'
                          : 'bg-purple-600'
                      }`}
                      style={{
                        width: usage.messages.limit === -1 ? '10%' : `${Math.min(usage.messages.percentage, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {usage.messages.limit === -1
                    ? 'Unlimited messages this month'
                    : `${(usage.messages.limit - usage.messages.current).toLocaleString()} messages remaining this month`}
                </p>
              </div>

              {/* API Calls Usage */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">API Calls</h3>
                  <span className="text-3xl">🔌</span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-3xl font-bold text-purple-600">
                      {usage.apiCalls.current.toLocaleString()}
                    </span>
                    <span className="text-sm text-gray-500">
                      / {usage.apiCalls.limit === -1 ? '∞' : usage.apiCalls.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        usage.apiCalls.percentage >= 90 && usage.apiCalls.limit !== -1
                          ? 'bg-red-500'
                          : usage.apiCalls.percentage >= 70 && usage.apiCalls.limit !== -1
                          ? 'bg-yellow-500'
                          : 'bg-purple-600'
                      }`}
                      style={{
                        width: usage.apiCalls.limit === -1 ? '10%' : `${Math.min(usage.apiCalls.percentage, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  {usage.apiCalls.limit === -1
                    ? 'Unlimited API calls this month'
                    : `${(usage.apiCalls.limit - usage.apiCalls.current).toLocaleString()} API calls remaining this month`}
                </p>
              </div>
            </div>

            {/* Usage Warning */}
            {(usage.bots.percentage >= 90 || usage.messages.percentage >= 90 || usage.apiCalls.percentage >= 90) && (
              <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">⚠️</span>
                  <div>
                    <h3 className="font-semibold text-orange-900 mb-2">Approaching Limit</h3>
                    <p className="text-orange-800">
                      You're approaching your plan limits. Consider upgrading to a higher plan to avoid service interruptions.
                    </p>
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="mt-3 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      View Plans
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Invoice History</h2>
            {invoices.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center border border-gray-200">
                <span className="text-6xl mb-4 block">📄</span>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Invoices Yet</h3>
                <p className="text-gray-600">Your invoice history will appear here once you have a paid subscription.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Date</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Description</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Amount</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Status</th>
                        <th className="text-left py-4 px-6 font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-6 text-gray-700">
                            {new Date(invoice.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </td>
                          <td className="py-4 px-6 text-gray-700">{invoice.description}</td>
                          <td className="py-4 px-6 font-semibold text-gray-900">
                            ${invoice.amount.toFixed(2)} {invoice.currency}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              invoice.status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : invoice.status === 'open'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {invoice.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex gap-2">
                              {invoice.pdfUrl && (
                                <a
                                  href={invoice.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                                >
                                  PDF
                                </a>
                              )}
                              {invoice.hostedUrl && (
                                <a
                                  href={invoice.hostedUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
