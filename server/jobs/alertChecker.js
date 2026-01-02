/**
 * Alert Checker Job
 * Runs every 5 minutes to check alert thresholds and send notifications
 */

const cron = require('node-cron');
const alertService = require('../services/alertService');
const logger = require('../utils/logger');

let isRunning = false;

/**
 * Check all alert thresholds and process triggered alerts
 */
const checkAlerts = async () => {
  if (isRunning) {
    logger.info('Alert checker already running, skipping this cycle');
    return;
  }

  isRunning = true;
  logger.info('Starting alert threshold check...');

  try {
    // Get all triggered alerts
    const triggeredAlerts = await alertService.checkThresholds();

    if (triggeredAlerts.length === 0) {
      logger.info('No alerts triggered');
    } else {
      logger.info(`Found ${triggeredAlerts.length} triggered alerts`);

      // Process each triggered alert
      for (const { alert, currentValue } of triggeredAlerts) {
        try {
          await alertService.processTriggeredAlert(alert, currentValue);
        } catch (error) {
          logger.error(`Failed to process alert ${alert.id}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('Error in alert checker job:', error);
  } finally {
    isRunning = false;
    logger.info('Alert threshold check completed');
  }
};

/**
 * Start the alert checker cron job
 * Runs every 5 minutes
 */
const startAlertChecker = () => {
  // Run every 5 minutes: */5 * * * *
  const job = cron.schedule('*/5 * * * *', async () => {
    await checkAlerts();
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('Alert checker job scheduled to run every 5 minutes');

  return job;
};

/**
 * Run a single check immediately (for testing or manual trigger)
 */
const runOnce = async () => {
  await checkAlerts();
};

module.exports = {
  startAlertChecker,
  runOnce,
  checkAlerts
};
