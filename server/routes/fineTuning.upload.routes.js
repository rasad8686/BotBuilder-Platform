/**
 * Fine-Tuning File Upload Routes
 * Handles file uploads with automatic conversion to JSONL
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const fileConverter = require('../services/file-converter.service');
const log = require('../utils/logger');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/fine-tuning');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${baseName}_${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.json', '.jsonl', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(', ')}`));
    }
  }
});

/**
 * POST /api/fine-tuning/upload
 * Upload training data file and auto-convert to JSONL
 */
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { mapping, systemMessage, autoConvert = 'true' } = req.body;
    const filePath = req.file.path;

    log.info('Fine-tuning file upload received', {
      userId: req.user.id,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    // Get file stats and preview
    const fileStats = await fileConverter.getFileStats(filePath);
    const preview = await fileConverter.previewFile(filePath, 3);

    // Parse mapping if provided as JSON string
    let columnMapping = {};
    if (mapping) {
      try {
        columnMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
      } catch {
        columnMapping = {};
      }
    }

    // Auto-convert if requested
    let conversionResult = null;
    if (autoConvert === 'true' || autoConvert === true) {
      try {
        conversionResult = await fileConverter.convert(filePath, {
          mapping: columnMapping,
          systemMessage: systemMessage || null,
          skipEmptyRows: true,
          trimWhitespace: true
        });

        log.info('File conversion completed', {
          userId: req.user.id,
          conversionId: conversionResult.conversionId,
          validRows: conversionResult.validRows || conversionResult.validRecords || conversionResult.validLines
        });
      } catch (convError) {
        log.warn('Auto-conversion failed, file saved for manual conversion', {
          userId: req.user.id,
          error: convError.message
        });
      }
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        id: uuidv4(),
        originalName: req.file.originalname,
        storedName: req.file.filename,
        path: filePath,
        size: req.file.size,
        format: fileStats.format,
        estimatedRows: fileStats.estimatedRows
      },
      preview: {
        columns: preview.columns,
        suggestedMapping: preview.suggestedMapping,
        sampleData: preview.preview
      },
      conversion: conversionResult ? {
        success: true,
        conversionId: conversionResult.conversionId,
        convertedFile: conversionResult.convertedFile,
        validRows: conversionResult.validRows || conversionResult.validRecords || conversionResult.validLines,
        skippedRows: conversionResult.skippedRows || conversionResult.skippedRecords || conversionResult.invalidLines,
        errors: conversionResult.errors,
        mapping: conversionResult.mapping
      } : null
    });

  } catch (error) {
    log.error('File upload error', { error: error.message, userId: req.user?.id });

    // Clean up uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/preview
 * Preview file content and get suggested mappings
 */
router.post('/preview', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const maxRows = parseInt(req.body.maxRows) || 10;

    const fileStats = await fileConverter.getFileStats(filePath);
    const preview = await fileConverter.previewFile(filePath, maxRows);

    res.json({
      success: true,
      file: {
        originalName: req.file.originalname,
        size: req.file.size,
        format: fileStats.format,
        estimatedRows: fileStats.estimatedRows,
        sheetNames: fileStats.sheetNames
      },
      preview: {
        columns: preview.columns,
        suggestedMapping: preview.suggestedMapping,
        data: preview.preview,
        previewCount: preview.previewCount
      }
    });

  } catch (error) {
    log.error('File preview error', { error: error.message });

    // Clean up uploaded file
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/fine-tuning/convert
 * Convert an already uploaded file with custom mapping
 */
router.post('/convert', auth, async (req, res) => {
  try {
    const { filePath, mapping, systemMessage, sheetName, sheetIndex } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: 'File path is required'
      });
    }

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Security check - ensure file is in uploads directory
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    log.info('File conversion requested', {
      userId: req.user.id,
      filePath,
      mapping
    });

    const result = await fileConverter.convert(filePath, {
      mapping: mapping || {},
      systemMessage: systemMessage || null,
      sheetName,
      sheetIndex: sheetIndex ? parseInt(sheetIndex) : 0,
      skipEmptyRows: true,
      trimWhitespace: true
    });

    res.json({
      success: true,
      message: 'File converted successfully',
      conversion: {
        conversionId: result.conversionId,
        originalFile: result.originalFile,
        convertedFile: result.convertedFile,
        format: result.format,
        totalRows: result.totalRows || result.totalRecords || result.totalLines,
        validRows: result.validRows || result.validRecords || result.validLines,
        skippedRows: result.skippedRows || result.skippedRecords || result.invalidLines,
        errors: result.errors,
        mapping: result.mapping
      }
    });

  } catch (error) {
    log.error('File conversion error', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/conversion/:id
 * Get conversion status
 */
router.get('/conversion/:id', auth, (req, res) => {
  const status = fileConverter.getConversionStatus(req.params.id);

  if (!status) {
    return res.status(404).json({
      success: false,
      message: 'Conversion not found'
    });
  }

  res.json({
    success: true,
    status
  });
});

/**
 * POST /api/fine-tuning/validate
 * Validate a JSONL file for OpenAI fine-tuning
 */
router.post('/validate', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const format = fileConverter.autoDetectFormat(filePath);

    if (format !== 'jsonl') {
      return res.status(400).json({
        success: false,
        message: 'File must be in JSONL format for validation'
      });
    }

    const result = await fileConverter.validateAndCopyJSONL(filePath, {});

    // Clean up - we don't need the validated copy for validation endpoint
    if (fs.existsSync(result.convertedFile)) {
      fs.unlinkSync(result.convertedFile);
    }

    res.json({
      success: true,
      validation: {
        totalLines: result.totalLines,
        validLines: result.validLines,
        invalidLines: result.invalidLines,
        errors: result.errors,
        isValid: result.invalidLines === 0
      }
    });

  } catch (error) {
    log.error('File validation error', { error: error.message });

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/fine-tuning/columns/:format
 * Get common column suggestions for a format
 */
router.get('/columns/:format', auth, (req, res) => {
  const { format } = req.params;

  const commonMappings = {
    csv: {
      userPatterns: ['user', 'question', 'input', 'prompt', 'query', 'request', 'human'],
      assistantPatterns: ['assistant', 'answer', 'output', 'response', 'reply', 'bot', 'ai'],
      systemPatterns: ['system', 'instruction', 'context']
    },
    json: {
      userPatterns: ['user', 'question', 'input', 'prompt', 'query', 'messages[].user'],
      assistantPatterns: ['assistant', 'answer', 'output', 'response', 'messages[].assistant'],
      systemPatterns: ['system', 'instruction', 'context', 'messages[].system']
    }
  };

  const formatMappings = commonMappings[format] || commonMappings.csv;

  res.json({
    success: true,
    format,
    commonPatterns: formatMappings,
    example: {
      csv: `user_message,assistant_message,system_message\n"Hello",How can I help?,"You are a helpful assistant."`,
      json: `[{"user": "Hello", "assistant": "How can I help?", "system": "You are a helpful assistant."}]`,
      jsonl: `{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`
    }
  });
});

/**
 * DELETE /api/fine-tuning/file/:filename
 * Delete an uploaded file
 */
router.delete('/file/:filename', auth, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/fine-tuning', filename);

    // Security check
    if (!filePath.includes('uploads/fine-tuning')) {
      return res.status(403).json({
        success: false,
        message: 'Invalid file path'
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    fs.unlinkSync(filePath);

    // Also delete any converted files
    const convertedPattern = path.join(
      path.dirname(filePath),
      `${path.basename(filePath, path.extname(filePath))}_converted_*.jsonl`
    );

    const glob = require('glob');
    const convertedFiles = glob.sync(convertedPattern);
    convertedFiles.forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    log.error('File deletion error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
