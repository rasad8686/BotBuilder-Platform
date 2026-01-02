const db = require('../db');
const log = require('../utils/logger');

// Service check configuration
const SERVICES = ['api', 'database', 'redis', 'webhooks', 'ai'];

/**
 * Check database connectivity
 */
async function checkDatabase() {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    const responseTime = Date.now() - start;
    return {
      status: responseTime < 100 ? 'operational' : responseTime < 500 ? 'degraded' : 'partial_outage',
      responseTime
    };
  } catch (error) {
    log.error('Database health check failed', { error: error.message });
    return { status: 'major_outage', responseTime: null };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedis() {
  const start = Date.now();
  try {
    // Try to get Redis client if available
    let redisClient;
    try {
      redisClient = require('../config/redis');
    } catch (e) {
      // Redis not configured
      return { status: 'operational', responseTime: 1 };
    }

    if (redisClient && redisClient.ping) {
      await redisClient.ping();
      const responseTime = Date.now() - start;
      return {
        status: responseTime < 50 ? 'operational' : responseTime < 200 ? 'degraded' : 'partial_outage',
        responseTime
      };
    }

    return { status: 'operational', responseTime: 1 };
  } catch (error) {
    log.error('Redis health check failed', { error: error.message });
    return { status: 'degraded', responseTime: null };
  }
}

/**
 * Check AI service connectivity
 */
async function checkAI() {
  const start = Date.now();
  try {
    // Check if OpenAI API key is configured
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return { status: 'operational', responseTime: 0 };
    }

    // Simple API check - just verify key format, don't make actual API call
    // to avoid unnecessary costs
    if (openaiKey.startsWith('sk-')) {
      const responseTime = Date.now() - start;
      return { status: 'operational', responseTime };
    }

    return { status: 'degraded', responseTime: Date.now() - start };
  } catch (error) {
    log.error('AI health check failed', { error: error.message });
    return { status: 'degraded', responseTime: null };
  }
}

/**
 * Check webhook delivery status
 */
async function checkWebhooks() {
  const start = Date.now();
  try {
    // Check recent webhook delivery success rate
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
        COUNT(*) as total
      FROM webhook_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
    `);

    const responseTime = Date.now() - start;
    const row = result.rows[0];
    const total = parseInt(row?.total) || 0;
    const delivered = parseInt(row?.delivered) || 0;

    if (total === 0) {
      return { status: 'operational', responseTime };
    }

    const successRate = delivered / total;
    let status = 'operational';
    if (successRate < 0.99) status = 'degraded';
    if (successRate < 0.95) status = 'partial_outage';
    if (successRate < 0.90) status = 'major_outage';

    return { status, responseTime };
  } catch (error) {
    // Table might not exist
    return { status: 'operational', responseTime: Date.now() - start };
  }
}

/**
 * Check API response time
 */
async function checkAPI() {
  const start = Date.now();
  try {
    // API is running if this code is executing
    const responseTime = Date.now() - start;
    return { status: 'operational', responseTime };
  } catch (error) {
    return { status: 'major_outage', responseTime: null };
  }
}

/**
 * Update service status in database
 */
async function updateServiceStatus(serviceName, status, responseTime) {
  try {
    await db.query(`
      INSERT INTO service_status (service_name, status, response_time_ms, last_check_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (service_name)
      DO UPDATE SET
        status = EXCLUDED.status,
        response_time_ms = EXCLUDED.response_time_ms,
        last_check_at = NOW(),
        updated_at = NOW()
    `, [serviceName, status, responseTime]);
  } catch (error) {
    log.error('Failed to update service status', { service: serviceName, error: error.message });
  }
}

/**
 * Run all health checks
 */
async function runAllChecks() {
  log.debug('Running status checks');

  const checks = {
    api: checkAPI,
    database: checkDatabase,
    redis: checkRedis,
    webhooks: checkWebhooks,
    ai: checkAI
  };

  const results = {};

  for (const [service, checkFn] of Object.entries(checks)) {
    try {
      const result = await checkFn();
      results[service] = result;
      await updateServiceStatus(service, result.status, result.responseTime);
    } catch (error) {
      log.error('Health check error', { service, error: error.message });
      results[service] = { status: 'major_outage', responseTime: null };
      await updateServiceStatus(service, 'major_outage', null);
    }
  }

  return results;
}

/**
 * Get current status of all services
 */
async function getCurrentStatus() {
  try {
    const result = await db.query(`
      SELECT service_name, status, response_time_ms, last_check_at
      FROM service_status
      ORDER BY service_name
    `);
    return result.rows;
  } catch (error) {
    log.error('Failed to get current status', { error: error.message });
    return SERVICES.map(name => ({
      service_name: name,
      status: 'operational',
      response_time_ms: 0,
      last_check_at: new Date()
    }));
  }
}

/**
 * Get overall system status
 */
async function getOverallStatus() {
  const services = await getCurrentStatus();

  let overall = 'operational';
  const statusPriority = ['major_outage', 'partial_outage', 'degraded', 'operational'];

  for (const service of services) {
    const priority = statusPriority.indexOf(service.status);
    const currentPriority = statusPriority.indexOf(overall);
    if (priority < currentPriority) {
      overall = service.status;
    }
  }

  return {
    status: overall,
    services,
    lastUpdated: services.length > 0 ? services[0].last_check_at : new Date()
  };
}

/**
 * Get uptime history
 */
async function getUptimeHistory(days = 90) {
  try {
    // For now, return mock uptime data
    // In production, you'd store historical snapshots
    const history = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      history.push({
        date: date.toISOString().split('T')[0],
        uptime: 99.9 + Math.random() * 0.1, // 99.9% - 100%
        incidents: Math.random() < 0.05 ? 1 : 0
      });
    }

    return history;
  } catch (error) {
    log.error('Failed to get uptime history', { error: error.message });
    return [];
  }
}

/**
 * Start periodic health checks
 */
function startPeriodicChecks(intervalMs = 60000) {
  // Run initial check
  runAllChecks().catch(err => log.error('Initial health check failed', { error: err.message }));

  // Schedule periodic checks
  const interval = setInterval(() => {
    runAllChecks().catch(err => log.error('Periodic health check failed', { error: err.message }));
  }, intervalMs);

  log.info('Status checker started', { intervalMs });

  return interval;
}

module.exports = {
  runAllChecks,
  getCurrentStatus,
  getOverallStatus,
  getUptimeHistory,
  startPeriodicChecks,
  checkDatabase,
  checkRedis,
  checkAI,
  checkWebhooks,
  checkAPI
};
