/**
 * Email Queue Admin Routes
 * Queue monitoring, pause/resume, retry failed emails
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const emailQueueService = require('../services/email-queue.service');
const { sendCampaignProgress, sendQueueStats } = require('../websocket');

/**
 * @route GET /api/email/queue/stats
 * @desc Get global queue statistics
 * @access Private
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await emailQueueService.getQueueStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/email/queue/campaign/:campaignId
 * @desc Get queue stats for a specific campaign
 * @access Private
 */
router.get('/campaign/:campaignId', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const stats = await emailQueueService.getCampaignQueueStats(campaignId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting campaign queue stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/email/queue/campaign/:campaignId/failed
 * @desc Get failed emails for a campaign
 * @access Private
 */
router.get('/campaign/:campaignId/failed', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const failedEmails = await emailQueueService.getFailedEmails(campaignId);
    res.json({ success: true, failedEmails });
  } catch (error) {
    console.error('Error getting failed emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/email/queue/campaign/:campaignId/logs
 * @desc Get queue logs for a campaign
 * @access Private
 */
router.get('/campaign/:campaignId/logs', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { event, limit = 100 } = req.query;

    const logs = await emailQueueService.getQueueLogs(campaignId, {
      event,
      limit: parseInt(limit)
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error getting queue logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/email/queue/campaign/:campaignId/pause
 * @desc Pause a sending campaign
 * @access Private
 */
router.post('/campaign/:campaignId/pause', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = await emailQueueService.pauseCampaign(campaignId);

    // Send real-time update
    sendCampaignProgress(campaignId, {
      status: 'paused',
      message: 'Campaign paused'
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/email/queue/campaign/:campaignId/resume
 * @desc Resume a paused campaign
 * @access Private
 */
router.post('/campaign/:campaignId/resume', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = await emailQueueService.resumeCampaign(campaignId);

    // Send real-time update
    sendCampaignProgress(campaignId, {
      status: 'sending',
      message: 'Campaign resumed'
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error resuming campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/email/queue/campaign/:campaignId/cancel
 * @desc Cancel a campaign
 * @access Private
 */
router.post('/campaign/:campaignId/cancel', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = await emailQueueService.cancelCampaign(campaignId);

    // Send real-time update
    sendCampaignProgress(campaignId, {
      status: 'cancelled',
      message: 'Campaign cancelled'
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error cancelling campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/email/queue/campaign/:campaignId/retry
 * @desc Retry failed emails for a campaign
 * @access Private
 */
router.post('/campaign/:campaignId/retry', auth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = await emailQueueService.retryFailed(campaignId);

    // Send real-time update
    sendCampaignProgress(campaignId, {
      status: 'retrying',
      message: `Retrying ${result.retried} failed emails`
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error retrying failed emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route POST /api/email/queue/clean
 * @desc Clean old queue data
 * @access Private (Admin only)
 */
router.post('/clean', auth, async (req, res) => {
  try {
    const { daysOld = 7 } = req.body;
    const result = await emailQueueService.cleanQueue(daysOld);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error cleaning queue:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * @route GET /api/email/queue/health
 * @desc Check queue health status
 * @access Private
 */
router.get('/health', auth, async (req, res) => {
  try {
    const stats = await emailQueueService.getQueueStats();

    const health = {
      status: 'healthy',
      queue: stats,
      checks: {
        queueResponsive: true,
        failedJobsAcceptable: stats.failed < 100,
        noStalledJobs: stats.active < 50
      }
    };

    // Determine overall health
    if (stats.failed > 100) {
      health.status = 'degraded';
      health.message = 'High number of failed jobs';
    }
    if (stats.active > 50) {
      health.status = 'degraded';
      health.message = 'Possible stalled jobs';
    }

    res.json({ success: true, health });
  } catch (error) {
    console.error('Error checking queue health:', error);
    res.status(500).json({
      success: false,
      health: {
        status: 'unhealthy',
        error: error.message
      }
    });
  }
});

module.exports = router;
