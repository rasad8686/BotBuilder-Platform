const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const db = require('../db');
const { handleWebhook } = require('../controllers/billingController');

// Validate Stripe configuration on startup BEFORE initialization
console.log('\n========== STRIPE CONFIGURATION CHECK ==========');

// Validate Secret Key exists and has correct format
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ CRITICAL ERROR: STRIPE_SECRET_KEY not configured in environment variables');
  console.error('⚠️  Billing functionality will NOT work!');
  console.error('⚠️  Set STRIPE_SECRET_KEY in Render dashboard environment variables');
} else if (typeof stripeSecretKey !== 'string') {
  console.error('❌ CRITICAL ERROR: STRIPE_SECRET_KEY is not a string');
  console.error('⚠️  Current type:', typeof stripeSecretKey);
} else if (stripeSecretKey.trim() === '') {
  console.error('❌ CRITICAL ERROR: STRIPE_SECRET_KEY is empty string');
  console.error('⚠️  Set proper Stripe Secret Key in Render dashboard');
} else if (!stripeSecretKey.startsWith('sk_test_') && !stripeSecretKey.startsWith('sk_live_')) {
  console.error('❌ CRITICAL ERROR: STRIPE_SECRET_KEY has invalid format');
  console.error('⚠️  Must start with sk_test_ or sk_live_');
  console.error(`⚠️  Current value starts with: ${stripeSecretKey.substring(0, 10)}...`);
} else {
  console.log('✅ Stripe Secret Key validated successfully');
  console.log(`✅ Key type: ${stripeSecretKey.startsWith('sk_test_') ? 'TEST MODE' : 'LIVE MODE'}`);
  console.log(`✅ Key prefix: ${stripeSecretKey.substring(0, 20)}...`);
  console.log(`✅ Key length: ${stripeSecretKey.length} characters`);
}

// Initialize Stripe with secret key (will be undefined if validation failed)
const stripe = stripeSecretKey ? require('stripe')(stripeSecretKey) : null;

if (!stripe) {
  console.error('❌ CRITICAL ERROR: Stripe SDK not initialized - Secret Key is missing');
}

// Validate Price IDs
const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
const enterprisePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;

if (!proPriceId) {
  console.error('❌ ERROR: STRIPE_PRO_PRICE_ID not configured!');
  console.error('⚠️  Pro plan upgrades will FAIL!');
} else if (!proPriceId.startsWith('price_')) {
  console.error('❌ ERROR: STRIPE_PRO_PRICE_ID has invalid format!');
  console.error('⚠️  Must start with price_');
  console.error(`⚠️  Current value: ${proPriceId}`);
} else {
  console.log(`✅ Pro Price ID: ${proPriceId}`);
  console.log(`✅ Pro Price ID length: ${proPriceId.length} characters`);
}

if (!enterprisePriceId) {
  console.error('❌ ERROR: STRIPE_ENTERPRISE_PRICE_ID not configured!');
  console.error('⚠️  Enterprise plan upgrades will FAIL!');
} else if (!enterprisePriceId.startsWith('price_')) {
  console.error('❌ ERROR: STRIPE_ENTERPRISE_PRICE_ID has invalid format!');
  console.error('⚠️  Must start with price_');
  console.error(`⚠️  Current value: ${enterprisePriceId}`);
} else {
  console.log(`✅ Enterprise Price ID: ${enterprisePriceId}`);
  console.log(`✅ Enterprise Price ID length: ${enterprisePriceId.length} characters`);
}

// Summary
if (stripe && proPriceId && enterprisePriceId) {
  console.log('\n✅✅✅ ALL STRIPE CONFIGURATION VALID - Billing Ready! ✅✅✅');
} else {
  console.error('\n❌❌❌ STRIPE CONFIGURATION INCOMPLETE - Billing Will FAIL! ❌❌❌');
  console.error('📋 Missing components:');
  if (!stripe) console.error('  - Stripe SDK (Secret Key invalid)');
  if (!proPriceId) console.error('  - Pro Plan Price ID');
  if (!enterprisePriceId) console.error('  - Enterprise Plan Price ID');
}
console.log('========== STRIPE CONFIGURATION CHECK END ==========\n');

/**
 * POST /api/billing/webhook
 * Stripe webhook endpoint for subscription events
 * IMPORTANT: This route must come BEFORE authenticated routes
 * and uses raw body parsing (configured in server.js)
 */
router.post('/webhook', (req, res) => {
  // Attach raw body to request for signature verification
  req.rawBody = req.body;
  handleWebhook(req, res);
});

/**
 * POST /api/billing/checkout
 * Create Stripe checkout session for plan upgrade
 *
 * Request body:
 * {
 *   planType: 'pro' | 'enterprise',
 *   successUrl: string,
 *   cancelUrl: string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   checkoutUrl: string,
 *   sessionId: string
 * }
 */
router.post('/checkout', authenticateToken, async (req, res) => {
  try {
    console.log('\n========== STRIPE CHECKOUT REQUEST ==========');

    // Safety check: Ensure Stripe is initialized
    if (!stripe) {
      console.error('❌ CRITICAL: Stripe SDK not initialized - cannot process checkout');
      console.error('⚠️  Check Render environment variables for STRIPE_SECRET_KEY');
      return res.status(503).json({
        success: false,
        message: 'Payment system not configured. Please contact support.',
        error: 'Stripe SDK not initialized'
      });
    }

    const { planType, successUrl, cancelUrl } = req.body;
    const userId = req.user.id;

    console.log(`User ID: ${userId}`);
    console.log(`Plan Type: ${planType}`);
    console.log(`Success URL: ${successUrl}`);
    console.log(`Cancel URL: ${cancelUrl}`);

    // Validate request body
    if (!planType || !successUrl || !cancelUrl) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: planType, successUrl, cancelUrl'
      });
    }

    // Validate plan type
    if (!['pro', 'enterprise'].includes(planType)) {
      console.error(`❌ Invalid plan type: ${planType}`);
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
      console.error(`❌ Price ID not configured for ${planType} plan`);
      return res.status(500).json({
        success: false,
        message: `Price ID not configured for ${planType} plan. Please contact support.`
      });
    }

    console.log(`✅ Using Price ID: ${priceId}`);

    // Verify user exists in database
    const userResult = await db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];
    console.log(`✅ User found: ${user.email}`);

    // Create Stripe checkout session
    console.log('🔄 Creating Stripe checkout session...');
    console.log(`📋 Checkout parameters:`);
    console.log(`   - Price ID: ${priceId}`);
    console.log(`   - Customer Email: ${user.email}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Plan Type: ${planType}`);
    console.log(`   - Mode: subscription`);

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

    console.log('📤 Calling Stripe API...');
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log('✅ Checkout session created successfully');
    console.log(`Session ID: ${session.id}`);
    console.log(`Checkout URL: ${session.url}`);
    console.log(`Session Mode: ${session.mode}`);
    console.log(`Session Status: ${session.status}`);
    console.log('========== CHECKOUT REQUEST SUCCESS ==========\n');

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('\n========== STRIPE CHECKOUT ERROR ==========');
    console.error('Error type:', error.type);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error param:', error.param);
    console.error('Error stack:', error.stack);
    console.error('========== ERROR END ==========\n');

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
 *
 * Response:
 * {
 *   success: true,
 *   subscription: {
 *     plan: 'free' | 'pro' | 'enterprise',
 *     status: 'active' | 'canceled' | 'incomplete',
 *     currentPeriodEnd: Date,
 *     cancelAtPeriodEnd: boolean
 *   }
 * }
 */
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`\n[GET /subscription] User ID: ${userId}`);

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
      console.log(`[GET /subscription] No organization found for user ${userId}`);
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

    console.log(`[GET /subscription] Organization ID: ${org.id}`);
    console.log(`[GET /subscription] Plan: ${planTier}`);
    console.log(`[GET /subscription] Stripe Subscription ID: ${org.stripe_subscription_id || 'none'}`);
    console.log(`[GET /subscription] Subscription Status: ${org.subscription_status || 'active'}`);

    // If organization has a Stripe subscription, fetch details from Stripe
    let stripeSubscription = null;
    if (org.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
        console.log(`[GET /subscription] Stripe subscription status: ${stripeSubscription.status}`);
      } catch (error) {
        console.error(`[GET /subscription] Error fetching Stripe subscription:`, error.message);
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
    console.error('[GET /subscription] Error:', error);
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
 *
 * Response:
 * {
 *   success: true,
 *   message: string,
 *   cancelAtPeriodEnd: boolean,
 *   currentPeriodEnd: Date
 * }
 */
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    console.log(`\n[POST /cancel] User ID: ${userId}`);

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
      console.log(`[POST /cancel] No active subscription found`);
      return res.status(400).json({
        success: false,
        message: 'No active subscription to cancel'
      });
    }

    const org = orgResult.rows[0];
    console.log(`[POST /cancel] Canceling subscription: ${org.stripe_subscription_id}`);

    // Cancel subscription at period end (don't immediately cancel)
    const subscription = await stripe.subscriptions.update(
      org.stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    );

    console.log(`[POST /cancel] Subscription will be canceled at: ${new Date(subscription.current_period_end * 1000)}`);

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

  } catch (error) {
    console.error('[POST /cancel] Error:', error);
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
 *
 * Response:
 * {
 *   success: true,
 *   current: number,
 *   limit: number,
 *   plan: string,
 *   percentage: number
 * }
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
    console.error('[GET /usage] Error:', error);
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
 *
 * Response:
 * {
 *   success: true,
 *   plans: {
 *     free: { name, price, features[] },
 *     pro: { name, price, features[] },
 *     enterprise: { name, price, features[] }
 *   }
 * }
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
    console.error('[GET /plans] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get plans',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
