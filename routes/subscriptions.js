const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sendSubscriptionUpgradedEmail, sendPaymentReceivedEmail } = require('../services/emailService');

// GET SUBSCRIPTION PLANS
router.get('/plans', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// GET CURRENT SUBSCRIPTION
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        us.*,
        sp.name as plan_name,
        sp.display_name,
        sp.price_monthly,
        sp.price_yearly,
        sp.max_bots,
        sp.max_messages_per_month,
        sp.features
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = $1
    `, [req.user.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Get current bot count
    const botsResult = await pool.query(
      'SELECT COUNT(*) as count FROM bots WHERE user_id = $1',
      [req.user.userId]
    );

    // Get current month message count
    const messagesResult = await pool.query(`
      SELECT COALESCE(SUM(count), 0) as count
      FROM usage_tracking
      WHERE user_id = $1
      AND metric_type IN ('message_sent', 'message_received')
      AND tracked_at >= DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.userId]);

    const subscription = result.rows[0];
    subscription.current_bot_count = parseInt(botsResult.rows[0].count);
    subscription.current_message_count = parseInt(messagesResult.rows[0].count);
    subscription.can_create_more_bots = subscription.max_bots === -1 ||
      subscription.current_bot_count < subscription.max_bots;

    res.json(subscription);
  } catch (error) {
    console.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// CREATE STRIPE CHECKOUT SESSION
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { planId, billingCycle } = req.body;

    // Get plan details
    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1',
      [planId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult.rows[0];
    const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;

    // For free plan, just update subscription
    if (plan.name === 'free') {
      await pool.query(`
        UPDATE user_subscriptions
        SET plan_id = $1,
            status = 'active',
            billing_cycle = 'monthly',
            updated_at = NOW()
        WHERE user_id = $2
      `, [planId, req.user.userId]);

      return res.json({ success: true, message: 'Switched to Free plan' });
    }

    // Create or get Stripe customer
    let customerId;
    const subResult = await pool.query(
      'SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = $1',
      [req.user.userId]
    );

    if (subResult.rows[0]?.stripe_customer_id) {
      customerId = subResult.rows[0].stripe_customer_id;
    } else {
      const userResult = await pool.query(
        'SELECT email, name FROM users WHERE id = $1',
        [req.user.userId]
      );
      const user = userResult.rows[0];

      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: req.user.userId }
      });

      customerId = customer.id;

      await pool.query(
        'UPDATE user_subscriptions SET stripe_customer_id = $1 WHERE user_id = $2',
        [customerId, req.user.userId]
      );
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: plan.display_name,
            description: plan.description,
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
          recurring: {
            interval: billingCycle === 'yearly' ? 'year' : 'month'
          }
        },
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/billing?canceled=true`,
      metadata: {
        userId: req.user.userId,
        planId: planId,
        billingCycle: billingCycle
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Error creating checkout:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// UPGRADE/DOWNGRADE SUBSCRIPTION
router.post('/change-plan', authenticateToken, async (req, res) => {
  try {
    const { planId } = req.body;

    const planResult = await pool.query(
      'SELECT * FROM subscription_plans WHERE id = $1',
      [planId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = planResult.rows[0];

    // If downgrading to free, cancel Stripe subscription
    if (plan.name === 'free') {
      const subResult = await pool.query(
        'SELECT stripe_subscription_id FROM user_subscriptions WHERE user_id = $1',
        [req.user.userId]
      );

      if (subResult.rows[0]?.stripe_subscription_id) {
        await stripe.subscriptions.cancel(subResult.rows[0].stripe_subscription_id);
      }

      await pool.query(`
        UPDATE user_subscriptions
        SET plan_id = $1,
            status = 'active',
            stripe_subscription_id = NULL,
            cancel_at_period_end = false,
            updated_at = NOW()
        WHERE user_id = $2
      `, [planId, req.user.userId]);

      return res.json({ success: true, message: 'Downgraded to Free plan' });
    }

    res.json({
      success: true,
      message: 'Please use create-checkout to upgrade to a paid plan'
    });
  } catch (error) {
    console.error('Error changing plan:', error);
    res.status(500).json({ error: 'Failed to change plan' });
  }
});

// CANCEL SUBSCRIPTION
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const subResult = await pool.query(
      'SELECT stripe_subscription_id FROM user_subscriptions WHERE user_id = $1',
      [req.user.userId]
    );

    if (!subResult.rows[0]?.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    // Cancel at period end (don't immediately cancel)
    await stripe.subscriptions.update(
      subResult.rows[0].stripe_subscription_id,
      { cancel_at_period_end: true }
    );

    await pool.query(
      'UPDATE user_subscriptions SET cancel_at_period_end = true WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({ success: true, message: 'Subscription will be canceled at period end' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// REACTIVATE SUBSCRIPTION
router.post('/reactivate', authenticateToken, async (req, res) => {
  try {
    const subResult = await pool.query(
      'SELECT stripe_subscription_id FROM user_subscriptions WHERE user_id = $1',
      [req.user.userId]
    );

    if (!subResult.rows[0]?.stripe_subscription_id) {
      return res.status(400).json({ error: 'No subscription to reactivate' });
    }

    await stripe.subscriptions.update(
      subResult.rows[0].stripe_subscription_id,
      { cancel_at_period_end: false }
    );

    await pool.query(
      'UPDATE user_subscriptions SET cancel_at_period_end = false WHERE user_id = $1',
      [req.user.userId]
    );

    res.json({ success: true, message: 'Subscription reactivated' });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

// GET PAYMENT HISTORY
router.get('/payment-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM payment_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// STRIPE WEBHOOK HANDLER
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = parseInt(session.metadata.userId);
        const planId = parseInt(session.metadata.planId);
        const billingCycle = session.metadata.billingCycle;

        // Update subscription
        await pool.query(`
          UPDATE user_subscriptions
          SET plan_id = $1,
              stripe_subscription_id = $2,
              status = 'active',
              billing_cycle = $3,
              current_period_start = NOW(),
              current_period_end = NOW() + INTERVAL '1 ${billingCycle === 'yearly' ? 'year' : 'month'}',
              updated_at = NOW()
          WHERE user_id = $4
        `, [planId, session.subscription, billingCycle, userId]);

        // Get plan name
        const planResult = await pool.query('SELECT display_name FROM subscription_plans WHERE id = $1', [planId]);
        const planName = planResult.rows[0].display_name;

        // Send notification email
        await sendSubscriptionUpgradedEmail(userId, planName);

        console.log(`✅ Subscription activated for user ${userId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        // Find user by customer ID
        const userResult = await pool.query(
          'SELECT user_id FROM user_subscriptions WHERE stripe_customer_id = $1',
          [customerId]
        );

        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].user_id;

          // Log payment
          await pool.query(`
            INSERT INTO payment_history (user_id, stripe_payment_intent_id, amount, currency, status, description, receipt_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            userId,
            invoice.payment_intent,
            invoice.amount_paid / 100,
            invoice.currency,
            'succeeded',
            invoice.description || 'Subscription payment',
            invoice.hosted_invoice_url
          ]);

          // Get subscription details
          const subResult = await pool.query(`
            SELECT sp.display_name
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_id = $1
          `, [userId]);

          const planName = subResult.rows[0]?.display_name || 'Subscription';

          // Send payment confirmation email
          await sendPaymentReceivedEmail(userId, invoice.amount_paid / 100, planName);

          console.log(`✅ Payment processed for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        // Downgrade to free plan
        await pool.query(`
          UPDATE user_subscriptions us
          SET plan_id = (SELECT id FROM subscription_plans WHERE name = 'free'),
              status = 'canceled',
              stripe_subscription_id = NULL,
              cancel_at_period_end = false,
              updated_at = NOW()
          WHERE stripe_subscription_id = $1
        `, [subscription.id]);

        console.log(`✅ Subscription canceled: ${subscription.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
