const express = require('express');
const router = express.Router();
const log = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const KnowledgeBase = require('../models/KnowledgeBase');
const Document = require('../models/Document');
const VectorStore = require('../knowledge/VectorStore');
const DocumentProcessor = require('../knowledge/DocumentProcessor');
const EmbeddingService = require('../knowledge/EmbeddingService');
const authMiddleware = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.md', '.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * GET /api/knowledge
 * Get all knowledge bases for tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    log.debug('Fetching knowledge bases', { tenantId });
    const knowledgeBases = await KnowledgeBase.findByTenant(tenantId);
    log.debug('Knowledge bases found', { count: knowledgeBases.length });
    res.json(knowledgeBases);
  } catch (error) {
    log.error('Error fetching knowledge bases', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch knowledge bases' });
  }
});

/**
 * POST /api/knowledge
 * Create a new knowledge base
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const { name, description, embedding_model, chunk_size, chunk_overlap } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const knowledgeBase = await KnowledgeBase.create({
      tenant_id: tenantId,
      name: name.trim(),
      description: description?.trim(),
      embedding_model: embedding_model || 'text-embedding-3-small',
      chunk_size: chunk_size || 1000,
      chunk_overlap: chunk_overlap || 200
    });

    res.status(201).json(knowledgeBase);
  } catch (error) {
    log.error('Error creating knowledge base', { error: error.message });
    res.status(500).json({ error: 'Failed to create knowledge base' });
  }
});

/**
 * GET /api/knowledge/:id
 * Get a single knowledge base
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    res.json(knowledgeBase);
  } catch (error) {
    log.error('Error fetching knowledge base', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
});

/**
 * PUT /api/knowledge/:id
 * Update a knowledge base
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const { name, description, embedding_model, chunk_size, chunk_overlap, status } = req.body;

    const updated = await KnowledgeBase.update(req.params.id, {
      name: name?.trim(),
      description: description?.trim(),
      embedding_model,
      chunk_size,
      chunk_overlap,
      status
    });

    res.json(updated);
  } catch (error) {
    log.error('Error updating knowledge base', { error: error.message });
    res.status(500).json({ error: 'Failed to update knowledge base' });
  }
});

/**
 * DELETE /api/knowledge/:id
 * Delete a knowledge base
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    await KnowledgeBase.delete(req.params.id);
    res.json({ message: 'Knowledge base deleted successfully' });
  } catch (error) {
    log.error('Error deleting knowledge base', { error: error.message });
    res.status(500).json({ error: 'Failed to delete knowledge base' });
  }
});

/**
 * POST /api/knowledge/:id/documents
 * Upload a document (file or URL)
 */
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    let document;

    if (req.file) {
      // File upload
      const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
      document = await Document.create({
        knowledge_base_id: parseInt(req.params.id),
        name: req.body.name || req.file.originalname,
        type: ext,
        file_path: req.file.path,
        file_size: req.file.size,
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
      });
    } else if (req.body.url) {
      // URL document
      document = await Document.create({
        knowledge_base_id: parseInt(req.params.id),
        name: req.body.name || req.body.url,
        type: 'url',
        source_url: req.body.url,
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {}
      });
    } else {
      return res.status(400).json({ error: 'Either file or URL is required' });
    }

    // Process document asynchronously
    const processAsync = req.body.async !== 'false';

    if (processAsync) {
      // Start processing in background
      DocumentProcessor.processDocument(document.id)
        .then(() => log.info('Document processed', { documentId: document.id }))
        .catch(err => log.error('Document processing failed', { documentId: document.id, error: err.message }));

      res.status(201).json({
        ...document,
        message: 'Document uploaded and processing started'
      });
    } else {
      // Wait for processing to complete
      try {
        await DocumentProcessor.processDocument(document.id);
        const updatedDoc = await Document.findById(document.id);
        res.status(201).json(updatedDoc);
      } catch (processError) {
        res.status(201).json({
          ...document,
          status: 'failed',
          error: processError.message
        });
      }
    }
  } catch (error) {
    log.error('Error uploading document', { error: error.message });
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/**
 * GET /api/knowledge/:id/documents
 * Get all documents for a knowledge base
 */
router.get('/:id/documents', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const documents = await Document.findByKnowledgeBase(req.params.id);
    res.json(documents);
  } catch (error) {
    log.error('Error fetching documents', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/**
 * DELETE /api/knowledge/:id/documents/:docId
 * Delete a document
 */
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const document = await Document.findByIdAndKnowledgeBase(req.params.docId, req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file if exists
    if (document.file_path) {
      try {
        await fs.unlink(document.file_path);
      } catch (err) {
        log.warn('Could not delete file', { error: err.message });
      }
    }

    // Delete document (chunks will be deleted by CASCADE)
    await Document.delete(req.params.docId);

    // Update knowledge base stats
    await KnowledgeBase.updateCounts(req.params.id);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    log.error('Error deleting document', { error: error.message });
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * GET /api/knowledge/:id/agents
 * Get agents assigned to this knowledge base
 */
router.get('/:id/agents', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const agents = await VectorStore.getAgentsByKnowledgeBase(req.params.id);
    res.json(agents);
  } catch (error) {
    log.error('Error fetching assigned agents', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch assigned agents' });
  }
});

/**
 * PUT /api/knowledge/:id/agents
 * Update agent assignments for this knowledge base
 */
router.put('/:id/agents', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const { agent_ids } = req.body;

    if (!Array.isArray(agent_ids)) {
      return res.status(400).json({ error: 'agent_ids must be an array' });
    }

    // Remove all existing assignments for this KB
    await VectorStore.removeAllAgentsFromKnowledgeBase(req.params.id);

    // Add new assignments
    for (const agentId of agent_ids) {
      if (agentId) {
        await VectorStore.assignToAgent(agentId, parseInt(req.params.id));
      }
    }

    const agents = await VectorStore.getAgentsByKnowledgeBase(req.params.id);
    res.json(agents);
  } catch (error) {
    log.error('Error updating agent assignments', { error: error.message });
    res.status(500).json({ error: 'Failed to update agent assignments' });
  }
});

/**
 * POST /api/knowledge/:id/search
 * Semantic search in knowledge base
 */
router.post('/:id/search', async (req, res) => {
  try {
    const tenantId = req.user.current_organization_id || req.user.id;
    const knowledgeBase = await KnowledgeBase.findByIdAndTenant(req.params.id, tenantId);

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    const { query, limit = 5, threshold = 0.7 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Generate embedding for query
    const queryEmbedding = await EmbeddingService.getEmbedding(query.trim());

    // Search for similar chunks
    const results = await VectorStore.similaritySearch(
      parseInt(req.params.id),
      queryEmbedding,
      { limit: parseInt(limit), threshold: parseFloat(threshold) }
    );

    res.json({
      query: query.trim(),
      results,
      count: results.length
    });
  } catch (error) {
    log.error('Error performing search', { error: error.message });
    res.status(500).json({ error: 'Failed to perform search' });
  }
});

module.exports = router;
