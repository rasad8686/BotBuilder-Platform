/**
 * Dataset Upload Middleware
 *
 * Handles file uploads for fine-tuning datasets using Multer:
 * - Max file size: 100MB
 * - Allowed formats: .jsonl, .csv, .json, .txt
 * - Upload path: server/uploads/datasets/
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Upload directory
const UPLOAD_DIR = path.join(__dirname, '../uploads/datasets');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.jsonl', '.csv', '.json', '.txt'];

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * Generate unique filename
 * @param {string} originalName - Original filename
 * @returns {string} - Unique filename
 */
function generateFilename(originalName) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName).toLowerCase();
  const baseName = path.basename(originalName, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .substring(0, 50);

  return `${baseName}_${timestamp}_${random}${ext}`;
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create model-specific subdirectory if modelId is available
    let uploadPath = UPLOAD_DIR;

    if (req.params.id) {
      uploadPath = path.join(UPLOAD_DIR, `model_${req.params.id}`);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, generateFilename(file.originalname));
  }
});

/**
 * File filter - validate file type
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const error = new Error(`Invalid file type. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    return cb(error, false);
  }

  cb(null, true);
};

/**
 * Multer upload configuration
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Only one file at a time
  }
});

/**
 * Upload middleware for single file
 */
const uploadSingle = upload.single('file');

/**
 * Wrapped upload middleware with error handling
 */
const uploadDataset = (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: 'Only one file can be uploaded at a time'
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      // Generic error
      return res.status(500).json({
        success: false,
        error: 'File upload failed'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Add file info to request
    req.uploadedFile = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      extension: path.extname(req.file.originalname).toLowerCase()
    };

    next();
  });
};

/**
 * Cleanup uploaded file
 * @param {string} filePath - Path to file to delete
 */
const cleanupFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      // Error deleting file - silent fail
    });
  }
};

/**
 * Get file stats
 * @param {string} filePath - Path to file
 * @returns {Object} - File stats
 */
const getFileStats = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  return {
    size: stats.size,
    sizeFormatted: formatFileSize(stats.size),
    created: stats.birthtime,
    modified: stats.mtime
  };
};

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

module.exports = {
  uploadDataset,
  cleanupFile,
  getFileStats,
  formatFileSize,
  UPLOAD_DIR,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};
