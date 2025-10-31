const db = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

/**
 * Billing Controller
 * Handles subscription management and Stripe integration
 */

// Plan configurations
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    interval: 'month',
    limits: {
      bots: 1,
      messages: 1000,
      apiCalls: 100
    },
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
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    limits: {
      bots: 10,
      messages: 50000,
      apiCalls: 10000
    },
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
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    limits: {
      bots: -1, // unlimited
      messages: -1, // unlimited
      apiCalls: -1 // unlimited
    },
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

/**
 * Get current subscription details
 * GET /api/billing/subscription
 */
async function getSubscription(req, res) {
  try {
    const organizationId = req.organization.id;

    // Get organization with subscription details
    const query = `
      SELECT
        o.id,
        o.name,
        o.plan_tier,
        o.stripe_customer_id,
        o.stripe_subscription_id,
        o.subscription_status,
        o.subscription_current_period_end,
        o.created_at
      FROM organizations o
      WHERE o.id = $1
    `;

    const result = await db.query(query, [organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const org = result.rows[0];
    const planTier = org.plan_tier || 'free';
    const planDetails = PLANS[planTier];

    // Get Stripe subscription if exists
    let stripeSubscription = null;
    if (org.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      } catch (error) {
        console.error('Error fetching Stripe subscription:', error);
      }
    }

    return res.status(200).json({
      success: true,
      subscription: {
        plan: planTier,
        planName: planDetails.name,
        price: planDetails.price,
        interval: planDetails.interval,
        limits: planDetails.limits,
        features: planDetails.features,
        status: org.subscription_status || 'active',
        currentPeriodEnd: org.subscription_current_period_end,
        cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end || false,
        stripeSubscription: stripeSubscription
      }
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get subscription',
      error: error.message
    });
  }
}

/**
 * Create Stripe checkout session for upgrade
 * POST /api/billing/checkout
 */
async function createCheckoutSession(req, res) {
  try {
    const organizationId = req.organization.id;
    const { plan } = req.body;

    if (!plan || !['pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    const planDetails = PLANS[plan];

    if (!planDetails.stripePriceId) {
      return res.status(400).json({
        success: false,
        message: 'Stripe price ID not configured for this plan'
      });
    }

    // Get organization
    const orgResult = await db.query(
      'SELECT id, name, stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const org = orgResult.rows[0];
    let customerId = org.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: {
          organizationId: org.id,
          organizationName: org.name
        }
      });

      customerId = customer.id;

      // Save customer ID
      await db.query(
        'UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, org.id]
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: planDetails.stripePriceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        organizationId: org.id,
        plan: plan
      }
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('Create checkout session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
}

/**
 * Create Stripe customer portal session
 * POST /api/billing/portal
 */
async function createPortalSession(req, res) {
  try {
    const organizationId = req.organization.id;

    const orgResult = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_customer_id) {
      return res.status(400).json({
        success: false,
        message: 'No payment method configured'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: orgResult.rows[0].stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/billing`
    });

    return res.status(200).json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('Create portal session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create portal session',
      error: error.message
    });
  }
}

/**
 * Get billing invoices
 * GET /api/billing/invoices
 */
async function getInvoices(req, res) {
  try {
    const organizationId = req.organization.id;

    const orgResult = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_customer_id) {
      return res.status(200).json({
        success: true,
        invoices: []
      });
    }

    const invoices = await stripe.invoices.list({
      customer: orgResult.rows[0].stripe_customer_id,
      limit: 12
    });

    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000),
      description: invoice.lines.data[0]?.description || 'Subscription',
      amount: invoice.total / 100,
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url
    }));

    return res.status(200).json({
      success: true,
      invoices: formattedInvoices
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get invoices',
      error: error.message
    });
  }
}

/**
 * Get current usage statistics
 * GET /api/billing/usage
 */
async function getUsage(req, res) {
  try {
    const organizationId = req.organization.id;

    // Get current plan
    const planResult = await db.query(
      'SELECT plan_tier FROM organizations WHERE id = $1',
      [organizationId]
    );

    const planTier = planResult.rows[0]?.plan_tier || 'free';
    const planLimits = PLANS[planTier].limits;

    // Get bot count
    const botsResult = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1',
      [organizationId]
    );
    const botsCount = parseInt(botsResult.rows[0].count);

    // Get messages this month
    const messagesResult = await db.query(
      `SELECT COUNT(*) as count
       FROM bot_messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.organization_id = $1
       AND m.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [organizationId]
    );
    const messagesCount = parseInt(messagesResult.rows[0].count);

    // Calculate API calls (if tracked)
    const apiCallsCount = 0; // TODO: Implement API call tracking

    return res.status(200).json({
      success: true,
      usage: {
        bots: {
          current: botsCount,
          limit: planLimits.bots,
          percentage: planLimits.bots === -1 ? 0 : (botsCount / planLimits.bots) * 100
        },
        messages: {
          current: messagesCount,
          limit: planLimits.messages,
          percentage: planLimits.messages === -1 ? 0 : (messagesCount / planLimits.messages) * 100
        },
        apiCalls: {
          current: apiCallsCount,
          limit: planLimits.apiCalls,
          percentage: planLimits.apiCalls === -1 ? 0 : (apiCallsCount / planLimits.apiCalls) * 100
        }
      }
    });

  } catch (error) {
    console.error('Get usage error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics',
      error: error.message
    });
  }
}

/**
 * Cancel subscription
 * POST /api/billing/cancel
 */
async function cancelSubscription(req, res) {
  try {
    const organizationId = req.organization.id;

    const orgResult = await db.query(
      'SELECT stripe_subscription_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription'
      });
    }

    // Cancel at period end (don't immediately cancel)
    const subscription = await stripe.subscriptions.update(
      orgResult.rows[0].stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Subscription will be canceled at period end',
      subscription: {
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
}

/**
 * Get available plans
 * GET /api/billing/plans
 */
async function getPlans(req, res) {
  try {
    return res.status(200).json({
      success: true,
      plans: PLANS
    });
  } catch (error) {
    console.error('Get plans error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get plans',
      error: error.message
    });
  }
}

module.exports = {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  getInvoices,
  getUsage,
  cancelSubscription,
  getPlans,
  PLANS
};
