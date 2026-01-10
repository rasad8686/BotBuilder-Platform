/**
 * @fileoverview Email Marketing Service
 * @description Handles all email marketing operations including contacts, lists,
 * templates, campaigns, automations, and analytics.
 * @module services/email-marketing.service
 */

const db = require('../config/db');
const log = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class EmailMarketingService {
  // ==================== CONTACTS ====================

  /**
   * Get contacts with filtering and pagination
   */
  async getContacts(workspaceId, options = {}) {
    const {
      status,
      tags,
      search,
      source,
      page = 1,
      limit = 50,
      sortBy: rawSortBy = 'created_at',
      sortOrder = 'desc'
    } = options;

    // Map frontend column names to database column names
    const sortByMap = {
      'last_activity': 'last_activity_at',
      'lastActivity': 'last_activity_at',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'subscribedAt': 'subscribed_at'
    };
    const sortBy = sortByMap[rawSortBy] || rawSortBy;

    let query = db('email_contacts')
      .where('workspace_id', workspaceId);

    if (status) {
      query = query.where('status', status);
    }

    if (tags && tags.length > 0) {
      query = query.whereRaw('tags && ?', [tags]);
    }

    if (source) {
      query = query.where('source', source);
    }

    if (search) {
      query = query.where(function() {
        this.where('email', 'ilike', `%${search}%`)
          .orWhere('first_name', 'ilike', `%${search}%`)
          .orWhere('last_name', 'ilike', `%${search}%`)
          .orWhere('company', 'ilike', `%${search}%`);
      });
    }

    const countQuery = query.clone().count('* as total').first();
    const total = (await countQuery).total;

    const contacts = await query
      .orderBy(sortBy, sortOrder)
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total: parseInt(total),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get contact by ID
   */
  async getContactById(id, workspaceId) {
    return db('email_contacts')
      .where({ id, workspace_id: workspaceId })
      .first();
  }

  /**
   * Get contact by email
   */
  async getContactByEmail(email, workspaceId) {
    return db('email_contacts')
      .where({ email: email.toLowerCase(), workspace_id: workspaceId })
      .first();
  }

  /**
   * Create a new contact
   */
  async createContact(workspaceId, data) {
    const contact = {
      id: uuidv4(),
      workspace_id: workspaceId,
      email: data.email.toLowerCase(),
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      company: data.company,
      job_title: data.job_title,
      status: data.status || 'subscribed',
      source: data.source || 'manual',
      tags: data.tags || [],
      custom_fields: data.custom_fields || {},
      subscribed_at: data.status === 'subscribed' ? new Date() : null
    };

    const [created] = await db('email_contacts')
      .insert(contact)
      .returning('*');

    log.info('Contact created', { contactId: created.id, workspaceId });
    return created;
  }

  /**
   * Update a contact
   */
  async updateContact(id, workspaceId, data) {
    const updateData = { ...data, updated_at: new Date() };

    // Track unsubscribe timestamp
    if (data.status === 'unsubscribed') {
      updateData.unsubscribed_at = new Date();
    }

    const [updated] = await db('email_contacts')
      .where({ id, workspace_id: workspaceId })
      .update(updateData)
      .returning('*');

    return updated;
  }

  /**
   * Delete a contact
   */
  async deleteContact(id, workspaceId) {
    const deleted = await db('email_contacts')
      .where({ id, workspace_id: workspaceId })
      .del();

    return deleted > 0;
  }

  /**
   * Bulk create contacts (import)
   */
  async bulkCreateContacts(workspaceId, contacts) {
    const results = { created: 0, updated: 0, errors: [] };

    for (const contactData of contacts) {
      try {
        const existing = await this.getContactByEmail(contactData.email, workspaceId);

        if (existing) {
          await this.updateContact(existing.id, workspaceId, contactData);
          results.updated++;
        } else {
          await this.createContact(workspaceId, contactData);
          results.created++;
        }
      } catch (error) {
        results.errors.push({ email: contactData.email, error: error.message });
      }
    }

    return results;
  }

  /**
   * Bulk delete contacts
   */
  async bulkDeleteContacts(workspaceId, contactIds) {
    const deleted = await db('email_contacts')
      .where('workspace_id', workspaceId)
      .whereIn('id', contactIds)
      .del();

    return { deleted };
  }

  /**
   * Bulk update contacts
   */
  async bulkUpdateContacts(workspaceId, contactIds, data) {
    const updated = await db('email_contacts')
      .where('workspace_id', workspaceId)
      .whereIn('id', contactIds)
      .update({ ...data, updated_at: new Date() });

    return { updated };
  }

  /**
   * Add tags to contacts
   */
  async addTagsToContacts(workspaceId, contactIds, tags) {
    const updated = await db('email_contacts')
      .where('workspace_id', workspaceId)
      .whereIn('id', contactIds)
      .update({
        tags: db.raw('array_cat(tags, ?)', [tags]),
        updated_at: new Date()
      });

    return { updated };
  }

  /**
   * Remove tags from contacts
   */
  async removeTagsFromContacts(workspaceId, contactIds, tags) {
    const updated = await db('email_contacts')
      .where('workspace_id', workspaceId)
      .whereIn('id', contactIds)
      .update({
        tags: db.raw('array_remove(tags, ?)', [tags[0]]), // Remove one at a time
        updated_at: new Date()
      });

    return { updated };
  }

  // ==================== LISTS ====================

  /**
   * Get all lists for a workspace
   */
  async getLists(workspaceId) {
    return db('email_lists')
      .where({ workspace_id: workspaceId, is_active: true })
      .orderBy('created_at', 'desc');
  }

  /**
   * Get list by ID
   */
  async getListById(id, workspaceId) {
    return db('email_lists')
      .where({ id, workspace_id: workspaceId })
      .first();
  }

  /**
   * Create a new list
   */
  async createList(workspaceId, data) {
    const list = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: data.name,
      description: data.description,
      type: data.type || 'static',
      dynamic_rules: data.dynamic_rules || [],
      is_active: true
    };

    const [created] = await db('email_lists')
      .insert(list)
      .returning('*');

    return created;
  }

  /**
   * Update a list
   */
  async updateList(id, workspaceId, data) {
    const [updated] = await db('email_lists')
      .where({ id, workspace_id: workspaceId })
      .update({ ...data, updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Delete a list
   */
  async deleteList(id, workspaceId) {
    const deleted = await db('email_lists')
      .where({ id, workspace_id: workspaceId })
      .del();

    return deleted > 0;
  }

  /**
   * Add contacts to a list
   */
  async addContactsToList(listId, contactIds) {
    const entries = contactIds.map(contactId => ({
      id: uuidv4(),
      list_id: listId,
      contact_id: contactId
    }));

    await db('email_list_contacts')
      .insert(entries)
      .onConflict(['list_id', 'contact_id'])
      .ignore();

    // Update contact count
    await this.updateListContactCount(listId);

    return { added: entries.length };
  }

  /**
   * Remove contacts from a list
   */
  async removeContactsFromList(listId, contactIds) {
    const deleted = await db('email_list_contacts')
      .where('list_id', listId)
      .whereIn('contact_id', contactIds)
      .del();

    // Update contact count
    await this.updateListContactCount(listId);

    return { removed: deleted };
  }

  /**
   * Get contacts in a list
   */
  async getListContacts(listId, options = {}) {
    const { page = 1, limit = 50 } = options;

    const query = db('email_contacts')
      .join('email_list_contacts', 'email_contacts.id', 'email_list_contacts.contact_id')
      .where('email_list_contacts.list_id', listId)
      .select('email_contacts.*');

    const total = await query.clone().count('* as count').first();

    const contacts = await query
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      contacts,
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        totalPages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Update list contact count
   */
  async updateListContactCount(listId) {
    const count = await db('email_list_contacts')
      .where('list_id', listId)
      .count('* as count')
      .first();

    await db('email_lists')
      .where('id', listId)
      .update({ contact_count: count.count });
  }

  /**
   * Refresh dynamic list contacts
   */
  async refreshDynamicList(listId) {
    const list = await db('email_lists').where('id', listId).first();

    if (!list || list.type !== 'dynamic') {
      throw new Error('List is not a dynamic list');
    }

    // Build query based on dynamic rules
    let query = db('email_contacts').where('workspace_id', list.workspace_id);

    for (const rule of list.dynamic_rules) {
      switch (rule.operator) {
        case 'equals':
          query = query.where(rule.field, rule.value);
          break;
        case 'not_equals':
          query = query.whereNot(rule.field, rule.value);
          break;
        case 'contains':
          query = query.where(rule.field, 'ilike', `%${rule.value}%`);
          break;
        case 'starts_with':
          query = query.where(rule.field, 'ilike', `${rule.value}%`);
          break;
        case 'in':
          query = query.whereIn(rule.field, rule.value);
          break;
        case 'has_tag':
          query = query.whereRaw('? = ANY(tags)', [rule.value]);
          break;
      }
    }

    const contacts = await query.select('id');

    // Clear existing entries
    await db('email_list_contacts').where('list_id', listId).del();

    // Add new entries
    if (contacts.length > 0) {
      const entries = contacts.map(c => ({
        id: uuidv4(),
        list_id: listId,
        contact_id: c.id
      }));
      await db('email_list_contacts').insert(entries);
    }

    // Update count
    await db('email_lists')
      .where('id', listId)
      .update({ contact_count: contacts.length });

    return { refreshed: contacts.length };
  }

  // ==================== TEMPLATES ====================

  /**
   * Get templates
   */
  async getTemplates(workspaceId, category = null) {
    let query = db('email_templates')
      .where({ workspace_id: workspaceId, is_active: true });

    if (category) {
      query = query.where('category', category);
    }

    return query.orderBy('created_at', 'desc');
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id, workspaceId) {
    return db('email_templates')
      .where({ id, workspace_id: workspaceId })
      .first();
  }

  /**
   * Create a template
   */
  async createTemplate(workspaceId, data, userId) {
    const template = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: data.name,
      description: data.description,
      subject: data.subject,
      preview_text: data.preview_text,
      content_html: data.content_html,
      content_json: data.content_json || {},
      thumbnail_url: data.thumbnail_url,
      category: data.category || 'marketing',
      created_by: userId
    };

    const [created] = await db('email_templates')
      .insert(template)
      .returning('*');

    return created;
  }

  /**
   * Update a template
   */
  async updateTemplate(id, workspaceId, data) {
    const [updated] = await db('email_templates')
      .where({ id, workspace_id: workspaceId })
      .update({ ...data, updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id, workspaceId) {
    const deleted = await db('email_templates')
      .where({ id, workspace_id: workspaceId })
      .update({ is_active: false });

    return deleted > 0;
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(id, workspaceId) {
    const original = await this.getTemplateById(id, workspaceId);

    if (!original) {
      throw new Error('Template not found');
    }

    const duplicate = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: `${original.name} (Copy)`,
      description: original.description,
      subject: original.subject,
      preview_text: original.preview_text,
      content_html: original.content_html,
      content_json: original.content_json,
      thumbnail_url: original.thumbnail_url,
      category: original.category,
      created_by: original.created_by
    };

    const [created] = await db('email_templates')
      .insert(duplicate)
      .returning('*');

    return created;
  }

  /**
   * Get system templates (pre-built)
   */
  getSystemTemplates() {
    // Try to load block-based templates from data files
    try {
      const { systemTemplates } = require('../data/email-templates');
      if (systemTemplates && systemTemplates.length > 0) {
        return systemTemplates;
      }
    } catch (e) {
      // Fall back to HTML templates if data files not available
    }

    return [
      {
        id: 'system-welcome',
        name: 'Welcome Email',
        category: 'welcome',
        subject: 'Welcome to {{company_name}}!',
        preview_text: 'We\'re excited to have you on board',
        content_html: this.getWelcomeTemplateHtml()
      },
      {
        id: 'system-newsletter',
        name: 'Newsletter',
        category: 'newsletter',
        subject: '{{newsletter_title}}',
        preview_text: 'Your weekly update',
        content_html: this.getNewsletterTemplateHtml()
      },
      {
        id: 'system-promotional',
        name: 'Promotional',
        category: 'promotional',
        subject: '{{promo_title}} - Limited Time Offer!',
        preview_text: 'Don\'t miss out on this special deal',
        content_html: this.getPromotionalTemplateHtml()
      }
    ];
  }

  /**
   * Get a specific system template by ID
   */
  getSystemTemplateById(id) {
    const templates = this.getSystemTemplates();
    return templates.find(t => t.id === id) || null;
  }

  getWelcomeTemplateHtml() {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Welcome, {{first_name}}!</h1>
        <p>We're thrilled to have you join us.</p>
        <p>Here's what you can do next:</p>
        <ul>
          <li>Explore our features</li>
          <li>Set up your profile</li>
          <li>Connect with our community</li>
        </ul>
        <a href="{{cta_link}}" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Get Started</a>
        <p style="margin-top: 30px; color: #666;">Best regards,<br>The Team</p>
        <hr>
        <p style="font-size: 12px; color: #999;">
          <a href="{{unsubscribe_link}}">Unsubscribe</a>
        </p>
      </body>
      </html>
    `;
  }

  getNewsletterTemplateHtml() {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>{{newsletter_title}}</h1>
        <p>Hi {{first_name}},</p>
        <p>{{intro_text}}</p>
        <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
          <h2>Featured Article</h2>
          <p>{{featured_content}}</p>
          <a href="{{article_link}}">Read More</a>
        </div>
        <p style="margin-top: 30px; color: #666;">Until next time!</p>
        <hr>
        <p style="font-size: 12px; color: #999;">
          <a href="{{unsubscribe_link}}">Unsubscribe</a>
        </p>
      </body>
      </html>
    `;
  }

  getPromotionalTemplateHtml() {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; text-align: center;">
        <h1 style="color: #8b5cf6;">{{promo_title}}</h1>
        <p style="font-size: 18px;">{{promo_description}}</p>
        <div style="margin: 30px 0; padding: 30px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border-radius: 12px;">
          <p style="font-size: 48px; margin: 0; font-weight: bold;">{{discount_amount}}</p>
          <p style="margin: 10px 0;">Use code: <strong>{{promo_code}}</strong></p>
        </div>
        <a href="{{cta_link}}" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-size: 18px;">Shop Now</a>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">Offer expires: {{expiry_date}}</p>
        <hr>
        <p style="font-size: 12px; color: #999;">
          <a href="{{unsubscribe_link}}">Unsubscribe</a>
        </p>
      </body>
      </html>
    `;
  }

  // ==================== CAMPAIGNS ====================

  /**
   * Get campaigns with filtering
   */
  async getCampaigns(workspaceId, options = {}) {
    const { status, type, page = 1, limit = 20 } = options;

    let query = db('email_campaigns')
      .where('workspace_id', workspaceId);

    if (status) {
      query = query.where('status', status);
    }

    if (type) {
      query = query.where('type', type);
    }

    const total = await query.clone().count('* as count').first();

    const campaigns = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total: parseInt(total.count),
        totalPages: Math.ceil(total.count / limit)
      }
    };
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id, workspaceId) {
    return db('email_campaigns')
      .where({ id, workspace_id: workspaceId })
      .first();
  }

  /**
   * Create a campaign
   */
  async createCampaign(workspaceId, data, userId) {
    const campaign = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: data.name,
      description: data.description,
      type: data.type || 'broadcast',
      status: 'draft',
      template_id: data.template_id,
      list_ids: data.list_ids || [],
      segment_rules: data.segment_rules || [],
      subject: data.subject,
      preview_text: data.preview_text,
      from_name: data.from_name,
      from_email: data.from_email,
      reply_to: data.reply_to,
      content_html: data.content_html,
      content_json: data.content_json || {},
      settings: data.settings || { trackOpens: true, trackClicks: true, unsubscribeLink: true },
      created_by: userId
    };

    const [created] = await db('email_campaigns')
      .insert(campaign)
      .returning('*');

    return created;
  }

  /**
   * Update a campaign
   */
  async updateCampaign(id, workspaceId, data) {
    const campaign = await this.getCampaignById(id, workspaceId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('Cannot update a campaign that has been sent');
    }

    const [updated] = await db('email_campaigns')
      .where({ id, workspace_id: workspaceId })
      .update({ ...data, updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(id, workspaceId) {
    const campaign = await this.getCampaignById(id, workspaceId);

    if (campaign && campaign.status !== 'draft') {
      throw new Error('Cannot delete a campaign that is not in draft status');
    }

    const deleted = await db('email_campaigns')
      .where({ id, workspace_id: workspaceId })
      .del();

    return deleted > 0;
  }

  /**
   * Duplicate a campaign
   */
  async duplicateCampaign(id, workspaceId) {
    const original = await this.getCampaignById(id, workspaceId);

    if (!original) {
      throw new Error('Campaign not found');
    }

    const duplicate = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: `${original.name} (Copy)`,
      description: original.description,
      type: original.type,
      status: 'draft',
      template_id: original.template_id,
      list_ids: original.list_ids,
      segment_rules: original.segment_rules,
      subject: original.subject,
      preview_text: original.preview_text,
      from_name: original.from_name,
      from_email: original.from_email,
      reply_to: original.reply_to,
      content_html: original.content_html,
      content_json: original.content_json,
      settings: original.settings,
      created_by: original.created_by
    };

    const [created] = await db('email_campaigns')
      .insert(duplicate)
      .returning('*');

    return created;
  }

  /**
   * Schedule a campaign
   */
  async scheduleCampaign(id, workspaceId, scheduledAt) {
    const campaign = await this.getCampaignById(id, workspaceId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'draft') {
      throw new Error('Campaign must be in draft status to schedule');
    }

    const [updated] = await db('email_campaigns')
      .where({ id, workspace_id: workspaceId })
      .update({
        status: 'scheduled',
        scheduled_at: new Date(scheduledAt),
        updated_at: new Date()
      })
      .returning('*');

    return updated;
  }

  /**
   * Send a campaign immediately
   */
  async sendCampaign(id, workspaceId) {
    const campaign = await this.getCampaignById(id, workspaceId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error('Campaign cannot be sent');
    }

    // Update status to sending
    await db('email_campaigns')
      .where({ id, workspace_id: workspaceId })
      .update({
        status: 'sending',
        started_at: new Date(),
        updated_at: new Date()
      });

    // Queue emails
    await this.queueCampaignEmails(id);

    return { success: true, campaignId: id };
  }

  /**
   * Pause a campaign
   */
  async pauseCampaign(id, workspaceId) {
    const [updated] = await db('email_campaigns')
      .where({ id, workspace_id: workspaceId, status: 'sending' })
      .update({ status: 'paused', updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(id, workspaceId) {
    const [updated] = await db('email_campaigns')
      .where({ id, workspace_id: workspaceId })
      .whereIn('status', ['scheduled', 'sending', 'paused'])
      .update({ status: 'cancelled', updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Get campaign recipients
   */
  async getCampaignRecipients(id, workspaceId) {
    const campaign = await this.getCampaignById(id, workspaceId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get contacts from all target lists
    let query = db('email_contacts')
      .where('workspace_id', workspaceId)
      .where('status', 'subscribed');

    if (campaign.list_ids && campaign.list_ids.length > 0) {
      query = query
        .join('email_list_contacts', 'email_contacts.id', 'email_list_contacts.contact_id')
        .whereIn('email_list_contacts.list_id', campaign.list_ids)
        .distinct('email_contacts.*');
    }

    return query;
  }

  /**
   * Preview campaign with contact data
   */
  async previewCampaign(id, workspaceId, contactId) {
    const campaign = await this.getCampaignById(id, workspaceId);
    const contact = contactId
      ? await this.getContactById(contactId, workspaceId)
      : { first_name: 'John', last_name: 'Doe', email: 'john@example.com', company: 'Example Inc' };

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const personalizedHtml = this.personalizeContent(campaign.content_html, contact);
    const personalizedSubject = this.personalizeContent(campaign.subject, contact);

    return {
      subject: personalizedSubject,
      html: personalizedHtml,
      contact
    };
  }

  // ==================== SENDING ====================

  /**
   * Queue emails for a campaign
   */
  async queueCampaignEmails(campaignId) {
    const campaign = await db('email_campaigns').where('id', campaignId).first();
    const recipients = await this.getCampaignRecipients(campaignId, campaign.workspace_id);

    const sends = recipients.map(contact => ({
      id: uuidv4(),
      campaign_id: campaignId,
      contact_id: contact.id,
      email: contact.email,
      status: 'queued'
    }));

    if (sends.length > 0) {
      await db('email_sends').insert(sends);
    }

    // Update campaign total recipients
    await db('email_campaigns')
      .where('id', campaignId)
      .update({ total_recipients: sends.length });

    return { queued: sends.length };
  }

  /**
   * Process email queue (to be called by job scheduler)
   */
  async processEmailQueue(batchSize = 100) {
    const sends = await db('email_sends')
      .where('status', 'queued')
      .limit(batchSize);

    for (const send of sends) {
      try {
        await this.sendSingleEmail(send.id);
      } catch (error) {
        log.error('Failed to send email', { sendId: send.id, error: error.message });
      }
    }

    return { processed: sends.length };
  }

  /**
   * Send a single email
   */
  async sendSingleEmail(sendId) {
    const send = await db('email_sends')
      .where('id', sendId)
      .first();

    if (!send || send.status !== 'queued') {
      return;
    }

    const campaign = await db('email_campaigns').where('id', send.campaign_id).first();
    const contact = await db('email_contacts').where('id', send.contact_id).first();

    if (!campaign || !contact) {
      await db('email_sends')
        .where('id', sendId)
        .update({ status: 'failed' });
      return;
    }

    // Personalize content
    let html = this.personalizeContent(campaign.content_html, contact);
    const subject = this.personalizeContent(campaign.subject, contact);

    // Add tracking if enabled
    if (campaign.settings?.trackOpens || campaign.settings?.trackClicks) {
      html = this.addTracking(html, sendId, campaign.settings);
    }

    // Add unsubscribe link
    if (campaign.settings?.unsubscribeLink) {
      html = this.addUnsubscribeLink(html, contact.id, campaign.id);
    }

    // Send via email sender service
    const EmailSenderService = require('./email-sender.service');
    const result = await EmailSenderService.send({
      to: contact.email,
      from: `${campaign.from_name} <${campaign.from_email}>`,
      subject,
      html,
      replyTo: campaign.reply_to,
      headers: {
        'X-Campaign-ID': campaign.id,
        'X-Send-ID': sendId
      }
    });

    // Update send status
    await db('email_sends')
      .where('id', sendId)
      .update({
        status: 'sent',
        sent_at: new Date(),
        message_id: result.messageId
      });

    // Update campaign sent count
    await db('email_campaigns')
      .where('id', campaign.id)
      .increment('sent_count', 1);

    // Record event
    await this.recordEvent(campaign.id, contact.id, sendId, 'sent');

    return result;
  }

  /**
   * Handle ESP webhook events
   */
  async handleWebhook(event) {
    const { type, sendId, data } = event;

    const send = await db('email_sends').where('id', sendId).first();
    if (!send) return;

    switch (type) {
      case 'delivered':
        await db('email_sends')
          .where('id', sendId)
          .update({ status: 'delivered', delivered_at: new Date() });
        await this.recordEvent(send.campaign_id, send.contact_id, sendId, 'delivered');
        break;

      case 'bounced':
        await db('email_sends')
          .where('id', sendId)
          .update({
            status: 'bounced',
            bounce_type: data.bounceType,
            bounce_reason: data.reason
          });
        await this.recordEvent(send.campaign_id, send.contact_id, sendId, 'bounced', data);

        // Update contact status if hard bounce
        if (data.bounceType === 'hard') {
          await db('email_contacts')
            .where('id', send.contact_id)
            .update({ status: 'bounced' });
        }
        break;

      case 'complained':
        await this.recordEvent(send.campaign_id, send.contact_id, sendId, 'complained');
        await db('email_contacts')
          .where('id', send.contact_id)
          .update({ status: 'complained' });
        break;
    }
  }

  // ==================== AUTOMATIONS ====================

  /**
   * Get automations
   */
  async getAutomations(workspaceId) {
    return db('email_automations')
      .where('workspace_id', workspaceId)
      .orderBy('created_at', 'desc');
  }

  /**
   * Get automation by ID
   */
  async getAutomationById(id, workspaceId) {
    return db('email_automations')
      .where({ id, workspace_id: workspaceId })
      .first();
  }

  /**
   * Create an automation
   */
  async createAutomation(workspaceId, data, userId) {
    const automation = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: data.name,
      description: data.description,
      trigger_type: data.trigger_type || 'manual',
      trigger_config: JSON.stringify(data.trigger_config || {}),
      status: 'draft',
      steps: JSON.stringify(data.steps || []),
      created_by: userId
    };

    const [created] = await db('email_automations')
      .insert(automation)
      .returning('*');

    return created;
  }

  /**
   * Update an automation
   */
  async updateAutomation(id, workspaceId, data) {
    const updateData = { ...data, updated_at: new Date() };
    if (data.trigger_config && typeof data.trigger_config === 'object') {
      updateData.trigger_config = JSON.stringify(data.trigger_config);
    }
    if (data.steps && typeof data.steps === 'object') {
      updateData.steps = JSON.stringify(data.steps);
    }

    const [updated] = await db('email_automations')
      .where({ id, workspace_id: workspaceId })
      .update(updateData)
      .returning('*');

    return updated;
  }

  /**
   * Delete an automation
   */
  async deleteAutomation(id, workspaceId) {
    const deleted = await db('email_automations')
      .where({ id, workspace_id: workspaceId })
      .del();

    return deleted > 0;
  }

  /**
   * Activate an automation
   */
  async activateAutomation(id, workspaceId) {
    const [updated] = await db('email_automations')
      .where({ id, workspace_id: workspaceId })
      .update({ status: 'active', updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Pause an automation
   */
  async pauseAutomation(id, workspaceId) {
    const [updated] = await db('email_automations')
      .where({ id, workspace_id: workspaceId })
      .update({ status: 'paused', updated_at: new Date() })
      .returning('*');

    return updated;
  }

  /**
   * Enroll a contact in an automation
   */
  async enrollContact(automationId, contactId) {
    const enrollment = {
      id: uuidv4(),
      automation_id: automationId,
      contact_id: contactId,
      current_step: 0,
      status: 'active'
    };

    const [created] = await db('email_automation_enrollments')
      .insert(enrollment)
      .onConflict(['automation_id', 'contact_id'])
      .ignore()
      .returning('*');

    // Update entry count
    await db('email_automations')
      .where('id', automationId)
      .increment('entry_count', 1);

    return created;
  }

  /**
   * Process automation step
   */
  async processAutomationStep(enrollmentId) {
    const enrollment = await db('email_automation_enrollments')
      .where('id', enrollmentId)
      .first();

    if (!enrollment || enrollment.status !== 'active') {
      return;
    }

    const automation = await db('email_automations')
      .where('id', enrollment.automation_id)
      .first();

    if (!automation || automation.status !== 'active') {
      return;
    }

    const step = automation.steps[enrollment.current_step];
    if (!step) {
      // Automation completed
      await db('email_automation_enrollments')
        .where('id', enrollmentId)
        .update({
          status: 'completed',
          completed_at: new Date()
        });

      await db('email_automations')
        .where('id', automation.id)
        .increment('completed_count', 1);

      return;
    }

    // Process step based on type
    switch (step.type) {
      case 'send_email':
        // Create and send email
        // Implementation depends on step config
        break;

      case 'wait':
        // Calculate next step time
        const delay = step.delay || 86400000; // default 1 day
        await db('email_automation_enrollments')
          .where('id', enrollmentId)
          .update({
            next_step_at: new Date(Date.now() + delay)
          });
        return;

      case 'condition':
        // Check condition and branch
        break;

      case 'add_tag':
        await this.addTagsToContacts(
          automation.workspace_id,
          [enrollment.contact_id],
          [step.tag]
        );
        break;
    }

    // Move to next step
    await db('email_automation_enrollments')
      .where('id', enrollmentId)
      .update({
        current_step: enrollment.current_step + 1
      });
  }

  // ==================== UNSUBSCRIBE ====================

  /**
   * Unsubscribe a contact
   */
  async unsubscribeContact(contactId, campaignId = null, reason = null, feedback = null) {
    const contact = await db('email_contacts').where('id', contactId).first();

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Update contact status
    await db('email_contacts')
      .where('id', contactId)
      .update({
        status: 'unsubscribed',
        unsubscribed_at: new Date()
      });

    // Record unsubscribe
    await db('email_unsubscribes').insert({
      id: uuidv4(),
      workspace_id: contact.workspace_id,
      contact_id: contactId,
      campaign_id: campaignId,
      email: contact.email,
      reason,
      feedback
    });

    // Record event
    if (campaignId) {
      await this.recordEvent(campaignId, contactId, null, 'unsubscribed', { reason, feedback });
    }

    return { success: true };
  }

  /**
   * Get unsubscribes
   */
  async getUnsubscribes(workspaceId, dateRange = {}) {
    let query = db('email_unsubscribes')
      .where('workspace_id', workspaceId);

    if (dateRange.start) {
      query = query.where('unsubscribed_at', '>=', dateRange.start);
    }

    if (dateRange.end) {
      query = query.where('unsubscribed_at', '<=', dateRange.end);
    }

    return query.orderBy('unsubscribed_at', 'desc');
  }

  // ==================== ANALYTICS ====================

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId) {
    const campaign = await db('email_campaigns').where('id', campaignId).first();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const stats = await db('email_events')
      .where('campaign_id', campaignId)
      .select('event_type')
      .count('* as count')
      .groupBy('event_type');

    const statsMap = stats.reduce((acc, s) => {
      acc[s.event_type] = parseInt(s.count);
      return acc;
    }, {});

    const sent = campaign.sent_count || 0;
    const delivered = statsMap.delivered || 0;
    const opened = statsMap.opened || 0;
    const clicked = statsMap.clicked || 0;
    const bounced = statsMap.bounced || 0;
    const unsubscribed = statsMap.unsubscribed || 0;

    return {
      campaignId,
      status: campaign.status,
      totalRecipients: campaign.total_recipients,
      sent,
      delivered,
      opened,
      clicked,
      bounced,
      unsubscribed,
      rates: {
        deliveryRate: sent > 0 ? ((delivered / sent) * 100).toFixed(2) : 0,
        openRate: delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : 0,
        clickRate: opened > 0 ? ((clicked / opened) * 100).toFixed(2) : 0,
        bounceRate: sent > 0 ? ((bounced / sent) * 100).toFixed(2) : 0,
        unsubscribeRate: delivered > 0 ? ((unsubscribed / delivered) * 100).toFixed(2) : 0
      }
    };
  }

  /**
   * Get contact analytics
   */
  async getContactAnalytics(contactId) {
    const events = await db('email_events')
      .where('contact_id', contactId)
      .orderBy('created_at', 'desc')
      .limit(100);

    const stats = await db('email_events')
      .where('contact_id', contactId)
      .select('event_type')
      .count('* as count')
      .groupBy('event_type');

    return {
      contactId,
      events,
      stats: stats.reduce((acc, s) => {
        acc[s.event_type] = parseInt(s.count);
        return acc;
      }, {})
    };
  }

  /**
   * Get workspace analytics
   */
  async getWorkspaceAnalytics(workspaceId, dateRange = {}) {
    let query = db('email_events')
      .join('email_campaigns', 'email_events.campaign_id', 'email_campaigns.id')
      .where('email_campaigns.workspace_id', workspaceId);

    if (dateRange.start) {
      query = query.where('email_events.created_at', '>=', dateRange.start);
    }

    if (dateRange.end) {
      query = query.where('email_events.created_at', '<=', dateRange.end);
    }

    const stats = await query
      .select('email_events.event_type')
      .count('* as count')
      .groupBy('email_events.event_type');

    const contactStats = await db('email_contacts')
      .where('workspace_id', workspaceId)
      .select('status')
      .count('* as count')
      .groupBy('status');

    return {
      events: stats.reduce((acc, s) => {
        acc[s.event_type] = parseInt(s.count);
        return acc;
      }, {}),
      contacts: contactStats.reduce((acc, s) => {
        acc[s.status] = parseInt(s.count);
        return acc;
      }, {})
    };
  }

  /**
   * Get automation analytics
   */
  async getAutomationAnalytics(automationId) {
    const automation = await db('email_automations').where('id', automationId).first();

    if (!automation) {
      throw new Error('Automation not found');
    }

    const enrollmentStats = await db('email_automation_enrollments')
      .where('automation_id', automationId)
      .select('status')
      .count('* as count')
      .groupBy('status');

    return {
      automationId,
      entryCount: automation.entry_count,
      completedCount: automation.completed_count,
      enrollments: enrollmentStats.reduce((acc, s) => {
        acc[s.status] = parseInt(s.count);
        return acc;
      }, {})
    };
  }

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Personalize content with contact data
   */
  personalizeContent(content, contact) {
    if (!content) return '';

    let personalized = content;
    personalized = personalized.replace(/\{\{first_name\}\}/g, contact.first_name || '');
    personalized = personalized.replace(/\{\{last_name\}\}/g, contact.last_name || '');
    personalized = personalized.replace(/\{\{email\}\}/g, contact.email || '');
    personalized = personalized.replace(/\{\{company\}\}/g, contact.company || '');
    personalized = personalized.replace(/\{\{job_title\}\}/g, contact.job_title || '');
    personalized = personalized.replace(/\{\{phone\}\}/g, contact.phone || '');

    // Handle custom fields
    if (contact.custom_fields) {
      for (const [key, value] of Object.entries(contact.custom_fields)) {
        personalized = personalized.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
      }
    }

    return personalized;
  }

  /**
   * Add tracking to email content
   */
  addTracking(html, sendId, settings = {}) {
    const apiUrl = process.env.API_URL || 'http://localhost:5000';

    // Add open tracking pixel
    if (settings.trackOpens) {
      const pixel = `<img src="${apiUrl}/api/public/email/open/${sendId}" width="1" height="1" style="display:none;" />`;
      html = html.replace('</body>', `${pixel}</body>`);
    }

    // Wrap links for click tracking
    if (settings.trackClicks) {
      html = html.replace(/href="([^"]+)"/g, (match, url) => {
        // Don't track unsubscribe links
        if (url.includes('unsubscribe')) {
          return match;
        }
        const trackingUrl = `${apiUrl}/api/public/email/click/${sendId}?url=${encodeURIComponent(url)}`;
        return `href="${trackingUrl}"`;
      });
    }

    return html;
  }

  /**
   * Add unsubscribe link to email
   */
  addUnsubscribeLink(html, contactId, campaignId) {
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const token = this.generateUnsubscribeToken(contactId, campaignId);
    const unsubscribeUrl = `${appUrl}/unsubscribe/${token}`;

    html = html.replace(/\{\{unsubscribe_link\}\}/g, unsubscribeUrl);

    return html;
  }

  /**
   * Generate unsubscribe token
   */
  generateUnsubscribeToken(contactId, campaignId) {
    const payload = JSON.stringify({ contactId, campaignId, timestamp: Date.now() });
    const secret = process.env.JWT_SECRET || 'email-marketing-secret';
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${hash}`).toString('base64url');
  }

  /**
   * Verify and decode unsubscribe token
   */
  verifyUnsubscribeToken(token) {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [payload, hash] = decoded.split(':');

      const secret = process.env.JWT_SECRET || 'email-marketing-secret';
      const expectedHash = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      if (hash !== expectedHash) {
        throw new Error('Invalid token');
      }

      const data = JSON.parse(payload);

      // Check token expiry (30 days)
      if (Date.now() - data.timestamp > 30 * 24 * 60 * 60 * 1000) {
        throw new Error('Token expired');
      }

      return data;
    } catch (error) {
      throw new Error('Invalid unsubscribe token');
    }
  }

  /**
   * Record an email event
   */
  async recordEvent(campaignId, contactId, sendId, eventType, metadata = {}) {
    await db('email_events').insert({
      id: uuidv4(),
      campaign_id: campaignId,
      contact_id: contactId,
      send_id: sendId,
      event_type: eventType,
      metadata
    });

    // Update contact last activity
    if (contactId) {
      await db('email_contacts')
        .where('id', contactId)
        .update({ last_activity_at: new Date() });
    }
  }

  // ==================== SETTINGS ====================

  /**
   * Get email settings for workspace
   */
  async getSettings(workspaceId) {
    let settings = await db('email_settings')
      .where('workspace_id', workspaceId)
      .first();

    if (!settings) {
      // Create default settings
      [settings] = await db('email_settings')
        .insert({
          id: uuidv4(),
          workspace_id: workspaceId
        })
        .returning('*');
    }

    return settings;
  }

  /**
   * Update email settings
   */
  async updateSettings(workspaceId, data) {
    const existing = await this.getSettings(workspaceId);

    const [updated] = await db('email_settings')
      .where('id', existing.id)
      .update({ ...data, updated_at: new Date() })
      .returning('*');

    return updated;
  }
}

module.exports = new EmailMarketingService();
