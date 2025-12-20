const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const db = require('../db');
const { handleWebhook } = require('../controllers/billingController');
const log = require('../utils/logger');

// Validate Stripe configuration on startup BEFORE initialization
log.info('Stripe configuration check starting');

// Validate Secret Key exists and has correct format
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  log.error('STRIPE_SECRET_KEY not configured', {
    message: 'Billing functionality will NOT work',
    action: 'Set STRIPE_SECRET_KEY in environment variables'
  });
} else if (typeof stripeSecretKey !== 'string') {
  log.error('STRIPE_SECRET_KEY is not a string', {
    type: typeof stripeSecretKey
  });
} else if (stripeSecretKey.trim() === '') {
  log.error('STRIPE_SECRET_KEY is empty string');
} else if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
  log.error('STRIPE_SECRET_KEY has invalid format', {
    message: 'Must start with sk_test_ or sk_live_',
    prefix: stripeSecretKey.substring(0, 10)
  });
} else {
  log.info('Stripe Secret Key validated successfully', {
    keyType: stripeSecretKey.startsWith('sk_test_') ? 'TEST MODE' : 'LIVE MODE',
    keyLength: stripeSecretKey.length
  });
}

// Initialize Stripe with secret key (will be undefined if validation failed)
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

if (!stripe) {
  log.error('Stripe SDK not initialized - Secret Key is missing');
}

// Validate Price IDs
const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
const enterprisePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;

if (!proPriceId) {
  log.error('STRIPE_PRO_PRICE_ID not configured', {
    message: 'Pro plan upgrades will FAIL'
  });
} else if (!proPriceId.startsWith('price_')) {
  log.error('STRIPE_PRO_PRICE_ID has invalid format', {
    message: 'Must start with price_',
    value: proPriceId
  });
} else {
  log.info('Pro Price ID validated', {
    priceId: proPriceId,
    length: proPriceId.length
  });
}

if (!enterprisePriceId) {
  log.error('STRIPE_ENTERPRISE_PRICE_ID not configured', {
    message: 'Enterprise plan upgrades will FAIL'
  });
} else if (!enterprisePriceId.startsWith('price_')) {
  log.error('STRIPE_ENTERPRISE_PRICE_ID has invalid format', {
    message: 'Must start with price_',
    value: enterprisePriceId
  });
} else {
  log.info('Enterprise Price ID validated', {
    priceId: enterprisePriceId,
    length: enterprisePriceId.length
  });
}

// Summary
if (stripe && proPriceId && enterprisePriceId) {
  log.info('ALL STRIPE CONFIGURATION VALID - Billing Ready');
} else {
  const missing = [];
  if (!stripe) missing.push('Stripe SDK (Secret Key invalid)');
  if (!proPriceId) missing.push('Pro Plan Price ID');
  if (!enterprisePriceId) missing.push('Enterprise Plan Price ID');
  log.error('STRIPE CONFIGURATION INCOMPLETE - Billing Will FAIL', {
    missing: missing
  });
}

/**
 * POST /api/billing/webhook
 * Stripe webhook endpoint for subscription events
 * IMPORTANT: This route uses raw body parsing (configured in server.js)
 * express.raw() middleware provides req.body as Buffer for signature verification
 */
router.post('/webhook', (req, res) => {
  handleWebhook(req, res);
});

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session for plan upgrade
 */
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    log.info('Stripe checkout request started');

    // Safety check: Ensure Stripe is initialized
    if (!stripe) {
      log.error('Stripe SDK not initialized - cannot process checkout');
      return res.status(503).json({
        success: false,
        message: 'Payment system not configured. Please contact support.',
        error: 'Stripe SDK not initialized'
      });
    }

    const { planType, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;

    log.debug('Checkout request details', {
      userId,
      planType,
      successUrl,
      cancelUrl
    });

    // Validate request body
    if (!planType || !successUrl || !cancelUrl) {
      log.warn('Missing required fields in checkout request');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planType, successUrl, cancelUrl'
      });
    }

    // Validate plan type
    if (!['pro', 'enterprise'].includes(planType)) {
      log.warn('Invalid plan type', { planType });
      return res.status(400).json({
        success: false,
        message: 'Invalid plan type. Must be "pro" or "enterprise"'
      });
    }

    // Get price ID based on plan type
    const priceId = planType === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_ENTERPRISE_PRICE_ID;

    if (!priceId) {
      log.error('Price ID not configured', { planType });
      return res.status(500).json({
        success: false,
        message: `Price ID not configured for ${planType} plan. Please contact support.`
      });
    }

    log.debug('Using Price ID', { priceId });

    // Verify user exists in database
    const userResult = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      log.error('User not found', { userId });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    log.info('User found for checkout', { email: user.email });

    // Create Stripe checkout session
    log.info('Creating Stripe checkout session', {
      priceId,
      userEmail: user.email,
      userId,
      planType
    });

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId.toString(),
      customer_email: user.email,
      metadata: {
        userId: userId,
        planType: planType,
        userName: user.name
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planType: planType
        }
      }
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    log.info('Checkout session created successfully', {
      sessionId: session.id,
      sessionMode: session.mode,
      sessionStatus: session.status
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    log.error('Stripe checkout error', {
      errorType: error.type,
      errorMessage: error.message,
      errorCode: error.code,
      errorParam: error.param,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

    // Provide helpful error message based on error type
    let userMessage = 'Failed to create checkout session';
    if (error.type === 'StripeInvalidRequestError') {
      if (error.param === 'price' || error.message?.includes('price')) {
        userMessage = 'Invalid price configuration. Please contact support.';
      } else if (error.message?.includes('api_key')) {
        userMessage = 'Payment system configuration error. Please contact support.';
      }
    } else if (error.type === 'StripeAuthenticationError') {
      userMessage = 'Payment system authentication error. Please contact support.';
    }

    res.status(500).json({
      success: false,
      message: userMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Check server logs for details'
    });
  }
});

/**
 * GET /api/billing/subscription
 * Get current subscription details for the authenticated user
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    log.debug('Getting subscription for user', { userId });

    // Get user's organization with all subscription details
    const orgResult = await db.query(
      `SELECT o.id, o.plan_tier, o.stripe_subscription_id, o.subscription_status,
              o.stripe_customer_id, o.subscription_current_period_end
       FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0) {
      log.info('No organization found for user', { userId });
      return res.json({
        success: true,
        subscription: {
          plan: 'free',
          status: 'active',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          stripeCustomerId: null,
          stripeSubscriptionId: null
        }
      });
    }

    const org = orgResult.rows[0];
    const planTier = org.plan_tier || 'free';

    log.info('Organization subscription retrieved', {
      orgId: org.id,
      planTier,
      stripeSubscriptionId: org.stripe_subscription_id || 'none',
      subscriptionStatus: org.subscription_status || 'active'
    });

    // If organization has a Stripe subscription, fetch details from Stripe
    let stripeSubscription = null;
    if (org.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        log.debug('Stripe subscription fetched', {
          status: stripeSubscription.status
        });
      } catch (error) {
        log.error('Error fetching Stripe subscription', {
          error: error.message,
          subscriptionId: org.stripe_subscription_id
        });
      }
    }

    res.json({
      success: true,
      subscription: {
        plan: planTier,
        status: org.subscription_status || (stripeSubscription ? stripeSubscription.status : 'active'),
        currentPeriodEnd: org.subscription_current_period_end || (stripeSubscription ? new Date(stripeSubscription.current_period_end * 1000) : null),
        cancelAtPeriodEnd: stripeSubscription ? stripeSubscription.cancel_at_period_end : false,
        stripeCustomerId: org.stripe_customer_id,
        stripeSubscriptionId: org.stripe_subscription_id
      }
    });

  } catch (error) {
    log.error('Get subscription error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/billing/cancel
 * Cancel subscription (at period end)
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    log.info('Cancel subscription request', { userId });

    // Get user's organization
    const orgResult = await db.query(
      `SELECT o.id, o.stripe_subscription_id
       FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_subscription_id) {
      log.warn('No active subscription to cancel', { userId });
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    const org = orgResult.rows[0];
    log.info('Canceling subscription', {
      subscriptionId: org.stripe_subscription_id
    });

    // Cancel subscription at period end (don't immediately cancel)
    const subscription = await stripe.subscriptions.update(
      org.stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    );

    log.info('Subscription will be canceled', {
      cancelDate: new Date(subscription.current_period_end * 1000)
    });

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

  } catch (error) {
    log.error('Cancel subscription error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/usage
 * Get current message usage for the authenticated user's organization
 */
router.get('/usage', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's organization and plan
    const orgResult = await db.query(
      `SELECT o.id, o.plan_tier
       FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0) {
      return res.json({
        success: true,
        current: 0,
        limit: 1000,
        plan: 'free',
        percentage: 0
      });
    }

    const org = orgResult.rows[0];
    const planTier = org.plan_tier || 'free';

    // Define limits
    const limits = {
      free: 1000,
      pro: 50000,
      enterprise: 999999 // Display as "Unlimited" in frontend
    };

    const limit = limits[planTier];

    // Get current usage
    const usageResult = await db.query(
      `SELECT message_count
       FROM message_usage
       WHERE organization_id = $1 AND period_end IS NULL
       ORDER BY period_start DESC
       LIMIT 1`,
      [org.id]
    );

    const current = usageResult.rows.length > 0 ? usageResult.rows[0].message_count : 0;
    const percentage = limit === 999999 ? 0 : (current / limit) * 100;

    return res.json({
      success: true,
      current: current,
      limit: limit,
      plan: planTier,
      percentage: Math.round(percentage * 100) / 100
    });

  } catch (error) {
    log.error('Get usage error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to get usage',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/billing/plans
 * Get available subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = {
      free: {
        name: 'Free',
        price: 0,
        interval: 'forever',
        features: [
          '1 bot',
          '1,000 messages/month',
          'Basic support',
          'Community access'
        ]
      },
      pro: {
        name: 'Pro',
        price: 29,
        interval: 'month',
        features: [
          '10 bots',
          '50,000 messages/month',
          'Priority support',
          'Advanced analytics',
          'Custom branding',
          'API access'
        ]
      },
      enterprise: {
        name: 'Enterprise',
        price: 99,
        interval: 'month',
        features: [
          'Unlimited bots',
          'Unlimited messages',
          '24/7 Premium support',
          'Advanced analytics',
          'Full white-label',
          'Dedicated account manager',
          'Custom integrations',
          'SLA guarantee'
        ]
      }
    };

    res.json({
      success: true,
      plans: plans
    });

  } catch (error) {
    log.error('Get plans error', {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get plans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
