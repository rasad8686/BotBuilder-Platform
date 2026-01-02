const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const log = require('../utils/logger');
const regionsConfig = require('../config/regions');

/**
 * GET /api/regions
 * Get list of all regions
 */
router.get('/', async (req, res) => {
  try {
    const regions = Object.entries(regionsConfig.regions).map(([code, config]) => ({
      code,
      name: config.name,
      endpoint: config.endpoint,
      status: config.status,
      isDefault: code === regionsConfig.default
    }));

    res.json({
      success: true,
      regions,
      default: regionsConfig.default
    });
  } catch (error) {
    log.error('Get regions error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get regions'
    });
  }
});

/**
 * GET /api/regions/:region/status
 * Get region health status
 */
router.get('/:region/status', async (req, res) => {
  try {
    const { region } = req.params;

    const regionConfig = regionsConfig.regions[region];
    if (!regionConfig) {
      return res.status(404).json({
        success: false,
        message: 'Region not found'
      });
    }

    // Simulate health check
    const start = Date.now();

    // In production, you'd ping the actual region endpoint
    const latency = Math.floor(Math.random() * 50) + 10;
    await new Promise(resolve => setTimeout(resolve, latency));

    const responseTime = Date.now() - start;

    res.json({
      success: true,
      region: {
        code: region,
        name: regionConfig.name,
        status: regionConfig.status,
        health: regionConfig.status === 'active' ? 'healthy' : 'unavailable',
        latency: responseTime,
        lastChecked: new Date().toISOString()
      }
    });
  } catch (error) {
    log.error('Get region status error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get region status'
    });
  }
});

/**
 * GET /api/regions/latency-test
 * Test latency to all regions
 */
router.get('/latency-test', auth, async (req, res) => {
  try {
    const results = [];

    for (const [code, config] of Object.entries(regionsConfig.regions)) {
      if (config.status !== 'active') {
        results.push({
          region: code,
          name: config.name,
          latency: null,
          status: 'unavailable'
        });
        continue;
      }

      // Simulate latency test (in production, ping actual endpoints)
      const baseLatency = {
        'us-east-1': 20,
        'eu-west-1': 80,
        'ap-southeast-1': 150
      };

      const latency = (baseLatency[code] || 50) + Math.floor(Math.random() * 20);

      results.push({
        region: code,
        name: config.name,
        latency,
        status: 'healthy'
      });
    }

    // Sort by latency
    results.sort((a, b) => (a.latency || 999) - (b.latency || 999));

    res.json({
      success: true,
      results,
      recommended: results[0]?.region || regionsConfig.default
    });
  } catch (error) {
    log.error('Latency test error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to run latency test'
    });
  }
});

/**
 * PUT /api/regions/organization
 * Update organization's primary region
 */
router.put('/organization', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { primaryRegion, allowedRegions } = req.body;

    // Validate region
    if (primaryRegion && !regionsConfig.regions[primaryRegion]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid region'
      });
    }

    // Check if region is active
    if (primaryRegion && regionsConfig.regions[primaryRegion].status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Region is not active'
      });
    }

    // Get user's organization
    const orgResult = await db.query(
      `SELECT o.id FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    const orgId = orgResult.rows[0].id;

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (primaryRegion) {
      updates.push(`primary_region = $${paramCount++}`);
      values.push(primaryRegion);
    }

    if (allowedRegions) {
      // Validate all regions
      for (const r of allowedRegions) {
        if (!regionsConfig.regions[r]) {
          return res.status(400).json({
            success: false,
            message: `Invalid region: ${r}`
          });
        }
      }
      updates.push(`allowed_regions = $${paramCount++}`);
      values.push(JSON.stringify(allowedRegions));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No updates provided'
      });
    }

    values.push(orgId);
    await db.query(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    log.info('Organization region updated', { orgId, primaryRegion });

    res.json({
      success: true,
      message: 'Region settings updated'
    });
  } catch (error) {
    log.error('Update organization region error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update region settings'
    });
  }
});

/**
 * PUT /api/regions/bot/:botId
 * Update bot's region (migrate bot)
 */
router.put('/bot/:botId', auth, async (req, res) => {
  try {
    const { botId } = req.params;
    const { region } = req.body;
    const userId = req.user.id;

    // Validate region
    if (!regionsConfig.regions[region]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid region'
      });
    }

    // Check if region is active
    if (regionsConfig.regions[region].status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Region is not active'
      });
    }

    // Verify bot ownership
    const botResult = await db.query(
      'SELECT id, name, region FROM bots WHERE id = $1 AND user_id = $2',
      [botId, userId]
    );

    if (botResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found'
      });
    }

    const bot = botResult.rows[0];
    const oldRegion = bot.region;

    if (oldRegion === region) {
      return res.json({
        success: true,
        message: 'Bot is already in this region'
      });
    }

    // Update bot region
    await db.query(
      'UPDATE bots SET region = $1 WHERE id = $2',
      [region, botId]
    );

    log.info('Bot region migrated', {
      botId,
      botName: bot.name,
      fromRegion: oldRegion,
      toRegion: region
    });

    res.json({
      success: true,
      message: `Bot migrated from ${oldRegion} to ${region}`,
      migration: {
        botId,
        fromRegion: oldRegion,
        toRegion: region,
        migratedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    log.error('Migrate bot region error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to migrate bot'
    });
  }
});

/**
 * GET /api/regions/organization/settings
 * Get organization's region settings
 */
router.get('/organization/settings', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const orgResult = await db.query(
      `SELECT o.id, o.primary_region, o.allowed_regions
       FROM organizations o
       JOIN organization_members om ON om.org_id = o.id
       WHERE om.user_id = $1 AND om.status = 'active'
       LIMIT 1`,
      [userId]
    );

    if (orgResult.rows.length === 0) {
      return res.json({
        success: true,
        settings: {
          primaryRegion: regionsConfig.default,
          allowedRegions: [regionsConfig.default]
        }
      });
    }

    const org = orgResult.rows[0];

    res.json({
      success: true,
      settings: {
        primaryRegion: org.primary_region || regionsConfig.default,
        allowedRegions: org.allowed_regions || [regionsConfig.default]
      }
    });
  } catch (error) {
    log.error('Get organization region settings error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get region settings'
    });
  }
});

module.exports = router;
