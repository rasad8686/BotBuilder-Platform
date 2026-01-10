/**
 * V2 Health Check Routes
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/v2/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    version: 'v2',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: 'MB'
    }
  };

  res.success(health);
});

/**
 * GET /api/v2/health/ready
 * Readiness check
 */
router.get('/ready', async (req, res) => {
  // Check database connection
  let dbHealthy = true;
  try {
    const db = require('../../db');
    await db.raw('SELECT 1');
  } catch (error) {
    dbHealthy = false;
  }

  // Check Redis connection
  let redisHealthy = true;
  try {
    const redis = require('../../services/cacheService');
    if (redis.client && redis.client.ping) {
      await redis.client.ping();
    }
  } catch (error) {
    redisHealthy = false;
  }

  const isReady = dbHealthy; // Redis is optional

  const status = {
    ready: isReady,
    checks: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      cache: redisHealthy ? 'healthy' : 'degraded'
    }
  };

  if (isReady) {
    res.success(status);
  } else {
    res.status(503).json({
      success: false,
      data: status,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: 'v2'
      },
      _wrapped: true
    });
  }
});

/**
 * GET /api/v2/health/live
 * Liveness check
 */
router.get('/live', (req, res) => {
  res.success({ alive: true });
});

module.exports = router;
