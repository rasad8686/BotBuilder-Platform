/**
 * NLU (Natural Language Understanding) API Routes
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const IntentEntityManager = require('../services/IntentEntityManager');
const NLUImportExport = require('../services/NLUImportExport');
const IntentConflictDetector = require('../services/IntentConflictDetector');
const NLUAnalytics = require('../services/NLUAnalytics');
const authenticateToken = require('../middleware/auth');
const log = require('../utils/logger');

const manager = new IntentEntityManager();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/json', 'text/plain'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(csv|json)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/nlu/analyze - Analyze a message
 */
router.post('/analyze', async (req, res) => {
  try {
    const { botId, message, sessionId } = req.body;
    const organizationId = req.user.current_organization_id;

    if (!botId || !message) {
      return res.status(400).json({ error: 'botId and message are required' });
    }

    const startTime = Date.now();
    const result = await manager.analyzeMessage(parseInt(botId), message);
    const responseTime = Date.now() - startTime;

    // Log the analysis for analytics
    try {
      await NLUAnalytics.logAnalysis(parseInt(botId), organizationId, {
        message,
        detectedIntentId: result.intent?.id || null,
        detectedIntentName: result.intent?.name || null,
        confidence: result.confidence || 0,
        entitiesExtracted: result.entities || [],
        matched: result.matched || false,
        responseTimeMs: responseTime,
        userSessionId: sessionId || null
      });
    } catch (logError) {
      log.warn('Failed to log NLU analysis:', { error: logError.message });
    }

    res.json(result);
  } catch (error) {
    log.error('Error analyzing message:', { error: error.message });
    res.status(500).json({ error: 'Failed to analyze message' });
  }
});

/**
 * POST /api/nlu/system-entities - Create system entities for a bot
 */
router.post('/system-entities', async (req, res) => {
  try {
    const { botId } = req.body;

    if (!botId) {
      return res.status(400).json({ error: 'botId is required' });
    }

    const entities = await manager.createSystemEntities(parseInt(botId));
    res.status(201).json(entities);
  } catch (error) {
    log.error('Error creating system entities:', { error: error.message });
    res.status(500).json({ error: 'Failed to create system entities' });
  }
});

// ============================================
// IMPORT/EXPORT ENDPOINTS
// ============================================

/**
 * POST /api/nlu/import/intents - Import intents from CSV or JSON file
 */
router.post('/import/intents', upload.single('file'), async (req, res) => {
  try {
    const { bot_id } = req.body;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const isJSON = req.file.originalname.endsWith('.json') || req.file.mimetype === 'application/json';

    let result;
    if (isJSON) {
      result = await NLUImportExport.importIntentsFromJSON(parseInt(bot_id), fileContent, organizationId);
    } else {
      result = await NLUImportExport.importIntentsFromCSV(parseInt(bot_id), fileContent, organizationId);
    }

    log.info('Intents imported', { botId: bot_id, result });
    res.json({
      success: true,
      message: `Imported ${result.imported} new intents, updated ${result.updated} existing`,
      ...result
    });
  } catch (error) {
    log.error('Error importing intents:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to import intents' });
  }
});

/**
 * POST /api/nlu/import/entities - Import entities from CSV or JSON file
 */
router.post('/import/entities', upload.single('file'), async (req, res) => {
  try {
    const { bot_id } = req.body;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const isJSON = req.file.originalname.endsWith('.json') || req.file.mimetype === 'application/json';

    let result;
    if (isJSON) {
      result = await NLUImportExport.importEntitiesFromJSON(parseInt(bot_id), fileContent, organizationId);
    } else {
      result = await NLUImportExport.importEntitiesFromCSV(parseInt(bot_id), fileContent, organizationId);
    }

    log.info('Entities imported', { botId: bot_id, result });
    res.json({
      success: true,
      message: `Imported ${result.imported} new entities, updated ${result.updated} existing`,
      ...result
    });
  } catch (error) {
    log.error('Error importing entities:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to import entities' });
  }
});

/**
 * GET /api/nlu/export/intents - Export intents as CSV or JSON
 */
router.get('/export/intents', async (req, res) => {
  try {
    const { bot_id, format = 'json' } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    if (format === 'csv') {
      const csv = await NLUImportExport.exportIntentsToCSV(parseInt(bot_id), organizationId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=intents_${bot_id}.csv`);
      res.send(csv);
    } else {
      const json = await NLUImportExport.exportIntentsToJSON(parseInt(bot_id), organizationId);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=intents_${bot_id}.json`);
      res.json(json);
    }
  } catch (error) {
    log.error('Error exporting intents:', { error: error.message });
    res.status(500).json({ error: 'Failed to export intents' });
  }
});

/**
 * GET /api/nlu/export/entities - Export entities as CSV or JSON
 */
router.get('/export/entities', async (req, res) => {
  try {
    const { bot_id, format = 'json' } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    if (format === 'csv') {
      const csv = await NLUImportExport.exportEntitiesToCSV(parseInt(bot_id), organizationId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=entities_${bot_id}.csv`);
      res.send(csv);
    } else {
      const json = await NLUImportExport.exportEntitiesToJSON(parseInt(bot_id), organizationId);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=entities_${bot_id}.json`);
      res.json(json);
    }
  } catch (error) {
    log.error('Error exporting entities:', { error: error.message });
    res.status(500).json({ error: 'Failed to export entities' });
  }
});

// ============================================
// CONFLICT DETECTION ENDPOINTS
// ============================================

/**
 * GET /api/nlu/conflicts - Get conflict report for a bot
 */
router.get('/conflicts', async (req, res) => {
  try {
    const { bot_id, threshold = 0.7 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const report = await IntentConflictDetector.getConflictReport(
      parseInt(bot_id),
      organizationId,
      parseFloat(threshold)
    );

    res.json(report);
  } catch (error) {
    log.error('Error getting conflict report:', { error: error.message });
    res.status(500).json({ error: 'Failed to get conflict report' });
  }
});

/**
 * POST /api/nlu/resolve-conflict - Resolve a conflict
 */
router.post('/resolve-conflict', async (req, res) => {
  try {
    const { action, example_id, target_intent_id, source_intent_id } = req.body;
    const organizationId = req.user.current_organization_id;

    if (!action) {
      return res.status(400).json({ error: 'action is required (delete, move, or merge)' });
    }

    let result;
    switch (action) {
      case 'delete':
        if (!example_id) {
          return res.status(400).json({ error: 'example_id is required for delete action' });
        }
        result = await IntentConflictDetector.resolveConflictByDelete(parseInt(example_id), organizationId);
        break;

      case 'move':
        if (!example_id || !target_intent_id) {
          return res.status(400).json({ error: 'example_id and target_intent_id are required for move action' });
        }
        result = await IntentConflictDetector.resolveConflictByMove(
          parseInt(example_id),
          parseInt(target_intent_id),
          organizationId
        );
        break;

      case 'merge':
        if (!source_intent_id || !target_intent_id) {
          return res.status(400).json({ error: 'source_intent_id and target_intent_id are required for merge action' });
        }
        result = await IntentConflictDetector.resolveConflictByMerge(
          parseInt(source_intent_id),
          parseInt(target_intent_id),
          organizationId
        );
        break;

      default:
        return res.status(400).json({ error: 'Invalid action. Use delete, move, or merge' });
    }

    log.info('Conflict resolved', { action, result });
    res.json({ success: true, ...result });
  } catch (error) {
    log.error('Error resolving conflict:', { error: error.message });
    res.status(500).json({ error: error.message || 'Failed to resolve conflict' });
  }
});

/**
 * POST /api/nlu/find-similar - Find similar examples for a text
 */
router.post('/find-similar', async (req, res) => {
  try {
    const { bot_id, text, threshold = 0.6, limit = 10 } = req.body;
    const organizationId = req.user.current_organization_id;

    if (!bot_id || !text) {
      return res.status(400).json({ error: 'bot_id and text are required' });
    }

    const similar = await IntentConflictDetector.findSimilarExamples(
      parseInt(bot_id),
      organizationId,
      text,
      parseFloat(threshold),
      parseInt(limit)
    );

    res.json({ similar, count: similar.length });
  } catch (error) {
    log.error('Error finding similar examples:', { error: error.message });
    res.status(500).json({ error: 'Failed to find similar examples' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/nlu/analytics/summary - Get NLU analytics summary
 */
router.get('/analytics/summary', async (req, res) => {
  try {
    const { bot_id, days = 30 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const summary = await NLUAnalytics.getSummary(
      parseInt(bot_id),
      organizationId,
      parseInt(days)
    );

    res.json(summary);
  } catch (error) {
    log.error('Error getting NLU summary:', { error: error.message });
    res.status(500).json({ error: 'Failed to get NLU summary' });
  }
});

/**
 * GET /api/nlu/analytics/intents - Get intent usage statistics
 */
router.get('/analytics/intents', async (req, res) => {
  try {
    const { bot_id, days = 30 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const stats = await NLUAnalytics.getIntentStats(
      parseInt(bot_id),
      organizationId,
      parseInt(days)
    );

    res.json({ intents: stats, count: stats.length });
  } catch (error) {
    log.error('Error getting intent stats:', { error: error.message });
    res.status(500).json({ error: 'Failed to get intent statistics' });
  }
});

/**
 * GET /api/nlu/analytics/entities - Get entity extraction statistics
 */
router.get('/analytics/entities', async (req, res) => {
  try {
    const { bot_id, days = 30 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const stats = await NLUAnalytics.getEntityStats(
      parseInt(bot_id),
      organizationId,
      parseInt(days)
    );

    res.json({ entities: stats, count: stats.length });
  } catch (error) {
    log.error('Error getting entity stats:', { error: error.message });
    res.status(500).json({ error: 'Failed to get entity statistics' });
  }
});

/**
 * GET /api/nlu/analytics/confidence - Get confidence score distribution
 */
router.get('/analytics/confidence', async (req, res) => {
  try {
    const { bot_id } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const distribution = await NLUAnalytics.getConfidenceDistribution(
      parseInt(bot_id),
      organizationId
    );

    res.json(distribution);
  } catch (error) {
    log.error('Error getting confidence distribution:', { error: error.message });
    res.status(500).json({ error: 'Failed to get confidence distribution' });
  }
});

/**
 * GET /api/nlu/analytics/low-confidence - Get low confidence messages
 */
router.get('/analytics/low-confidence', async (req, res) => {
  try {
    const { bot_id, limit = 50, threshold = 0.5 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const messages = await NLUAnalytics.getLowConfidenceMessages(
      parseInt(bot_id),
      organizationId,
      parseInt(limit),
      parseFloat(threshold)
    );

    res.json({ messages, count: messages.length, threshold: parseFloat(threshold) });
  } catch (error) {
    log.error('Error getting low confidence messages:', { error: error.message });
    res.status(500).json({ error: 'Failed to get low confidence messages' });
  }
});

/**
 * GET /api/nlu/analytics/unmatched - Get unmatched messages
 */
router.get('/analytics/unmatched', async (req, res) => {
  try {
    const { bot_id, limit = 50 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const messages = await NLUAnalytics.getUnmatchedMessages(
      parseInt(bot_id),
      organizationId,
      parseInt(limit)
    );

    res.json({ messages, count: messages.length });
  } catch (error) {
    log.error('Error getting unmatched messages:', { error: error.message });
    res.status(500).json({ error: 'Failed to get unmatched messages' });
  }
});

/**
 * GET /api/nlu/analytics/training-gaps - Get training gaps report
 */
router.get('/analytics/training-gaps', async (req, res) => {
  try {
    const { bot_id } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const gaps = await NLUAnalytics.getTrainingGaps(
      parseInt(bot_id),
      organizationId
    );

    // Separate by priority
    const critical = gaps.filter(g => g.priority === 'critical');
    const high = gaps.filter(g => g.priority === 'high');
    const medium = gaps.filter(g => g.priority === 'medium');

    res.json({
      gaps,
      summary: {
        total: gaps.length,
        critical: critical.length,
        high: high.length,
        medium: medium.length
      }
    });
  } catch (error) {
    log.error('Error getting training gaps:', { error: error.message });
    res.status(500).json({ error: 'Failed to get training gaps' });
  }
});

/**
 * GET /api/nlu/analytics/daily - Get daily NLU usage statistics
 */
router.get('/analytics/daily', async (req, res) => {
  try {
    const { bot_id, days = 30 } = req.query;
    const organizationId = req.user.current_organization_id;

    if (!bot_id) {
      return res.status(400).json({ error: 'bot_id is required' });
    }

    const daily = await NLUAnalytics.getDailyUsage(
      parseInt(bot_id),
      organizationId,
      parseInt(days)
    );

    res.json({ daily, days: parseInt(days) });
  } catch (error) {
    log.error('Error getting daily usage:', { error: error.message });
    res.status(500).json({ error: 'Failed to get daily usage statistics' });
  }
});

module.exports = router;
