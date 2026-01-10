const request = require('supertest');
const express = require('express');
const emailAutomationsRoutes = require('../../routes/email-automations.routes');

describe('Email Automations Routes', () => {
  let app;
  let mockDb;
  let mockAutomationEngine;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock database
    mockDb = jest.fn().mockReturnThis();
    mockDb.where = jest.fn().mockReturnThis();
    mockDb.andWhere = jest.fn().mockReturnThis();
    mockDb.first = jest.fn();
    mockDb.select = jest.fn().mockReturnThis();
    mockDb.orderBy = jest.fn().mockReturnThis();
    mockDb.limit = jest.fn().mockReturnThis();
    mockDb.offset = jest.fn().mockReturnThis();
    mockDb.insert = jest.fn();
    mockDb.update = jest.fn();
    mockDb.delete = jest.fn();
    mockDb.raw = jest.fn();
    mockDb.join = jest.fn().mockReturnThis();
    mockDb.count = jest.fn().mockReturnThis();

    // Mock automation engine
    mockAutomationEngine = {
      enrollContact: jest.fn()
    };

    // Mock user middleware
    app.use((req, res, next) => {
      req.user = { id: 'user-1', workspace_id: 'workspace-1' };
      next();
    });

    // Mount routes
    const router = emailAutomationsRoutes(mockDb, mockAutomationEngine);
    app.use('/api/email/automations', router);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/email/automations', () => {
    it('should return all automations for workspace', async () => {
      const mockAutomations = [
        { id: '1', name: 'Welcome Series', status: 'active' },
        { id: '2', name: 'Onboarding', status: 'paused' }
      ];

      mockDb.select.mockResolvedValue(mockAutomations);

      const response = await request(app)
        .get('/api/email/automations')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].name).toBe('Welcome Series');
    });

    it('should filter by status', async () => {
      const mockAutomations = [
        { id: '1', name: 'Welcome Series', status: 'active' }
      ];

      mockDb.select.mockResolvedValue(mockAutomations);

      const response = await request(app)
        .get('/api/email/automations?status=active')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should handle errors', async () => {
      mockDb.select.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/email/automations')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch automations');
    });
  });

  describe('GET /api/email/automations/:id', () => {
    it('should return a single automation', async () => {
      const mockAutomation = {
        id: '1',
        name: 'Welcome Series',
        status: 'active',
        trigger_config: JSON.stringify({ type: 'list_subscribed' }),
        steps: JSON.stringify([{ type: 'send_email' }])
      };

      mockDb.first.mockResolvedValue(mockAutomation);

      const response = await request(app)
        .get('/api/email/automations/1')
        .expect(200);

      expect(response.body.name).toBe('Welcome Series');
    });

    it('should return 404 for non-existent automation', async () => {
      mockDb.first.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/email/automations/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Automation not found');
    });
  });

  describe('POST /api/email/automations', () => {
    it('should create a new automation', async () => {
      const newAutomation = {
        name: 'New Automation',
        trigger_config: { type: 'list_subscribed', list_id: 'list-1' },
        steps: [{ type: 'send_email', config: { template_id: 'tpl-1' } }]
      };

      mockDb.insert.mockResolvedValue([1]);

      const response = await request(app)
        .post('/api/email/automations')
        .send(newAutomation)
        .expect(201);

      expect(response.body.name).toBe('New Automation');
      expect(response.body.status).toBe('draft');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      mockDb.insert.mockRejectedValue(new Error('Validation error'));

      const response = await request(app)
        .post('/api/email/automations')
        .send({ name: 'Test' })
        .expect(500);

      expect(response.body.error).toBe('Failed to create automation');
    });
  });

  describe('PUT /api/email/automations/:id', () => {
    it('should update an automation', async () => {
      const updatedAutomation = {
        id: '1',
        name: 'Updated Automation',
        status: 'active'
      };

      mockDb.update.mockResolvedValue(1);
      mockDb.first.mockResolvedValue(updatedAutomation);

      const response = await request(app)
        .put('/api/email/automations/1')
        .send({ name: 'Updated Automation' })
        .expect(200);

      expect(response.body.name).toBe('Updated Automation');
    });

    it('should handle update errors', async () => {
      mockDb.update.mockRejectedValue(new Error('Update error'));

      const response = await request(app)
        .put('/api/email/automations/1')
        .send({ name: 'Test' })
        .expect(500);

      expect(response.body.error).toBe('Failed to update automation');
    });
  });

  describe('DELETE /api/email/automations/:id', () => {
    it('should delete an automation', async () => {
      mockDb.delete.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/email/automations/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should delete enrollments first
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      mockDb.delete.mockRejectedValue(new Error('Delete error'));

      const response = await request(app)
        .delete('/api/email/automations/1')
        .expect(500);

      expect(response.body.error).toBe('Failed to delete automation');
    });
  });

  describe('POST /api/email/automations/:id/activate', () => {
    it('should activate an automation', async () => {
      const activatedAutomation = {
        id: '1',
        name: 'Test',
        status: 'active',
        activated_at: new Date()
      };

      mockDb.update.mockResolvedValue(1);
      mockDb.first.mockResolvedValue(activatedAutomation);

      const response = await request(app)
        .post('/api/email/automations/1/activate')
        .expect(200);

      expect(response.body.status).toBe('active');
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'active'
      }));
    });
  });

  describe('POST /api/email/automations/:id/pause', () => {
    it('should pause an automation', async () => {
      const pausedAutomation = {
        id: '1',
        name: 'Test',
        status: 'paused'
      };

      mockDb.update.mockResolvedValue(1);
      mockDb.first.mockResolvedValue(pausedAutomation);

      const response = await request(app)
        .post('/api/email/automations/1/pause')
        .expect(200);

      expect(response.body.status).toBe('paused');
    });
  });

  describe('GET /api/email/automations/:id/report', () => {
    it('should return automation report', async () => {
      const mockAutomation = {
        id: '1',
        name: 'Test',
        steps: JSON.stringify([{ type: 'send_email' }])
      };

      const mockEnrollmentStats = {
        total: '100',
        active: '25',
        completed: '60',
        exited: '15'
      };

      mockDb.first.mockResolvedValueOnce(mockAutomation);
      mockDb.first.mockResolvedValueOnce(mockEnrollmentStats);
      mockDb.first.mockResolvedValue({ sent: '100' });
      mockDb.select.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/email/automations/1/report')
        .expect(200);

      expect(response.body).toHaveProperty('enrolled');
      expect(response.body).toHaveProperty('active');
      expect(response.body).toHaveProperty('completed');
      expect(response.body).toHaveProperty('completionRate');
    });

    it('should return 404 for non-existent automation', async () => {
      mockDb.first.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/email/automations/non-existent/report')
        .expect(404);

      expect(response.body.error).toBe('Automation not found');
    });
  });

  describe('GET /api/email/automations/:id/enrollments', () => {
    it('should return automation enrollments', async () => {
      const mockEnrollments = [
        {
          id: 'e1',
          contact_id: 'c1',
          status: 'active',
          email: 'test@example.com',
          first_name: 'John',
          last_name: 'Doe'
        }
      ];

      mockDb.select.mockResolvedValue(mockEnrollments);

      const response = await request(app)
        .get('/api/email/automations/1/enrollments')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].contact_name).toBe('John Doe');
    });

    it('should filter enrollments by status', async () => {
      mockDb.select.mockResolvedValue([]);

      await request(app)
        .get('/api/email/automations/1/enrollments?status=active')
        .expect(200);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should support pagination', async () => {
      mockDb.select.mockResolvedValue([]);

      await request(app)
        .get('/api/email/automations/1/enrollments?page=2&limit=10')
        .expect(200);

      expect(mockDb.limit).toHaveBeenCalledWith('10');
      expect(mockDb.offset).toHaveBeenCalledWith(10);
    });
  });

  describe('DELETE /api/email/automations/:id/enrollments/:enrollmentId', () => {
    it('should remove enrollment', async () => {
      mockDb.update.mockResolvedValue(1);

      const response = await request(app)
        .delete('/api/email/automations/1/enrollments/e1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'exited'
      }));
    });
  });

  describe('POST /api/email/automations/:id/enroll', () => {
    it('should enroll a contact', async () => {
      const mockEnrollment = {
        id: 'enrollment-1',
        automation_id: '1',
        contact_id: 'contact-1',
        status: 'active'
      };

      mockAutomationEngine.enrollContact.mockResolvedValue(mockEnrollment);

      const response = await request(app)
        .post('/api/email/automations/1/enroll')
        .send({ contact_id: 'contact-1' })
        .expect(201);

      expect(response.body.id).toBe('enrollment-1');
    });

    it('should return 400 if contact_id is missing', async () => {
      const response = await request(app)
        .post('/api/email/automations/1/enroll')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('contact_id is required');
    });

    it('should return 400 if contact cannot be enrolled', async () => {
      mockAutomationEngine.enrollContact.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/email/automations/1/enroll')
        .send({ contact_id: 'contact-1' })
        .expect(400);

      expect(response.body.error).toBe('Contact is already enrolled or not eligible');
    });
  });
});
