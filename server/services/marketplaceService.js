/**
 * Marketplace Service
 * Handles marketplace items, purchases, installations, and seller earnings
 */

const db = require('../db');
const logger = require('../utils/logger');

const PLATFORM_FEE_RATE = 0.30; // 30% platform fee

class MarketplaceService {
  /**
   * Search marketplace items with filters
   */
  async searchItems(filters = {}) {
    const {
      query,
      type,
      category,
      priceType,
      minPrice,
      maxPrice,
      status = 'published',
      sortBy = 'downloads',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = filters;

    try {
      let queryBuilder = db('marketplace_items')
        .select(
          'marketplace_items.*',
          'users.name as seller_name',
          'users.email as seller_email'
        )
        .leftJoin('users', 'marketplace_items.seller_id', 'users.id')
        .where('marketplace_items.status', status);

      // Search by query
      if (query) {
        queryBuilder = queryBuilder.where(function() {
          this.whereILike('marketplace_items.name', `%${query}%`)
            .orWhereILike('marketplace_items.description', `%${query}%`)
            .orWhereRaw("marketplace_items.tags::text ILIKE ?", [`%${query}%`]);
        });
      }

      // Filter by type
      if (type) {
        queryBuilder = queryBuilder.where('marketplace_items.type', type);
      }

      // Filter by category
      if (category) {
        queryBuilder = queryBuilder.whereRaw(
          "marketplace_items.categories::jsonb ? ?",
          [category]
        );
      }

      // Filter by price type
      if (priceType) {
        queryBuilder = queryBuilder.where('marketplace_items.price_type', priceType);
      }

      // Filter by price range
      if (minPrice !== undefined) {
        queryBuilder = queryBuilder.where('marketplace_items.price', '>=', minPrice);
      }
      if (maxPrice !== undefined) {
        queryBuilder = queryBuilder.where('marketplace_items.price', '<=', maxPrice);
      }

      // Get total count
      const countResult = await queryBuilder.clone().count('* as total').first();
      const total = parseInt(countResult?.total || 0);

      // Sort
      const validSortColumns = ['downloads', 'rating', 'price', 'created_at', 'name'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'downloads';
      queryBuilder = queryBuilder.orderBy(`marketplace_items.${sortColumn}`, sortOrder === 'asc' ? 'asc' : 'desc');

      // Pagination
      const offset = (page - 1) * limit;
      queryBuilder = queryBuilder.offset(offset).limit(limit);

      const items = await queryBuilder;

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error searching marketplace items:', error);
      throw error;
    }
  }

  /**
   * Get featured items
   */
  async getFeaturedItems(limit = 10) {
    try {
      const items = await db('marketplace_items')
        .select(
          'marketplace_items.*',
          'users.name as seller_name'
        )
        .leftJoin('users', 'marketplace_items.seller_id', 'users.id')
        .where('marketplace_items.status', 'published')
        .orderBy('marketplace_items.rating', 'desc')
        .orderBy('marketplace_items.downloads', 'desc')
        .limit(limit);

      return items;
    } catch (error) {
      logger.error('Error getting featured items:', error);
      throw error;
    }
  }

  /**
   * Get categories
   */
  async getCategories() {
    try {
      const categories = await db('marketplace_categories')
        .select('*')
        .where('is_active', true)
        .orderBy('sort_order', 'asc');

      return categories;
    } catch (error) {
      logger.error('Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Get item by slug
   */
  async getItemBySlug(slug) {
    try {
      const item = await db('marketplace_items')
        .select(
          'marketplace_items.*',
          'users.name as seller_name',
          'users.email as seller_email'
        )
        .leftJoin('users', 'marketplace_items.seller_id', 'users.id')
        .where('marketplace_items.slug', slug)
        .first();

      return item;
    } catch (error) {
      logger.error('Error getting item by slug:', error);
      throw error;
    }
  }

  /**
   * Get item reviews
   */
  async getItemReviews(itemId, options = {}) {
    const { page = 1, limit = 10 } = options;

    try {
      const offset = (page - 1) * limit;

      const reviews = await db('marketplace_reviews')
        .select(
          'marketplace_reviews.*',
          'users.name as user_name'
        )
        .leftJoin('users', 'marketplace_reviews.user_id', 'users.id')
        .where('marketplace_reviews.item_id', itemId)
        .orderBy('marketplace_reviews.created_at', 'desc')
        .offset(offset)
        .limit(limit);

      const countResult = await db('marketplace_reviews')
        .where('item_id', itemId)
        .count('* as total')
        .first();

      return {
        reviews,
        total: parseInt(countResult?.total || 0),
        page,
        limit
      };
    } catch (error) {
      logger.error('Error getting item reviews:', error);
      throw error;
    }
  }

  /**
   * Purchase an item
   */
  async purchaseItem(userId, itemId, organizationId, stripePaymentId = null) {
    const trx = await db.transaction();

    try {
      // Get item
      const item = await trx('marketplace_items')
        .where('id', itemId)
        .where('status', 'published')
        .first();

      if (!item) {
        throw new Error('Item not found or not available');
      }

      // Check if already purchased by this org
      const existingPurchase = await trx('marketplace_purchases')
        .where('item_id', itemId)
        .where('organization_id', organizationId)
        .where('status', 'completed')
        .first();

      if (existingPurchase) {
        throw new Error('Item already purchased');
      }

      const price = item.price || 0;

      // Create purchase record
      const [purchase] = await trx('marketplace_purchases')
        .insert({
          item_id: itemId,
          user_id: userId,
          organization_id: organizationId,
          price,
          status: price === 0 ? 'completed' : 'pending',
          stripe_payment_id: stripePaymentId,
          completed_at: price === 0 ? new Date() : null
        })
        .returning('*');

      // If paid item, create seller earnings record
      if (price > 0 && item.seller_id) {
        const platformFee = price * PLATFORM_FEE_RATE;
        const netAmount = price - platformFee;

        await trx('seller_earnings').insert({
          seller_id: item.seller_id,
          item_id: itemId,
          purchase_id: purchase.id,
          gross_amount: price,
          platform_fee: platformFee,
          net_amount: netAmount,
          status: 'pending'
        });
      }

      // Update download count
      await trx('marketplace_items')
        .where('id', itemId)
        .increment('downloads', 1);

      await trx.commit();

      return purchase;
    } catch (error) {
      await trx.rollback();
      logger.error('Error purchasing item:', error);
      throw error;
    }
  }

  /**
   * Complete a purchase (after payment confirmation)
   */
  async completePurchase(purchaseId, stripePaymentId) {
    const trx = await db.transaction();

    try {
      const [purchase] = await trx('marketplace_purchases')
        .where('id', purchaseId)
        .update({
          status: 'completed',
          stripe_payment_id: stripePaymentId,
          completed_at: new Date()
        })
        .returning('*');

      // Update seller earnings to available
      await trx('seller_earnings')
        .where('purchase_id', purchaseId)
        .update({ status: 'available' });

      await trx.commit();

      return purchase;
    } catch (error) {
      await trx.rollback();
      logger.error('Error completing purchase:', error);
      throw error;
    }
  }

  /**
   * Install an item for an organization
   */
  async installItem(organizationId, itemId, userId) {
    try {
      // Check if item exists
      const item = await db('marketplace_items')
        .where('id', itemId)
        .where('status', 'published')
        .first();

      if (!item) {
        throw new Error('Item not found');
      }

      // Check if purchased (if not free)
      if (item.price_type !== 'free') {
        const purchase = await db('marketplace_purchases')
          .where('item_id', itemId)
          .where('organization_id', organizationId)
          .where('status', 'completed')
          .first();

        if (!purchase) {
          throw new Error('Item not purchased');
        }
      }

      // Check if already installed
      const existing = await db('marketplace_installations')
        .where('item_id', itemId)
        .where('organization_id', organizationId)
        .first();

      if (existing) {
        // Re-activate if inactive
        if (!existing.is_active) {
          const [installation] = await db('marketplace_installations')
            .where('id', existing.id)
            .update({
              is_active: true,
              version: item.version,
              updated_at: new Date()
            })
            .returning('*');
          return installation;
        }
        throw new Error('Item already installed');
      }

      // Create installation
      const [installation] = await db('marketplace_installations')
        .insert({
          item_id: itemId,
          organization_id: organizationId,
          user_id: userId,
          version: item.version,
          is_active: true
        })
        .returning('*');

      return installation;
    } catch (error) {
      logger.error('Error installing item:', error);
      throw error;
    }
  }

  /**
   * Uninstall an item
   */
  async uninstallItem(organizationId, itemId) {
    try {
      const [installation] = await db('marketplace_installations')
        .where('item_id', itemId)
        .where('organization_id', organizationId)
        .update({ is_active: false, updated_at: new Date() })
        .returning('*');

      return installation;
    } catch (error) {
      logger.error('Error uninstalling item:', error);
      throw error;
    }
  }

  /**
   * Write a review
   */
  async writeReview(userId, itemId, data) {
    const { rating, title, content } = data;

    try {
      // Check if user has purchased/installed the item
      const purchase = await db('marketplace_purchases')
        .where('item_id', itemId)
        .where('user_id', userId)
        .where('status', 'completed')
        .first();

      const item = await db('marketplace_items').where('id', itemId).first();

      if (!purchase && item?.price_type !== 'free') {
        throw new Error('You must purchase this item before reviewing');
      }

      // Create or update review
      const [review] = await db('marketplace_reviews')
        .insert({
          item_id: itemId,
          user_id: userId,
          rating,
          title,
          content
        })
        .onConflict(['item_id', 'user_id'])
        .merge({
          rating,
          title,
          content,
          updated_at: new Date()
        })
        .returning('*');

      // Update item rating
      await this.updateItemRating(itemId);

      return review;
    } catch (error) {
      logger.error('Error writing review:', error);
      throw error;
    }
  }

  /**
   * Update item rating based on reviews
   */
  async updateItemRating(itemId) {
    try {
      const result = await db('marketplace_reviews')
        .where('item_id', itemId)
        .avg('rating as avg_rating')
        .count('* as count')
        .first();

      await db('marketplace_items')
        .where('id', itemId)
        .update({
          rating: parseFloat(result?.avg_rating || 0).toFixed(2),
          reviews_count: parseInt(result?.count || 0),
          updated_at: new Date()
        });
    } catch (error) {
      logger.error('Error updating item rating:', error);
      throw error;
    }
  }

  /**
   * Get user's purchases
   */
  async getUserPurchases(userId, organizationId = null) {
    try {
      let query = db('marketplace_purchases')
        .select(
          'marketplace_purchases.*',
          'marketplace_items.name as item_name',
          'marketplace_items.slug as item_slug',
          'marketplace_items.icon_url',
          'marketplace_items.type'
        )
        .leftJoin('marketplace_items', 'marketplace_purchases.item_id', 'marketplace_items.id')
        .where('marketplace_purchases.user_id', userId);

      if (organizationId) {
        query = query.where('marketplace_purchases.organization_id', organizationId);
      }

      const purchases = await query.orderBy('marketplace_purchases.created_at', 'desc');

      return purchases;
    } catch (error) {
      logger.error('Error getting user purchases:', error);
      throw error;
    }
  }

  /**
   * Get installed items for an organization
   */
  async getInstalledItems(organizationId) {
    try {
      const installations = await db('marketplace_installations')
        .select(
          'marketplace_installations.*',
          'marketplace_items.name as item_name',
          'marketplace_items.slug as item_slug',
          'marketplace_items.icon_url',
          'marketplace_items.type',
          'marketplace_items.version as latest_version'
        )
        .leftJoin('marketplace_items', 'marketplace_installations.item_id', 'marketplace_items.id')
        .where('marketplace_installations.organization_id', organizationId)
        .where('marketplace_installations.is_active', true)
        .orderBy('marketplace_installations.installed_at', 'desc');

      return installations;
    } catch (error) {
      logger.error('Error getting installed items:', error);
      throw error;
    }
  }

  // ============ Seller Methods ============

  /**
   * Get seller's items
   */
  async getSellerItems(sellerId) {
    try {
      const items = await db('marketplace_items')
        .where('seller_id', sellerId)
        .orderBy('created_at', 'desc');

      return items;
    } catch (error) {
      logger.error('Error getting seller items:', error);
      throw error;
    }
  }

  /**
   * Create a new item
   */
  async createItem(sellerId, data) {
    try {
      const slug = this.generateSlug(data.name);

      const [item] = await db('marketplace_items')
        .insert({
          seller_id: sellerId,
          type: data.type,
          name: data.name,
          slug,
          description: data.description,
          long_description: data.long_description,
          price_type: data.price_type || 'free',
          price: data.price || 0,
          currency: data.currency || 'USD',
          icon_url: data.icon_url,
          screenshots: JSON.stringify(data.screenshots || []),
          demo_url: data.demo_url,
          version: data.version || '1.0.0',
          min_platform_version: data.min_platform_version,
          categories: JSON.stringify(data.categories || []),
          tags: JSON.stringify(data.tags || []),
          status: 'draft'
        })
        .returning('*');

      return item;
    } catch (error) {
      logger.error('Error creating item:', error);
      throw error;
    }
  }

  /**
   * Update an item
   */
  async updateItem(sellerId, itemId, data) {
    try {
      const item = await db('marketplace_items')
        .where('id', itemId)
        .where('seller_id', sellerId)
        .first();

      if (!item) {
        throw new Error('Item not found or unauthorized');
      }

      const updateData = {};
      const allowedFields = [
        'name', 'description', 'long_description', 'price_type', 'price',
        'currency', 'icon_url', 'screenshots', 'demo_url', 'version',
        'min_platform_version', 'categories', 'tags'
      ];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          if (['screenshots', 'categories', 'tags'].includes(field)) {
            updateData[field] = JSON.stringify(data[field]);
          } else {
            updateData[field] = data[field];
          }
        }
      }

      // If item was published and now being modified, set to pending
      if (item.status === 'published' && Object.keys(updateData).length > 0) {
        updateData.status = 'pending';
      }

      updateData.updated_at = new Date();

      const [updated] = await db('marketplace_items')
        .where('id', itemId)
        .update(updateData)
        .returning('*');

      return updated;
    } catch (error) {
      logger.error('Error updating item:', error);
      throw error;
    }
  }

  /**
   * Submit item for review
   */
  async submitForReview(sellerId, itemId) {
    try {
      const [item] = await db('marketplace_items')
        .where('id', itemId)
        .where('seller_id', sellerId)
        .where('status', 'draft')
        .update({ status: 'pending', updated_at: new Date() })
        .returning('*');

      if (!item) {
        throw new Error('Item not found or cannot be submitted');
      }

      return item;
    } catch (error) {
      logger.error('Error submitting item for review:', error);
      throw error;
    }
  }

  /**
   * Calculate seller earnings
   */
  async calculateEarnings(sellerId) {
    try {
      const summary = await db('seller_earnings')
        .select(
          db.raw('SUM(gross_amount) as total_gross'),
          db.raw('SUM(platform_fee) as total_fees'),
          db.raw('SUM(net_amount) as total_net'),
          db.raw("SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END) as pending"),
          db.raw("SUM(CASE WHEN status = 'available' THEN net_amount ELSE 0 END) as available"),
          db.raw("SUM(CASE WHEN status = 'paid' THEN net_amount ELSE 0 END) as paid")
        )
        .where('seller_id', sellerId)
        .first();

      const recentEarnings = await db('seller_earnings')
        .select(
          'seller_earnings.*',
          'marketplace_items.name as item_name'
        )
        .leftJoin('marketplace_items', 'seller_earnings.item_id', 'marketplace_items.id')
        .where('seller_earnings.seller_id', sellerId)
        .orderBy('seller_earnings.created_at', 'desc')
        .limit(20);

      const monthlyEarnings = await db('seller_earnings')
        .select(
          db.raw("DATE_TRUNC('month', created_at) as month"),
          db.raw('SUM(net_amount) as amount')
        )
        .where('seller_id', sellerId)
        .groupByRaw("DATE_TRUNC('month', created_at)")
        .orderBy('month', 'desc')
        .limit(12);

      return {
        summary: {
          total_gross: parseFloat(summary?.total_gross || 0),
          total_fees: parseFloat(summary?.total_fees || 0),
          total_net: parseFloat(summary?.total_net || 0),
          pending: parseFloat(summary?.pending || 0),
          available: parseFloat(summary?.available || 0),
          paid: parseFloat(summary?.paid || 0)
        },
        recentEarnings,
        monthlyEarnings
      };
    } catch (error) {
      logger.error('Error calculating earnings:', error);
      throw error;
    }
  }

  /**
   * Request a payout
   */
  async requestPayout(sellerId, amount) {
    const trx = await db.transaction();

    try {
      // Get available balance
      const available = await trx('seller_earnings')
        .where('seller_id', sellerId)
        .where('status', 'available')
        .sum('net_amount as total')
        .first();

      const availableAmount = parseFloat(available?.total || 0);

      if (amount > availableAmount) {
        throw new Error('Insufficient available balance');
      }

      // Get payout info
      const payoutInfo = await trx('seller_payout_info')
        .where('seller_id', sellerId)
        .first();

      if (!payoutInfo || !payoutInfo.is_verified) {
        throw new Error('Payout information not set up or verified');
      }

      // Create payout request
      const [payout] = await trx('seller_payouts')
        .insert({
          seller_id: sellerId,
          amount,
          payout_method: payoutInfo.payout_method,
          payout_details: JSON.stringify({
            paypal_email: payoutInfo.paypal_email,
            bank_name: payoutInfo.bank_name,
            bank_account_last4: payoutInfo.bank_account_last4
          }),
          status: 'pending'
        })
        .returning('*');

      // Mark earnings as paid (up to payout amount)
      let remaining = amount;
      const earningsToMark = await trx('seller_earnings')
        .where('seller_id', sellerId)
        .where('status', 'available')
        .orderBy('created_at', 'asc');

      for (const earning of earningsToMark) {
        if (remaining <= 0) break;
        if (earning.net_amount <= remaining) {
          await trx('seller_earnings')
            .where('id', earning.id)
            .update({ status: 'paid', payout_id: payout.id, paid_at: new Date() });
          remaining -= earning.net_amount;
        }
      }

      await trx.commit();

      return payout;
    } catch (error) {
      await trx.rollback();
      logger.error('Error requesting payout:', error);
      throw error;
    }
  }

  /**
   * Process seller payouts (admin/cron job)
   */
  async processSellerPayouts() {
    try {
      const pendingPayouts = await db('seller_payouts')
        .where('status', 'pending')
        .limit(100);

      const results = [];

      for (const payout of pendingPayouts) {
        try {
          // Here you would integrate with actual payment provider (Stripe, PayPal, etc.)
          // For now, we just mark as completed

          await db('seller_payouts')
            .where('id', payout.id)
            .update({
              status: 'completed',
              processed_at: new Date(),
              payout_reference: `PAYOUT-${Date.now()}-${payout.id}`
            });

          results.push({ id: payout.id, status: 'completed' });
        } catch (error) {
          await db('seller_payouts')
            .where('id', payout.id)
            .update({ status: 'failed' });

          results.push({ id: payout.id, status: 'failed', error: error.message });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error processing payouts:', error);
      throw error;
    }
  }

  /**
   * Get seller's payout history
   */
  async getSellerPayouts(sellerId) {
    try {
      const payouts = await db('seller_payouts')
        .where('seller_id', sellerId)
        .orderBy('created_at', 'desc');

      return payouts;
    } catch (error) {
      logger.error('Error getting seller payouts:', error);
      throw error;
    }
  }

  /**
   * Update seller payout info
   */
  async updatePayoutInfo(sellerId, data) {
    try {
      const [info] = await db('seller_payout_info')
        .insert({
          seller_id: sellerId,
          payout_method: data.payout_method,
          paypal_email: data.paypal_email,
          bank_name: data.bank_name,
          bank_account_last4: data.bank_account_last4,
          bank_routing: data.bank_routing,
          stripe_connect_id: data.stripe_connect_id,
          is_verified: false
        })
        .onConflict('seller_id')
        .merge({
          payout_method: data.payout_method,
          paypal_email: data.paypal_email,
          bank_name: data.bank_name,
          bank_account_last4: data.bank_account_last4,
          bank_routing: data.bank_routing,
          stripe_connect_id: data.stripe_connect_id,
          updated_at: new Date()
        })
        .returning('*');

      return info;
    } catch (error) {
      logger.error('Error updating payout info:', error);
      throw error;
    }
  }

  /**
   * Generate URL-friendly slug
   */
  generateSlug(name) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${base}-${Date.now().toString(36)}`;
  }
}

module.exports = new MarketplaceService();
