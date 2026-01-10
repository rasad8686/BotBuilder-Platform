/**
 * Surveys Service
 * Handles all business logic for survey system
 */

const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const log = require('../utils/logger');

class SurveysService {
  // ==================== SURVEYS CRUD ====================

  /**
   * Get all surveys with pagination
   */
  async getSurveys(organizationId, options = {}) {
    const { page = 1, limit = 20, status, type, workspaceId } = options;
    const offset = (page - 1) * limit;

    try {
      const hasTable = await db.schema.hasTable('surveys');
      if (!hasTable) {
        return { surveys: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }

      let query = db('surveys')
        .where('organization_id', organizationId)
        .orderBy('created_at', 'desc');

      if (workspaceId) {
        query = query.where('workspace_id', workspaceId);
      }

      if (status) {
        query = query.where('status', status);
      }

      if (type) {
        query = query.where('type', type);
      }

      // Build count query separately without orderBy
      let countQuery = db('surveys')
        .where('organization_id', organizationId);

      if (workspaceId) {
        countQuery = countQuery.where('workspace_id', workspaceId);
      }
      if (status) {
        countQuery = countQuery.where('status', status);
      }
      if (type) {
        countQuery = countQuery.where('type', type);
      }

      const [surveys, countResult] = await Promise.all([
        query.clone().limit(limit).offset(offset),
        countQuery.count('id as total').first()
      ]);

      const total = countResult?.total ? parseInt(countResult.total) : 0;

      // Get question counts for each survey
      const surveyIds = surveys.map(s => s.id);
      const questionCounts = await db('survey_questions')
        .whereIn('survey_id', surveyIds)
        .select('survey_id')
        .count('id as count')
        .groupBy('survey_id');

      const countMap = {};
      questionCounts.forEach(q => {
        countMap[q.survey_id] = parseInt(q.count);
      });

      const surveysWithCounts = surveys.map(s => ({
        ...s,
        question_count: countMap[s.id] || 0
      }));

      return {
        surveys: surveysWithCounts,
        pagination: {
          page,
          limit,
          total,
          totalPages: total > 0 ? Math.ceil(total / limit) : 0
        }
      };
    } catch (error) {
      log.error('getSurveys error:', { error: error.message });
      return { surveys: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get single survey with questions
   */
  async getSurveyById(id, organizationId) {
    try {
      const survey = await db('surveys')
        .where({ id, organization_id: organizationId })
        .first();

      if (!survey) return null;

      const questions = await db('survey_questions')
        .where('survey_id', id)
        .orderBy('question_order', 'asc');

      // Get response stats
      const responseStats = await db('survey_responses')
        .where('survey_id', id)
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed'),
          db.raw('COUNT(CASE WHEN status = \'partial\' THEN 1 END) as partial'),
          db.raw('COUNT(CASE WHEN status = \'started\' THEN 1 END) as started')
        )
        .first();

      return {
        ...survey,
        questions,
        stats: {
          total_responses: parseInt(responseStats?.total) || 0,
          completed: parseInt(responseStats?.completed) || 0,
          partial: parseInt(responseStats?.partial) || 0,
          started: parseInt(responseStats?.started) || 0
        }
      };
    } catch (error) {
      log.error('getSurveyById error:', { error: error.message });
      return null;
    }
  }

  /**
   * Create new survey
   */
  async createSurvey(organizationId, data) {
    const surveyId = uuidv4();
    const now = new Date();

    try {
      const surveyData = {
        id: surveyId,
        organization_id: organizationId,
        workspace_id: data.workspace_id || null,
        name: data.name,
        description: data.description || null,
        type: data.type || 'custom',
        status: 'draft',
        trigger_type: data.trigger_type || 'manual',
        trigger_config: JSON.stringify(data.trigger_config || {}),
        thank_you_message: data.thank_you_message || 'Thank you for your feedback!',
        theme_color: data.theme_color || '#6366F1',
        show_progress: data.show_progress !== false,
        allow_skip: data.allow_skip || false,
        anonymous: data.anonymous || false,
        created_by: data.created_by || null,
        created_at: now,
        updated_at: now
      };

      await db('surveys').insert(surveyData);

      // Create default questions based on type
      if (data.type === 'nps') {
        await this.addQuestion(surveyId, {
          question_type: 'nps',
          question_text: 'How likely are you to recommend us to a friend or colleague?',
          is_required: true,
          config: { min: 0, max: 10, labels: { low: 'Not likely', high: 'Very likely' } }
        });
      } else if (data.type === 'csat') {
        await this.addQuestion(surveyId, {
          question_type: 'rating',
          question_text: 'How satisfied are you with our service?',
          is_required: true,
          config: { min: 1, max: 5, labels: { low: 'Very dissatisfied', high: 'Very satisfied' } }
        });
      } else if (data.type === 'ces') {
        await this.addQuestion(surveyId, {
          question_type: 'scale',
          question_text: 'How easy was it to resolve your issue today?',
          is_required: true,
          config: { min: 1, max: 7, labels: { low: 'Very difficult', high: 'Very easy' } }
        });
      }

      // Add custom questions if provided
      if (data.questions && Array.isArray(data.questions)) {
        for (let i = 0; i < data.questions.length; i++) {
          await this.addQuestion(surveyId, {
            ...data.questions[i],
            question_order: i + 1
          });
        }
      }

      return this.getSurveyById(surveyId, organizationId);
    } catch (error) {
      log.error('createSurvey error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update survey
   */
  async updateSurvey(id, organizationId, data) {
    const updateData = {
      updated_at: new Date()
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.trigger_type !== undefined) updateData.trigger_type = data.trigger_type;
    if (data.trigger_config !== undefined) updateData.trigger_config = JSON.stringify(data.trigger_config);
    if (data.thank_you_message !== undefined) updateData.thank_you_message = data.thank_you_message;
    if (data.theme_color !== undefined) updateData.theme_color = data.theme_color;
    if (data.show_progress !== undefined) updateData.show_progress = data.show_progress;
    if (data.allow_skip !== undefined) updateData.allow_skip = data.allow_skip;
    if (data.anonymous !== undefined) updateData.anonymous = data.anonymous;

    await db('surveys')
      .where({ id, organization_id: organizationId })
      .update(updateData);

    return this.getSurveyById(id, organizationId);
  }

  /**
   * Delete survey (soft delete by setting status to archived)
   */
  async deleteSurvey(id, organizationId) {
    const result = await db('surveys')
      .where({ id, organization_id: organizationId })
      .update({ status: 'archived', updated_at: new Date() });

    return result > 0;
  }

  /**
   * Hard delete survey
   */
  async hardDeleteSurvey(id, organizationId) {
    const result = await db('surveys')
      .where({ id, organization_id: organizationId })
      .delete();

    return result > 0;
  }

  // ==================== QUESTIONS ====================

  /**
   * Add question to survey
   */
  async addQuestion(surveyId, data) {
    const questionId = uuidv4();
    const now = new Date();

    // Get max order
    const maxOrder = await db('survey_questions')
      .where('survey_id', surveyId)
      .max('question_order as max')
      .first();

    const questionData = {
      id: questionId,
      survey_id: surveyId,
      question_order: data.question_order ?? ((maxOrder?.max || 0) + 1),
      question_type: data.question_type,
      question_text: data.question_text,
      description: data.description || null,
      is_required: data.is_required !== false,
      config: JSON.stringify(data.config || {}),
      logic: JSON.stringify(data.logic || {}),
      created_at: now,
      updated_at: now
    };

    await db('survey_questions').insert(questionData);

    return db('survey_questions').where('id', questionId).first();
  }

  /**
   * Update question
   */
  async updateQuestion(surveyId, questionId, data) {
    const updateData = {
      updated_at: new Date()
    };

    if (data.question_order !== undefined) updateData.question_order = data.question_order;
    if (data.question_type !== undefined) updateData.question_type = data.question_type;
    if (data.question_text !== undefined) updateData.question_text = data.question_text;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.is_required !== undefined) updateData.is_required = data.is_required;
    if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
    if (data.logic !== undefined) updateData.logic = JSON.stringify(data.logic);

    await db('survey_questions')
      .where({ id: questionId, survey_id: surveyId })
      .update(updateData);

    return db('survey_questions').where('id', questionId).first();
  }

  /**
   * Delete question
   */
  async deleteQuestion(surveyId, questionId) {
    const result = await db('survey_questions')
      .where({ id: questionId, survey_id: surveyId })
      .delete();

    // Reorder remaining questions
    const questions = await db('survey_questions')
      .where('survey_id', surveyId)
      .orderBy('question_order', 'asc');

    for (let i = 0; i < questions.length; i++) {
      await db('survey_questions')
        .where('id', questions[i].id)
        .update({ question_order: i + 1 });
    }

    return result > 0;
  }

  /**
   * Reorder questions
   */
  async reorderQuestions(surveyId, questionIds) {
    for (let i = 0; i < questionIds.length; i++) {
      await db('survey_questions')
        .where({ id: questionIds[i], survey_id: surveyId })
        .update({ question_order: i + 1 });
    }

    return db('survey_questions')
      .where('survey_id', surveyId)
      .orderBy('question_order', 'asc');
  }

  // ==================== RESPONSES ====================

  /**
   * Start survey response (creates a new response record)
   */
  async startResponse(surveyId, data = {}) {
    const responseId = uuidv4();
    const now = new Date();

    const responseData = {
      id: responseId,
      survey_id: surveyId,
      contact_id: data.contact_id || null,
      user_id: data.user_id || null,
      visitor_id: data.visitor_id || null,
      conversation_id: data.conversation_id || null,
      ticket_id: data.ticket_id || null,
      status: 'started',
      channel: data.channel || 'web',
      device: data.device || null,
      browser: data.browser || null,
      ip_address: data.ip_address || null,
      metadata: JSON.stringify(data.metadata || {}),
      started_at: now,
      created_at: now
    };

    await db('survey_responses').insert(responseData);

    return { response_id: responseId };
  }

  /**
   * Submit answer
   */
  async submitAnswer(responseId, questionId, data) {
    const answerId = uuidv4();
    const now = new Date();

    const answerData = {
      id: answerId,
      response_id: responseId,
      question_id: questionId,
      answer_value: data.answer_value?.toString() || null,
      answer_text: data.answer_text || null,
      answer_data: JSON.stringify(data.answer_data || {}),
      time_spent_seconds: data.time_spent_seconds || null,
      created_at: now
    };

    // Check if answer already exists, update if so
    const existing = await db('survey_answers')
      .where({ response_id: responseId, question_id: questionId })
      .first();

    if (existing) {
      await db('survey_answers')
        .where('id', existing.id)
        .update({
          answer_value: answerData.answer_value,
          answer_text: answerData.answer_text,
          answer_data: answerData.answer_data,
          time_spent_seconds: answerData.time_spent_seconds
        });
      return existing;
    }

    await db('survey_answers').insert(answerData);

    // Update response status to partial
    await db('survey_responses')
      .where('id', responseId)
      .update({ status: 'partial' });

    return { answer_id: answerId };
  }

  /**
   * Complete survey response
   */
  async completeResponse(responseId) {
    const now = new Date();

    await db('survey_responses')
      .where('id', responseId)
      .update({
        status: 'completed',
        completed_at: now
      });

    // Update analytics
    const response = await db('survey_responses')
      .where('id', responseId)
      .first();

    if (response) {
      await this.updateAnalytics(response.survey_id);
    }

    return { success: true };
  }

  /**
   * Get all responses for a survey
   */
  async getResponses(surveyId, options = {}) {
    const { page = 1, limit = 50, status } = options;
    const offset = (page - 1) * limit;

    let query = db('survey_responses')
      .where('survey_id', surveyId)
      .orderBy('created_at', 'desc');

    if (status) {
      query = query.where('status', status);
    }

    const [responses, countResult] = await Promise.all([
      query.clone().limit(limit).offset(offset),
      query.clone().count('id as total').first()
    ]);

    const total = countResult?.total ? parseInt(countResult.total) : 0;

    // Get answers for each response
    const responseIds = responses.map(r => r.id);
    const answers = await db('survey_answers')
      .whereIn('response_id', responseIds);

    const answerMap = {};
    answers.forEach(a => {
      if (!answerMap[a.response_id]) answerMap[a.response_id] = [];
      answerMap[a.response_id].push(a);
    });

    const responsesWithAnswers = responses.map(r => ({
      ...r,
      answers: answerMap[r.id] || []
    }));

    return {
      responses: responsesWithAnswers,
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0
      }
    };
  }

  /**
   * Get single response with answers
   */
  async getResponseById(responseId) {
    const response = await db('survey_responses')
      .where('id', responseId)
      .first();

    if (!response) return null;

    const answers = await db('survey_answers')
      .where('response_id', responseId)
      .orderBy('created_at', 'asc');

    return {
      ...response,
      answers
    };
  }

  /**
   * Get all responses across all surveys for an organization
   */
  async getAllResponses(organizationId, options = {}) {
    const { page = 1, limit = 50, startDate, endDate, category } = options;
    const offset = (page - 1) * limit;

    try {
      const hasTable = await db.schema.hasTable('survey_responses');
      if (!hasTable) {
        return { responses: [], pagination: { page, limit, total: 0, totalPages: 0 } };
      }

      let query = db('survey_responses')
        .join('surveys', 'survey_responses.survey_id', 'surveys.id')
        .where('surveys.organization_id', organizationId)
        .orderBy('survey_responses.created_at', 'desc');

      if (startDate) {
        query = query.where('survey_responses.created_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('survey_responses.created_at', '<=', endDate);
      }

      // Filter by NPS category (promoter, passive, detractor)
      if (category) {
        // Get NPS answers and filter by category
        query = query
          .leftJoin('survey_answers', 'survey_responses.id', 'survey_answers.response_id')
          .leftJoin('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
          .where('survey_questions.question_type', 'nps');

        if (category === 'promoter') {
          query = query.whereRaw('CAST(survey_answers.answer_value AS INTEGER) >= 9');
        } else if (category === 'passive') {
          query = query.whereRaw('CAST(survey_answers.answer_value AS INTEGER) BETWEEN 7 AND 8');
        } else if (category === 'detractor') {
          query = query.whereRaw('CAST(survey_answers.answer_value AS INTEGER) <= 6');
        }
      }

      const selectFields = [
        'survey_responses.*',
        'surveys.name as survey_name',
        'surveys.type as survey_type'
      ];

      // Build count query separately without orderBy
      let countQuery = db('survey_responses')
        .join('surveys', 'survey_responses.survey_id', 'surveys.id')
        .where('surveys.organization_id', organizationId);

      if (startDate) {
        countQuery = countQuery.where('survey_responses.created_at', '>=', startDate);
      }
      if (endDate) {
        countQuery = countQuery.where('survey_responses.created_at', '<=', endDate);
      }

      if (category) {
        countQuery = countQuery
          .leftJoin('survey_answers', 'survey_responses.id', 'survey_answers.response_id')
          .leftJoin('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
          .where('survey_questions.question_type', 'nps');

        if (category === 'promoter') {
          countQuery = countQuery.whereRaw('CAST(survey_answers.answer_value AS INTEGER) >= 9');
        } else if (category === 'passive') {
          countQuery = countQuery.whereRaw('CAST(survey_answers.answer_value AS INTEGER) BETWEEN 7 AND 8');
        } else if (category === 'detractor') {
          countQuery = countQuery.whereRaw('CAST(survey_answers.answer_value AS INTEGER) <= 6');
        }
      }

      const [responses, countResult] = await Promise.all([
        query.clone().select(selectFields).limit(limit).offset(offset),
        countQuery.countDistinct('survey_responses.id as total').first()
      ]);

      const total = countResult?.total ? parseInt(countResult.total) : 0;

      // Get answers for each response
      const responseIds = responses.map(r => r.id);
      const answers = responseIds.length > 0
        ? await db('survey_answers')
            .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
            .whereIn('survey_answers.response_id', responseIds)
            .select('survey_answers.*', 'survey_questions.question_text', 'survey_questions.question_type')
        : [];

      const answerMap = {};
      answers.forEach(a => {
        if (!answerMap[a.response_id]) answerMap[a.response_id] = [];
        answerMap[a.response_id].push(a);
      });

      const responsesWithAnswers = responses.map(r => ({
        ...r,
        answers: answerMap[r.id] || []
      }));

      return {
        responses: responsesWithAnswers,
        pagination: {
          page,
          limit,
          total,
          totalPages: total > 0 ? Math.ceil(total / limit) : 0
        }
      };
    } catch (error) {
      log.error('getAllResponses error:', { error: error.message });
      return { responses: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  /**
   * Get analytics overview for all surveys in an organization
   */
  async getAnalyticsOverview(organizationId, options = {}) {
    const { startDate, endDate } = options;

    try {
      const hasTable = await db.schema.hasTable('surveys');
      if (!hasTable) {
        return this.getEmptyOverview();
      }

      // Get all surveys for organization
      const surveys = await db('surveys')
        .where('organization_id', organizationId)
        .whereNot('status', 'archived');

      const surveyIds = surveys.map(s => s.id);

      if (surveyIds.length === 0) {
        return this.getEmptyOverview();
      }

      // Get response stats
      let responseQuery = db('survey_responses')
        .whereIn('survey_id', surveyIds);

      if (startDate) {
        responseQuery = responseQuery.where('created_at', '>=', startDate);
      }
      if (endDate) {
        responseQuery = responseQuery.where('created_at', '<=', endDate);
      }

      const responseStats = await responseQuery
        .select(
          db.raw('COUNT(*) as total_responses'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed_responses'),
          db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_completion_time')
        )
        .first();

      // Get NPS data
      let npsQuery = db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .whereIn('survey_responses.survey_id', surveyIds)
        .where('survey_questions.question_type', 'nps')
        .where('survey_responses.status', 'completed');

      if (startDate) {
        npsQuery = npsQuery.where('survey_responses.completed_at', '>=', startDate);
      }
      if (endDate) {
        npsQuery = npsQuery.where('survey_responses.completed_at', '<=', endDate);
      }

      const npsAnswers = await npsQuery.select('survey_answers.answer_value');

      let promoters = 0, passives = 0, detractors = 0;
      npsAnswers.forEach(a => {
        const score = parseInt(a.answer_value);
        if (!isNaN(score)) {
          if (score >= 9) promoters++;
          else if (score >= 7) passives++;
          else detractors++;
        }
      });

      const totalNps = promoters + passives + detractors;
      const npsScore = totalNps > 0 ? Math.round(((promoters - detractors) / totalNps) * 100) : null;

      // Get CSAT data
      let csatQuery = db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .whereIn('survey_responses.survey_id', surveyIds)
        .whereIn('survey_questions.question_type', ['rating', 'star'])
        .where('survey_responses.status', 'completed');

      if (startDate) {
        csatQuery = csatQuery.where('survey_responses.completed_at', '>=', startDate);
      }
      if (endDate) {
        csatQuery = csatQuery.where('survey_responses.completed_at', '<=', endDate);
      }

      const csatAnswers = await csatQuery.select('survey_answers.answer_value');
      const satisfiedCount = csatAnswers.filter(a => parseInt(a.answer_value) >= 4).length;
      const csatScore = csatAnswers.length > 0 ? Math.round((satisfiedCount / csatAnswers.length) * 100) : null;

      // Get trend data (last 7 days)
      const trendData = await db('survey_responses')
        .whereIn('survey_id', surveyIds)
        .where('created_at', '>=', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        .select(
          db.raw('DATE(created_at) as date'),
          db.raw('COUNT(*) as responses'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed')
        )
        .groupBy('date')
        .orderBy('date', 'asc');

      // Get top surveys by responses
      const topSurveys = await db('survey_responses')
        .join('surveys', 'survey_responses.survey_id', 'surveys.id')
        .whereIn('survey_responses.survey_id', surveyIds)
        .select(
          'surveys.id',
          'surveys.name',
          'surveys.type',
          db.raw('COUNT(survey_responses.id) as response_count'),
          db.raw('COUNT(CASE WHEN survey_responses.status = \'completed\' THEN 1 END) as completed_count')
        )
        .groupBy('surveys.id', 'surveys.name', 'surveys.type')
        .orderBy('response_count', 'desc')
        .limit(5);

      const totalResponses = parseInt(responseStats?.total_responses) || 0;
      const completedResponses = parseInt(responseStats?.completed_responses) || 0;

      return {
        total_surveys: surveys.length,
        active_surveys: surveys.filter(s => s.status === 'active').length,
        total_responses: totalResponses,
        completed_responses: completedResponses,
        completion_rate: totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0,
        avg_completion_time: Math.round(parseFloat(responseStats?.avg_completion_time) || 0),
        nps: {
          score: npsScore,
          promoters,
          passives,
          detractors,
          total: totalNps
        },
        csat: {
          score: csatScore,
          satisfied: satisfiedCount,
          total: csatAnswers.length
        },
        trend: trendData.map(t => ({
          date: t.date,
          responses: parseInt(t.responses),
          completed: parseInt(t.completed)
        })),
        top_surveys: topSurveys.map(s => ({
          id: s.id,
          name: s.name,
          type: s.type,
          responses: parseInt(s.response_count),
          completed: parseInt(s.completed_count)
        }))
      };
    } catch (error) {
      log.error('getAnalyticsOverview error:', { error: error.message });
      return this.getEmptyOverview();
    }
  }

  /**
   * Return empty overview structure
   */
  getEmptyOverview() {
    return {
      total_surveys: 0,
      active_surveys: 0,
      total_responses: 0,
      completed_responses: 0,
      completion_rate: 0,
      avg_completion_time: 0,
      nps: { score: null, promoters: 0, passives: 0, detractors: 0, total: 0 },
      csat: { score: null, satisfied: 0, total: 0 },
      trend: [],
      top_surveys: []
    };
  }

  // ==================== ANALYTICS ====================

  /**
   * Update survey analytics
   */
  async updateAnalytics(surveyId) {
    const today = new Date().toISOString().split('T')[0];

    // Get response stats
    const stats = await db('survey_responses')
      .where('survey_id', surveyId)
      .select(
        db.raw('COUNT(*) as total_started'),
        db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as total_completed'),
        db.raw('COUNT(CASE WHEN status = \'partial\' THEN 1 END) as total_partial'),
        db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_completion_time')
      )
      .first();

    // Get NPS scores if applicable
    const survey = await db('surveys').where('id', surveyId).first();
    let npsData = { promoters: 0, passives: 0, detractors: 0, score: null };
    let csatScore = null;
    let cesScore = null;
    let avgScore = null;

    if (survey?.type === 'nps') {
      const npsAnswers = await db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .where('survey_responses.survey_id', surveyId)
        .where('survey_questions.question_type', 'nps')
        .select('survey_answers.answer_value');

      npsAnswers.forEach(a => {
        const score = parseInt(a.answer_value);
        if (score >= 9) npsData.promoters++;
        else if (score >= 7) npsData.passives++;
        else npsData.detractors++;
      });

      const total = npsData.promoters + npsData.passives + npsData.detractors;
      if (total > 0) {
        npsData.score = ((npsData.promoters - npsData.detractors) / total * 100).toFixed(2);
      }
    }

    if (survey?.type === 'csat') {
      const csatAnswers = await db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .where('survey_responses.survey_id', surveyId)
        .whereIn('survey_questions.question_type', ['rating', 'scale'])
        .select('survey_answers.answer_value');

      if (csatAnswers.length > 0) {
        const satisfied = csatAnswers.filter(a => parseInt(a.answer_value) >= 4).length;
        csatScore = ((satisfied / csatAnswers.length) * 100).toFixed(2);
      }
    }

    if (survey?.type === 'ces') {
      const cesAnswers = await db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .where('survey_responses.survey_id', surveyId)
        .where('survey_questions.question_type', 'scale')
        .select('survey_answers.answer_value');

      if (cesAnswers.length > 0) {
        const sum = cesAnswers.reduce((acc, a) => acc + parseInt(a.answer_value), 0);
        cesScore = (sum / cesAnswers.length).toFixed(2);
      }
    }

    // Calculate average score for all numeric answers
    const numericAnswers = await db('survey_answers')
      .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
      .where('survey_responses.survey_id', surveyId)
      .whereNotNull('survey_answers.answer_value')
      .select('survey_answers.answer_value');

    const numericValues = numericAnswers
      .map(a => parseFloat(a.answer_value))
      .filter(v => !isNaN(v));

    if (numericValues.length > 0) {
      avgScore = (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2);
    }

    const completionRate = stats.total_started > 0
      ? ((stats.total_completed / stats.total_started) * 100).toFixed(2)
      : 0;

    // Upsert analytics record
    const existing = await db('survey_analytics')
      .where({ survey_id: surveyId, date: today })
      .first();

    const analyticsData = {
      survey_id: surveyId,
      date: today,
      total_started: parseInt(stats.total_started) || 0,
      total_completed: parseInt(stats.total_completed) || 0,
      total_partial: parseInt(stats.total_partial) || 0,
      completion_rate: completionRate,
      avg_completion_time: stats.avg_completion_time || 0,
      avg_score: avgScore,
      nps_promoters: npsData.promoters,
      nps_passives: npsData.passives,
      nps_detractors: npsData.detractors,
      nps_score: npsData.score,
      csat_score: csatScore,
      ces_score: cesScore,
      updated_at: new Date()
    };

    if (existing) {
      await db('survey_analytics')
        .where('id', existing.id)
        .update(analyticsData);
    } else {
      analyticsData.id = uuidv4();
      await db('survey_analytics').insert(analyticsData);
    }

    return analyticsData;
  }

  /**
   * Get survey analytics
   */
  async getAnalytics(surveyId, options = {}) {
    const { startDate, endDate } = options;

    let query = db('survey_analytics')
      .where('survey_id', surveyId)
      .orderBy('date', 'desc');

    if (startDate) {
      query = query.where('date', '>=', startDate);
    }

    if (endDate) {
      query = query.where('date', '<=', endDate);
    }

    const dailyStats = await query;

    // Get aggregate stats
    const aggregate = await db('survey_analytics')
      .where('survey_id', surveyId)
      .select(
        db.raw('SUM(total_started) as total_started'),
        db.raw('SUM(total_completed) as total_completed'),
        db.raw('AVG(completion_rate) as avg_completion_rate'),
        db.raw('AVG(avg_completion_time) as avg_completion_time'),
        db.raw('AVG(avg_score) as avg_score'),
        db.raw('SUM(nps_promoters) as nps_promoters'),
        db.raw('SUM(nps_passives) as nps_passives'),
        db.raw('SUM(nps_detractors) as nps_detractors'),
        db.raw('AVG(csat_score) as csat_score'),
        db.raw('AVG(ces_score) as ces_score')
      )
      .first();

    // Calculate NPS from aggregates
    let npsScore = null;
    const totalNps = (parseInt(aggregate?.nps_promoters) || 0) +
                     (parseInt(aggregate?.nps_passives) || 0) +
                     (parseInt(aggregate?.nps_detractors) || 0);
    if (totalNps > 0) {
      npsScore = (((aggregate.nps_promoters - aggregate.nps_detractors) / totalNps) * 100).toFixed(2);
    }

    // Get question-level analytics
    const questionStats = await db('survey_answers')
      .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
      .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
      .where('survey_responses.survey_id', surveyId)
      .select(
        'survey_questions.id as question_id',
        'survey_questions.question_text',
        'survey_questions.question_type'
      )
      .count('survey_answers.id as answer_count')
      .avg(db.raw('CASE WHEN survey_answers.answer_value ~ \'^[0-9.]+$\' THEN survey_answers.answer_value::numeric ELSE NULL END as avg_value'))
      .groupBy('survey_questions.id', 'survey_questions.question_text', 'survey_questions.question_type');

    return {
      summary: {
        total_started: parseInt(aggregate?.total_started) || 0,
        total_completed: parseInt(aggregate?.total_completed) || 0,
        completion_rate: parseFloat(aggregate?.avg_completion_rate) || 0,
        avg_completion_time: parseFloat(aggregate?.avg_completion_time) || 0,
        avg_score: parseFloat(aggregate?.avg_score) || null,
        nps_score: npsScore ? parseFloat(npsScore) : null,
        csat_score: parseFloat(aggregate?.csat_score) || null,
        ces_score: parseFloat(aggregate?.ces_score) || null
      },
      daily: dailyStats,
      questions: questionStats
    };
  }

  /**
   * Get public survey data (for widget/embed)
   */
  async getPublicSurvey(surveyId) {
    const survey = await db('surveys')
      .where({ id: surveyId, status: 'active' })
      .select('id', 'name', 'description', 'type', 'thank_you_message', 'theme_color', 'show_progress', 'allow_skip', 'anonymous')
      .first();

    if (!survey) return null;

    const questions = await db('survey_questions')
      .where('survey_id', surveyId)
      .select('id', 'question_order', 'question_type', 'question_text', 'description', 'is_required', 'config')
      .orderBy('question_order', 'asc');

    return {
      ...survey,
      questions
    };
  }

  // ==================== ADVANCED ANALYTICS ====================

  /**
   * Calculate NPS Score with breakdown
   */
  async calculateNPSScore(surveyId, dateRange = {}) {
    try {
      let query = db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .where('survey_responses.survey_id', surveyId)
        .where('survey_questions.question_type', 'nps')
        .where('survey_responses.status', 'completed');

      if (dateRange.startDate) {
        query = query.where('survey_responses.completed_at', '>=', dateRange.startDate);
      }
      if (dateRange.endDate) {
        query = query.where('survey_responses.completed_at', '<=', dateRange.endDate);
      }

      const answers = await query.select('survey_answers.answer_value');

      let promoters = 0, passives = 0, detractors = 0;
      const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };

      answers.forEach(a => {
        const score = parseInt(a.answer_value);
        if (!isNaN(score) && score >= 0 && score <= 10) {
          distribution[score]++;
          if (score >= 9) promoters++;
          else if (score >= 7) passives++;
          else detractors++;
        }
      });

      const total = promoters + passives + detractors;
      const npsScore = total > 0
        ? Math.round(((promoters - detractors) / total) * 100)
        : null;

      return {
        score: npsScore,
        promoters: { count: promoters, percentage: total > 0 ? Math.round((promoters / total) * 100) : 0 },
        passives: { count: passives, percentage: total > 0 ? Math.round((passives / total) * 100) : 0 },
        detractors: { count: detractors, percentage: total > 0 ? Math.round((detractors / total) * 100) : 0 },
        total_responses: total,
        distribution
      };
    } catch (error) {
      log.error('calculateNPSScore error:', { error: error.message });
      return { score: null, promoters: { count: 0, percentage: 0 }, passives: { count: 0, percentage: 0 }, detractors: { count: 0, percentage: 0 }, total_responses: 0, distribution: {} };
    }
  }

  /**
   * Calculate CSAT Score
   */
  async calculateCSATScore(surveyId, dateRange = {}) {
    try {
      let query = db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .where('survey_responses.survey_id', surveyId)
        .whereIn('survey_questions.question_type', ['rating', 'scale', 'star'])
        .where('survey_responses.status', 'completed');

      if (dateRange.startDate) {
        query = query.where('survey_responses.completed_at', '>=', dateRange.startDate);
      }
      if (dateRange.endDate) {
        query = query.where('survey_responses.completed_at', '<=', dateRange.endDate);
      }

      const answers = await query.select('survey_answers.answer_value', 'survey_questions.config');

      let satisfied = 0, total = 0;
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      answers.forEach(a => {
        const score = parseInt(a.answer_value);
        const config = typeof a.config === 'string' ? JSON.parse(a.config) : a.config;
        const max = config?.max || 5;

        if (!isNaN(score)) {
          total++;
          if (score <= 5) distribution[score] = (distribution[score] || 0) + 1;
          // Satisfied = top 2 scores (e.g., 4-5 on 5-point scale)
          if (score >= max - 1) satisfied++;
        }
      });

      const csatScore = total > 0 ? Math.round((satisfied / total) * 100) : null;

      return {
        score: csatScore,
        satisfied_count: satisfied,
        total_responses: total,
        distribution
      };
    } catch (error) {
      log.error('calculateCSATScore error:', { error: error.message });
      return { score: null, satisfied_count: 0, total_responses: 0, distribution: {} };
    }
  }

  /**
   * Get response trend over time
   */
  async getResponseTrend(surveyId, dateRange = {}, groupBy = 'day') {
    try {
      const { startDate, endDate } = dateRange;

      let dateFormat;
      switch (groupBy) {
        case 'hour': dateFormat = 'YYYY-MM-DD HH24:00'; break;
        case 'week': dateFormat = 'IYYY-IW'; break;
        case 'month': dateFormat = 'YYYY-MM'; break;
        default: dateFormat = 'YYYY-MM-DD';
      }

      let query = db('survey_responses')
        .where('survey_id', surveyId)
        .select(
          db.raw(`to_char(created_at, '${dateFormat}') as period`),
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed'),
          db.raw('COUNT(CASE WHEN status = \'partial\' THEN 1 END) as partial')
        )
        .groupBy('period')
        .orderBy('period', 'asc');

      if (startDate) {
        query = query.where('created_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('created_at', '<=', endDate);
      }

      const trend = await query;

      return {
        data: trend.map(t => ({
          period: t.period,
          total: parseInt(t.total),
          completed: parseInt(t.completed),
          partial: parseInt(t.partial),
          completion_rate: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0
        })),
        groupBy
      };
    } catch (error) {
      log.error('getResponseTrend error:', { error: error.message });
      return { data: [], groupBy };
    }
  }

  /**
   * Get score distribution for a question
   */
  async getScoreDistribution(surveyId, questionId) {
    try {
      const answers = await db('survey_answers')
        .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
        .where('survey_responses.survey_id', surveyId)
        .where('survey_answers.question_id', questionId)
        .where('survey_responses.status', 'completed')
        .select('survey_answers.answer_value');

      const distribution = {};
      answers.forEach(a => {
        const value = a.answer_value;
        if (value) {
          distribution[value] = (distribution[value] || 0) + 1;
        }
      });

      const total = answers.length;
      const result = Object.entries(distribution).map(([value, count]) => ({
        value,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }));

      return {
        total_responses: total,
        distribution: result.sort((a, b) => {
          const numA = parseFloat(a.value);
          const numB = parseFloat(b.value);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.value.localeCompare(b.value);
        })
      };
    } catch (error) {
      log.error('getScoreDistribution error:', { error: error.message });
      return { total_responses: 0, distribution: [] };
    }
  }

  /**
   * Get detailed question analytics
   */
  async getQuestionAnalytics(surveyId, questionId = null) {
    try {
      let questionsQuery = db('survey_questions')
        .where('survey_id', surveyId)
        .orderBy('question_order', 'asc');

      if (questionId) {
        questionsQuery = questionsQuery.where('id', questionId);
      }

      const questions = await questionsQuery;
      const results = [];

      for (const question of questions) {
        const answers = await db('survey_answers')
          .join('survey_responses', 'survey_answers.response_id', 'survey_responses.id')
          .where('survey_answers.question_id', question.id)
          .where('survey_responses.status', 'completed')
          .select('survey_answers.answer_value', 'survey_answers.answer_text');

        const total = answers.length;
        let analytics = {
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          total_responses: total
        };

        if (['rating', 'scale', 'nps', 'star'].includes(question.question_type)) {
          // Numeric analytics
          const numericValues = answers
            .map(a => parseFloat(a.answer_value))
            .filter(v => !isNaN(v));

          if (numericValues.length > 0) {
            analytics.average = parseFloat((numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2));
            analytics.min = Math.min(...numericValues);
            analytics.max = Math.max(...numericValues);
          }

          // Distribution
          const dist = {};
          numericValues.forEach(v => {
            dist[v] = (dist[v] || 0) + 1;
          });
          analytics.distribution = Object.entries(dist)
            .map(([value, count]) => ({ value: parseFloat(value), count, percentage: Math.round((count / total) * 100) }))
            .sort((a, b) => a.value - b.value);

        } else if (['single_choice', 'multiple_choice'].includes(question.question_type)) {
          // Choice analytics
          const dist = {};
          answers.forEach(a => {
            const values = question.question_type === 'multiple_choice' && a.answer_data
              ? (typeof a.answer_data === 'string' ? JSON.parse(a.answer_data) : a.answer_data)
              : [a.answer_value];

            (Array.isArray(values) ? values : [values]).forEach(v => {
              if (v) dist[v] = (dist[v] || 0) + 1;
            });
          });
          analytics.distribution = Object.entries(dist)
            .map(([value, count]) => ({ value, count, percentage: Math.round((count / total) * 100) }))
            .sort((a, b) => b.count - a.count);

        } else if (question.question_type === 'text') {
          // Text analytics
          analytics.responses = answers
            .filter(a => a.answer_text)
            .slice(0, 100)
            .map(a => a.answer_text);

          // Word frequency for word cloud
          const wordFreq = {};
          answers.forEach(a => {
            if (a.answer_text) {
              const words = a.answer_text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(w => w.length > 3);
              words.forEach(w => {
                wordFreq[w] = (wordFreq[w] || 0) + 1;
              });
            }
          });
          analytics.word_cloud = Object.entries(wordFreq)
            .map(([word, count]) => ({ word, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 50);
        }

        results.push(analytics);
      }

      return questionId ? results[0] : results;
    } catch (error) {
      log.error('getQuestionAnalytics error:', { error: error.message });
      return questionId ? null : [];
    }
  }

  /**
   * Get recent responses with answers
   */
  async getRecentResponses(surveyId, limit = 10) {
    try {
      const responses = await db('survey_responses')
        .where('survey_id', surveyId)
        .where('status', 'completed')
        .orderBy('completed_at', 'desc')
        .limit(limit);

      const responseIds = responses.map(r => r.id);
      const answers = await db('survey_answers')
        .join('survey_questions', 'survey_answers.question_id', 'survey_questions.id')
        .whereIn('survey_answers.response_id', responseIds)
        .select(
          'survey_answers.*',
          'survey_questions.question_text',
          'survey_questions.question_type'
        );

      const answerMap = {};
      answers.forEach(a => {
        if (!answerMap[a.response_id]) answerMap[a.response_id] = [];
        answerMap[a.response_id].push(a);
      });

      // Get contact info if available
      const contactIds = responses.filter(r => r.contact_id).map(r => r.contact_id);
      const contacts = contactIds.length > 0
        ? await db('email_contacts').whereIn('id', contactIds).select('id', 'email', 'first_name', 'last_name')
        : [];
      const contactMap = {};
      contacts.forEach(c => { contactMap[c.id] = c; });

      return responses.map(r => ({
        ...r,
        answers: answerMap[r.id] || [],
        contact: contactMap[r.contact_id] || null
      }));
    } catch (error) {
      log.error('getRecentResponses error:', { error: error.message });
      return [];
    }
  }

  /**
   * Export responses to CSV format
   */
  async exportResponses(surveyId, format = 'csv') {
    try {
      const survey = await db('surveys').where('id', surveyId).first();
      const questions = await db('survey_questions')
        .where('survey_id', surveyId)
        .orderBy('question_order', 'asc');

      const responses = await db('survey_responses')
        .where('survey_id', surveyId)
        .where('status', 'completed')
        .orderBy('completed_at', 'desc');

      const responseIds = responses.map(r => r.id);
      const answers = await db('survey_answers')
        .whereIn('response_id', responseIds);

      const answerMap = {};
      answers.forEach(a => {
        if (!answerMap[a.response_id]) answerMap[a.response_id] = {};
        answerMap[a.response_id][a.question_id] = a.answer_value || a.answer_text;
      });

      // Build CSV data
      const headers = ['Response ID', 'Completed At', 'Channel', 'Device', ...questions.map(q => q.question_text)];
      const rows = responses.map(r => {
        const row = [
          r.id,
          r.completed_at ? new Date(r.completed_at).toISOString() : '',
          r.channel || '',
          r.device || ''
        ];
        questions.forEach(q => {
          row.push(answerMap[r.id]?.[q.id] || '');
        });
        return row;
      });

      if (format === 'csv') {
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        return {
          content: csvContent,
          filename: `survey-${survey.name.replace(/[^a-z0-9]/gi, '-')}-responses.csv`,
          contentType: 'text/csv'
        };
      }

      return { headers, rows };
    } catch (error) {
      log.error('exportResponses error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get dashboard summary with comparison
   */
  async getDashboardSummary(surveyId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;

      // Current period stats
      let currentQuery = db('survey_responses')
        .where('survey_id', surveyId);

      if (startDate) currentQuery = currentQuery.where('created_at', '>=', startDate);
      if (endDate) currentQuery = currentQuery.where('created_at', '<=', endDate);

      const currentStats = await currentQuery
        .select(
          db.raw('COUNT(*) as total'),
          db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed'),
          db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_time')
        )
        .first();

      // Previous period stats (same duration before startDate)
      let previousStats = { total: 0, completed: 0, avg_time: 0 };
      if (startDate && endDate) {
        const duration = new Date(endDate) - new Date(startDate);
        const prevEnd = new Date(startDate);
        const prevStart = new Date(prevEnd - duration);

        previousStats = await db('survey_responses')
          .where('survey_id', surveyId)
          .where('created_at', '>=', prevStart.toISOString())
          .where('created_at', '<', startDate)
          .select(
            db.raw('COUNT(*) as total'),
            db.raw('COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed'),
            db.raw('AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_time')
          )
          .first();
      }

      const npsData = await this.calculateNPSScore(surveyId, dateRange);
      const csatData = await this.calculateCSATScore(surveyId, dateRange);

      const currentTotal = parseInt(currentStats?.total) || 0;
      const currentCompleted = parseInt(currentStats?.completed) || 0;
      const previousTotal = parseInt(previousStats?.total) || 0;
      const previousCompleted = parseInt(previousStats?.completed) || 0;

      return {
        total_responses: currentTotal,
        total_change: previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100) : 0,
        completed_responses: currentCompleted,
        completion_rate: currentTotal > 0 ? Math.round((currentCompleted / currentTotal) * 100) : 0,
        completion_rate_change: previousTotal > 0
          ? Math.round(((currentCompleted / currentTotal) - (previousCompleted / previousTotal)) * 100)
          : 0,
        avg_response_time: Math.round(parseFloat(currentStats?.avg_time) || 0),
        avg_time_change: previousStats?.avg_time
          ? Math.round(((currentStats.avg_time - previousStats.avg_time) / previousStats.avg_time) * 100)
          : 0,
        nps: npsData,
        csat: csatData
      };
    } catch (error) {
      log.error('getDashboardSummary error:', { error: error.message });
      return {
        total_responses: 0,
        completed_responses: 0,
        completion_rate: 0,
        avg_response_time: 0,
        nps: { score: null },
        csat: { score: null }
      };
    }
  }

  // ==================== FAZ 5 INTEGRATION ====================

  /**
   * Update targeting configuration
   */
  async updateTargeting(surveyId, organizationId, config) {
    try {
      await db('surveys')
        .where({ id: surveyId, organization_id: organizationId })
        .update({
          targeting_config: JSON.stringify(config),
          updated_at: new Date()
        });

      return await this.getSurveyById(surveyId, organizationId);
    } catch (error) {
      log.error('updateTargeting error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update schedule configuration
   */
  async updateSchedule(surveyId, organizationId, config) {
    try {
      await db('surveys')
        .where({ id: surveyId, organization_id: organizationId })
        .update({
          schedule_config: JSON.stringify(config),
          updated_at: new Date()
        });

      return await this.getSurveyById(surveyId, organizationId);
    } catch (error) {
      log.error('updateSchedule error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update style configuration
   */
  async updateStyle(surveyId, organizationId, config) {
    try {
      await db('surveys')
        .where({ id: surveyId, organization_id: organizationId })
        .update({
          style_config: JSON.stringify(config),
          updated_at: new Date()
        });

      return await this.getSurveyById(surveyId, organizationId);
    } catch (error) {
      log.error('updateStyle error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all translations for a survey
   */
  async getTranslations(surveyId) {
    try {
      const translations = await db('survey_translations')
        .where('survey_id', surveyId)
        .orderBy('language_code', 'asc');

      return translations.map(t => ({
        ...t,
        translations: typeof t.translations === 'string' ? JSON.parse(t.translations) : t.translations
      }));
    } catch (error) {
      log.error('getTranslations error:', { error: error.message });
      return [];
    }
  }

  /**
   * Save translations for a specific language
   */
  async saveTranslations(surveyId, languageCode, translations) {
    try {
      const existing = await db('survey_translations')
        .where({ survey_id: surveyId, language_code: languageCode })
        .first();

      if (existing) {
        await db('survey_translations')
          .where({ id: existing.id })
          .update({
            translations: JSON.stringify(translations),
            updated_at: new Date()
          });
      } else {
        await db('survey_translations').insert({
          id: uuidv4(),
          survey_id: surveyId,
          language_code: languageCode,
          translations: JSON.stringify(translations),
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      return await this.getTranslations(surveyId);
    } catch (error) {
      log.error('saveTranslations error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete translations for a specific language
   */
  async deleteTranslation(surveyId, languageCode) {
    try {
      await db('survey_translations')
        .where({ survey_id: surveyId, language_code: languageCode })
        .delete();

      return true;
    } catch (error) {
      log.error('deleteTranslation error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get notification settings for a survey
   */
  async getNotificationSettings(surveyId) {
    try {
      const settings = await db('survey_notification_settings')
        .where('survey_id', surveyId)
        .orderBy('type', 'asc');

      return settings.map(s => ({
        ...s,
        config: typeof s.config === 'string' ? JSON.parse(s.config) : s.config
      }));
    } catch (error) {
      log.error('getNotificationSettings error:', { error: error.message });
      return [];
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(surveyId, settings) {
    try {
      // Process each notification type
      for (const setting of settings) {
        const existing = await db('survey_notification_settings')
          .where({ survey_id: surveyId, type: setting.type })
          .first();

        if (existing) {
          await db('survey_notification_settings')
            .where({ id: existing.id })
            .update({
              config: JSON.stringify(setting.config || {}),
              enabled: setting.enabled !== undefined ? setting.enabled : existing.enabled,
              updated_at: new Date()
            });
        } else {
          await db('survey_notification_settings').insert({
            id: uuidv4(),
            survey_id: surveyId,
            type: setting.type,
            config: JSON.stringify(setting.config || {}),
            enabled: setting.enabled !== undefined ? setting.enabled : true,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
      }

      return await this.getNotificationSettings(surveyId);
    } catch (error) {
      log.error('updateNotificationSettings error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get integrations for a survey
   */
  async getIntegrations(surveyId) {
    try {
      const integrations = await db('survey_integrations')
        .where('survey_id', surveyId)
        .orderBy('provider', 'asc');

      return integrations.map(i => ({
        ...i,
        config: typeof i.config === 'string' ? JSON.parse(i.config) : i.config
      }));
    } catch (error) {
      log.error('getIntegrations error:', { error: error.message });
      return [];
    }
  }

  /**
   * Update integration for a specific provider
   */
  async updateIntegration(surveyId, provider, config) {
    try {
      const existing = await db('survey_integrations')
        .where({ survey_id: surveyId, provider })
        .first();

      if (existing) {
        await db('survey_integrations')
          .where({ id: existing.id })
          .update({
            config: JSON.stringify(config.config || {}),
            enabled: config.enabled !== undefined ? config.enabled : existing.enabled,
            updated_at: new Date()
          });
      } else {
        await db('survey_integrations').insert({
          id: uuidv4(),
          survey_id: surveyId,
          provider,
          config: JSON.stringify(config.config || {}),
          enabled: config.enabled !== undefined ? config.enabled : false,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      return await this.getIntegrations(surveyId);
    } catch (error) {
      log.error('updateIntegration error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete integration
   */
  async deleteIntegration(surveyId, provider) {
    try {
      await db('survey_integrations')
        .where({ survey_id: surveyId, provider })
        .delete();

      return true;
    } catch (error) {
      log.error('deleteIntegration error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Update A/B test configuration
   */
  async updateABTest(surveyId, organizationId, config) {
    try {
      await db('surveys')
        .where({ id: surveyId, organization_id: organizationId })
        .update({
          ab_test_enabled: config.enabled || false,
          ab_test_config: JSON.stringify(config),
          updated_at: new Date()
        });

      return await this.getSurveyById(surveyId, organizationId);
    } catch (error) {
      log.error('updateABTest error:', { error: error.message });
      throw error;
    }
  }

  /**
   * Get survey templates
   */
  async getTemplates() {
    return [
      {
        id: 'nps',
        name: 'Net Promoter Score (NPS)',
        description: 'Musterilərin tövsiyə etmə ehtimalini ölçün',
        type: 'nps',
        icon: '📊',
        questions: [
          {
            type: 'nps',
            text: 'Bizi dostlarınıza və ya həmkarlarınıza tövsiyə etmə ehtimalınız nə qədərdir?',
            required: true,
            config: { minLabel: 'Heç tövsiyə etmərəm', maxLabel: 'Mütləq tövsiyə edərəm' }
          },
          {
            type: 'text',
            text: 'Cavabınızın səbəbini izah edə bilərsinizmi?',
            required: false,
            config: { placeholder: 'Fikrinizi yazın...', multiline: true }
          }
        ]
      },
      {
        id: 'csat',
        name: 'Customer Satisfaction (CSAT)',
        description: 'Müştəri məmnuniyyətini ölçün',
        type: 'csat',
        icon: '⭐',
        questions: [
          {
            type: 'rating',
            text: 'Xidmətimizdən nə dərəcədə razısınız?',
            required: true,
            config: { maxRating: 5 }
          },
          {
            type: 'text',
            text: 'Xidmətimizi necə yaxşılaşdıra bilərik?',
            required: false,
            config: { placeholder: 'Təkliflərinizi yazın...' }
          }
        ]
      },
      {
        id: 'ces',
        name: 'Customer Effort Score (CES)',
        description: 'Müştəri səy səviyyəsini ölçün',
        type: 'ces',
        icon: '💪',
        questions: [
          {
            type: 'scale',
            text: 'Probleminizi həll etmək nə qədər asan oldu?',
            required: true,
            config: { min: 1, max: 7, minLabel: 'Çox çətin', maxLabel: 'Çox asan' }
          }
        ]
      },
      {
        id: 'feedback',
        name: 'Ümumi Rəy',
        description: 'Müştərilərdən açıq rəy toplayın',
        type: 'feedback',
        icon: '💬',
        questions: [
          {
            type: 'emoji',
            text: 'Bu gün təcrübəniz necə oldu?',
            required: true
          },
          {
            type: 'text',
            text: 'Bizə nə demək istərdiniz?',
            required: false,
            config: { multiline: true, placeholder: 'Fikrinizi bölüşün...' }
          }
        ]
      },
      {
        id: 'exit',
        name: 'Çıxış Anketi',
        description: 'İstifadəçilər ayrılmadan əvvəl rəy toplayın',
        type: 'exit',
        icon: '🚪',
        questions: [
          {
            type: 'single_choice',
            text: 'Niyə ayrılırsınız?',
            required: true,
            options: [
              { value: 'found_what_needed', label: 'Axtardığımı tapdım' },
              { value: 'not_found', label: 'Axtardığımı tapa bilmədim' },
              { value: 'too_expensive', label: 'Qiymət uyğun deyil' },
              { value: 'just_browsing', label: 'Sadəcə baxırdım' },
              { value: 'other', label: 'Digər' }
            ]
          }
        ]
      },
      {
        id: 'product',
        name: 'Məhsul Rəyi',
        description: 'Məhsul haqqında ətraflı rəy toplayın',
        type: 'rating',
        icon: '📦',
        questions: [
          {
            type: 'rating',
            text: 'Məhsulun keyfiyyətini necə qiymətləndirirsiniz?',
            required: true,
            config: { maxRating: 5 }
          },
          {
            type: 'rating',
            text: 'Qiymət-keyfiyyət nisbətini necə qiymətləndirirsiniz?',
            required: true,
            config: { maxRating: 5 }
          },
          {
            type: 'multiple_choice',
            text: 'Məhsulun hansı xüsusiyyətlərini bəyəndiniz?',
            required: false,
            options: [
              { value: 'quality', label: 'Keyfiyyət' },
              { value: 'design', label: 'Dizayn' },
              { value: 'price', label: 'Qiymət' },
              { value: 'functionality', label: 'Funksionallıq' }
            ]
          }
        ]
      }
    ];
  }

  /**
   * Create survey from template
   */
  async createFromTemplate(organizationId, templateId, data = {}) {
    try {
      const templates = await this.getTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        throw new Error('Template not found');
      }

      // Create survey with template data
      const surveyData = {
        name: data.name || template.name,
        description: data.description || template.description,
        type: template.type,
        ...data
      };

      const survey = await this.createSurvey(organizationId, surveyData);

      // Add template questions
      for (let i = 0; i < template.questions.length; i++) {
        const q = template.questions[i];
        await this.addQuestion(survey.id, {
          ...q,
          question_order: i
        });
      }

      return await this.getSurveyById(survey.id, organizationId);
    } catch (error) {
      log.error('createFromTemplate error:', { error: error.message });
      throw error;
    }
  }
}

module.exports = new SurveysService();
