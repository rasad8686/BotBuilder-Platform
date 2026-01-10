/**
 * Batch Routes Comprehensive Tests
 * Tests for batch.js routes
 */

const request = require('supertest');
const express = require('express');

// Mock db.query
const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  query: (...args) => mockQuery(...args)
}));

jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com', role: 'admin' };
  req.headers.authorization = 'Bearer test-token';
  next();
});

jest.mock('../../middleware/organizationContext', () => ({
  organizationContext: (req, res, next) => {
    req.organization = { id: 1, name: 'Test Org' };
    next();
  },
  requireOrganization: (req, res, next) => {
    if (!req.organization) {
      return res.status(403).json({ success: false, message: 'Organization required' });
    }
    next();
  }
}));

jest.mock('../../middleware/checkPermission', () => ({
  checkPermission: (permission) => (req, res, next) => next()
}));

jest.mock('../../services/batchProcessor', () => ({
  queueBatchJob: jest.fn().mockResolvedValue('queue-123'),
  cancelBatchJob: jest.fn().mockResolvedValue(true),
  getBatchJobStatus: jest.fn(),
  getBatchJobResults: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{"endpoint":"/api/test","method":"GET"}'),
    unlink: jest.fn().mockResolvedValue(undefined)
  }
}));

const batchRoutes = require('../../routes/batch');
const { getBatchJobStatus, getBatchJobResults } = require('../../services/batchProcessor');

const app = express();
app.use(express.json());
app.use('/api/batch', batchRoutes);

describe('Batch Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReset();
    // Reset service mocks
    getBatchJobStatus.mockReset();
    getBatchJobResults.mockReset();
  });

  // =====================
  // POST /api/batch/jobs
  // =====================

  describe('POST /api/batch/jobs', () => {
    it('should create batch job with requests array', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test Batch',
            status: 'pending',
            total_requests: 2,
            created_at: '2024-01-01'
          }]
        })
        .mockResolvedValueOnce({ rowCount: 2 }); // insert items

      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          name: 'Test Batch',
          requests: [
            { endpoint: '/api/test1', method: 'GET' },
            { endpoint: '/api/test2', method: 'POST', body: { data: 'test' } }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(1);
    });

    it('should return 400 if no requests provided', async () => {
      const res = await request(app)
        .post('/api/batch/jobs')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required');
    });

    it('should return 400 for empty requests array', async () => {
      const res = await request(app)
        .post('/api/batch/jobs')
        .send({ requests: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('At least one request');
    });

    it('should return 400 if endpoint missing', async () => {
      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [{ method: 'GET' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('endpoint is required');
    });

    it('should return 400 if endpoint does not start with /api/', async () => {
      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [{ endpoint: '/other/path', method: 'GET' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('must start with /api/');
    });

    it('should return 400 for invalid method', async () => {
      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [{ endpoint: '/api/test', method: 'INVALID' }]
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('invalid method');
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [{ endpoint: '/api/test', method: 'GET' }]
        });

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/batch/jobs
  // =====================

  describe('GET /api/batch/jobs', () => {
    it('should list batch jobs', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: 'Job 1',
              status: 'completed',
              total_requests: 10,
              completed_requests: 10,
              failed_requests: 0,
              started_at: '2024-01-01',
              completed_at: '2024-01-01',
              created_at: '2024-01-01',
              user_name: 'Admin',
              user_email: 'admin@test.com'
            }
          ]
        });

      const res = await request(app).get('/api/batch/jobs');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].progress).toBe(100);
    });

    it('should filter by status', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Job 1', status: 'completed', total_requests: 10, completed_requests: 10, failed_requests: 0 }]
        });

      const res = await request(app).get('/api/batch/jobs?status=completed');

      expect(res.status).toBe(200);
    });

    it('should handle pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/batch/jobs?page=2&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(10);
    });

    it('should return 500 on database error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/batch/jobs');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/batch/jobs/:id
  // =====================

  describe('GET /api/batch/jobs/:id', () => {
    it('should get batch job status', async () => {
      getBatchJobStatus.mockResolvedValueOnce({
        id: 1,
        organization_id: 1,
        name: 'Test Job',
        status: 'processing',
        total_requests: 100,
        completed_items: '50',
        failed_items: '5',
        pending_items: '40',
        processing_items: '5',
        started_at: '2024-01-01',
        completed_at: null,
        created_at: '2024-01-01',
        input_file_url: null,
        output_file_url: null,
        error_file_url: null
      });

      const res = await request(app).get('/api/batch/jobs/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.progress).toBe(55);
    });

    it('should return 404 if job not found', async () => {
      getBatchJobStatus.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/batch/jobs/999');

      expect(res.status).toBe(404);
    });

    it('should return 404 if organization mismatch', async () => {
      getBatchJobStatus.mockResolvedValueOnce({
        id: 1,
        organization_id: 999 // different org
      });

      const res = await request(app).get('/api/batch/jobs/1');

      expect(res.status).toBe(404);
    });

    it('should return 500 on error', async () => {
      getBatchJobStatus.mockRejectedValueOnce(new Error('Service Error'));

      const res = await request(app).get('/api/batch/jobs/1');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/batch/jobs/:id/results
  // =====================

  describe('GET /api/batch/jobs/:id/results', () => {
    it('should get job results', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      getBatchJobResults.mockResolvedValueOnce({
        items: [
          {
            request_index: 0,
            request_data: { endpoint: '/api/test' },
            response_data: { success: true },
            status: 'completed',
            error_message: null,
            processed_at: '2024-01-01'
          }
        ],
        pagination: { page: 1, limit: 50, total: 1 }
      });

      const res = await request(app).get('/api/batch/jobs/1/results');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      getBatchJobResults.mockResolvedValueOnce({
        items: [],
        pagination: { page: 1, limit: 50, total: 0 }
      });

      const res = await request(app).get('/api/batch/jobs/1/results?status=failed');

      expect(res.status).toBe(200);
    });

    it('should return 404 if job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/batch/jobs/999/results');

      expect(res.status).toBe(404);
    });

    it('should return 500 on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/batch/jobs/1/results');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // GET /api/batch/jobs/:id/download
  // =====================

  describe('GET /api/batch/jobs/:id/download', () => {
    it('should download results as JSONL', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Job', status: 'completed' }] })
        .mockResolvedValueOnce({
          rows: [
            {
              request_index: 0,
              request_data: { endpoint: '/api/test' },
              response_data: { success: true },
              status: 'completed',
              error_message: null
            }
          ]
        });

      const res = await request(app).get('/api/batch/jobs/1/download');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('ndjson');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    it('should return 404 if job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/batch/jobs/999/download');

      expect(res.status).toBe(404);
    });

    it('should return 500 on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).get('/api/batch/jobs/1/download');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // POST /api/batch/jobs/:id/cancel
  // =====================

  describe('POST /api/batch/jobs/:id/cancel', () => {
    it('should cancel batch job', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'processing' }]
        })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 5 });

      const res = await request(app).post('/api/batch/jobs/1/cancel');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).post('/api/batch/jobs/999/cancel');

      expect(res.status).toBe(404);
    });

    it('should return 400 if job already completed', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed' }]
      });

      const res = await request(app).post('/api/batch/jobs/1/cancel');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot cancel');
    });

    it('should return 500 on error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));

      const res = await request(app).post('/api/batch/jobs/1/cancel');

      expect(res.status).toBe(500);
    });
  });

  // =====================
  // DELETE /api/batch/jobs/:id
  // =====================

  describe('DELETE /api/batch/jobs/:id', () => {
    it('should delete batch job', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'completed' }] })
        .mockResolvedValueOnce({ rowCount: 10 }) // delete items
        .mockResolvedValueOnce({ rowCount: 1 }); // delete job

      const res = await request(app).delete('/api/batch/jobs/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if job not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).delete('/api/batch/jobs/999');

      expect(res.status).toBe(404);
    });

    it('should cancel and delete processing job', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'processing', input_file_url: null }]
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // delete job

      const res = await request(app).delete('/api/batch/jobs/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should delete job with input file', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'completed', input_file_url: '/path/to/file.jsonl' }]
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // delete job

      const res = await request(app).delete('/api/batch/jobs/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =====================
  // Request Validation Tests
  // =====================

  describe('Request validation', () => {
    it('should validate all valid HTTP methods', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Job', status: 'pending', total_requests: 5, created_at: '2024-01-01' }]
        })
        .mockResolvedValueOnce({ rowCount: 5 });

      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [
            { endpoint: '/api/test', method: 'GET' },
            { endpoint: '/api/test', method: 'POST' },
            { endpoint: '/api/test', method: 'PUT' },
            { endpoint: '/api/test', method: 'PATCH' },
            { endpoint: '/api/test', method: 'DELETE' }
          ]
        });

      expect(res.status).toBe(201);
    });

    it('should accept requests with headers and body', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Job', status: 'pending', total_requests: 1, created_at: '2024-01-01' }]
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [
            {
              endpoint: '/api/test',
              method: 'POST',
              body: { key: 'value' },
              headers: { 'X-Custom-Header': 'test' }
            }
          ]
        });

      expect(res.status).toBe(201);
    });

    it('should default method to GET if not specified', async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, name: 'Job', status: 'pending', total_requests: 1, created_at: '2024-01-01' }]
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post('/api/batch/jobs')
        .send({
          requests: [{ endpoint: '/api/test' }]
        });

      expect(res.status).toBe(201);
    });
  });
});
