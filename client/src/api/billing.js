import axiosInstance from './axios';

/**
 * Billing & Subscription API
 * All billing-related API calls with authentication
 */

const billingApi = {
  /**
   * Get available subscription plans
   * @returns {Promise} Plans object with free, pro, enterprise
   */
  getPlans: async () => {
    const response = await axiosInstance.get('/api/billing/plans');
    return response.data;
  },

  /**
   * Get current subscription details
   * @returns {Promise} Subscription object with plan, limits, features, status
   */
  getSubscription: async () => {
    const response = await axiosInstance.get('/api/billing/subscription');
    return response.data;
  },

  /**
   * Create Stripe checkout session for plan upgrade
   * @param {string} plan - Plan key: 'pro' or 'enterprise'
   * @returns {Promise} Checkout session with sessionId and url
   */
  createCheckoutSession: async (plan) => {
    const response = await axiosInstance.post('/api/billing/checkout', { plan });
    return response.data;
  },

  /**
   * Create Stripe customer portal session
   * Allows customers to manage their subscription
   * @returns {Promise} Portal session with url
   */
  createPortalSession: async () => {
    const response = await axiosInstance.post('/api/billing/portal');
    return response.data;
  },

  /**
   * Get billing invoices for the organization
   * @returns {Promise} Array of invoices
   */
  getInvoices: async () => {
    const response = await axiosInstance.get('/api/billing/invoices');
    return response.data;
  },

  /**
   * Get current usage statistics
   * @returns {Promise} Usage object with bots, messages, apiCalls
   */
  getUsage: async () => {
    const response = await axiosInstance.get('/api/billing/usage');
    return response.data;
  },

  /**
   * Cancel subscription (at period end)
   * @returns {Promise} Cancellation confirmation
   */
  cancelSubscription: async () => {
    const response = await axiosInstance.post('/api/billing/cancel');
    return response.data;
  }
};

export default billingApi;
