const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (db, emailAutomationEngine) => {
  // Get all automations
  router.get('/', async (req, res) => {
    try {
      const { workspace_id } = req.query;
      const { status } = req.query;

      let query = db('email_automations')
        .where({ workspace_id: workspace_id || req.user.workspace_id });

      if (status && status !== 'all') {
        query = query.where({ status });
      }

      const automations = await query
        .orderBy('created_at', 'desc')
        .select('*');

      res.json(automations);
    } catch (error) {
      console.error('Error fetching automations:', error);
      res.status(500).json({ error: 'Failed to fetch automations' });
    }
  });

  // Get single automation
  router.get('/:id', async (req, res) => {
    try {
      const automation = await db('email_automations')
        .where({ id: req.params.id })
        .first();

      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      res.json(automation);
    } catch (error) {
      console.error('Error fetching automation:', error);
      res.status(500).json({ error: 'Failed to fetch automation' });
    }
  });

  // Create automation
  router.post('/', async (req, res) => {
    try {
      const { name, trigger_config, steps, status = 'draft' } = req.body;
      const workspace_id = req.body.workspace_id || req.user?.workspace_id;

      const automation = {
        id: uuidv4(),
        workspace_id,
        name,
        trigger_config: JSON.stringify(trigger_config),
        steps: JSON.stringify(steps || []),
        status,
        entry_count: 0,
        completed_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db('email_automations').insert(automation);

      res.status(201).json({
        ...automation,
        trigger_config,
        steps: steps || []
      });
    } catch (error) {
      console.error('Error creating automation:', error);
      res.status(500).json({ error: 'Failed to create automation' });
    }
  });

  // Update automation
  router.put('/:id', async (req, res) => {
    try {
      const { name, trigger_config, steps, status } = req.body;

      const updates = {
        updated_at: new Date()
      };

      if (name !== undefined) updates.name = name;
      if (trigger_config !== undefined) updates.trigger_config = JSON.stringify(trigger_config);
      if (steps !== undefined) updates.steps = JSON.stringify(steps);
      if (status !== undefined) updates.status = status;

      await db('email_automations')
        .where({ id: req.params.id })
        .update(updates);

      const automation = await db('email_automations')
        .where({ id: req.params.id })
        .first();

      res.json(automation);
    } catch (error) {
      console.error('Error updating automation:', error);
      res.status(500).json({ error: 'Failed to update automation' });
    }
  });

  // Delete automation
  router.delete('/:id', async (req, res) => {
    try {
      // Delete enrollments first
      await db('email_automation_enrollments')
        .where({ automation_id: req.params.id })
        .delete();

      // Delete automation
      await db('email_automations')
        .where({ id: req.params.id })
        .delete();

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting automation:', error);
      res.status(500).json({ error: 'Failed to delete automation' });
    }
  });

  // Activate automation
  router.post('/:id/activate', async (req, res) => {
    try {
      await db('email_automations')
        .where({ id: req.params.id })
        .update({
          status: 'active',
          activated_at: new Date(),
          updated_at: new Date()
        });

      const automation = await db('email_automations')
        .where({ id: req.params.id })
        .first();

      res.json(automation);
    } catch (error) {
      console.error('Error activating automation:', error);
      res.status(500).json({ error: 'Failed to activate automation' });
    }
  });

  // Pause automation
  router.post('/:id/pause', async (req, res) => {
    try {
      await db('email_automations')
        .where({ id: req.params.id })
        .update({
          status: 'paused',
          updated_at: new Date()
        });

      const automation = await db('email_automations')
        .where({ id: req.params.id })
        .first();

      res.json(automation);
    } catch (error) {
      console.error('Error pausing automation:', error);
      res.status(500).json({ error: 'Failed to pause automation' });
    }
  });

  // Get automation report
  router.get('/:id/report', async (req, res) => {
    try {
      const automation = await db('email_automations')
        .where({ id: req.params.id })
        .first();

      if (!automation) {
        return res.status(404).json({ error: 'Automation not found' });
      }

      // Get enrollment stats
      const enrollmentStats = await db('email_automation_enrollments')
        .where({ automation_id: req.params.id })
        .select(
          db.raw('COUNT(*) as total'),
          db.raw("COUNT(*) FILTER (WHERE status = 'active') as active"),
          db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed"),
          db.raw("COUNT(*) FILTER (WHERE status = 'exited') as exited")
        )
        .first();

      // Get step stats
      const steps = automation.steps || [];
      const stepStats = [];

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step.type === 'send_email') {
          // Get email stats for this step
          const stats = await db('email_automation_activity')
            .join('email_automation_enrollments', 'email_automation_activity.enrollment_id', 'email_automation_enrollments.id')
            .where('email_automation_enrollments.automation_id', req.params.id)
            .where('email_automation_activity.event_type', 'email_sent')
            .whereRaw("email_automation_activity.data->>'step_index' = ?", [i.toString()])
            .count('* as sent')
            .first();

          stepStats.push({
            index: i,
            name: step.config?.subject || `Step ${i + 1}`,
            type: step.type,
            sent: parseInt(stats?.sent) || 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            openRate: 0,
            clickRate: 0
          });
        }
      }

      // Get recent activity
      const recentActivity = await db('email_automation_activity')
        .join('email_automation_enrollments', 'email_automation_activity.enrollment_id', 'email_automation_enrollments.id')
        .join('email_contacts', 'email_automation_enrollments.contact_id', 'email_contacts.id')
        .where('email_automation_enrollments.automation_id', req.params.id)
        .orderBy('email_automation_activity.created_at', 'desc')
        .limit(20)
        .select(
          'email_automation_activity.event_type as type',
          'email_contacts.email',
          'email_automation_activity.created_at as timestamp',
          'email_automation_activity.data'
        );

      const total = parseInt(enrollmentStats.total) || 0;
      const completed = parseInt(enrollmentStats.completed) || 0;

      res.json({
        enrolled: total,
        active: parseInt(enrollmentStats.active) || 0,
        completed,
        exited: parseInt(enrollmentStats.exited) || 0,
        completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : 0,
        averageTimeToComplete: '2.5 days', // Would calculate from actual data
        stepStats,
        recentActivity: recentActivity.map(a => ({
          type: a.type,
          description: `${a.email} - ${a.type.replace('_', ' ')}`,
          timestamp: a.timestamp
        }))
      });
    } catch (error) {
      console.error('Error fetching automation report:', error);
      res.status(500).json({ error: 'Failed to fetch automation report' });
    }
  });

  // Get automation enrollments
  router.get('/:id/enrollments', async (req, res) => {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      let query = db('email_automation_enrollments')
        .join('email_contacts', 'email_automation_enrollments.contact_id', 'email_contacts.id')
        .where('email_automation_enrollments.automation_id', req.params.id);

      if (status) {
        query = query.where('email_automation_enrollments.status', status);
      }

      const enrollments = await query
        .orderBy('email_automation_enrollments.enrolled_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit)
        .select(
          'email_automation_enrollments.*',
          'email_contacts.email as contact_email',
          'email_contacts.first_name',
          'email_contacts.last_name'
        );

      res.json(enrollments.map(e => ({
        ...e,
        contact_name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || null
      })));
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      res.status(500).json({ error: 'Failed to fetch enrollments' });
    }
  });

  // Remove enrollment
  router.delete('/:id/enrollments/:enrollmentId', async (req, res) => {
    try {
      await db('email_automation_enrollments')
        .where({ id: req.params.enrollmentId, automation_id: req.params.id })
        .update({
          status: 'exited',
          completed_at: new Date(),
          updated_at: new Date()
        });

      res.json({ success: true });
    } catch (error) {
      console.error('Error removing enrollment:', error);
      res.status(500).json({ error: 'Failed to remove enrollment' });
    }
  });

  // Manually enroll contact
  router.post('/:id/enroll', async (req, res) => {
    try {
      const { contact_id } = req.body;

      if (!contact_id) {
        return res.status(400).json({ error: 'contact_id is required' });
      }

      const enrollment = await emailAutomationEngine.enrollContact(req.params.id, contact_id);

      if (!enrollment) {
        return res.status(400).json({ error: 'Contact is already enrolled or not eligible' });
      }

      res.status(201).json(enrollment);
    } catch (error) {
      console.error('Error enrolling contact:', error);
      res.status(500).json({ error: 'Failed to enroll contact' });
    }
  });

  return router;
};
