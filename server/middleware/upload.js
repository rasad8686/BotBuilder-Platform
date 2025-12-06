const multer = require('multer');
const path = require('path');
const fs = require('fs');
const log = require('../utils/logger');

/**
 * File Upload Middleware for White-label Assets
 * Handles logo, favicon, and other branding file uploads
 */

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/whitelabel');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: orgId_timestamp_originalname
    const organizationId = req.organization?.id || 'default';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${organizationId}_${timestamp}_${sanitizedBasename}${ext}`;
    cb(null, filename);
  }
});

// File filter for logos (PNG, JPG, SVG)
const logoFilter = function (req, file, cb) {
  const allowedTypes = /png|jpg|jpeg|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG, JPEG, and SVG files are allowed for logos'));
  }
};

// File filter for favicons (ICO, PNG)
const faviconFilter = function (req, file, cb) {
  const allowedTypes = /ico|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'image/x-icon';

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only ICO and PNG files are allowed for favicons'));
  }
};

// Logo uploader (PNG, JPG, SVG, max 2MB)
const uploadLogo = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB
  },
  fileFilter: logoFilter
}).single('logo');

// Favicon uploader (ICO, PNG, max 1MB)
const uploadFavicon = multer({
  storage: storage,
  limits: {
    fileSize: 1 * 1024 * 1024 // 1MB
  },
  fileFilter: faviconFilter
}).single('favicon');

// Helper function to delete old file
function deleteOldFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      log.info(`[Upload] Deleted old file: ${filePath}`);
    } catch (error) {
      log.error(`[Upload] Error deleting file: ${error.message}`);
    }
  }
}

// Get public URL for uploaded file
function getPublicUrl(req, filename) {
  if (!filename) return null;
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = req.get('host');
  return `${protocol}://${host}/uploads/whitelabel/${filename}`;
}

module.exports = {
  uploadLogo,
  uploadFavicon,
  deleteOldFile,
  getPublicUrl,
  uploadDir
};
