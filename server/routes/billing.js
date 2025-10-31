const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUsage,
  cancelSubscription,
  getPlans
} = require('../controllers/billingController');

// Apply authentication and organization context to all routes
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/billing/plans
 * Get available subscription plans
 * Public to all authenticated users
 */
router.get('/plans', getPlans);

/**
 * GET /api/billing/subscription
 * Get current subscription details
 */
router.get('/subscription', getSubscription);

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session for plan upgrade
 * Body: { plan: 'pro' | 'enterprise' }
 */
router.post('/checkout', createCheckoutSession);

/**
 * POST /api/billing/portal
 * Create Stripe customer portal session
 * Allows customers to manage their subscription
 */
router.post('/portal', createPortalSession);

/**
 * GET /api/billing/invoices
 * Get billing invoices for the organization
 */
router.get('/invoices', getInvoices);

/**
 * GET /api/billing/usage
 * Get current usage statistics
 */
router.get('/usage', getUsage);

/**
 * POST /api/billing/cancel
 * Cancel subscription (at period end)
 */
router.post('/cancel', cancelSubscription);

module.exports = router;
