/**
 * Surveys API Routes
 * Authenticated routes for managing surveys
 */

const express = require('express');
const router = express.Router();
const surveysService = require('../services/surveys.service');
const { authenticateToken } = require('../middleware/auth');
const log = require('../utils/logger');

// Get organization ID from user
const getOrganizationId = (req) => {
  return req.user?.organization_id ||
         req.user?.org_id ||
         req.query.organization_id ||
         req.body.organization_id ||
         req.user?.id ||
         1;
};

// ==================== Public Routes (for survey widget) ====================

/**
 * GET /api/surveys/public/:id
 * Get public survey data for widget/embed
 */
router.get('/public/:id', async (req, res) => {
  try {
    const survey = await surveysService.getPublicSurvey(req.params.id);

    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found or inactive'
      });
    }

    res.json({
      success: true,
      survey
    });
  } catch (error) {
    log.error('GET /api/surveys/public/:id error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get survey'
    });
  }
});

/**
 * POST /api/surveys/public/:id/start
 * Start a survey response (public)
 */
router.post('/public/:id/start', async (req, res) => {
  try {
    const result = await surveysService.startResponse(req.params.id, {
      visitor_id: req.body.visitor_id,
      contact_id: req.body.contact_id,
      user_id: req.body.user_id,
      conversation_id: req.body.conversation_id,
      ticket_id: req.body.ticket_id,
      channel: req.body.channel || 'web',
      device: req.body.device,
      browser: req.body.browser,
      ip_address: req.ip,
      metadata: req.body.metadata
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('POST /api/surveys/public/:id/start error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to start survey'
    });
  }
});

/**
 * POST /api/surveys/public/responses/:responseId/answer
 * Submit an answer (public)
 */
router.post('/public/responses/:responseId/answer', async (req, res) => {
  try {
    const { question_id, answer_value, answer_text, answer_data, time_spent_seconds } = req.body;

    if (!question_id) {
      return res.status(400).json({
        success: false,
        error: 'question_id is required'
      });
    }

    const result = await surveysService.submitAnswer(req.params.responseId, question_id, {
      answer_value,
      answer_text,
      answer_data,
      time_spent_seconds
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('POST /api/surveys/public/responses/:responseId/answer error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to submit answer'
    });
  }
});

/**
 * POST /api/surveys/public/responses/:responseId/complete
 * Complete a survey response (public)
 */
router.post('/public/responses/:responseId/complete', async (req, res) => {
  try {
    const result = await surveysService.completeResponse(req.params.responseId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('POST /api/surveys/public/responses/:responseId/complete error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to complete survey'
    });
  }
});

// ==================== Authenticated Routes ====================

// Apply authentication to all routes below
router.use(authenticateToken);

/**
 * GET /api/surveys/responses
 * Get all responses across all surveys with filtering
 */
router.get('/responses', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { period = '30d', category, page = 1, limit = 50 } = req.query;

    // Calculate date range from period
    const now = new Date();
    let startDate = new Date();

    if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (period === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (period === '365d') {
      startDate.setDate(now.getDate() - 365);
    }

    const result = await surveysService.getAllResponses(organizationId, {
      startDate,
      endDate: now,
      category,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('GET /api/surveys/responses error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get responses'
    });
  }
});

/**
 * GET /api/surveys/analytics/overview
 * Get overall survey analytics for organization
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { period = '30d' } = req.query;

    // Calculate date range from period
    const now = new Date();
    let startDate = new Date();

    if (period === '7d') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === '30d') {
      startDate.setDate(now.getDate() - 30);
    } else if (period === '90d') {
      startDate.setDate(now.getDate() - 90);
    } else if (period === '365d') {
      startDate.setDate(now.getDate() - 365);
    }

    const overview = await surveysService.getAnalyticsOverview(organizationId, {
      startDate,
      endDate: now
    });

    res.json({
      success: true,
      overview
    });
  } catch (error) {
    log.error('GET /api/surveys/analytics/overview error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview'
    });
  }
});

/**
 * GET /api/surveys
 * List all surveys with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { status, type, workspace_id, page = 1, limit = 20 } = req.query;

    const result = await surveysService.getSurveys(organizationId, {
      status,
      type,
      workspaceId: workspace_id,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('GET /api/surveys error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get surveys'
    });
  }
});

/**
 * POST /api/surveys
 * Create a new survey
 */
router.post('/', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const surveyData = {
      ...req.body,
      created_by: req.user?.id
    };

    const survey = await surveysService.createSurvey(organizationId, surveyData);

    res.status(201).json({
      success: true,
      survey
    });
  } catch (error) {
    log.error('POST /api/surveys error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create survey'
    });
  }
});

/**
 * GET /api/surveys/:id
 * Get a single survey with questions
 */
router.get('/:id', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const survey = await surveysService.getSurveyById(req.params.id, organizationId);

    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      survey
    });
  } catch (error) {
    log.error('GET /api/surveys/:id error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get survey'
    });
  }
});

/**
 * PUT /api/surveys/:id
 * Update a survey
 */
router.put('/:id', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const survey = await surveysService.updateSurvey(req.params.id, organizationId, req.body);

    if (!survey) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      survey
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update survey'
    });
  }
});

/**
 * DELETE /api/surveys/:id
 * Soft delete a survey (archive)
 */
router.delete('/:id', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const result = await surveysService.deleteSurvey(req.params.id, organizationId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      message: 'Survey archived successfully'
    });
  } catch (error) {
    log.error('DELETE /api/surveys/:id error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete survey'
    });
  }
});

// ==================== Questions Routes ====================

/**
 * POST /api/surveys/:id/questions
 * Add a question to survey
 */
router.post('/:id/questions', async (req, res) => {
  try {
    const question = await surveysService.addQuestion(req.params.id, req.body);

    res.status(201).json({
      success: true,
      question
    });
  } catch (error) {
    log.error('POST /api/surveys/:id/questions error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to add question'
    });
  }
});

/**
 * PUT /api/surveys/:id/questions/:questionId
 * Update a question
 */
router.put('/:id/questions/:questionId', async (req, res) => {
  try {
    const question = await surveysService.updateQuestion(req.params.id, req.params.questionId, req.body);

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    res.json({
      success: true,
      question
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/questions/:questionId error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update question'
    });
  }
});

/**
 * DELETE /api/surveys/:id/questions/:questionId
 * Delete a question
 */
router.delete('/:id/questions/:questionId', async (req, res) => {
  try {
    const result = await surveysService.deleteQuestion(req.params.id, req.params.questionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    res.json({
      success: true,
      message: 'Question deleted successfully'
    });
  } catch (error) {
    log.error('DELETE /api/surveys/:id/questions/:questionId error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete question'
    });
  }
});

/**
 * POST /api/surveys/:id/questions/reorder
 * Reorder questions
 */
router.post('/:id/questions/reorder', async (req, res) => {
  try {
    const { question_ids } = req.body;

    if (!question_ids || !Array.isArray(question_ids)) {
      return res.status(400).json({
        success: false,
        error: 'question_ids array is required'
      });
    }

    const questions = await surveysService.reorderQuestions(req.params.id, question_ids);

    res.json({
      success: true,
      questions
    });
  } catch (error) {
    log.error('POST /api/surveys/:id/questions/reorder error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to reorder questions'
    });
  }
});

// ==================== Responses Routes ====================

/**
 * POST /api/surveys/:id/responses
 * Start a new response (authenticated)
 */
router.post('/:id/responses', async (req, res) => {
  try {
    const result = await surveysService.startResponse(req.params.id, {
      ...req.body,
      user_id: req.user?.id,
      ip_address: req.ip
    });

    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('POST /api/surveys/:id/responses error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to start response'
    });
  }
});

/**
 * GET /api/surveys/:id/responses
 * Get all responses for a survey
 */
router.get('/:id/responses', async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;

    const result = await surveysService.getResponses(req.params.id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/responses error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get responses'
    });
  }
});

/**
 * GET /api/surveys/responses/:responseId
 * Get a single response with answers
 */
router.get('/responses/:responseId', async (req, res) => {
  try {
    const response = await surveysService.getResponseById(req.params.responseId);

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'Response not found'
      });
    }

    res.json({
      success: true,
      response
    });
  } catch (error) {
    log.error('GET /api/surveys/responses/:responseId error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get response'
    });
  }
});

// ==================== Analytics Routes ====================

/**
 * GET /api/surveys/:id/analytics
 * Get survey analytics
 */
router.get('/:id/analytics', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const analytics = await surveysService.getAnalytics(req.params.id, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics'
    });
  }
});

/**
 * POST /api/surveys/:id/analytics/refresh
 * Refresh/recalculate survey analytics
 */
router.post('/:id/analytics/refresh', async (req, res) => {
  try {
    const analytics = await surveysService.updateAnalytics(req.params.id);

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    log.error('POST /api/surveys/:id/analytics/refresh error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to refresh analytics'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/nps
 * Get NPS score calculation
 */
router.get('/:id/analytics/nps', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const nps = await surveysService.calculateNPSScore(req.params.id, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({
      success: true,
      nps
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/nps error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to calculate NPS score'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/csat
 * Get CSAT score calculation
 */
router.get('/:id/analytics/csat', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const csat = await surveysService.calculateCSATScore(req.params.id, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({
      success: true,
      csat
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/csat error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to calculate CSAT score'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/trend
 * Get response trend over time
 */
router.get('/:id/analytics/trend', async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    const trend = await surveysService.getResponseTrend(req.params.id, {
      startDate: start_date,
      endDate: end_date
    }, group_by);

    res.json({
      success: true,
      trend
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/trend error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get response trend'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/distribution
 * Get score distribution
 */
router.get('/:id/analytics/distribution', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const distribution = await surveysService.getScoreDistribution(req.params.id, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({
      success: true,
      distribution
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/distribution error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get score distribution'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/questions
 * Get question-level analytics
 */
router.get('/:id/analytics/questions', async (req, res) => {
  try {
    const { question_id } = req.query;

    const questionAnalytics = await surveysService.getQuestionAnalytics(
      req.params.id,
      question_id || null
    );

    res.json({
      success: true,
      questionAnalytics
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/questions error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get question analytics'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/recent
 * Get recent responses
 */
router.get('/:id/analytics/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const responses = await surveysService.getRecentResponses(
      req.params.id,
      parseInt(limit)
    );

    res.json({
      success: true,
      responses
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/recent error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get recent responses'
    });
  }
});

/**
 * GET /api/surveys/:id/analytics/dashboard
 * Get complete dashboard summary
 */
router.get('/:id/analytics/dashboard', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const dashboard = await surveysService.getDashboardSummary(req.params.id, {
      startDate: start_date,
      endDate: end_date
    });

    res.json({
      success: true,
      dashboard
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/analytics/dashboard error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard summary'
    });
  }
});

/**
 * GET /api/surveys/:id/export
 * Export survey responses
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { format = 'csv' } = req.query;

    const exportData = await surveysService.exportResponses(req.params.id, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=survey-${req.params.id}-responses.csv`);
      res.send(exportData);
    } else {
      res.json({
        success: true,
        data: exportData
      });
    }
  } catch (error) {
    log.error('GET /api/surveys/:id/export error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to export responses'
    });
  }
});

// ==================== FAZ 5 - Targeting Routes ====================

/**
 * PUT /api/surveys/:id/targeting
 * Update survey targeting configuration
 */
router.put('/:id/targeting', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const result = await surveysService.updateTargeting(req.params.id, organizationId, req.body);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      targeting_config: result.targeting_config
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/targeting error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update targeting'
    });
  }
});

// ==================== FAZ 5 - Schedule Routes ====================

/**
 * PUT /api/surveys/:id/schedule
 * Update survey schedule configuration
 */
router.put('/:id/schedule', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const result = await surveysService.updateSchedule(req.params.id, organizationId, req.body);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      schedule_config: result.schedule_config
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/schedule error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update schedule'
    });
  }
});

// ==================== FAZ 5 - Style Routes ====================

/**
 * PUT /api/surveys/:id/style
 * Update survey style configuration
 */
router.put('/:id/style', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const result = await surveysService.updateStyle(req.params.id, organizationId, req.body);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      style_config: result.style_config
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/style error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update style'
    });
  }
});

// ==================== FAZ 5 - Translations Routes ====================

/**
 * GET /api/surveys/:id/translations
 * Get all translations for a survey
 */
router.get('/:id/translations', async (req, res) => {
  try {
    const translations = await surveysService.getTranslations(req.params.id);

    res.json({
      success: true,
      translations
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/translations error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get translations'
    });
  }
});

/**
 * POST /api/surveys/:id/translations
 * Save/update translations for a language
 */
router.post('/:id/translations', async (req, res) => {
  try {
    const { language_code, translations } = req.body;

    if (!language_code) {
      return res.status(400).json({
        success: false,
        error: 'language_code is required'
      });
    }

    const result = await surveysService.saveTranslations(req.params.id, language_code, translations || {});

    res.json({
      success: true,
      translation: result
    });
  } catch (error) {
    log.error('POST /api/surveys/:id/translations error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to save translations'
    });
  }
});

/**
 * DELETE /api/surveys/:id/translations/:languageCode
 * Delete translations for a language
 */
router.delete('/:id/translations/:languageCode', async (req, res) => {
  try {
    const result = await surveysService.deleteTranslation(req.params.id, req.params.languageCode);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Translation not found'
      });
    }

    res.json({
      success: true,
      message: 'Translation deleted successfully'
    });
  } catch (error) {
    log.error('DELETE /api/surveys/:id/translations/:languageCode error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete translation'
    });
  }
});

// ==================== FAZ 5 - Notification Settings Routes ====================

/**
 * GET /api/surveys/:id/notifications
 * Get notification settings for a survey
 */
router.get('/:id/notifications', async (req, res) => {
  try {
    const notifications = await surveysService.getNotificationSettings(req.params.id);

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/notifications error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get notification settings'
    });
  }
});

/**
 * PUT /api/surveys/:id/notifications
 * Update notification settings for a survey
 */
router.put('/:id/notifications', async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || !Array.isArray(settings)) {
      return res.status(400).json({
        success: false,
        error: 'settings array is required'
      });
    }

    const result = await surveysService.updateNotificationSettings(req.params.id, settings);

    res.json({
      success: true,
      notifications: result
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/notifications error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update notification settings'
    });
  }
});

// ==================== FAZ 5 - Integrations Routes ====================

/**
 * GET /api/surveys/:id/integrations
 * Get all integrations for a survey
 */
router.get('/:id/integrations', async (req, res) => {
  try {
    const integrations = await surveysService.getIntegrations(req.params.id);

    res.json({
      success: true,
      integrations
    });
  } catch (error) {
    log.error('GET /api/surveys/:id/integrations error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get integrations'
    });
  }
});

/**
 * PUT /api/surveys/:id/integrations/:provider
 * Update integration for a specific provider
 */
router.put('/:id/integrations/:provider', async (req, res) => {
  try {
    const { config, enabled } = req.body;

    const result = await surveysService.updateIntegration(
      req.params.id,
      req.params.provider,
      { config, enabled }
    );

    res.json({
      success: true,
      integration: result
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/integrations/:provider error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update integration'
    });
  }
});

/**
 * DELETE /api/surveys/:id/integrations/:provider
 * Delete integration for a specific provider
 */
router.delete('/:id/integrations/:provider', async (req, res) => {
  try {
    const result = await surveysService.deleteIntegration(req.params.id, req.params.provider);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Integration not found'
      });
    }

    res.json({
      success: true,
      message: 'Integration deleted successfully'
    });
  } catch (error) {
    log.error('DELETE /api/surveys/:id/integrations/:provider error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to delete integration'
    });
  }
});

// ==================== FAZ 5 - A/B Testing Routes ====================

/**
 * PUT /api/surveys/:id/ab-test
 * Update A/B test configuration for a survey
 */
router.put('/:id/ab-test', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { enabled, config } = req.body;

    const result = await surveysService.updateABTest(req.params.id, organizationId, {
      enabled,
      config
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Survey not found'
      });
    }

    res.json({
      success: true,
      ab_test_enabled: result.ab_test_enabled,
      ab_test_config: result.ab_test_config
    });
  } catch (error) {
    log.error('PUT /api/surveys/:id/ab-test error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update A/B test configuration'
    });
  }
});

// ==================== FAZ 5 - Templates Routes ====================

/**
 * GET /api/surveys/templates
 * Get all available survey templates
 */
router.get('/templates/list', async (req, res) => {
  try {
    const templates = await surveysService.getTemplates();

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    log.error('GET /api/surveys/templates error:', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get templates'
    });
  }
});

/**
 * POST /api/surveys/templates/:templateId
 * Create a survey from a template
 */
router.post('/templates/:templateId', async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    const { name, workspace_id } = req.body;

    const survey = await surveysService.createFromTemplate(
      organizationId,
      req.params.templateId,
      {
        name,
        workspace_id,
        created_by: req.user?.id
      }
    );

    res.status(201).json({
      success: true,
      survey
    });
  } catch (error) {
    log.error('POST /api/surveys/templates/:templateId error:', { error: error.message });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create survey from template'
    });
  }
});

module.exports = router;
