/**
 * SDK Routes
 * Endpoints for generating and downloading SDKs
 */

const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const sdkGenerator = require('../services/sdkGenerator');
const log = require('../utils/logger');

/**
 * GET /api/sdk/languages
 * Get list of supported SDK languages
 * Public endpoint - no auth required
 */
router.get('/languages', async (req, res) => {
  try {
    const languages = sdkGenerator.getSupportedLanguages();

    res.json({
      success: true,
      languages
    });
  } catch (error) {
    log.error('[SDK] Error fetching languages:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SDK languages'
    });
  }
});

/**
 * GET /api/sdk/example/:language
 * Get quick start code example for a language
 * Public endpoint - no auth required
 */
router.get('/example/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const example = sdkGenerator.getQuickStartExample(language);

    if (!example) {
      return res.status(404).json({
        success: false,
        message: `No example found for language: ${language}`
      });
    }

    const langInfo = sdkGenerator.SUPPORTED_LANGUAGES[language];

    res.json({
      success: true,
      language: langInfo?.name || language,
      installCommand: langInfo?.installCommand || '',
      example
    });
  } catch (error) {
    log.error('[SDK] Error fetching example:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch code example'
    });
  }
});

/**
 * POST /api/sdk/generate
 * Generate SDK for a specific language
 * Requires authentication
 * Body: { language: 'javascript' | 'python' | 'php' | 'go' | 'ruby' }
 */
router.post('/generate',
  authenticateToken,
  organizationContext,
  requireOrganization,
  checkPermission('member'),
  async (req, res) => {
    try {
      const { language } = req.body;

      if (!language) {
        return res.status(400).json({
          success: false,
          message: 'Language is required'
        });
      }

      log.info('[SDK] Generating SDK', {
        language,
        userId: req.user.id,
        organizationId: req.organization.id
      });

      const result = await sdkGenerator.generateSDK(language, {
        organizationId: req.organization.id
      });

      res.json({
        success: true,
        message: 'SDK generated successfully',
        data: result
      });
    } catch (error) {
      log.error('[SDK] Error generating SDK:', { error: error.message });

      if (error.message.includes('Unsupported language')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('template not found')) {
        return res.status(404).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate SDK',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /api/sdk/download/:token
 * Download generated SDK zip file
 * Token-based authentication (no JWT required)
 */
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Download token is required'
      });
    }

    const { filePath, fileName, language } = await sdkGenerator.getSDKByToken(token);

    log.info('[SDK] SDK download', {
      language,
      fileName,
      token: token.substring(0, 8) + '...'
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    log.error('[SDK] Error downloading SDK:', { error: error.message });

    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to download SDK'
    });
  }
});

/**
 * GET /api/sdk/info/:language
 * Get detailed information about an SDK
 * Public endpoint
 */
router.get('/info/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const langInfo = sdkGenerator.SUPPORTED_LANGUAGES[language];

    if (!langInfo) {
      return res.status(404).json({
        success: false,
        message: `SDK not found for language: ${language}`
      });
    }

    const example = sdkGenerator.getQuickStartExample(language);

    res.json({
      success: true,
      data: {
        id: language,
        name: langInfo.name,
        packageManager: langInfo.packageManager,
        installCommand: langInfo.installCommand,
        fileExtension: langInfo.fileExtension,
        icon: langInfo.icon,
        example,
        features: [
          'Full API coverage',
          'Type definitions included',
          'Automatic retries',
          'Error handling',
          'Request/response logging',
          'Async/await support'
        ],
        requirements: getLanguageRequirements(language)
      }
    });
  } catch (error) {
    log.error('[SDK] Error fetching SDK info:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SDK info'
    });
  }
});

/**
 * Get language-specific requirements
 */
function getLanguageRequirements(language) {
  const requirements = {
    javascript: {
      runtime: 'Node.js 14+',
      dependencies: ['axios', 'form-data']
    },
    python: {
      runtime: 'Python 3.7+',
      dependencies: ['requests', 'pydantic']
    },
    php: {
      runtime: 'PHP 7.4+',
      dependencies: ['guzzlehttp/guzzle']
    },
    go: {
      runtime: 'Go 1.18+',
      dependencies: []
    },
    ruby: {
      runtime: 'Ruby 2.7+',
      dependencies: ['faraday', 'json']
    }
  };

  return requirements[language] || { runtime: 'Unknown', dependencies: [] };
}

module.exports = router;
