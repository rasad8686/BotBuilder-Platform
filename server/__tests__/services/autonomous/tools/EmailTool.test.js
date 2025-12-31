/**
 * EmailTool Tests
 * Tests for the email sending tool for autonomous agents
 */

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn()
  }))
}));

jest.mock('../../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const nodemailer = require('nodemailer');
const EmailTool = require('../../../../services/autonomous/tools/EmailTool');

describe('EmailTool', () => {
  let emailTool;
  let mockTransporter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTransporter = {
      sendMail: jest.fn()
    };
    nodemailer.createTransport.mockReturnValue(mockTransporter);

    emailTool = new EmailTool();
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(emailTool.name).toBe('send_email');
      expect(emailTool.description).toBe('Send emails via SMTP');
    });

    it('should define required parameters', () => {
      expect(emailTool.parameters.to.required).toBe(true);
      expect(emailTool.parameters.subject.required).toBe(true);
      expect(emailTool.parameters.body.required).toBe(true);
    });

    it('should define optional parameters', () => {
      expect(emailTool.parameters.html.required).toBe(false);
      expect(emailTool.parameters.cc.required).toBe(false);
      expect(emailTool.parameters.bcc.required).toBe(false);
      expect(emailTool.parameters.replyTo.required).toBe(false);
      expect(emailTool.parameters.attachments.required).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return error for missing required fields', async () => {
      const result = await emailTool.execute({ to: 'test@example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should return error for missing to field', async () => {
      const result = await emailTool.execute({
        subject: 'Test',
        body: 'Body'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should return error for missing subject', async () => {
      const result = await emailTool.execute({
        to: 'test@example.com',
        body: 'Body'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should return error for missing body', async () => {
      const result = await emailTool.execute({
        to: 'test@example.com',
        subject: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should simulate send when SMTP not configured', async () => {
      // Ensure SMTP is not configured
      emailTool.smtpConfig.auth.user = undefined;
      emailTool.smtpConfig.auth.pass = undefined;

      const result = await emailTool.execute({
        to: 'test@example.com',
        subject: 'Test Subject',
        body: 'Test body content'
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.message).toContain('simulated');
    });

    it('should return error for invalid email address', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      const result = await emailTool.execute({
        to: 'invalid-email',
        subject: 'Test',
        body: 'Body'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should validate multiple email addresses', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      const result = await emailTool.execute({
        to: 'valid@example.com, invalid-email',
        subject: 'Test',
        body: 'Body'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid email address');
    });

    it('should send email successfully', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        accepted: ['recipient@example.com'],
        rejected: []
      });

      const result = await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        body: 'Test body content'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.accepted).toContain('recipient@example.com');
    });

    it('should send HTML email', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'html-message-id',
        accepted: ['recipient@example.com'],
        rejected: []
      });

      const result = await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'HTML Test',
        body: '<h1>Hello</h1>',
        html: true
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Hello</h1>'
        })
      );
    });

    it('should include CC recipients', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'cc-message-id',
        accepted: [],
        rejected: []
      });

      await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body',
        cc: 'cc1@example.com, cc2@example.com'
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: 'cc1@example.com, cc2@example.com'
        })
      );
    });

    it('should include BCC recipients', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'bcc-message-id',
        accepted: [],
        rejected: []
      });

      await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body',
        bcc: 'bcc@example.com'
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          bcc: 'bcc@example.com'
        })
      );
    });

    it('should include reply-to address', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'replyto-message-id',
        accepted: [],
        rejected: []
      });

      await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body',
        replyTo: 'reply@example.com'
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: 'reply@example.com'
        })
      );
    });

    it('should handle attachments', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'attachment-message-id',
        accepted: [],
        rejected: []
      });

      await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body',
        attachments: [
          { filename: 'test.txt', content: 'SGVsbG8=' }
        ]
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'test.txt',
              content: 'SGVsbG8=',
              encoding: 'base64'
            })
          ])
        })
      );
    });

    it('should handle send errors', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP connection failed');
    });

    it('should log execution to context', async () => {
      emailTool.smtpConfig.auth.user = 'user@test.com';
      emailTool.smtpConfig.auth.pass = 'password';

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-id',
        accepted: [],
        rejected: []
      });

      const context = {};

      await emailTool.execute({
        to: 'recipient@example.com',
        subject: 'Test',
        body: 'Body'
      }, context);

      expect(context.toolLogs).toBeDefined();
      expect(context.toolLogs.length).toBe(1);
      expect(context.toolLogs[0].tool).toBe('send_email');
    });
  });

  describe('simulateSend', () => {
    it('should return simulated response', () => {
      const result = emailTool.simulateSend({
        to: 'test@example.com',
        subject: 'Test',
        body: 'This is a test email body'
      }, {});

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
      expect(result.preview.to).toBe('test@example.com');
      expect(result.preview.subject).toBe('Test');
    });

    it('should truncate long body in preview', () => {
      const longBody = 'x'.repeat(200);

      const result = emailTool.simulateSend({
        to: 'test@example.com',
        subject: 'Test',
        body: longBody
      }, {});

      expect(result.preview.bodyPreview.length).toBeLessThan(longBody.length);
      expect(result.preview.bodyPreview).toContain('...');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email addresses', () => {
      expect(emailTool.isValidEmail('test@example.com')).toBe(true);
      expect(emailTool.isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(emailTool.isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(emailTool.isValidEmail('invalid')).toBe(false);
      expect(emailTool.isValidEmail('missing@')).toBe(false);
      expect(emailTool.isValidEmail('@nodomain.com')).toBe(false);
      expect(emailTool.isValidEmail('spaces in@email.com')).toBe(false);
    });
  });

  describe('logExecution', () => {
    it('should create toolLogs array if not exists', () => {
      const context = {};

      emailTool.logExecution(context, { test: 'data' });

      expect(context.toolLogs).toBeDefined();
      expect(Array.isArray(context.toolLogs)).toBe(true);
    });

    it('should append to existing toolLogs', () => {
      const context = {
        toolLogs: [{ existing: 'log' }]
      };

      emailTool.logExecution(context, { test: 'data' });

      expect(context.toolLogs.length).toBe(2);
    });

    it('should include timestamp', () => {
      const context = {};

      emailTool.logExecution(context, { test: 'data' });

      expect(context.toolLogs[0].timestamp).toBeDefined();
    });
  });

  describe('getDefinition', () => {
    it('should return tool definition', () => {
      const definition = emailTool.getDefinition();

      expect(definition.name).toBe('send_email');
      expect(definition.description).toBeDefined();
      expect(definition.parameters).toBeDefined();
      expect(typeof definition.execute).toBe('function');
    });
  });
});
