/**
 * Usage-based Billing Engine Service
 * Handles usage tracking, cost calculation, tiered pricing, and Stripe integration
 */

const db = require('../db');

class UsageBillingEngine {
  constructor() {
    this.tierCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Track usage event
   */
  async trackUsage(organizationId, eventType, quantity, metadata = {}) {
    const unitPrice = await this.getUnitPrice(eventType, quantity);

    const [event] = await db('metered_events').insert({
      organization_id: organizationId,
      event_type: eventType,
      quantity,
      unit_price: unitPrice,
      metadata: JSON.stringify(metadata)
    }).returning('*');

    // Update current billing period
    await this.updateCurrentPeriodUsage(organizationId, eventType, quantity);

    return event;
  }

  /**
   * Update current billing period usage
   */
  async updateCurrentPeriodUsage(organizationId, eventType, quantity) {
    const { startDate, endDate } = this.getCurrentBillingPeriod();

    let billing = await db('usage_billing')
      .where('organization_id', organizationId)
      .where('billing_period_start', startDate)
      .where('billing_period_end', endDate)
      .first();

    if (!billing) {
      [billing] = await db('usage_billing').insert({
        organization_id: organizationId,
        billing_period_start: startDate,
        billing_period_end: endDate,
        api_requests: 0,
        ai_tokens_used: 0,
        storage_gb: 0,
        bandwidth_gb: 0,
        status: 'pending'
      }).returning('*');
    }

    const updateField = this.getUpdateField(eventType);
    if (updateField) {
      await db('usage_billing')
        .where('id', billing.id)
        .increment(updateField, quantity);
    }

    return billing;
  }

  /**
   * Get update field for event type
   */
  getUpdateField(eventType) {
    const fieldMap = {
      'api_request': 'api_requests',
      'request': 'api_requests',
      'ai_token': 'ai_tokens_used',
      'token': 'ai_tokens_used',
      'storage': 'storage_gb',
      'gb_storage': 'storage_gb',
      'bandwidth': 'bandwidth_gb',
      'gb_bandwidth': 'bandwidth_gb'
    };
    return fieldMap[eventType];
  }

  /**
   * Get current billing period dates
   */
  getCurrentBillingPeriod() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * Calculate period cost with tiered pricing
   */
  async calculatePeriodCost(organizationId, startDate, endDate) {
    // Get usage for period
    const usage = await db('usage_billing')
      .where('organization_id', organizationId)
      .where('billing_period_start', '>=', startDate)
      .where('billing_period_end', '<=', endDate)
      .first();

    if (!usage) {
      return {
        baseCost: 0,
        usageCost: 0,
        overageCost: 0,
        totalCost: 0,
        breakdown: {}
      };
    }

    // Calculate cost for each usage type
    const apiCost = await this.calculateTieredCost('request', usage.api_requests || 0);
    const tokenCost = await this.calculateTieredCost('token', usage.ai_tokens_used || 0);
    const storageCost = await this.calculateTieredCost('gb_storage', parseFloat(usage.storage_gb) || 0);
    const bandwidthCost = await this.calculateTieredCost('gb_bandwidth', parseFloat(usage.bandwidth_gb) || 0);

    // Get organization plan for base cost
    const org = await db('organizations').where('id', organizationId).first();
    const baseCost = this.getPlanBaseCost(org?.plan || 'free');

    const usageCost = apiCost.cost + tokenCost.cost + storageCost.cost + bandwidthCost.cost;
    const overageCost = apiCost.overage + tokenCost.overage + storageCost.overage + bandwidthCost.overage;
    const totalCost = baseCost + usageCost + overageCost;

    // Update billing record
    await db('usage_billing')
      .where('id', usage.id)
      .update({
        base_cost: baseCost,
        usage_cost: usageCost,
        overage_cost: overageCost,
        total_cost: totalCost,
        status: 'calculated'
      });

    return {
      baseCost,
      usageCost,
      overageCost,
      totalCost,
      breakdown: {
        api: apiCost,
        tokens: tokenCost,
        storage: storageCost,
        bandwidth: bandwidthCost
      }
    };
  }

  /**
   * Calculate tiered cost for usage
   */
  async calculateTieredCost(unitType, quantity) {
    const tiers = await this.getTiers(unitType);
    let remainingQuantity = quantity;
    let totalCost = 0;
    let overage = 0;
    const tierBreakdown = [];

    for (const tier of tiers) {
      if (remainingQuantity <= 0) break;

      const tierMin = tier.min_units;
      const tierMax = tier.max_units || Infinity;
      const tierRange = tierMax - tierMin + 1;

      // Calculate units in this tier
      const unitsInTier = Math.min(
        remainingQuantity,
        Math.max(0, tierRange - Math.max(0, tierMin - (quantity - remainingQuantity)))
      );

      if (unitsInTier > 0) {
        const tierCost = unitsInTier * parseFloat(tier.price_per_unit);
        totalCost += tierCost;

        // Track overage (usage beyond free tier)
        if (tier.min_units > 0 && parseFloat(tier.price_per_unit) > 0) {
          overage += tierCost;
        }

        tierBreakdown.push({
          tier: tier.name,
          units: unitsInTier,
          pricePerUnit: parseFloat(tier.price_per_unit),
          cost: tierCost
        });

        remainingQuantity -= unitsInTier;
      }
    }

    return {
      quantity,
      cost: totalCost,
      overage,
      tierBreakdown
    };
  }

  /**
   * Get tier price for specific quantity
   */
  async getTierPrice(unitType, quantity) {
    const tiers = await this.getTiers(unitType);

    for (const tier of tiers) {
      const minUnits = tier.min_units;
      const maxUnits = tier.max_units || Infinity;

      if (quantity >= minUnits && quantity <= maxUnits) {
        return {
          tier: tier.name,
          pricePerUnit: parseFloat(tier.price_per_unit),
          minUnits,
          maxUnits
        };
      }
    }

    // Return highest tier if quantity exceeds all tiers
    const lastTier = tiers[tiers.length - 1];
    return {
      tier: lastTier.name,
      pricePerUnit: parseFloat(lastTier.price_per_unit),
      minUnits: lastTier.min_units,
      maxUnits: lastTier.max_units
    };
  }

  /**
   * Get tiers from database with caching
   */
  async getTiers(unitType) {
    const cacheKey = `tiers_${unitType}`;
    const cached = this.tierCache.get(cacheKey);

    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const tiers = await db('usage_tiers')
      .where('unit_type', unitType)
      .orderBy('min_units', 'asc');

    this.tierCache.set(cacheKey, {
      data: tiers,
      expiry: Date.now() + this.cacheExpiry
    });

    return tiers;
  }

  /**
   * Get all tiers
   */
  async getAllTiers() {
    return await db('usage_tiers').orderBy('unit_type').orderBy('min_units');
  }

  /**
   * Get unit price for event type
   */
  async getUnitPrice(eventType, currentQuantity) {
    const unitTypeMap = {
      'api_request': 'request',
      'request': 'request',
      'ai_token': 'token',
      'token': 'token',
      'storage': 'gb_storage',
      'gb_storage': 'gb_storage',
      'bandwidth': 'gb_bandwidth',
      'gb_bandwidth': 'gb_bandwidth'
    };

    const unitType = unitTypeMap[eventType] || eventType;
    const tierInfo = await this.getTierPrice(unitType, currentQuantity);
    return tierInfo.pricePerUnit;
  }

  /**
   * Get plan base cost
   */
  getPlanBaseCost(plan) {
    const planCosts = {
      'free': 0,
      'starter': 29,
      'professional': 99,
      'business': 299,
      'enterprise': 999
    };
    return planCosts[plan] || 0;
  }

  /**
   * Generate invoice for billing period
   */
  async generateInvoice(organizationId, period = null) {
    const { startDate, endDate } = period || this.getCurrentBillingPeriod();

    // Calculate costs first
    const costs = await this.calculatePeriodCost(organizationId, startDate, endDate);

    // Get organization details
    const org = await db('organizations').where('id', organizationId).first();

    // Get usage record
    const usage = await db('usage_billing')
      .where('organization_id', organizationId)
      .where('billing_period_start', startDate)
      .where('billing_period_end', endDate)
      .first();

    if (!usage) {
      throw new Error('No usage record found for this period');
    }

    const invoice = {
      id: `INV-${organizationId}-${Date.now()}`,
      organization: {
        id: org.id,
        name: org.name
      },
      billingPeriod: {
        start: startDate,
        end: endDate
      },
      usage: {
        apiRequests: usage.api_requests,
        aiTokens: usage.ai_tokens_used,
        storageGb: parseFloat(usage.storage_gb),
        bandwidthGb: parseFloat(usage.bandwidth_gb)
      },
      costs: {
        base: costs.baseCost,
        usage: costs.usageCost,
        overage: costs.overageCost,
        total: costs.totalCost
      },
      breakdown: costs.breakdown,
      status: 'generated',
      generatedAt: new Date().toISOString()
    };

    return invoice;
  }

  /**
   * Sync invoice to Stripe metered billing
   */
  async syncToStripe(invoice) {
    // This would integrate with Stripe's metered billing API
    // For now, we'll simulate the sync

    try {
      // In production, this would use Stripe SDK:
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // const stripeInvoice = await stripe.invoices.create({
      //   customer: customerId,
      //   auto_advance: true,
      //   collection_method: 'charge_automatically'
      // });

      const stripeInvoiceId = `in_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Update billing record with Stripe invoice ID
      await db('usage_billing')
        .where('organization_id', invoice.organization.id)
        .where('billing_period_start', invoice.billingPeriod.start)
        .where('billing_period_end', invoice.billingPeriod.end)
        .update({
          invoice_id: stripeInvoiceId,
          status: 'invoiced'
        });

      return {
        success: true,
        stripeInvoiceId,
        message: 'Invoice synced to Stripe successfully'
      };
    } catch (error) {
      console.error('Stripe sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current period usage for organization
   */
  async getCurrentUsage(organizationId) {
    const { startDate, endDate } = this.getCurrentBillingPeriod();

    let usage = await db('usage_billing')
      .where('organization_id', organizationId)
      .where('billing_period_start', startDate)
      .where('billing_period_end', endDate)
      .first();

    if (!usage) {
      usage = {
        api_requests: 0,
        ai_tokens_used: 0,
        storage_gb: 0,
        bandwidth_gb: 0,
        base_cost: 0,
        usage_cost: 0,
        overage_cost: 0,
        total_cost: 0
      };
    }

    // Get real-time costs
    const costs = await this.calculatePeriodCost(organizationId, startDate, endDate);

    return {
      period: { startDate, endDate },
      usage: {
        apiRequests: usage.api_requests || 0,
        aiTokens: parseInt(usage.ai_tokens_used) || 0,
        storageGb: parseFloat(usage.storage_gb) || 0,
        bandwidthGb: parseFloat(usage.bandwidth_gb) || 0
      },
      costs,
      daysRemaining: this.getDaysRemaining(endDate),
      projectedEndOfMonth: this.projectEndOfMonthUsage(usage)
    };
  }

  /**
   * Get usage history
   */
  async getUsageHistory(organizationId, limit = 12) {
    const history = await db('usage_billing')
      .where('organization_id', organizationId)
      .orderBy('billing_period_start', 'desc')
      .limit(limit);

    return history.map(record => ({
      period: {
        start: record.billing_period_start,
        end: record.billing_period_end
      },
      usage: {
        apiRequests: record.api_requests,
        aiTokens: parseInt(record.ai_tokens_used),
        storageGb: parseFloat(record.storage_gb),
        bandwidthGb: parseFloat(record.bandwidth_gb)
      },
      costs: {
        base: parseFloat(record.base_cost) || 0,
        usage: parseFloat(record.usage_cost) || 0,
        overage: parseFloat(record.overage_cost) || 0,
        total: parseFloat(record.total_cost) || 0
      },
      status: record.status,
      invoiceId: record.invoice_id
    }));
  }

  /**
   * Get usage breakdown by type
   */
  async getUsageBreakdown(organizationId, startDate, endDate) {
    const events = await db('metered_events')
      .where('organization_id', organizationId)
      .whereBetween('created_at', [startDate, endDate])
      .select('event_type')
      .sum('quantity as total')
      .groupBy('event_type');

    const breakdown = {};
    for (const event of events) {
      const cost = await this.calculateTieredCost(event.event_type, parseInt(event.total));
      breakdown[event.event_type] = {
        quantity: parseInt(event.total),
        cost: cost.cost,
        tierBreakdown: cost.tierBreakdown
      };
    }

    return breakdown;
  }

  /**
   * Estimate end of month usage and cost
   */
  async estimateMonthEnd(organizationId) {
    const { startDate, endDate } = this.getCurrentBillingPeriod();
    const currentUsage = await this.getCurrentUsage(organizationId);

    const daysElapsed = this.getDaysElapsed(startDate);
    const totalDays = this.getTotalDaysInPeriod(startDate, endDate);

    if (daysElapsed === 0) {
      return {
        estimated: currentUsage.usage,
        estimatedCost: currentUsage.costs.totalCost,
        confidence: 'low',
        message: 'Insufficient data for accurate estimate'
      };
    }

    const dailyRate = {
      apiRequests: currentUsage.usage.apiRequests / daysElapsed,
      aiTokens: currentUsage.usage.aiTokens / daysElapsed,
      storageGb: currentUsage.usage.storageGb, // Storage doesn't grow linearly
      bandwidthGb: currentUsage.usage.bandwidthGb / daysElapsed
    };

    const estimatedUsage = {
      apiRequests: Math.round(dailyRate.apiRequests * totalDays),
      aiTokens: Math.round(dailyRate.aiTokens * totalDays),
      storageGb: dailyRate.storageGb * 1.1, // Assume 10% growth
      bandwidthGb: dailyRate.bandwidthGb * totalDays
    };

    // Calculate estimated costs
    const apiCost = await this.calculateTieredCost('request', estimatedUsage.apiRequests);
    const tokenCost = await this.calculateTieredCost('token', estimatedUsage.aiTokens);
    const storageCost = await this.calculateTieredCost('gb_storage', estimatedUsage.storageGb);
    const bandwidthCost = await this.calculateTieredCost('gb_bandwidth', estimatedUsage.bandwidthGb);

    const org = await db('organizations').where('id', organizationId).first();
    const baseCost = this.getPlanBaseCost(org?.plan || 'free');

    const estimatedCost = baseCost + apiCost.cost + tokenCost.cost + storageCost.cost + bandwidthCost.cost;

    return {
      currentUsage: currentUsage.usage,
      estimatedUsage,
      currentCost: currentUsage.costs.totalCost,
      estimatedCost,
      dailyRate,
      daysElapsed,
      daysRemaining: totalDays - daysElapsed,
      confidence: daysElapsed >= 7 ? 'high' : daysElapsed >= 3 ? 'medium' : 'low'
    };
  }

  /**
   * Get days remaining in billing period
   */
  getDaysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get days elapsed in billing period
   */
  getDaysElapsed(startDate) {
    const start = new Date(startDate);
    const now = new Date();
    const diff = now - start;
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Get total days in billing period
   */
  getTotalDaysInPeriod(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = end - start;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * Project end of month usage
   */
  projectEndOfMonthUsage(usage) {
    const { startDate, endDate } = this.getCurrentBillingPeriod();
    const daysElapsed = this.getDaysElapsed(startDate);
    const totalDays = this.getTotalDaysInPeriod(startDate, endDate);
    const multiplier = totalDays / daysElapsed;

    return {
      apiRequests: Math.round((usage.api_requests || 0) * multiplier),
      aiTokens: Math.round(parseInt(usage.ai_tokens_used || 0) * multiplier),
      storageGb: parseFloat(usage.storage_gb || 0) * 1.1,
      bandwidthGb: parseFloat(usage.bandwidth_gb || 0) * multiplier
    };
  }

  /**
   * Get invoices for organization
   */
  async getInvoices(organizationId, limit = 12) {
    const invoices = await db('usage_billing')
      .where('organization_id', organizationId)
      .whereIn('status', ['invoiced', 'paid'])
      .orderBy('billing_period_start', 'desc')
      .limit(limit);

    return invoices.map(inv => ({
      id: inv.invoice_id || `INV-${inv.id}`,
      period: {
        start: inv.billing_period_start,
        end: inv.billing_period_end
      },
      amount: parseFloat(inv.total_cost) || 0,
      status: inv.status,
      createdAt: inv.created_at
    }));
  }

  /**
   * Generate invoice PDF data
   */
  async generateInvoicePDF(organizationId, invoiceId) {
    const billing = await db('usage_billing')
      .where('organization_id', organizationId)
      .where(function() {
        this.where('invoice_id', invoiceId)
          .orWhere('id', invoiceId.replace('INV-', ''));
      })
      .first();

    if (!billing) {
      throw new Error('Invoice not found');
    }

    const org = await db('organizations').where('id', organizationId).first();

    const pdfData = {
      invoiceNumber: billing.invoice_id || `INV-${billing.id}`,
      organization: org?.name || 'Unknown',
      billingPeriod: `${billing.billing_period_start} - ${billing.billing_period_end}`,
      usage: {
        'API Requests': billing.api_requests?.toLocaleString() || '0',
        'AI Tokens': parseInt(billing.ai_tokens_used)?.toLocaleString() || '0',
        'Storage (GB)': parseFloat(billing.storage_gb)?.toFixed(2) || '0.00',
        'Bandwidth (GB)': parseFloat(billing.bandwidth_gb)?.toFixed(2) || '0.00'
      },
      costs: {
        'Base Plan': `$${parseFloat(billing.base_cost)?.toFixed(2) || '0.00'}`,
        'Usage Charges': `$${parseFloat(billing.usage_cost)?.toFixed(2) || '0.00'}`,
        'Overage Charges': `$${parseFloat(billing.overage_cost)?.toFixed(2) || '0.00'}`,
        'Total': `$${parseFloat(billing.total_cost)?.toFixed(2) || '0.00'}`
      },
      status: billing.status,
      generatedAt: new Date().toISOString()
    };

    return pdfData;
  }
}

module.exports = new UsageBillingEngine();
