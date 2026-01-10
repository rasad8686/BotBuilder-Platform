/**
 * Tour Service
 * Handles all business logic for Product Tours system
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class TourService {
  // ==================== TOURS CRUD ====================

  /**
   * Get all tours with pagination
   */
  async getTours(workspaceId, options = {}) {
    const { page = 1, limit = 20, status, search } = options;
    const offset = (page - 1) * limit;

    try {
      // Check if tours table exists
      const hasTable = await db.schema.hasTable('tours');
      if (!hasTable) {
        return {
          tours: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0
          }
        };
      }

      let query = db('tours')
        .where('workspace_id', workspaceId)
        .orderBy('created_at', 'desc');

      if (status) {
        query = query.where('status', status);
      }

      if (search) {
        query = query.where(function() {
          this.where('name', 'ilike', `%${search}%`)
            .orWhere('description', 'ilike', `%${search}%`);
        });
      }

      const [tours, countResult] = await Promise.all([
        query.clone().limit(limit).offset(offset),
        db('tours').where('workspace_id', workspaceId).count('id as total').first()
      ]);

      const total = countResult?.total ? parseInt(countResult.total) : 0;

      return {
        tours: tours || [],
        pagination: {
          page,
          limit,
          total,
          totalPages: total > 0 ? Math.ceil(total / limit) : 0
        }
      };
    } catch (error) {
      // If table doesn't exist or other DB error, return empty result
      console.error('getTours error:', error.message);
      return {
        tours: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      };
    }
  }

  /**
   * Get single tour with steps
   */
  async getTourById(tourId, workspaceId) {
    const tour = await db('tours')
      .where({ id: tourId, workspace_id: workspaceId })
      .first();

    if (!tour) {
      return null;
    }

    const steps = await db('tour_steps')
      .where('tour_id', tourId)
      .orderBy('step_order', 'asc');

    const targeting = await db('tour_targeting')
      .where('tour_id', tourId);

    return {
      ...tour,
      steps,
      targeting
    };
  }

  /**
   * Create new tour
   */
  async createTour(workspaceId, data) {
    const tourData = {
      id: uuidv4(),
      workspace_id: workspaceId,
      name: data.name,
      description: data.description || null,
      status: 'draft',
      settings: JSON.stringify(data.settings || {
        dismissible: true,
        showProgressBar: true,
        showStepNumbers: true,
        overlayEnabled: true,
        overlayOpacity: 0.5
      }),
      theme: JSON.stringify(data.theme || {
        primaryColor: '#3B82F6',
        backgroundColor: '#FFFFFF',
        textColor: '#1F2937',
        borderRadius: 8
      }),
      trigger_type: data.trigger_type || 'manual',
      trigger_config: data.trigger_config ? JSON.stringify(data.trigger_config) : null,
      priority: data.priority || 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    const [tour] = await db('tours').insert(tourData).returning('*');
    return tour;
  }

  /**
   * Update tour
   */
  async updateTour(tourId, workspaceId, data) {
    const updateData = {
      updated_at: new Date()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.settings !== undefined) updateData.settings = JSON.stringify(data.settings);
    if (data.theme !== undefined) updateData.theme = JSON.stringify(data.theme);
    if (data.trigger_type !== undefined) updateData.trigger_type = data.trigger_type;
    if (data.trigger_config !== undefined) updateData.trigger_config = JSON.stringify(data.trigger_config);
    if (data.priority !== undefined) updateData.priority = data.priority;

    const [tour] = await db('tours')
      .where({ id: tourId, workspace_id: workspaceId })
      .update(updateData)
      .returning('*');

    return tour;
  }

  /**
   * Delete tour
   */
  async deleteTour(tourId, workspaceId) {
    const deleted = await db('tours')
      .where({ id: tourId, workspace_id: workspaceId })
      .del();

    return deleted > 0;
  }

  /**
   * Duplicate tour with all steps and targeting
   */
  async duplicateTour(tourId, workspaceId) {
    const original = await this.getTourById(tourId, workspaceId);

    if (!original) {
      return null;
    }

    const newTourId = uuidv4();
    const now = new Date();

    // Create new tour
    const newTourData = {
      id: newTourId,
      workspace_id: workspaceId,
      name: `${original.name} (Copy)`,
      description: original.description,
      status: 'draft',
      settings: original.settings,
      theme: original.theme,
      trigger_type: original.trigger_type,
      trigger_config: original.trigger_config,
      priority: original.priority,
      created_at: now,
      updated_at: now,
      published_at: null
    };

    await db('tours').insert(newTourData);

    // Duplicate steps
    if (original.steps && original.steps.length > 0) {
      const newSteps = original.steps.map(step => ({
        id: uuidv4(),
        tour_id: newTourId,
        step_order: step.step_order,
        step_type: step.step_type,
        target_selector: step.target_selector,
        title: step.title,
        content: step.content,
        content_type: step.content_type,
        position: step.position,
        alignment: step.alignment,
        actions: step.actions,
        highlight_element: step.highlight_element,
        scroll_to_element: step.scroll_to_element,
        wait_for_event: step.wait_for_event,
        created_at: now,
        updated_at: now
      }));

      await db('tour_steps').insert(newSteps);
    }

    // Duplicate targeting rules
    if (original.targeting && original.targeting.length > 0) {
      const newTargeting = original.targeting.map(rule => ({
        id: uuidv4(),
        tour_id: newTourId,
        target_type: rule.target_type,
        operator: rule.operator,
        property: rule.property,
        value: rule.value,
        logic_operator: rule.logic_operator
      }));

      await db('tour_targeting').insert(newTargeting);
    }

    return this.getTourById(newTourId, workspaceId);
  }

  // ==================== STATUS OPERATIONS ====================

  /**
   * Publish tour (set status to active)
   */
  async publishTour(tourId, workspaceId) {
    const [tour] = await db('tours')
      .where({ id: tourId, workspace_id: workspaceId })
      .update({
        status: 'active',
        published_at: new Date(),
        updated_at: new Date()
      })
      .returning('*');

    return tour;
  }

  /**
   * Pause tour
   */
  async pauseTour(tourId, workspaceId) {
    const [tour] = await db('tours')
      .where({ id: tourId, workspace_id: workspaceId })
      .update({
        status: 'paused',
        updated_at: new Date()
      })
      .returning('*');

    return tour;
  }

  /**
   * Archive tour
   */
  async archiveTour(tourId, workspaceId) {
    const [tour] = await db('tours')
      .where({ id: tourId, workspace_id: workspaceId })
      .update({
        status: 'archived',
        updated_at: new Date()
      })
      .returning('*');

    return tour;
  }

  // ==================== STEPS CRUD ====================

  /**
   * Get all steps for a tour
   */
  async getSteps(tourId) {
    return db('tour_steps')
      .where('tour_id', tourId)
      .orderBy('step_order', 'asc');
  }

  /**
   * Create new step
   */
  async createStep(tourId, data) {
    // Get max step_order
    const maxOrder = await db('tour_steps')
      .where('tour_id', tourId)
      .max('step_order as max')
      .first();

    const stepData = {
      id: uuidv4(),
      tour_id: tourId,
      step_order: (maxOrder?.max || 0) + 1,
      step_type: data.step_type || 'tooltip',
      target_selector: data.target_selector,
      title: data.title,
      content: data.content,
      content_type: data.content_type || 'text',
      position: data.position || 'auto',
      alignment: data.alignment || 'center',
      actions: JSON.stringify(data.actions || []),
      highlight_element: data.highlight_element !== false,
      scroll_to_element: data.scroll_to_element !== false,
      wait_for_event: data.wait_for_event || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const [step] = await db('tour_steps').insert(stepData).returning('*');

    // Update tour's updated_at
    await db('tours').where('id', tourId).update({ updated_at: new Date() });

    return step;
  }

  /**
   * Update step
   */
  async updateStep(tourId, stepId, data) {
    const updateData = {
      updated_at: new Date()
    };

    if (data.step_type !== undefined) updateData.step_type = data.step_type;
    if (data.target_selector !== undefined) updateData.target_selector = data.target_selector;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.content_type !== undefined) updateData.content_type = data.content_type;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.alignment !== undefined) updateData.alignment = data.alignment;
    if (data.actions !== undefined) updateData.actions = JSON.stringify(data.actions);
    if (data.highlight_element !== undefined) updateData.highlight_element = data.highlight_element;
    if (data.scroll_to_element !== undefined) updateData.scroll_to_element = data.scroll_to_element;
    if (data.wait_for_event !== undefined) updateData.wait_for_event = data.wait_for_event;

    const [step] = await db('tour_steps')
      .where({ id: stepId, tour_id: tourId })
      .update(updateData)
      .returning('*');

    // Update tour's updated_at
    await db('tours').where('id', tourId).update({ updated_at: new Date() });

    return step;
  }

  /**
   * Delete step
   */
  async deleteStep(tourId, stepId) {
    const step = await db('tour_steps')
      .where({ id: stepId, tour_id: tourId })
      .first();

    if (!step) {
      return false;
    }

    await db('tour_steps')
      .where({ id: stepId, tour_id: tourId })
      .del();

    // Reorder remaining steps
    await db('tour_steps')
      .where('tour_id', tourId)
      .where('step_order', '>', step.step_order)
      .decrement('step_order', 1);

    // Update tour's updated_at
    await db('tours').where('id', tourId).update({ updated_at: new Date() });

    return true;
  }

  /**
   * Reorder steps
   */
  async reorderSteps(tourId, stepIds) {
    const trx = await db.transaction();

    try {
      for (let i = 0; i < stepIds.length; i++) {
        await trx('tour_steps')
          .where({ id: stepIds[i], tour_id: tourId })
          .update({ step_order: i + 1, updated_at: new Date() });
      }

      await trx('tours').where('id', tourId).update({ updated_at: new Date() });

      await trx.commit();

      return this.getSteps(tourId);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ==================== TARGETING ====================

  /**
   * Get targeting rules for a tour
   */
  async getTargeting(tourId) {
    return db('tour_targeting')
      .where('tour_id', tourId);
  }

  /**
   * Update targeting rules (replace all)
   */
  async updateTargeting(tourId, rules) {
    const trx = await db.transaction();

    try {
      // Delete existing rules
      await trx('tour_targeting').where('tour_id', tourId).del();

      // Insert new rules
      if (rules && rules.length > 0) {
        const newRules = rules.map(rule => ({
          id: uuidv4(),
          tour_id: tourId,
          target_type: rule.target_type,
          operator: rule.operator || 'equals',
          property: rule.property,
          value: rule.value,
          logic_operator: rule.logic_operator || 'AND'
        }));

        await trx('tour_targeting').insert(newRules);
      }

      // Update tour's updated_at
      await trx('tours').where('id', tourId).update({ updated_at: new Date() });

      await trx.commit();

      return this.getTargeting(tourId);
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get analytics for a specific tour
   */
  async getTourAnalytics(tourId, options = {}) {
    const { startDate, endDate } = options;

    let query = db('tour_analytics')
      .where('tour_id', tourId)
      .orderBy('date', 'desc');

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const dailyStats = await query;

    // Calculate totals
    const totals = await db('tour_analytics')
      .where('tour_id', tourId)
      .select(
        db.raw('SUM(impressions) as total_impressions'),
        db.raw('SUM(starts) as total_starts'),
        db.raw('SUM(completions) as total_completions'),
        db.raw('SUM(dismissals) as total_dismissals'),
        db.raw('AVG(completion_rate) as avg_completion_rate'),
        db.raw('AVG(avg_time_seconds) as avg_time_seconds')
      )
      .first();

    return {
      daily: dailyStats,
      totals: {
        impressions: parseInt(totals.total_impressions) || 0,
        starts: parseInt(totals.total_starts) || 0,
        completions: parseInt(totals.total_completions) || 0,
        dismissals: parseInt(totals.total_dismissals) || 0,
        completionRate: parseFloat(totals.avg_completion_rate) || 0,
        avgTimeSeconds: parseInt(totals.avg_time_seconds) || 0
      }
    };
  }

  /**
   * Get analytics overview for all tours in workspace
   */
  async getAnalyticsOverview(workspaceId, options = {}) {
    const { startDate, endDate, limit = 10 } = options;

    let query = db('tour_analytics as ta')
      .join('tours as t', 't.id', 'ta.tour_id')
      .where('t.workspace_id', workspaceId)
      .select(
        't.id',
        't.name',
        't.status',
        db.raw('SUM(ta.impressions) as impressions'),
        db.raw('SUM(ta.starts) as starts'),
        db.raw('SUM(ta.completions) as completions'),
        db.raw('SUM(ta.dismissals) as dismissals'),
        db.raw('AVG(ta.completion_rate) as completion_rate')
      )
      .groupBy('t.id', 't.name', 't.status')
      .orderBy('impressions', 'desc')
      .limit(limit);

    if (startDate) {
      query = query.where('ta.date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('ta.date', '<=', endDate);
    }

    const tourStats = await query;

    // Get overall totals
    let totalsQuery = db('tour_analytics as ta')
      .join('tours as t', 't.id', 'ta.tour_id')
      .where('t.workspace_id', workspaceId)
      .select(
        db.raw('SUM(ta.impressions) as total_impressions'),
        db.raw('SUM(ta.starts) as total_starts'),
        db.raw('SUM(ta.completions) as total_completions'),
        db.raw('SUM(ta.dismissals) as total_dismissals')
      )
      .first();

    if (startDate) {
      totalsQuery = totalsQuery.where('ta.date', '>=', startDate);
    }

    if (endDate) {
      totalsQuery = totalsQuery.where('ta.date', '<=', endDate);
    }

    const totals = await totalsQuery;

    return {
      tours: tourStats,
      totals: {
        impressions: parseInt(totals.total_impressions) || 0,
        starts: parseInt(totals.total_starts) || 0,
        completions: parseInt(totals.total_completions) || 0,
        dismissals: parseInt(totals.total_dismissals) || 0
      }
    };
  }

  // ==================== PROGRESS TRACKING ====================

  /**
   * Get or create user progress for a tour
   */
  async getUserProgress(tourId, visitorId) {
    let progress = await db('tour_user_progress')
      .where({ tour_id: tourId, visitor_id: visitorId })
      .first();

    if (!progress) {
      const [newProgress] = await db('tour_user_progress')
        .insert({
          id: uuidv4(),
          tour_id: tourId,
          visitor_id: visitorId,
          status: 'not_started',
          current_step: 0,
          completed_steps: []
        })
        .returning('*');

      progress = newProgress;
    }

    return progress;
  }

  /**
   * Update user progress
   */
  async updateUserProgress(tourId, visitorId, data) {
    const updateData = {
      last_seen_at: new Date()
    };

    if (data.status !== undefined) updateData.status = data.status;
    if (data.current_step !== undefined) updateData.current_step = data.current_step;
    if (data.completed_steps !== undefined) updateData.completed_steps = data.completed_steps;
    if (data.user_id !== undefined) updateData.user_id = data.user_id;

    if (data.status === 'in_progress' && !data.started_at) {
      updateData.started_at = new Date();
    }

    if (data.status === 'completed') {
      updateData.completed_at = new Date();
    }

    const [progress] = await db('tour_user_progress')
      .where({ tour_id: tourId, visitor_id: visitorId })
      .update(updateData)
      .returning('*');

    return progress;
  }

  // ==================== EVENTS ====================

  /**
   * Record tour event
   */
  async recordEvent(data) {
    const eventData = {
      id: uuidv4(),
      tour_id: data.tour_id,
      step_id: data.step_id || null,
      visitor_id: data.visitor_id,
      user_id: data.user_id || null,
      event_type: data.event_type,
      event_data: data.event_data ? JSON.stringify(data.event_data) : null,
      page_url: data.page_url || null,
      session_id: data.session_id || null,
      created_at: new Date()
    };

    const [event] = await db('tour_events').insert(eventData).returning('*');

    // Update daily analytics
    await this.updateDailyAnalytics(data.tour_id, data.event_type);

    return event;
  }

  /**
   * Update daily analytics based on event
   */
  async updateDailyAnalytics(tourId, eventType) {
    const today = new Date().toISOString().split('T')[0];

    // Get or create today's analytics record
    let analytics = await db('tour_analytics')
      .where({ tour_id: tourId, date: today })
      .first();

    if (!analytics) {
      await db('tour_analytics').insert({
        id: uuidv4(),
        tour_id: tourId,
        date: today,
        impressions: 0,
        starts: 0,
        completions: 0,
        dismissals: 0,
        step_metrics: JSON.stringify({}),
        completion_rate: 0,
        avg_time_seconds: 0
      });
    }

    // Update counter based on event type
    const updateField = {
      'tour_started': 'starts',
      'tour_completed': 'completions',
      'tour_dismissed': 'dismissals',
      'step_viewed': 'impressions'
    }[eventType];

    if (updateField) {
      await db('tour_analytics')
        .where({ tour_id: tourId, date: today })
        .increment(updateField, 1);

      // Recalculate completion rate
      const stats = await db('tour_analytics')
        .where({ tour_id: tourId, date: today })
        .first();

      if (stats && stats.starts > 0) {
        const completionRate = (stats.completions / stats.starts) * 100;
        await db('tour_analytics')
          .where({ tour_id: tourId, date: today })
          .update({ completion_rate: completionRate.toFixed(2) });
      }
    }
  }
}

module.exports = new TourService();
