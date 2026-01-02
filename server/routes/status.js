const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const log = require('../utils/logger');
const statusChecker = require('../services/statusChecker');

/**
 * GET /api/status
 * Get overall system status (PUBLIC)
 */
router.get('/', async (req, res) => {
  try {
    const overall = await statusChecker.getOverallStatus();

    // Get active incidents count
    let activeIncidents = 0;
    try {
      const result = await db.query(
        "SELECT COUNT(*) as count FROM incidents WHERE status != 'resolved'"
      );
      activeIncidents = parseInt(result.rows[0]?.count) || 0;
    } catch (e) {
      // Table might not exist
    }

    res.json({
      success: true,
      status: overall.status,
      activeIncidents,
      lastUpdated: overall.lastUpdated
    });
  } catch (error) {
    log.error('Get overall status error', { error: error.message });
    res.json({
      success: true,
      status: 'operational',
      activeIncidents: 0,
      lastUpdated: new Date()
    });
  }
});

/**
 * GET /api/status/services
 * Get service-by-service status (PUBLIC)
 */
router.get('/services', async (req, res) => {
  try {
    const services = await statusChecker.getCurrentStatus();

    res.json({
      success: true,
      services: services.map(s => ({
        name: s.service_name,
        displayName: getServiceDisplayName(s.service_name),
        status: s.status,
        responseTime: s.response_time_ms,
        lastCheck: s.last_check_at
      }))
    });
  } catch (error) {
    log.error('Get services status error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get services status'
    });
  }
});

/**
 * GET /api/status/history
 * Get uptime history (PUBLIC)
 */
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const history = await statusChecker.getUptimeHistory(Math.min(days, 90));

    // Calculate uptime percentages
    const last30Days = history.slice(-30);
    const last90Days = history;

    const calculateUptime = (data) => {
      if (data.length === 0) return 100;
      const sum = data.reduce((acc, d) => acc + d.uptime, 0);
      return Math.round((sum / data.length) * 100) / 100;
    };

    res.json({
      success: true,
      uptime: {
        last30Days: calculateUptime(last30Days),
        last90Days: calculateUptime(last90Days)
      },
      history
    });
  } catch (error) {
    log.error('Get uptime history error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get uptime history'
    });
  }
});

/**
 * GET /api/status/incidents
 * Get active and recent incidents (PUBLIC)
 */
router.get('/incidents', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, description, status, severity, affected_services,
             started_at, resolved_at, created_at
      FROM incidents
      WHERE status != 'resolved' OR resolved_at > NOW() - INTERVAL '7 days'
      ORDER BY started_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      incidents: result.rows.map(i => ({
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        severity: i.severity,
        affectedServices: i.affected_services,
        startedAt: i.started_at,
        resolvedAt: i.resolved_at
      }))
    });
  } catch (error) {
    log.error('Get incidents error', { error: error.message });
    res.json({
      success: true,
      incidents: []
    });
  }
});

/**
 * GET /api/status/incidents/:id
 * Get incident details with updates (PUBLIC)
 */
router.get('/incidents/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const incidentResult = await db.query(`
      SELECT id, title, description, status, severity, affected_services,
             started_at, resolved_at, created_at
      FROM incidents
      WHERE id = $1
    `, [id]);

    if (incidentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    const updatesResult = await db.query(`
      SELECT id, message, status, created_at
      FROM incident_updates
      WHERE incident_id = $1
      ORDER BY created_at DESC
    `, [id]);

    const incident = incidentResult.rows[0];

    res.json({
      success: true,
      incident: {
        id: incident.id,
        title: incident.title,
        description: incident.description,
        status: incident.status,
        severity: incident.severity,
        affectedServices: incident.affected_services,
        startedAt: incident.started_at,
        resolvedAt: incident.resolved_at,
        updates: updatesResult.rows.map(u => ({
          id: u.id,
          message: u.message,
          status: u.status,
          createdAt: u.created_at
        }))
      }
    });
  } catch (error) {
    log.error('Get incident error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get incident'
    });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /api/admin/incidents
 * Create a new incident (Admin only)
 */
router.post('/admin/incidents', auth, async (req, res) => {
  try {
    const { title, description, severity, affectedServices } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const result = await db.query(`
      INSERT INTO incidents (title, description, status, severity, affected_services, started_at)
      VALUES ($1, $2, 'investigating', $3, $4, NOW())
      RETURNING *
    `, [title, description || '', severity || 'minor', JSON.stringify(affectedServices || [])]);

    const incident = result.rows[0];

    // Create initial update
    await db.query(`
      INSERT INTO incident_updates (incident_id, message, status)
      VALUES ($1, $2, 'investigating')
    `, [incident.id, `Investigating: ${title}`]);

    log.info('Incident created', { incidentId: incident.id, title });

    res.status(201).json({
      success: true,
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity
      }
    });
  } catch (error) {
    log.error('Create incident error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create incident'
    });
  }
});

/**
 * PUT /api/admin/incidents/:id
 * Update an incident (Admin only)
 */
router.put('/admin/incidents/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, severity, affectedServices } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (status) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
      if (status === 'resolved') {
        updates.push(`resolved_at = NOW()`);
      }
    }
    if (severity) {
      updates.push(`severity = $${paramCount++}`);
      values.push(severity);
    }
    if (affectedServices) {
      updates.push(`affected_services = $${paramCount++}`);
      values.push(JSON.stringify(affectedServices));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(id);
    const result = await db.query(`
      UPDATE incidents
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    log.info('Incident updated', { incidentId: id });

    res.json({
      success: true,
      incident: result.rows[0]
    });
  } catch (error) {
    log.error('Update incident error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update incident'
    });
  }
});

/**
 * POST /api/admin/incidents/:id/updates
 * Add an update to an incident (Admin only)
 */
router.post('/admin/incidents/:id/updates', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, status } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Verify incident exists
    const incidentCheck = await db.query('SELECT id FROM incidents WHERE id = $1', [id]);
    if (incidentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    // Insert update
    const result = await db.query(`
      INSERT INTO incident_updates (incident_id, message, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, message, status || null]);

    // Update incident status if provided
    if (status) {
      await db.query(`
        UPDATE incidents
        SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END
        WHERE id = $2
      `, [status, id]);
    }

    log.info('Incident update added', { incidentId: id });

    res.status(201).json({
      success: true,
      update: {
        id: result.rows[0].id,
        message: result.rows[0].message,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at
      }
    });
  } catch (error) {
    log.error('Add incident update error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to add incident update'
    });
  }
});

/**
 * Helper function to get display name for service
 */
function getServiceDisplayName(serviceName) {
  const names = {
    api: 'API',
    database: 'Database',
    redis: 'Cache (Redis)',
    webhooks: 'Webhooks',
    ai: 'AI Services'
  };
  return names[serviceName] || serviceName;
}

module.exports = router;
