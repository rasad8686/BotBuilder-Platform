/**
 * Email A/B Test Service
 * Handles A/B testing for email campaigns
 */

const db = require('../config/db');
const logger = require('../utils/logger');

class EmailABTestService {
  /**
   * Create a new A/B test for a campaign
   */
  async createTest(campaignId, organizationId, userId, testData) {
    const trx = await db.transaction();

    try {
      const { name, test_type, winner_criteria, sample_size_percent, auto_send_winner,
              test_duration_hours, minimum_sample_size, confidence_level, variants, settings } = testData;

      // Validate variants
      if (!variants || variants.length < 2) {
        throw new Error('A/B test requires at least 2 variants');
      }

      if (variants.length > 4) {
        throw new Error('Maximum 4 variants allowed');
      }

      // Validate weight distribution
      const totalWeight = variants.reduce((sum, v) => sum + (v.weight_percent || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        throw new Error('Variant weights must sum to 100%');
      }

      // Check if campaign exists
      const campaign = await trx('email_campaigns')
        .where({ id: campaignId, organization_id: organizationId })
        .first();

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check for existing active test
      const existingTest = await trx('email_ab_tests')
        .where({ campaign_id: campaignId })
        .whereIn('status', ['draft', 'running', 'paused'])
        .first();

      if (existingTest) {
        throw new Error('Campaign already has an active A/B test');
      }

      // Create the A/B test
      const [abTest] = await trx('email_ab_tests')
        .insert({
          campaign_id: campaignId,
          organization_id: organizationId,
          name,
          test_type,
          winner_criteria: winner_criteria || 'open_rate',
          sample_size_percent: sample_size_percent || 20,
          auto_send_winner: auto_send_winner !== false,
          test_duration_hours: test_duration_hours || 24,
          minimum_sample_size: minimum_sample_size || 100,
          confidence_level: confidence_level || 95,
          settings: JSON.stringify(settings || {}),
          created_by: userId
        })
        .returning('*');

      // Create variants
      const variantNames = ['A', 'B', 'C', 'D'];
      const createdVariants = [];

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i];
        const [createdVariant] = await trx('email_ab_variants')
          .insert({
            ab_test_id: abTest.id,
            name: variant.name || variantNames[i],
            label: variant.label || `Variant ${variantNames[i]}`,
            subject: variant.subject,
            content: variant.content,
            preview_text: variant.preview_text,
            sender_name: variant.sender_name,
            sender_email: variant.sender_email,
            reply_to: variant.reply_to,
            send_time: variant.send_time,
            send_timezone: variant.send_timezone,
            weight_percent: variant.weight_percent || (100 / variants.length),
            is_control: i === 0,
            metadata: JSON.stringify(variant.metadata || {})
          })
          .returning('*');

        createdVariants.push(createdVariant);
      }

      await trx.commit();

      logger.info(`A/B test created: ${abTest.id} for campaign ${campaignId}`);

      return {
        ...abTest,
        variants: createdVariants
      };
    } catch (error) {
      await trx.rollback();
      logger.error('Error creating A/B test:', error);
      throw error;
    }
  }

  /**
   * Get A/B test by ID
   */
  async getTest(testId, organizationId) {
    const test = await db('email_ab_tests')
      .where({ id: testId, organization_id: organizationId })
      .first();

    if (!test) {
      return null;
    }

    const variants = await db('email_ab_variants')
      .where({ ab_test_id: testId })
      .orderBy('name', 'asc');

    return {
      ...test,
      variants
    };
  }

  /**
   * Get A/B test by campaign ID
   */
  async getTestByCampaign(campaignId, organizationId) {
    const test = await db('email_ab_tests')
      .where({ campaign_id: campaignId, organization_id: organizationId })
      .orderBy('created_at', 'desc')
      .first();

    if (!test) {
      return null;
    }

    const variants = await db('email_ab_variants')
      .where({ ab_test_id: test.id })
      .orderBy('name', 'asc');

    return {
      ...test,
      variants
    };
  }

  /**
   * List A/B tests for organization
   */
  async listTests(organizationId, filters = {}) {
    const { status, page = 1, limit = 20 } = filters;

    let query = db('email_ab_tests')
      .where({ organization_id: organizationId })
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where({ status });
    }

    const offset = (page - 1) * limit;
    const tests = await query.limit(limit).offset(offset);

    const [{ count }] = await db('email_ab_tests')
      .where({ organization_id: organizationId })
      .count();

    // Get variants for each test
    const testsWithVariants = await Promise.all(
      tests.map(async (test) => {
        const variants = await db('email_ab_variants')
          .where({ ab_test_id: test.id })
          .orderBy('name', 'asc');
        return { ...test, variants };
      })
    );

    return {
      tests: testsWithVariants,
      pagination: {
        page,
        limit,
        total: parseInt(count),
        pages: Math.ceil(count / limit)
      }
    };
  }

  /**
   * Update A/B test
   */
  async updateTest(testId, organizationId, updateData) {
    const test = await db('email_ab_tests')
      .where({ id: testId, organization_id: organizationId })
      .first();

    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status !== 'draft') {
      throw new Error('Can only update tests in draft status');
    }

    const allowedFields = [
      'name', 'winner_criteria', 'sample_size_percent', 'auto_send_winner',
      'test_duration_hours', 'minimum_sample_size', 'confidence_level', 'settings', 'scheduled_at'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = field === 'settings' ? JSON.stringify(updateData[field]) : updateData[field];
      }
    }

    updates.updated_at = new Date();

    const [updatedTest] = await db('email_ab_tests')
      .where({ id: testId })
      .update(updates)
      .returning('*');

    return updatedTest;
  }

  /**
   * Update variant
   */
  async updateVariant(variantId, testId, organizationId, updateData) {
    const test = await db('email_ab_tests')
      .where({ id: testId, organization_id: organizationId })
      .first();

    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status !== 'draft') {
      throw new Error('Can only update variants in draft status');
    }

    const variant = await db('email_ab_variants')
      .where({ id: variantId, ab_test_id: testId })
      .first();

    if (!variant) {
      throw new Error('Variant not found');
    }

    const allowedFields = [
      'label', 'subject', 'content', 'preview_text', 'sender_name',
      'sender_email', 'reply_to', 'send_time', 'send_timezone', 'weight_percent', 'metadata'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updates[field] = field === 'metadata' ? JSON.stringify(updateData[field]) : updateData[field];
      }
    }

    updates.updated_at = new Date();

    const [updatedVariant] = await db('email_ab_variants')
      .where({ id: variantId })
      .update(updates)
      .returning('*');

    return updatedVariant;
  }

  /**
   * Start A/B test
   */
  async startTest(testId, organizationId) {
    const trx = await db.transaction();

    try {
      const test = await trx('email_ab_tests')
        .where({ id: testId, organization_id: organizationId })
        .first();

      if (!test) {
        throw new Error('A/B test not found');
      }

      if (test.status !== 'draft') {
        throw new Error('Can only start tests in draft status');
      }

      const variants = await trx('email_ab_variants')
        .where({ ab_test_id: testId });

      if (variants.length < 2) {
        throw new Error('A/B test requires at least 2 variants');
      }

      // Get campaign contacts
      const campaign = await trx('email_campaigns')
        .where({ id: test.campaign_id })
        .first();

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Update test status
      const [updatedTest] = await trx('email_ab_tests')
        .where({ id: testId })
        .update({
          status: 'running',
          started_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      await trx.commit();

      // Trigger test email sending asynchronously
      this.sendTestEmails(testId, organizationId).catch(err => {
        logger.error('Error sending test emails:', err);
      });

      logger.info(`A/B test started: ${testId}`);

      return {
        ...updatedTest,
        variants
      };
    } catch (error) {
      await trx.rollback();
      logger.error('Error starting A/B test:', error);
      throw error;
    }
  }

  /**
   * Split audience for A/B test
   */
  async splitAudience(contacts, variants) {
    const totalContacts = contacts.length;
    const assignments = [];

    // Create weighted buckets
    let currentIndex = 0;
    for (const variant of variants) {
      const count = Math.floor(totalContacts * (variant.weight_percent / 100));
      const variantContacts = contacts.slice(currentIndex, currentIndex + count);

      for (const contact of variantContacts) {
        assignments.push({
          contact_id: contact.id,
          variant_id: variant.id,
          email: contact.email
        });
      }

      currentIndex += count;
    }

    // Assign remaining contacts to first variant
    const remaining = contacts.slice(currentIndex);
    for (const contact of remaining) {
      assignments.push({
        contact_id: contact.id,
        variant_id: variants[0].id,
        email: contact.email
      });
    }

    return assignments;
  }

  /**
   * Send test emails
   */
  async sendTestEmails(testId, organizationId) {
    const test = await this.getTest(testId, organizationId);

    if (!test || test.status !== 'running') {
      return;
    }

    // Get campaign and contacts
    const campaign = await db('email_campaigns')
      .where({ id: test.campaign_id })
      .first();

    // Get sample contacts based on sample_size_percent
    const allContacts = await db('email_contacts')
      .where({ organization_id: organizationId, status: 'active' })
      .orderByRaw('RANDOM()')
      .limit(Math.ceil(1000 * (test.sample_size_percent / 100))); // Simplified for demo

    if (allContacts.length === 0) {
      logger.warn(`No contacts found for A/B test ${testId}`);
      return;
    }

    // Shuffle contacts
    const shuffledContacts = this.shuffleArray([...allContacts]);

    // Split audience
    const assignments = await this.splitAudience(shuffledContacts, test.variants);

    // Queue emails for each assignment
    for (const assignment of assignments) {
      const variant = test.variants.find(v => v.id === assignment.variant_id);

      // Queue email (using existing email queue service)
      await db('email_queue').insert({
        organization_id: organizationId,
        campaign_id: test.campaign_id,
        contact_id: assignment.contact_id,
        to_email: assignment.email,
        subject: variant.subject || campaign.subject,
        content: variant.content || campaign.content,
        sender_name: variant.sender_name || campaign.sender_name,
        sender_email: variant.sender_email || campaign.sender_email,
        status: 'pending',
        metadata: JSON.stringify({
          ab_test_id: testId,
          variant_id: variant.id,
          variant_name: variant.name
        })
      });

      // Update variant sent count
      await db('email_ab_variants')
        .where({ id: variant.id })
        .increment('sent_count', 1);
    }

    logger.info(`Queued ${assignments.length} emails for A/B test ${testId}`);
  }

  /**
   * Track email event for variant
   */
  async trackEvent(testId, variantId, eventType, data = {}) {
    const variant = await db('email_ab_variants')
      .where({ id: variantId, ab_test_id: testId })
      .first();

    if (!variant) {
      return;
    }

    const updates = {};

    switch (eventType) {
      case 'delivered':
        updates.delivered_count = variant.delivered_count + 1;
        break;
      case 'opened':
        updates.opened_count = variant.opened_count + 1;
        if (data.unique) {
          updates.unique_opens = variant.unique_opens + 1;
        }
        break;
      case 'clicked':
        updates.clicked_count = variant.clicked_count + 1;
        if (data.unique) {
          updates.unique_clicks = variant.unique_clicks + 1;
        }
        break;
      case 'converted':
        updates.converted_count = variant.converted_count + 1;
        if (data.revenue) {
          updates.revenue = parseFloat(variant.revenue) + parseFloat(data.revenue);
        }
        break;
      case 'unsubscribed':
        updates.unsubscribed_count = variant.unsubscribed_count + 1;
        break;
      case 'bounced':
        updates.bounced_count = variant.bounced_count + 1;
        break;
      case 'complained':
        updates.complained_count = variant.complained_count + 1;
        break;
    }

    // Update calculated rates
    const delivered = updates.delivered_count || variant.delivered_count;
    const opens = updates.unique_opens || variant.unique_opens;
    const clicks = updates.unique_clicks || variant.unique_clicks;
    const converted = updates.converted_count || variant.converted_count;

    if (delivered > 0) {
      updates.open_rate = (opens / delivered) * 100;
      updates.click_rate = (clicks / delivered) * 100;
      updates.conversion_rate = (converted / delivered) * 100;
    }

    if (opens > 0) {
      updates.ctr = (clicks / opens) * 100;
    }

    updates.updated_at = new Date();

    await db('email_ab_variants')
      .where({ id: variantId })
      .update(updates);

    // Check if we should determine winner
    await this.checkAndDetermineWinner(testId);
  }

  /**
   * Check if winner should be determined
   */
  async checkAndDetermineWinner(testId) {
    const test = await db('email_ab_tests')
      .where({ id: testId })
      .first();

    if (!test || test.status !== 'running' || test.winner_variant_id) {
      return;
    }

    const variants = await db('email_ab_variants')
      .where({ ab_test_id: testId });

    // Check minimum sample size
    const totalSent = variants.reduce((sum, v) => sum + v.sent_count, 0);
    if (totalSent < test.minimum_sample_size) {
      return;
    }

    // Check test duration
    const startedAt = new Date(test.started_at);
    const hoursElapsed = (Date.now() - startedAt.getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < test.test_duration_hours) {
      return;
    }

    // Determine winner if auto_send_winner is enabled
    if (test.auto_send_winner) {
      await this.determineWinner(testId, test.organization_id);
    }
  }

  /**
   * Determine the winning variant
   */
  async determineWinner(testId, organizationId) {
    const test = await this.getTest(testId, organizationId);

    if (!test) {
      throw new Error('A/B test not found');
    }

    const variants = test.variants;

    // Find control variant
    const control = variants.find(v => v.is_control);

    // Calculate statistical significance for each variant
    const variantsWithStats = variants.map(variant => {
      const stats = this.calculateStatistics(variant, control, test.winner_criteria);
      return { ...variant, ...stats };
    });

    // Sort by winner criteria
    let sortField;
    switch (test.winner_criteria) {
      case 'click_rate':
        sortField = 'click_rate';
        break;
      case 'conversion_rate':
        sortField = 'conversion_rate';
        break;
      case 'revenue':
        sortField = 'revenue';
        break;
      default:
        sortField = 'open_rate';
    }

    variantsWithStats.sort((a, b) => b[sortField] - a[sortField]);
    const winner = variantsWithStats[0];

    // Update winner
    await db('email_ab_variants')
      .where({ ab_test_id: testId })
      .update({ is_winner: false });

    await db('email_ab_variants')
      .where({ id: winner.id })
      .update({
        is_winner: true,
        statistically_significant: winner.statistically_significant,
        confidence_score: winner.confidence_score,
        uplift_percent: winner.uplift_percent
      });

    // Update test
    await db('email_ab_tests')
      .where({ id: testId })
      .update({
        status: 'completed',
        winner_variant_id: winner.id,
        completed_at: new Date(),
        updated_at: new Date()
      });

    // Update all variant stats
    for (const variant of variantsWithStats) {
      await db('email_ab_variants')
        .where({ id: variant.id })
        .update({
          confidence_score: variant.confidence_score,
          uplift_percent: variant.uplift_percent,
          statistically_significant: variant.statistically_significant
        });
    }

    logger.info(`A/B test ${testId} completed. Winner: ${winner.name} (${winner.id})`);

    return {
      winner,
      variants: variantsWithStats
    };
  }

  /**
   * Calculate statistical significance
   */
  calculateStatistics(variant, control, criteria) {
    const getRate = (v) => {
      switch (criteria) {
        case 'click_rate': return v.click_rate;
        case 'conversion_rate': return v.conversion_rate;
        case 'revenue': return parseFloat(v.revenue);
        default: return v.open_rate;
      }
    };

    const variantRate = getRate(variant);
    const controlRate = control ? getRate(control) : 0;

    // Calculate uplift
    const uplift = controlRate > 0
      ? ((variantRate - controlRate) / controlRate) * 100
      : 0;

    // Simplified statistical significance calculation
    // Using z-test approximation for proportions
    const variantN = variant.delivered_count || 1;
    const controlN = control?.delivered_count || 1;

    const pooledRate = (variantRate + controlRate) / 2;
    const standardError = Math.sqrt(
      pooledRate * (100 - pooledRate) * (1/variantN + 1/controlN)
    );

    const zScore = standardError > 0
      ? Math.abs(variantRate - controlRate) / standardError
      : 0;

    // Z-score to confidence (simplified)
    let confidence = 0;
    if (zScore >= 2.576) confidence = 99;
    else if (zScore >= 1.96) confidence = 95;
    else if (zScore >= 1.645) confidence = 90;
    else if (zScore >= 1.28) confidence = 80;
    else confidence = Math.min(zScore / 1.28 * 80, 80);

    return {
      confidence_score: confidence,
      uplift_percent: uplift,
      statistically_significant: confidence >= 95
    };
  }

  /**
   * Manually select winner
   */
  async selectWinner(testId, organizationId, variantId) {
    const test = await this.getTest(testId, organizationId);

    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status === 'completed' && test.winner_variant_id) {
      throw new Error('Test already has a winner');
    }

    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) {
      throw new Error('Variant not found');
    }

    // Update winner
    await db('email_ab_variants')
      .where({ ab_test_id: testId })
      .update({ is_winner: false });

    await db('email_ab_variants')
      .where({ id: variantId })
      .update({ is_winner: true });

    // Update test
    await db('email_ab_tests')
      .where({ id: testId })
      .update({
        status: 'completed',
        winner_variant_id: variantId,
        completed_at: new Date(),
        updated_at: new Date()
      });

    logger.info(`A/B test ${testId} winner manually selected: ${variant.name}`);

    return this.getTest(testId, organizationId);
  }

  /**
   * Send winning variant to remaining audience
   */
  async sendToRemainingAudience(testId, organizationId) {
    const test = await this.getTest(testId, organizationId);

    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status !== 'completed' || !test.winner_variant_id) {
      throw new Error('Test must be completed with a winner to send to remaining audience');
    }

    const winner = test.variants.find(v => v.id === test.winner_variant_id);
    if (!winner) {
      throw new Error('Winner variant not found');
    }

    // Get campaign
    const campaign = await db('email_campaigns')
      .where({ id: test.campaign_id })
      .first();

    // Get contacts that haven't received test emails
    const testRecipients = await db('email_queue')
      .where({ campaign_id: test.campaign_id })
      .whereRaw("metadata->>'ab_test_id' = ?", [testId])
      .select('contact_id');

    const testContactIds = testRecipients.map(r => r.contact_id);

    const remainingContacts = await db('email_contacts')
      .where({ organization_id: organizationId, status: 'active' })
      .whereNotIn('id', testContactIds);

    // Queue emails with winner content
    for (const contact of remainingContacts) {
      await db('email_queue').insert({
        organization_id: organizationId,
        campaign_id: test.campaign_id,
        contact_id: contact.id,
        to_email: contact.email,
        subject: winner.subject || campaign.subject,
        content: winner.content || campaign.content,
        sender_name: winner.sender_name || campaign.sender_name,
        sender_email: winner.sender_email || campaign.sender_email,
        status: 'pending',
        metadata: JSON.stringify({
          ab_test_id: testId,
          variant_id: winner.id,
          variant_name: winner.name,
          is_winner_send: true
        })
      });
    }

    logger.info(`Queued ${remainingContacts.length} emails for A/B test winner ${testId}`);

    return {
      sent_count: remainingContacts.length,
      winner
    };
  }

  /**
   * Stop a running test
   */
  async stopTest(testId, organizationId) {
    const test = await db('email_ab_tests')
      .where({ id: testId, organization_id: organizationId })
      .first();

    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status !== 'running') {
      throw new Error('Can only stop running tests');
    }

    const [updatedTest] = await db('email_ab_tests')
      .where({ id: testId })
      .update({
        status: 'paused',
        updated_at: new Date()
      })
      .returning('*');

    logger.info(`A/B test stopped: ${testId}`);

    return updatedTest;
  }

  /**
   * Delete A/B test
   */
  async deleteTest(testId, organizationId) {
    const test = await db('email_ab_tests')
      .where({ id: testId, organization_id: organizationId })
      .first();

    if (!test) {
      throw new Error('A/B test not found');
    }

    if (test.status === 'running') {
      throw new Error('Cannot delete a running test. Stop it first.');
    }

    await db('email_ab_tests')
      .where({ id: testId })
      .delete();

    logger.info(`A/B test deleted: ${testId}`);

    return { success: true };
  }

  /**
   * Get test results with detailed analytics
   */
  async getResults(testId, organizationId) {
    const test = await this.getTest(testId, organizationId);

    if (!test) {
      throw new Error('A/B test not found');
    }

    const control = test.variants.find(v => v.is_control);

    // Calculate detailed stats for each variant
    const variantsWithStats = test.variants.map(variant => {
      const stats = this.calculateStatistics(variant, control, test.winner_criteria);
      return {
        ...variant,
        ...stats,
        metrics: {
          sent: variant.sent_count,
          delivered: variant.delivered_count,
          delivery_rate: variant.sent_count > 0
            ? ((variant.delivered_count / variant.sent_count) * 100).toFixed(2)
            : 0,
          opens: variant.unique_opens,
          open_rate: variant.open_rate.toFixed(2),
          clicks: variant.unique_clicks,
          click_rate: variant.click_rate.toFixed(2),
          ctr: variant.ctr.toFixed(2),
          conversions: variant.converted_count,
          conversion_rate: variant.conversion_rate.toFixed(2),
          revenue: parseFloat(variant.revenue).toFixed(2),
          unsubscribes: variant.unsubscribed_count,
          bounces: variant.bounced_count,
          complaints: variant.complained_count
        }
      };
    });

    // Calculate test summary
    const totalSent = variantsWithStats.reduce((sum, v) => sum + v.sent_count, 0);
    const totalDelivered = variantsWithStats.reduce((sum, v) => sum + v.delivered_count, 0);
    const totalOpens = variantsWithStats.reduce((sum, v) => sum + v.unique_opens, 0);
    const totalClicks = variantsWithStats.reduce((sum, v) => sum + v.unique_clicks, 0);

    const winner = variantsWithStats.find(v => v.is_winner);

    return {
      test: {
        id: test.id,
        name: test.name,
        status: test.status,
        test_type: test.test_type,
        winner_criteria: test.winner_criteria,
        sample_size_percent: test.sample_size_percent,
        started_at: test.started_at,
        completed_at: test.completed_at
      },
      summary: {
        total_sent: totalSent,
        total_delivered: totalDelivered,
        total_opens: totalOpens,
        total_clicks: totalClicks,
        avg_open_rate: totalDelivered > 0 ? ((totalOpens / totalDelivered) * 100).toFixed(2) : 0,
        avg_click_rate: totalDelivered > 0 ? ((totalClicks / totalDelivered) * 100).toFixed(2) : 0
      },
      variants: variantsWithStats,
      winner: winner ? {
        id: winner.id,
        name: winner.name,
        uplift: winner.uplift_percent?.toFixed(2),
        confidence: winner.confidence_score?.toFixed(2),
        statistically_significant: winner.statistically_significant
      } : null,
      recommendation: this.generateRecommendation(variantsWithStats, test)
    };
  }

  /**
   * Generate recommendation based on results
   */
  generateRecommendation(variants, test) {
    const winner = variants.find(v => v.is_winner);

    if (!winner) {
      const sortField = test.winner_criteria === 'click_rate' ? 'click_rate'
        : test.winner_criteria === 'conversion_rate' ? 'conversion_rate'
        : test.winner_criteria === 'revenue' ? 'revenue'
        : 'open_rate';

      const sortedVariants = [...variants].sort((a, b) => b[sortField] - a[sortField]);
      const leader = sortedVariants[0];

      if (leader.statistically_significant) {
        return {
          action: 'SELECT_WINNER',
          message: `Variant ${leader.name} is performing ${leader.uplift_percent?.toFixed(1)}% better than control with ${leader.confidence_score?.toFixed(0)}% confidence. Consider selecting it as the winner.`,
          variant: leader.name
        };
      } else {
        return {
          action: 'WAIT',
          message: 'Results are not yet statistically significant. Continue running the test to gather more data.',
          variant: null
        };
      }
    }

    return {
      action: 'SEND_WINNER',
      message: `Variant ${winner.name} won the test with ${winner.uplift_percent?.toFixed(1)}% uplift. Ready to send to remaining audience.`,
      variant: winner.name
    };
  }

  /**
   * Shuffle array (Fisher-Yates)
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

module.exports = new EmailABTestService();
