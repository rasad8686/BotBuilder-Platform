/**
 * Public Tour API Routes
 * These endpoints are used by the Tours SDK from customer websites
 * No authentication required - uses workspace ID for identification
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Rate limiting for public endpoints
const rateLimit = require('express-rate-limit');

const publicLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
router.use(publicLimiter);

/**
 * POST /api/public/tours/init
 * Initialize SDK session and get active tours
 */
router.post('/init', async (req, res) => {
  try {
    const { workspaceId, visitorId, userId, url, referrer, userAgent } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    // Generate visitor ID if not provided
    const finalVisitorId = visitorId || `v_${Date.now().toString(36)}_${uuidv4().slice(0, 8)}`;

    // Get active tours for this workspace
    // In production, this would query the database
    const activeTours = await getActiveTours(workspaceId, {
      visitorId: finalVisitorId,
      userId,
      url,
    });

    // Track session init event
    await trackAnalyticsEvent({
      workspaceId,
      visitorId: finalVisitorId,
      userId,
      eventType: 'session_init',
      url,
      referrer,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      visitorId: finalVisitorId,
      activeTours,
    });
  } catch (error) {
    console.error('Tour init error:', error);
    res.status(500).json({ error: 'Failed to initialize tours' });
  }
});

/**
 * GET /api/public/tours
 * Get active tours for a workspace
 */
router.get('/', async (req, res) => {
  try {
    const { workspaceId, url, visitorId, userId } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    const tours = await getActiveTours(workspaceId, {
      visitorId,
      userId,
      url,
    });

    res.json({
      success: true,
      tours,
    });
  } catch (error) {
    console.error('Get tours error:', error);
    res.status(500).json({ error: 'Failed to fetch tours' });
  }
});

/**
 * GET /api/public/tours/:tourId
 * Get a specific tour with all steps
 */
router.get('/:tourId', async (req, res) => {
  try {
    const { tourId } = req.params;
    const workspaceId = req.query.workspaceId || req.headers['x-workspace-id'];

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    const tour = await getTourById(tourId, workspaceId);

    if (!tour) {
      return res.status(404).json({ error: 'Tour not found' });
    }

    res.json({
      success: true,
      tour,
    });
  } catch (error) {
    console.error('Get tour error:', error);
    res.status(500).json({ error: 'Failed to fetch tour' });
  }
});

/**
 * POST /api/public/tours/event
 * Track analytics event
 */
router.post('/event', async (req, res) => {
  try {
    const {
      workspaceId,
      tourId,
      stepId,
      eventType,
      eventData,
      visitorId,
      userId,
      timestamp,
      url,
      userAgent,
    } = req.body;

    const wsId = workspaceId || req.headers['x-workspace-id'];

    if (!wsId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    if (!eventType) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    await trackAnalyticsEvent({
      workspaceId: wsId,
      tourId,
      stepId,
      eventType,
      eventData,
      visitorId,
      userId,
      timestamp: timestamp || new Date().toISOString(),
      url,
      userAgent,
      ip: req.ip,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Track event error:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * POST /api/public/tours/events/batch
 * Batch track multiple events
 */
router.post('/events/batch', async (req, res) => {
  try {
    const { events, workspaceId } = req.body;

    const wsId = workspaceId || req.headers['x-workspace-id'];

    if (!wsId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array is required' });
    }

    // Process events in batch
    await Promise.all(
      events.map((event) =>
        trackAnalyticsEvent({
          ...event,
          workspaceId: wsId,
          ip: req.ip,
        })
      )
    );

    res.json({
      success: true,
      processed: events.length,
    });
  } catch (error) {
    console.error('Batch track events error:', error);
    res.status(500).json({ error: 'Failed to track events' });
  }
});

/**
 * POST /api/public/tours/progress
 * Save/sync tour progress
 */
router.post('/progress', async (req, res) => {
  try {
    const { tourId, visitorId, userId, currentStep, status, workspaceId } = req.body;

    const wsId = workspaceId || req.headers['x-workspace-id'];

    if (!wsId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    if (!tourId) {
      return res.status(400).json({ error: 'tourId is required' });
    }

    if (!visitorId) {
      return res.status(400).json({ error: 'visitorId is required' });
    }

    await saveProgress({
      workspaceId: wsId,
      tourId,
      visitorId,
      userId,
      currentStep: currentStep || 0,
      status: status || 'in_progress',
      updatedAt: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Save progress error:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

/**
 * GET /api/public/tours/progress
 * Get tour progress for a visitor
 */
router.get('/progress', async (req, res) => {
  try {
    const { tourId, visitorId, workspaceId } = req.query;

    const wsId = workspaceId || req.headers['x-workspace-id'];

    if (!wsId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    if (!tourId || !visitorId) {
      return res.status(400).json({ error: 'tourId and visitorId are required' });
    }

    const progress = await getProgress(wsId, tourId, visitorId);

    res.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * POST /api/public/tours/error
 * Report SDK error
 */
router.post('/error', async (req, res) => {
  try {
    const { workspaceId, error, context, url, userAgent, timestamp } = req.body;

    const wsId = workspaceId || req.headers['x-workspace-id'];

    console.error('SDK Error Report:', {
      workspaceId: wsId,
      error,
      context,
      url,
      userAgent,
      timestamp,
      ip: req.ip,
    });

    // In production, save to error tracking system
    res.json({ success: true });
  } catch (error) {
    console.error('Error report failed:', error);
    res.status(500).json({ error: 'Failed to report error' });
  }
});

// ============================================
// Helper Functions - Real Database Implementations
// ============================================

const db = require('../config/db');
const log = require('../utils/logger');

/**
 * Get active tours for a workspace
 */
async function getActiveTours(workspaceId, options = {}) {
  const { url, visitorId, userId } = options;

  try {
    // Get active tours for workspace
    const toursResult = await db.query(`
      SELECT
        t.id, t.name, t.description, t.status,
        t.trigger_type, t.trigger_config,
        t.settings, t.theme, t.priority,
        t.start_date, t.end_date
      FROM product_tours t
      WHERE t.workspace_id = $1
        AND t.status = 'active'
        AND (t.start_date IS NULL OR t.start_date <= NOW())
        AND (t.end_date IS NULL OR t.end_date >= NOW())
      ORDER BY t.priority DESC, t.created_at DESC
    `, [workspaceId]);

    const tours = toursResult.rows;

    // Get steps for each tour
    for (const tour of tours) {
      const stepsResult = await db.query(`
        SELECT id, step_order, step_type, title, content,
               target_selector, position, settings, media
        FROM tour_steps
        WHERE tour_id = $1
        ORDER BY step_order ASC
      `, [tour.id]);

      tour.steps = stepsResult.rows;

      // Get targeting rules
      const targetingResult = await db.query(`
        SELECT id, rule_type, field, operator, value
        FROM tour_targeting
        WHERE tour_id = $1
        ORDER BY id ASC
      `, [tour.id]);

      tour.targeting = {
        operator: tour.settings?.targetingOperator || 'AND',
        rules: targetingResult.rows
      };

      // Check visitor progress if visitorId provided
      if (visitorId) {
        const progressResult = await db.query(`
          SELECT status, current_step, completed_at
          FROM tour_progress
          WHERE tour_id = $1 AND visitor_id = $2
        `, [tour.id, visitorId]);

        if (progressResult.rows.length > 0) {
          tour.progress = progressResult.rows[0];

          // Exclude completed tours unless allowReplay is enabled
          if (tour.progress.status === 'completed' && !tour.settings?.allowReplay) {
            tour.excluded = true;
          }
        }
      }
    }

    // Filter out excluded tours
    return tours.filter(t => !t.excluded);
  } catch (error) {
    log.error('getActiveTours error', { error: error.message, workspaceId });
    return [];
  }
}

/**
 * Get a tour by ID
 */
async function getTourById(tourId, workspaceId) {
  try {
    const tourResult = await db.query(`
      SELECT
        t.id, t.name, t.description, t.status,
        t.trigger_type, t.trigger_config,
        t.settings, t.theme, t.priority,
        t.start_date, t.end_date
      FROM product_tours t
      WHERE t.id = $1 AND t.workspace_id = $2
    `, [tourId, workspaceId]);

    if (tourResult.rows.length === 0) {
      return null;
    }

    const tour = tourResult.rows[0];

    // Get steps
    const stepsResult = await db.query(`
      SELECT id, step_order, step_type, title, content,
             target_selector, position, settings, media
      FROM tour_steps
      WHERE tour_id = $1
      ORDER BY step_order ASC
    `, [tourId]);

    tour.steps = stepsResult.rows;

    // Get targeting rules
    const targetingResult = await db.query(`
      SELECT id, rule_type, field, operator, value
      FROM tour_targeting
      WHERE tour_id = $1
      ORDER BY id ASC
    `, [tourId]);

    tour.targeting = {
      operator: tour.settings?.targetingOperator || 'AND',
      rules: targetingResult.rows
    };

    return tour;
  } catch (error) {
    log.error('getTourById error', { error: error.message, tourId, workspaceId });
    return null;
  }
}

/**
 * Track analytics event
 */
async function trackAnalyticsEvent(eventData) {
  const {
    workspaceId,
    tourId,
    stepId,
    eventType,
    eventData: data,
    visitorId,
    userId,
    timestamp,
    url,
    userAgent,
    ip
  } = eventData;

  try {
    await db.query(`
      INSERT INTO tour_analytics (
        workspace_id, tour_id, step_id, event_type, event_data,
        visitor_id, user_id, url, user_agent, ip_address, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      workspaceId,
      tourId || null,
      stepId || null,
      eventType,
      JSON.stringify(data || {}),
      visitorId || null,
      userId || null,
      url || null,
      userAgent || null,
      ip || null,
      timestamp || new Date()
    ]);

    // Update tour statistics based on event type
    if (tourId) {
      if (eventType === 'tour_started') {
        await db.query(`
          UPDATE product_tours
          SET started_count = COALESCE(started_count, 0) + 1
          WHERE id = $1
        `, [tourId]);
      } else if (eventType === 'tour_completed') {
        await db.query(`
          UPDATE product_tours
          SET completed_count = COALESCE(completed_count, 0) + 1
          WHERE id = $1
        `, [tourId]);
      } else if (eventType === 'tour_skipped') {
        await db.query(`
          UPDATE product_tours
          SET skipped_count = COALESCE(skipped_count, 0) + 1
          WHERE id = $1
        `, [tourId]);
      }
    }

    log.debug('Analytics event tracked', { eventType, tourId, visitorId });
  } catch (error) {
    log.error('trackAnalyticsEvent error', { error: error.message, eventType });
  }
}

/**
 * Save progress
 */
async function saveProgress(progressData) {
  const {
    workspaceId,
    tourId,
    visitorId,
    userId,
    currentStep,
    status,
    updatedAt
  } = progressData;

  try {
    // Upsert progress record
    await db.query(`
      INSERT INTO tour_progress (
        workspace_id, tour_id, visitor_id, user_id,
        current_step, status, started_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (tour_id, visitor_id)
      DO UPDATE SET
        current_step = EXCLUDED.current_step,
        status = EXCLUDED.status,
        user_id = COALESCE(EXCLUDED.user_id, tour_progress.user_id),
        updated_at = EXCLUDED.updated_at,
        completed_at = CASE
          WHEN EXCLUDED.status = 'completed' THEN EXCLUDED.updated_at
          ELSE tour_progress.completed_at
        END
    `, [
      workspaceId,
      tourId,
      visitorId,
      userId || null,
      currentStep,
      status,
      updatedAt || new Date()
    ]);

    log.debug('Progress saved', { tourId, visitorId, status, currentStep });
  } catch (error) {
    log.error('saveProgress error', { error: error.message, tourId, visitorId });
  }
}

/**
 * Get progress
 */
async function getProgress(workspaceId, tourId, visitorId) {
  try {
    const result = await db.query(`
      SELECT
        tour_id, visitor_id, user_id,
        current_step, status,
        started_at, updated_at, completed_at
      FROM tour_progress
      WHERE workspace_id = $1 AND tour_id = $2 AND visitor_id = $3
    `, [workspaceId, tourId, visitorId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    log.error('getProgress error', { error: error.message, tourId, visitorId });
    return null;
  }
}

module.exports = router;
