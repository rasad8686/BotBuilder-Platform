const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (db, io) => {
  // Get active survey for trigger type (public - no auth required)
  router.get('/active', async (req, res) => {
    try {
      const { bot_id, trigger_type } = req.query;

      if (!bot_id) {
        return res.status(400).json({ error: 'bot_id is required' });
      }

      // Find active survey matching trigger type
      let query = db('surveys')
        .where({ bot_id, status: 'active' });

      if (trigger_type) {
        query = query.andWhere('trigger_type', trigger_type);
      }

      const survey = await query
        .orderBy('created_at', 'desc')
        .first();

      if (!survey) {
        return res.json({ survey: null });
      }

      // Parse JSON fields
      const parsedSurvey = {
        ...survey,
        questions: typeof survey.questions === 'string'
          ? JSON.parse(survey.questions)
          : survey.questions,
        settings: typeof survey.settings === 'string'
          ? JSON.parse(survey.settings)
          : survey.settings
      };

      // Return only public fields
      res.json({
        survey: {
          id: parsedSurvey.id,
          title: parsedSurvey.title,
          description: parsedSurvey.description,
          questions: parsedSurvey.questions,
          thank_you_message: parsedSurvey.thank_you_message,
          settings: {
            primaryColor: parsedSurvey.settings?.primaryColor,
            showProgress: parsedSurvey.settings?.showProgress,
            allowSkip: parsedSurvey.settings?.allowSkip
          }
        }
      });
    } catch (error) {
      console.error('Error fetching active survey:', error);
      res.status(500).json({ error: 'Failed to fetch survey' });
    }
  });

  // Preview survey (returns mock data for preview mode)
  router.get('/preview', async (req, res) => {
    try {
      // Return mock survey for preview
      res.json({
        id: 'preview',
        title: 'Survey Preview',
        description: 'This is a preview of your survey',
        questions: [
          {
            id: 'q1',
            type: 'rating',
            text: 'How would you rate our service?',
            required: true,
            scale: 5
          },
          {
            id: 'q2',
            type: 'text',
            text: 'Any additional comments?',
            required: false
          }
        ],
        thank_you_message: 'Thank you for your feedback!',
        settings: {
          primaryColor: '#8b5cf6',
          showProgress: true,
          allowSkip: false
        }
      });
    } catch (error) {
      console.error('Error fetching preview survey:', error);
      res.status(500).json({ error: 'Failed to fetch preview' });
    }
  });

  // Preview survey view tracking (no-op for preview)
  router.post('/preview/view', async (req, res) => {
    res.json({ success: true });
  });

  // Preview survey response (no-op for preview)
  router.post('/preview/responses', async (req, res) => {
    res.status(201).json({
      success: true,
      response_id: 'preview-response'
    });
  });

  // Get public survey by ID (for embed/share)
  router.get('/:id', async (req, res) => {
    try {
      const survey = await db('surveys')
        .where({ id: req.params.id })
        .whereIn('status', ['active', 'published'])
        .first();

      if (!survey) {
        return res.status(404).json({ error: 'Survey not found' });
      }

      // Parse JSON fields
      const parsedSurvey = {
        ...survey,
        questions: typeof survey.questions === 'string'
          ? JSON.parse(survey.questions)
          : survey.questions,
        settings: typeof survey.settings === 'string'
          ? JSON.parse(survey.settings)
          : survey.settings
      };

      // Return only public fields
      res.json({
        id: parsedSurvey.id,
        title: parsedSurvey.title,
        description: parsedSurvey.description,
        questions: parsedSurvey.questions,
        thank_you_message: parsedSurvey.thank_you_message,
        settings: {
          primaryColor: parsedSurvey.settings?.primaryColor,
          showProgress: parsedSurvey.settings?.showProgress,
          allowSkip: parsedSurvey.settings?.allowSkip,
          logo: parsedSurvey.settings?.logo,
          backgroundImage: parsedSurvey.settings?.backgroundImage
        }
      });
    } catch (error) {
      console.error('Error fetching survey:', error);
      res.status(500).json({ error: 'Failed to fetch survey' });
    }
  });

  // Submit survey response (public - no auth required)
  router.post('/:id/responses', async (req, res) => {
    try {
      const surveyId = req.params.id;
      const { session_id, responses, completed_at, metadata } = req.body;

      // Verify survey exists and is active
      const survey = await db('surveys')
        .where({ id: surveyId })
        .whereIn('status', ['active', 'published'])
        .first();

      if (!survey) {
        return res.status(404).json({ error: 'Survey not found' });
      }

      // Create response record
      const responseId = uuidv4();
      const responseRecord = {
        id: responseId,
        survey_id: surveyId,
        session_id: session_id || uuidv4(),
        responses: JSON.stringify(responses),
        metadata: JSON.stringify(metadata || {}),
        completed_at: completed_at || new Date(),
        created_at: new Date(),
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      };

      await db('survey_responses').insert(responseRecord);

      // Update survey response count
      await db('surveys')
        .where({ id: surveyId })
        .increment('response_count', 1);

      // Calculate NPS score if applicable
      const questions = typeof survey.questions === 'string'
        ? JSON.parse(survey.questions)
        : survey.questions;

      const npsQuestion = questions?.find(q => q.type === 'nps');
      if (npsQuestion) {
        const npsResponse = responses.find(r => r.question_id === npsQuestion.id);
        if (npsResponse && npsResponse.value !== undefined) {
          // Update NPS metrics
          await updateNPSMetrics(db, surveyId, npsResponse.value);
        }
      }

      // Emit real-time event to admin
      if (io) {
        const workspaceId = survey.workspace_id;
        io.to(`workspace:${workspaceId}`).emit('survey:response_received', {
          survey_id: surveyId,
          survey_title: survey.title,
          response_id: responseId,
          responses,
          timestamp: new Date()
        });
      }

      res.status(201).json({
        success: true,
        response_id: responseId
      });
    } catch (error) {
      console.error('Error submitting survey response:', error);
      res.status(500).json({ error: 'Failed to submit response' });
    }
  });

  // Track survey view (for analytics)
  router.post('/:id/view', async (req, res) => {
    try {
      const surveyId = req.params.id;
      const { session_id } = req.body;

      // Update view count
      await db('surveys')
        .where({ id: surveyId })
        .increment('view_count', 1);

      // Log view event
      await db('survey_events').insert({
        id: uuidv4(),
        survey_id: surveyId,
        session_id: session_id || null,
        event_type: 'view',
        created_at: new Date(),
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking survey view:', error);
      res.status(500).json({ error: 'Failed to track view' });
    }
  });

  // Helper function to update NPS metrics
  async function updateNPSMetrics(db, surveyId, score) {
    try {
      // Get current NPS data
      let npsData = await db('survey_nps_metrics')
        .where({ survey_id: surveyId })
        .first();

      if (!npsData) {
        // Create new NPS record
        npsData = {
          id: uuidv4(),
          survey_id: surveyId,
          promoters: 0,
          passives: 0,
          detractors: 0,
          total_responses: 0,
          nps_score: 0,
          created_at: new Date(),
          updated_at: new Date()
        };
        await db('survey_nps_metrics').insert(npsData);
      }

      // Update counts based on score
      const updates = {
        total_responses: npsData.total_responses + 1,
        updated_at: new Date()
      };

      if (score >= 9) {
        updates.promoters = npsData.promoters + 1;
      } else if (score >= 7) {
        updates.passives = npsData.passives + 1;
      } else {
        updates.detractors = npsData.detractors + 1;
      }

      // Calculate new NPS score
      const totalResponses = updates.total_responses;
      const promoters = updates.promoters || npsData.promoters;
      const detractors = updates.detractors || npsData.detractors;

      updates.nps_score = Math.round(
        ((promoters / totalResponses) - (detractors / totalResponses)) * 100
      );

      await db('survey_nps_metrics')
        .where({ survey_id: surveyId })
        .update(updates);

    } catch (error) {
      console.error('Error updating NPS metrics:', error);
    }
  }

  return router;
};
