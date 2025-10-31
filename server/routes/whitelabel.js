const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { organizationContext, requireOrganization } = require('../middleware/organizationContext');
const { checkPermission } = require('../middleware/checkPermission');
const { uploadLogo, uploadFavicon } = require('../middleware/upload');
const {
  getSettings,
  updateSettings,
  uploadLogo: uploadLogoController,
  uploadFavicon: uploadFaviconController,
  getPublicSettings
} = require('../controllers/whitelabelController');

/**
 * White-label Routes
 * Endpoints for managing custom branding and white-label settings
 */

// Public route - no authentication required
router.get('/public/:domain', getPublicSettings);

// Protected routes - require authentication and organization context
router.use(authenticateToken);
router.use(organizationContext);
router.use(requireOrganization);

/**
 * GET /api/whitelabel/settings
 * Get whitelabel settings for current organization
 * Requires: Authentication, Organization context
 */
router.get('/settings', getSettings);

/**
 * PUT /api/whitelabel/settings
 * Update whitelabel settings for current organization
 * Requires: Authentication, Organization context, Admin role
 */
router.put('/settings', checkPermission('admin'), updateSettings);

/**
 * POST /api/whitelabel/upload-logo
 * Upload logo file
 * Requires: Authentication, Organization context, Admin role
 */
router.post('/upload-logo', checkPermission('admin'), (req, res) => {
  uploadLogo(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    uploadLogoController(req, res);
  });
});

/**
 * POST /api/whitelabel/upload-favicon
 * Upload favicon file
 * Requires: Authentication, Organization context, Admin role
 */
router.post('/upload-favicon', checkPermission('admin'), (req, res) => {
  uploadFavicon(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    uploadFaviconController(req, res);
  });
});

module.exports = router;
