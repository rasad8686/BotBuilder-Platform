const db = require('../config/db');
const crypto = require('crypto');

const resellerService = {
  async applyAsReseller(userId, data) {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const [reseller] = await db('resellers')
      .insert({
        user_id: userId,
        name: data.name,
        email: data.email,
        company_name: data.company_name,
        status: 'pending',
        tier: 'silver',
        commission_rate: 10.00,
        api_key: apiKey
      })
      .returning('*');
    return reseller;
  },

  async getResellerByUserId(userId) {
    return db('resellers').where('user_id', userId).first();
  },

  async getResellerById(id) {
    return db('resellers').where('id', id).first();
  },

  async getDashboardStats(resellerId) {
    const customers = await db('reseller_customers').where('reseller_id', resellerId).count('* as count').first();
    const commissions = await db('reseller_commissions')
      .where('reseller_id', resellerId)
      .sum('commission_amount as total')
      .first();
    const pendingCommissions = await db('reseller_commissions')
      .where({ reseller_id: resellerId, status: 'pending' })
      .sum('commission_amount as total')
      .first();
    const paidCommissions = await db('reseller_commissions')
      .where({ reseller_id: resellerId, status: 'paid' })
      .sum('commission_amount as total')
      .first();

    return {
      customersCount: parseInt(customers.count) || 0,
      totalCommissions: parseFloat(commissions.total) || 0,
      pendingCommissions: parseFloat(pendingCommissions.total) || 0,
      paidCommissions: parseFloat(paidCommissions.total) || 0
    };
  },

  async getCustomers(resellerId) {
    return db('reseller_customers')
      .join('organizations', 'reseller_customers.organization_id', 'organizations.id')
      .where('reseller_id', resellerId)
      .select('reseller_customers.*', 'organizations.name as organization_name');
  },

  async addCustomer(resellerId, orgId, customPrice, margin) {
    const [customer] = await db('reseller_customers')
      .insert({
        reseller_id: resellerId,
        organization_id: orgId,
        custom_price: customPrice,
        margin: margin
      })
      .returning('*');
    return customer;
  },

  async getCommissions(resellerId, filters = {}) {
    let query = db('reseller_commissions').where('reseller_id', resellerId);
    if (filters.status) query = query.where('status', filters.status);
    if (filters.startDate) query = query.where('period_start', '>=', filters.startDate);
    if (filters.endDate) query = query.where('period_end', '<=', filters.endDate);
    return query.orderBy('created_at', 'desc');
  },

  async calculateCommissions(resellerId, periodStart, periodEnd) {
    const reseller = await db('resellers').where('id', resellerId).first();
    const customers = await db('reseller_customers').where('reseller_id', resellerId);

    let totalCommission = 0;
    for (const customer of customers) {
      const revenue = await db('usage_billing')
        .where('organization_id', customer.organization_id)
        .whereBetween('billing_period_start', [periodStart, periodEnd])
        .sum('total_cost as total')
        .first();

      const commission = (parseFloat(revenue.total) || 0) * (reseller.commission_rate / 100);
      totalCommission += commission;

      await db('reseller_commissions').insert({
        reseller_id: resellerId,
        organization_id: customer.organization_id,
        period_start: periodStart,
        period_end: periodEnd,
        revenue: revenue.total || 0,
        commission_amount: commission,
        status: 'pending'
      });
    }

    return { totalCommission };
  },

  async getPayouts(resellerId) {
    return db('reseller_payouts').where('reseller_id', resellerId).orderBy('created_at', 'desc');
  },

  async requestPayout(resellerId, amount, method) {
    const [payout] = await db('reseller_payouts')
      .insert({
        reseller_id: resellerId,
        amount: amount,
        method: method,
        status: 'pending'
      })
      .returning('*');
    return payout;
  },

  async getBranding(resellerId) {
    const reseller = await db('resellers').where('id', resellerId).first();
    return reseller?.custom_branding || {};
  },

  async updateBranding(resellerId, branding) {
    const [reseller] = await db('resellers')
      .where('id', resellerId)
      .update({ custom_branding: branding })
      .returning('*');
    return reseller;
  },

  async getAllResellers(filters = {}) {
    let query = db('resellers');
    if (filters.status) query = query.where('status', filters.status);
    if (filters.tier) query = query.where('tier', filters.tier);
    return query.orderBy('created_at', 'desc');
  },

  async approveReseller(id) {
    const [reseller] = await db('resellers')
      .where('id', id)
      .update({ status: 'approved', approved_at: new Date() })
      .returning('*');
    return reseller;
  },

  async suspendReseller(id) {
    const [reseller] = await db('resellers')
      .where('id', id)
      .update({ status: 'suspended' })
      .returning('*');
    return reseller;
  },

  async updateResellerTier(id, tier, commissionRate) {
    const [reseller] = await db('resellers')
      .where('id', id)
      .update({ tier, commission_rate: commissionRate })
      .returning('*');
    return reseller;
  },

  async logActivity(resellerId, action, details) {
    await db('reseller_activity_logs').insert({
      reseller_id: resellerId,
      action: action,
      details: details
    });
  }
};

module.exports = resellerService;
