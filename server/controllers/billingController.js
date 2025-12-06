const log = require('../utils/logger');
const db = require('../db');
const webhookService = require('../services/webhookService');

// Initialize Stripe only if key is configured
let stripe = null;
const STRIPE_CONFIGURED = !!process.env.STRIPE_SECRET_KEY;

if (STRIPE_CONFIGURED) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const keyPrefix = process.env.STRIPE_SECRET_KEY.substring(0, 20);
    const keySuffix = process.env.STRIPE_SECRET_KEY.slice(-4);
    log.info('Stripe initialized successfully', {
      keyPrefix: `${keyPrefix}...${keySuffix}`,
      proPriceId: process.env.STRIPE_PRO_PRICE_ID || 'NOT SET',
      enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'NOT SET'
    });
  } catch (error) {
    log.error('Failed to initialize Stripe', { error: error.message });
  }
} else {
  log.warn('Stripe not configured - billing features will be limited to viewing plans');
}

/**
 * Billing Controller
 * Handles subscription management and Stripe integration
 * Gracefully handles missing Stripe configuration
 */

/**
 * Check if Stripe is configured
 */
function isStripeConfigured() {
  return STRIPE_CONFIGURED && stripe !== null;
}

/**
 * Validate Stripe configuration for operations that require it
 */
function validateStripeConfig(res) {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Billing system not configured. Please contact support.',
      code: 'STRIPE_NOT_CONFIGURED'
    });
  }
  return null;
}

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

    if (!planDetails) {
      return res.status(500).json({
        success: false,
        message: `Invalid plan tier: ${planTier}`
      });
    }

    // Get Stripe subscription if exists and Stripe is configured
    let stripeSubscription = null;
    if (isStripeConfigured() && org.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      } catch (error) {
        log.error('Error fetching Stripe subscription', { error: error.message });
        // Don't fail the request, just log the error
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
        stripeSubscription: stripeSubscription,
        stripeConfigured: isStripeConfigured()
      }
    });

  } catch (error) {
    log.error('Get subscription error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get subscription'
    });
  }
}

// Idempotency cache (in-memory store)
// In production, use Redis or database
const idempotencyCache = new Map();

// Clean old idempotency keys after 24 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of idempotencyCache.entries()) {
    if (now - value.timestamp > 24 * 60 * 60 * 1000) {
      idempotencyCache.delete(key);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

/**
 * Create Stripe checkout session for upgrade
 * POST /api/billing/checkout
 */
async function createCheckoutSession(req, res) {
  try {
    // Validate Stripe configuration first
    const stripeError = validateStripeConfig(res);
    if (stripeError) return stripeError;

    const organizationId = req.organization.id;
    const { priceId } = req.body;
    const idempotencyKey = req.headers['idempotency-key'];

    // Check idempotency key
    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
      log.info('Returning cached response for idempotency key', { idempotencyKey });
      return res.status(200).json(idempotencyCache.get(idempotencyKey).response);
    }

    // Validate priceId
    if (!priceId) {
      return res.status(400).json({
        success: false,
        message: 'Price ID is required'
      });
    }

    // Determine plan from priceId
    let plan = null;
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
      plan = 'pro';
    } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
      plan = 'enterprise';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid price ID'
      });
    }

    const planDetails = PLANS[plan];

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

    log.info('Creating checkout session', { plan, priceId, idempotencyKey });

    // Create checkout session with Stripe idempotency
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.FRONTEND_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/billing?canceled=true`,
      metadata: {
        organizationId: org.id,
        plan: plan
      }
    }, {
      idempotencyKey: idempotencyKey // Pass idempotency key to Stripe
    });

    const response = {
      success: true,
      sessionId: session.id,
      url: session.url
    };

    // Cache response for idempotency
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        response,
        timestamp: Date.now()
      });
      log.info('Cached response for idempotency key', { idempotencyKey });
    }

    return res.status(200).json(response);

  } catch (error) {
    log.error('Create checkout session error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
}

/**
 * Create Stripe customer portal session
 * POST /api/billing/portal
 */
async function createPortalSession(req, res) {
  try {
    // Validate Stripe configuration first
    const stripeError = validateStripeConfig(res);
    if (stripeError) return stripeError;

    const organizationId = req.organization.id;

    const orgResult = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_customer_id) {
      log.warn('User attempted to access portal without Stripe customer ID', { organizationId });
      return res.status(400).json({
        success: false,
        message: 'You need to subscribe to a paid plan before accessing subscription management.',
        code: 'NO_STRIPE_CUSTOMER',
        hint: 'Please upgrade to Pro or Enterprise plan first'
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
    log.error('Create portal session error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to create portal session'
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

    // Get organization's stripe customer ID
    const orgResult = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    // If no organization or no stripe customer, return empty array
    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_customer_id) {
      return res.status(200).json({
        success: true,
        invoices: [],
        message: 'No billing history available'
      });
    }

    // If Stripe is not configured, return empty array
    if (!isStripeConfigured()) {
      return res.status(200).json({
        success: true,
        invoices: [],
        message: 'Billing system not configured'
      });
    }

    // Fetch invoices from Stripe
    try {
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
    } catch (stripeError) {
      log.error('Stripe API error when fetching invoices', { error: stripeError.message });
      return res.status(200).json({
        success: true,
        invoices: [],
        message: 'Unable to fetch invoices at this time'
      });
    }

  } catch (error) {
    log.error('Get invoices error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get invoices'
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
    log.error('Get usage error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics'
    });
  }
}

/**
 * Cancel subscription
 * POST /api/billing/cancel
 */
async function cancelSubscription(req, res) {
  try {
    // Validate Stripe configuration first
    const stripeError = validateStripeConfig(res);
    if (stripeError) return stripeError;

    const organizationId = req.organization.id;

    const orgResult = await db.query(
      'SELECT stripe_subscription_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_subscription_id) {
      log.warn('User attempted to cancel subscription without active subscription', { organizationId });
      return res.status(400).json({
        success: false,
        message: 'You don\'t have an active paid subscription to cancel.',
        code: 'NO_ACTIVE_SUBSCRIPTION',
        hint: 'Only Pro and Enterprise plans can be canceled'
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
    log.error('Cancel subscription error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
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
    log.error('Get plans error', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to get plans'
    });
  }
}

/**
 * Handle Stripe webhook events
 * POST /api/billing/webhook
 */
async function handleWebhook(req, res) {
  // Get webhook secret
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret === 'whsec_your_webhook_secret_here') {
    log.error('STRIPE_WEBHOOK_SECRET not configured properly');
    return res.status(500).json({
      success: false,
      message: 'Webhook secret not configured'
    });
  }

  // Verify Stripe is configured
  if (!isStripeConfigured()) {
    log.error('Stripe not configured');
    return res.status(500).json({
      success: false,
      message: 'Stripe not configured'
    });
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    log.info('Stripe webhook received', {
      eventType: event.type,
      eventId: event.id
    });
  } catch (err) {
    log.error('Webhook signature verification failed', { error: err.message });
    return res.status(400).json({
      success: false,
      message: `Webhook Error: ${err.message}`
    });
  }

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        log.warn('Unhandled Stripe event type', { eventType: event.type });
    }

    log.info('Webhook processed successfully');

    return res.status(200).json({ received: true });

  } catch (error) {
    log.error('Error processing webhook', { error: error.message, stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Error processing webhook'
    });
  }
}

/**
 * Handle checkout.session.completed event
 * When a customer completes the checkout process
 */
async function handleCheckoutSessionCompleted(session) {
  log.info('Processing checkout.session.completed', {
    sessionId: session.id,
    customer: session.customer,
    subscription: session.subscription
  });

  const organizationId = session.metadata?.organizationId;
  const plan = session.metadata?.plan;

  if (!organizationId) {
    log.error('No organizationId in session metadata');
    return;
  }

  try {
    // Get the subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(session.subscription);

    log.info('Subscription details retrieved', {
      plan,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

    // Update organization with subscription details
    const result = await db.query(
      `UPDATE organizations
       SET stripe_customer_id = $1,
           stripe_subscription_id = $2,
           subscription_status = $3,
           plan_tier = $4,
           subscription_current_period_end = $5
       WHERE id = $6
       RETURNING id, name, plan_tier`,
      [
        session.customer,
        session.subscription,
        subscription.status,
        plan,
        new Date(subscription.current_period_end * 1000),
        organizationId
      ]
    );

    if (result.rows.length > 0) {
      log.info('Organization upgraded successfully', {
        organizationName: result.rows[0].name,
        plan
      });

      // Trigger webhook for user subscription
      await webhookService.trigger(organizationId, 'user.subscribed', {
        organization_id: organizationId,
        organization_name: result.rows[0].name,
        plan: plan,
        subscription_id: session.subscription,
        status: subscription.status,
        current_period_end: new Date(subscription.current_period_end * 1000),
        subscribed_at: new Date().toISOString()
      });
    } else {
      log.error('Organization not found after checkout', { organizationId });
    }

  } catch (error) {
    log.error('Error in handleCheckoutSessionCompleted', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Handle customer.subscription.updated event
 * When a subscription is modified (plan change, cancellation scheduled, etc.)
 */
async function handleSubscriptionUpdated(subscription) {
  log.info('Processing customer.subscription.updated', {
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });

  try {
    // Find organization by subscription ID
    const orgResult = await db.query(
      'SELECT id, name, plan_tier FROM organizations WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    if (orgResult.rows.length === 0) {
      log.warn('No organization found with subscription ID', { subscriptionId: subscription.id });
      return;
    }

    const org = orgResult.rows[0];

    // Determine plan tier from subscription items
    let newPlanTier = org.plan_tier; // Default to current plan

    // Check if subscription has items and get the price ID
    if (subscription.items?.data?.length > 0) {
      const priceId = subscription.items.data[0].price.id;

      // Map price ID to plan tier
      if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
        newPlanTier = 'pro';
      } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
        newPlanTier = 'enterprise';
      }
    }

    log.info('Subscription plan update', {
      currentPlan: org.plan_tier,
      newPlan: newPlanTier,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });

    // Update organization
    const result = await db.query(
      `UPDATE organizations
       SET subscription_status = $1,
           plan_tier = $2,
           subscription_current_period_end = $3
       WHERE id = $4
       RETURNING id, name, plan_tier, subscription_status`,
      [
        subscription.status,
        newPlanTier,
        new Date(subscription.current_period_end * 1000),
        org.id
      ]
    );

    if (result.rows.length > 0) {
      log.info('Organization subscription updated', {
        organizationName: result.rows[0].name,
        status: result.rows[0].subscription_status,
        plan: result.rows[0].plan_tier
      });
    }

  } catch (error) {
    log.error('Error in handleSubscriptionUpdated', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted event
 * When a subscription is canceled/expired
 */
async function handleSubscriptionDeleted(subscription) {
  log.info('Processing customer.subscription.deleted', {
    subscriptionId: subscription.id,
    status: subscription.status
  });

  try {
    // Find organization by subscription ID
    const orgResult = await db.query(
      'SELECT id, name FROM organizations WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    if (orgResult.rows.length === 0) {
      log.warn('No organization found with subscription ID', { subscriptionId: subscription.id });
      return;
    }

    const org = orgResult.rows[0];

    // Downgrade to free plan
    const result = await db.query(
      `UPDATE organizations
       SET subscription_status = $1,
           plan_tier = $2,
           stripe_subscription_id = NULL,
           subscription_current_period_end = NULL
       WHERE id = $3
       RETURNING id, name, plan_tier, subscription_status`,
      [
        'canceled',
        'free',
        org.id
      ]
    );

    if (result.rows.length > 0) {
      log.info('Organization downgraded to free plan', {
        organizationName: result.rows[0].name,
        status: result.rows[0].subscription_status
      });

      // Trigger webhook for user unsubscription
      await webhookService.trigger(org.id, 'user.unsubscribed', {
        organization_id: org.id,
        organization_name: result.rows[0].name,
        previous_plan: subscription.plan?.nickname || 'unknown',
        downgraded_to: 'free',
        subscription_id: subscription.id,
        status: 'canceled',
        unsubscribed_at: new Date().toISOString()
      });
    }

  } catch (error) {
    log.error('Error in handleSubscriptionDeleted', { error: error.message, stack: error.stack });
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded event
 * When a payment is successful
 */
async function handleInvoicePaymentSucceeded(invoice) {
  log.info('Processing invoice.payment_succeeded', {
    invoiceId: invoice.id,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency.toUpperCase(),
    subscription: invoice.subscription
  });

  // You can add additional logic here, such as:
  // - Sending a receipt email
  // - Recording the payment in a payments table
  // - Triggering notifications

  log.info('Payment recorded successfully', { invoiceId: invoice.id });
}

/**
 * Handle invoice.payment_failed event
 * When a payment fails
 */
async function handleInvoicePaymentFailed(invoice) {
  log.warn('Processing invoice.payment_failed', {
    invoiceId: invoice.id,
    amount: invoice.amount_due / 100,
    currency: invoice.currency.toUpperCase(),
    subscription: invoice.subscription
  });

  try {
    // Find organization by subscription ID
    const orgResult = await db.query(
      'SELECT id, name FROM organizations WHERE stripe_subscription_id = $1',
      [invoice.subscription]
    );

    if (orgResult.rows.length === 0) {
      log.warn('No organization found with subscription ID', { subscriptionId: invoice.subscription });
      return;
    }

    const org = orgResult.rows[0];

    // Update subscription status to past_due
    await db.query(
      `UPDATE organizations
       SET subscription_status = $1
       WHERE id = $2`,
      ['past_due', org.id]
    );

    log.warn('Organization marked as past_due', { organizationName: org.name });

    // You can add additional logic here, such as:
    // - Sending a payment failed email
    // - Limiting access to premium features
    // - Setting up retry logic

  } catch (error) {
    log.error('Error in handleInvoicePaymentFailed', { error: error.message, stack: error.stack });
    throw error;
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
  handleWebhook,
  PLANS
};
