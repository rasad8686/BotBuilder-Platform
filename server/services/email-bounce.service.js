/**
 * @fileoverview Email Bounce Service
 * @description Handles email bounce processing, blacklist management, and bounce analytics
 * @module services/email-bounce.service
 */

const db = require('../config/db');
const log = require('../utils/logger');

// Soft bounce threshold before blacklisting
const SOFT_BOUNCE_THRESHOLD = 3;
// Soft bounce cleanup period (days)
const SOFT_BOUNCE_CLEANUP_DAYS = 30;

class EmailBounceService {
  /**
   * Handle a bounce event
   * @param {Object} bounceData - Bounce event data
   * @param {string} bounceData.email - Email address that bounced
   * @param {string} bounceData.type - Bounce type (hard/soft)
   * @param {string} bounceData.reason - Bounce reason
   * @param {number} bounceData.workspaceId - Workspace ID
   * @param {string} [bounceData.contactId] - Contact ID
   * @param {string} [bounceData.campaignId] - Campaign ID
   * @param {string} [bounceData.sendId] - Send ID
   * @param {string} [bounceData.provider] - Email provider
   * @param {string} [bounceData.providerResponse] - Raw provider response
   * @param {string} [bounceData.diagnosticCode] - SMTP diagnostic code
   */
  async handleBounce(bounceData) {
    const {
      email,
      type,
      reason,
      workspaceId,
      contactId,
      campaignId,
      sendId,
      provider,
      providerResponse,
      diagnosticCode
    } = bounceData;

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Record the bounce event
      await db('email_bounces').insert({
        workspace_id: workspaceId,
        email: normalizedEmail,
        type,
        reason,
        provider_response: providerResponse,
        contact_id: contactId || null,
        campaign_id: campaignId || null,
        send_id: sendId || null,
        provider,
        diagnostic_code: diagnosticCode,
        bounced_at: new Date()
      });

      // Update email_sends status if sendId provided
      if (sendId) {
        await db('email_sends')
          .where('id', sendId)
          .update({
            status: 'bounced',
            bounce_type: type,
            bounce_reason: reason
          });
      }

      // Record email event
      if (campaignId) {
        await db('email_events').insert({
          campaign_id: campaignId,
          contact_id: contactId || null,
          send_id: sendId || null,
          event_type: 'bounced',
          metadata: JSON.stringify({ type, reason, provider })
        });
      }

      // Handle based on bounce type
      if (type === 'hard') {
        await this.handleHardBounce(normalizedEmail, workspaceId, reason);
      } else {
        await this.handleSoftBounce(normalizedEmail, workspaceId, reason);
      }

      // Update contact status
      if (contactId) {
        await this.updateContactStatus(contactId, workspaceId, type, reason);
      } else {
        // Try to find contact by email
        const contact = await db('email_contacts')
          .where({ email: normalizedEmail, workspace_id: workspaceId })
          .first();

        if (contact) {
          await this.updateContactStatus(contact.id, workspaceId, type, reason);
        }
      }

      log.info(`Bounce handled: ${type} bounce for ${normalizedEmail}`, {
        workspaceId,
        type,
        reason
      });

      return { success: true, type, email: normalizedEmail };
    } catch (error) {
      log.error('Error handling bounce:', error);
      throw error;
    }
  }

  /**
   * Handle hard bounce - immediately blacklist
   */
  async handleHardBounce(email, workspaceId, reason) {
    await this.addToBlacklist(email, workspaceId, 'hard_bounce', reason);
  }

  /**
   * Handle soft bounce - track and blacklist after threshold
   */
  async handleSoftBounce(email, workspaceId, reason) {
    const tracker = await db('email_soft_bounce_tracker')
      .where({ email, workspace_id: workspaceId })
      .first();

    if (tracker) {
      const newCount = tracker.bounce_count + 1;

      await db('email_soft_bounce_tracker')
        .where('id', tracker.id)
        .update({
          bounce_count: newCount,
          last_bounce_at: new Date()
        });

      // Check if threshold exceeded
      if (newCount >= SOFT_BOUNCE_THRESHOLD) {
        await this.addToBlacklist(
          email,
          workspaceId,
          'soft_bounce_limit',
          `${newCount} soft bounces: ${reason}`
        );
      }
    } else {
      // First soft bounce
      await db('email_soft_bounce_tracker').insert({
        workspace_id: workspaceId,
        email,
        bounce_count: 1,
        first_bounce_at: new Date(),
        last_bounce_at: new Date()
      });
    }
  }

  /**
   * Handle complaint (spam report)
   */
  async handleComplaint(complaintData) {
    const {
      email,
      workspaceId,
      contactId,
      campaignId,
      complaintType,
      feedback,
      provider
    } = complaintData;

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Record the complaint
      await db('email_complaints').insert({
        workspace_id: workspaceId,
        email: normalizedEmail,
        complaint_type: complaintType || 'abuse',
        feedback,
        contact_id: contactId || null,
        campaign_id: campaignId || null,
        provider,
        complained_at: new Date()
      });

      // Record email event
      if (campaignId) {
        await db('email_events').insert({
          campaign_id: campaignId,
          contact_id: contactId || null,
          event_type: 'complained',
          metadata: JSON.stringify({ complaintType, provider })
        });
      }

      // Blacklist the email
      await this.addToBlacklist(normalizedEmail, workspaceId, 'complaint', feedback || 'Spam complaint');

      // Update contact status
      const contact = contactId
        ? await db('email_contacts').where('id', contactId).first()
        : await db('email_contacts').where({ email: normalizedEmail, workspace_id: workspaceId }).first();

      if (contact) {
        await db('email_contacts')
          .where('id', contact.id)
          .update({
            status: 'complained',
            updated_at: new Date()
          });
      }

      log.info(`Complaint handled for ${normalizedEmail}`, { workspaceId, complaintType });

      return { success: true, email: normalizedEmail };
    } catch (error) {
      log.error('Error handling complaint:', error);
      throw error;
    }
  }

  /**
   * Add email to blacklist
   */
  async addToBlacklist(email, workspaceId, reason, details, addedBy = null) {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Check if already blacklisted
      const existing = await db('email_blacklist')
        .where({ email: normalizedEmail, workspace_id: workspaceId })
        .first();

      if (existing) {
        log.info(`Email ${normalizedEmail} already blacklisted`);
        return existing;
      }

      // Get soft bounce count if applicable
      const softBounceTracker = await db('email_soft_bounce_tracker')
        .where({ email: normalizedEmail, workspace_id: workspaceId })
        .first();

      const blacklistEntry = await db('email_blacklist')
        .insert({
          workspace_id: workspaceId,
          email: normalizedEmail,
          reason,
          details,
          soft_bounce_count: softBounceTracker?.bounce_count || 0,
          added_by: addedBy,
          is_global: false,
          blacklisted_at: new Date()
        })
        .returning('*');

      log.info(`Email blacklisted: ${normalizedEmail}`, { workspaceId, reason });

      return blacklistEntry[0];
    } catch (error) {
      log.error('Error adding to blacklist:', error);
      throw error;
    }
  }

  /**
   * Remove email from blacklist
   */
  async removeFromBlacklist(email, workspaceId) {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      const deleted = await db('email_blacklist')
        .where({ email: normalizedEmail, workspace_id: workspaceId })
        .del();

      if (deleted) {
        // Also clear soft bounce tracker
        await db('email_soft_bounce_tracker')
          .where({ email: normalizedEmail, workspace_id: workspaceId })
          .del();

        log.info(`Email removed from blacklist: ${normalizedEmail}`, { workspaceId });
      }

      return { success: true, removed: deleted > 0 };
    } catch (error) {
      log.error('Error removing from blacklist:', error);
      throw error;
    }
  }

  /**
   * Check if email is blacklisted
   */
  async isBlacklisted(email, workspaceId) {
    const normalizedEmail = email.toLowerCase().trim();

    const blacklisted = await db('email_blacklist')
      .where(function() {
        this.where({ email: normalizedEmail, workspace_id: workspaceId })
          .orWhere({ email: normalizedEmail, is_global: true });
      })
      .first();

    return !!blacklisted;
  }

  /**
   * Get blacklisted emails for a workspace
   */
  async getBlacklistedEmails(workspaceId, options = {}) {
    const {
      page = 1,
      limit = 50,
      reason,
      search,
      sortBy = 'blacklisted_at',
      sortOrder = 'desc'
    } = options;

    let query = db('email_blacklist')
      .where('workspace_id', workspaceId);

    if (reason) {
      query = query.where('reason', reason);
    }

    if (search) {
      query = query.where('email', 'ilike', `%${search}%`);
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const blacklist = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      blacklist,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get bounced emails for a workspace
   */
  async getBouncedEmails(workspaceId, options = {}) {
    const {
      page = 1,
      limit = 50,
      type,
      startDate,
      endDate,
      search,
      sortBy = 'bounced_at',
      sortOrder = 'desc'
    } = options;

    let query = db('email_bounces')
      .where('workspace_id', workspaceId);

    if (type) {
      query = query.where('type', type);
    }

    if (startDate) {
      query = query.where('bounced_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('bounced_at', '<=', endDate);
    }

    if (search) {
      query = query.where('email', 'ilike', `%${search}%`);
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const bounces = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      bounces,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get bounce statistics for a workspace
   */
  async getBounceStatistics(workspaceId, options = {}) {
    const { startDate, endDate } = options;

    let query = db('email_bounces')
      .where('workspace_id', workspaceId);

    if (startDate) {
      query = query.where('bounced_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('bounced_at', '<=', endDate);
    }

    // Total bounces by type
    const bouncesByType = await query.clone()
      .select('type')
      .count('* as count')
      .groupBy('type');

    // Total blacklisted
    const blacklistCount = await db('email_blacklist')
      .where('workspace_id', workspaceId)
      .count('* as count')
      .first();

    // Blacklist by reason
    const blacklistByReason = await db('email_blacklist')
      .where('workspace_id', workspaceId)
      .select('reason')
      .count('* as count')
      .groupBy('reason');

    // Complaints count
    const complaintsCount = await db('email_complaints')
      .where('workspace_id', workspaceId)
      .count('* as count')
      .first();

    // Recent bounces (last 7 days trend)
    const recentBounces = await db('email_bounces')
      .where('workspace_id', workspaceId)
      .where('bounced_at', '>=', db.raw("NOW() - INTERVAL '7 days'"))
      .select(db.raw("DATE(bounced_at) as date"))
      .count('* as count')
      .groupBy(db.raw('DATE(bounced_at)'))
      .orderBy('date', 'asc');

    return {
      totalBounces: bouncesByType.reduce((sum, b) => sum + parseInt(b.count), 0),
      hardBounces: bouncesByType.find(b => b.type === 'hard')?.count || 0,
      softBounces: bouncesByType.find(b => b.type === 'soft')?.count || 0,
      totalBlacklisted: parseInt(blacklistCount.count),
      blacklistByReason: blacklistByReason.reduce((acc, r) => {
        acc[r.reason] = parseInt(r.count);
        return acc;
      }, {}),
      totalComplaints: parseInt(complaintsCount.count),
      recentTrend: recentBounces.map(r => ({
        date: r.date,
        count: parseInt(r.count)
      }))
    };
  }

  /**
   * Update contact status based on bounce
   */
  async updateContactStatus(contactId, workspaceId, bounceType, reason) {
    try {
      const updateData = {
        status: 'bounced',
        updated_at: new Date()
      };

      // Store bounce reason in custom_fields
      const contact = await db('email_contacts')
        .where({ id: contactId, workspace_id: workspaceId })
        .first();

      if (contact) {
        const customFields = contact.custom_fields || {};
        customFields.bounce_type = bounceType;
        customFields.bounce_reason = reason;
        customFields.bounced_at = new Date().toISOString();
        updateData.custom_fields = JSON.stringify(customFields);
      }

      await db('email_contacts')
        .where({ id: contactId, workspace_id: workspaceId })
        .update(updateData);

      return { success: true };
    } catch (error) {
      log.error('Error updating contact status:', error);
      throw error;
    }
  }

  /**
   * Re-activate a contact (remove from blacklist and reset status)
   */
  async reactivateContact(contactId, workspaceId) {
    try {
      const contact = await db('email_contacts')
        .where({ id: contactId, workspace_id: workspaceId })
        .first();

      if (!contact) {
        throw new Error('Contact not found');
      }

      // Remove from blacklist
      await this.removeFromBlacklist(contact.email, workspaceId);

      // Update contact status
      const customFields = contact.custom_fields || {};
      delete customFields.bounce_type;
      delete customFields.bounce_reason;
      delete customFields.bounced_at;

      await db('email_contacts')
        .where('id', contactId)
        .update({
          status: 'subscribed',
          custom_fields: JSON.stringify(customFields),
          updated_at: new Date()
        });

      log.info(`Contact reactivated: ${contact.email}`, { workspaceId });

      return { success: true, email: contact.email };
    } catch (error) {
      log.error('Error reactivating contact:', error);
      throw error;
    }
  }

  /**
   * Cleanup old soft bounces (reset counter for emails that haven't bounced recently)
   */
  async cleanupSoftBounces() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - SOFT_BOUNCE_CLEANUP_DAYS);

      const deleted = await db('email_soft_bounce_tracker')
        .where('last_bounce_at', '<', cutoffDate)
        .del();

      log.info(`Cleaned up ${deleted} old soft bounce records`);

      return { success: true, cleaned: deleted };
    } catch (error) {
      log.error('Error cleaning up soft bounces:', error);
      throw error;
    }
  }

  /**
   * Filter out blacklisted emails from a list
   */
  async filterBlacklistedEmails(emails, workspaceId) {
    const normalizedEmails = emails.map(e => e.toLowerCase().trim());

    const blacklisted = await db('email_blacklist')
      .where(function() {
        this.whereIn('email', normalizedEmails)
          .andWhere(function() {
            this.where('workspace_id', workspaceId)
              .orWhere('is_global', true);
          });
      })
      .pluck('email');

    const blacklistedSet = new Set(blacklisted);

    return {
      valid: normalizedEmails.filter(e => !blacklistedSet.has(e)),
      blacklisted: normalizedEmails.filter(e => blacklistedSet.has(e))
    };
  }

  /**
   * Check multiple emails against blacklist
   */
  async checkBlacklist(emails, workspaceId) {
    const results = await this.filterBlacklistedEmails(emails, workspaceId);
    return results;
  }

  /**
   * Add multiple emails to blacklist
   */
  async bulkAddToBlacklist(emails, workspaceId, reason, addedBy = null) {
    const results = {
      added: [],
      skipped: []
    };

    for (const email of emails) {
      const normalizedEmail = email.toLowerCase().trim();
      try {
        const existing = await db('email_blacklist')
          .where({ email: normalizedEmail, workspace_id: workspaceId })
          .first();

        if (existing) {
          results.skipped.push(normalizedEmail);
        } else {
          await this.addToBlacklist(normalizedEmail, workspaceId, reason, 'Bulk import', addedBy);
          results.added.push(normalizedEmail);
        }
      } catch (error) {
        log.error(`Error adding ${normalizedEmail} to blacklist:`, error);
        results.skipped.push(normalizedEmail);
      }
    }

    return results;
  }

  /**
   * Get complaints for a workspace
   */
  async getComplaints(workspaceId, options = {}) {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      sortBy = 'complained_at',
      sortOrder = 'desc'
    } = options;

    let query = db('email_complaints')
      .where('workspace_id', workspaceId);

    if (startDate) {
      query = query.where('complained_at', '>=', startDate);
    }

    if (endDate) {
      query = query.where('complained_at', '<=', endDate);
    }

    const countResult = await query.clone().count('* as total').first();
    const total = parseInt(countResult.total);

    const complaints = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      complaints,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new EmailBounceService();
