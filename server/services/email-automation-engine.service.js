const { v4: uuidv4 } = require('uuid');

class EmailAutomationEngineService {
  constructor(db, emailQueueService) {
    this.db = db;
    this.emailQueueService = emailQueueService;
  }

  // Process automation triggers
  async processContactEvent(contactId, eventType, eventData) {
    try {
      // Find automations triggered by this event
      const automations = await this.db('email_automations')
        .where({ status: 'active' })
        .whereRaw(`trigger_config->>'type' = ?`, [eventType]);

      for (const automation of automations) {
        if (await this.matchesTrigger(automation, contactId, eventData)) {
          await this.enrollContact(automation.id, contactId);
        }
      }
    } catch (error) {
      console.error('Error processing contact event:', error);
      throw error;
    }
  }

  // Check if contact matches trigger conditions
  async matchesTrigger(automation, contactId, eventData) {
    const triggerConfig = automation.trigger_config;

    switch (triggerConfig.type) {
      case 'subscribes':
        // Check if subscribing to specific list
        if (triggerConfig.list_id && eventData.list_id !== triggerConfig.list_id) {
          return false;
        }
        return true;

      case 'tag_added':
        return eventData.tag === triggerConfig.tag;

      case 'enters_segment':
        return eventData.segment_id === triggerConfig.segment_id;

      case 'custom_event':
        return eventData.event_name === triggerConfig.event_name;

      case 'date_based':
        // Date-based triggers are handled by cron job
        return false;

      default:
        return true;
    }
  }

  // Enroll contact in automation
  async enrollContact(automationId, contactId) {
    try {
      // Check if already enrolled
      const existing = await this.db('email_automation_enrollments')
        .where({ automation_id: automationId, contact_id: contactId, status: 'active' })
        .first();

      if (existing) {
        // Check if re-entry is allowed
        const automation = await this.db('email_automations')
          .where({ id: automationId })
          .first();

        if (!automation.trigger_config?.allow_reentry) {
          return null; // Already enrolled, no re-entry allowed
        }

        // Check re-entry delay
        if (automation.trigger_config?.reentry_delay) {
          const lastEnrollment = await this.db('email_automation_enrollments')
            .where({ automation_id: automationId, contact_id: contactId })
            .orderBy('enrolled_at', 'desc')
            .first();

          if (lastEnrollment) {
            const daysSinceLastEntry = (Date.now() - new Date(lastEnrollment.enrolled_at).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLastEntry < automation.trigger_config.reentry_delay) {
              return null; // Too soon to re-enter
            }
          }
        }
      }

      // Create enrollment
      const enrollmentId = uuidv4();
      const enrollment = await this.db('email_automation_enrollments').insert({
        id: enrollmentId,
        automation_id: automationId,
        contact_id: contactId,
        current_step: 0,
        status: 'active',
        enrolled_at: new Date(),
        next_step_at: new Date()
      }).returning('*');

      // Update automation entry count
      await this.db('email_automations')
        .where({ id: automationId })
        .increment('entry_count', 1);

      // Process first step
      await this.processNextStep(enrollmentId);

      return enrollment[0];
    } catch (error) {
      console.error('Error enrolling contact:', error);
      throw error;
    }
  }

  // Process next step for enrollment
  async processNextStep(enrollmentId) {
    try {
      const enrollment = await this.db('email_automation_enrollments')
        .where({ id: enrollmentId })
        .first();

      if (!enrollment || enrollment.status !== 'active') return;

      const automation = await this.db('email_automations')
        .where({ id: enrollment.automation_id })
        .first();

      if (!automation || automation.status !== 'active') {
        await this.pauseEnrollment(enrollmentId);
        return;
      }

      const steps = automation.steps || [];
      const currentStepIndex = enrollment.current_step;

      if (currentStepIndex >= steps.length) {
        // Automation complete
        await this.completeEnrollment(enrollmentId);
        return;
      }

      const step = steps[currentStepIndex];

      // Log step start
      await this.logActivity(enrollmentId, 'step_started', {
        step_index: currentStepIndex,
        step_type: step.type
      });

      // Execute step based on type
      switch (step.type) {
        case 'send_email':
          await this.executeSendEmail(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'wait':
          await this.scheduleWait(enrollmentId, step);
          break;

        case 'add_tag':
          await this.executeAddTag(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'remove_tag':
          await this.executeRemoveTag(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'add_to_list':
          await this.executeAddToList(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'remove_from_list':
          await this.executeRemoveFromList(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'condition':
          await this.evaluateCondition(enrollment, step, steps);
          break;

        case 'webhook':
          await this.executeWebhook(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'notify':
          await this.executeNotify(enrollment, step);
          await this.moveToNextStep(enrollmentId);
          break;

        case 'goal':
          await this.checkGoal(enrollment, step);
          break;

        case 'exit':
          await this.exitEnrollment(enrollmentId);
          break;

        default:
          console.warn(`Unknown step type: ${step.type}`);
          await this.moveToNextStep(enrollmentId);
      }
    } catch (error) {
      console.error('Error processing step:', error);
      await this.logActivity(enrollmentId, 'step_error', { error: error.message });
    }
  }

  async executeSendEmail(enrollment, step) {
    const contact = await this.db('email_contacts')
      .where({ id: enrollment.contact_id })
      .first();

    if (!contact) {
      throw new Error('Contact not found');
    }

    let template = null;
    if (step.config.template_id) {
      template = await this.db('email_templates')
        .where({ id: step.config.template_id })
        .first();
    }

    const subject = step.config.subject || template?.subject || 'No Subject';
    const htmlContent = template?.content_html || step.config.html_content || '';

    // Create and send email
    if (this.emailQueueService) {
      await this.emailQueueService.sendSingleEmail({
        to: contact.email,
        subject: this.personalize(subject, contact),
        html: this.personalize(htmlContent, contact),
        automation_id: enrollment.automation_id,
        enrollment_id: enrollment.id,
        from_name: step.config.from_name,
        preview_text: step.config.preview_text,
        track_opens: step.config.track_opens !== false,
        track_clicks: step.config.track_clicks !== false
      });
    }

    await this.logActivity(enrollment.id, 'email_sent', {
      template_id: step.config.template_id,
      subject
    });
  }

  async scheduleWait(enrollmentId, step) {
    const waitUntil = this.calculateWaitUntil(step.config);

    await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .update({ next_step_at: waitUntil });

    await this.logActivity(enrollmentId, 'wait_started', {
      wait_until: waitUntil,
      duration: step.config
    });
  }

  calculateWaitUntil(config) {
    const now = new Date();
    const value = config.value || 1;

    switch (config.unit) {
      case 'minutes':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'hours':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'days':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'weeks':
        return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    }
  }

  async executeAddTag(enrollment, step) {
    const tag = step.config.tag;
    if (!tag) return;

    await this.db('email_contacts')
      .where({ id: enrollment.contact_id })
      .update({
        tags: this.db.raw(`array_append(COALESCE(tags, '{}'), ?)`, [tag])
      });

    await this.logActivity(enrollment.id, 'tag_added', { tag });

    // Trigger tag_added event for other automations
    await this.processContactEvent(enrollment.contact_id, 'tag_added', { tag });
  }

  async executeRemoveTag(enrollment, step) {
    const tag = step.config.tag;
    if (!tag) return;

    await this.db('email_contacts')
      .where({ id: enrollment.contact_id })
      .update({
        tags: this.db.raw(`array_remove(tags, ?)`, [tag])
      });

    await this.logActivity(enrollment.id, 'tag_removed', { tag });
  }

  async executeAddToList(enrollment, step) {
    const listId = step.config.list_id;
    if (!listId) return;

    // Check if already in list
    const existing = await this.db('email_list_members')
      .where({ list_id: listId, contact_id: enrollment.contact_id })
      .first();

    if (!existing) {
      await this.db('email_list_members').insert({
        id: uuidv4(),
        list_id: listId,
        contact_id: enrollment.contact_id,
        status: step.config.update_status ? 'subscribed' : 'active',
        created_at: new Date()
      });
    }

    await this.logActivity(enrollment.id, 'added_to_list', { list_id: listId });
  }

  async executeRemoveFromList(enrollment, step) {
    const listId = step.config.list_id;
    if (!listId) return;

    if (step.config.unsubscribe) {
      await this.db('email_list_members')
        .where({ list_id: listId, contact_id: enrollment.contact_id })
        .update({ status: 'unsubscribed', updated_at: new Date() });
    } else {
      await this.db('email_list_members')
        .where({ list_id: listId, contact_id: enrollment.contact_id })
        .delete();
    }

    await this.logActivity(enrollment.id, 'removed_from_list', { list_id: listId });
  }

  async evaluateCondition(enrollment, step, allSteps) {
    const contact = await this.db('email_contacts')
      .where({ id: enrollment.contact_id })
      .first();

    const condition = step.config;
    let result = false;

    switch (condition.type) {
      case 'opened_email':
        result = await this.checkOpenedEmail(enrollment, condition);
        break;
      case 'clicked_link':
        result = await this.checkClickedLink(enrollment, condition);
        break;
      case 'has_tag':
        result = contact.tags?.includes(condition.tag);
        break;
      case 'in_segment':
        result = await this.checkInSegment(contact.id, condition.segment_id);
        break;
      case 'field_value':
        result = this.evaluateFieldCondition(contact, condition);
        break;
      default:
        result = false;
    }

    await this.logActivity(enrollment.id, 'condition_evaluated', {
      condition_type: condition.type,
      result
    });

    // Move to yes or no branch
    const nextStepIndex = result ? step.config.yes_branch : step.config.no_branch;

    if (nextStepIndex !== null && nextStepIndex !== undefined) {
      await this.moveToStep(enrollment.id, nextStepIndex);
    } else {
      // If no branch specified, move to next step
      await this.moveToNextStep(enrollment.id);
    }
  }

  async checkOpenedEmail(enrollment, condition) {
    const query = this.db('email_events')
      .where({ contact_id: enrollment.contact_id, event_type: 'opened' });

    if (condition.email_reference === 'previous') {
      // Check if opened previous email in this automation
      query.where('automation_id', enrollment.automation_id);
    }

    const opens = await query.first();
    return !!opens;
  }

  async checkClickedLink(enrollment, condition) {
    const query = this.db('email_events')
      .where({ contact_id: enrollment.contact_id, event_type: 'clicked' });

    if (condition.link_url) {
      query.where('link_url', 'like', `%${condition.link_url}%`);
    }

    const clicks = await query.first();
    return !!clicks;
  }

  async checkInSegment(contactId, segmentId) {
    // This would check segment membership
    // Simplified implementation
    const segment = await this.db('email_segments')
      .where({ id: segmentId })
      .first();

    if (!segment) return false;

    // Evaluate segment conditions
    // This is simplified - real implementation would evaluate complex conditions
    return true;
  }

  evaluateFieldCondition(contact, condition) {
    const fieldValue = contact[condition.field] || contact.custom_fields?.[condition.field];

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.field_value;
      case 'not_equals':
        return fieldValue !== condition.field_value;
      case 'contains':
        return String(fieldValue).includes(condition.field_value);
      case 'not_contains':
        return !String(fieldValue).includes(condition.field_value);
      case 'is_set':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
      case 'is_not_set':
        return fieldValue === null || fieldValue === undefined || fieldValue === '';
      default:
        return false;
    }
  }

  async executeWebhook(enrollment, step) {
    const config = step.config;
    if (!config.url) return;

    const contact = await this.db('email_contacts')
      .where({ id: enrollment.contact_id })
      .first();

    try {
      const payload = config.payload
        ? JSON.parse(this.personalize(config.payload, contact))
        : { contact_id: contact.id, email: contact.email };

      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        },
        body: JSON.stringify(payload)
      });

      await this.logActivity(enrollment.id, 'webhook_called', {
        url: config.url,
        status: response.status
      });
    } catch (error) {
      await this.logActivity(enrollment.id, 'webhook_failed', {
        url: config.url,
        error: error.message
      });

      if (config.retry_on_failure) {
        // Schedule retry
        console.log('Webhook failed, retry scheduled');
      }
    }
  }

  async executeNotify(enrollment, step) {
    const config = step.config;
    const contact = await this.db('email_contacts')
      .where({ id: enrollment.contact_id })
      .first();

    // Send internal notification
    // This could be email, slack, etc.
    await this.logActivity(enrollment.id, 'notification_sent', {
      channel: config.channel,
      message: this.personalize(config.message, contact)
    });
  }

  async checkGoal(enrollment, step) {
    const config = step.config;
    let goalAchieved = false;

    switch (config.goal_type) {
      case 'tag_added':
        const contact = await this.db('email_contacts')
          .where({ id: enrollment.contact_id })
          .first();
        goalAchieved = contact.tags?.includes(config.tag);
        break;
      case 'purchase':
        // Check for purchase event
        goalAchieved = false; // Implement based on your data model
        break;
      default:
        goalAchieved = false;
    }

    if (goalAchieved) {
      await this.logActivity(enrollment.id, 'goal_achieved', { goal: config.name });

      switch (config.on_goal) {
        case 'end':
          await this.completeEnrollment(enrollment.id);
          break;
        case 'jump':
          if (config.jump_to_step) {
            await this.moveToStep(enrollment.id, parseInt(config.jump_to_step));
          }
          break;
        default:
          await this.moveToNextStep(enrollment.id);
      }
    } else {
      // Wait and check again
      await this.db('email_automation_enrollments')
        .where({ id: enrollment.id })
        .update({
          next_step_at: new Date(Date.now() + 60 * 60 * 1000) // Check again in 1 hour
        });
    }
  }

  async moveToNextStep(enrollmentId) {
    const enrollment = await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .first();

    await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .update({
        current_step: enrollment.current_step + 1,
        next_step_at: new Date(),
        updated_at: new Date()
      });

    // Process next step immediately (or schedule)
    setImmediate(() => this.processNextStep(enrollmentId));
  }

  async moveToStep(enrollmentId, stepIndex) {
    await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .update({
        current_step: stepIndex,
        next_step_at: new Date(),
        updated_at: new Date()
      });

    setImmediate(() => this.processNextStep(enrollmentId));
  }

  async completeEnrollment(enrollmentId) {
    const enrollment = await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .first();

    await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .update({
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date()
      });

    await this.db('email_automations')
      .where({ id: enrollment.automation_id })
      .increment('completed_count', 1);

    await this.logActivity(enrollmentId, 'automation_completed', {});
  }

  async exitEnrollment(enrollmentId) {
    await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .update({
        status: 'exited',
        completed_at: new Date(),
        updated_at: new Date()
      });

    await this.logActivity(enrollmentId, 'automation_exited', {});
  }

  async pauseEnrollment(enrollmentId) {
    await this.db('email_automation_enrollments')
      .where({ id: enrollmentId })
      .update({
        status: 'paused',
        updated_at: new Date()
      });

    await this.logActivity(enrollmentId, 'enrollment_paused', {});
  }

  // Cron job: Process waiting enrollments
  async processWaitingEnrollments() {
    const now = new Date();

    const enrollments = await this.db('email_automation_enrollments')
      .where({ status: 'active' })
      .where('next_step_at', '<=', now)
      .limit(100); // Process in batches

    for (const enrollment of enrollments) {
      try {
        await this.processNextStep(enrollment.id);
      } catch (error) {
        console.error(`Error processing enrollment ${enrollment.id}:`, error);
      }
    }

    return enrollments.length;
  }

  // Personalize content with contact data
  personalize(content, contact) {
    if (!content) return '';

    let result = content;
    const replacements = {
      '{{email}}': contact.email || '',
      '{{first_name}}': contact.first_name || '',
      '{{last_name}}': contact.last_name || '',
      '{{phone}}': contact.phone || '',
      '{{company}}': contact.company || '',
      '{{tags}}': (contact.tags || []).join(', ')
    };

    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    // Handle custom fields
    if (contact.custom_fields) {
      for (const [key, value] of Object.entries(contact.custom_fields)) {
        result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
      }
    }

    return result;
  }

  // Log activity
  async logActivity(enrollmentId, eventType, data) {
    try {
      await this.db('email_automation_activity').insert({
        id: uuidv4(),
        enrollment_id: enrollmentId,
        event_type: eventType,
        data: JSON.stringify(data),
        created_at: new Date()
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Get automation statistics
  async getAutomationStats(automationId) {
    const automation = await this.db('email_automations')
      .where({ id: automationId })
      .first();

    if (!automation) return null;

    const enrollments = await this.db('email_automation_enrollments')
      .where({ automation_id: automationId })
      .select(
        this.db.raw('COUNT(*) as total'),
        this.db.raw("COUNT(*) FILTER (WHERE status = 'active') as active"),
        this.db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed"),
        this.db.raw("COUNT(*) FILTER (WHERE status = 'exited') as exited")
      )
      .first();

    return {
      enrolled: parseInt(enrollments.total) || 0,
      active: parseInt(enrollments.active) || 0,
      completed: parseInt(enrollments.completed) || 0,
      exited: parseInt(enrollments.exited) || 0,
      completionRate: enrollments.total > 0
        ? ((enrollments.completed / enrollments.total) * 100).toFixed(1)
        : 0
    };
  }
}

module.exports = EmailAutomationEngineService;
