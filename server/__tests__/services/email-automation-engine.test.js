const EmailAutomationEngineService = require('../../services/email-automation-engine.service');

describe('EmailAutomationEngineService', () => {
  let service;
  let mockDb;
  let mockEmailService;
  let mockCacheService;

  beforeEach(() => {
    // Mock database
    mockDb = jest.fn().mockReturnThis();
    mockDb.where = jest.fn().mockReturnThis();
    mockDb.andWhere = jest.fn().mockReturnThis();
    mockDb.first = jest.fn();
    mockDb.select = jest.fn().mockReturnThis();
    mockDb.orderBy = jest.fn().mockReturnThis();
    mockDb.insert = jest.fn();
    mockDb.update = jest.fn();
    mockDb.delete = jest.fn();
    mockDb.raw = jest.fn();
    mockDb.join = jest.fn().mockReturnThis();
    mockDb.leftJoin = jest.fn().mockReturnThis();

    // Mock email service
    mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
      sendTemplatedEmail: jest.fn().mockResolvedValue({ messageId: 'msg-456' })
    };

    // Mock cache service
    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    service = new EmailAutomationEngineService(mockDb, mockEmailService, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with dependencies', () => {
      expect(service.db).toBe(mockDb);
      expect(service.emailService).toBe(mockEmailService);
      expect(service.cacheService).toBe(mockCacheService);
    });
  });

  describe('getActiveAutomations', () => {
    it('should fetch active automations', async () => {
      const mockAutomations = [
        { id: '1', name: 'Welcome Series', status: 'active' },
        { id: '2', name: 'Onboarding', status: 'active' }
      ];

      mockDb.where.mockReturnThis();
      mockDb.select.mockResolvedValue(mockAutomations);

      const result = await service.getActiveAutomations();

      expect(mockDb).toHaveBeenCalledWith('email_automations');
      expect(result).toEqual(mockAutomations);
    });
  });

  describe('enrollContact', () => {
    const automationId = 'automation-1';
    const contactId = 'contact-1';

    beforeEach(() => {
      mockDb.where.mockReturnThis();
      mockDb.andWhere.mockReturnThis();
    });

    it('should enroll a contact successfully', async () => {
      const mockAutomation = {
        id: automationId,
        status: 'active',
        trigger_config: JSON.stringify({ type: 'manual' }),
        steps: JSON.stringify([{ type: 'send_email', config: {} }])
      };

      mockDb.first.mockResolvedValueOnce(mockAutomation);
      mockDb.first.mockResolvedValueOnce(null); // No existing enrollment
      mockDb.insert.mockResolvedValue([1]);

      const result = await service.enrollContact(automationId, contactId);

      expect(result).toBeDefined();
      expect(result.automation_id).toBe(automationId);
      expect(result.contact_id).toBe(contactId);
      expect(result.status).toBe('active');
    });

    it('should not enroll if automation is not active', async () => {
      const mockAutomation = {
        id: automationId,
        status: 'paused'
      };

      mockDb.first.mockResolvedValue(mockAutomation);

      const result = await service.enrollContact(automationId, contactId);

      expect(result).toBeNull();
    });

    it('should not enroll if contact is already enrolled', async () => {
      const mockAutomation = {
        id: automationId,
        status: 'active'
      };
      const existingEnrollment = {
        id: 'enrollment-1',
        status: 'active'
      };

      mockDb.first.mockResolvedValueOnce(mockAutomation);
      mockDb.first.mockResolvedValueOnce(existingEnrollment);

      const result = await service.enrollContact(automationId, contactId);

      expect(result).toBeNull();
    });
  });

  describe('processEnrollment', () => {
    const enrollmentId = 'enrollment-1';

    it('should process send_email step', async () => {
      const mockEnrollment = {
        id: enrollmentId,
        automation_id: 'auto-1',
        contact_id: 'contact-1',
        current_step: 0,
        status: 'active'
      };

      const mockAutomation = {
        id: 'auto-1',
        steps: JSON.stringify([
          { type: 'send_email', config: { template_id: 'tpl-1', subject: 'Hello' } }
        ])
      };

      const mockContact = {
        id: 'contact-1',
        email: 'test@example.com',
        first_name: 'John'
      };

      mockDb.first.mockResolvedValueOnce(mockEnrollment);
      mockDb.first.mockResolvedValueOnce(mockAutomation);
      mockDb.first.mockResolvedValueOnce(mockContact);
      mockDb.update.mockResolvedValue(1);

      await service.processEnrollment(enrollmentId);

      expect(mockEmailService.sendTemplatedEmail).toHaveBeenCalled();
    });

    it('should process wait step and schedule next processing', async () => {
      const mockEnrollment = {
        id: enrollmentId,
        automation_id: 'auto-1',
        contact_id: 'contact-1',
        current_step: 0,
        status: 'active'
      };

      const mockAutomation = {
        id: 'auto-1',
        steps: JSON.stringify([
          { type: 'wait', config: { duration: 1, unit: 'days' } },
          { type: 'send_email', config: {} }
        ])
      };

      mockDb.first.mockResolvedValueOnce(mockEnrollment);
      mockDb.first.mockResolvedValueOnce(mockAutomation);
      mockDb.update.mockResolvedValue(1);

      await service.processEnrollment(enrollmentId);

      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'waiting'
      }));
    });

    it('should complete enrollment when all steps are processed', async () => {
      const mockEnrollment = {
        id: enrollmentId,
        automation_id: 'auto-1',
        contact_id: 'contact-1',
        current_step: 1,
        status: 'active'
      };

      const mockAutomation = {
        id: 'auto-1',
        steps: JSON.stringify([
          { type: 'send_email', config: {} }
        ])
      };

      mockDb.first.mockResolvedValueOnce(mockEnrollment);
      mockDb.first.mockResolvedValueOnce(mockAutomation);
      mockDb.update.mockResolvedValue(1);

      await service.processEnrollment(enrollmentId);

      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'completed'
      }));
    });
  });

  describe('evaluateCondition', () => {
    it('should evaluate tag_has condition correctly', async () => {
      const contact = {
        id: 'contact-1',
        tags: ['vip', 'subscriber']
      };

      const condition = {
        type: 'tag_has',
        value: 'vip'
      };

      const result = await service.evaluateCondition(contact, condition);
      expect(result).toBe(true);
    });

    it('should evaluate field_equals condition correctly', async () => {
      const contact = {
        id: 'contact-1',
        status: 'active'
      };

      const condition = {
        type: 'field_equals',
        field: 'status',
        value: 'active'
      };

      const result = await service.evaluateCondition(contact, condition);
      expect(result).toBe(true);
    });

    it('should return false for non-matching condition', async () => {
      const contact = {
        id: 'contact-1',
        status: 'inactive'
      };

      const condition = {
        type: 'field_equals',
        field: 'status',
        value: 'active'
      };

      const result = await service.evaluateCondition(contact, condition);
      expect(result).toBe(false);
    });
  });

  describe('processWaitingEnrollments', () => {
    it('should process enrollments that have finished waiting', async () => {
      const mockEnrollments = [
        { id: 'e1', wait_until: new Date(Date.now() - 1000) },
        { id: 'e2', wait_until: new Date(Date.now() - 2000) }
      ];

      mockDb.where.mockReturnThis();
      mockDb.andWhere.mockReturnThis();
      mockDb.select.mockResolvedValue(mockEnrollments);
      mockDb.update.mockResolvedValue(1);

      // Mock processEnrollment
      service.processEnrollment = jest.fn().mockResolvedValue(true);

      await service.processWaitingEnrollments();

      expect(service.processEnrollment).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkTrigger', () => {
    it('should trigger for list_subscribed event', async () => {
      const automation = {
        id: 'auto-1',
        trigger_config: JSON.stringify({
          type: 'list_subscribed',
          list_id: 'list-1'
        })
      };

      const event = {
        type: 'list_subscribed',
        data: { list_id: 'list-1', contact_id: 'contact-1' }
      };

      const result = await service.checkTrigger(automation, event);
      expect(result).toBe(true);
    });

    it('should not trigger for non-matching event', async () => {
      const automation = {
        id: 'auto-1',
        trigger_config: JSON.stringify({
          type: 'list_subscribed',
          list_id: 'list-1'
        })
      };

      const event = {
        type: 'list_subscribed',
        data: { list_id: 'list-2', contact_id: 'contact-1' }
      };

      const result = await service.checkTrigger(automation, event);
      expect(result).toBe(false);
    });
  });

  describe('logActivity', () => {
    it('should log automation activity', async () => {
      mockDb.insert.mockResolvedValue([1]);

      await service.logActivity('enrollment-1', 'email_sent', { email_id: 'email-1' });

      expect(mockDb).toHaveBeenCalledWith('email_automation_activity');
      expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({
        enrollment_id: 'enrollment-1',
        event_type: 'email_sent',
        data: JSON.stringify({ email_id: 'email-1' })
      }));
    });
  });

  describe('handleTagAction', () => {
    it('should add tag to contact', async () => {
      mockDb.first.mockResolvedValue({ id: 'contact-1', tags: ['existing'] });
      mockDb.update.mockResolvedValue(1);

      await service.handleTagAction('contact-1', { action: 'add', tag: 'new-tag' });

      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        tags: JSON.stringify(['existing', 'new-tag'])
      }));
    });

    it('should remove tag from contact', async () => {
      mockDb.first.mockResolvedValue({ id: 'contact-1', tags: ['tag1', 'tag2'] });
      mockDb.update.mockResolvedValue(1);

      await service.handleTagAction('contact-1', { action: 'remove', tag: 'tag1' });

      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        tags: JSON.stringify(['tag2'])
      }));
    });
  });

  describe('handleListAction', () => {
    it('should add contact to list', async () => {
      mockDb.first.mockResolvedValue(null); // Not already subscribed
      mockDb.insert.mockResolvedValue([1]);

      await service.handleListAction('contact-1', { action: 'add', list_id: 'list-1' });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should remove contact from list', async () => {
      mockDb.update.mockResolvedValue(1);

      await service.handleListAction('contact-1', { action: 'remove', list_id: 'list-1' });

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should call webhook URL', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

      const contact = { id: 'contact-1', email: 'test@example.com' };
      const config = { url: 'https://example.com/webhook', method: 'POST' };

      await service.handleWebhook(contact, config);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  });

  describe('exitEnrollment', () => {
    it('should exit enrollment and mark as exited', async () => {
      mockDb.update.mockResolvedValue(1);

      await service.exitEnrollment('enrollment-1', 'goal_reached');

      expect(mockDb.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'exited',
        exit_reason: 'goal_reached'
      }));
    });
  });

  describe('getAutomationStats', () => {
    it('should return automation statistics', async () => {
      mockDb.first.mockResolvedValue({
        total: '100',
        active: '25',
        completed: '60',
        exited: '15'
      });

      const result = await service.getAutomationStats('auto-1');

      expect(result).toEqual({
        total: 100,
        active: 25,
        completed: 60,
        exited: 15,
        completionRate: 60
      });
    });
  });
});
