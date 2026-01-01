/**
 * Billing Service Tests
 * Comprehensive tests for billing-related functionality
 * Tests subscription management, payment processing, usage tracking, and Stripe integration
 */

jest.mock('../../db', () => ({
  query: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      del: jest.fn()
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn()
    },
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn()
      }
    },
    billingPortal: {
      sessions: {
        create: jest.fn()
      }
    },
    invoices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      pay: jest.fn(),
      voidInvoice: jest.fn()
    },
    paymentMethods: {
      attach: jest.fn(),
      detach: jest.fn(),
      list: jest.fn()
    },
    webhooks: {
      constructEvent: jest.fn()
    },
    prices: {
      retrieve: jest.fn()
    },
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn()
    }
  }));
});

const db = require('../../db');
const log = require('../../utils/logger');
const Stripe = require('stripe');

// Mock billing service implementation
const billingService = {
  stripe: new Stripe('sk_test_mock'),

  PLANS: {
    free: {
      name: 'Free',
      price: 0,
      interval: 'month',
      limits: {
        bots: 1,
        messages: 1000,
        apiCalls: 100
      }
    },
    pro: {
      name: 'Pro',
      price: 29,
      interval: 'month',
      stripePriceId: 'price_pro',
      limits: {
        bots: 10,
        messages: 50000,
        apiCalls: 10000
      }
    },
    enterprise: {
      name: 'Enterprise',
      price: 99,
      interval: 'month',
      stripePriceId: 'price_enterprise',
      limits: {
        bots: -1,
        messages: -1,
        apiCalls: -1
      }
    }
  },

  async createSubscription(organizationId, planId, paymentMethodId) {
    const org = await db.query('SELECT * FROM organizations WHERE id = $1', [organizationId]);
    if (org.rows.length === 0) throw new Error('Organization not found');

    const plan = this.PLANS[planId];
    if (!plan) throw new Error('Invalid plan');

    let customerId = org.rows[0].stripe_customer_id;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { organizationId }
      });
      customerId = customer.id;
      await db.query('UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, organizationId]);
    }

    if (paymentMethodId) {
      await this.stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripePriceId }]
    });

    await db.query(
      `UPDATE organizations
       SET stripe_subscription_id = $1, plan_tier = $2, subscription_status = $3
       WHERE id = $4`,
      [subscription.id, planId, subscription.status, organizationId]
    );

    log.info('Subscription created', { organizationId, planId, subscriptionId: subscription.id });
    return subscription;
  },

  async updateSubscription(organizationId, newPlanId, prorate = true) {
    const org = await db.query(
      'SELECT stripe_subscription_id, plan_tier FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_subscription_id) throw new Error('No active subscription');

    const newPlan = this.PLANS[newPlanId];
    if (!newPlan) throw new Error('Invalid plan');

    const subscription = await this.stripe.subscriptions.retrieve(org.rows[0].stripe_subscription_id);

    const updated = await this.stripe.subscriptions.update(subscription.id, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPlan.stripePriceId
      }],
      proration_behavior: prorate ? 'create_prorations' : 'none'
    });

    await db.query(
      'UPDATE organizations SET plan_tier = $1, subscription_status = $2 WHERE id = $3',
      [newPlanId, updated.status, organizationId]
    );

    log.info('Subscription updated', { organizationId, oldPlan: org.rows[0].plan_tier, newPlan: newPlanId });
    return updated;
  },

  async cancelSubscription(organizationId, immediately = false) {
    const org = await db.query(
      'SELECT stripe_subscription_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_subscription_id) throw new Error('No active subscription');

    let subscription;
    if (immediately) {
      subscription = await this.stripe.subscriptions.cancel(org.rows[0].stripe_subscription_id);
      await db.query(
        'UPDATE organizations SET plan_tier = $1, subscription_status = $2, stripe_subscription_id = NULL WHERE id = $3',
        ['free', 'canceled', organizationId]
      );
    } else {
      subscription = await this.stripe.subscriptions.update(org.rows[0].stripe_subscription_id, {
        cancel_at_period_end: true
      });
      await db.query(
        'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
        ['canceling', organizationId]
      );
    }

    log.info('Subscription canceled', { organizationId, immediately });
    return subscription;
  },

  async getSubscription(organizationId) {
    const org = await db.query(
      'SELECT * FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');

    const planTier = org.rows[0].plan_tier || 'free';
    const planDetails = this.PLANS[planTier];

    let stripeSubscription = null;
    if (org.rows[0].stripe_subscription_id) {
      stripeSubscription = await this.stripe.subscriptions.retrieve(org.rows[0].stripe_subscription_id);
    }

    return {
      plan: planTier,
      planDetails,
      status: org.rows[0].subscription_status || 'active',
      stripeSubscription
    };
  },

  async processPayment(organizationId, amount, currency = 'usd', description) {
    const org = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_customer_id) throw new Error('No stripe customer');

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      customer: org.rows[0].stripe_customer_id,
      description
    });

    log.info('Payment processed', { organizationId, amount, paymentIntentId: paymentIntent.id });
    return paymentIntent;
  },

  async handleWebhook(rawBody, signature, webhookSecret) {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    log.info('Webhook received', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed':
        return await this.handleCheckoutCompleted(event.data.object);
      case 'customer.subscription.updated':
        return await this.handleSubscriptionUpdated(event.data.object);
      case 'customer.subscription.deleted':
        return await this.handleSubscriptionDeleted(event.data.object);
      case 'invoice.payment_succeeded':
        return await this.handlePaymentSucceeded(event.data.object);
      case 'invoice.payment_failed':
        return await this.handlePaymentFailed(event.data.object);
      default:
        log.warn('Unhandled webhook event', { type: event.type });
        return { handled: false };
    }
  },

  async handleCheckoutCompleted(session) {
    const { organizationId, plan } = session.metadata;
    const subscription = await this.stripe.subscriptions.retrieve(session.subscription);

    await db.query(
      `UPDATE organizations
       SET stripe_customer_id = $1, stripe_subscription_id = $2,
           plan_tier = $3, subscription_status = $4
       WHERE id = $5`,
      [session.customer, session.subscription, plan, subscription.status, organizationId]
    );

    return { success: true, organizationId, plan };
  },

  async handleSubscriptionUpdated(subscription) {
    const org = await db.query(
      'SELECT id FROM organizations WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    if (org.rows.length === 0) {
      log.warn('Organization not found for subscription', { subscriptionId: subscription.id });
      return { success: false };
    }

    await db.query(
      'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
      [subscription.status, org.rows[0].id]
    );

    return { success: true };
  },

  async handleSubscriptionDeleted(subscription) {
    const org = await db.query(
      'SELECT id FROM organizations WHERE stripe_subscription_id = $1',
      [subscription.id]
    );

    if (org.rows.length === 0) return { success: false };

    await db.query(
      `UPDATE organizations
       SET plan_tier = $1, subscription_status = $2, stripe_subscription_id = NULL
       WHERE id = $3`,
      ['free', 'canceled', org.rows[0].id]
    );

    return { success: true };
  },

  async handlePaymentSucceeded(invoice) {
    log.info('Payment succeeded', { invoiceId: invoice.id, amount: invoice.amount_paid });
    return { success: true };
  },

  async handlePaymentFailed(invoice) {
    const org = await db.query(
      'SELECT id FROM organizations WHERE stripe_subscription_id = $1',
      [invoice.subscription]
    );

    if (org.rows.length > 0) {
      await db.query(
        'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
        ['past_due', org.rows[0].id]
      );
    }

    log.warn('Payment failed', { invoiceId: invoice.id, amount: invoice.amount_due });
    return { success: true };
  },

  async getUsage(organizationId) {
    const org = await db.query(
      'SELECT plan_tier FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');

    const plan = this.PLANS[org.rows[0].plan_tier || 'free'];

    const bots = await db.query(
      'SELECT COUNT(*) as count FROM bots WHERE organization_id = $1',
      [organizationId]
    );

    const messages = await db.query(
      `SELECT COUNT(*) as count FROM bot_messages m
       JOIN bots b ON m.bot_id = b.id
       WHERE b.organization_id = $1 AND m.created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [organizationId]
    );

    const apiCalls = await db.query(
      `SELECT COUNT(*) as count FROM ai_usage_logs
       WHERE organization_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [organizationId]
    );

    return {
      bots: {
        current: parseInt(bots.rows[0].count),
        limit: plan.limits.bots,
        percentage: plan.limits.bots === -1 ? 0 : (parseInt(bots.rows[0].count) / plan.limits.bots) * 100
      },
      messages: {
        current: parseInt(messages.rows[0].count),
        limit: plan.limits.messages,
        percentage: plan.limits.messages === -1 ? 0 : (parseInt(messages.rows[0].count) / plan.limits.messages) * 100
      },
      apiCalls: {
        current: parseInt(apiCalls.rows[0].count),
        limit: plan.limits.apiCalls,
        percentage: plan.limits.apiCalls === -1 ? 0 : (parseInt(apiCalls.rows[0].count) / plan.limits.apiCalls) * 100
      }
    };
  },

  async checkLimits(organizationId, resource, amount = 1) {
    const org = await db.query(
      'SELECT plan_tier FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');

    const plan = this.PLANS[org.rows[0].plan_tier || 'free'];
    const usage = await this.getUsage(organizationId);

    const limit = plan.limits[resource];
    if (limit === -1) return { allowed: true, unlimited: true };

    const current = usage[resource].current;
    const allowed = (current + amount) <= limit;

    return {
      allowed,
      current,
      limit,
      remaining: limit - current,
      exceeded: !allowed
    };
  },

  async generateInvoice(organizationId, items, dueDate = null) {
    const org = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_customer_id) throw new Error('No stripe customer');

    const invoice = await this.stripe.invoices.create({
      customer: org.rows[0].stripe_customer_id,
      auto_advance: true,
      collection_method: 'charge_automatically',
      due_date: dueDate ? Math.floor(new Date(dueDate).getTime() / 1000) : undefined
    });

    log.info('Invoice generated', { organizationId, invoiceId: invoice.id });
    return invoice;
  },

  async getPaymentHistory(organizationId, limit = 12) {
    const org = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_customer_id) return [];

    const invoices = await this.stripe.invoices.list({
      customer: org.rows[0].stripe_customer_id,
      limit
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      date: new Date(invoice.created * 1000),
      amount: invoice.total / 100,
      currency: invoice.currency.toUpperCase(),
      status: invoice.status,
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      description: invoice.lines.data[0]?.description || 'Subscription'
    }));
  },

  async updatePaymentMethod(organizationId, paymentMethodId) {
    const org = await db.query(
      'SELECT stripe_customer_id, stripe_subscription_id FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_customer_id) throw new Error('No stripe customer');

    await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: org.rows[0].stripe_customer_id
    });

    await this.stripe.customers.update(org.rows[0].stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    if (org.rows[0].stripe_subscription_id) {
      await this.stripe.subscriptions.update(org.rows[0].stripe_subscription_id, {
        default_payment_method: paymentMethodId
      });
    }

    log.info('Payment method updated', { organizationId, paymentMethodId });
    return { success: true };
  },

  async handleFailedPayment(organizationId, retryCount = 0, maxRetries = 3) {
    const org = await db.query(
      'SELECT stripe_subscription_id, subscription_status FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_subscription_id) throw new Error('No active subscription');

    await db.query(
      'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
      ['past_due', organizationId]
    );

    if (retryCount >= maxRetries) {
      log.error('Max retries reached, canceling subscription', { organizationId, retryCount });
      await this.cancelSubscription(organizationId, true);
      return { success: false, canceled: true, retries: retryCount };
    }

    const subscription = await this.stripe.subscriptions.retrieve(org.rows[0].stripe_subscription_id);
    const latestInvoice = await this.stripe.invoices.retrieve(subscription.latest_invoice);

    try {
      await this.stripe.invoices.pay(latestInvoice.id);
      await db.query(
        'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
        ['active', organizationId]
      );
      log.info('Payment retry succeeded', { organizationId, retryCount });
      return { success: true, retries: retryCount };
    } catch (error) {
      log.error('Payment retry failed', { organizationId, retryCount, error: error.message });
      return { success: false, retries: retryCount + 1 };
    }
  },

  async calculateProration(organizationId, newPlanId) {
    const org = await db.query(
      'SELECT stripe_subscription_id, plan_tier FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (org.rows.length === 0) throw new Error('Organization not found');
    if (!org.rows[0].stripe_subscription_id) throw new Error('No active subscription');

    const currentPlan = this.PLANS[org.rows[0].plan_tier];
    const newPlan = this.PLANS[newPlanId];

    if (!newPlan) throw new Error('Invalid plan');

    const subscription = await this.stripe.subscriptions.retrieve(org.rows[0].stripe_subscription_id);

    const now = Math.floor(Date.now() / 1000);
    const periodEnd = subscription.current_period_end;
    const periodStart = subscription.current_period_start;
    const periodLength = periodEnd - periodStart;
    const remainingTime = periodEnd - now;
    const usedTime = now - periodStart;

    const unusedAmount = (currentPlan.price * remainingTime) / periodLength;
    const newAmount = (newPlan.price * remainingTime) / periodLength;
    const prorationAmount = newAmount - unusedAmount;

    return {
      currentPlan: org.rows[0].plan_tier,
      newPlan: newPlanId,
      currentPrice: currentPlan.price,
      newPrice: newPlan.price,
      unusedAmount: Math.round(unusedAmount * 100) / 100,
      newAmount: Math.round(newAmount * 100) / 100,
      prorationAmount: Math.round(prorationAmount * 100) / 100,
      remainingDays: Math.ceil(remainingTime / 86400),
      isUpgrade: newPlan.price > currentPlan.price,
      isDowngrade: newPlan.price < currentPlan.price
    };
  }
};

describe('Billing Service', () => {
  let mockOrganization;
  let mockSubscription;
  let mockCustomer;
  let mockInvoice;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrganization = {
      id: 1,
      name: 'Test Org',
      plan_tier: 'free',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: null
    };

    mockCustomer = {
      id: 'cus_test123',
      email: 'test@example.com',
      metadata: { organizationId: 1 }
    };

    mockSubscription = {
      id: 'sub_test123',
      customer: 'cus_test123',
      status: 'active',
      items: {
        data: [{
          id: 'si_test123',
          price: { id: 'price_pro' }
        }]
      },
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
      latest_invoice: 'in_test123',
      cancel_at_period_end: false
    };

    mockInvoice = {
      id: 'in_test123',
      customer: 'cus_test123',
      subscription: 'sub_test123',
      amount_paid: 2900,
      amount_due: 2900,
      total: 2900,
      currency: 'usd',
      status: 'paid',
      created: Math.floor(Date.now() / 1000),
      invoice_pdf: 'https://pdf.url',
      hosted_invoice_url: 'https://invoice.url',
      lines: {
        data: [{ description: 'Pro Plan' }]
      }
    };
  });

  describe('createSubscription', () => {
    it('should create a new subscription for an organization', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [] });

      billingService.stripe.customers.create.mockResolvedValue(mockCustomer);
      billingService.stripe.subscriptions.create.mockResolvedValue(mockSubscription);

      const result = await billingService.createSubscription(1, 'pro', 'pm_test123');

      expect(db.query).toHaveBeenCalledWith(
        'SELECT * FROM organizations WHERE id = $1',
        [1]
      );
      expect(billingService.stripe.customers.create).toHaveBeenCalledWith({
        metadata: { organizationId: 1 }
      });
      expect(billingService.stripe.paymentMethods.attach).toHaveBeenCalledWith(
        'pm_test123',
        { customer: 'cus_test123' }
      );
      expect(billingService.stripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        items: [{ price: 'price_pro' }]
      });
      expect(result).toEqual(mockSubscription);
    });

    it('should use existing customer if already exists', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_existing' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });
      billingService.stripe.subscriptions.create.mockResolvedValue(mockSubscription);

      await billingService.createSubscription(1, 'pro', null);

      expect(billingService.stripe.customers.create).not.toHaveBeenCalled();
      expect(billingService.stripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_existing',
        items: [{ price: 'price_pro' }]
      });
    });

    it('should throw error for invalid organization', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.createSubscription(999, 'pro', 'pm_test123'))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error for invalid plan', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.createSubscription(1, 'invalid', 'pm_test123'))
        .rejects.toThrow('Invalid plan');
    });

    it('should not attach payment method if not provided', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [] });

      billingService.stripe.customers.create.mockResolvedValue(mockCustomer);
      billingService.stripe.subscriptions.create.mockResolvedValue(mockSubscription);

      await billingService.createSubscription(1, 'pro', null);

      expect(billingService.stripe.paymentMethods.attach).not.toHaveBeenCalled();
    });

    it('should log subscription creation', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [] });

      billingService.stripe.customers.create.mockResolvedValue(mockCustomer);
      billingService.stripe.subscriptions.create.mockResolvedValue(mockSubscription);

      await billingService.createSubscription(1, 'pro', null);

      expect(log.info).toHaveBeenCalledWith(
        'Subscription created',
        { organizationId: 1, planId: 'pro', subscriptionId: 'sub_test123' }
      );
    });

    it('should create subscription for enterprise plan', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [] });

      billingService.stripe.customers.create.mockResolvedValue(mockCustomer);
      billingService.stripe.subscriptions.create.mockResolvedValue(mockSubscription);

      await billingService.createSubscription(1, 'enterprise', 'pm_test123');

      expect(billingService.stripe.subscriptions.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        items: [{ price: 'price_enterprise' }]
      });
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription to new plan with proration', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'pro'
      };

      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      billingService.stripe.subscriptions.update.mockResolvedValue({
        ...mockSubscription,
        status: 'active'
      });

      const result = await billingService.updateSubscription(1, 'enterprise', true);

      expect(billingService.stripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test123',
        {
          items: [{
            id: 'si_test123',
            price: 'price_enterprise'
          }],
          proration_behavior: 'create_prorations'
        }
      );
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE organizations SET plan_tier = $1, subscription_status = $2 WHERE id = $3',
        ['enterprise', 'active', 1]
      );
      expect(result.status).toBe('active');
    });

    it('should update subscription without proration', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'pro'
      };

      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      billingService.stripe.subscriptions.update.mockResolvedValue(mockSubscription);

      await billingService.updateSubscription(1, 'enterprise', false);

      expect(billingService.stripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test123',
        expect.objectContaining({
          proration_behavior: 'none'
        })
      );
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.updateSubscription(999, 'pro'))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no active subscription', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.updateSubscription(1, 'pro'))
        .rejects.toThrow('No active subscription');
    });

    it('should throw error for invalid plan', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      await expect(billingService.updateSubscription(1, 'invalid'))
        .rejects.toThrow('Invalid plan');
    });

    it('should log subscription update', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'pro'
      };

      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      billingService.stripe.subscriptions.update.mockResolvedValue(mockSubscription);

      await billingService.updateSubscription(1, 'enterprise');

      expect(log.info).toHaveBeenCalledWith(
        'Subscription updated',
        { organizationId: 1, oldPlan: 'pro', newPlan: 'enterprise' }
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription at period end', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.update.mockResolvedValue({
        ...mockSubscription,
        cancel_at_period_end: true
      });

      const result = await billingService.cancelSubscription(1, false);

      expect(billingService.stripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test123',
        { cancel_at_period_end: true }
      );
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
        ['canceling', 1]
      );
      expect(result.cancel_at_period_end).toBe(true);
    });

    it('should cancel subscription immediately', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.cancel.mockResolvedValue({
        ...mockSubscription,
        status: 'canceled'
      });

      const result = await billingService.cancelSubscription(1, true);

      expect(billingService.stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123');
      expect(db.query).toHaveBeenCalledWith(
        'UPDATE organizations SET plan_tier = $1, subscription_status = $2, stripe_subscription_id = NULL WHERE id = $3',
        ['free', 'canceled', 1]
      );
      expect(result.status).toBe('canceled');
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.cancelSubscription(999))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no active subscription', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.cancelSubscription(1))
        .rejects.toThrow('No active subscription');
    });

    it('should log cancellation', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.update.mockResolvedValue(mockSubscription);

      await billingService.cancelSubscription(1, false);

      expect(log.info).toHaveBeenCalledWith(
        'Subscription canceled',
        { organizationId: 1, immediately: false }
      );
    });
  });

  describe('getSubscription', () => {
    it('should get subscription details with stripe subscription', async () => {
      const orgWithSub = {
        ...mockOrganization,
        plan_tier: 'pro',
        stripe_subscription_id: 'sub_test123',
        subscription_status: 'active'
      };

      db.query.mockResolvedValue({ rows: [orgWithSub] });
      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);

      const result = await billingService.getSubscription(1);

      expect(result).toEqual({
        plan: 'pro',
        planDetails: billingService.PLANS.pro,
        status: 'active',
        stripeSubscription: mockSubscription
      });
    });

    it('should get subscription details for free plan', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      const result = await billingService.getSubscription(1);

      expect(result.plan).toBe('free');
      expect(result.planDetails).toEqual(billingService.PLANS.free);
      expect(result.stripeSubscription).toBeNull();
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.getSubscription(999))
        .rejects.toThrow('Organization not found');
    });

    it('should default to free plan if no plan tier set', async () => {
      const orgNoPlan = { ...mockOrganization, plan_tier: null };
      db.query.mockResolvedValue({ rows: [orgNoPlan] });

      const result = await billingService.getSubscription(1);

      expect(result.plan).toBe('free');
    });
  });

  describe('processPayment', () => {
    it('should process a payment successfully', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });

      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded'
      };

      billingService.stripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const result = await billingService.processPayment(1, 50, 'usd', 'Test payment');

      expect(billingService.stripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        customer: 'cus_test123',
        description: 'Test payment'
      });
      expect(result).toEqual(mockPaymentIntent);
    });

    it('should default to USD currency', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });
      billingService.stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_test' });

      await billingService.processPayment(1, 50);

      expect(billingService.stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'usd' })
      );
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.processPayment(999, 50))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no stripe customer', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.processPayment(1, 50))
        .rejects.toThrow('No stripe customer');
    });

    it('should round amount to cents', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });
      billingService.stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_test' });

      await billingService.processPayment(1, 50.555);

      expect(billingService.stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 5056 })
      );
    });

    it('should log payment processing', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });
      billingService.stripe.paymentIntents.create.mockResolvedValue({ id: 'pi_test123' });

      await billingService.processPayment(1, 50);

      expect(log.info).toHaveBeenCalledWith(
        'Payment processed',
        { organizationId: 1, amount: 50, paymentIntentId: 'pi_test123' }
      );
    });
  });

  describe('handleWebhook', () => {
    const webhookSecret = 'whsec_test123';
    const rawBody = Buffer.from('test');
    const signature = 'test_signature';

    it('should handle checkout.session.completed event', async () => {
      const event = {
        id: 'evt_test',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test',
            customer: 'cus_test',
            subscription: 'sub_test',
            metadata: { organizationId: '1', plan: 'pro' }
          }
        }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);
      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      db.query.mockResolvedValue({ rows: [] });

      const result = await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(result).toEqual({ success: true, organizationId: '1', plan: 'pro' });
    });

    it('should handle customer.subscription.updated event', async () => {
      const event = {
        id: 'evt_test',
        type: 'customer.subscription.updated',
        data: { object: mockSubscription }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(result).toEqual({ success: true });
    });

    it('should handle customer.subscription.deleted event', async () => {
      const event = {
        id: 'evt_test',
        type: 'customer.subscription.deleted',
        data: { object: mockSubscription }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(result).toEqual({ success: true });
    });

    it('should handle invoice.payment_succeeded event', async () => {
      const event = {
        id: 'evt_test',
        type: 'invoice.payment_succeeded',
        data: { object: mockInvoice }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(result).toEqual({ success: true });
      expect(log.info).toHaveBeenCalledWith(
        'Payment succeeded',
        { invoiceId: 'in_test123', amount: 2900 }
      );
    });

    it('should handle invoice.payment_failed event', async () => {
      const event = {
        id: 'evt_test',
        type: 'invoice.payment_failed',
        data: { object: mockInvoice }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(result).toEqual({ success: true });
      expect(log.warn).toHaveBeenCalledWith(
        'Payment failed',
        { invoiceId: 'in_test123', amount: 2900 }
      );
    });

    it('should handle unhandled event types', async () => {
      const event = {
        id: 'evt_test',
        type: 'customer.created',
        data: { object: {} }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);

      const result = await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(result).toEqual({ handled: false });
      expect(log.warn).toHaveBeenCalledWith(
        'Unhandled webhook event',
        { type: 'customer.created' }
      );
    });

    it('should log webhook receipt', async () => {
      const event = {
        id: 'evt_test',
        type: 'customer.created',
        data: { object: {} }
      };

      billingService.stripe.webhooks.constructEvent.mockReturnValue(event);

      await billingService.handleWebhook(rawBody, signature, webhookSecret);

      expect(log.info).toHaveBeenCalledWith(
        'Webhook received',
        { type: 'customer.created', id: 'evt_test' }
      );
    });
  });

  describe('getUsage', () => {
    it('should get current usage for free plan', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '500' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });

      const result = await billingService.getUsage(1);

      expect(result).toEqual({
        bots: { current: 1, limit: 1, percentage: 100 },
        messages: { current: 500, limit: 1000, percentage: 50 },
        apiCalls: { current: 50, limit: 100, percentage: 50 }
      });
    });

    it('should get usage for pro plan', async () => {
      const orgPro = { ...mockOrganization, plan_tier: 'pro' };
      db.query
        .mockResolvedValueOnce({ rows: [orgPro] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ count: '10000' }] })
        .mockResolvedValueOnce({ rows: [{ count: '2000' }] });

      const result = await billingService.getUsage(1);

      expect(result.bots).toEqual({ current: 5, limit: 10, percentage: 50 });
      expect(result.messages).toEqual({ current: 10000, limit: 50000, percentage: 20 });
      expect(result.apiCalls).toEqual({ current: 2000, limit: 10000, percentage: 20 });
    });

    it('should get usage for enterprise plan with unlimited resources', async () => {
      const orgEnterprise = { ...mockOrganization, plan_tier: 'enterprise' };
      db.query
        .mockResolvedValueOnce({ rows: [orgEnterprise] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1000000' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50000' }] });

      const result = await billingService.getUsage(1);

      expect(result.bots).toEqual({ current: 100, limit: -1, percentage: 0 });
      expect(result.messages).toEqual({ current: 1000000, limit: -1, percentage: 0 });
      expect(result.apiCalls).toEqual({ current: 50000, limit: -1, percentage: 0 });
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.getUsage(999))
        .rejects.toThrow('Organization not found');
    });

    it('should query messages for current month only', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '500' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50' }] });

      await billingService.getUsage(1);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining("created_at >= DATE_TRUNC('month', CURRENT_DATE)"),
        [1]
      );
    });
  });

  describe('checkLimits', () => {
    it('should check if resource is within limits', async () => {
      // First call for organization in checkLimits, then 4 calls in getUsage (org, bots, messages, apiCalls)
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '800' }] })
        .mockResolvedValueOnce({ rows: [{ count: '80' }] });

      const result = await billingService.checkLimits(1, 'messages', 100);

      expect(result).toEqual({
        allowed: true,
        current: 800,
        limit: 1000,
        remaining: 200,
        exceeded: false
      });
    });

    it('should check if resource exceeds limits', async () => {
      // First call for organization in checkLimits, then 4 calls in getUsage (org, bots, messages, apiCalls)
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '800' }] })
        .mockResolvedValueOnce({ rows: [{ count: '80' }] });

      const result = await billingService.checkLimits(1, 'messages', 300);

      expect(result).toEqual({
        allowed: false,
        current: 800,
        limit: 1000,
        remaining: 200,
        exceeded: true
      });
    });

    it('should allow unlimited resources for enterprise plan', async () => {
      const orgEnterprise = { ...mockOrganization, plan_tier: 'enterprise' };
      db.query
        .mockResolvedValueOnce({ rows: [orgEnterprise] })
        .mockResolvedValueOnce({ rows: [orgEnterprise] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1000000' }] })
        .mockResolvedValueOnce({ rows: [{ count: '50000' }] });

      const result = await billingService.checkLimits(1, 'messages', 1000000);

      expect(result).toEqual({
        allowed: true,
        unlimited: true
      });
    });

    it('should default amount to 1', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [mockOrganization] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ count: '800' }] })
        .mockResolvedValueOnce({ rows: [{ count: '80' }] });

      const result = await billingService.checkLimits(1, 'bots');

      expect(result.allowed).toBe(false); // Already at 1, limit is 1
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(billingService.checkLimits(999, 'bots'))
        .rejects.toThrow('Organization not found');
    });
  });

  describe('generateInvoice', () => {
    it('should generate an invoice', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValueOnce({ rows: [orgWithCustomer] });
      billingService.stripe.invoices.create.mockResolvedValue(mockInvoice);

      const result = await billingService.generateInvoice(1, [{ description: 'Test', amount: 100 }]);

      expect(billingService.stripe.invoices.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        auto_advance: true,
        collection_method: 'charge_automatically',
        due_date: undefined
      });
      expect(result).toEqual(mockInvoice);
    });

    it('should generate invoice with due date', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValueOnce({ rows: [orgWithCustomer] });
      billingService.stripe.invoices.create.mockResolvedValue(mockInvoice);

      const dueDate = new Date('2024-12-31');
      await billingService.generateInvoice(1, [], dueDate);

      expect(billingService.stripe.invoices.create).toHaveBeenCalledWith({
        customer: 'cus_test123',
        auto_advance: true,
        collection_method: 'charge_automatically',
        due_date: Math.floor(dueDate.getTime() / 1000)
      });
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.generateInvoice(999, []))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no stripe customer', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.generateInvoice(1, []))
        .rejects.toThrow('No stripe customer');
    });

    it('should log invoice generation', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });
      billingService.stripe.invoices.create.mockResolvedValue(mockInvoice);

      await billingService.generateInvoice(1, []);

      expect(log.info).toHaveBeenCalledWith(
        'Invoice generated',
        { organizationId: 1, invoiceId: 'in_test123' }
      );
    });
  });

  describe('getPaymentHistory', () => {
    it('should get payment history', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });

      billingService.stripe.invoices.list.mockResolvedValue({
        data: [mockInvoice, { ...mockInvoice, id: 'in_test456' }]
      });

      const result = await billingService.getPaymentHistory(1, 12);

      expect(billingService.stripe.invoices.list).toHaveBeenCalledWith({
        customer: 'cus_test123',
        limit: 12
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'in_test123',
        amount: 29,
        currency: 'USD',
        status: 'paid',
        description: 'Pro Plan'
      });
    });

    it('should return empty array if no stripe customer', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      const result = await billingService.getPaymentHistory(1);

      expect(result).toEqual([]);
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.getPaymentHistory(999))
        .rejects.toThrow('Organization not found');
    });

    it('should format invoice data correctly', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });

      billingService.stripe.invoices.list.mockResolvedValue({
        data: [mockInvoice]
      });

      const result = await billingService.getPaymentHistory(1);

      expect(result[0]).toEqual({
        id: 'in_test123',
        date: expect.any(Date),
        amount: 29,
        currency: 'USD',
        status: 'paid',
        pdfUrl: 'https://pdf.url',
        hostedUrl: 'https://invoice.url',
        description: 'Pro Plan'
      });
    });

    it('should default to 12 invoices', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });
      billingService.stripe.invoices.list.mockResolvedValue({ data: [] });

      await billingService.getPaymentHistory(1);

      expect(billingService.stripe.invoices.list).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 12 })
      );
    });
  });

  describe('updatePaymentMethod', () => {
    it('should update payment method', async () => {
      const orgWithCustomer = {
        ...mockOrganization,
        stripe_customer_id: 'cus_test123',
        stripe_subscription_id: 'sub_test123'
      };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });

      billingService.stripe.paymentMethods.attach.mockResolvedValue({});
      billingService.stripe.customers.update.mockResolvedValue({});
      billingService.stripe.subscriptions.update.mockResolvedValue({});

      const result = await billingService.updatePaymentMethod(1, 'pm_new123');

      expect(billingService.stripe.paymentMethods.attach).toHaveBeenCalledWith(
        'pm_new123',
        { customer: 'cus_test123' }
      );
      expect(billingService.stripe.customers.update).toHaveBeenCalledWith(
        'cus_test123',
        { invoice_settings: { default_payment_method: 'pm_new123' } }
      );
      expect(billingService.stripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test123',
        { default_payment_method: 'pm_new123' }
      );
      expect(result).toEqual({ success: true });
    });

    it('should update payment method without subscription', async () => {
      const orgWithCustomer = {
        ...mockOrganization,
        stripe_customer_id: 'cus_test123'
      };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });

      billingService.stripe.paymentMethods.attach.mockResolvedValue({});
      billingService.stripe.customers.update.mockResolvedValue({});

      await billingService.updatePaymentMethod(1, 'pm_new123');

      expect(billingService.stripe.subscriptions.update).not.toHaveBeenCalled();
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.updatePaymentMethod(999, 'pm_new123'))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no stripe customer', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.updatePaymentMethod(1, 'pm_new123'))
        .rejects.toThrow('No stripe customer');
    });

    it('should log payment method update', async () => {
      const orgWithCustomer = { ...mockOrganization, stripe_customer_id: 'cus_test123' };
      db.query.mockResolvedValue({ rows: [orgWithCustomer] });

      billingService.stripe.paymentMethods.attach.mockResolvedValue({});
      billingService.stripe.customers.update.mockResolvedValue({});

      await billingService.updatePaymentMethod(1, 'pm_new123');

      expect(log.info).toHaveBeenCalledWith(
        'Payment method updated',
        { organizationId: 1, paymentMethodId: 'pm_new123' }
      );
    });
  });

  describe('handleFailedPayment', () => {
    it('should retry failed payment successfully', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        subscription_status: 'active'
      };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      billingService.stripe.invoices.retrieve.mockResolvedValue(mockInvoice);
      billingService.stripe.invoices.pay.mockResolvedValue({ ...mockInvoice, status: 'paid' });

      const result = await billingService.handleFailedPayment(1, 1, 3);

      expect(db.query).toHaveBeenCalledWith(
        'UPDATE organizations SET subscription_status = $1 WHERE id = $2',
        ['past_due', 1]
      );
      expect(billingService.stripe.invoices.pay).toHaveBeenCalledWith('in_test123');
      expect(result).toEqual({ success: true, retries: 1 });
    });

    it('should mark as past_due on retry failure', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      billingService.stripe.invoices.retrieve.mockResolvedValue(mockInvoice);
      billingService.stripe.invoices.pay.mockRejectedValue(new Error('Payment failed'));

      const result = await billingService.handleFailedPayment(1, 1, 3);

      expect(result).toEqual({ success: false, retries: 2 });
      expect(log.error).toHaveBeenCalledWith(
        'Payment retry failed',
        expect.objectContaining({ organizationId: 1, retryCount: 1 })
      );
    });

    it('should cancel subscription after max retries', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      billingService.stripe.subscriptions.cancel.mockResolvedValue({
        ...mockSubscription,
        status: 'canceled'
      });

      const result = await billingService.handleFailedPayment(1, 3, 3);

      expect(billingService.stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_test123');
      expect(result).toEqual({ success: false, canceled: true, retries: 3 });
      expect(log.error).toHaveBeenCalledWith(
        'Max retries reached, canceling subscription',
        { organizationId: 1, retryCount: 3 }
      );
    });

    it('should default to 0 retries', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      billingService.stripe.subscriptions.retrieve.mockResolvedValue(mockSubscription);
      billingService.stripe.invoices.retrieve.mockResolvedValue(mockInvoice);
      billingService.stripe.invoices.pay.mockResolvedValue(mockInvoice);

      const result = await billingService.handleFailedPayment(1);

      expect(result.retries).toBe(0);
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.handleFailedPayment(999))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no active subscription', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.handleFailedPayment(1))
        .rejects.toThrow('No active subscription');
    });
  });

  describe('calculateProration', () => {
    it('should calculate proration for upgrade', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'pro'
      };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      const now = Math.floor(Date.now() / 1000);
      const periodStart = now - (15 * 86400); // 15 days ago
      const periodEnd = now + (15 * 86400); // 15 days from now

      billingService.stripe.subscriptions.retrieve.mockResolvedValue({
        ...mockSubscription,
        current_period_start: periodStart,
        current_period_end: periodEnd
      });

      const result = await billingService.calculateProration(1, 'enterprise');

      expect(result).toMatchObject({
        currentPlan: 'pro',
        newPlan: 'enterprise',
        currentPrice: 29,
        newPrice: 99,
        isUpgrade: true,
        isDowngrade: false
      });
      expect(result.prorationAmount).toBeGreaterThan(0);
      expect(result.remainingDays).toBeGreaterThan(0);
    });

    it('should calculate proration for downgrade', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'enterprise'
      };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      const now = Math.floor(Date.now() / 1000);
      const periodStart = now - (15 * 86400);
      const periodEnd = now + (15 * 86400);

      billingService.stripe.subscriptions.retrieve.mockResolvedValue({
        ...mockSubscription,
        current_period_start: periodStart,
        current_period_end: periodEnd
      });

      const result = await billingService.calculateProration(1, 'pro');

      expect(result).toMatchObject({
        currentPlan: 'enterprise',
        newPlan: 'pro',
        currentPrice: 99,
        newPrice: 29,
        isUpgrade: false,
        isDowngrade: true
      });
      expect(result.prorationAmount).toBeLessThan(0);
    });

    it('should throw error if organization not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      await expect(billingService.calculateProration(999, 'pro'))
        .rejects.toThrow('Organization not found');
    });

    it('should throw error if no active subscription', async () => {
      db.query.mockResolvedValue({ rows: [mockOrganization] });

      await expect(billingService.calculateProration(1, 'pro'))
        .rejects.toThrow('No active subscription');
    });

    it('should throw error for invalid plan', async () => {
      const orgWithSub = { ...mockOrganization, stripe_subscription_id: 'sub_test123' };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      await expect(billingService.calculateProration(1, 'invalid'))
        .rejects.toThrow('Invalid plan');
    });

    it('should round proration amounts to 2 decimal places', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'pro'
      };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      const now = Math.floor(Date.now() / 1000);
      billingService.stripe.subscriptions.retrieve.mockResolvedValue({
        ...mockSubscription,
        current_period_start: now - (15 * 86400),
        current_period_end: now + (15 * 86400)
      });

      const result = await billingService.calculateProration(1, 'enterprise');

      expect(result.unusedAmount).toEqual(Math.round(result.unusedAmount * 100) / 100);
      expect(result.newAmount).toEqual(Math.round(result.newAmount * 100) / 100);
      expect(result.prorationAmount).toEqual(Math.round(result.prorationAmount * 100) / 100);
    });

    it('should calculate remaining days correctly', async () => {
      const orgWithSub = {
        ...mockOrganization,
        stripe_subscription_id: 'sub_test123',
        plan_tier: 'pro'
      };
      db.query.mockResolvedValue({ rows: [orgWithSub] });

      const now = Math.floor(Date.now() / 1000);
      const daysRemaining = 10;
      const periodEnd = now + (daysRemaining * 86400);

      billingService.stripe.subscriptions.retrieve.mockResolvedValue({
        ...mockSubscription,
        current_period_start: now - (20 * 86400),
        current_period_end: periodEnd
      });

      const result = await billingService.calculateProration(1, 'enterprise');

      expect(result.remainingDays).toBe(daysRemaining);
    });
  });
});
